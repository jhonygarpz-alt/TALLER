-- App de Gerencia: tablero de indicadores (datos reales) y avisos push para dirección/gerencia.
-- Acceso: permiso reportes.ver; los montos solo con finanzas.ver.

-- 1) Indicadores. Función interna (sin revisión de permisos) usada por el tablero y por el resumen diario.
create or replace function public._gerencia_datos(p_desde date, p_hasta date, p_finanzas boolean)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  tz constant text := 'America/Mexico_City';
  hoy date := (now() at time zone tz)::date;
  v_serie_desde date := least(p_desde, p_hasta - 6);
  r jsonb;
begin
  with o as (
    select v.*, (v.fecha_ingreso at time zone tz)::date fi, (v.fecha_entrega at time zone tz)::date fe
    from public.v_ordenes v where v.etapa <> 'cancelado'
  ),
  act as (select * from o where etapa <> 'entregado'),
  ing as (select * from o where fi between p_desde and p_hasta),
  ent as (select * from o where etapa = 'entregado' and fe between p_desde and p_hasta)
  select jsonb_build_object(
    'hoy', hoy, 'desde', p_desde, 'hasta', p_hasta, 'actualizado', now(),
    'dia', jsonb_build_object(
      'ingresos', (select count(*) from o where fi = hoy),
      'entregas', (select count(*) from o where etapa = 'entregado' and fe = hoy),
      'en_taller', (select count(*) from act),
      'listos', (select count(*) from act where etapa = 'listo_entrega'),
      'retrasados', (select count(*) from act where retrasado),
      'detenidos', (select count(*) from act where detenido_material),
      'por_autorizar', (select count(*) from act where etapa = 'esperando_autorizacion'),
      'asignaciones_pendientes', (select count(*) from public.asignaciones where estatus not in ('ingresado', 'cancelada')),
      'compromiso_hoy', (select count(*) from act where fecha_compromiso = hoy)
    ),
    'periodo', jsonb_build_object(
      'ingresos', (select count(*) from ing),
      'ingresos_aseguradora', (select count(*) from ing where tipo = 'aseguradora'),
      'ingresos_particular', (select count(*) from ing where tipo = 'particular'),
      'entregas', (select count(*) from ent),
      'a_tiempo', (select count(*) from ent where entregado_a_tiempo),
      'con_compromiso', (select count(*) from ent where fecha_compromiso is not null),
      'dias_promedio', (select round(avg(fe - fi)::numeric, 1) from ent),
      'satisfaccion', (select round(avg(satisfaccion)::numeric, 2) from o where satisfaccion is not null and (encuesta_fecha at time zone tz)::date between p_desde and p_hasta),
      'encuestas', (select count(*) from o where satisfaccion is not null and (encuesta_fecha at time zone tz)::date between p_desde and p_hasta),
      'trabajos_terminados', (select count(*) from public.actividades a where a.estado in ('terminada', 'validada') and (a.fecha_fin at time zone tz)::date between p_desde and p_hasta),
      'retrabajos', (select coalesce(sum(a.rechazos), 0) from public.actividades a where (a.fecha_fin at time zone tz)::date between p_desde and p_hasta)
    ),
    'serie', (select jsonb_agg(jsonb_build_object('d', d,
                 'ingresos', (select count(*) from o where fi = d),
                 'entregas', (select count(*) from o where etapa = 'entregado' and fe = d)) order by d)
              from generate_series(v_serie_desde, p_hasta, interval '1 day') g(dd), lateral (select dd::date d) x),
    'etapas', (select coalesce(jsonb_object_agg(etapa, n), '{}') from (select etapa::text, count(*) n from act group by etapa) e),
    'marcas', (select coalesce(jsonb_agg(jsonb_build_object('marca', marca, 'n', n) order by n desc, marca), '[]') from
                (select upper(marca) marca, count(*) n from ing group by upper(marca) order by n desc, marca limit 6) m),
    'tecnicos', (select coalesce(jsonb_agg(jsonb_build_object('nombre', nombre, 'area', area, 'terminados', terminados, 'en_proceso', en_proceso) order by terminados desc, en_proceso desc), '[]') from (
                  select t.nombre, t.area::text area,
                    count(*) filter (where a.estado in ('terminada', 'validada') and (a.fecha_fin at time zone tz)::date between p_desde and p_hasta) terminados,
                    count(*) filter (where a.estado in ('asignada', 'en_proceso')) en_proceso
                  from public.tecnicos t join public.actividades a on a.tecnico_id = t.id
                  where t.activo group by t.nombre, t.area
                  having count(*) filter (where a.estado in ('terminada', 'validada') and (a.fecha_fin at time zone tz)::date between p_desde and p_hasta) > 0
                      or count(*) filter (where a.estado in ('asignada', 'en_proceso')) > 0
                  order by 3 desc, 4 desc limit 8) t),
    'alertas', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'folio', folio, 'auto', concat_ws(' ', marca, modelo), 'placas', placas, 'etapa', etapa,
                   'dias', dias_en_taller, 'compromiso', fecha_compromiso, 'detenido', detenido_material, 'tipo', tipo) order by fecha_compromiso nulls last), '[]') from
                (select * from act where retrasado or detenido_material order by fecha_compromiso nulls last limit 8) a),
    'recientes', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'folio', folio, 'auto', concat_ws(' ', marca, modelo), 'placas', placas, 'tipo', tipo,
                   'aseguradora', aseguradora_nombre, 'fecha', fecha_ingreso, 'etapa', etapa) order by fecha_ingreso desc), '[]') from
                (select * from o order by fecha_ingreso desc limit 6) r),
    'finanzas', case when p_finanzas then (
      select jsonb_build_object(
        'ingreso', coalesce(sum(r.ingreso_reconocido), 0), 'costos', coalesce(sum(r.costos_directos), 0),
        'utilidad_bruta', coalesce(sum(r.utilidad_bruta), 0), 'utilidad', coalesce(sum(r.utilidad_estimada), 0),
        'materiales', coalesce(sum(r.costo_pintura + r.costo_materiales + r.costo_refacciones), 0),
        'mano_obra', coalesce(sum(r.costo_destajos + r.costo_mano_obra_adicional), 0),
        'externos', coalesce(sum(r.costo_servicios_externos + r.costo_otros), 0),
        'ordenes', count(*),
        'facturado', (select coalesce(sum(monto), 0) from public.facturas where not cancelada and fecha between p_desde and p_hasta),
        'cobrado', (select coalesce(sum(monto), 0) from public.cobros where fecha between p_desde and p_hasta),
        'por_cobrar', (select coalesce(sum(saldo), 0) from public.v_cuentas_cobrar where not cancelada and saldo > 0),
        'vencido', (select coalesce(sum(saldo), 0) from public.v_cuentas_cobrar where not cancelada and saldo > 0 and dias_vencido > 0),
        'destajos_pendientes', (select coalesce(sum(importe), 0) from public.destajos where estado in ('pendiente', 'autorizado'))
      ) from public.v_rentabilidad r where r.etapa = 'entregado' and (r.fecha_entrega at time zone tz)::date between p_desde and p_hasta
    ) end
  ) into r;
  return r;
