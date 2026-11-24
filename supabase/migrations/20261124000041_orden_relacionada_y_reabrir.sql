-- Órdenes MAPFRE y particular por separado: la particular indica la orden de aseguradora del mismo vehículo (o ninguna).
alter table public.ordenes add column if not exists orden_relacionada_id bigint references public.ordenes(id) on delete set null;
create index if not exists ordenes_relacionada_idx on public.ordenes(orden_relacionada_id);
-- v_ordenes: + orden_relacionada_id, relacionada_folio (al final).
-- presupuesto_reabrir(p_id, p_motivo): regresa un presupuesto autorizado/enviado a borrador para corregirlo
--   (requiere presupuestos.autorizar o excepciones.autorizar; bloquea si ya tiene facturas; queda en auditoría).
