-- Toda orden de aseguradora va ligada a una asignación de la aseguradora.

-- 1) Las órdenes nuevas de aseguradora exigen asignación (las existentes se vinculan con la función de abajo)
create or replace function public.fn_orden_requiere_asignacion() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.tipo = 'aseguradora' and new.asignacion_id is null and not public.en_proceso() then
    raise exception 'Las órdenes de aseguradora deben ir ligadas a una asignación. Elige la asignación (o regístrala) en el paso Origen.';
  end if;
  if new.asignacion_id is not null and exists (select 1 from public.asignaciones s where s.id = new.asignacion_id and s.aseguradora_id is distinct from new.aseguradora_id) then
    raise exception 'La asignación pertenece a otra aseguradora';
  end if;
  return new;
end $$;
revoke execute on function public.fn_orden_requiere_asignacion() from public, anon, authenticated;
create trigger trg_orden_requiere_asignacion before insert on public.ordenes
  for each row execute function public.fn_orden_requiere_asignacion();

-- 2) Vincular una orden existente a una asignación (o crearla con los datos de la orden)
create or replace function public.orden_vincular_asignacion(p_orden bigint, p_asignacion bigint default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare o public.ordenes; v_asig bigint; v_sin text;
begin
  perform public._exigir('ordenes.gestionar');
  select * into o from public.ordenes where id = p_orden for update;
  if not found then raise exception 'Orden no encontrada'; end if;
  if o.tipo <> 'aseguradora' then raise exception 'Solo las órdenes de aseguradora llevan asignación'; end if;
  if o.asignacion_id is not null then raise exception 'La orden ya tiene asignación'; end if;
  if p_asignacion is not null then
    if not exists (select 1 from public.asignaciones where id = p_asignacion and aseguradora_id = o.aseguradora_id) then raise exception 'Asignación no encontrada para esta aseguradora'; end if;
    if exists (select 1 from public.ordenes where asignacion_id = p_asignacion) then raise exception 'Esa asignación ya está ligada a otra orden'; end if;
    v_asig := p_asignacion;
  else
    v_sin := nullif(trim(o.siniestro), '');
    if v_sin is null then raise exception 'La orden no tiene número de siniestro; captúralo en Editar orden o elige una asignación existente'; end if;
    select id into v_asig from public.asignaciones where aseguradora_id = o.aseguradora_id and siniestro = v_sin;
    if v_asig is not null and exists (select 1 from public.ordenes where asignacion_id = v_asig) then raise exception 'Ya existe una asignación con ese siniestro ligada a otra orden'; end if;
    if v_asig is null then
      insert into public.asignaciones (aseguradora_id, siniestro, asegurado, telefono, marca, modelo, anio, placas, fecha_asignacion, asesor_id, estatus, notas)
      select o.aseguradora_id, v_sin, c.nombre, c.telefono, v.marca, v.modelo, v.anio, v.placas,
             (o.fecha_ingreso at time zone 'America/Mexico_City')::date, o.asesor_id, 'ingresado', 'Creada al vincular la orden ' || o.folio
      from public.clientes c, public.vehiculos v where c.id = o.cliente_id and v.id = o.vehiculo_id
      returning id into v_asig;
    end if;
  end if;
  perform set_config('tallerpro.rpc', 'on', true);
  update public.ordenes set asignacion_id = v_asig where id = p_orden;
  update public.asignaciones set estatus = 'ingresado' where id = v_asig;
  perform set_config('tallerpro.rpc', 'off', true);
  return v_asig;
end $$;
revoke execute on function public.orden_vincular_asignacion(bigint, bigint) from public, anon;
grant execute on function public.orden_vincular_asignacion(bigint, bigint) to authenticated;
