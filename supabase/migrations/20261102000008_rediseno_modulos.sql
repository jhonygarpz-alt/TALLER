-- =====================================================================
-- ADMIN TALLER · Rediseño en 12 módulos (cambios solo aditivos)
-- =====================================================================

-- ---------- Aseguradoras: datos fiscales y convenio comercial ----------
alter table public.aseguradoras
  add column if not exists razon_social     text,
  add column if not exists rfc              text,
  add column if not exists contacto         text,
  add column if not exists telefono         text,
  add column if not exists email            text,
  add column if not exists dias_credito     int not null default 30 check (dias_credito >= 0),
  add column if not exists dias_contacto    int not null default 1 check (dias_contacto >= 0),
  add column if not exists condiciones      text;
create trigger trg_auditar after insert or update or delete on public.aseguradoras for each row execute function public.fn_auditar();

-- ---------- Clientes: datos fiscales (preparados para CFDI 4.0) ----------
alter table public.clientes
  add column if not exists razon_social   text,
  add column if not exists regimen_fiscal text,
  add column if not exists cp_fiscal      text,
  add column if not exists uso_cfdi       text,
  add column if not exists dias_credito   int not null default 0 check (dias_credito >= 0);

-- Seguimiento de clientes: llamadas, mensajes, citas, encuestas
create table public.cliente_seguimientos (
  id          bigint generated always as identity primary key,
  cliente_id  bigint not null references public.clientes(id) on delete cascade,
  orden_id    bigint references public.ordenes(id),
  fecha       timestamptz not null default now(),
  tipo        text not null check (tipo in ('llamada','whatsapp','correo','visita','cita','encuesta','otro')),
  fecha_cita  timestamptz,
  notas       text not null,
  usuario_id  uuid default auth.uid() references public.perfiles(id)
);
create index on public.cliente_seguimientos (cliente_id);
create index on public.cliente_seguimientos (fecha_cita);

-- ---------- Catálogos de administración ----------
create table public.sucursales (
  id        bigint generated always as identity primary key,
  nombre    text not null unique,
  direccion text,
  activo    boolean not null default true
);
insert into public.sucursales (nombre) values ('Matriz');

create table public.motivos_retraso (
  id      bigint generated always as identity primary key,
  nombre  text not null unique,
  activo  boolean not null default true
);
insert into public.motivos_retraso (nombre) values
  ('Falta de refacciones'), ('Falta de materiales'), ('Autorización pendiente de aseguradora'),
  ('Ampliación de daños'), ('Carga de trabajo'), ('Retrabajo de calidad'), ('Cliente no recoge'), ('Otro');

alter table public.ordenes add column if not exists sucursal_id bigint references public.sucursales(id);
update public.ordenes set sucursal_id = (select id from public.sucursales where nombre = 'Matriz') where sucursal_id is null;

alter table public.tecnicos
  add column if not exists especialidad text,
  add column if not exists telefono     text,
  add column if not exists sucursal_id  bigint references public.sucursales(id);

-- ---------- Planeación: programación de actividades ----------
alter table public.actividades add column if not exists fecha_programada date;
create index if not exists actividades_fecha_programada_idx on public.actividades (fecha_programada);

-- ---------- Facturación y cobranza ----------
alter table public.facturas
  add column if not exists fecha_vencimiento date,
  add column if not exists archivo_path      text,          -- PDF/XML adjunto (Storage privado)
  add column if not exists uuid_cfdi         text,          -- reservado: CFDI 4.0 (timbrado NO implementado)
  add column if not exists estado_cfdi       text not null default 'sin_timbrar'
    check (estado_cfdi in ('sin_timbrar','timbrado','cancelado'));

-- Vencimiento automático según días de crédito del receptor
create or replace function public.fn_factura_vencimiento()
returns trigger language plpgsql set search_path = '' as $$
declare dias int;
begin
  if new.fecha_vencimiento is null then
    if new.receptor = 'aseguradora' then
      select a.dias_credito into dias from public.ordenes o join public.aseguradoras a on a.id = o.aseguradora_id where o.id = new.orden_id;
    else
      select c.dias_credito into dias from public.ordenes o join public.clientes c on c.id = o.cliente_id where o.id = new.orden_id;
    end if;
    new.fecha_vencimiento := new.fecha + coalesce(dias, 0);
  end if;
  -- El timbrado CFDI no está implementado: no se acepta marcar como timbrado desde la app
  if new.estado_cfdi <> 'sin_timbrar' and not public.en_proceso() then
    raise exception 'El timbrado CFDI aún no está implementado';
  end if;
  return new;
