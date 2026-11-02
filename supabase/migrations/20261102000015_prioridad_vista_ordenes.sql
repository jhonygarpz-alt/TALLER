-- Prioridad de la orden (aditivo) y vista de órdenes ampliada (sucursal, prioridad, días en la etapa actual)
alter table public.ordenes add column if not exists prioridad text not null default 'normal'
  check (prioridad in ('normal','alta','urgente'));

drop view if exists public.v_ordenes;
create view public.v_ordenes with (security_invoker = true) as
select o.*,
  c.nombre  as cliente_nombre, c.telefono as cliente_telefono,
  v.marca, v.modelo, v.anio, v.placas, v.color,
  a.nombre  as aseguradora_nombre,
  pa.nombre as asesor_nombre,
  tr.nombre as tipo_reparacion_nombre,
  su.nombre as sucursal_nombre,
  ((coalesce(o.fecha_entrega, now()) at time zone 'America/Mexico_City')::date
     - (o.fecha_ingreso at time zone 'America/Mexico_City')::date) as dias_en_taller,
  ((now() at time zone 'America/Mexico_City')::date
     - (coalesce((select max(h.fecha) from public.orden_historial h where h.orden_id = o.id and h.etapa_nueva = o.etapa), o.fecha_ingreso)
        at time zone 'America/Mexico_City')::date) as dias_en_etapa,
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
left join public.tipos_reparacion tr on tr.id = o.tipo_reparacion_id
left join public.sucursales su on su.id = o.sucursal_id;
revoke all on public.v_ordenes from anon;
grant select on public.v_ordenes to authenticated;
