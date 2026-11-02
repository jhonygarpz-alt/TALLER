alter table public.clientes add column if not exists direccion text, add column if not exists notas text,
  add column if not exists tipo text not null default 'persona' check (tipo in ('persona','empresa'));
alter table public.vehiculos add column if not exists notas text;
create trigger trg_auditar after insert or update or delete on public.clientes for each row execute function public.fn_auditar();
create trigger trg_auditar after insert or update or delete on public.vehiculos for each row execute function public.fn_auditar();
