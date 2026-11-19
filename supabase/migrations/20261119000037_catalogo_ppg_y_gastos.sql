-- Catálogo de precios PPG, costo estimado desde la solicitud, pequeño material y desglose de gastos por orden. Solo agrega.
alter table public.materiales add column if not exists presentacion text;
alter table public.materiales add column if not exists precio_presentacion numeric(12,2);
alter table public.materiales add column if not exists precio_unidad numeric(12,5);
alter table public.solicitudes_material add column if not exists costo_unit_estimado numeric(12,5);
alter table public.solicitudes_material add column if not exists costo_estimado numeric(12,2);
-- fn_solicitud_guard: al crear la solicitud guarda costo_unit_estimado/costo_estimado (costo promedio o precio de catálogo).
-- Catálogo PPG (CUANTIFICACION_DE_MATERIALES_PPG.xlsx) cargado en materiales: 47 materiales con precio por unidad de uso.
-- configuracion.pequeno_material = 300; v_rentabilidad.costo_otros suma el pequeño material (excepto canceladas).
-- gastos_desglose(p_ids): gastos adicionales, materiales pulido, M.O. hojalatero, M.O. pintor, materiales, refacciones,
--   por entregar (estimado), suma, IVA 16% y total por orden.
