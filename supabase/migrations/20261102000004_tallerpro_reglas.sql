-- =====================================================================
-- TALLERPRO · Parte 2: catálogos iniciales, auditoría, candados,
-- procesos transaccionales (RPC), vistas, seguridad RLS y Storage
-- =====================================================================

-- ------------------------- CATÁLOGOS INICIALES -----------------------
insert into public.aseguradoras (nombre) values ('MAPFRE');

insert into public.configuracion (clave, valor, descripcion) values
  ('indirectos_pct',             15,  'Gastos indirectos asignados a cada orden (% del ingreso autorizado)'),
  ('dias_alerta_entrega',         2,  'Días previos a la fecha compromiso para alertar'),
  ('dias_sin_actualizacion',      2,  'Días sin movimientos para alertar una orden'),
  ('precio_alerta_pct',          10,  'Aumento de precio (%) que genera alerta'),
  ('objetivo_contacto_pct',      90,  'Objetivo de contacto exitoso de asignaciones (%)'),
  ('objetivo_citas_pct',         80,  'Objetivo de citas concretadas (%)'),
  ('objetivo_entrega_tiempo_pct',90,  'Objetivo de entregas dentro del plazo (%)'),
  ('objetivo_satisfaccion',     4.5,  'Objetivo de satisfacción promedio (1 a 5)');

-- Plazos de ejemplo: AJUSTAR según el convenio vigente con la aseguradora
insert into public.tipos_reparacion (nombre, aseguradora_id, dias_objetivo)
select t.nombre, a.id, t.dias from (values ('Daño leve',5),('Daño medio',10),('Daño severo',20)) t(nombre,dias)
cross join public.aseguradoras a where a.nombre = 'MAPFRE';
insert into public.tipos_reparacion (nombre, dias_objetivo) values ('Servicio mecánico', 3), ('Hojalatería y pintura particular', 8);

insert into public.permisos (clave, modulo, descripcion) values
  ('asignaciones.gestionar', 'Vehículos', 'Registrar asignaciones, contactos y citas'),
  ('ordenes.gestionar',      'Vehículos', 'Recepción, expediente, entrega y encuestas'),
  ('ordenes.etapa',          'Vehículos', 'Cambiar la etapa de una orden'),
  ('presupuestos.gestionar', 'Vehículos', 'Diagnóstico, daños y elaboración de presupuestos'),
  ('presupuestos.autorizar', 'Vehículos', 'Registrar autorización/rechazo de presupuestos'),
  ('excepciones.autorizar',  'Vehículos', 'Autorizar excepciones, cancelaciones y transferencias de costo'),
  ('actividades.asignar',    'Taller',    'Asignar trabajos a técnicos'),
  ('actividades.validar',    'Taller',    'Validar o rechazar trabajos terminados'),
  ('destajos.ver',           'Taller',    'Consultar destajos'),
  ('destajos.autorizar',     'Taller',    'Autorizar destajos para pago'),
  ('destajos.pagar',         'Taller',    'Registrar el pago de destajos'),
  ('materiales.solicitar',   'Compras',   'Solicitar materiales para una orden'),
  ('materiales.autorizar',   'Compras',   'Autorizar solicitudes de material'),
  ('almacen.gestionar',      'Compras',   'Catálogo, entregas y ajustes de inventario'),
  ('compras.gestionar',      'Compras',   'Requisiciones, proveedores, cotizaciones y recepción'),
  ('compras.autorizar',      'Compras',   'Autorizar compras'),
  ('finanzas.ver',           'Resultados','Consultar costos, ingresos y rentabilidad'),
  ('finanzas.gestionar',     'Resultados','Registrar facturas, cobros, costos y gastos fijos'),
  ('reportes.ver',           'Resultados','Consultar KPIs y descargar reportes'),
  ('config.gestionar',       'Configuración','Técnicos, tarifas, plazos y parámetros'),
  ('usuarios.gestionar',     'Configuración','Usuarios, roles y permisos'),
  ('auditoria.ver',          'Configuración','Consultar bitácora de auditoría');

insert into public.rol_permisos (rol, permiso)
select r::public.rol_usuario, p from (values
  ('administracion','asignaciones.gestionar'),('administracion','ordenes.gestionar'),('administracion','ordenes.etapa'),
  ('administracion','presupuestos.gestionar'),('administracion','presupuestos.autorizar'),('administracion','excepciones.autorizar'),
  ('administracion','destajos.ver'),('administracion','destajos.autorizar'),('administracion','destajos.pagar'),
  ('administracion','materiales.solicitar'),('administracion','finanzas.ver'),('administracion','finanzas.gestionar'),
  ('administracion','reportes.ver'),('administracion','config.gestionar'),
  ('supervisor','ordenes.etapa'),('supervisor','presupuestos.gestionar'),('supervisor','actividades.asignar'),
  ('supervisor','actividades.validar'),('supervisor','destajos.ver'),('supervisor','materiales.solicitar'),
  ('supervisor','materiales.autorizar'),('supervisor','reportes.ver'),
  ('compras','materiales.solicitar'),('compras','almacen.gestionar'),('compras','compras.gestionar'),('compras','reportes.ver'),
  ('asesor','asignaciones.gestionar'),('asesor','ordenes.gestionar'),('asesor','ordenes.etapa'),
  ('tecnico','materiales.solicitar')
) x(r,p);

