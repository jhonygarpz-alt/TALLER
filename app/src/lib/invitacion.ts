/** Liga de WhatsApp para invitar al cliente a la app "Mi Auto" (seguimiento, aviso de listo y encuesta) */
export function ligaInvitacion(o: { cliente_nombre?: string | null; cliente_telefono?: string | null; marca?: string | null; modelo?: string | null; placas?: string | null }) {
  const tel = (o.cliente_telefono ?? '').replace(/\D/g, '').slice(-10)
  if (tel.length < 10 || !o.placas) return null
  const app = `${location.origin}${import.meta.env.BASE_URL}cliente/`
  const nombre = (o.cliente_nombre ?? '').split(' ')[0]
  const texto = `Hola ${nombre ? nombre.charAt(0) + nombre.slice(1).toLowerCase() : ''} 👋, sigue en tiempo real la reparación de tu ${o.marca ?? ''} ${o.modelo ?? ''} y recibe aviso cuando esté listo:\n${app}\n\nEntra con tu teléfono (${tel}) y tus placas (${o.placas}).`
  return `https://wa.me/52${tel}?text=${encodeURIComponent(texto)}`
}
