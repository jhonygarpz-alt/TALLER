# Carga de la bitácora mensual (Excel → sistema)

1. `python3 generar_json.py PROYECTO_BITACORA.xlsx salida.json`
   - Toma la hoja "Registro Autos Legaria 2025" y los registros con asignación, ingreso o entrega en el mes
     (para otro mes, cambia la función `oct26`).
   - Normaliza marca/modelo/color, técnicos e importes, y muestra avisos de datos incompletos.
2. Llamar con un usuario de **Dirección** a la función `importar_bitacora(p_registros, p_prueba, p_referencia)`:
   - `p_prueba = true` valida y deshace todo (devuelve el resumen en el mensaje).
   - `p_prueba = false` carga de verdad. Omite órdenes cuyo número de OS ya existe.
   - Si se usó `p_prueba = true`, restablecer el contador de folios antes de cargar:
     `select setval('public.folio_ot', (select coalesce(max(substring(folio from 4)::int),0) from public.ordenes));`

Destajos de órdenes entregadas se registran como **pagados** (referencia = `p_referencia`).
No se cargan fotografías: deben subirse las reales de cada vehículo.
