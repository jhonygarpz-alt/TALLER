-- Presupuesto particular (trabajos que paga el cliente en una orden de aseguradora). Solo agrega.
alter table public.presupuestos add column if not exists particular boolean not null default false;
-- presupuesto_enviar / presupuesto_resolver: un presupuesto particular no mueve la etapa de la orden.
-- orden_cambiar_etapa: la autorización requerida es la del presupuesto principal (not particular).
-- fn_presupuesto_guard: es_ampliacion se calcula dentro del mismo tipo (particular / aseguradora).