-- ------------------------------ AUDITORÍA ----------------------------
create or replace function public.fn_auditar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare a jsonb; d jsonb;
begin
  a := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  d := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  if tg_op = 'UPDATE' and (a - 'ultima_actualizacion') = (d - 'ultima_actualizacion') then
    return new;
  end if;
  insert into public.auditoria (usuario_id, tabla, registro_id, accion, antes, despues)
  values (auth.uid(), tg_table_name, coalesce(d->>'id', a->>'id', d->>'rol', a->>'rol', d->>'clave'), lower(tg_op), a, d);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['ordenes','presupuestos','presupuesto_partidas','actividades','destajos','materiales',
    'solicitudes_material','compras','compra_partidas','orden_costos','facturas','cobros','tarifas_destajo',
    'perfiles','rol_permisos','configuracion','gastos_fijos','tipos_reparacion','piezas_retiradas','tecnicos']
  loop
    execute format('create trigger trg_auditar after insert or update or delete on public.%I
                    for each row execute function public.fn_auditar()', t);
  end loop;
end $$;

-- ------------------------------ CANDADOS -----------------------------
-- Las funciones de proceso activan esta bandera solo durante su transacción.
create or replace function public.en_proceso()
returns boolean language sql stable set search_path = '' as $$
  select coalesce(current_setting('tallerpro.rpc', true), '') = 'on'
$$;

create or replace function public.fn_ordenes_guard()
returns trigger language plpgsql set search_path = '' as $$
declare dias int;
begin
  if tg_op = 'INSERT' then
    if not public.en_proceso() then
      new.etapa := 'diagnostico';
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
create trigger trg_ordenes_guard before insert or update on public.ordenes
for each row execute function public.fn_ordenes_guard();

-- Al recibir un vehículo de una asignación, la asignación queda "ingresado"
create or replace function public.fn_orden_desde_asignacion()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.asignacion_id is not null then
    update public.asignaciones set estatus = 'ingresado' where id = new.asignacion_id;
  end if;
  insert into public.orden_historial (orden_id, etapa_anterior, etapa_nueva, justificacion)
  values (new.id, null, new.etapa, 'Recepción del vehículo');
  return new;
end $$;
create trigger trg_orden_desde_asignacion after insert on public.ordenes
for each row execute function public.fn_orden_desde_asignacion();

-- Contactos: actualizan el estatus de la asignación
create or replace function public.fn_contacto_estatus()
returns trigger language plpgsql security definer set search_path = '' as $$
declare a public.asignaciones;
begin
  select * into a from public.asignaciones where id = new.asignacion_id for update;
  if a.estatus in ('ingresado','cancelada') then
    raise exception 'La asignación ya está cerrada (%)', a.estatus;
  end if;
  update public.asignaciones set
    intentos = intentos + 1,
    ultimo_intento = new.fecha,
    primer_contacto = case when new.resultado in ('contactado','cita_programada','reprogramada','no_acepta')
                           then coalesce(primer_contacto, new.fecha) else primer_contacto end,
    fecha_cita = case when new.resultado in ('cita_programada','reprogramada') then new.fecha_cita else fecha_cita end,
    motivo_no_cita = case when new.resultado = 'no_acepta' then new.notas else motivo_no_cita end,
    estatus = case
      when new.resultado in ('cita_programada','reprogramada') then 'cita_programada'
      when new.resultado = 'no_acepta' then 'cita_no_concretada'
      when new.resultado = 'contactado' then 'contactado'
      when new.resultado in ('no_contesta','numero_erroneo') and a.estatus = 'sin_contactar' then 'no_localizado'
      else a.estatus end::public.estatus_contacto
  where id = new.asignacion_id;
  return new;
end $$;
create trigger trg_contacto_estatus after insert on public.contactos
for each row execute function public.fn_contacto_estatus();

create or replace function public.fn_contacto_valida()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.resultado in ('cita_programada','reprogramada') and new.fecha_cita is null then
    raise exception 'Indica la fecha de la cita';
  end if;
  if new.resultado = 'no_acepta' and nullif(trim(new.notas),'') is null then
    raise exception 'Indica el motivo por el que no se concretó la cita';
  end if;
  return new;
end $$;
create trigger trg_contacto_valida before insert on public.contactos
for each row execute function public.fn_contacto_valida();

-- Presupuestos: numeración, ampliaciones y bloqueo una vez resueltos
create or replace function public.fn_presupuesto_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    select coalesce(max(numero),0) + 1 into new.numero from public.presupuestos where orden_id = new.orden_id;
    new.es_ampliacion := exists (select 1 from public.presupuestos where orden_id = new.orden_id and estado = 'autorizado');
    if not public.en_proceso() then
      new.estado := 'borrador'; new.autorizado_por := null; new.referencia_aut := null; new.fecha_autorizacion := null;
    end if;
    if exists (select 1 from public.ordenes where id = new.orden_id and etapa in ('entregado','cancelado')) then
      raise exception 'La orden está cerrada';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if old.estado <> 'borrador' then raise exception 'Solo se pueden eliminar presupuestos en borrador'; end if;
    return old;
  end if;
  if not public.en_proceso() and (new.estado is distinct from old.estado or old.estado in ('autorizado','rechazado')
       or new.orden_id is distinct from old.orden_id) then
    raise exception 'El estado del presupuesto solo cambia mediante envío/autorización; uno resuelto no se modifica (cree una ampliación)';
  end if;
  return new;
end $$;
create trigger trg_presupuesto_guard before insert or update or delete on public.presupuestos
for each row execute function public.fn_presupuesto_guard();

create or replace function public.fn_partida_guard()
returns trigger language plpgsql set search_path = '' as $$
declare st public.estado_presupuesto;
begin
  select estado into st from public.presupuestos where id = coalesce(new.presupuesto_id, old.presupuesto_id);
  if st <> 'borrador' then
    raise exception 'Solo se modifican partidas de presupuestos en borrador';
  end if;
  return coalesce(new, old);
end $$;
create trigger trg_partida_guard before insert or update or delete on public.presupuesto_partidas
for each row execute function public.fn_partida_guard();

-- Actividades: estado solo por proceso; importe tomado de la tarifa
create or replace function public.fn_actividad_guard()
returns trigger language plpgsql set search_path = '' as $$
declare tar public.tarifas_destajo;
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from public.ordenes where id = new.orden_id and etapa in ('entregado','cancelado')) then
      raise exception 'La orden está cerrada';
    end if;
    new.estado := 'asignada'; new.validado_por := null; new.validado_at := null; new.rechazos := 0;
    if new.tarifa_id is not null then
      select * into tar from public.tarifas_destajo where id = new.tarifa_id;
      new.importe_destajo := tar.importe;
      new.area := tar.area;
      new.actividad := coalesce(nullif(trim(new.actividad),''), tar.actividad);
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if old.estado <> 'asignada' then raise exception 'Solo se eliminan actividades sin iniciar; cancélela en su lugar'; end if;
    return old;
  end if;
  if not public.en_proceso() and (
       new.estado is distinct from old.estado or new.orden_id is distinct from old.orden_id
    or (old.estado in ('terminada','validada') and (new.importe_destajo, new.tecnico_id, new.tarifa_id)
        is distinct from (old.importe_destajo, old.tecnico_id, old.tarifa_id))) then
    raise exception 'Cambio no permitido: el avance y la validación se registran con sus botones; trabajos terminados no cambian técnico ni importe';
  end if;
  if new.tarifa_id is distinct from old.tarifa_id and new.tarifa_id is not null then
    select importe into new.importe_destajo from public.tarifas_destajo where id = new.tarifa_id;
  end if;
  return new;
