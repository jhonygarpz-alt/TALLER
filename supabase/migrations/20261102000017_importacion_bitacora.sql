-- Soporte para cargar la bitácora mensual (registros de órdenes llevados en Excel).
-- Solo agrega columnas/valores; no elimina datos.

-- 1) Número de Orden de Servicio de la bitácora (para buscar la orden con el número que usa el taller)
alter table public.ordenes add column if not exists os_bitacora text;
create index if not exists ordenes_os_bitacora_idx on public.ordenes (os_bitacora);

create or replace view public.v_ordenes with (security_invoker = true) as
 SELECT o.id, o.folio, o.tipo, o.aseguradora_id, o.asignacion_id, o.siniestro, o.cliente_id, o.vehiculo_id,
    o.tipo_reparacion_id, o.etapa, o.asesor_id, o.kilometraje, o.fecha_ingreso, o.fecha_compromiso, o.danos_reportados,
    o.checklist_recepcion, o.objetos, o.detenido_material, o.motivo_retraso, o.fecha_terminacion, o.fecha_entrega,
    o.recibio_nombre, o.checklist_calidad, o.satisfaccion, o.encuesta_comentario, o.encuesta_fecha, o.ultima_actualizacion,
    o.creado_por, o.created_at, o.sucursal_id, o.prioridad,
    c.nombre AS cliente_nombre, c.telefono AS cliente_telefono, v.marca, v.modelo, v.anio, v.placas, v.color,
    a.nombre AS aseguradora_nombre, pa.nombre AS asesor_nombre, tr.nombre AS tipo_reparacion_nombre, su.nombre AS sucursal_nombre,
    (((COALESCE(o.fecha_entrega, now()) AT TIME ZONE 'America/Mexico_City'))::date - ((o.fecha_ingreso AT TIME ZONE 'America/Mexico_City'))::date) AS dias_en_taller,
    (((now() AT TIME ZONE 'America/Mexico_City'))::date - ((COALESCE((SELECT max(h.fecha) FROM orden_historial h WHERE h.orden_id = o.id AND h.etapa_nueva = o.etapa), o.fecha_ingreso) AT TIME ZONE 'America/Mexico_City'))::date) AS dias_en_etapa,
    ((o.etapa <> ALL (ARRAY['entregado'::etapa_orden, 'cancelado'::etapa_orden])) AND (o.fecha_compromiso < CURRENT_DATE)) AS retrasado,
    ((o.etapa = 'entregado'::etapa_orden) AND (o.fecha_compromiso IS NOT NULL) AND (((o.fecha_entrega AT TIME ZONE 'America/Mexico_City'))::date <= o.fecha_compromiso)) AS entregado_a_tiempo,
    (SELECT f.path FROM fotos f WHERE f.orden_id = o.id AND f.categoria = 'recepcion' ORDER BY f.id LIMIT 1) AS foto_portada,
    (SELECT count(*) FROM actividades ac WHERE ac.orden_id = o.id AND ac.estado = ANY (ARRAY['asignada'::estado_actividad, 'en_proceso'::estado_actividad, 'terminada'::estado_actividad])) AS actividades_pendientes,
    (SELECT string_agg(DISTINCT t.nombre, ', ') FROM actividades ac JOIN tecnicos t ON t.id = ac.tecnico_id
      WHERE ac.orden_id = o.id AND ac.estado = ANY (ARRAY['asignada'::estado_actividad, 'en_proceso'::estado_actividad, 'terminada'::estado_actividad])) AS tecnicos_activos,
    o.os_bitacora
   FROM ordenes o
     JOIN clientes c ON c.id = o.cliente_id
     JOIN vehiculos v ON v.id = o.vehiculo_id
     LEFT JOIN aseguradoras a ON a.id = o.aseguradora_id
     LEFT JOIN perfiles pa ON pa.id = o.asesor_id
     LEFT JOIN tipos_reparacion tr ON tr.id = o.tipo_reparacion_id
     LEFT JOIN sucursales su ON su.id = o.sucursal_id;

-- 2) Otros costos: tipos material / refacción / pulido (costos registrados como importe, sin pasar por almacén)
--    y marca "particular" para la parte que paga el cliente en una orden de aseguradora (adicionales).
alter table public.orden_costos drop constraint if exists orden_costos_tipo_check;
alter table public.orden_costos add constraint orden_costos_tipo_check
  check (tipo in ('mano_obra_adicional', 'servicio_externo', 'otro', 'material', 'refaccion', 'pulido'));
