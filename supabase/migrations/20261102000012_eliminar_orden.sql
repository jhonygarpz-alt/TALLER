-- =====================================================================
-- Eliminación controlada de órdenes de trabajo
-- Solo órdenes sin movimientos económicos; con permiso de excepciones,
-- motivo obligatorio y copia completa en auditoría.
-- =====================================================================

-- Los candados permiten el borrado en cascada solo dentro del proceso autorizado
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
    if old.estado <> 'borrador' and not public.en_proceso() then raise exception 'Solo se pueden eliminar presupuestos en borrador'; end if;
    return old;
  end if;
  if not public.en_proceso() and (new.estado is distinct from old.estado or old.estado in ('autorizado','rechazado')
       or new.orden_id is distinct from old.orden_id) then
    raise exception 'El estado del presupuesto solo cambia mediante envío/autorización; uno resuelto no se modifica (cree una ampliación)';
  end if;
  return new;
end $$;

create or replace function public.fn_partida_guard()
returns trigger language plpgsql set search_path = '' as $$
declare st public.estado_presupuesto;
begin
  if public.en_proceso() and tg_op = 'DELETE' then return old; end if;
  select estado into st from public.presupuestos where id = coalesce(new.presupuesto_id, old.presupuesto_id);
  if st <> 'borrador' then
    raise exception 'Solo se modifican partidas de presupuestos en borrador';
  end if;
  return coalesce(new, old);
end $$;

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
    if old.estado <> 'asignada' and not public.en_proceso() then raise exception 'Solo se eliminan actividades sin iniciar; cancélela en su lugar'; end if;
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

-- Qué impide eliminar una orden (lo usa la pantalla para explicarlo antes de intentar)
create or replace function public.orden_bloqueos_eliminar(p_orden bigint)
returns text[] language sql stable security definer set search_path = '' as $$
  select array_remove(array[
    case when exists (select 1 from public.destajos where orden_id = p_orden) then 'destajos generados' end,
    case when exists (select 1 from public.solicitudes_material where orden_id = p_orden and estado = 'entregada') then 'material entregado del almacén' end,
    case when exists (select 1 from public.movimientos_inventario where orden_id = p_orden) then 'movimientos de inventario' end,
    case when exists (select 1 from public.compra_partidas where orden_id = p_orden) then 'compras directas para la orden' end,
    case when exists (select 1 from public.facturas where orden_id = p_orden) then 'facturas' end,
    case when exists (select 1 from public.cobros where orden_id = p_orden) then 'cobros' end,
    case when exists (select 1 from public.orden_costos where orden_id = p_orden) then 'otros costos registrados' end,
    case when exists (select 1 from public.actividades where orden_id = p_orden and estado in ('terminada','validada')) then 'trabajos terminados o validados' end
  ], null)
$$;

create or replace function public.orden_eliminar(p_orden bigint, p_motivo text)
returns text[] language plpgsql security definer set search_path = '' as $$
declare o public.ordenes; bloqueos text[]; fotos text[]; just text := nullif(trim(p_motivo), '');
begin
  perform public._exigir('excepciones.autorizar');
  if just is null then raise exception 'Indica el motivo de la eliminación'; end if;
  select * into o from public.ordenes where id = p_orden for update;
  if not found then raise exception 'Orden no encontrada'; end if;

  bloqueos := public.orden_bloqueos_eliminar(p_orden);
  if cardinality(bloqueos) > 0 then
    raise exception 'La orden % no se puede eliminar porque tiene: %. Cancélala para conservar su historial y costos.', o.folio, array_to_string(bloqueos, ', ');
  end if;

  select coalesce(array_agg(path), '{}') into fotos from public.fotos where orden_id = p_orden;

  -- Copia completa en auditoría antes de borrar
  insert into public.auditoria (usuario_id, tabla, registro_id, accion, antes, despues)
  values (auth.uid(), 'ordenes', p_orden::text, 'eliminacion',
    jsonb_build_object(
      'orden', to_jsonb(o),
      'presupuestos', (select coalesce(jsonb_agg(to_jsonb(p) || jsonb_build_object('partidas',
          (select coalesce(jsonb_agg(to_jsonb(pp)), '[]') from public.presupuesto_partidas pp where pp.presupuesto_id = p.id))), '[]')
        from public.presupuestos p where p.orden_id = p_orden),
      'danos', (select coalesce(jsonb_agg(to_jsonb(d)), '[]') from public.danos d where d.orden_id = p_orden),
      'actividades', (select coalesce(jsonb_agg(to_jsonb(a)), '[]') from public.actividades a where a.orden_id = p_orden),
      'historial', (select coalesce(jsonb_agg(to_jsonb(h)), '[]') from public.orden_historial h where h.orden_id = p_orden),
      'fotos', to_jsonb(fotos)),
    jsonb_build_object('motivo', just));

  perform set_config('tallerpro.rpc', 'on', true);
  delete from public.solicitudes_material where orden_id = p_orden;          -- solo no entregadas (las entregadas bloquean)
  delete from public.actividades where orden_id = p_orden;                   -- solo sin terminar (las terminadas bloquean)
  update public.cliente_seguimientos set orden_id = null where orden_id = p_orden;
  if o.asignacion_id is not null then                                        -- la asignación vuelve a estar disponible
    update public.asignaciones set estatus = case when fecha_cita is not null then 'cita_programada' else 'contactado' end::public.estatus_contacto
    where id = o.asignacion_id;
  end if;
  delete from public.ordenes where id = p_orden;                             -- en cascada: presupuestos, daños, fotos, historial, piezas
  perform set_config('tallerpro.rpc', 'off', true);
  return fotos;                                                              -- rutas de archivos para limpiar el almacenamiento
end $$;

revoke execute on function public.orden_eliminar(bigint, text), public.orden_bloqueos_eliminar(bigint) from public, anon;
grant execute on function public.orden_eliminar(bigint, text), public.orden_bloqueos_eliminar(bigint) to authenticated;
