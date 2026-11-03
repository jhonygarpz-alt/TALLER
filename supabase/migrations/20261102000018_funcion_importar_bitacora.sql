-- Carga de registros de la bitácora mensual (Excel) ya normalizados a JSON.
-- Solo Dirección. Con p_prueba = true valida todo y deshace los cambios (devuelve el resumen en el error).
-- Es idempotente: omite órdenes cuyo número de OS ya existe y asignaciones con el mismo siniestro.

create or replace function public.importar_bitacora(p_registros jsonb, p_prueba boolean default true, p_referencia text default 'Bitácora')
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb; v_asig bigint; v_cli bigint; v_veh bigint; v_ord bigint; v_pres bigint; v_act bigint;
  v_sin text; v_est public.estatus_contacto; v_obs text; v_tipo public.tipo_servicio; v_aseg bigint;
  v_etapa public.etapa_orden; v_av jsonb; v_entregado boolean; v_placas text;
  t_ing timestamptz; t_fin timestamptz; t_ent timestamptz; t_aut timestamptz;
  n_asig int := 0; n_ord int := 0; n_cli int := 0; n_veh int := 0; n_des int := 0; n_cost int := 0; n_omit int := 0;
begin
  if coalesce(public.mi_rol()::text, '') <> 'direccion' then
    raise exception 'Solo Dirección puede importar la bitácora';
  end if;
  perform set_config('tallerpro.rpc', 'on', true);

  for r in select value from jsonb_array_elements(p_registros) order by value->>'fecha_ingreso' nulls last, value->>'fecha_asignacion' loop
    v_obs := nullif(concat_ws(' · ', r->>'observaciones', r->>'comentarios'), '');
    v_placas := nullif(upper(trim(r->>'placas')), 'PERMISO');
    v_asig := null;
    v_aseg := case r->>'compania' when 'MAPFRE' then (select id from public.aseguradoras where upper(nombre) = 'MAPFRE')
                                  when 'TOYOTA' then (select id from public.aseguradoras where upper(nombre) = 'TOYOTA') end;

    -- ---------------- Asignación de aseguradora ----------------
    if v_aseg is not null then
      v_sin := coalesce(r->>'siniestro_mapfre', r->>'siniestro_legaria', 'SIN SINIESTRO ' || coalesce(v_placas, r->>'os', md5(r::text)));
      select id into v_asig from public.asignaciones where aseguradora_id = v_aseg and siniestro = v_sin;
      if v_asig is null then
        v_est := case
          when r->>'status' = 'CANCELADO' or (r->>'status' is null and coalesce(v_obs, '') ~* 'CANCEL|OTRO TALLER|REPARO POR SU CUENTA|PAGO DE DA|INGRESO A OTRO') then 'cancelada'
          when (r->>'orden')::boolean or r->>'fecha_cita' is not null then 'cita_programada'
          when coalesce(v_obs, '') ~* 'NO CONTESTA|NO TIENE WHATS' then 'no_localizado'
          else 'sin_contactar' end;
        insert into public.asignaciones (aseguradora_id, siniestro, asegurado, telefono, marca, modelo, anio, placas, fecha_asignacion,
                                         estatus, fecha_cita, motivo_no_cita, notas)
        values (v_aseg, v_sin, coalesce(r->>'contacto', '(sin nombre en bitácora)'), r->>'telefono', r->>'marca', r->>'modelo',
                (r->>'anio')::int, v_placas, (r->>'fecha_asignacion')::date, v_est,
                case when r->>'fecha_cita' is not null then ((r->>'fecha_cita')::date + time '10:00') at time zone 'America/Mexico_City' end,
                case when v_est = 'cancelada' then v_obs end,
                concat_ws(' · ', p_referencia, 'OS ' || (r->>'os'), v_obs))
        returning id into v_asig;
        n_asig := n_asig + 1;
      end if;
    end if;

    continue when not coalesce((r->>'orden')::boolean, false);
    if r->>'os' is not null and exists (select 1 from public.ordenes where os_bitacora = r->>'os') then
      n_omit := n_omit + 1; continue;
    end if;

    -- ---------------- Cliente y vehículo ----------------
    select id into v_cli from public.clientes
     where upper(trim(nombre)) = upper(trim(r->>'contacto')) and coalesce(telefono, '') = coalesce(r->>'telefono', '') limit 1;
    if v_cli is null then
      insert into public.clientes (nombre, telefono, tipo, notas)
      values (upper(trim(r->>'contacto')), r->>'telefono', 'persona', p_referencia) returning id into v_cli;
      n_cli := n_cli + 1;
    end if;
    v_veh := null;
    if v_placas is not null then select id into v_veh from public.vehiculos where upper(placas) = v_placas limit 1; end if;
    if v_veh is null then
      insert into public.vehiculos (cliente_id, marca, modelo, anio, placas, color, notas)
      values (v_cli, r->>'marca', r->>'modelo', (r->>'anio')::int, v_placas, r->>'color', p_referencia) returning id into v_veh;
      n_veh := n_veh + 1;
    end if;

    -- ---------------- Orden ----------------
    v_tipo := case when v_aseg is null then 'particular' else 'aseguradora' end;
    t_ing := ((r->>'fecha_ingreso')::date + time '09:00') at time zone 'America/Mexico_City';
    t_fin := case when r->>'termino' is not null then ((r->>'termino')::date + time '18:00') at time zone 'America/Mexico_City' end;
    t_ent := case when r->>'fecha_entrega' is not null then ((r->>'fecha_entrega')::date + time '13:00') at time zone 'America/Mexico_City' end;
    t_aut := case when r->>'fecha_autorizacion' is not null then ((r->>'fecha_autorizacion')::date + time '12:00') at time zone 'America/Mexico_City' end;
    v_entregado := r->>'status' = 'CERRADO' and t_ent is not null;

    insert into public.ordenes (tipo, aseguradora_id, asignacion_id, siniestro, cliente_id, vehiculo_id, tipo_reparacion_id, etapa,
                                fecha_ingreso, fecha_compromiso, danos_reportados, os_bitacora, creado_por)
    values (v_tipo, v_aseg, v_asig, coalesce(r->>'siniestro_legaria', r->>'siniestro_mapfre'), v_cli, v_veh,
            (select id from public.tipos_reparacion where activo and
               case when v_aseg is null then aseguradora_id is null and nombre ilike '%particular%' else aseguradora_id = v_aseg and nombre = 'Express' end limit 1),
            'en_reparacion', t_ing, coalesce((r->>'promesa')::date, (r->>'fecha_ingreso')::date + 5),
            coalesce(v_obs, 'Reparación'), r->>'os', null)
    returning id into v_ord;
    n_ord := n_ord + 1;

    -- ---------------- Presupuesto autorizado (valuación) ----------------
    if (v_tipo = 'aseguradora' and (r->>'monto_autorizado')::numeric > 0) or (v_tipo = 'particular' and (r->>'p_pago')::numeric > 0) then
      insert into public.presupuestos (orden_id, numero, es_ampliacion, estado, notas) values (v_ord, 1, false, 'borrador', p_referencia) returning id into v_pres;
      insert into public.presupuesto_partidas (presupuesto_id, area, concepto, descripcion, cantidad, unidad, precio_unit)
      select v_pres, x.area::public.area_trabajo, x.concepto::public.tipo_concepto, x.descr, 1, 'servicio', x.monto
      from (values
        ('hojalateria', 'mano_obra', 'M.O. carrocería', case when v_tipo = 'aseguradora' then (r->>'mo_carroceria')::numeric else (r->>'p_pago')::numeric end),
        ('mecanica', 'mano_obra', 'M.O. mecánica', case when v_tipo = 'aseguradora' then (r->>'mo_mecanica')::numeric end),
        ('pintura', 'pintura', 'M.O. pintura', case when v_tipo = 'aseguradora' then (r->>'mo_pintura')::numeric end),
        ('hojalateria', 'material', 'Materiales', case when v_tipo = 'aseguradora' then (r->>'materiales_aut')::numeric end),
        ('hojalateria', 'refaccion', 'Refacciones', case when v_tipo = 'aseguradora' then (r->>'pago_refacciones')::numeric end)
      ) x(area, concepto, descr, monto) where coalesce(x.monto, 0) > 0;
      update public.presupuestos set estado = case when t_aut is not null or v_entregado then 'autorizado' else 'enviado' end::public.estado_presupuesto,
             autorizado_por = case when t_aut is not null or v_entregado then coalesce(r->>'compania', 'Cliente') end,
             fecha_autorizacion = coalesce(t_aut, case when v_entregado then t_ing end)
       where id = v_pres;
    end if;
    -- Adicional pagado por el cliente en orden de aseguradora
    if v_tipo = 'aseguradora' and greatest((r->>'p_pago')::numeric, (r->>'particular_adicional')::numeric) > 0 then
      insert into public.presupuestos (orden_id, numero, es_ampliacion, estado, notas) values (v_ord, 2, true, 'borrador', p_referencia || ' · adicional particular') returning id into v_pres;
      insert into public.presupuesto_partidas (presupuesto_id, area, concepto, descripcion, cantidad, unidad, precio_unit)
      values (v_pres, 'otros', 'mano_obra', 'Adicional particular', 1, 'servicio', greatest((r->>'p_pago')::numeric, (r->>'particular_adicional')::numeric));
      update public.presupuestos set estado = 'autorizado', autorizado_por = 'Cliente', fecha_autorizacion = coalesce(t_aut, t_ing) where id = v_pres;
    end if;

    -- ---------------- Pagos a técnicos y costos ----------------
    -- x: (area, tecnico, importe, es parte particular, descripción)
    declare x record;
    begin
      for x in select * from (values
          ('hojalateria', (r->>'hojalatero')::bigint, (r->>'pago_hojalatero')::numeric, v_tipo = 'particular', 'Hojalatería'),
          ('pintura', (r->>'pintor')::bigint, (r->>'pago_pintor')::numeric, v_tipo = 'particular', 'Pintura'),
          ('hojalateria', (r->>'hojalatero')::bigint, (r->>'p_hojalatero')::numeric, true, 'Hojalatería (particular)'),
          ('pintura', (r->>'pintor')::bigint, (r->>'p_pintor')::numeric, true, 'Pintura (particular)')
        ) t(area, tecnico, importe, part, descr) where coalesce(importe, 0) > 0 loop
        if x.tecnico is null then
          insert into public.orden_costos (orden_id, tipo, concepto, monto, fecha, usuario_id, particular)
          values (v_ord, 'mano_obra_adicional', 'Pago ' || lower(x.descr) || ' (técnico no indicado en bitácora)', x.importe,
                  coalesce(t_fin, t_ing)::date, null, x.part and v_tipo = 'aseguradora');
          n_cost := n_cost + 1;
        else
          insert into public.actividades (orden_id, area, actividad, tecnico_id, importe_destajo, fecha_asignacion)
          values (v_ord, x.area::public.area_trabajo, x.descr || ' · ' || p_referencia, x.tecnico, x.importe, t_ing) returning id into v_act;
          if v_entregado then
            update public.actividades set estado = 'validada', fecha_inicio = t_ing, fecha_fin = coalesce(t_fin, t_ent), validado_at = coalesce(t_fin, t_ent)
             where id = v_act;
            insert into public.destajos (actividad_id, orden_id, tecnico_id, tipo, importe, estado, generado_at, autorizado_at, pagado_at, referencia_pago)
            values (v_act, v_ord, x.tecnico, (case when x.part then 'particular' else v_tipo::text end)::public.tipo_servicio, x.importe, 'pagado',
                    coalesce(t_fin, t_ent), coalesce(t_fin, t_ent), t_ent, p_referencia);
            n_des := n_des + 1;
          end if;
        end if;
      end loop;

      for x in select * from (values
          ('pulido', (r->>'pulido')::numeric, false, 'Pulido'),
          ('material', (r->>'materiales')::numeric, false, 'Materiales'),
          ('refaccion', (r->>'refacciones')::numeric, false, 'Refacciones'),
          ('pulido', (r->>'p_pulido')::numeric, true, 'Pulido (particular)'),
          ('material', (r->>'p_materiales')::numeric, true, 'Materiales (particular)'),
          ('refaccion', (r->>'p_refacciones')::numeric, true, 'Refacciones (particular)')
        ) t(tipo, monto, part, descr) where coalesce(monto, 0) > 0 loop
        insert into public.orden_costos (orden_id, tipo, concepto, monto, fecha, usuario_id, particular)
        values (v_ord, x.tipo, x.descr || ' · ' || p_referencia, x.monto, coalesce(t_fin, t_ent, t_ing)::date, null, x.part and v_tipo = 'aseguradora');
        n_cost := n_cost + 1;
      end loop;
    end;

    -- ---------------- Etapa final e historial ----------------
    v_av := r->'avance';  -- [refacciones, hojalateria, mecanica, pintura, armado, terminado, entregado]
    v_etapa := case
      when v_entregado then 'entregado'
      when (v_av->>5)::boolean then 'listo_entrega'
      when (v_av->>4)::boolean then 'control_calidad'
      when (v_av->>3)::boolean then 'detallado'
      when (v_av->>1)::boolean then 'pintura'
      when t_aut is not null then 'hojalateria'
      when (r->>'monto_autorizado')::numeric > 0 then 'esperando_autorizacion'
      else 'diagnostico' end;
    update public.ordenes set etapa = v_etapa,
           fecha_terminacion = case when v_etapa in ('entregado', 'listo_entrega') then coalesce(t_fin, t_ent) end,
           fecha_entrega = case when v_entregado then t_ent end,
           recibio_nombre = case when v_entregado then upper(trim(r->>'contacto')) end
     where id = v_ord;
    update public.orden_historial set etapa_nueva = 'recepcion', fecha = t_ing, justificacion = 'Recepción del vehículo · ' || p_referencia
     where orden_id = v_ord;
    insert into public.orden_historial (orden_id, fecha, etapa_anterior, etapa_nueva, justificacion)
    values (v_ord, coalesce(case when v_entregado then t_ent end, t_aut, t_ing), 'recepcion', v_etapa, 'Avance registrado en ' || p_referencia);
  end loop;

  if p_prueba then
    raise exception 'PRUEBA_OK %', jsonb_build_object('asignaciones', n_asig, 'ordenes', n_ord, 'clientes', n_cli, 'vehiculos', n_veh,
      'destajos_pagados', n_des, 'costos', n_cost, 'omitidas', n_omit);
  end if;
  return jsonb_build_object('asignaciones', n_asig, 'ordenes', n_ord, 'clientes', n_cli, 'vehiculos', n_veh,
    'destajos_pagados', n_des, 'costos', n_cost, 'omitidas', n_omit);
end $$;

revoke execute on function public.importar_bitacora(jsonb, boolean, text) from public, anon;
grant execute on function public.importar_bitacora(jsonb, boolean, text) to authenticated;
