/** Tipos de aviso push para Dirección y Gerencia (app de gerencia y sistema web) */
export const AVISOS_GERENCIA = [
  { id: 'ingreso', label: 'Ingreso de vehículo', sub: 'Cada vez que se abre una orden de trabajo' },
  { id: 'asignacion', label: 'Trabajo asignado', sub: 'Cuando se asigna un trabajo a un técnico o proveedor' },
  { id: 'trabajo', label: 'Trabajo terminado', sub: 'Cuando cada hojalatero o pintor termina su trabajo' },
  { id: 'entrega', label: 'Orden cerrada / vehículo entregado', sub: 'Con los días que estuvo en el taller' },
  { id: 'encuesta', label: 'Calificación baja', sub: 'Encuestas de 3 estrellas o menos' },
  { id: 'resumen', label: 'Resumen del día', sub: 'Todos los días a las 7:10 p. m.' },
]
