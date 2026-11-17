-- Sección del gasto de material por unidad (hojalatería / pintura / refacción). Solo agrega columnas.
alter table public.compra_partidas add column if not exists seccion text check (seccion in ('hojalateria','pintura','refaccion'));
alter table public.solicitudes_material add column if not exists seccion text check (seccion in ('hojalateria','pintura','refaccion'));
-- compra_accion('recibir'): la entrega directa a la orden copia la sección de la partida
-- (o la deduce del tipo de material: pintura → pintura, refacción → refacción, resto → hojalatería).