alter table public.orden_costos add column if not exists particular boolean not null default false;

-- 3) Rentabilidad: suma los nuevos tipos en sus rubros (mismas columnas)
create or replace view public.v_rentabilidad with (security_invoker = true) as
WITH ing AS (
  SELECT p.orden_id,
    sum(pp.cantidad * pp.precio_unit) FILTER (WHERE p.estado = 'autorizado' AND NOT p.es_ampliacion) AS autorizado,
    sum(pp.cantidad * pp.precio_unit) FILTER (WHERE p.estado = 'autorizado' AND p.es_ampliacion) AS adicional
  FROM presupuestos p JOIN presupuesto_partidas pp ON pp.presupuesto_id = p.id GROUP BY p.orden_id
), mat AS (
  SELECT s.orden_id,
    sum(s.costo_total) FILTER (WHERE m.tipo = 'pintura') AS pintura,
    sum(s.costo_total) FILTER (WHERE m.tipo = 'material') AS materiales,
    sum(s.costo_total) FILTER (WHERE m.tipo = 'refaccion') AS refacciones
  FROM solicitudes_material s JOIN materiales m ON m.id = s.material_id
  WHERE s.estado = 'entregada' AND s.orden_id IS NOT NULL GROUP BY s.orden_id
), des AS (
  SELECT orden_id, sum(importe) AS destajos FROM destajos WHERE estado <> 'cancelado' GROUP BY orden_id
), otr AS (
  SELECT orden_id,
    sum(monto) FILTER (WHERE tipo IN ('mano_obra_adicional', 'pulido')) AS mano_obra_adicional,
    sum(monto) FILTER (WHERE tipo = 'servicio_externo') AS servicios_externos,
    sum(monto) FILTER (WHERE tipo = 'otro') AS otros,
    sum(monto) FILTER (WHERE tipo = 'material') AS materiales,
    sum(monto) FILTER (WHERE tipo = 'refaccion') AS refacciones
  FROM orden_costos GROUP BY orden_id
), fac AS (
  SELECT orden_id, sum(monto) AS facturado FROM facturas WHERE NOT cancelada GROUP BY orden_id
), cob AS (
  SELECT orden_id, sum(monto) AS cobrado FROM cobros GROUP BY orden_id
), cfg AS (
  SELECT COALESCE((SELECT valor FROM configuracion WHERE clave = 'indirectos_pct'), 0::numeric) AS ind_pct
), base AS (
  SELECT o.id AS orden_id, o.folio, o.tipo, o.etapa, o.fecha_ingreso, o.fecha_entrega,
    COALESCE(i.autorizado, 0) AS autorizado, COALESCE(i.adicional, 0) AS adicional,
    COALESCE(f.facturado, 0) AS facturado, COALESCE(cb.cobrado, 0) AS cobrado,
    COALESCE(mt.pintura, 0) AS costo_pintura,
    COALESCE(mt.materiales, 0) + COALESCE(ot.materiales, 0) AS costo_materiales,
    COALESCE(mt.refacciones, 0) + COALESCE(ot.refacciones, 0) AS costo_refacciones,
    COALESCE(d.destajos, 0) AS costo_destajos,
    COALESCE(ot.mano_obra_adicional, 0) AS costo_mano_obra_adicional,
    COALESCE(ot.servicios_externos, 0) AS costo_servicios_externos,
    COALESCE(ot.otros, 0) AS costo_otros
  FROM ordenes o
    LEFT JOIN ing i ON i.orden_id = o.id LEFT JOIN mat mt ON mt.orden_id = o.id LEFT JOIN des d ON d.orden_id = o.id
    LEFT JOIN otr ot ON ot.orden_id = o.id LEFT JOIN fac f ON f.orden_id = o.id LEFT JOIN cob cb ON cb.orden_id = o.id
)
SELECT b.orden_id, b.folio, b.tipo, b.etapa, b.fecha_ingreso, b.fecha_entrega, b.autorizado, b.adicional, b.facturado, b.cobrado,
  b.costo_pintura, b.costo_materiales, b.costo_refacciones, b.costo_destajos, b.costo_mano_obra_adicional, b.costo_servicios_externos, b.costo_otros,
  b.autorizado + b.adicional AS ingreso_reconocido,
  b.costo_pintura + b.costo_materiales + b.costo_refacciones + b.costo_destajos + b.costo_mano_obra_adicional + b.costo_servicios_externos + b.costo_otros AS costos_directos,
  (b.autorizado + b.adicional) - (b.costo_pintura + b.costo_materiales + b.costo_refacciones + b.costo_destajos + b.costo_mano_obra_adicional + b.costo_servicios_externos + b.costo_otros) AS utilidad_bruta,
  round((b.autorizado + b.adicional) * cfg.ind_pct / 100, 2) AS indirectos_asignados,
  cfg.ind_pct AS indirectos_pct,
  (b.autorizado + b.adicional) - (b.costo_pintura + b.costo_materiales + b.costo_refacciones + b.costo_destajos + b.costo_mano_obra_adicional + b.costo_servicios_externos + b.costo_otros)
    - round((b.autorizado + b.adicional) * cfg.ind_pct / 100, 2) AS utilidad_estimada,
  GREATEST((b.autorizado + b.adicional) - b.cobrado, 0) AS por_cobrar
