-- =====================================================================
-- Reversión controlada de subprocesos para poder corregir o eliminar órdenes
-- Todas exigen motivo y quedan en auditoría.
-- =====================================================================

-- Motivo registrado en la auditoría de cada reversión
create or replace function public._auditar_motivo(p_tabla text, p_id bigint, p_accion text, p_motivo text, p_antes jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.auditoria (usuario_id, tabla, registro_id, accion, antes, despues)
  values (auth.uid(), p_tabla, p_id::text, p_accion, p_antes, jsonb_build_object('motivo', p_motivo))
$$;

-- Anular un trabajo (incluso terminado o validado); cancela su destajo
create or replace function public.actividad_anular(p_id bigint, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.actividades; m text := nullif(trim(p_motivo), '');
begin
  perform public._exigir('excepciones.autorizar');
  if m is null then raise exception 'Indica el motivo de la anulación'; end if;
  select * into a from public.actividades where id = p_id for update;
  if not found then raise exception 'Trabajo no encontrado'; end if;
  if a.estado = 'cancelada' then raise exception 'El trabajo ya está cancelado'; end if;
  perform set_config('tallerpro.rpc', 'on', true);
  update public.actividades set estado = 'cancelada', motivo_rechazo = 'Anulado: ' || m where id = p_id;
  update public.destajos set estado = 'cancelado' where actividad_id = p_id and estado <> 'cancelado';
  perform public._auditar_motivo('actividades', p_id, 'anulacion', m, to_jsonb(a));
  perform set_config('tallerpro.rpc', 'off', true);
end $$;

-- Cancelar un destajo (pendiente, autorizado o pagado)
create or replace function public.destajo_cancelar(p_id bigint, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare d public.destajos; m text := nullif(trim(p_motivo), '');
begin
  perform public._exigir('excepciones.autorizar');
  if m is null then raise exception 'Indica el motivo de la cancelación'; end if;
  select * into d from public.destajos where id = p_id for update;
  if not found then raise exception 'Destajo no encontrado'; end if;
  if d.estado = 'cancelado' then raise exception 'El destajo ya está cancelado'; end if;
  update public.destajos set estado = 'cancelado' where id = p_id;
  perform public._auditar_motivo('destajos', p_id, 'cancelacion', m, to_jsonb(d));
end $$;

-- Devolver al almacén material entregado a una orden: regresa existencia y retira el costo de la orden
create or replace function public.solicitud_devolver(p_id bigint, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.solicitudes_material; mt public.materiales; m text := nullif(trim(p_motivo), ''); nueva numeric;
begin
  if not (public.puede('almacen.gestionar') or public.puede('excepciones.autorizar')) then
    raise exception 'No tienes permiso para esta operación' using errcode = '42501';
  end if;
  if m is null then raise exception 'Indica el motivo de la devolución'; end if;
  select * into s from public.solicitudes_material where id = p_id for update;
  if not found or s.estado <> 'entregada' then raise exception 'Solo se devuelve material entregado'; end if;
  select * into mt from public.materiales where id = s.material_id for update;
  nueva := mt.existencia + s.cantidad_entregada;
  perform set_config('tallerpro.rpc', 'on', true);
  update public.materiales set existencia = nueva,
    costo_promedio = case when nueva > 0 then round((mt.existencia * mt.costo_promedio + s.cantidad_entregada * coalesce(s.costo_unit, mt.costo_promedio)) / nueva, 4) else mt.costo_promedio end
  where id = mt.id;
  insert into public.movimientos_inventario (material_id, tipo, cantidad, costo_unit, existencia_resultante, orden_id, solicitud_id, motivo)
  values (mt.id, 'entrada', s.cantidad_entregada, coalesce(s.costo_unit, mt.costo_promedio), nueva, s.orden_id, s.id, 'Devolución al almacén: ' || m);
  update public.solicitudes_material set estado = 'rechazada', motivo_rechazo = 'Devuelto al almacén: ' || m where id = p_id;
  perform public._auditar_motivo('solicitudes_material', p_id, 'devolucion', m, to_jsonb(s));
  perform set_config('tallerpro.rpc', 'off', true);
end $$;

-- Eliminar otros costos y pagos registrados por error (finanzas; queda en auditoría por trigger)
create policy baja on public.orden_costos for delete to authenticated using ((select public.puede('finanzas.gestionar')));
create policy baja on public.cobros for delete to authenticated using ((select public.puede('finanzas.gestionar')));

-- Bloqueos: solo movimientos vigentes (lo cancelado, devuelto o anulado ya no bloquea)
create or replace function public.orden_bloqueos_eliminar(p_orden bigint)
returns text[] language sql stable security definer set search_path = '' as $$
  select array_remove(array[
    case when exists (select 1 from public.destajos where orden_id = p_orden and estado <> 'cancelado') then 'destajos generados' end,
    case when exists (select 1 from public.actividades where orden_id = p_orden and estado in ('terminada','validada')) then 'trabajos terminados o validados' end,
    case when exists (select 1 from public.solicitudes_material where orden_id = p_orden and estado = 'entregada') then 'material entregado del almacén' end,
    case when exists (select 1 from public.facturas where orden_id = p_orden and not cancelada) then 'facturas vigentes' end,
    case when exists (select 1 from public.cobros where orden_id = p_orden) then 'cobros' end,
    case when exists (select 1 from public.orden_costos where orden_id = p_orden) then 'otros costos registrados' end
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
    raise exception 'La orden % no se puede eliminar porque tiene: %. Revierte esos movimientos o cancela la orden.', o.folio, array_to_string(bloqueos, ', ');
  end if;

  select coalesce(array_agg(path), '{}') into fotos from public.fotos where orden_id = p_orden;

  insert into public.auditoria (usuario_id, tabla, registro_id, accion, antes, despues)
  values (auth.uid(), 'ordenes', p_orden::text, 'eliminacion',
    jsonb_build_object(
      'orden', to_jsonb(o),
      'presupuestos', (select coalesce(jsonb_agg(to_jsonb(p) || jsonb_build_object('partidas',
          (select coalesce(jsonb_agg(to_jsonb(pp)), '[]') from public.presupuesto_partidas pp where pp.presupuesto_id = p.id))), '[]')
        from public.presupuestos p where p.orden_id = p_orden),
      'danos', (select coalesce(jsonb_agg(to_jsonb(d)), '[]') from public.danos d where d.orden_id = p_orden),
      'actividades', (select coalesce(jsonb_agg(to_jsonb(a)), '[]') from public.actividades a where a.orden_id = p_orden),
      'destajos', (select coalesce(jsonb_agg(to_jsonb(d)), '[]') from public.destajos d where d.orden_id = p_orden),
      'solicitudes', (select coalesce(jsonb_agg(to_jsonb(s)), '[]') from public.solicitudes_material s where s.orden_id = p_orden),
      'facturas', (select coalesce(jsonb_agg(to_jsonb(f)), '[]') from public.facturas f where f.orden_id = p_orden),
      'historial', (select coalesce(jsonb_agg(to_jsonb(h)), '[]') from public.orden_historial h where h.orden_id = p_orden),
      'fotos', to_jsonb(fotos)),
    jsonb_build_object('motivo', just));

  perform set_config('tallerpro.rpc', 'on', true);
  delete from public.destajos where orden_id = p_orden;                      -- solo cancelados (los vigentes bloquean)
  delete from public.facturas where orden_id = p_orden;                      -- solo canceladas (las vigentes bloquean)
  delete from public.solicitudes_material where orden_id = p_orden;          -- solo no entregadas o devueltas
  delete from public.actividades where orden_id = p_orden;                   -- solo sin terminar o anuladas
  update public.movimientos_inventario set orden_id = null where orden_id = p_orden;   -- el kárdex se conserva
  update public.compra_partidas set orden_id = null where orden_id = p_orden;          -- la compra se conserva
  update public.cliente_seguimientos set orden_id = null where orden_id = p_orden;
  if o.asignacion_id is not null then
    update public.asignaciones set estatus = case when fecha_cita is not null then 'cita_programada' else 'contactado' end::public.estatus_contacto
    where id = o.asignacion_id;
  end if;
  delete from public.ordenes where id = p_orden;
  perform set_config('tallerpro.rpc', 'off', true);
  return fotos;
end $$;

revoke execute on function public._auditar_motivo(text, bigint, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.actividad_anular(bigint, text), public.destajo_cancelar(bigint, text), public.solicitud_devolver(bigint, text) from public, anon;
grant execute on function public.actividad_anular(bigint, text), public.destajo_cancelar(bigint, text), public.solicitud_devolver(bigint, text) to authenticated;