end $$;
revoke execute on function public._gerencia_datos(date, date, boolean) from public, anon, authenticated;
grant execute on function public._gerencia_datos(date, date, boolean) to service_role;

-- Tablero para la app (con permisos)
create or replace function public.gerencia_tablero(p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._exigir('reportes.ver');
  if p_desde is null or p_hasta is null or p_hasta < p_desde or p_hasta - p_desde > 370 then
    raise exception 'Periodo no válido';
  end if;
  return public._gerencia_datos(p_desde, p_hasta, public.puede('finanzas.ver'));
end $$;
revoke execute on function public.gerencia_tablero(date, date) from public, anon;
grant execute on function public.gerencia_tablero(date, date) to authenticated;

-- 2) Suscripciones push de la app de gerencia, con elección de avisos (null = todos)
alter table public.push_suscripciones drop constraint push_suscripciones_app_check;
alter table public.push_suscripciones add constraint push_suscripciones_app_check check (app in ('tecnicos', 'movil', 'gerencia'));
alter table public.push_suscripciones add column if not exists avisos text[];

-- 3) Avisos a gerencia: ingreso de vehículo, entrega y encuesta con calificación baja
create or replace function public.fn_push_gerencia() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_tipo text; v_secreto text;
begin
  if tg_op = 'INSERT' then v_tipo := 'gerencia_ingreso';
  elsif new.etapa = 'entregado' and old.etapa is distinct from 'entregado' then v_tipo := 'gerencia_entrega';
  elsif new.satisfaccion is not null and old.satisfaccion is null and new.satisfaccion <= 3 then v_tipo := 'gerencia_encuesta';
  else return new;
  end if;
  if not exists (select 1 from public.push_suscripciones where app = 'gerencia') then return new; end if;
  select decrypted_secret into v_secreto from vault.decrypted_secrets where name = 'push_webhook';
  if v_secreto is null then return new; end if;
  perform net.http_post(
    url := 'https://avzpgberhkiyyhszsymj.supabase.co/functions/v1/notificar-push',
    body := jsonb_build_object('tipo', v_tipo, 'orden_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secreto));
  return new;
exception when others then
  return new; -- un aviso fallido nunca debe impedir registrar la orden
end $$;
revoke execute on function public.fn_push_gerencia() from public, anon, authenticated;
create trigger trg_push_gerencia after insert or update of etapa, satisfaccion on public.ordenes
  for each row execute function public.fn_push_gerencia();

-- 4) Resumen diario a las 19:10 (hora del centro de México = 01:10 UTC)
create extension if not exists pg_cron;
create or replace function public.push_gerencia_resumen() returns void
language plpgsql security definer set search_path = '' as $$
declare v_secreto text;
begin
  if not exists (select 1 from public.push_suscripciones where app = 'gerencia') then return; end if;
  select decrypted_secret into v_secreto from vault.decrypted_secrets where name = 'push_webhook';
  if v_secreto is null then return; end if;
  perform net.http_post(
    url := 'https://avzpgberhkiyyhszsymj.supabase.co/functions/v1/notificar-push',
    body := jsonb_build_object('tipo', 'gerencia_resumen'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secreto));
end $$;
revoke execute on function public.push_gerencia_resumen() from public, anon, authenticated;
select cron.schedule('gerencia-resumen-diario', '10 1 * * *', 'select public.push_gerencia_resumen()');
