-- =====================================================================
-- ADMINISTRACION TALLER - Esquema inicial
-- Módulos: Clientes, Vehículos, Taller (órdenes), Compras y almacén,
--          Resultados (vistas de reportes)
-- =====================================================================

-- ---------- CLIENTES ----------
create table public.clientes (
  id          bigint generated always as identity primary key,
  nombre      text not null,
  telefono    text,
  email       text,
  rfc         text,
  direccion   text,
  notas       text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- VEHICULOS ----------
create table public.vehiculos (
  id          bigint generated always as identity primary key,
  cliente_id  bigint not null references public.clientes(id) on delete restrict,
  marca       text not null,
  modelo      text not null,
  anio        int check (anio between 1900 and 2100),
  placas      text,
  vin         text,
  color       text,
  kilometraje int check (kilometraje >= 0),
  notas       text,
  created_at  timestamptz not null default now()
);
create index on public.vehiculos (cliente_id);
create unique index vehiculos_placas_uk on public.vehiculos (upper(placas)) where placas is not null and placas <> '';

-- ---------- ALMACEN: PRODUCTOS / REFACCIONES ----------
create table public.productos (
  id            bigint generated always as identity primary key,
  codigo        text unique,
  nombre        text not null,
  categoria     text,
  unidad        text not null default 'pza',
  costo         numeric(12,2) not null default 0 check (costo >= 0),
  precio_venta  numeric(12,2) not null default 0 check (precio_venta >= 0),
  stock         numeric(12,2) not null default 0,
  stock_minimo  numeric(12,2) not null default 0,
  activo        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------- COMPRAS ----------
create table public.proveedores (
  id          bigint generated always as identity primary key,
  nombre      text not null,
  contacto    text,
  telefono    text,
  email       text,
  rfc         text,
  created_at  timestamptz not null default now()
);

create table public.compras (
  id            bigint generated always as identity primary key,
  proveedor_id  bigint references public.proveedores(id) on delete restrict,
  fecha         date not null default current_date,
  factura       text,
  notas         text,
  created_at    timestamptz not null default now()
);
create index on public.compras (proveedor_id);
create index on public.compras (fecha);

create table public.compra_detalle (
  id           bigint generated always as identity primary key,
  compra_id    bigint not null references public.compras(id) on delete cascade,
  producto_id  bigint not null references public.productos(id) on delete restrict,
  cantidad     numeric(12,2) not null check (cantidad > 0),
  costo_unit   numeric(12,2) not null check (costo_unit >= 0)
);
create index on public.compra_detalle (compra_id);
create index on public.compra_detalle (producto_id);

-- ---------- TALLER: ORDENES DE SERVICIO ----------
create type public.estado_orden as enum
  ('recibido','diagnostico','en_reparacion','terminado','entregado','cancelado');

create table public.ordenes (
  id               bigint generated always as identity primary key,
  folio            bigint generated always as identity (start with 1000) unique,
  cliente_id       bigint not null references public.clientes(id) on delete restrict,
  vehiculo_id      bigint not null references public.vehiculos(id) on delete restrict,
  estado           public.estado_orden not null default 'recibido',
  fecha_ingreso    timestamptz not null default now(),
  fecha_promesa    date,
  fecha_entrega    timestamptz,
  kilometraje      int check (kilometraje >= 0),
  falla_reportada  text,
  diagnostico      text,
  mecanico         text,
  observaciones    text,
  created_at       timestamptz not null default now()
);
create index on public.ordenes (cliente_id);
create index on public.ordenes (vehiculo_id);
create index on public.ordenes (estado);
create index on public.ordenes (fecha_ingreso);

-- Mano de obra / servicios
create table public.orden_servicios (
  id           bigint generated always as identity primary key,
  orden_id     bigint not null references public.ordenes(id) on delete cascade,
  descripcion  text not null,
  cantidad     numeric(12,2) not null default 1 check (cantidad > 0),
  precio_unit  numeric(12,2) not null check (precio_unit >= 0)
);
create index on public.orden_servicios (orden_id);

-- Refacciones usadas (descuentan del almacén)
create table public.orden_refacciones (
  id           bigint generated always as identity primary key,
  orden_id     bigint not null references public.ordenes(id) on delete cascade,
  producto_id  bigint not null references public.productos(id) on delete restrict,
  cantidad     numeric(12,2) not null check (cantidad > 0),
  precio_unit  numeric(12,2) not null check (precio_unit >= 0),
  costo_unit   numeric(12,2) not null default 0 check (costo_unit >= 0)
);
create index on public.orden_refacciones (orden_id);
create index on public.orden_refacciones (producto_id);

-- Pagos / anticipos
create table public.pagos (
  id          bigint generated always as identity primary key,
  orden_id    bigint not null references public.ordenes(id) on delete cascade,
  fecha       timestamptz not null default now(),
  monto       numeric(12,2) not null check (monto > 0),
  metodo      text not null default 'efectivo'
              check (metodo in ('efectivo','tarjeta','transferencia','otro')),
  referencia  text
);
create index on public.pagos (orden_id);
create index on public.pagos (fecha);

-- ---------- MOVIMIENTOS DE INVENTARIO (bitácora) ----------
create table public.movimientos_inventario (
  id           bigint generated always as identity primary key,
  producto_id  bigint not null references public.productos(id) on delete cascade,
  fecha        timestamptz not null default now(),
  tipo         text not null check (tipo in ('entrada','salida','ajuste')),
  cantidad     numeric(12,2) not null,
  origen       text,           -- 'compra', 'orden', 'ajuste'
  referencia   bigint          -- id de compra u orden
);
create index on public.movimientos_inventario (producto_id);

-- =====================================================================
-- TRIGGERS DE INVENTARIO
-- =====================================================================

-- Compras: suman stock y actualizan costo del producto
create or replace function public.fn_compra_detalle_stock()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE','DELETE') then
    update public.productos set stock = stock - old.cantidad where id = old.producto_id;
    insert into public.movimientos_inventario (producto_id, tipo, cantidad, origen, referencia)
      values (old.producto_id, 'salida', old.cantidad, 'compra (reverso)', old.compra_id);
  end if;
  if tg_op in ('INSERT','UPDATE') then
    update public.productos
       set stock = stock + new.cantidad,
           costo = new.costo_unit
     where id = new.producto_id;
    insert into public.movimientos_inventario (producto_id, tipo, cantidad, origen, referencia)
      values (new.producto_id, 'entrada', new.cantidad, 'compra', new.compra_id);
    return new;
  end if;
  return old;
end $$;

create trigger trg_compra_detalle_stock
after insert or update or delete on public.compra_detalle
for each row execute function public.fn_compra_detalle_stock();

-- Órdenes: refacciones descuentan stock y guardan el costo al momento
create or replace function public.fn_orden_refaccion_costo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.costo_unit = 0 then
    select costo into new.costo_unit from public.productos where id = new.producto_id;
  end if;
  return new;
end $$;

create trigger trg_orden_refaccion_costo
before insert on public.orden_refacciones
for each row execute function public.fn_orden_refaccion_costo();

create or replace function public.fn_orden_refaccion_stock()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE','DELETE') then
    update public.productos set stock = stock + old.cantidad where id = old.producto_id;
    insert into public.movimientos_inventario (producto_id, tipo, cantidad, origen, referencia)
      values (old.producto_id, 'entrada', old.cantidad, 'orden (reverso)', old.orden_id);
  end if;
  if tg_op in ('INSERT','UPDATE') then
    update public.productos set stock = stock - new.cantidad where id = new.producto_id;
    insert into public.movimientos_inventario (producto_id, tipo, cantidad, origen, referencia)
      values (new.producto_id, 'salida', new.cantidad, 'orden', new.orden_id);
    return new;
  end if;
  return old;
end $$;

create trigger trg_orden_refaccion_stock
after insert or update or delete on public.orden_refacciones
for each row execute function public.fn_orden_refaccion_stock();

-- Al entregar una orden se registra la fecha de entrega
create or replace function public.fn_orden_entrega()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.estado = 'entregado' and old.estado is distinct from 'entregado' and new.fecha_entrega is null then
    new.fecha_entrega := now();
  end if;
  return new;
end $$;

create trigger trg_orden_entrega
before update on public.ordenes
for each row execute function public.fn_orden_entrega();

-- =====================================================================
-- VISTAS
-- =====================================================================

-- Órdenes con totales calculados
create view public.v_ordenes with (security_invoker = true) as
select
  o.*,
  c.nombre  as cliente_nombre,
  c.telefono as cliente_telefono,
  v.marca || ' ' || v.modelo || coalesce(' ' || v.anio, '') as vehiculo_desc,
  v.placas,
  coalesce(s.total, 0)                    as total_servicios,
  coalesce(r.total, 0)                    as total_refacciones,
  coalesce(r.costo, 0)                    as costo_refacciones,
  coalesce(s.total, 0) + coalesce(r.total, 0) as total,
  coalesce(p.pagado, 0)                   as pagado,
  coalesce(s.total, 0) + coalesce(r.total, 0) - coalesce(p.pagado, 0) as saldo
from public.ordenes o
join public.clientes  c on c.id = o.cliente_id
join public.vehiculos v on v.id = o.vehiculo_id
left join (select orden_id, sum(cantidad * precio_unit) total
             from public.orden_servicios group by orden_id) s on s.orden_id = o.id
left join (select orden_id, sum(cantidad * precio_unit) total, sum(cantidad * costo_unit) costo
             from public.orden_refacciones group by orden_id) r on r.orden_id = o.id
left join (select orden_id, sum(monto) pagado
             from public.pagos group by orden_id) p on p.orden_id = o.id;

-- Compras con total
create view public.v_compras with (security_invoker = true) as
select c.*, pr.nombre as proveedor_nombre,
       coalesce(d.total, 0) as total,
       coalesce(d.partidas, 0) as partidas
from public.compras c
left join public.proveedores pr on pr.id = c.proveedor_id
left join (select compra_id, sum(cantidad * costo_unit) total, count(*) partidas
             from public.compra_detalle group by compra_id) d on d.compra_id = c.id;

-- Resultados mensuales: ingresos (pagos), ventas (órdenes entregadas), costos, compras
create view public.v_resultados_mensuales with (security_invoker = true) as
with meses as (
  select date_trunc('month', fecha)::date mes from public.pagos
  union select date_trunc('month', fecha_entrega)::date from public.ordenes where fecha_entrega is not null
  union select date_trunc('month', fecha)::date from public.compras
),
cobrado as (
  select date_trunc('month', fecha)::date mes, sum(monto) cobrado
  from public.pagos group by 1
),
ventas as (
  select date_trunc('month', fecha_entrega)::date mes,
         count(*) ordenes_entregadas,
         sum(total_servicios) mano_obra,
         sum(total_refacciones) venta_refacciones,
         sum(costo_refacciones) costo_refacciones,
         sum(total) ventas
  from public.v_ordenes
  where estado = 'entregado'
  group by 1
),
compras as (
  select date_trunc('month', fecha)::date mes, sum(total) compras
  from public.v_compras group by 1
)
select m.mes,
       coalesce(v.ordenes_entregadas, 0) ordenes_entregadas,
       coalesce(v.mano_obra, 0)          mano_obra,
       coalesce(v.venta_refacciones, 0)  venta_refacciones,
       coalesce(v.ventas, 0)             ventas,
       coalesce(v.costo_refacciones, 0)  costo_refacciones,
       coalesce(v.ventas, 0) - coalesce(v.costo_refacciones, 0) utilidad_bruta,
       coalesce(c.cobrado, 0)            cobrado,
       coalesce(k.compras, 0)            compras
from meses m
left join ventas  v on v.mes = m.mes
left join cobrado c on c.mes = m.mes
left join compras k on k.mes = m.mes
where m.mes is not null
order by m.mes desc;

-- =====================================================================
-- SEGURIDAD (RLS): solo usuarios autenticados del taller
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['clientes','vehiculos','productos','proveedores','compras',
                           'compra_detalle','ordenes','orden_servicios','orden_refacciones',
                           'pagos','movimientos_inventario']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format($p$create policy "autenticados_todo" on public.%I
                     for all to authenticated using (true) with check (true)$p$, t);
  end loop;
end $$;

revoke all on public.v_ordenes, public.v_compras, public.v_resultados_mensuales from anon;
revoke execute on function public.fn_compra_detalle_stock(), public.fn_orden_refaccion_stock(),
  public.fn_orden_refaccion_costo(), public.fn_orden_entrega() from public, anon, authenticated;
