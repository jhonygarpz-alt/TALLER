-- Trabajos asignables a un proveedor externo + baja/eliminación de proveedores. Solo agrega; no borra datos.
-- (Aplicada en Supabase como "actividad_proveedor"; funciones completas en la base.)
alter table public.actividades add column if not exists proveedor_id bigint references public.proveedores(id);
alter table public.actividades add column if not exists costo_proveedor numeric(12,2) check (costo_proveedor is null or costo_proveedor >= 0);
alter table public.actividades alter column tecnico_id drop not null;
alter table public.actividades add constraint actividades_responsable_chk check ((tecnico_id is not null) <> (proveedor_id is not null));
create index if not exists actividades_proveedor_idx on public.actividades(proveedor_id);
alter table public.orden_costos add column if not exists actividad_id bigint references public.actividades(id);
alter table public.proveedores add column if not exists activo boolean not null default true;
create policy baja on public.proveedores for delete to authenticated using ((select public.puede('compras.gestionar')));
-- fn_actividad_guard: trabajos de proveedor con importe_destajo = 0.
-- actividad_accion('validar'): técnico → destajo (sin cambios); proveedor → orden_costos 'servicio_externo'
--   (concepto, proveedor, costo_proveedor, actividad_id) si hay costo.
-- actividad_anular: además borra el costo de servicio externo ligado a la actividad.
-- fn_push_actividad: sin técnico no envía push.
-- v_ordenes.tecnicos_activos: incluye "Prov. <nombre>".
