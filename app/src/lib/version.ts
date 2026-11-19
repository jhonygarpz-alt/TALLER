import { useEffect } from 'react'

/**
 * Actualización automática: el celular (sobre todo iPhone con la app instalada) puede dejar la app abierta
 * en memoria por días con una versión vieja. Al volver a la app y cada 3 minutos se revisa /version.json;
 * si hay una publicación nueva, se recarga. Lo capturado en la recepción queda guardado como borrador.
 */
export function useActualizacionAutomatica() {
  useEffect(() => {
    if (!import.meta.env.PROD) return
    let revisando = false
    async function revisar() {
      // No recargar mientras haya una ventana abierta (avance, foto, formulario): se intenta más tarde
      if (revisando || document.visibilityState !== 'visible' || document.querySelector('[data-sin-recarga]')) return
      revisando = true
      try {
        const r = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' })
        if (r.ok) {
          const { build } = await r.json() as { build?: string }
          if (build && build !== __BUILD__) {
            // Evita bucles si el servidor aún no termina de publicar
            const clave = 'recarga-version'
            if (sessionStorage.getItem(clave) !== build) { sessionStorage.setItem(clave, build); window.location.reload() }
          }
        }
      } catch { /* sin conexión: se revisa después */ }
      revisando = false
    }
    revisar()
    const t = setInterval(revisar, 3 * 60 * 1000)
    document.addEventListener('visibilitychange', revisar)
    window.addEventListener('focus', revisar)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', revisar); window.removeEventListener('focus', revisar) }
  }, [])
}
