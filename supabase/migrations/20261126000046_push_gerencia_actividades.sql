-- Avisos push a la app de gerencia cuando se asigna un trabajo y cuando un técnico lo termina.
-- Trigger nuevo (no modifica fn_push_actividad ni fn_push_gerencia). Aplicado vía MCP.
create or replace function public.fn_push_gerencia_actividad()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare v_tipo text; v_secreto text;
begin
  if tg_op = 'INSERT' then
    if new.tecnico_id is null and new.proveedor_id is null then return new; end if;
    v_tipo := 'gerencia_asignacion';
  elsif new.tecnico_id is not null and new.tecnico_id is distinct from old.tecnico_id and new.estado in ('asignada','en_proceso') then
    v_tipo := 'gerencia_asignacion';
  elsif new.estado = 'terminada' and old.estado not in ('terminada','validada') then
    v_tipo := 'gerencia_trabajo';
  else return new;
  end if;
  if not exists (select 1 from public.push_suscripciones where app = 'gerencia') then return new; end if;
  select decrypted_secret into v_secreto from vault.decrypted_secrets where name = 'push_webhook';
  if v_secreto is null then return new; end if;
  perform net.http_post(
    url := 'https://avzpgberhkiyyhszsymj.supabase.co/functions/v1/notificar-push',
    body := jsonb_build_object('tipo', v_tipo, 'actividad_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secreto));
  return new;
exception when others then
  return new;
end $function$;
revoke execute on function public.fn_push_gerencia_actividad() from public, anon, authenticated;
create trigger trg_push_gerencia_actividad after insert or update of tecnico_id, estado on public.actividades
for each row execute function public.fn_push_gerencia_actividad();
