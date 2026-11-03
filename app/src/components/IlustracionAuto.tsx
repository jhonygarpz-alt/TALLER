/**
 * Ilustración del vehículo cuando todavía no hay fotografía real: silueta según el tipo de carrocería
 * (deducido del modelo) pintada del color registrado. Se marca como "Ilustración" para que nunca
 * se confunda con evidencia fotográfica; en cuanto se sube una foto de recepción, la foto la reemplaza.
 */
type Carroceria = 'sedan' | 'hatch' | 'suv' | 'pickup' | 'van'

const TIPOS: [Carroceria, string[]][] = [
  ['pickup', ['SILVERADO', 'CHEYENNE', 'SAVEIRO', 'SIERRA', 'HILUX', 'NP300', 'RAM', 'OROCH', 'RANGER', 'TACOMA', 'TORNADO', 'LOBO', 'F-150', 'FRONTIER', 'L200', 'AMAROK', 'COLORADO']],
  ['van', ['VOYAGER', 'PARTNER', 'AVANZA', 'ODYSSEY', 'SIENNA', 'HIACE', 'SCENIC', 'TOWN', 'CARAVAN', 'URVAN', 'TRANSIT', 'SPRINTER', 'KANGOO', 'ERTIGA']],
  ['suv', ['CR-V', 'HR-V', 'BR-V', 'CX-', 'TUCSON', 'X-TRAIL', 'ROGUE', 'ESCAPE', 'JOURNEY', 'PATRIOT', 'KOLEOS', 'DUSTER', 'TRAX', 'VITARA', 'SEQUOIA', 'SUBURBAN', 'ACADIA', 'XC40', 'XC60', 'RX5', 'OMODA', 'CROSS', 'SOUL', 'TIGUAN', 'RAIZE', 'SELTOS', 'CRETA', 'SPORTAGE', 'TAOS', 'T-CROSS', 'KICKS', 'TAHOE', 'EXPLORER', 'EDGE', 'RAV4', 'HIGHLANDER', 'EQUINOX', 'CAPTIVA', 'GRAND CHEROKEE', 'COMPASS', 'WRANGLER', 'Q5', 'X1', 'X3', 'X5', 'TERRITORY', 'ECOSPORT', 'MG ZS', 'ZS', 'HS', 'TIGGO', 'JETOUR', 'PILOT', 'MURANO', 'PATHFINDER', 'OUTLANDER', 'ASX', 'FORESTER', 'XV']],
  ['hatch', ['SPARK', 'BEAT', 'KWID', 'GOL', 'POLO', 'GOLF', 'SWIFT', 'IGNIS', 'MAZDA 2', 'FIT', 'MARCH', 'COOPER', 'FORTWO', '500', 'IBIZA', 'STEPWAY', 'SANDERO', 'CHEVY', 'CUPRA', 'I10', 'UP', 'PICANTO', 'CELERIO', 'YARIS HB', 'FIGO', 'KA', 'ATOS', 'MATIZ', 'PULSE']],
]

const COLORES: Record<string, string> = {
  BLANCO: '#f8fafc', GRIS: '#9ca3af', NEGRO: '#1f2937', ROJO: '#dc2626', AZUL: '#2563eb', PLATA: '#cbd5e1',
  ARENA: '#d6c29a', 'CAFÉ': '#7c4a2d', CAFE: '#7c4a2d', AMARILLO: '#facc15', VERDE: '#16a34a', VINO: '#7f1d1d',
  NARANJA: '#ea580c', DORADO: '#ca8a04', BEIGE: '#e7d8b8', MORADO: '#7e22ce', ARENA_OSCURO: '#a68b5b',
}

export function carroceria(modelo?: string | null): Carroceria {
  const m = ` ${(modelo ?? '').toUpperCase()} `
  for (const [tipo, claves] of TIPOS) if (claves.some(k => m.includes(k.length <= 3 ? ` ${k} ` : k))) return tipo
  return 'sedan'
}

