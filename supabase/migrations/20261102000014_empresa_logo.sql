-- Datos de la empresa (un solo registro) y logo en un bucket público de solo lectura
create table public.empresa (
  id          int primary key default 1 check (id = 1),
  nombre      text not null default 'Admin Taller',
  logo_path   text,
  updated_at  timestamptz not null default now()
);
insert into public.empresa (id) values (1);

alter table public.empresa enable row level security;
create policy lectura on public.empresa for select to anon, authenticated using (true);
create policy cambio on public.empresa for update to authenticated
  using ((select public.puede('config.gestionar'))) with check ((select public.puede('config.gestionar')));
create trigger trg_auditar after insert or update or delete on public.empresa for each row execute function public.fn_auditar();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marca', 'marca', true, 2097152, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do nothing;

create policy "marca_alta" on storage.objects for insert to authenticated
  with check (bucket_id = 'marca' and (select public.puede('config.gestionar')));
create policy "marca_cambio" on storage.objects for update to authenticated
  using (bucket_id = 'marca' and (select public.puede('config.gestionar')));
create policy "marca_baja" on storage.objects for delete to authenticated
  using (bucket_id = 'marca' and (select public.puede('config.gestionar')));
