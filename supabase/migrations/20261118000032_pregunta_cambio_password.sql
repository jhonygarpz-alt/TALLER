-- Al primer acceso se pregunta al usuario si desea cambiar su contraseña inicial. Solo agrega.
alter table public.perfiles add column if not exists cambiar_password boolean not null default false;
create or replace function public.password_revisado()
 returns void language sql security definer set search_path to '' as $$
  update public.perfiles set cambiar_password = false where id = auth.uid();
$$;
revoke all on function public.password_revisado() from public, anon;
grant execute on function public.password_revisado() to authenticated;
-- Las cuentas del personal se dieron de alta desde Supabase (no se versionan contraseñas en el repositorio).