const CUERPO: Record<Carroceria, { body: string; vidrio: string; ruedas: [number, number] }> = {
  sedan: { body: 'M6 41 Q6 33 14 32 L32 30 L45 20 Q49 17 55 17 L79 17 Q85 17 89 21 L100 30 L110 31.5 Q116 33 116 39 L116 43 L6 43 Z', vidrio: 'M36 30 L47 21.5 Q50 19.5 55 19.5 L64 19.5 L64 30 Z M67 19.5 L79 19.5 Q83.5 19.5 86.5 22.5 L94 30 L67 30 Z', ruedas: [30, 92] },
  hatch: { body: 'M8 41 Q8 33 16 32 L32 30 L44 19 Q48 16 54 16 L90 16 Q96 16 99 22 L104 31 Q110 33 110 39 L110 43 L8 43 Z', vidrio: 'M36 30 L46 21 Q49 18.5 54 18.5 L66 18.5 L66 30 Z M69 18.5 L89 18.5 Q94 18.5 96 23 L99 30 L69 30 Z', ruedas: [30, 88] },
  suv: { body: 'M6 41 L6 31 Q6 27 12 26 L28 25 L39 13 Q41.5 10.5 46 10.5 L98 10.5 Q103 10.5 105 15 L109 25 Q116 26.5 116 32 L116 43 L6 43 Z', vidrio: 'M31 25 L41 14.5 Q43 13 46 13 L64 13 L64 25 Z M67 13 L85 13 L85 25 L67 25 Z M88 13 L97 13 Q101 13 102.5 16.5 L105 25 L88 25 Z', ruedas: [28, 94] },
  pickup: { body: 'M4 41 L4 30 Q4 26 9 25.5 L26 24.5 L36 13 Q38 11 42 11 L66 11 Q70 11 70 15 L70 27 L116 27 L116 43 L4 43 Z', vidrio: 'M29 24.5 L38 14.5 Q40 13.5 42 13.5 L52 13.5 L52 24.5 Z M55 13.5 L65 13.5 Q67.5 13.5 67.5 16 L67.5 24.5 L55 24.5 Z', ruedas: [24, 96] },
  van: { body: 'M6 41 L6 24 Q6 19.5 10 17.5 L26 10.5 Q30 9 35 9 L108 9 Q114 9 114 15 L114 43 L6 43 Z', vidrio: 'M14 22 L28 13 Q31 11.5 35 11.5 L46 11.5 L46 22 Z M49 11.5 L70 11.5 L70 22 L49 22 Z M73 11.5 L94 11.5 L94 22 L73 22 Z M97 11.5 L108 11.5 Q111 11.5 111 14.5 L111 22 L97 22 Z', ruedas: [26, 94] },
}

export default function IlustracionAuto({ modelo, color, conEtiqueta = true }: { modelo?: string | null; color?: string | null; conEtiqueta?: boolean }) {
  const tipo = carroceria(modelo)
  const c = COLORES[(color ?? '').trim().toUpperCase()] ?? '#94a3b8'
  const claro = ['#f8fafc', '#cbd5e1', '#facc15', '#e7d8b8', '#d6c29a'].includes(c)
  const { body, vidrio, ruedas } = CUERPO[tipo]
  return (
    <span className="relative flex h-full w-full items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200" title="Ilustración del tipo de vehículo (aún sin fotografía real)">
      <svg viewBox="0 0 122 52" className="h-[78%] w-[88%]" aria-hidden>
        <ellipse cx="61" cy="47" rx="54" ry="3" fill="#0f172a" opacity=".12" />
        <path d={body} fill={c} stroke={claro ? '#94a3b8' : 'rgba(0,0,0,.25)'} strokeWidth=".8" />
        <path d={vidrio} fill="#cfe3f3" opacity=".9" />
        <rect x={tipo === 'pickup' ? 4 : 6} y="36" width="5" height="2.4" rx="1" fill="#fde68a" />
        {ruedas.map(x => <g key={x}><circle cx={x} cy="43" r="7" fill="#111827" /><circle cx={x} cy="43" r="3.2" fill="#9ca3af" /></g>)}
      </svg>
      {conEtiqueta && <span className="absolute right-0.5 bottom-0.5 rounded bg-white/85 px-1 text-[7px] leading-[11px] font-semibold tracking-wide text-slate-500 uppercase">Ilustración</span>}
    </span>
  )
}
