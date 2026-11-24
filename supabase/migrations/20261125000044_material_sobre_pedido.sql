-- Materiales que se compran sobre pedido (p. ej. COLOR): se entregan sin existencia y no descuentan inventario.
alter table public.materiales add column if not exists sobre_pedido boolean not null default false;
update public.materiales set sobre_pedido = true where descripcion = 'COLOR';
-- solicitud_entregar: si m.sobre_pedido, no valida ni descuenta existencia (el costo es el importe capturado en la solicitud).
