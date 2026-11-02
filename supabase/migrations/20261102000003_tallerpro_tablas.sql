-- =====================================================================
-- TALLERPRO · Parte 1: tipos, tablas, usuarios y permisos
-- =====================================================================

-- ---------------------------- TIPOS ----------------------------------
create type public.rol_usuario as enum ('direccion','administracion','supervisor','compras','asesor','tecnico');
create type public.tipo_servicio as enum ('aseguradora','particular');
create type public.etapa_orden as enum (
  'diagnostico','esperando_autorizacion','en_reparacion','hojalateria','pintura',
  'detallado','control_calidad','listo_entrega','entregado','cancelado');
create type public.estatus_contacto as enum (
  'sin_contactar','no_localizado','contactado','cita_programada','cita_no_concretada','ingresado','cancelada');
create type public.area_trabajo as enum ('mecanica','hojalateria','pintura','detallado','otros');
create type public.estado_actividad as enum ('asignada','en_proceso','terminada','validada','cancelada');
create type public.estado_destajo as enum ('pendiente','autorizado','pagado','cancelado');
create type public.estado_presupuesto as enum ('borrador','enviado','autorizado','rechazado');
create type public.tipo_concepto as enum ('mano_obra','refaccion','pintura','material','externo');
create type public.tipo_material as enum ('pintura','material','refaccion');
create type public.estado_solicitud as enum ('solicitada','autorizada','entregada','rechazada');
create type public.estado_compra as enum ('requisicion','por_autorizar','autorizada','recibida','cancelada');

-- ------------------------ USUARIOS Y PERMISOS ------------------------
create table public.perfiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  nombre      text not null,
  rol         public.rol_usuario not null default 'tecnico',
  activo      boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.permisos (
  clave        text primary key,
  modulo       text not null,
  descripcion  text not null
);

create table public.rol_permisos (
  rol      public.rol_usuario not null,
  permiso  text not null references public.permisos(clave) on delete cascade,
  primary key (rol, permiso)
);

-- El primer usuario registrado es Dirección y queda activo.
-- Los siguientes quedan inactivos hasta que Dirección los active y asigne rol.
create or replace function public.fn_nuevo_usuario()
returns trigger language plpgsql security definer set search_path = '' as $$
declare primero boolean;
begin
  perform pg_advisory_xact_lock(4815162342);
  select not exists (select 1 from public.perfiles) into primero;
  insert into public.perfiles (id, email, nombre, rol, activo)
  values (new.id, new.email,
          coalesce(nullif(new.raw_user_meta_data->>'nombre',''), split_part(new.email,'@',1)),
          case when primero then 'direccion'::public.rol_usuario else 'tecnico'::public.rol_usuario end,
          primero);
  return new;
end $$;

create trigger trg_nuevo_usuario after insert on auth.users
for each row execute function public.fn_nuevo_usuario();

create or replace function public.mi_rol()
returns public.rol_usuario language sql stable security definer set search_path = '' as $$
  select rol from public.perfiles where id = auth.uid() and activo
$$;

create or replace function public.es_activo()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and activo)
$$;

create or replace function public.puede(p text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select pf.rol = 'direccion'
         or exists (select 1 from public.rol_permisos rp where rp.rol = pf.rol and rp.permiso = p)
       from public.perfiles pf where pf.id = auth.uid() and pf.activo),
    false)
$$;

-- --------------------------- CONFIGURACIÓN ---------------------------
create table public.aseguradoras (
  id      bigint generated always as identity primary key,
  nombre  text not null unique,
  activo  boolean not null default true
);

create table public.tipos_reparacion (
  id             bigint generated always as identity primary key,
  nombre         text not null,
  aseguradora_id bigint references public.aseguradoras(id),
  dias_objetivo  int not null check (dias_objetivo > 0),
  activo         boolean not null default true
);

create table public.configuracion (
  clave        text primary key,
  valor        numeric not null,
  descripcion  text not null
);

