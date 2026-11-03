-- Reporte mensual "Análisis de Rendimiento Operativo y Costos" (formato MAPFRE/Legaria).
-- Solo lectura: calcula con los datos existentes; no modifica tablas ni registros.
-- Criterio: las cifras económicas y de rendimiento son de las órdenes ENTREGADAS en el mes.

insert into public.configuracion (clave, valor, descripcion) values
  ('destajo_teorico_pct', 20, 'Porcentaje de la mano de obra autorizada que se paga como destajo teórico (reporte mensual)')
on conflict (clave) do nothing;

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
    sum(pp.cantidad * pp.precio_unit) filter (where pp.concepto = 'refaccion') as refacciones,
    sum(pp.cantidad * pp.precio_unit) filter (where pp.concepto = 'mano_obra' and pp.area = 'mecanica') as mo_mecanica,
    sum(pp.cantidad * pp.precio_unit) filter (where pp.concepto = 'pintura' or (pp.concepto = 'mano_obra' and pp.area = 'pintura')) as mo_pintura,
    sum(pp.cantidad * pp.precio_unit) filter (where pp.concepto = 'mano_obra' and pp.area not in ('mecanica', 'pintura')) as mo_carroceria,
    sum(pp.cantidad * pp.precio_unit) filter (where pp.concepto in ('material', 'externo')) as materiales,
    sum(pp.cantidad * pp.precio_unit) as total
  from public.presupuestos p join public.presupuesto_partidas pp on pp.presupuesto_id = p.id
  where p.estado = 'autorizado' and p.orden_id in (select id from ent)
  group by p.orden_id
), des as (
  select d.orden_id,
    sum(d.importe) filter (where coalesce(ac.area::text, 'hojalateria') in ('hojalateria', 'mecanica', 'otros')) as hojalatero,
    sum(d.importe) filter (where ac.area = 'pintura') as pintor,
    sum(d.importe) filter (where ac.area = 'detallado') as pulido
  from public.destajos d left join public.actividades ac on ac.id = d.actividad_id
  where d.estado <> 'cancelado' and d.orden_id in (select id from ent)
  group by d.orden_id
), po as (
  select e.id, e.grupo,
    coalesce(i.total, 0) as ingreso, coalesce(i.refacciones, 0) as pago_ref,
    coalesce(i.mo_carroceria, 0) as mo_carroceria, coalesce(i.mo_mecanica, 0) as mo_mecanica,
    coalesce(i.mo_pintura, 0) as mo_pintura, coalesce(i.materiales, 0) as mat_aut,
    coalesce(d.hojalatero, 0) as hojalatero, coalesce(d.pintor, 0) as pintor, coalesce(d.pulido, 0) as pulido,
    coalesce(r.costo_materiales, 0) + coalesce(r.costo_pintura, 0) as materiales,
    coalesce(r.costo_refacciones, 0) as refacciones,
    coalesce(r.costo_mano_obra_adicional, 0) + coalesce(r.costo_servicios_externos, 0) + coalesce(r.costo_otros, 0) as adicionales
  from ent e
  left join ing i on i.orden_id = e.id
  left join des d on d.orden_id = e.id
  left join public.v_rentabilidad r on r.orden_id = e.id
), po2 as (
  select po.*, hojalatero + pintor + pulido + materiales + refacciones + adicionales as costo from po
), grp as (
  select grupo, jsonb_build_object(
    'ordenes', count(*),
    'ingreso', sum(ingreso), 'pago_refacciones', sum(pago_ref),
    'mo_carroceria', sum(mo_carroceria), 'mo_mecanica', sum(mo_mecanica), 'mo_pintura', sum(mo_pintura),
    'materiales_autorizados', sum(mat_aut),
    'hojalatero', sum(hojalatero), 'pintor', sum(pintor), 'pulido', sum(pulido),
    'materiales', sum(materiales), 'refacciones', sum(refacciones), 'adicionales', sum(adicionales),
    'costo', sum(costo),
    'util_prom', avg((ingreso - costo) / ingreso) filter (where ingreso > 0),
    'util_ref_prom', avg((pago_ref - refacciones) / pago_ref) filter (where pago_ref > 0)
  ) as datos
  from po2 group by grupo
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

revoke execute on function public.reporte_mensual(int, int) from anon;
grant execute on function public.reporte_mensual(int, int) to authenticated;