end $$;
create trigger trg_actividad_guard before insert or update or delete on public.actividades
for each row execute function public.fn_actividad_guard();

-- Materiales: la existencia y el costo promedio solo cambian por movimientos
create or replace function public.fn_material_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if public.en_proceso() then return new; end if;
  if tg_op = 'INSERT' then
    new.existencia := 0;
  elsif new.existencia is distinct from old.existencia or new.costo_promedio is distinct from old.costo_promedio then
    raise exception 'La existencia y el costo promedio solo cambian mediante compras, entregas o ajustes autorizados';
  end if;
  return new;
end $$;
create trigger trg_material_guard before insert or update on public.materiales
for each row execute function public.fn_material_guard();

-- Solicitudes de material: siempre nacen como "solicitada"
create or replace function public.fn_solicitud_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not public.en_proceso() then
    new.estado := 'solicitada';
    new.cantidad_aprobada := null; new.cantidad_entregada := null; new.costo_unit := null; new.costo_total := null;
    new.autorizado_por := null; new.autorizado_at := null; new.entregado_por := null; new.entregado_at := null;
    new.solicitado_por := auth.uid();
  end if;
  if new.orden_id is not null and exists (select 1 from public.ordenes where id = new.orden_id and etapa = 'cancelado') then
    raise exception 'No se puede cargar material a una orden cancelada';
  end if;
  return new;
end $$;
create trigger trg_solicitud_guard before insert on public.solicitudes_material
for each row execute function public.fn_solicitud_guard();

-- Compras
create or replace function public.fn_compra_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if not public.en_proceso() then new.estado := 'requisicion'; new.autorizado_por := null; new.autorizado_at := null; new.recibido_at := null; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if old.estado not in ('requisicion','cancelada') then raise exception 'Solo se eliminan requisiciones no enviadas'; end if;
    return old;
  end if;
  if not public.en_proceso() and (new.estado is distinct from old.estado or old.estado in ('recibida','cancelada')) then
    raise exception 'El estado de la compra cambia solo mediante sus botones; una compra recibida o cancelada no se modifica';
  end if;
  return new;
end $$;
create trigger trg_compra_guard before insert or update or delete on public.compras
for each row execute function public.fn_compra_guard();

create or replace function public.fn_compra_partida_guard()
returns trigger language plpgsql set search_path = '' as $$
declare st public.estado_compra;
begin
  select estado into st from public.compras where id = coalesce(new.compra_id, old.compra_id);
  if st not in ('requisicion','por_autorizar') and not public.en_proceso() then
    raise exception 'La compra ya fue autorizada/recibida; sus partidas no se modifican';
  end if;
  return coalesce(new, old);
end $$;
create trigger trg_compra_partida_guard before insert or update or delete on public.compra_partidas
for each row execute function public.fn_compra_partida_guard();

-- Costos: no se cambian de orden sin el proceso de transferencia autorizada
create or replace function public.fn_bloquear_cambio_orden()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.orden_id is distinct from old.orden_id and not public.en_proceso() then
    raise exception 'No se permite mover costos entre órdenes sin una transferencia autorizada';
  end if;
  return new;
end $$;
create trigger trg_bloquear_cambio_orden before update on public.orden_costos
for each row execute function public.fn_bloquear_cambio_orden();
create trigger trg_bloquear_cambio_orden before update on public.facturas
for each row execute function public.fn_bloquear_cambio_orden();
create trigger trg_bloquear_cambio_orden before update on public.cobros
for each row execute function public.fn_bloquear_cambio_orden();

