/** Unidades de medida de uso común en el taller (hojalatería, pintura, refacciones, mecánica). */
export const UNIDADES: { grupo: string; items: [string, string][] }[] = [
  { grupo: 'Conteo', items: [['pza', 'Pieza (pza)'], ['par', 'Par'], ['jgo', 'Juego (jgo)'], ['kit', 'Kit'], ['caja', 'Caja'], ['paq', 'Paquete (paq)'], ['bolsa', 'Bolsa'], ['hoja', 'Hoja'], ['pliego', 'Pliego'], ['rollo', 'Rollo'], ['tubo', 'Tubo'], ['cartucho', 'Cartucho'], ['bote', 'Bote'], ['cubeta', 'Cubeta'], ['tambo', 'Tambo'], ['servicio', 'Servicio']] },
  { grupo: 'Volumen', items: [['lt', 'Litro (lt)'], ['ml', 'Mililitro (ml)'], ['gal', 'Galón (gal)'], ['1/4 gal', 'Cuarto de galón'], ['oz', 'Onza líquida (oz)'], ['cc', 'Centímetro cúbico (cc)']] },
  { grupo: 'Peso', items: [['kg', 'Kilogramo (kg)'], ['g', 'Gramo (g)'], ['lb', 'Libra (lb)']] },
  { grupo: 'Longitud y área', items: [['m', 'Metro (m)'], ['cm', 'Centímetro (cm)'], ['mm', 'Milímetro (mm)'], ['pie', 'Pie'], ['m²', 'Metro cuadrado (m²)']] },
  { grupo: 'Tiempo', items: [['hr', 'Hora (hr)']] },
]

const TODAS = new Set(UNIDADES.flatMap(g => g.items.map(([v]) => v)))

/** Lista desplegable de unidades. Conserva valores ya guardados que no estén en la lista y permite capturar otra. */
export default function UnidadSelect({ value, onChange, className = 'input' }: { value: string; onChange: (v: string) => void; className?: string }) {
  const fuera = value && !TODAS.has(value)
  return (
    <select className={className} value={value} onChange={e => {
      if (e.target.value !== '__otra') return onChange(e.target.value)
      const v = prompt('Escribe la unidad de medida (por ejemplo: bulto, tramo):', '')?.trim()
      if (v) onChange(v)
    }}>
      {fuera && <option value={value}>{value}</option>}
      {UNIDADES.map(g => <optgroup key={g.grupo} label={g.grupo}>{g.items.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</optgroup>)}
      <option value="__otra">Otra…</option>
    </select>
  )
}
