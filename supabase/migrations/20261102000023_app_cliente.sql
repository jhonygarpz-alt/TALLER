-- App del cliente: acceso con teléfono registrado + placas, seguimiento, encuesta y avisos push.
-- Los clientes NO son usuarios del sistema: todo pasa por funciones SECURITY DEFINER que solo
-- devuelven datos del vehículo con el que se identificaron (sin costos ni información interna).

create table public.cliente_accesos (
  token       uuid primary key default gen_random_uuid(),
  cliente_id  bigint not null references public.clientes(id) on delete cascade,
  vehiculo_id bigint not null references public.vehiculos(id) on delete cascade,
  creado      timestamptz not null default now(),
  ultimo_uso  timestamptz not null default now(),
  expira      timestamptz not null default now() + interval '120 days'
);
create table public.cliente_intentos (
  id     bigint generated always as identity primary key,
  fecha  timestamptz not null default now(),
  placas text,
  ip     text,
  exito  boolean not null
);
create index on public.cliente_intentos (placas, fecha);
create index on public.cliente_intentos (ip, fecha);
create table public.cliente_push (
  id          bigint generated always as identity primary key,
  token       uuid not null references public.cliente_accesos(token) on delete cascade,
  vehiculo_id bigint not null references public.vehiculos(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);
-- Sin acceso directo desde la API: solo mediante las funciones de abajo
alter table public.cliente_accesos enable row level security;
alter table public.cliente_intentos enable row level security;
alter table public.cliente_push enable row level security;
revoke all on public.cliente_accesos, public.cliente_intentos, public.cliente_push from anon, authenticated;

create or replace function public._solo_digitos(t text) returns text language sql immutable as $$ select right(regexp_replace(coalesce(t, ''), '\D', '', 'g'), 10) $$;
create or replace function public._placa(t text) returns text language sql immutable as $$ select upper(regexp_replace(coalesce(t, ''), '[^A-Za-z0-9]', '', 'g')) $$;

/** Entrar: valida teléfono (últimos 10 dígitos) + placas y devuelve un token de acceso */
create or replace function public.cliente_entrar(p_telefono text, p_placas text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_ip text; v_tel text := public._solo_digitos(p_telefono); v_pl text := public._placa(p_placas); r record; v_token uuid;
begin
  v_ip := split_part(coalesce((current_setting('request.headers', true))::jsonb ->> 'x-forwarded-for', ''), ',', 1);
  if length(v_tel) < 10 or length(v_pl) < 4 then raise exception 'Escribe tu teléfono a 10 dígitos y las placas completas'; end if;
  if (select count(*) from public.cliente_intentos where not exito and fecha > now() - interval '15 minutes' and (placas = v_pl or (v_ip <> '' and ip = v_ip))) >= 6 then
    raise exception 'Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.';
  end if;
  select v.id as vehiculo_id, c.id as cliente_id into r
  from public.vehiculos v join public.clientes c on c.id = v.cliente_id
  where public._placa(v.placas) = v_pl and public._solo_digitos(c.telefono) = v_tel
  order by v.id desc limit 1;
  insert into public.cliente_intentos (placas, ip, exito) values (v_pl, nullif(v_ip, ''), r.vehiculo_id is not null);
  -- se responde con error (sin excepción) para que el intento fallido quede registrado
  if r.vehiculo_id is null then return jsonb_build_object('error', 'No encontramos un vehículo con esas placas y ese teléfono. Revisa los datos o llama al taller.'); end if;
  insert into public.cliente_accesos (cliente_id, vehiculo_id) values (r.cliente_id, r.vehiculo_id) returning token into v_token;
  return jsonb_build_object('token', v_token);
end $$;

-- Etapa en palabras del cliente y posición en la línea de tiempo (1..8)
create or replace function public._etapa_cliente(e public.etapa_orden) returns jsonb language sql immutable as $$
  select case e
    when 'recepcion' then '{"paso":1,"titulo":"Recibimos tu vehículo","detalle":"Registramos su estado y fotografías de ingreso."}'
    when 'diagnostico' then '{"paso":2,"titulo":"En diagnóstico","detalle":"Revisamos los daños para preparar la valuación."}'
    when 'esperando_autorizacion' then '{"paso":3,"titulo":"Esperando autorización","detalle":"La valuación está en revisión por la aseguradora o por ti."}'
    when 'en_reparacion' then '{"paso":4,"titulo":"En reparación","detalle":"Nuestros técnicos trabajan en tu vehículo."}'
    when 'hojalateria' then '{"paso":4,"titulo":"En hojalatería","detalle":"Estamos reparando la carrocería."}'
    when 'preparacion' then '{"paso":5,"titulo":"Preparando para pintura","detalle":"Lijado, primer y enmascarado."}'
    when 'pintura' then '{"paso":5,"titulo":"En pintura","detalle":"Aplicando pintura y barniz."}'
    when 'detallado' then '{"paso":6,"titulo":"Detalles finales","detalle":"Pulido, armado y limpieza."}'
    when 'control_calidad' then '{"paso":6,"titulo":"Control de calidad","detalle":"Revisión final antes de la entrega."}'
    when 'listo_entrega' then '{"paso":7,"titulo":"¡Tu vehículo está listo!","detalle":"Ya puedes pasar a recogerlo."}'
    when 'entregado' then '{"paso":8,"titulo":"Entregado","detalle":"Gracias por tu confianza."}'
    else '{"paso":0,"titulo":"Cancelado","detalle":"La orden fue cancelada."}' end::jsonb
$$;

/** Datos para la app: vehículo, órdenes (estado, fechas, línea de tiempo, encuesta) y datos del taller */
create or replace function public.cliente_datos(p_token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.cliente_accesos; res jsonb;
begin
  select * into a from public.cliente_accesos where token = p_token and expira > now();
  if not found then raise exception 'SESION_VENCIDA'; end if;
  update public.cliente_accesos set ultimo_uso = now(), expira = greatest(expira, now() + interval '120 days') where token = p_token;
  select jsonb_build_object(
    'cliente', (select jsonb_build_object('nombre', initcap(split_part(c.nombre, ' ', 1))) from public.clientes c where c.id = a.cliente_id),
    'vehiculo', (select jsonb_build_object('marca', v.marca, 'modelo', v.modelo, 'anio', v.anio, 'placas', v.placas, 'color', v.color) from public.vehiculos v where v.id = a.vehiculo_id),
    'taller', (select jsonb_build_object('nombre', e.nombre, 'logo', e.logo_path) from public.empresa e where e.id = 1),
    'ordenes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'folio', o.folio, 'etapa', o.etapa, 'estado', public._etapa_cliente(o.etapa),
        'aseguradora', (select s.nombre from public.aseguradoras s where s.id = o.aseguradora_id),
        'ingreso', o.fecha_ingreso, 'compromiso', o.fecha_compromiso, 'entrega', o.fecha_entrega,
        'danos', o.danos_reportados,
        'satisfaccion', o.satisfaccion, 'encuesta_fecha', o.encuesta_fecha,
        'historial', coalesce((select jsonb_agg(jsonb_build_object('fecha', h.fecha, 'etapa', h.etapa_nueva, 'estado', public._etapa_cliente(h.etapa_nueva)) order by h.fecha)
                               from public.orden_historial h where h.orden_id = o.id), '[]'::jsonb)
      ) order by o.fecha_ingreso desc)
      from public.ordenes o where o.vehiculo_id = a.vehiculo_id and o.etapa <> 'cancelado'), '[]'::jsonb),
    'avisos', (select count(*) from public.cliente_push p where p.token = p_token)
  ) into res;
  return res;
