import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { HelpCircle } from 'lucide-react'
import { buscarAyuda } from '../lib/ayuda'

const LS = 'ayuda-contextual'
const EVENTO = 'ayuda-contextual-cambio'
const OBJETIVOS = '[data-ayuda], [data-ayuda-clave], button, a, label, th, select, input, textarea, .card'

function leerActiva() { try { return localStorage.getItem(LS) !== 'off' } catch { return true } }

/** Primera línea con letras del texto visible (ignora números sueltos como los de los indicadores). */
function textoPrincipal(el: HTMLElement): string {
  const t = el.innerText || el.getAttribute('aria-label') || ''
  return t.split('\n').map(s => s.trim()).find(s => /[a-zA-ZáéíóúÁÉÍÓÚñÑ]{2}/.test(s)) ?? ''
}

/** Busca, del elemento bajo el cursor hacia arriba, el primero que tenga una ayuda. */
function resolver(origen: Element): { el: HTMLElement; titulo: string; texto: string } | null {
  let el: HTMLElement | null = origen.closest(OBJETIVOS)
  let saltos = 0
  while (el && saltos < 6) {
    if (el.closest('[data-sin-ayuda]')) return null
    const propia = el.getAttribute('data-ayuda')
    if (propia) return { el, titulo: el.getAttribute('data-ayuda-titulo') ?? textoPrincipal(el), texto: propia }
    let titulo = ''
    const tag = el.tagName
    if (el.hasAttribute('data-ayuda-clave')) titulo = el.getAttribute('data-ayuda-clave')!
    else if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') {
      const lab = (el.id && document.querySelector<HTMLElement>(`label[for="${el.id}"]`)) || (el.previousElementSibling as HTMLElement | null)
      titulo = lab && lab.tagName !== 'INPUT' ? textoPrincipal(lab) : ''
      if (!titulo && (el as HTMLInputElement).type === 'checkbox' && el.parentElement) titulo = textoPrincipal(el.parentElement)
    } else if (el.classList.contains('card') && el.offsetHeight > 230) titulo = ''
    else titulo = textoPrincipal(el) || el.getAttribute('title') || ''
    // Etiquetas de filtro ("Sucursal:") usan la ayuda del filtro si existe
    const texto = titulo ? ((/:\s*$/.test(titulo) && buscarAyuda('filtro ' + titulo)) || buscarAyuda(titulo)) : null
    if (texto) return { el, titulo: titulo.replace(/[*:]+\s*$/, '').trim(), texto }
    el = el.parentElement?.closest(OBJETIVOS) as HTMLElement | null
    saltos++
  }
  return null
}

interface Estado { titulo: string; texto: string; x: number; y: number; arriba: boolean }

/**
 * Leyendas de ayuda al pasar el cursor sobre botones, pestañas, filtros, columnas e indicadores de toda la app.
 * Se activa/desactiva con el botón de ayuda del encabezado (se recuerda por equipo).
 * En pantallas táctiles no se muestra para no estorbar los toques.
 */
export default function AyudaContextual() {
  const [activa, setActiva] = useState(leerActiva)
  const [tip, setTip] = useState<Estado | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const actual = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const cambio = () => setActiva(leerActiva())
    window.addEventListener(EVENTO, cambio)
    return () => window.removeEventListener(EVENTO, cambio)
  }, [])

  useEffect(() => {
    if (!activa || !window.matchMedia('(hover: hover)').matches) return
    const ocultar = () => { window.clearTimeout(timer.current); actual.current = null; setTip(null) }
    const sobre = (e: MouseEvent) => {
      const r = e.target instanceof Element ? resolver(e.target) : null
      if (r?.el === actual.current) return
      window.clearTimeout(timer.current); setTip(null); actual.current = r?.el ?? null
      if (!r) return
      // Evita el globo nativo del navegador para no mostrar dos leyendas
      if (r.el.hasAttribute('title')) { r.el.setAttribute('data-title', r.el.getAttribute('title')!); r.el.removeAttribute('title') }
      timer.current = window.setTimeout(() => {
        if (!r.el.isConnected) return
        const b = r.el.getBoundingClientRect()
        const arriba = b.bottom + 120 > window.innerHeight
        const x = Math.min(Math.max(b.left + b.width / 2, 170), window.innerWidth - 170)
        setTip({ titulo: r.titulo, texto: r.texto, x, y: arriba ? b.top - 10 : b.bottom + 10, arriba })
      }, 450)
    }
    document.addEventListener('mouseover', sobre)
    document.addEventListener('mousedown', ocultar)
    window.addEventListener('scroll', ocultar, true)
    window.addEventListener('blur', ocultar)
    return () => {
      document.removeEventListener('mouseover', sobre); document.removeEventListener('mousedown', ocultar)
      window.removeEventListener('scroll', ocultar, true); window.removeEventListener('blur', ocultar); ocultar()
    }
  }, [activa])

  if (!tip) return null
  return createPortal(
    <div role="tooltip" className="pointer-events-none fixed z-[1000] w-max max-w-[320px]"
      style={{ left: tip.x, top: tip.y, transform: `translate(-50%, ${tip.arriba ? '-100%' : '0'})` }}>
      <div className="animate-aparecer rounded-xl border border-brand-400/70 bg-navy-950/95 px-3.5 py-2.5 text-white shadow-[0_0_0_1px_rgba(61,220,132,.35),0_0_18px_rgba(29,180,100,.45)] backdrop-blur">
        {tip.titulo && <div className="mb-0.5 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-brand-300 uppercase"><HelpCircle className="h-3.5 w-3.5" />{tip.titulo}</div>}
        <div className="text-[13px] leading-snug text-emerald-50">{tip.texto}</div>
      </div>
    </div>,
    document.body,
  )
}

/** Botón del encabezado para activar o desactivar las leyendas. */
export function BotonAyuda() {
  const [activa, setActiva] = useState(leerActiva)
  const alternar = () => {
    const n = !activa
    try { localStorage.setItem(LS, n ? 'on' : 'off') } catch { /* sin almacenamiento */ }
    setActiva(n); window.dispatchEvent(new Event(EVENTO))
  }
  return (
    <button onClick={alternar} aria-label="Ayuda contextual" aria-pressed={activa}
      data-ayuda={activa ? 'Leyendas de ayuda ACTIVADAS: pasa el cursor sobre cualquier botón, pestaña, filtro o indicador para ver para qué sirve. Da clic para desactivarlas.' : 'Leyendas de ayuda desactivadas. Da clic para activarlas.'}
      data-ayuda-titulo="Ayuda contextual"
      className={`hidden h-10 w-10 items-center justify-center rounded-full transition md:flex ${activa ? 'bg-[#2298af] text-white shadow-[0_0_14px_rgba(34,152,175,.55)]' : 'bg-white/[.08] text-[#c5e6ed] ring-1 ring-white/10 hover:bg-white/15'}`}>
      <HelpCircle className="h-5 w-5" />
    </button>
  )
}
