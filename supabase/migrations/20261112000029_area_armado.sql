-- Proceso de ARMADO como área de trabajo (técnicos, tarifas de destajo, trabajos, presupuesto y daños)
alter type public.area_trabajo add value if not exists 'armado' after 'pintura';

-- Reporte mensual: los destajos de armado se suman a la columna de hojalatero (antes no existía el área)
do $$
declare def text;
begin
  def := pg_get_functiondef('public.reporte_mensual'::regproc);
  if position('''otros'', ''armado''' in def) = 0 then
    def := replace(def, 'in (''hojalateria'', ''mecanica'', ''otros'')', 'in (''hojalateria'', ''mecanica'', ''otros'', ''armado'')');
    execute def;
  end if;
end $$;
