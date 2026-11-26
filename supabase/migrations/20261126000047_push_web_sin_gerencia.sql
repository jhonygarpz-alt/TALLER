-- 1) perfiles.sin_gerencia: usuario sin acceso a la app de Gerencia (conserva rol y demás apps). Jazmín = true.
--    gerencia_tablero y gerencia_serie rechazan a esos usuarios; se borraron sus suscripciones app='gerencia'.
-- 2) push_suscripciones.app admite 'web' (notificaciones del sistema web en la computadora).
--    fn_push_gerencia, fn_push_gerencia_actividad y push_gerencia_resumen disparan si hay suscripciones 'gerencia' o 'web'.
-- Aplicado vía MCP (migraciones perfiles_sin_gerencia y push_web_sistema).
alter table public.perfiles add column if not exists sin_gerencia boolean not null default false;
alter table public.push_suscripciones drop constraint push_suscripciones_app_check;
alter table public.push_suscripciones add constraint push_suscripciones_app_check check (app = any (array['tecnicos','movil','gerencia','web']));
