-- App de técnicos: cada técnico puede consultar SOLO sus propios destajos
-- (además de quien ya tiene el permiso destajos.ver). No da acceso a destajos de otros
-- ni permite modificarlos.
drop policy if exists propios on public.destajos;
create policy propios on public.destajos for select to authenticated
  using ((select public.es_activo()) and tecnico_id in (select t.id from public.tecnicos t where t.perfil_id = (select auth.uid())));
