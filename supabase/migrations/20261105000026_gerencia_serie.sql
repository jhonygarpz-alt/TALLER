-- Serie de ingresos vs entregas para la gráfica "Rendimiento del periodo" (Semana / Mes / Año)
create or replace function public.gerencia_serie(p_rango text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  tz constant text := 'America/Mexico_City';
  hoy date := (now() at time zone tz)::date;
  r jsonb;
begin
  perform public._exigir('reportes.ver');
  if p_rango not in ('semana', 'mes', 'anio') then raise exception 'Rango no válido'; end if;
  with o as (
    select (fecha_ingreso at time zone tz)::date fi, case when etapa = 'entregado' then (fecha_entrega at time zone tz)::date end fe
    from public.ordenes where etapa <> 'cancelado'
  ), cubetas as (
    select g::date ini, case when p_rango = 'anio' then (g + interval '1 month' - interval '1 day')::date else g::date end fin
    from generate_series(
      case p_rango when 'semana' then hoy - 6 when 'mes' then hoy - 29 else (date_trunc('month', hoy) - interval '11 months')::date end,
      case when p_rango = 'anio' then date_trunc('month', hoy)::date else hoy end,
      case when p_rango = 'anio' then interval '1 month' else interval '1 day' end) g
  )
  select jsonb_agg(jsonb_build_object('d', ini,
           'ingresos', (select count(*) from o where fi between ini and fin),
           'entregas', (select count(*) from o where fe between ini and fin)) order by ini)
  into r from cubetas;
  return r;
end $$;
revoke execute on function public.gerencia_serie(text) from public, anon;
grant execute on function public.gerencia_serie(text) to authenticated;
