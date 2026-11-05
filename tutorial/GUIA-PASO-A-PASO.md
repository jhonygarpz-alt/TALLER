# ADMIN TALLER — Guía paso a paso

Liga: https://jhonygarpz-alt.github.io/TALLER/

## 0. Primera vez (Dirección)
1. **Administración → Usuarios**: da de alta a cada persona con su rol (administración, supervisor, compras, asesor, técnico).
2. **Administración → Empresa y logo**: nombre del taller y logotipo.
3. **Mano de obra y destajos → Técnicos y tarifas**: registra técnicos y su tarifa de destajo.
4. **Inventario → Existencias → Nuevo material**: da de alta materiales (elige unidad: pieza, litro, galón, kg…) y captura la existencia inicial con **Ajustar**.
5. **Compras → Proveedores**: registra tus proveedores.

## 1. Llega un vehículo (Asesor)
**Órdenes de trabajo → Nueva orden** (4 pasos):
1. **Origen**: Aseguradora (MAPFRE + número de siniestro) o Particular; tipo de reparación y fecha compromiso.
2. **Propietario y vehículo**: escribe las placas y da **Buscar** (si ya vino, se llenan solos los datos). Si no, captura marca, modelo, propietario.
3. **Condiciones de ingreso**: kilometraje, combustible, daños reportados y objetos.
4. **Fotografías**: fotos de ingreso → **Crear orden de trabajo** (el folio OT-xxxxx se asigna solo).

## 2. Diagnóstico y presupuesto (Asesor / Supervisor)
Abre la orden (expediente):
- **Diagnóstico y fotos**: fotos y descripción de daños.
- **Presupuesto y autorizaciones**: partidas de mano de obra, refacciones y pintura; registra la autorización de MAPFRE o del cliente.

## 3. Reparación (Supervisor / Técnicos)
- Expediente → **Trabajos y avance** → **Asignar trabajo** a un técnico.
- El técnico termina y sube evidencia; el supervisor **valida** → se genera su destajo.
- **Procesos del taller**: tablero por etapa; mueve el auto de etapa (hojalatería → preparación → pintura → detallado → control de calidad).

## 4. Material (Técnico / Almacén / Compras)
- Expediente → **Materiales y compras** → **Solicitar material**.
- **Inventario → Solicitudes y salidas**: se autoriza y almacén entrega (descuenta existencia y carga el costo a la orden).
- Si falta: **Compras** → orden de compra → al **recibir** con factura sube la existencia.

## 5. Entrega (Asesor)
Expediente → **Entrega y cierre**: después de control de calidad, registra la entrega al cliente.

## 6. Cobro (Administración)
**Facturación y cobranza**: registra la factura y los pagos; **Cuentas por cobrar** muestra saldos vencidos.

## 7. Pago de destajos (Administración)
**Mano de obra y destajos → Destajos**: paga los destajos validados (el sistema no permite pagarlos dos veces).

## 8. Seguimiento (Dirección)
- **Dashboard**: resumen y alertas.
- **Costos y rentabilidad**: utilidad por orden, presupuesto vs. real.
- **Reportes y KPIs**: indicadores y descargas a Excel.
- **Calendario**: entregas, citas y llamadas.
- **Administración → Auditoría**: quién cambió qué.
- **App de Gerencia** (celular, `…/TALLER/gerencia/`, QR en `QR_app_gerencia.png`): ingresos y entregas del día, unidades en taller por etapa, cumplimiento, satisfacción, productividad y rentabilidad. En *Ajustes* activa los avisos push: ingreso, entrega, calificación baja y resumen diario (7:10 p. m.).

## Corregir errores
- **Editar** orden: botón Editar en el expediente.
- **Revertir**: Anular trabajo, Cancelar destajo, Devolver material, Eliminar costos/cobros (se pide motivo y queda en Auditoría).
- **Eliminar** orden: solo cuando no tiene movimientos; el sistema indica qué revertir antes.