end $$;

/** Encuesta de satisfacción (una vez, solo órdenes entregadas de su vehículo) */
create or replace function public.cliente_encuesta(p_token uuid, p_orden bigint, p_calificacion int, p_comentario text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.cliente_accesos; o public.ordenes;
begin
  select * into a from public.cliente_accesos where token = p_token and expira > now();
  if not found then raise exception 'SESION_VENCIDA'; end if;
  select * into o from public.ordenes where id = p_orden and vehiculo_id = a.vehiculo_id;
  if not found then raise exception 'Orden no encontrada'; end if;
  if o.etapa <> 'entregado' then raise exception 'La encuesta se contesta cuando recibas tu vehículo'; end if;
  if o.satisfaccion is not null then raise exception 'Ya contestaste la encuesta de este servicio. ¡Gracias!'; end if;
  if p_calificacion not between 1 and 5 then raise exception 'Elige de 1 a 5 estrellas'; end if;
  update public.ordenes set satisfaccion = p_calificacion,
    encuesta_comentario = left(nullif(trim(p_comentario), ''), 1000), encuesta_fecha = now()
  where id = p_orden;
  return jsonb_build_object('ok', true);
end $$;

/** Registrar el celular del cliente para avisos */
create or replace function public.cliente_push_registrar(p_token uuid, p_endpoint text, p_p256dh text, p_auth text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.cliente_accesos;
begin
  select * into a from public.cliente_accesos where token = p_token and expira > now();
  if not found then raise exception 'SESION_VENCIDA'; end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 then raise exception 'Suscripción inválida'; end if;
  delete from public.cliente_push where endpoint = p_endpoint;
  insert into public.cliente_push (token, vehiculo_id, endpoint, p256dh, auth) values (p_token, a.vehiculo_id, p_endpoint, p_p256dh, p_auth);
  return jsonb_build_object('ok', true);
end $$;
create or replace function public.cliente_push_quitar(p_token uuid, p_endpoint text) returns jsonb
language sql security definer set search_path = '' as $$
  delete from public.cliente_push where token = p_token and endpoint = p_endpoint returning jsonb_build_object('ok', true)
$$;
create or replace function public.cliente_salir(p_token uuid) returns void
language sql security definer set search_path = '' as $$ delete from public.cliente_accesos where token = p_token $$;

revoke execute on function public.cliente_entrar(text, text), public.cliente_datos(uuid), public.cliente_encuesta(uuid, bigint, int, text),
  public.cliente_push_registrar(uuid, text, text, text), public.cliente_push_quitar(uuid, text), public.cliente_salir(uuid) from public;
grant execute on function public.cliente_entrar(text, text), public.cliente_datos(uuid), public.cliente_encuesta(uuid, bigint, int, text),
  public.cliente_push_registrar(uuid, text, text, text), public.cliente_push_quitar(uuid, text), public.cliente_salir(uuid) to anon, authenticated;

-- Aviso al cliente cuando su vehículo queda listo y cuando se entrega (invitación a la encuesta)
create or replace function public.fn_push_orden_cliente() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_tipo text; v_secreto text;
begin
  if new.etapa is not distinct from old.etapa then return new; end if;
  if new.etapa = 'listo_entrega' then v_tipo := 'cliente_listo';
  elsif new.etapa = 'entregado' then v_tipo := 'cliente_encuesta';
  else return new; end if;
  if not exists (select 1 from public.cliente_push p where p.vehiculo_id = new.vehiculo_id) then return new; end if;
  select decrypted_secret into v_secreto from vault.decrypted_secrets where name = 'push_webhook';
  if v_secreto is null then return new; end if;
  perform net.http_post(
    url := 'https://avzpgberhkiyyhszsymj.supabase.co/functions/v1/notificar-push',
    body := jsonb_build_object('tipo', v_tipo, 'orden_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secreto));
  return new;
exception when others then return new;
end $$;
revoke execute on function public.fn_push_orden_cliente() from public, anon, authenticated;
create trigger trg_push_orden_cliente after update of etapa on public.ordenes
  for each row execute function public.fn_push_orden_cliente();
