-- Un mismo siniestro puede tener varias asignaciones (varios vehículos): se quita la restricción única.
alter table public.asignaciones drop constraint if exists asignaciones_aseguradora_id_siniestro_key;
create index if not exists asignaciones_siniestro_idx on public.asignaciones (aseguradora_id, siniestro);
