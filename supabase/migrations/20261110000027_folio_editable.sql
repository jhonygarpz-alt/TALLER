-- Folio de orden capturable y editable.
-- 1) El consecutivo automático salta los folios que ya existan (por si alguien capturó uno a mano),
--    así nunca choca con la restricción UNIQUE(folio).
create or replace function public.siguiente_folio() returns text
language plpgsql volatile set search_path = '' as $$
declare f text;
begin
  loop
    f := 'OT-' || lpad(nextval('public.folio_ot')::text, 5, '0');
    exit when not exists (select 1 from public.ordenes where folio = f);
  end loop;
  return f;
end $$;
alter table public.ordenes alter column folio set default public.siguiente_folio();

-- 2) Folio capturado: se guarda sin espacios sobrantes y en mayúsculas; vacío → consecutivo automático
create or replace function public.fn_orden_folio() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.folio := upper(btrim(coalesce(new.folio, '')));
  if new.folio = '' then
    if tg_op = 'INSERT' then new.folio := public.siguiente_folio();
    else raise exception 'El folio no puede quedar vacío';
    end if;
  end if;
  if length(new.folio) > 30 then raise exception 'El folio no puede tener más de 30 caracteres'; end if;
  return new;
end $$;
revoke execute on function public.fn_orden_folio() from public, anon, authenticated;
create trigger trg_orden_folio before insert or update of folio on public.ordenes
  for each row execute function public.fn_orden_folio();
