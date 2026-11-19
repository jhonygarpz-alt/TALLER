-- Órdenes que no se facturan en el sistema: salen de "Por facturar". Solo agrega.
alter table public.ordenes add column if not exists sin_facturar boolean not null default false;
-- orden_sin_facturar(p_orden, p_valor): exige finanzas.gestionar (botón «Quitar» en Facturación).
-- Se marcaron las 70 órdenes históricas con folio OT- (entregadas, sin facturas ni cobros).
