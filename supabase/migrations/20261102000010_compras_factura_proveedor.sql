-- Compras recibidas: permitir capturar solo los datos de la factura del proveedor
create or replace function public.fn_compra_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if not public.en_proceso() then new.estado := 'requisicion'; new.autorizado_por := null; new.autorizado_at := null; new.recibido_at := null; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if old.estado not in ('requisicion','cancelada') then raise exception 'Solo se eliminan requisiciones no enviadas'; end if;
    return old;
  end if;
  if public.en_proceso() then return new; end if;
  if new.estado is distinct from old.estado then
    raise exception 'El estado de la compra cambia solo mediante sus botones';
  end if;
  if old.estado = 'recibida' then
    if (to_jsonb(new) - array['factura','factura_monto','factura_fecha','archivo_path'])
       <> (to_jsonb(old) - array['factura','factura_monto','factura_fecha','archivo_path']) then
      raise exception 'Una compra recibida solo admite capturar los datos de la factura del proveedor';
    end if;
  elsif old.estado = 'cancelada' then
    raise exception 'Una compra cancelada no se modifica';
  end if;
  return new;
end $$;