-- Cualquier movimiento ligado a una orden actualiza su "última actualización"
create or replace function public.fn_tocar_orden()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.orden_id is not null then
    update public.ordenes set ultima_actualizacion = now() where id = new.orden_id and etapa not in ('entregado','cancelado');
  end if;
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['actividades','fotos','danos','solicitudes_material','presupuestos','piezas_retiradas']
  loop
    execute format('create trigger trg_tocar_orden after insert or update on public.%I
                    for each row execute function public.fn_tocar_orden()', t);
  end loop;
end $$;

-- =====================================================================
-- PROCESOS (RPC). Cada uno valida permisos y se ejecuta en una transacción.
-- =====================================================================
create or replace function public._exigir(p text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.puede(p) then
    raise exception 'No tienes permiso para esta operación (%)', p using errcode = '42501';
  end if;
end $$;

-- Cambio de etapa con reglas de autorización y excepciones justificadas
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

  if p_etapa in ('en_reparacion','hojalateria','pintura','detallado','control_calidad','listo_entrega')
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

create or replace function public.orden_entregar(p_orden bigint, p_recibe text, p_checklist jsonb, p_justificacion text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.ordenes; exc boolean := false; just text := nullif(trim(p_justificacion),'');
begin
  perform public._exigir('ordenes.gestionar');
  if nullif(trim(p_recibe),'') is null then raise exception 'Indica el nombre de quien recibe'; end if;
  select * into o from public.ordenes where id = p_orden for update;
  if o.etapa in ('entregado','cancelado') then raise exception 'La orden ya está cerrada'; end if;
  if o.etapa <> 'listo_entrega' then
    if just is null or not public.puede('excepciones.autorizar') then
      raise exception 'Solo se entregan órdenes "Listo para entrega". Para otra etapa se requiere excepción con justificación';
    end if;
    exc := true;
  end if;
  perform set_config('tallerpro.rpc', 'on', true);
  update public.ordenes set etapa = 'entregado', fecha_entrega = now(),
    fecha_terminacion = coalesce(fecha_terminacion, now()), recibio_nombre = trim(p_recibe),
    checklist_calidad = coalesce(p_checklist, '{}'::jsonb)
  where id = p_orden;
  insert into public.orden_historial (orden_id, etapa_anterior, etapa_nueva, excepcion, justificacion)
  values (p_orden, o.etapa, 'entregado', exc, coalesce(just, 'Entregado a ' || trim(p_recibe)));
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
  if o.etapa = 'diagnostico' then
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
  if p_autorizar and o.etapa in ('diagnostico','esperando_autorizacion') then
    update public.ordenes set etapa = 'en_reparacion' where id = o.id;
    insert into public.orden_historial (orden_id, etapa_anterior, etapa_nueva, justificacion)
    values (o.id, o.etapa, 'en_reparacion', 'Presupuesto #' || p.numero || ' autorizado por ' || trim(p_autorizado_por));
  end if;
  perform set_config('tallerpro.rpc', 'off', true);
end $$;

-- Avance de actividades y generación automática de destajos
create or replace function public.actividad_accion(p_id bigint, p_accion text, p_horas numeric default null, p_motivo text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.actividades; es_tecnico boolean; o public.ordenes;
begin
  select * into a from public.actividades where id = p_id for update;
  if not found then raise exception 'Actividad no encontrada'; end if;
  select * into o from public.ordenes where id = a.orden_id;
  es_tecnico := exists (select 1 from public.tecnicos t where t.id = a.tecnico_id and t.perfil_id = auth.uid());
  perform set_config('tallerpro.rpc', 'on', true);

  if p_accion = 'iniciar' then
    if not (es_tecnico or public.puede('actividades.asignar')) then raise exception 'Sin permiso' using errcode='42501'; end if;
    if a.estado <> 'asignada' then raise exception 'La actividad no está pendiente de iniciar'; end if;
    update public.actividades set estado = 'en_proceso', fecha_inicio = now() where id = p_id;

  elsif p_accion = 'terminar' then
    if not (es_tecnico or public.puede('actividades.asignar')) then raise exception 'Sin permiso' using errcode='42501'; end if;
    if a.estado not in ('asignada','en_proceso') then raise exception 'La actividad no está en proceso'; end if;
    if not exists (select 1 from public.fotos where categoria = 'actividad' and ref_id = p_id) then
      raise exception 'Adjunta una fotografía de evidencia antes de terminar';
    end if;
    update public.actividades set estado = 'terminada', fecha_inicio = coalesce(fecha_inicio, now()), fecha_fin = now(),
      horas = coalesce(p_horas, round(extract(epoch from now() - coalesce(fecha_inicio, now())) / 3600.0, 2))
    where id = p_id;

  elsif p_accion = 'validar' then
    perform public._exigir('actividades.validar');
    if a.estado <> 'terminada' then raise exception 'Solo se validan trabajos terminados'; end if;
    update public.actividades set estado = 'validada', validado_por = auth.uid(), validado_at = now() where id = p_id;
    if a.importe_destajo > 0 then
      insert into public.destajos (actividad_id, orden_id, tecnico_id, tipo, importe)
      values (a.id, a.orden_id, a.tecnico_id, o.tipo, a.importe_destajo);
    end if;

  elsif p_accion = 'rechazar' then
    perform public._exigir('actividades.validar');
    if a.estado <> 'terminada' then raise exception 'Solo se rechazan trabajos terminados'; end if;
    if nullif(trim(p_motivo),'') is null then raise exception 'Indica el motivo del retrabajo'; end if;
    update public.actividades set estado = 'en_proceso', rechazos = rechazos + 1, motivo_rechazo = trim(p_motivo), fecha_fin = null
    where id = p_id;

  elsif p_accion = 'cancelar' then
    perform public._exigir('actividades.asignar');
    if a.estado = 'validada' then raise exception 'Un trabajo validado no se cancela'; end if;
    update public.actividades set estado = 'cancelada', motivo_rechazo = nullif(trim(p_motivo),'') where id = p_id;
  else
    raise exception 'Acción desconocida';
  end if;
  perform set_config('tallerpro.rpc', 'off', true);
end $$;

create or replace function public.destajos_autorizar(p_ids bigint[])
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform public._exigir('destajos.autorizar');
  perform 1 from public.destajos where id = any(p_ids) for update;
  if exists (select 1 from public.destajos where id = any(p_ids) and estado <> 'pendiente') then
    raise exception 'Solo se autorizan destajos pendientes';
  end if;
  update public.destajos set estado = 'autorizado', autorizado_por = auth.uid(), autorizado_at = now()
  where id = any(p_ids);
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.destajos_pagar(p_ids bigint[], p_referencia text)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform public._exigir('destajos.pagar');
  if nullif(trim(p_referencia),'') is null then raise exception 'Indica la referencia del pago (nómina, transferencia, recibo)'; end if;
  perform 1 from public.destajos where id = any(p_ids) for update;
  if exists (select 1 from public.destajos where id = any(p_ids) and estado <> 'autorizado') then
    raise exception 'Solo se pagan destajos autorizados y no pagados previamente';
  end if;
  update public.destajos set estado = 'pagado', pagado_por = auth.uid(), pagado_at = now(), referencia_pago = trim(p_referencia)
  where id = any(p_ids);
  get diagnostics n = row_count;
  return n;
end $$;

-- Solicitudes de material
create or replace function public.solicitud_resolver(p_id bigint, p_aprobar boolean, p_cantidad numeric default null, p_motivo text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.solicitudes_material;
begin
  perform public._exigir('materiales.autorizar');
  select * into s from public.solicitudes_material where id = p_id for update;
  if s.estado <> 'solicitada' then raise exception 'La solicitud ya fue resuelta'; end if;
  if p_aprobar then
    if coalesce(p_cantidad, s.cantidad_solicitada) <= 0 then raise exception 'Cantidad inválida'; end if;
    update public.solicitudes_material set estado = 'autorizada', cantidad_aprobada = coalesce(p_cantidad, s.cantidad_solicitada),
      autorizado_por = auth.uid(), autorizado_at = now() where id = p_id;
  else
    if nullif(trim(p_motivo),'') is null then raise exception 'Indica el motivo del rechazo'; end if;
    update public.solicitudes_material set estado = 'rechazada', motivo_rechazo = trim(p_motivo),
      autorizado_por = auth.uid(), autorizado_at = now() where id = p_id;
  end if;
end $$;

create or replace function public.solicitud_entregar(p_id bigint, p_cantidad numeric default null)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.solicitudes_material; m public.materiales; cant numeric;
begin
  perform public._exigir('almacen.gestionar');
  select * into s from public.solicitudes_material where id = p_id for update;
  if s.estado <> 'autorizada' then raise exception 'Solo se entregan solicitudes autorizadas'; end if;
  cant := coalesce(p_cantidad, s.cantidad_aprobada);
  if cant <= 0 or cant > s.cantidad_aprobada then raise exception 'La cantidad entregada debe ser mayor a 0 y no exceder lo autorizado (%)', s.cantidad_aprobada; end if;
  select * into m from public.materiales where id = s.material_id for update;
  if m.existencia < cant then raise exception 'Existencia insuficiente: hay % %', m.existencia, m.unidad; end if;
  perform set_config('tallerpro.rpc', 'on', true);
  update public.materiales set existencia = existencia - cant where id = m.id;
  update public.solicitudes_material set estado = 'entregada', cantidad_entregada = cant, costo_unit = m.costo_promedio,
    costo_total = round(cant * m.costo_promedio, 2), entregado_por = auth.uid(), entregado_at = now() where id = p_id;
  insert into public.movimientos_inventario (material_id, tipo, cantidad, costo_unit, existencia_resultante, orden_id, solicitud_id, motivo)
  values (m.id, 'salida', -cant, m.costo_promedio, m.existencia - cant, s.orden_id, s.id,
          case when s.orden_id is not null then 'Entrega a orden' else 'Consumo general: ' || s.centro_costo end);
  perform set_config('tallerpro.rpc', 'off', true);
end $$;

create or replace function public.inventario_ajustar(p_material bigint, p_existencia numeric, p_motivo text, p_costo numeric default null)
returns void language plpgsql security definer set search_path = '' as $$
declare m public.materiales;
begin
  perform public._exigir('almacen.gestionar');
  if nullif(trim(p_motivo),'') is null then raise exception 'Indica el motivo del ajuste'; end if;
  if p_existencia < 0 then raise exception 'La existencia no puede ser negativa'; end if;
  select * into m from public.materiales where id = p_material for update;
  perform set_config('tallerpro.rpc', 'on', true);
  update public.materiales set existencia = p_existencia, costo_promedio = coalesce(p_costo, costo_promedio) where id = p_material;
  insert into public.movimientos_inventario (material_id, tipo, cantidad, costo_unit, existencia_resultante, motivo)
  values (p_material, 'ajuste', p_existencia - m.existencia, coalesce(p_costo, m.costo_promedio), p_existencia, trim(p_motivo));
  perform set_config('tallerpro.rpc', 'off', true);
end $$;

-- Compras: enviar, autorizar, cancelar, recibir (entra a inventario con costo promedio)
create or replace function public.compra_accion(p_id bigint, p_accion text, p_factura text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.compras; r record; m public.materiales; nueva numeric; costo numeric; ant numeric; sid bigint;
begin
  select * into c from public.compras where id = p_id for update;
  if not found then raise exception 'Compra no encontrada'; end if;
  perform set_config('tallerpro.rpc', 'on', true);

  if p_accion = 'enviar' then
    perform public._exigir('compras.gestionar');
    if c.estado <> 'requisicion' then raise exception 'Solo se envían requisiciones'; end if;
    if not exists (select 1 from public.compra_partidas where compra_id = p_id) then raise exception 'La requisición no tiene partidas'; end if;
    update public.compras set estado = 'por_autorizar' where id = p_id;

  elsif p_accion = 'autorizar' then
    perform public._exigir('compras.autorizar');
    if c.estado <> 'por_autorizar' then raise exception 'La compra no está pendiente de autorización'; end if;
    update public.compras set estado = 'autorizada', autorizado_por = auth.uid(), autorizado_at = now() where id = p_id;

  elsif p_accion = 'cancelar' then
    if not (public.puede('compras.gestionar') or public.puede('compras.autorizar')) then raise exception 'Sin permiso' using errcode='42501'; end if;
    if c.estado in ('recibida','cancelada') then raise exception 'La compra ya está cerrada'; end if;
    update public.compras set estado = 'cancelada' where id = p_id;

  elsif p_accion = 'recibir' then
    perform public._exigir('compras.gestionar');
    if c.estado <> 'autorizada' then raise exception 'Solo se reciben compras autorizadas'; end if;
    if nullif(trim(coalesce(p_factura, c.factura)),'') is null then raise exception 'Registra el número de factura o nota'; end if;
    for r in select * from public.compra_partidas where compra_id = p_id order by id loop
      select * into m from public.materiales where id = r.material_id for update;
      nueva := m.existencia + r.cantidad;
      costo := case when nueva > 0 then (m.existencia * m.costo_promedio + r.cantidad * r.costo_unit) / nueva else r.costo_unit end;
      update public.materiales set existencia = nueva, costo_promedio = round(costo, 4) where id = m.id;
      insert into public.movimientos_inventario (material_id, tipo, cantidad, costo_unit, existencia_resultante, compra_id, orden_id, motivo)
      values (m.id, 'entrada', r.cantidad, r.costo_unit, nueva, p_id, r.orden_id, 'Recepción de compra');
      select ph.costo_unit into ant from public.precios_historial ph where ph.material_id = m.id order by ph.fecha desc, ph.id desc limit 1;
      insert into public.precios_historial (material_id, proveedor_id, compra_id, costo_unit, costo_anterior)
      values (m.id, c.proveedor_id, p_id, r.costo_unit, coalesce(ant, nullif(m.costo_promedio,0)));
      -- Compra específica para una orden: se carga directo a la orden al costo de compra
      if r.orden_id is not null then
        update public.materiales set existencia = existencia - r.cantidad where id = m.id;
        insert into public.solicitudes_material (orden_id, material_id, cantidad_solicitada, cantidad_aprobada, cantidad_entregada,
          costo_unit, costo_total, estado, notas, solicitado_por, autorizado_por, autorizado_at, entregado_por, entregado_at)
        values (r.orden_id, m.id, r.cantidad, r.cantidad, r.cantidad, r.costo_unit, round(r.cantidad * r.costo_unit, 2),
          'entregada', 'Compra directa para la orden', c.solicitado_por, c.autorizado_por, c.autorizado_at, auth.uid(), now())
        returning id into sid;
        insert into public.movimientos_inventario (material_id, tipo, cantidad, costo_unit, existencia_resultante, orden_id, solicitud_id, compra_id, motivo)
        values (m.id, 'salida', -r.cantidad, r.costo_unit, nueva - r.cantidad, r.orden_id, sid, p_id, 'Cargo directo a orden');
      end if;
    end loop;
    update public.compras set estado = 'recibida', recibido_at = now(), factura = coalesce(nullif(trim(p_factura),''), factura) where id = p_id;
  else
    raise exception 'Acción desconocida';
  end if;
  perform set_config('tallerpro.rpc', 'off', true);
end $$;

-- Transferencia de costos entre órdenes (solo con autorización y del mismo tipo de servicio)
create or replace function public.costo_transferir(p_tabla text, p_id bigint, p_orden_destino bigint, p_justificacion text)
returns void language plpgsql security definer set search_path = '' as $$
declare origen bigint; t1 public.tipo_servicio; t2 public.tipo_servicio;
begin
  perform public._exigir('excepciones.autorizar');
  if nullif(trim(p_justificacion),'') is null then raise exception 'La transferencia requiere justificación'; end if;
  if p_tabla = 'solicitudes_material' then
    select orden_id into origen from public.solicitudes_material where id = p_id for update;
  elsif p_tabla = 'orden_costos' then
    select orden_id into origen from public.orden_costos where id = p_id for update;
  else raise exception 'Tipo de costo no transferible'; end if;
  if origen is null then raise exception 'El costo no está ligado a una orden'; end if;
  select tipo into t1 from public.ordenes where id = origen;
  select tipo into t2 from public.ordenes where id = p_orden_destino;
  if t2 is null then raise exception 'Orden destino no encontrada'; end if;
  if t1 <> t2 then raise exception 'No se permite mezclar costos de aseguradora y particulares'; end if;
  perform set_config('tallerpro.rpc', 'on', true);
  if p_tabla = 'solicitudes_material' then
    update public.solicitudes_material set orden_id = p_orden_destino where id = p_id;
  else
    update public.orden_costos set orden_id = p_orden_destino where id = p_id;
  end if;
  insert into public.auditoria (usuario_id, tabla, registro_id, accion, antes, despues)
  values (auth.uid(), p_tabla, p_id::text, 'transferencia',
          jsonb_build_object('orden_id', origen), jsonb_build_object('orden_id', p_orden_destino, 'justificacion', trim(p_justificacion)));
  perform set_config('tallerpro.rpc', 'off', true);
end $$;

-- =====================================================================
-- VISTAS (respetan RLS del usuario)
-- =====================================================================
create view public.v_ordenes with (security_invoker = true) as
select o.*,
  c.nombre  as cliente_nombre, c.telefono as cliente_telefono,
  v.marca, v.modelo, v.anio, v.placas, v.color,
  a.nombre  as aseguradora_nombre,
  pa.nombre as asesor_nombre,
  tr.nombre as tipo_reparacion_nombre,
  ((coalesce(o.fecha_entrega, now()) at time zone 'America/Mexico_City')::date
     - (o.fecha_ingreso at time zone 'America/Mexico_City')::date) as dias_en_taller,
  (o.etapa not in ('entregado','cancelado') and o.fecha_compromiso < current_date) as retrasado,
  (o.etapa = 'entregado' and o.fecha_compromiso is not null
     and (o.fecha_entrega at time zone 'America/Mexico_City')::date <= o.fecha_compromiso) as entregado_a_tiempo,
  (select f.path from public.fotos f where f.orden_id = o.id and f.categoria = 'recepcion' order by f.id limit 1) as foto_portada,
  (select count(*) from public.actividades ac where ac.orden_id = o.id and ac.estado in ('asignada','en_proceso','terminada')) as actividades_pendientes,
  (select string_agg(distinct t.nombre, ', ') from public.actividades ac join public.tecnicos t on t.id = ac.tecnico_id
     where ac.orden_id = o.id and ac.estado in ('asignada','en_proceso','terminada')) as tecnicos_activos
from public.ordenes o
join public.clientes  c on c.id = o.cliente_id
join public.vehiculos v on v.id = o.vehiculo_id
left join public.aseguradoras a on a.id = o.aseguradora_id
left join public.perfiles pa on pa.id = o.asesor_id
left join public.tipos_reparacion tr on tr.id = o.tipo_reparacion_id;

create view public.v_rentabilidad with (security_invoker = true) as
with ing as (
  select p.orden_id,
    sum(pp.cantidad * pp.precio_unit) filter (where p.estado = 'autorizado' and not p.es_ampliacion) as autorizado,
    sum(pp.cantidad * pp.precio_unit) filter (where p.estado = 'autorizado' and p.es_ampliacion)     as adicional
  from public.presupuestos p join public.presupuesto_partidas pp on pp.presupuesto_id = p.id
  group by p.orden_id
), mat as (
  select s.orden_id,
    sum(s.costo_total) filter (where m.tipo = 'pintura')   as pintura,
    sum(s.costo_total) filter (where m.tipo = 'material')  as materiales,
    sum(s.costo_total) filter (where m.tipo = 'refaccion') as refacciones
  from public.solicitudes_material s join public.materiales m on m.id = s.material_id
  where s.estado = 'entregada' and s.orden_id is not null group by s.orden_id
), des as (
  select orden_id, sum(importe) as destajos from public.destajos where estado <> 'cancelado' group by orden_id
), otr as (
  select orden_id,
    sum(monto) filter (where tipo = 'mano_obra_adicional') as mano_obra_adicional,
    sum(monto) filter (where tipo = 'servicio_externo')    as servicios_externos,
    sum(monto) filter (where tipo = 'otro')                as otros
  from public.orden_costos group by orden_id
), fac as (
  select orden_id, sum(monto) as facturado from public.facturas where not cancelada group by orden_id
), cob as (
  select orden_id, sum(monto) as cobrado from public.cobros group by orden_id
), cfg as (
  select coalesce((select valor from public.configuracion where clave = 'indirectos_pct'), 0) as ind_pct
), base as (
  select o.id as orden_id, o.folio, o.tipo, o.etapa, o.fecha_ingreso, o.fecha_entrega,
    coalesce(i.autorizado,0) autorizado, coalesce(i.adicional,0) adicional,
    coalesce(f.facturado,0) facturado, coalesce(cb.cobrado,0) cobrado,
    coalesce(mt.pintura,0) costo_pintura, coalesce(mt.materiales,0) costo_materiales, coalesce(mt.refacciones,0) costo_refacciones,
    coalesce(d.destajos,0) costo_destajos, coalesce(ot.mano_obra_adicional,0) costo_mano_obra_adicional,
    coalesce(ot.servicios_externos,0) costo_servicios_externos, coalesce(ot.otros,0) costo_otros
  from public.ordenes o
  left join ing i on i.orden_id = o.id left join mat mt on mt.orden_id = o.id left join des d on d.orden_id = o.id
  left join otr ot on ot.orden_id = o.id left join fac f on f.orden_id = o.id left join cob cb on cb.orden_id = o.id
)
select b.*,
  b.autorizado + b.adicional as ingreso_reconocido,
  b.costo_pintura + b.costo_materiales + b.costo_refacciones + b.costo_destajos
    + b.costo_mano_obra_adicional + b.costo_servicios_externos + b.costo_otros as costos_directos,
  (b.autorizado + b.adicional) - (b.costo_pintura + b.costo_materiales + b.costo_refacciones + b.costo_destajos
    + b.costo_mano_obra_adicional + b.costo_servicios_externos + b.costo_otros) as utilidad_bruta,
  round((b.autorizado + b.adicional) * cfg.ind_pct / 100, 2) as indirectos_asignados,
  cfg.ind_pct as indirectos_pct,
  (b.autorizado + b.adicional) - (b.costo_pintura + b.costo_materiales + b.costo_refacciones + b.costo_destajos
    + b.costo_mano_obra_adicional + b.costo_servicios_externos + b.costo_otros)
    - round((b.autorizado + b.adicional) * cfg.ind_pct / 100, 2) as utilidad_estimada,
  greatest((b.autorizado + b.adicional) - b.cobrado, 0) as por_cobrar
from base b cross join cfg;

create view public.v_pintura with (security_invoker = true) as
with pres as (
  select p.orden_id, sum(pp.cantidad * pp.costo_unit) costo_presupuestado, sum(pp.cantidad) cantidad_presupuestada
  from public.presupuestos p join public.presupuesto_partidas pp on pp.presupuesto_id = p.id
  where p.estado = 'autorizado' and pp.concepto = 'pintura' group by p.orden_id
), consumo as (
  select s.orden_id, sum(s.costo_total) costo_real, sum(s.cantidad_entregada) cantidad_real,
         string_agg(distinct pf.nombre, ', ') entregado_por
  from public.solicitudes_material s join public.materiales m on m.id = s.material_id
  left join public.perfiles pf on pf.id = s.entregado_por
  where s.estado = 'entregada' and m.tipo = 'pintura' and s.orden_id is not null group by s.orden_id
)
select o.id orden_id, o.folio, o.tipo, o.etapa,
  coalesce(p.cantidad_presupuestada,0) cantidad_presupuestada, coalesce(r.cantidad_real,0) cantidad_real,
  coalesce(p.costo_presupuestado,0) costo_presupuestado, coalesce(r.costo_real,0) costo_real,
  coalesce(r.costo_real,0) - coalesce(p.costo_presupuestado,0) diferencia, r.entregado_por
from public.ordenes o left join pres p on p.orden_id = o.id left join consumo r on r.orden_id = o.id
where p.orden_id is not null or r.orden_id is not null;

create view public.v_alertas_precio with (security_invoker = true) as
select ph.*, m.codigo, m.descripcion, m.unidad, pr.nombre proveedor_nombre,
  round((ph.costo_unit / ph.costo_anterior - 1) * 100, 1) as aumento_pct
from public.precios_historial ph
join public.materiales m on m.id = ph.material_id
left join public.proveedores pr on pr.id = ph.proveedor_id
where ph.costo_anterior > 0
  and ph.costo_unit > ph.costo_anterior * (1 + coalesce((select valor from public.configuracion where clave = 'precio_alerta_pct'),10) / 100);

-- =====================================================================
-- SEGURIDAD: RLS por permisos
-- =====================================================================
create or replace function pg_temp.politicas(t text, lectura text, escritura text[], permitir_borrar boolean)
returns void language plpgsql as $$
declare w text;
begin
  execute format('alter table public.%I enable row level security', t);
  execute format('revoke all on public.%I from anon', t);
  execute format('create policy lectura on public.%I for select to authenticated using (%s)', t,
    case when lectura = 'activo' then '(select public.es_activo())' else format('(select public.puede(%L))', lectura) end);
  if escritura is not null then
    select string_agg(format('(select public.puede(%L))', p), ' or ') into w from unnest(escritura) p;
    execute format('create policy alta on public.%I for insert to authenticated with check (%s)', t, w);
    execute format('create policy cambio on public.%I for update to authenticated using (%s) with check (%s)', t, w, w);
    if permitir_borrar then
      execute format('create policy baja on public.%I for delete to authenticated using (%s)', t, w);
    end if;
  end if;
end $$;

select pg_temp.politicas('permisos',              'activo', array['usuarios.gestionar'], true);
select pg_temp.politicas('rol_permisos',          'activo', array['usuarios.gestionar'], true);
select pg_temp.politicas('aseguradoras',          'activo', array['config.gestionar'], false);
select pg_temp.politicas('tipos_reparacion',      'activo', array['config.gestionar'], false);
select pg_temp.politicas('configuracion',         'activo', array['config.gestionar'], false);
select pg_temp.politicas('clientes',              'activo', array['ordenes.gestionar','asignaciones.gestionar'], false);
select pg_temp.politicas('vehiculos',             'activo', array['ordenes.gestionar','asignaciones.gestionar'], false);
select pg_temp.politicas('asignaciones',          'activo', array['asignaciones.gestionar'], false);
select pg_temp.politicas('contactos',             'activo', array['asignaciones.gestionar'], false);
select pg_temp.politicas('ordenes',               'activo', array['ordenes.gestionar','actividades.asignar'], false);
select pg_temp.politicas('orden_historial',       'activo', null, false);
select pg_temp.politicas('danos',                 'activo', array['presupuestos.gestionar','ordenes.gestionar'], true);
select pg_temp.politicas('presupuestos',          'activo', array['presupuestos.gestionar'], true);
select pg_temp.politicas('presupuesto_partidas',  'activo', array['presupuestos.gestionar'], true);
select pg_temp.politicas('tecnicos',              'activo', array['config.gestionar'], false);
select pg_temp.politicas('tarifas_destajo',       'activo', array['config.gestionar'], false);
select pg_temp.politicas('actividades',           'activo', array['actividades.asignar'], true);
select pg_temp.politicas('destajos',              'destajos.ver', null, false);
select pg_temp.politicas('proveedores',           'activo', array['compras.gestionar'], false);
select pg_temp.politicas('materiales',            'activo', array['almacen.gestionar'], false);
select pg_temp.politicas('movimientos_inventario','activo', null, false);
select pg_temp.politicas('solicitudes_material',  'activo', null, false);
select pg_temp.politicas('compras',               'activo', array['compras.gestionar'], true);
select pg_temp.politicas('compra_partidas',       'activo', array['compras.gestionar'], true);
select pg_temp.politicas('cotizaciones',          'activo', array['compras.gestionar'], true);
select pg_temp.politicas('precios_historial',     'activo', null, false);
select pg_temp.politicas('piezas_retiradas',      'activo', array['ordenes.gestionar','almacen.gestionar','actividades.asignar'], false);
select pg_temp.politicas('orden_costos',          'finanzas.ver', array['finanzas.gestionar'], false);
select pg_temp.politicas('facturas',              'finanzas.ver', array['finanzas.gestionar'], false);
select pg_temp.politicas('cobros',                'finanzas.ver', array['finanzas.gestionar'], false);
select pg_temp.politicas('gastos_fijos',          'finanzas.ver', array['finanzas.gestionar'], true);
select pg_temp.politicas('auditoria',             'auditoria.ver', null, false);

-- Solicitudes: cualquier usuario con permiso las crea; el resto del flujo es por RPC
create policy alta on public.solicitudes_material for insert to authenticated
  with check ((select public.puede('materiales.solicitar')));

-- Fotos: cualquier usuario activo sube evidencia; nadie las modifica; solo Dirección elimina
alter table public.fotos enable row level security;
revoke all on public.fotos from anon;
create policy lectura on public.fotos for select to authenticated using ((select public.es_activo()));
create policy alta on public.fotos for insert to authenticated with check ((select public.es_activo()));
create policy baja on public.fotos for delete to authenticated using ((select public.mi_rol()) = 'direccion');

-- Perfiles: cada quien ve el suyo; los activos ven a todos; Dirección administra
alter table public.perfiles enable row level security;
revoke all on public.perfiles from anon;
create policy lectura on public.perfiles for select to authenticated using (id = auth.uid() or (select public.es_activo()));
create policy cambio on public.perfiles for update to authenticated
  using ((select public.puede('usuarios.gestionar'))) with check ((select public.puede('usuarios.gestionar')));

revoke all on public.v_ordenes, public.v_rentabilidad, public.v_pintura, public.v_alertas_precio from anon;

-- Funciones internas no invocables desde la API
revoke execute on function public.fn_nuevo_usuario(), public.fn_auditar(), public.fn_ordenes_guard(),
  public.fn_orden_desde_asignacion(), public.fn_contacto_estatus(), public.fn_contacto_valida(),
  public.fn_presupuesto_guard(), public.fn_partida_guard(), public.fn_actividad_guard(), public.fn_material_guard(),
  public.fn_solicitud_guard(), public.fn_compra_guard(), public.fn_compra_partida_guard(),
  public.fn_bloquear_cambio_orden(), public.fn_tocar_orden(), public._exigir(text)
  from public, anon, authenticated;
revoke execute on function public.orden_cambiar_etapa(bigint, public.etapa_orden, text), public.orden_entregar(bigint, text, jsonb, text),
  public.presupuesto_enviar(bigint), public.presupuesto_resolver(bigint, boolean, text, text),
  public.actividad_accion(bigint, text, numeric, text), public.destajos_autorizar(bigint[]), public.destajos_pagar(bigint[], text),
  public.solicitud_resolver(bigint, boolean, numeric, text), public.solicitud_entregar(bigint, numeric),
  public.inventario_ajustar(bigint, numeric, text, numeric), public.compra_accion(bigint, text, text),
  public.costo_transferir(text, bigint, bigint, text)
  from public, anon;
grant execute on function public.orden_cambiar_etapa(bigint, public.etapa_orden, text), public.orden_entregar(bigint, text, jsonb, text),
  public.presupuesto_enviar(bigint), public.presupuesto_resolver(bigint, boolean, text, text),
  public.actividad_accion(bigint, text, numeric, text), public.destajos_autorizar(bigint[]), public.destajos_pagar(bigint[], text),
  public.solicitud_resolver(bigint, boolean, numeric, text), public.solicitud_entregar(bigint, numeric),
  public.inventario_ajustar(bigint, numeric, text, numeric), public.compra_accion(bigint, text, text),
  public.costo_transferir(text, bigint, bigint, text)
  to authenticated;

-- =====================================================================
-- STORAGE privado para fotografías y documentos
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidencias', 'evidencias', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do nothing;

create policy "evidencias_lectura" on storage.objects for select to authenticated
  using (bucket_id = 'evidencias' and (select public.es_activo()));
create policy "evidencias_alta" on storage.objects for insert to authenticated
  with check (bucket_id = 'evidencias' and (select public.es_activo()));
create policy "evidencias_baja" on storage.objects for delete to authenticated
  using (bucket_id = 'evidencias' and (select public.mi_rol()) = 'direccion');