-- ---------------------------- CLIENTES -------------------------------
create table public.clientes (
  id          bigint generated always as identity primary key,
  nombre      text not null,
  telefono    text,
  email       text,
  rfc         text,
  created_at  timestamptz not null default now()
);

create table public.vehiculos (
  id          bigint generated always as identity primary key,
  cliente_id  bigint references public.clientes(id),
  marca       text not null,
  modelo      text not null,
  anio        int check (anio between 1950 and 2100),
  placas      text,
  vin         text,
  color       text,
  created_at  timestamptz not null default now()
);
create index on public.vehiculos (cliente_id);
create index on public.vehiculos (upper(placas));

-- --------------------------- ASIGNACIONES ----------------------------
create table public.asignaciones (
  id                bigint generated always as identity primary key,
  aseguradora_id    bigint not null references public.aseguradoras(id),
  siniestro         text not null,
  asegurado         text not null,
  telefono          text,
  marca             text,
  modelo            text,
  anio              int,
  placas            text,
  fecha_asignacion  date not null default current_date,
  asesor_id         uuid references public.perfiles(id),
  estatus           public.estatus_contacto not null default 'sin_contactar',
  primer_contacto   timestamptz,
  ultimo_intento    timestamptz,
  intentos          int not null default 0,
  fecha_cita        timestamptz,
  motivo_no_cita    text,
  notas             text,
  created_at        timestamptz not null default now(),
  unique (aseguradora_id, siniestro)
);
create index on public.asignaciones (estatus);

create table public.contactos (
  id             bigint generated always as identity primary key,
  asignacion_id  bigint not null references public.asignaciones(id) on delete cascade,
  fecha          timestamptz not null default now(),
  medio          text not null check (medio in ('llamada','whatsapp','sms','correo','presencial')),
  resultado      text not null check (resultado in ('contactado','no_contesta','numero_erroneo','cita_programada','reprogramada','no_acepta','otro')),
  fecha_cita     timestamptz,
  notas          text,
  usuario_id     uuid default auth.uid() references public.perfiles(id)
);
create index on public.contactos (asignacion_id);

-- ------------------------------ ÓRDENES ------------------------------
create sequence public.folio_ot start 1;

create table public.ordenes (
  id                  bigint generated always as identity primary key,
  folio               text not null unique default ('OT-' || lpad(nextval('public.folio_ot')::text, 5, '0')),
  tipo                public.tipo_servicio not null,
  aseguradora_id      bigint references public.aseguradoras(id),
  asignacion_id       bigint unique references public.asignaciones(id),
  siniestro           text,
  cliente_id          bigint not null references public.clientes(id),
  vehiculo_id         bigint not null references public.vehiculos(id),
  tipo_reparacion_id  bigint references public.tipos_reparacion(id),
  etapa               public.etapa_orden not null default 'diagnostico',
  asesor_id           uuid references public.perfiles(id),
  kilometraje         int check (kilometraje >= 0),
  fecha_ingreso       timestamptz not null default now(),
  fecha_compromiso    date,
  danos_reportados    text,
  checklist_recepcion jsonb not null default '{}'::jsonb,
  objetos             text,
  detenido_material   boolean not null default false,
  motivo_retraso      text,
  fecha_terminacion   timestamptz,
  fecha_entrega       timestamptz,
  recibio_nombre      text,
  checklist_calidad   jsonb not null default '{}'::jsonb,
  satisfaccion        int check (satisfaccion between 1 and 5),
  encuesta_comentario text,
  encuesta_fecha      timestamptz,
  ultima_actualizacion timestamptz not null default now(),
  creado_por          uuid default auth.uid() references public.perfiles(id),
  created_at          timestamptz not null default now(),
  check ((tipo = 'aseguradora') = (aseguradora_id is not null))
);
create index on public.ordenes (etapa);
create index on public.ordenes (cliente_id);
create index on public.ordenes (vehiculo_id);
create index on public.ordenes (fecha_ingreso);

