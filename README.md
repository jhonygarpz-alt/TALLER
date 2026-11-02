# TallerPro · Control de Taller

Sistema web para administrar un taller de hojalatería, pintura y mecánica que trabaja con **MAPFRE** y con clientes **particulares**. Todo gira alrededor de la **orden de trabajo**: cada costo, destajo, material, fotografía y cobro está ligado a una orden (o a un centro de costo general autorizado).

## Módulos

| Módulo | Qué hace |
|---|---|
| **Inicio** | Panel ejecutivo: 12 indicadores (cada uno abre su listado), estado de vehículos, productividad, resumen financiero, alertas automáticas y accesos rápidos. |
| **Vehículos** | Asignaciones MAPFRE con historial de contacto y citas · Recepción en 4 pasos (reutiliza vehículos por placas, checklist, fotos) · Expediente con 7 pestañas: general, diagnóstico y fotos, presupuesto y autorizaciones (con ampliaciones), trabajos, materiales (pintura presupuestada vs real, piezas retiradas), costos y destajos (facturas y cobros), entrega y encuesta. |
| **Taller** | Tablero de producción por etapa · Trabajos por técnico · Destajos (autorizar / pagar por lote, separado aseguradora vs particular) · Productividad · Técnicos y tarifas. |
| **Compras** | Solicitudes de material (solicita → autoriza → entrega → se descuenta y se carga a la orden) · Catálogo e inventario con ajustes · Control de pintura · Requisiciones con cotizaciones comparativas, autorización y recepción · Proveedores · Movimientos e historial de precios con alertas de aumento. |
| **Resultados** | Rentabilidad por vehículo (autorizado, facturado, cobrado, costos directos, utilidad bruta y después de indirectos) · KPIs de aseguradora contra objetivos configurables · Indicadores financieros (MAPFRE vs particulares, gastos fijos, punto de equilibrio, comparativo mensual, cuentas por cobrar) · Reportes descargables en Excel (CSV). |

Configuración (menú del usuario): usuarios y roles, matriz de permisos por rol, plazos por tipo de reparación, parámetros/objetivos, aseguradoras y bitácora de auditoría.

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
