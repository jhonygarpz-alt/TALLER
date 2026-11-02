alter table public.fotos drop constraint fotos_categoria_check;
alter table public.fotos add constraint fotos_categoria_check check (categoria in ('recepcion','diagnostico','dano','actividad','entrega','conformidad','pieza_retirada','proceso','factura'));