FROM base b CROSS JOIN cfg;

-- 4) Reporte mensual: separa la parte "particular / adicional" de las órdenes de aseguradora
--    (ampliaciones de presupuesto, destajos tipo particular y costos marcados como particular),
--    igual que la bitácora ("PARTICULARES Y ADICIONALES").
create or replace function public.reporte_mensual(p_anio int, p_mes int)
returns jsonb
language sql stable security invoker set search_path = public as $$
with lim as (
  select make_date(p_anio, p_mes, 1) as ini_d,
         (make_date(p_anio, p_mes, 1) + interval '1 month')::date as fin_d,
         make_timestamptz(p_anio, p_mes, 1, 0, 0, 0, 'America/Mexico_City') as ini,
         make_timestamptz(p_anio, p_mes, 1, 0, 0, 0, 'America/Mexico_City') + interval '1 month' as fin
), grupos as (
  select o.id, o.etapa, o.fecha_ingreso, o.fecha_terminacion, o.fecha_entrega, o.asignacion_id,
         case when o.tipo = 'particular' then 'particular'
              when a.nombre ilike '%mapfre%' then 'mapfre'
              when a.nombre ilike '%toyota%' then 'toyota'
              else 'otra' end as grupo
  from public.ordenes o left join public.aseguradoras a on a.id = o.aseguradora_id
), ent as (
  select g.* from grupos g, lim
  where g.etapa = 'entregado' and g.fecha_entrega >= lim.ini and g.fecha_entrega < lim.fin
), ing as (
  select p.orden_id,
    sum(pp.cantidad * pp.precio_unit) filter (where not p.es_ampliacion and pp.concepto = 'refaccion') as refacciones,
    sum(pp.cantidad * pp.precio_unit) filter (where not p.es_ampliacion and pp.concepto = 'mano_obra' and pp.area = 'mecanica') as mo_mecanica,
    sum(pp.cantidad * pp.precio_unit) filter (where not p.es_ampliacion and (pp.concepto = 'pintura' or (pp.concepto = 'mano_obra' and pp.area = 'pintura'))) as mo_pintura,
    sum(pp.cantidad * pp.precio_unit) filter (where not p.es_ampliacion and pp.concepto = 'mano_obra' and pp.area not in ('mecanica', 'pintura')) as mo_carroceria,
    sum(pp.cantidad * pp.precio_unit) filter (where not p.es_ampliacion and pp.concepto in ('material', 'externo')) as materiales,
    sum(pp.cantidad * pp.precio_unit) filter (where not p.es_ampliacion) as base,
    sum(pp.cantidad * pp.precio_unit) filter (where p.es_ampliacion) as ampliacion
  from public.presupuestos p join public.presupuesto_partidas pp on pp.presupuesto_id = p.id
  where p.estado = 'autorizado' and p.orden_id in (select id from ent)
  group by p.orden_id
), des as (
  select d.orden_id, (d.tipo = 'particular') as part,
    sum(d.importe) filter (where coalesce(ac.area::text, 'hojalateria') in ('hojalateria', 'mecanica', 'otros')) as hojalatero,
    sum(d.importe) filter (where ac.area = 'pintura') as pintor,
    sum(d.importe) filter (where ac.area = 'detallado') as pulido
  from public.destajos d left join public.actividades ac on ac.id = d.actividad_id
  where d.estado <> 'cancelado' and d.orden_id in (select id from ent)
  group by d.orden_id, (d.tipo = 'particular')
), oc as (
  select orden_id, particular as part,
    sum(monto) filter (where tipo = 'material') as material,
    sum(monto) filter (where tipo = 'refaccion') as refaccion,
    sum(monto) filter (where tipo = 'pulido') as pulido,
    sum(monto) filter (where tipo in ('mano_obra_adicional', 'servicio_externo', 'otro')) as adicionales
  from public.orden_costos where orden_id in (select id from ent)
  group by orden_id, particular
), alm as (
  select s.orden_id,
    sum(s.costo_total) filter (where m.tipo in ('material', 'pintura')) as materiales,
    sum(s.costo_total) filter (where m.tipo = 'refaccion') as refacciones
  from public.solicitudes_material s join public.materiales m on m.id = s.material_id
  where s.estado = 'entregada' and s.orden_id in (select id from ent)
  group by s.orden_id
), partes as (
  -- parte principal (o la orden completa si es particular)
  select e.id, e.grupo as rgrupo,
    coalesce(i.base, 0) + case when e.grupo = 'particular' then coalesce(i.ampliacion, 0) else 0 end as ingreso,
    coalesce(i.refacciones, 0) as pago_ref, coalesce(i.mo_carroceria, 0) as mo_carroceria, coalesce(i.mo_mecanica, 0) as mo_mecanica,
    coalesce(i.mo_pintura, 0) as mo_pintura, coalesce(i.materiales, 0) as mat_aut,
    (select coalesce(sum(hojalatero), 0) from des where des.orden_id = e.id and (e.grupo = 'particular' or not des.part)) as hojalatero,
    (select coalesce(sum(pintor), 0) from des where des.orden_id = e.id and (e.grupo = 'particular' or not des.part)) as pintor,
    (select coalesce(sum(pulido), 0) from des where des.orden_id = e.id and (e.grupo = 'particular' or not des.part))
      + (select coalesce(sum(pulido), 0) from oc where oc.orden_id = e.id and (e.grupo = 'particular' or not oc.part)) as pulido,
    coalesce(al.materiales, 0) + (select coalesce(sum(material), 0) from oc where oc.orden_id = e.id and (e.grupo = 'particular' or not oc.part)) as materiales,
    coalesce(al.refacciones, 0) + (select coalesce(sum(refaccion), 0) from oc where oc.orden_id = e.id and (e.grupo = 'particular' or not oc.part)) as refacciones,
    (select coalesce(sum(adicionales), 0) from oc where oc.orden_id = e.id and (e.grupo = 'particular' or not oc.part)) as adicionales
  from ent e left join ing i on i.orden_id = e.id left join alm al on al.orden_id = e.id
  union all
  -- parte particular/adicional de órdenes de aseguradora
  select e.id, 'particular',
    coalesce(i.ampliacion, 0), 0, 0, 0, 0, 0,
    (select coalesce(sum(hojalatero), 0) from des where des.orden_id = e.id and des.part),
    (select coalesce(sum(pintor), 0) from des where des.orden_id = e.id and des.part),
    (select coalesce(sum(pulido), 0) from des where des.orden_id = e.id and des.part)
      + (select coalesce(sum(pulido), 0) from oc where oc.orden_id = e.id and oc.part),
    (select coalesce(sum(material), 0) from oc where oc.orden_id = e.id and oc.part),
    (select coalesce(sum(refaccion), 0) from oc where oc.orden_id = e.id and oc.part),
    (select coalesce(sum(adicionales), 0) from oc where oc.orden_id = e.id and oc.part)
  from ent e left join ing i on i.orden_id = e.id
  where e.grupo <> 'particular'
    and (coalesce(i.ampliacion, 0) > 0 or exists (select 1 from des where des.orden_id = e.id and des.part)
         or exists (select 1 from oc where oc.orden_id = e.id and oc.part))
), po2 as (
  select partes.*, hojalatero + pintor + pulido + materiales + refacciones + adicionales as costo from partes
), grp as (
  select rgrupo as grupo, jsonb_build_object(
    'ordenes', count(distinct id),
    'ingreso', sum(ingreso), 'pago_refacciones', sum(pago_ref),
    'mo_carroceria', sum(mo_carroceria), 'mo_mecanica', sum(mo_mecanica), 'mo_pintura', sum(mo_pintura),
    'materiales_autorizados', sum(mat_aut),
    'hojalatero', sum(hojalatero), 'pintor', sum(pintor), 'pulido', sum(pulido),
    'materiales', sum(materiales), 'refacciones', sum(refacciones), 'adicionales', sum(adicionales),
    'costo', sum(costo),
    'util_prom', avg((ingreso - costo) / ingreso) filter (where ingreso > 0),
    'util_ref_prom', avg((pago_ref - refacciones) / pago_ref) filter (where pago_ref > 0)
  ) as datos
  from po2 group by rgrupo
), fac as (
  select coalesce(sum(f.monto), 0) as total,
         coalesce(sum(f.monto) filter (where g.grupo = 'mapfre'), 0) as mapfre
  from public.facturas f join grupos g on g.id = f.orden_id, lim
  where not f.cancelada and f.fecha >= lim.ini_d and f.fecha < lim.fin_d
), rend as (
  select
    round(avg(extract(epoch from (e.fecha_entrega - e.fecha_ingreso)) / 86400)::numeric, 1) as dias_entrega,
    round(avg(extract(epoch from (e.fecha_terminacion - e.fecha_ingreso)) / 86400) filter (where e.fecha_terminacion is not null)::numeric, 1) as dias_taller,
    count(*) filter (where coalesce(s.fecha_asignacion, (e.fecha_ingreso at time zone 'America/Mexico_City')::date) < lim.ini_d) as anteriores,
    count(*) filter (where coalesce(s.fecha_asignacion, (e.fecha_ingreso at time zone 'America/Mexico_City')::date) >= lim.ini_d) as corriente,
    count(*) as total
  from ent e left join public.asignaciones s on s.id = e.asignacion_id, lim
  group by lim.ini_d
), asig as (
  select count(*) as total,
    count(*) filter (where o.etapa = 'entregado') as cerrado,
    count(*) filter (where o.etapa is distinct from 'entregado' and (s.estatus = 'cancelada' or o.etapa = 'cancelado')) as cancelado
  from public.asignaciones s
  join public.aseguradoras a on a.id = s.aseguradora_id and a.nombre ilike '%mapfre%'
  left join lateral (select etapa from public.ordenes where asignacion_id = s.id order by id desc limit 1) o on true, lim
  where s.fecha_asignacion >= lim.ini_d and s.fecha_asignacion < lim.fin_d
), meses as (
  select gs::date as mes from lim, generate_series(make_date(p_anio, 1, 1), lim.ini_d, interval '1 month') gs
  union
  select gs::date from lim, generate_series(lim.ini_d - interval '2 months', lim.ini_d, interval '1 month') gs
), por_mes as (
  select m.mes,
    count(g.id) as todas,
    count(g.id) filter (where g.grupo = 'mapfre') as mapfre
  from meses m
  left join grupos g on g.etapa = 'entregado'
    and g.fecha_entrega >= make_timestamptz(extract(year from m.mes)::int, extract(month from m.mes)::int, 1, 0, 0, 0, 'America/Mexico_City')
    and g.fecha_entrega < make_timestamptz(extract(year from m.mes)::int, extract(month from m.mes)::int, 1, 0, 0, 0, 'America/Mexico_City') + interval '1 month'
  group by m.mes
)
select jsonb_build_object(
  'anio', p_anio, 'mes', p_mes,
  'grupos', coalesce((select jsonb_object_agg(grupo, datos) from grp), '{}'::jsonb),
  'destajo_pct', coalesce((select valor from public.configuracion where clave = 'destajo_teorico_pct'), 20),
  'facturado_total', (select total from fac), 'facturado_mapfre', (select mapfre from fac),
  'dias_entrega', (select dias_entrega from rend), 'dias_taller', (select dias_taller from rend),
  'asignados_anteriores', coalesce((select anteriores from rend), 0),
  'asignados_corriente', coalesce((select corriente from rend), 0),
  'entregados_total', coalesce((select total from rend), 0),
  'asignaciones', (select jsonb_build_object('total', total, 'cerrado', cerrado, 'cancelado', cancelado, 'abierto', total - cerrado - cancelado) from asig),
  'entregados_3m', (select jsonb_agg(jsonb_build_object('mes', mes, 'n', mapfre) order by mes) from por_mes, lim where mes >= lim.ini_d - interval '2 months'),
  'global', (select jsonb_agg(jsonb_build_object('mes', mes, 'n', todas) order by mes) from por_mes where extract(year from mes) = p_anio)
);
$$;
