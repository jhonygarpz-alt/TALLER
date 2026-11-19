-- Listado de materiales para la solicitud desde la app de técnicos (hojalatería / pintura). Solo agrega.
alter table public.materiales add column if not exists secciones text[] not null default '{}';
alter table public.materiales add column if not exists orden_lista integer;
-- (Catálogo inicial de 29 materiales dado de alta desde Supabase con la hoja de materiales del taller.)

-- Concepto facturado por separado: presupuesto, ampliación o presupuesto particular.
alter table public.facturas add column if not exists concepto text check (concepto in ('presupuesto','ampliacion','particular'));
-- v_cuentas_cobrar: se agregó f.concepto al final.
-- fn_presupuesto_guard: en órdenes entregadas solo se permite crear un presupuesto particular (canceladas siguen bloqueadas).
