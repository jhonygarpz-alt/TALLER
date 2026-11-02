alter type public.etapa_orden add value if not exists 'recepcion' before 'diagnostico';
alter type public.etapa_orden add value if not exists 'preparacion' before 'pintura';
alter type public.tipo_material add value if not exists 'herramienta';
