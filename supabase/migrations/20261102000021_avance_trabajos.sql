-- Avance de trabajos reportado por hojalateros y pintores desde la app de técnicos.
-- Cada reporte guarda porcentaje, nota y (opcional) la foto de evidencia del avance.
create table public.actividad_avances (
  id           bigint generated always as identity primary key,
  actividad_id bigint not null references public.actividades(id) on delete cascade,
  porcentaje   int not null check (porcentaje between 0 and 100),
  nota         text,
  foto_id      bigint references public.fotos(id) on delete set null,
  usuario_id   uuid default auth.uid() references public.perfiles(id),
  created_at   timestamptz not null default now()
);
create index on public.actividad_avances (actividad_id, created_at desc);

alter table public.actividad_avances enable row level security;
revoke all on public.actividad_avances from anon;
create policy lectura on public.actividad_avances for select to authenticated using ((select public.es_activo()));
-- Registra avance el técnico dueño del trabajo (o quien asigna trabajos), solo si el trabajo sigue abierto
create policy alta on public.actividad_avances for insert to authenticated with check (
  (select public.es_activo()) and exists (
    select 1 from public.actividades a
    where a.id = actividad_id and a.estado in ('asignada', 'en_proceso')
      and (exists (select 1 from public.tecnicos t where t.id = a.tecnico_id and t.perfil_id = (select auth.uid()))
           or (select public.puede('actividades.asignar')))
  )
);

create trigger trg_auditar after insert or update or delete on public.actividad_avances
  for each row execute function public.fn_auditar();

-- El avance también marca la orden como actualizada (alertas de "sin actualización")
create or replace function public.fn_avance_tocar_orden() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.ordenes o set ultima_actualizacion = now()
    from public.actividades a where a.id = new.actividad_id and o.id = a.orden_id and o.etapa not in ('entregado', 'cancelado');
  return new;
end $$;
revoke execute on function public.fn_avance_tocar_orden() from public, anon, authenticated;
create trigger trg_avance_tocar_orden after insert on public.actividad_avances
  for each row execute function public.fn_avance_tocar_orden();

-- Último avance por trabajo (para barras de progreso en el sistema web y las apps)
create view public.v_avance_actual with (security_invoker = true) as
select distinct on (actividad_id) actividad_id, porcentaje, nota, created_at
from public.actividad_avances order by actividad_id, created_at desc;