end $$;
create trigger trg_factura_vencimiento before insert or update on public.facturas
for each row execute function public.fn_factura_vencimiento();

-- Facturas de proveedor en compras
alter table public.compras
  add column if not exists factura_monto numeric(14,2) check (factura_monto is null or factura_monto >= 0),
  add column if not exists factura_fecha date,
  add column if not exists archivo_path  text;

-- ---------- Etapas nuevas: Recepción y Preparación ----------
create or replace function public.fn_ordenes_guard()
returns trigger language plpgsql set search_path = '' as $$
declare dias int;
begin
  if tg_op = 'INSERT' then
    if not public.en_proceso() then
      new.etapa := 'recepcion';
      new.fecha_entrega := null; new.fecha_terminacion := null;
    end if;
    if new.fecha_compromiso is null and new.tipo_reparacion_id is not null then
      select dias_objetivo into dias from public.tipos_reparacion where id = new.tipo_reparacion_id;
      new.fecha_compromiso := (new.fecha_ingreso at time zone 'America/Mexico_City')::date + dias;
    end if;
    return new;
  end if;
  if not public.en_proceso() and (
       new.etapa is distinct from old.etapa
    or new.fecha_entrega is distinct from old.fecha_entrega
    or new.fecha_terminacion is distinct from old.fecha_terminacion
    or new.tipo is distinct from old.tipo
    or new.aseguradora_id is distinct from old.aseguradora_id) then
    raise exception 'La etapa, fechas de cierre y tipo de servicio solo cambian mediante el proceso correspondiente';
  end if;
  if old.etapa in ('entregado','cancelado') and not public.en_proceso()
     and (to_jsonb(new) - array['satisfaccion','encuesta_comentario','encuesta_fecha','ultima_actualizacion','motivo_retraso'])
      <> (to_jsonb(old) - array['satisfaccion','encuesta_comentario','encuesta_fecha','ultima_actualizacion','motivo_retraso']) then
    raise exception 'La orden está cerrada; solo puede registrarse la encuesta de satisfacción';
  end if;
  new.ultima_actualizacion := now();
  return new;
end $$;