create table public.orden_historial (
  id               bigint generated always as identity primary key,
  orden_id         bigint not null references public.ordenes(id) on delete cascade,
  fecha            timestamptz not null default now(),
  etapa_anterior   public.etapa_orden,
  etapa_nueva      public.etapa_orden not null,
  excepcion        boolean not null default false,
  justificacion    text,
  usuario_id       uuid default auth.uid() references public.perfiles(id)
);
create index on public.orden_historial (orden_id);

create table public.danos (
  id           bigint generated always as identity primary key,
  orden_id     bigint not null references public.ordenes(id) on delete cascade,
  area         public.area_trabajo not null,
  pieza        text not null,
  descripcion  text,
  created_at   timestamptz not null default now()
);
create index on public.danos (orden_id);

-- Fotografías y evidencias (archivos en Storage privado "evidencias")
create table public.fotos (
  id           bigint generated always as identity primary key,
  orden_id     bigint not null references public.ordenes(id) on delete cascade,
  categoria    text not null check (categoria in ('recepcion','diagnostico','dano','actividad','entrega','conformidad','pieza_retirada')),
  ref_id       bigint,
  path         text not null unique,
  descripcion  text,
  subido_por   uuid default auth.uid() references public.perfiles(id),
  created_at   timestamptz not null default now()
);
create index on public.fotos (orden_id);

-- ---------------------------- PRESUPUESTOS ---------------------------
create table public.presupuestos (
  id                 bigint generated always as identity primary key,
  orden_id           bigint not null references public.ordenes(id) on delete cascade,
  numero             int not null default 1,
  es_ampliacion      boolean not null default false,
  estado             public.estado_presupuesto not null default 'borrador',
  autorizado_por     text,
  referencia_aut     text,
  fecha_autorizacion timestamptz,
  notas              text,
  created_at         timestamptz not null default now(),
  unique (orden_id, numero)
);

create table public.presupuesto_partidas (
  id              bigint generated always as identity primary key,
  presupuesto_id  bigint not null references public.presupuestos(id) on delete cascade,
  area            public.area_trabajo not null,
  concepto        public.tipo_concepto not null,
  descripcion     text not null,
  cantidad        numeric(12,3) not null default 1 check (cantidad > 0),
  unidad          text not null default 'pza',
  precio_unit     numeric(12,2) not null default 0 check (precio_unit >= 0),
  costo_unit      numeric(12,2) not null default 0 check (costo_unit >= 0)
);
create index on public.presupuesto_partidas (presupuesto_id);

-- ----------------------- TÉCNICOS Y DESTAJOS -------------------------
create table public.tecnicos (
  id         bigint generated always as identity primary key,
  nombre     text not null,
  area       public.area_trabajo not null,
  perfil_id  uuid unique references public.perfiles(id),
  activo     boolean not null default true
);

create table public.tarifas_destajo (
  id         bigint generated always as identity primary key,
  area       public.area_trabajo not null,
  actividad  text not null,
  importe    numeric(12,2) not null check (importe >= 0),
  activo     boolean not null default true,
  unique (area, actividad)
);

