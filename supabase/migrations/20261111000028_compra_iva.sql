-- IVA por partida de compra. costo_unit sigue siendo el valor neto (sin IVA):
-- el inventario, el costo promedio y el cargo a las órdenes se mantienen en neto (IVA acreditable).
alter table public.compra_partidas add column if not exists iva_pct numeric(5,2) not null default 0
  check (iva_pct >= 0 and iva_pct <= 100);
comment on column public.compra_partidas.iva_pct is 'Tasa de IVA de la partida (%). Importe con IVA = cantidad * costo_unit * (1 + iva_pct/100)';