create or replace function public.orden_cambiar_etapa(p_orden bigint, p_etapa public.etapa_orden, p_justificacion text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.ordenes; exc boolean := false; pend int; just text := nullif(trim(p_justificacion),'');
begin
  perform public._exigir('ordenes.etapa');
  select * into o from public.ordenes where id = p_orden for update;
  if not found then raise exception 'Orden no encontrada'; end if;
  if o.etapa in ('entregado','cancelado') then raise exception 'La orden está cerrada'; end if;
  if o.etapa = p_etapa then return; end if;
  if p_etapa = 'entregado' then raise exception 'Use el proceso de Entrega para cerrar la orden'; end if;

  if p_etapa = 'cancelado' then
    if just is null or not public.puede('excepciones.autorizar') then
      raise exception 'Cancelar requiere permiso de excepciones y una justificación';
    end if;
    exc := true;
  end if;

  if p_etapa in ('en_reparacion','hojalateria','preparacion','pintura','detallado','control_calidad','listo_entrega')
     and not exists (select 1 from public.presupuestos where orden_id = p_orden and estado = 'autorizado') then
    if just is null or not public.puede('excepciones.autorizar') then
      raise exception 'La orden no tiene presupuesto autorizado. Se requiere una excepción autorizada con justificación';
    end if;
    exc := true;
  end if;

  if p_etapa = 'listo_entrega' then
    select count(*) into pend from public.actividades where orden_id = p_orden and estado in ('asignada','en_proceso','terminada');
    if pend > 0 then
      if just is null or not public.puede('excepciones.autorizar') then
        raise exception 'Hay % trabajo(s) sin validar. Se requiere una excepción autorizada con justificación', pend;
      end if;
      exc := true;
    end if;
  end if;

  perform set_config('tallerpro.rpc', 'on', true);
  update public.ordenes set etapa = p_etapa,
    fecha_terminacion = case when p_etapa = 'listo_entrega' then coalesce(fecha_terminacion, now()) else fecha_terminacion end
  where id = p_orden;
  insert into public.orden_historial (orden_id, etapa_anterior, etapa_nueva, excepcion, justificacion)
  values (p_orden, o.etapa, p_etapa, exc, just);
  perform set_config('tallerpro.rpc', 'off', true);
end $$;

create or replace function public.presupuesto_enviar(p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.presupuestos; o public.ordenes;
begin
  perform public._exigir('presupuestos.gestionar');
  select * into p from public.presupuestos where id = p_id for update;
  if p.estado <> 'borrador' then raise exception 'El presupuesto ya fue enviado'; end if;
  if not exists (select 1 from public.presupuesto_partidas where presupuesto_id = p_id) then
    raise exception 'El presupuesto no tiene partidas';
  end if;
  select * into o from public.ordenes where id = p.orden_id for update;
  perform set_config('tallerpro.rpc', 'on', true);
  update public.presupuestos set estado = 'enviado' where id = p_id;
  if o.etapa in ('recepcion','diagnostico') then
    update public.ordenes set etapa = 'esperando_autorizacion' where id = o.id;
    insert into public.orden_historial (orden_id, etapa_anterior, etapa_nueva, justificacion)
    values (o.id, o.etapa, 'esperando_autorizacion', 'Presupuesto #' || p.numero || ' enviado');
  end if;
  perform set_config('tallerpro.rpc', 'off', true);
end $$;

create or replace function public.presupuesto_resolver(p_id bigint, p_autorizar boolean, p_autorizado_por text, p_referencia text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.presupuestos; o public.ordenes;
begin
  perform public._exigir('presupuestos.autorizar');
  if nullif(trim(p_autorizado_por),'') is null then raise exception 'Indica quién autoriza o rechaza (cliente / ajustador)'; end if;
  select * into p from public.presupuestos where id = p_id for update;
  if p.estado <> 'enviado' then raise exception 'Solo se resuelven presupuestos enviados'; end if;
  select * into o from public.ordenes where id = p.orden_id for update;
  perform set_config('tallerpro.rpc', 'on', true);
  update public.presupuestos set
    estado = case when p_autorizar then 'autorizado' else 'rechazado' end::public.estado_presupuesto,
    autorizado_por = trim(p_autorizado_por), referencia_aut = nullif(trim(p_referencia),''), fecha_autorizacion = now()
  where id = p_id;
  if p_autorizar and o.etapa in ('recepcion','diagnostico','esperando_autorizacion') then
    update public.ordenes set etapa = 'en_reparacion' where id = o.id;
    insert into public.orden_historial (orden_id, etapa_anterior, etapa_nueva, justificacion)
    values (o.id, o.etapa, 'en_reparacion', 'Presupuesto #' || p.numero || ' autorizado por ' || trim(p_autorizado_por));
  end if;
  perform set_config('tallerpro.rpc', 'off', true);
end $$;

-- ---------- Vista de cobranza por factura ----------
create view public.v_cuentas_cobrar with (security_invoker = true) as
select f.*, o.folio as orden_folio, o.tipo, o.cliente_id, o.aseguradora_id,
  c.nombre as cliente_nombre, a.nombre as aseguradora_nombre,
  case when f.receptor = 'aseguradora' then a.nombre else c.nombre end as deudor,
  coalesce((select sum(cb.monto) from public.cobros cb where cb.factura_id = f.id), 0) as pagado,
  f.monto - coalesce((select sum(cb.monto) from public.cobros cb where cb.factura_id = f.id), 0) as saldo,
  (current_date - f.fecha_vencimiento) as dias_vencido
from public.facturas f
join public.ordenes o on o.id = f.orden_id
join public.clientes c on c.id = o.cliente_id
left join public.aseguradoras a on a.id = o.aseguradora_id
where not f.cancelada;
revoke all on public.v_cuentas_cobrar from anon;

-- ---------- Seguridad de tablas nuevas ----------
alter table public.cliente_seguimientos enable row level security;
revoke all on public.cliente_seguimientos from anon;
create policy lectura on public.cliente_seguimientos for select to authenticated using ((select public.es_activo()));
create policy alta on public.cliente_seguimientos for insert to authenticated
  with check ((select public.puede('asignaciones.gestionar')) or (select public.puede('ordenes.gestionar')));

alter table public.sucursales enable row level security;
revoke all on public.sucursales from anon;
create policy lectura on public.sucursales for select to authenticated using ((select public.es_activo()));
create policy alta on public.sucursales for insert to authenticated with check ((select public.puede('config.gestionar')));
create policy cambio on public.sucursales for update to authenticated using ((select public.puede('config.gestionar'))) with check ((select public.puede('config.gestionar')));

alter table public.motivos_retraso enable row level security;
revoke all on public.motivos_retraso from anon;
create policy lectura on public.motivos_retraso for select to authenticated using ((select public.es_activo()));
create policy alta on public.motivos_retraso for insert to authenticated with check ((select public.puede('config.gestionar')));
create policy cambio on public.motivos_retraso for update to authenticated using ((select public.puede('config.gestionar'))) with check ((select public.puede('config.gestionar')));

revoke execute on function public.fn_factura_vencimiento() from public, anon, authenticated;