create table public.actividades (
  id              bigint generated always as identity primary key,
  orden_id        bigint not null references public.ordenes(id) on delete restrict,
  area            public.area_trabajo not null,
  actividad       text not null,
  pieza           text,
  tecnico_id      bigint not null references public.tecnicos(id),
  tarifa_id       bigint references public.tarifas_destajo(id),
  importe_destajo numeric(12,2) not null default 0 check (importe_destajo >= 0),
  estado          public.estado_actividad not null default 'asignada',
  fecha_asignacion timestamptz not null default now(),
  fecha_inicio    timestamptz,
  fecha_fin       timestamptz,
  horas           numeric(8,2),
  rechazos        int not null default 0,
  motivo_rechazo  text,
  validado_por    uuid references public.perfiles(id),
  validado_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index on public.actividades (orden_id);
create index on public.actividades (tecnico_id);
create index on public.actividades (estado);

create table public.destajos (
  id              bigint generated always as identity primary key,
  actividad_id    bigint not null unique references public.actividades(id),  -- impide duplicar destajos
  orden_id        bigint not null references public.ordenes(id),
  tecnico_id      bigint not null references public.tecnicos(id),
  tipo            public.tipo_servicio not null,   -- separa MAPFRE / particulares
  importe         numeric(12,2) not null check (importe >= 0),
  estado          public.estado_destajo not null default 'pendiente',
  generado_at     timestamptz not null default now(),
  autorizado_por  uuid references public.perfiles(id),
  autorizado_at   timestamptz,
  pagado_por      uuid references public.perfiles(id),
  pagado_at       timestamptz,
  referencia_pago text
);
create index on public.destajos (estado);
create index on public.destajos (tecnico_id);

-- ------------------------ ALMACÉN Y COMPRAS --------------------------
create table public.proveedores (
  id         bigint generated always as identity primary key,
  nombre     text not null,
  contacto   text,
  telefono   text,
  email      text,
  rfc        text,
  created_at timestamptz not null default now()
);

create table public.materiales (
  id              bigint generated always as identity primary key,
  codigo          text unique,
  descripcion     text not null,
  tipo            public.tipo_material not null default 'material',
  categoria       text,
  unidad          text not null default 'pza',
  existencia      numeric(14,3) not null default 0 check (existencia >= 0),
  costo_promedio  numeric(14,4) not null default 0 check (costo_promedio >= 0),
  minimo          numeric(14,3) not null default 0,
  proveedor_id    bigint references public.proveedores(id),
  activo          boolean not null default true,
  created_at      timestamptz not null default now()
);

create table public.movimientos_inventario (
  id            bigint generated always as identity primary key,
  material_id   bigint not null references public.materiales(id),
  fecha         timestamptz not null default now(),
  tipo          text not null check (tipo in ('entrada','salida','ajuste')),
  cantidad      numeric(14,3) not null,
  costo_unit    numeric(14,4) not null default 0,
  existencia_resultante numeric(14,3) not null,
  orden_id      bigint references public.ordenes(id),
  compra_id     bigint,
  solicitud_id  bigint,
  motivo        text,
  usuario_id    uuid default auth.uid() references public.perfiles(id)
);
create index on public.movimientos_inventario (material_id);
create index on public.movimientos_inventario (orden_id);

-- Toda salida de material va ligada a una orden o a un centro de costo general autorizado
create table public.solicitudes_material (
  id                 bigint generated always as identity primary key,
  orden_id           bigint references public.ordenes(id),
  centro_costo       text,
  material_id        bigint not null references public.materiales(id),
  actividad_id       bigint references public.actividades(id),
  cantidad_solicitada numeric(14,3) not null check (cantidad_solicitada > 0),
  cantidad_aprobada  numeric(14,3),
  cantidad_entregada numeric(14,3),
  costo_unit         numeric(14,4),
  costo_total        numeric(14,2),
  estado             public.estado_solicitud not null default 'solicitada',
  notas              text,
  motivo_rechazo     text,
  solicitado_por     uuid default auth.uid() references public.perfiles(id),
  solicitado_at      timestamptz not null default now(),
  autorizado_por     uuid references public.perfiles(id),
  autorizado_at      timestamptz,
  entregado_por      uuid references public.perfiles(id),
  entregado_at       timestamptz,
  check ((orden_id is not null) <> (nullif(trim(centro_costo),'') is not null))
);
create index on public.solicitudes_material (orden_id);
create index on public.solicitudes_material (estado);

create table public.compras (
  id            bigint generated always as identity primary key,
  proveedor_id  bigint references public.proveedores(id),
  estado        public.estado_compra not null default 'requisicion',
  fecha         date not null default current_date,
  factura       text,
  notas         text,
  solicitado_por uuid default auth.uid() references public.perfiles(id),
  autorizado_por uuid references public.perfiles(id),
  autorizado_at  timestamptz,
  recibido_at    timestamptz,
  created_at     timestamptz not null default now()
);

create table public.compra_partidas (
  id           bigint generated always as identity primary key,
  compra_id    bigint not null references public.compras(id) on delete cascade,
  material_id  bigint not null references public.materiales(id),
  orden_id     bigint references public.ordenes(id),   -- si la compra es para una orden específica
  cantidad     numeric(14,3) not null check (cantidad > 0),
  costo_unit   numeric(14,4) not null check (costo_unit >= 0)
);
create index on public.compra_partidas (compra_id);

create table public.cotizaciones (
  id            bigint generated always as identity primary key,
  compra_id     bigint not null references public.compras(id) on delete cascade,
  proveedor_id  bigint not null references public.proveedores(id),
  importe       numeric(14,2) not null check (importe >= 0),
  dias_entrega  int,
  notas         text,
  elegida       boolean not null default false
);

create table public.precios_historial (
  id            bigint generated always as identity primary key,
  material_id   bigint not null references public.materiales(id),
  proveedor_id  bigint references public.proveedores(id),
  compra_id     bigint references public.compras(id),
  fecha         date not null default current_date,
  costo_unit    numeric(14,4) not null,
  costo_anterior numeric(14,4)
);
create index on public.precios_historial (material_id);

create table public.piezas_retiradas (
  id           bigint generated always as identity primary key,
  orden_id     bigint not null references public.ordenes(id) on delete cascade,
  pieza        text not null,
  destino      text not null check (destino in ('devolucion','resguardo','entrega_propietario','disposicion_autorizada','pendiente')),
  responsable  text,
  fecha        timestamptz not null default now(),
  notas        text,
  usuario_id   uuid default auth.uid() references public.perfiles(id)
);

-- ----------------------------- FINANZAS ------------------------------
create table public.orden_costos (
  id          bigint generated always as identity primary key,
  orden_id    bigint not null references public.ordenes(id),
  tipo        text not null check (tipo in ('mano_obra_adicional','servicio_externo','otro')),
  concepto    text not null,
  proveedor   text,
  monto       numeric(14,2) not null check (monto > 0),
  fecha       date not null default current_date,
  usuario_id  uuid default auth.uid() references public.perfiles(id)
);
create index on public.orden_costos (orden_id);

create table public.facturas (
  id          bigint generated always as identity primary key,
  orden_id    bigint not null references public.ordenes(id),
  folio       text not null,
  fecha       date not null default current_date,
  receptor    text not null check (receptor in ('aseguradora','cliente')),
  monto       numeric(14,2) not null check (monto > 0),
  cancelada   boolean not null default false,
  usuario_id  uuid default auth.uid() references public.perfiles(id)
);
create index on public.facturas (orden_id);

create table public.cobros (
  id          bigint generated always as identity primary key,
  orden_id    bigint not null references public.ordenes(id),
  factura_id  bigint references public.facturas(id),
  fecha       date not null default current_date,
  monto       numeric(14,2) not null check (monto > 0),
  metodo      text not null check (metodo in ('transferencia','efectivo','tarjeta','cheque','deducible')),
  referencia  text,
  usuario_id  uuid default auth.uid() references public.perfiles(id)
);
create index on public.cobros (orden_id);

create table public.gastos_fijos (
  id        bigint generated always as identity primary key,
  mes       date not null,
  concepto  text not null,
  monto     numeric(14,2) not null check (monto >= 0)
);

-- ----------------------------- AUDITORÍA -----------------------------
create table public.auditoria (
  id           bigint generated always as identity primary key,
  fecha        timestamptz not null default now(),
  usuario_id   uuid,
  tabla        text not null,
  registro_id  text,
  accion       text not null,
  antes        jsonb,
  despues      jsonb
);
create index on public.auditoria (tabla, registro_id);
create index on public.auditoria (fecha);
