import { useEffect, useState } from 'react'

/**
 * Barra de estado del celular (hora, señal, batería).
 * - Calcula su altura en la variable CSS --sat (en iPhone con la app instalada a veces el navegador
 *   reporta 0 aunque el contenido quede debajo; en ese caso usa 47px).
 * - Pinta una franja fija detrás de la barra para que el contenido no se encime al desplazarse:
 *   oscura si la app instalada usa barra transparente con letras blancas, clara en el navegador.
 */
export function BandaEstado({ translucida = true }: { translucida?: boolean }) {
  const [instalada, setInstalada] = useState(false)
  useEffect(() => {
    const raiz = document.documentElement
    const m = document.createElement('div')
    m.style.cssText = 'position:fixed;top:0;height:env(safe-area-inset-top);visibility:hidden'
    document.body.appendChild(m)
    const alto = m.getBoundingClientRect().height
    m.remove()
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const inst = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
    setInstalada(inst)
    raiz.style.setProperty('--sat', alto > 0 ? `${alto}px` : ios && inst && translucida ? '47px' : '0px')
  }, [translucida])
  const oscura = instalada && translucida
  return <div aria-hidden className={`pointer-events-none fixed inset-x-0 top-0 z-[60] h-[var(--sat)] backdrop-blur ${oscura ? 'bg-[#0b2133]/95' : 'bg-[#f1f7f9]/95'}`} />
}
