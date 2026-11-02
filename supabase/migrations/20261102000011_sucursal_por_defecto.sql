-- Toda orden queda ligada a una sucursal (la primera activa si no se indica)
create or replace function public.fn_orden_sucursal()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.sucursal_id is null then
    select id into new.sucursal_id from public.sucursales where activo order by id limit 1;
  end if;
  return new;
end $$;
create trigger trg_orden_sucursal before insert on public.ordenes for each row execute function public.fn_orden_sucursal();
revoke execute on function public.fn_orden_sucursal() from public, anon, authenticated;
update public.ordenes set sucursal_id = (select id from public.sucursales where activo order by id limit 1) where sucursal_id is null;
