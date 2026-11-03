-- Notificaciones push (Web Push) para la app de técnicos.
-- Las llaves VAPID y el secreto del webhook viven en Supabase Vault (no en el código):
--   vapid_privada, vapid_publica, push_webhook
create extension if not exists pg_net;

-- Celulares/navegadores que aceptaron recibir avisos
create table public.push_suscripciones (
  id         bigint generated always as identity primary key,
  perfil_id  uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  app        text not null default 'tecnicos' check (app in ('tecnicos', 'movil')),
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table public.push_suscripciones enable row level security;
revoke all on public.push_suscripciones from anon;
create policy propias_ver on public.push_suscripciones for select to authenticated using (perfil_id = (select auth.uid()));
create policy propias_alta on public.push_suscripciones for insert to authenticated with check (perfil_id = (select auth.uid()) and (select public.es_activo()));
create policy propias_cambio on public.push_suscripciones for update to authenticated using (perfil_id = (select auth.uid())) with check (perfil_id = (select auth.uid()));
create policy propias_baja on public.push_suscripciones for delete to authenticated using (perfil_id = (select auth.uid()));

-- Bitácora de envíos (para revisar que los avisos salieron)
create table public.push_envios (
  id           bigint generated always as identity primary key,
  fecha        timestamptz not null default now(),
  tipo         text not null,
  actividad_id bigint,
  perfil_id    uuid,
  enviados     int not null default 0,
  fallidos     int not null default 0,
  detalle      text
);
alter table public.push_envios enable row level security;
revoke all on public.push_envios from anon;
create policy lectura on public.push_envios for select to authenticated using ((select public.puede('actividades.asignar')) or perfil_id = (select auth.uid()));

-- Configuración para la función del servidor (solo service_role)
create or replace function public.push_config() returns jsonb
language sql security definer set search_path = '' as $$
  select jsonb_object_agg(name, decrypted_secret) from vault.decrypted_secrets where name in ('vapid_privada', 'vapid_publica', 'push_webhook')
$$;
revoke execute on function public.push_config() from public, anon, authenticated;
grant execute on function public.push_config() to service_role;

-- Disparador: al asignar (o reasignar) un trabajo, o al pedir retrabajo, avisa al técnico
create or replace function public.fn_push_actividad() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_tipo text; v_secreto text;
begin
  if tg_op = 'INSERT' then v_tipo := 'asignado';
  elsif new.tecnico_id is distinct from old.tecnico_id and new.estado in ('asignada', 'en_proceso') then v_tipo := 'asignado';
  elsif new.rechazos > old.rechazos then v_tipo := 'retrabajo';
  else return new;
  end if;
  -- solo si el técnico tiene usuario ligado
  if not exists (select 1 from public.tecnicos t where t.id = new.tecnico_id and t.perfil_id is not null) then return new; end if;
  select decrypted_secret into v_secreto from vault.decrypted_secrets where name = 'push_webhook';
  if v_secreto is null then return new; end if;
  perform net.http_post(
    url := 'https://avzpgberhkiyyhszsymj.supabase.co/functions/v1/notificar-push',
    body := jsonb_build_object('tipo', v_tipo, 'actividad_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secreto)
  );
  return new;
exception when others then
  return new; -- un aviso fallido nunca debe impedir asignar el trabajo
end $$;
revoke execute on function public.fn_push_actividad() from public, anon, authenticated;
create trigger trg_push_actividad after insert or update of tecnico_id, rechazos on public.actividades
  for each row execute function public.fn_push_actividad();
