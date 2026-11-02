# TallerPro · Control de Taller

Sistema web para administrar un taller de hojalatería, pintura y mecánica que trabaja con **MAPFRE** y con clientes **particulares**. Todo gira alrededor de la **orden de trabajo**: cada costo, destajo, material, fotografía y cobro está ligado a una orden (o a un centro de costo general autorizado).

## Módulos (menú lateral)

| Módulo | Qué hace |
|---|---|
| **Dashboard** | 12 indicadores interactivos (asignados, en taller, diagnóstico, reparación, hojalatería, pintura, listos, entregas programadas, retrasados, trabajos pendientes…), estado de vehículos, órdenes por aseguradora, resumen financiero, alertas y accesos rápidos. |
| **Clientes y aseguradoras** | Clientes con datos fiscales (preparados para CFDI 4.0) y días de crédito · Aseguradoras con convenio, crédito, plazo de contacto y plazos de reparación configurables (solo MAPFRE habilitada) · Padrón de vehículos con historial · Llamadas, mensajes y citas · Encuestas de satisfacción · Estado de cuenta por cliente. |
| **Órdenes de trabajo** | Asignaciones de aseguradora con historial de contacto · Recepción en 4 pasos (folio automático, fotos, checklist, fecha compromiso) · Expediente con 7 pestañas: general, diagnóstico y fotos, presupuesto y autorizaciones (ampliaciones), trabajos, materiales, costos y destajos, entrega y cierre. |
| **Procesos del taller** | Tablero Kanban de 11 etapas (Recepción → Entregado, incluye Preparación); desde cada tarjeta se cambia la etapa y se suben evidencias. |
| **Inventario** | Existencias, mínimos y costo promedio · Solicitudes y salidas ligadas a orden o centro de costo · Control de pintura · Movimientos. |
| **Compras** | Requisiciones, cotizaciones comparativas, autorización, recepción (entra al inventario), factura del proveedor con documento · Historial de precios con alertas de aumento. |
| **Mano de obra y destajos** | Trabajos por técnico con evidencia y validación · Destajos (autorizar / pagar, separados aseguradora vs particular) · Productividad · Técnicos (especialidad) y tarifas. |
| **Calendario** | Vista día / semana / mes con citas, fechas compromiso, entregas, trabajos programados y asignaciones · Carga por técnico · Trabajos vencidos y vehículos detenidos por material. |
| **Costos y rentabilidad** | Utilidad por orden (bruta y después de indirectos) · Presupuesto vs costo real con alertas de margen negativo y consumo excesivo · Indicadores financieros y punto de equilibrio. |
| **Facturación y cobranza** | Pendientes de facturar · Facturas con PDF/XML y vencimiento automático · Pagos · Antigüedad de saldos · Estados de cuenta. **CFDI 4.0: estructura preparada, timbrado pendiente.** |
| **Reportes y KPIs** | 15 reportes descargables a Excel (CSV) e impresión a PDF · KPIs de aseguradora contra objetivos. |
| **Administración** | Usuarios (alta y contraseñas), permisos por rol, catálogos (sucursales, motivos de retraso, áreas), técnicos y tarifas, proveedores, parámetros e indicadores, auditoría. |

## Reglas que se validan en la base de datos (no solo en pantalla)

- Una orden no pasa a reparación/hojalatería/pintura/… sin **presupuesto autorizado**, ni a “Listo para entrega” con trabajos sin validar, salvo **excepción autorizada con justificación** (queda en el historial).
- Presupuestos autorizados no se modifican: los cambios se hacen como **ampliación**.
- Un trabajo **solo genera destajo al ser validado** por el supervisor, después de que el técnico lo termina con **foto de evidencia**. Un trabajo = un destajo (restricción única). Solo se pagan destajos **autorizados**; un destajo pagado no se vuelve a pagar.
- La existencia y el costo promedio de materiales **solo cambian** por recepciones de compra, entregas autorizadas o ajustes con motivo. No se puede entregar más de lo que hay.
- Toda salida de material va a una **orden** o a un **centro de costo** general. Los costos no se mueven entre órdenes sin transferencia autorizada, y nunca entre aseguradora y particular.
- Órdenes entregadas o canceladas quedan cerradas (solo admite la encuesta). Las fotografías no se pueden modificar; solo Dirección puede eliminarlas.
- **Auditoría** automática (usuario, fecha, valores anteriores y nuevos) en órdenes, presupuestos, trabajos, destajos, materiales, solicitudes, compras, costos, facturas, cobros, tarifas, usuarios y permisos.
- Permisos por rol (Dirección, Administración/Valuación, Supervisor, Compras y almacén, Asesor, Técnico) aplicados con **Row Level Security**; ajustables desde Configuración sin tocar código.

## Tecnología

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS 4 (`app/`)
- **Backend:** Supabase (PostgreSQL, Auth, Storage privado `evidencias`) — esquema y reglas en `supabase/migrations/`
- Las operaciones sensibles son funciones transaccionales en PostgreSQL (`orden_cambiar_etapa`, `presupuesto_resolver`, `actividad_accion`, `destajos_pagar`, `solicitud_entregar`, `compra_accion`, `inventario_ajustar`, …).
- El frontend solo usa la **clave publicable**; no contiene secretos.

## Ejecutar localmente

```bash
cd app
cp .env.example .env.local   # pon la URL y la clave publicable de tu proyecto Supabase
npm install
npm run dev
```

## Primer uso

1. Regístrate en “Solicitar acceso”. **El primer usuario registrado queda como Dirección** y activo.
2. Los demás usuarios quedan inactivos hasta que Dirección los active y les asigne rol (Configuración → Usuarios).
3. Configura: plazos por tipo de reparación (los iniciales son de ejemplo, ajústalos a tu convenio), técnicos y **tarifas de destajo**, materiales con su inventario inicial, proveedores.

## Pendiente

- Plantillas PDF con formato propio por reporte (hoy: imprimir / guardar como PDF desde el navegador; Excel vía CSV).
- Pantalla para transferir costos entre órdenes (la regla y la función ya existen en la base de datos).
- Alertas de “consumo fuera de lo habitual” más allá de la comparación pintura presupuestada vs real.
- Respaldos programados y notificaciones (correo / WhatsApp).
