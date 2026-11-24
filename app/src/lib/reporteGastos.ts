/**
 * Reporte de gastos económicos por unidad (formato fijo de COVA Automotriz · Sucursal Legaria).
 * Junta todos los gastos registrados de una orden — refacciones, materiales de hojalatería y pintura,
 * mano de obra (destajos), pulido y gastos adicionales — y lo exporta a Excel o PDF con el mismo diseño.
 */
import { supabase } from './supabase'

/* ----------------------------- DATOS ----------------------------- */
type Num = number | null
export interface FilaCuerpo {
  texto: string; dm?: boolean; sust?: boolean; repar?: boolean
  moH?: Num; moP?: Num; ref?: Num; mat?: Num; sub?: Num
  /** fila de solo texto con el importe escrito debajo de "PAGA"/"GASTAMOS" */
  sinSub?: boolean
}
export interface DatosReporte {
  aseguradora: string; esAseguradora: boolean; esParticular: boolean
  siniestro: string; marca: string; vehiculo: string; color: string; placas: string; modelo: string
  orden: string; elaboro: string; fecha: string
  filas: FilaCuerpo[]
  hojalatero: string; pintor: string
  gastosAdicionales: number; materialesPulido: number; moHojalatero: number; moPintor: number; materiales: number; refacciones: number
  suma: number; iva: number; total: number; pagan: number; gastamos: number; ganancia: number
}

const r2 = (n: number) => Math.round(n * 100) / 100
const up = (s: string | null | undefined) => (s ?? '').trim().toUpperCase()
const AREAS_HOJ = ['hojalateria', 'armado']
const NOMBRE_AREA: Record<string, string> = { detallado: 'PULIDOR', mecanica: 'MECÁNICO', otros: 'OTROS', hojalateria: 'HOJALATERO', pintura: 'PINTOR', armado: 'ARMADO' }

export async function cargarReporte(ordenId: number, _elaboro?: string): Promise<DatosReporte> {
  const [o, rent, sol, cos, des, act, fac, cfg] = await Promise.all([
    supabase.from('v_ordenes').select('folio,tipo,aseguradora_nombre,siniestro,marca,modelo,anio,color,placas').eq('id', ordenId).single(),
    supabase.from('v_rentabilidad').select('autorizado,adicional').eq('orden_id', ordenId).maybeSingle(),
    // Material entregado (costo real) y el solicitado/autorizado aún por entregar (costo estimado del catálogo)
    supabase.from('solicitudes_material').select('estado,cantidad_solicitada,cantidad_aprobada,cantidad_entregada,costo_total,costo_estimado,centro_costo,seccion,materiales(descripcion,unidad,tipo),actividades(area)').eq('orden_id', ordenId).in('estado', ['solicitada', 'autorizada', 'entregada']).order('id'),
    supabase.from('orden_costos').select('tipo,concepto,proveedor,monto').eq('orden_id', ordenId).order('fecha').order('id'),
    supabase.from('destajos').select('importe,actividades(area,actividad),tecnicos(nombre)').eq('orden_id', ordenId).neq('estado', 'cancelado'),
    supabase.from('actividades').select('area,actividad,pieza,tecnicos(nombre)').eq('orden_id', ordenId).neq('estado', 'cancelada').order('id'),
    supabase.from('facturas').select('receptor,monto').eq('orden_id', ordenId).eq('cancelada', false),
    supabase.from('configuracion').select('valor').eq('clave', 'pequeno_material').maybeSingle(),
  ])
  if (o.error) throw o.error
  for (const q of [rent, sol, cos, des, act, fac]) if (q.error) throw q.error
  const ord = o.data
  type Sol = { estado: string; cantidad_solicitada: number; cantidad_aprobada: number | null; cantidad_entregada: number | null; costo_total: number | null; costo_estimado: number | null; centro_costo: string | null; seccion: string | null; materiales: { descripcion: string; unidad: string; tipo: string } | null; actividades: { area: string } | null }
  type Cos = { tipo: string; concepto: string; proveedor: string | null; monto: number }
  type Des = { importe: number; actividades: { area: string; actividad?: string } | null; tecnicos: { nombre: string } | null }
  type Act = { area: string; actividad: string; pieza: string | null; tecnicos: { nombre: string } | null }
  // Cantidad e importe de cada solicitud: lo entregado si ya se entregó; si no, lo autorizado/solicitado con costo estimado
  const sols = ((sol.data ?? []) as unknown as Sol[]).map(x => {
    if (x.estado === 'entregada') return x
    const q = Number(x.cantidad_aprobada ?? x.cantidad_solicitada)
    return { ...x, cantidad_entregada: q, costo_total: x.costo_estimado != null ? r2(Number(x.costo_estimado) * q / Number(x.cantidad_solicitada)) : 0 }
  })
  const costos = (cos.data ?? []) as Cos[]
  const destajos = (des.data ?? []) as unknown as Des[]
  const acts = (act.data ?? []) as unknown as Act[]

  const esRef = (s: Sol) => s.seccion ? s.seccion === 'refaccion' : s.materiales?.tipo === 'refaccion'
  // 1) Refacciones (sustitución) y piezas trabajadas (reparación / desmontaje-montaje)
  const piezas: FilaCuerpo[] = []
  const vistos = new Set<string>()
  for (const s of sols.filter(esRef)) piezas.push({ texto: up(s.materiales?.descripcion), sust: true, ref: r2(Number(s.costo_total ?? 0)) })
  for (const c of costos.filter(c => c.tipo === 'refaccion')) piezas.push({ texto: up(c.concepto), sust: true, ref: r2(Number(c.monto)) })
  for (const p of piezas) vistos.add(p.texto)
  for (const a of acts.filter(a => AREAS_HOJ.includes(a.area))) {
    const t = up(a.pieza) || up(a.actividad)
    if (!t || vistos.has(t + a.area)) continue
    vistos.add(t + a.area)
    piezas.push(a.area === 'armado' ? { texto: t, dm: true } : { texto: t, repar: true })
  }

  // 2) Materiales de hojalatería y de pintura (entregas de almacén + compras directas)
  const esPintura = (s: Sol) => s.seccion ? s.seccion === 'pintura' : (s.materiales?.tipo === 'pintura' || s.actividades?.area === 'pintura' || /pint/i.test(s.centro_costo ?? ''))
  const filaMat = (s: Sol): FilaCuerpo => {
    const cant = Number(s.cantidad_entregada ?? 0)
    const unidad = up(s.materiales?.unidad)
    return { texto: `${cant ? `${+cant.toFixed(2)} ${unidad === 'PZA' ? '' : unidad} `.replace(/\s+/g, ' ') : ''}${up(s.materiales?.descripcion)}`.trim(), mat: r2(Number(s.costo_total ?? 0)) }
  }
  const matsMaterial = sols.filter(s => !esRef(s))
  const matHoj = [...matsMaterial.filter(s => !esPintura(s)).map(filaMat), ...costos.filter(c => c.tipo === 'material' || c.tipo === 'pulido').map(c => ({ texto: up(c.concepto), mat: r2(Number(c.monto)) }))]
  const matPin = matsMaterial.filter(esPintura).map(filaMat)

  // 3) Mano de obra (destajos validados, no cancelados)
  // El lavado va en su propio renglón (Destajo lavado), fuera de las áreas
  const esLavado = (d: Des) => /lavad/i.test(d.actividades?.actividad ?? '')
  const lavado = r2(destajos.filter(esLavado).reduce((t, d) => t + Number(d.importe), 0))
  const sumaArea = (pred: (a: string) => boolean) => r2(destajos.filter(d => !esLavado(d) && pred(d.actividades?.area ?? 'otros')).reduce((t, d) => t + Number(d.importe), 0))
  const moH = sumaArea(a => AREAS_HOJ.includes(a))
  const moP = sumaArea(a => a === 'pintura')

  // 4) Gastos adicionales: servicios externos, otros gastos, mano de obra adicional y destajos de otras áreas
  const extras: FilaCuerpo[] = []
  for (const area of ['detallado', 'mecanica', 'otros']) {
    const v = sumaArea(a => a === area)
    if (v > 0) extras.push({ texto: `MANO DE OBRA ${NOMBRE_AREA[area]}`, sub: v })
  }
  for (const c of costos.filter(c => ['servicio_externo', 'otro', 'mano_obra_adicional'].includes(c.tipo)))
    extras.push({ texto: `${up(c.concepto)}${c.proveedor ? ` (${up(c.proveedor)})` : ''}`.slice(0, 60), sub: r2(Number(c.monto)) })
  const pulido = lavado
  // Pequeño material: gasto fijo por orden (parámetro configurable, $300 por omisión)
  const pm = Number(cfg.data?.valor ?? 300)
  if (pm > 0) extras.push({ texto: 'PEQUEÑO MATERIAL', sub: pm })

  // 5) Ingresos
  const autorizado = r2(Number(rent.data?.autorizado ?? 0) + Number(rent.data?.adicional ?? 0))
  const facts = (fac.data ?? []) as { receptor: string; monto: number }[]
  const facAseg = r2(facts.filter(f => f.receptor === 'aseguradora').reduce((t, f) => t + Number(f.monto), 0))
  const facCli = r2(facts.filter(f => f.receptor !== 'aseguradora').reduce((t, f) => t + Number(f.monto), 0))
  const esAseg = ord.tipo === 'aseguradora'
  const asegPaga = esAseg ? (autorizado || facAseg) : 0
  const partPaga = esAseg ? facCli : (autorizado || facCli)

  // Totales
  const sumMat = r2([...matHoj, ...matPin].reduce((t, f) => t + (f.mat ?? 0), 0))
  const sumRef = r2(piezas.reduce((t, f) => t + (f.ref ?? 0), 0))
  const sumExt = r2(extras.reduce((t, f) => t + (f.sub ?? 0), 0))
  const suma = r2(sumExt + pulido + moH + moP + sumMat + sumRef)
  const pagan = r2(asegPaga + partPaga)

  // Cuerpo con la misma secuencia del formato (las filas vacías se respetan)
  const sub = (f: FilaCuerpo) => ({ ...f, sub: f.sub ?? r2((f.moH ?? 0) + (f.moP ?? 0) + (f.ref ?? 0) + (f.mat ?? 0)) })
  const bloque1: FilaCuerpo[] = [...piezas, { texto: '' }, { texto: 'MATERIALES DE HOJALATERÍA' }, ...matHoj, { texto: '' }, { texto: 'MATERIALES DE PINTURA' }, ...matPin]
  while (bloque1.length < 27) bloque1.push({ texto: '' })
  const nombreAseg = up(ord.aseguradora_nombre) || 'MAPFRE'
  const importe = (n: number) => (n ? n.toFixed(2).replace(/\.00$/, '') : '')
  const filas: FilaCuerpo[] = [
    ...bloque1,
    { texto: 'MANO DE OBRA HOJALATERO', moH: moH || null },
    { texto: 'MANO DE OBRA PINTOR', moP: moP || null },
    ...extras,
    { texto: '' },
    { texto: `${nombreAseg} PAGA` }, { texto: importe(asegPaga) }, { texto: '' },
    { texto: 'TOYOTA PAGA' }, { texto: '' }, { texto: '' },
    { texto: 'PARTICULAR PAGA' }, { texto: importe(partPaga) }, { texto: '' },
    { texto: 'GASTAMOS' }, { texto: importe(suma) }, { texto: '' },
    { texto: 'GASTOS ADICIONALES TOYOTA' },
  ].map(sub)
  filas.push({ texto: 'DESTAJO LAVADO', mat: pulido || null, sinSub: true })

  const nombres = (pred: (a: string) => boolean) => [...new Set([
    ...destajos.filter(d => pred(d.actividades?.area ?? '')).map(d => d.tecnicos?.nombre),
    ...acts.filter(a => pred(a.area)).map(a => a.tecnicos?.nombre),
  ].filter(Boolean).map(n => up(n)))].join(', ')

  const hoy = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Mexico_City' })
  return {
    aseguradora: esAseg ? nombreAseg : '', esAseguradora: esAseg, esParticular: !esAseg,
    siniestro: ord.siniestro ?? '', marca: up(ord.marca), vehiculo: up(ord.modelo), color: up(ord.color), placas: up(ord.placas), modelo: ord.anio ? String(ord.anio) : '',
    orden: ord.folio, elaboro: 'JAZMÍN', fecha: hoy, // Siempre elabora Jazmín
    filas, hojalatero: nombres(a => AREAS_HOJ.includes(a)), pintor: nombres(a => a === 'pintura'),
    gastosAdicionales: sumExt, materialesPulido: pulido, moHojalatero: moH, moPintor: moP, materiales: sumMat, refacciones: sumRef,
    suma, iva: r2(suma * 0.16), total: r2(suma * 1.16), pagan, gastamos: suma, ganancia: r2(pagan - suma),
  }
}

/* ----------------------------- DISEÑO (común a Excel y PDF) ----------------------------- */
// Columnas (en px de la hoja original): A..M
const COLS = [107, 174, 8, 50, 35, 35, 37, 7, 58, 56, 60, 72, 68]
type Alin = 'left' | 'center' | 'right'
interface Celda {
  r: number; c: number; rs?: number; cs?: number; v?: string | number | null
  b?: boolean; al?: Alin; borde?: boolean; fondo?: string; color?: string; tam?: number; fuente?: 'serif'
  fmt?: 'moneda' | 'contable' | 'general'; formula?: string
}
interface Hoja { celdas: Celda[]; alturas: number[] }

function construir(d: DatosReporte): Hoja {
  const celdas: Celda[] = []
  const alturas: number[] = []
  const put = (x: Celda) => celdas.push(x)
  const fila = (h: number) => { alturas.push(h); return alturas.length - 1 }

  // Título y logo (3 filas)
  const t0 = fila(30), t1 = fila(18), t2 = fila(14)
  put({ r: t0, c: 0, cs: 7, v: 'COVA AUTOMOTRIZ', b: true, tam: 22, fuente: 'serif', al: 'center' })
  put({ r: t1, c: 0, cs: 7, v: 'SUCURSAL LEGARIA', b: true, tam: 12, al: 'center' })
  void t2

  // Encabezado de la unidad (8 filas)
  const h = Array.from({ length: 8 }, () => fila(14))
  const etiqueta = (i: number, txt: string, val: string) => {
    put({ r: h[i], c: 0, v: txt, b: true, borde: true, tam: 7.5 })
    put({ r: h[i], c: 1, v: val, b: true, borde: true, al: 'center', tam: 7.5 })
  }
  etiqueta(0, 'Cía de seguros', d.aseguradora || 'MAPFRE')
  etiqueta(1, '', d.esAseguradora ? 'X' : '')
  etiqueta(2, 'SINIESTRO', d.siniestro); etiqueta(3, 'MARCA', d.marca); etiqueta(4, 'VEHÍCULO', d.vehiculo)
  etiqueta(5, 'COLOR', d.color); etiqueta(6, 'PLACAS', d.placas); etiqueta(7, 'MODELO', d.modelo)
  // Caja central
  put({ r: h[0], c: 3, cs: 4, v: 'TOYOTA', b: true, borde: true, al: 'center', tam: 7.5 })
  put({ r: h[1], c: 3, cs: 4, v: '', borde: true })
  put({ r: h[2], c: 3, cs: 4, rs: 2, v: 'PARTICULAR', b: true, borde: true, al: 'center', tam: 8.5 })
  put({ r: h[4], c: 3, cs: 4, v: d.esParticular ? 'X' : '', b: true, borde: true, al: 'center', tam: 7.5 })
  put({ r: h[5], c: 3, cs: 4, v: 'ORDEN DE SERVICIO', b: true, borde: true, al: 'center', tam: 7.5 })
  put({ r: h[6], c: 3, cs: 4, rs: 2, v: d.orden, b: true, borde: true, al: 'center', tam: 8.5 })
  // Lado derecho
  put({ r: h[1], c: 8, cs: 5, rs: 2, v: 'REPORTE DE GASTOS ECONÓMICOS', b: true, borde: true, fondo: '1F1F1F', color: 'FFFFFF', al: 'center', tam: 9 })
  put({ r: h[3], c: 8, v: 'ELABORÓ', b: true, borde: true, tam: 7.5 })
  put({ r: h[3], c: 9, cs: 4, v: d.elaboro, b: true, borde: true, al: 'center', tam: 7.5 })
  put({ r: h[4], c: 8, cs: 5, v: '', borde: true })
  put({ r: h[6], c: 8, v: 'fecha', b: true, al: 'center', tam: 7.5 })
  put({ r: h[6], c: 9, cs: 4, v: d.fecha, b: true, al: 'center', tam: 7.5 })
  fila(8) // separación

  // Encabezado de tabla
  const th = fila(14)
  const cab = (c: number, v: string, cs = 1) => put({ r: th, c, cs, v, b: true, borde: true, al: 'center', tam: 6.5 })
  cab(0, 'MATERIALES UTILIZADOS', 4); cab(4, 'D/M'); cab(5, 'SUST'); cab(6, 'REPAR')
  cab(8, 'MO hojalatero'); cab(9, 'MO pintor'); cab(10, 'Refacciones'); cab(11, 'Materiales'); cab(12, 'Sub Total')

  // Cuerpo
  for (const f of d.filas) {
    const r = fila(14)
    const n = (c: number, v: Num | undefined) => put({ r, c, v: v || null, borde: true, al: 'right', tam: 7, fmt: 'general' })
    put({ r, c: 0, cs: 4, v: f.texto, borde: true, al: 'center', tam: 7 })
    for (const [c, on] of [[4, f.dm], [5, f.sust], [6, f.repar]] as const) put({ r, c, v: on ? 'X' : '', borde: true, al: 'center', tam: 7 })
    n(8, f.moH); n(9, f.moP); n(10, f.ref); n(11, f.mat)
    if (f.sinSub) put({ r, c: 12, v: null, borde: true })
    else put({ r, c: 12, v: f.sub ?? 0, borde: true, al: 'right', tam: 7, fmt: 'contable', formula: `SUM(I${r + 1}:L${r + 1})` })
  }

  // Pie: totales
  const p = Array.from({ length: 9 }, () => fila(14))
  put({ r: p[0], c: 0, cs: 7, rs: 2, v: 'NOTA * Indicar los materiales que se solicitaron', b: true, borde: true, al: 'center', tam: 8.5 })
  const izq = (i: number, rs: number, txt: string, v: number, fondo?: string) => {
    put({ r: p[i], c: 0, cs: 2, rs, v: txt, b: true, borde: true, fondo, tam: 7.5 })
    put({ r: p[i], c: 2, cs: 2, rs, v: '$', b: true, borde: true, fondo, al: 'center', tam: 7.5 })
    put({ r: p[i], c: 4, cs: 3, rs, v, b: true, borde: true, fondo, al: 'right', tam: 7.5, fmt: 'moneda' })
  }
  izq(2, 2, d.aseguradora ? `${d.aseguradora} Y PARTICULAR PAGAN` : 'MAPFRE Y PARTICULAR PAGAN', d.pagan)
  izq(4, 2, 'GASTAMOS', d.gastamos)
  izq(6, 1, 'TOTAL GANANCIA', d.ganancia, 'E6E6E6')
  put({ r: p[7], c: 0, cs: 2, v: 'HOJALATERO', b: true, borde: true, al: 'center', tam: 7.5 })
  put({ r: p[7], c: 2, cs: 5, v: 'PINTOR', b: true, borde: true, al: 'center', tam: 7.5 })
  put({ r: p[8], c: 0, cs: 2, v: d.hojalatero, borde: true, al: 'center', tam: 6.5 })
  put({ r: p[8], c: 2, cs: 5, v: d.pintor, borde: true, al: 'center', tam: 6.5 })
  const der: [string, number, boolean?][] = [
    ['Gastos Adicionales', d.gastosAdicionales], ['Destajo Lavado', d.materialesPulido], ['M.O. Hojalatero', d.moHojalatero],
    ['M.O. Pintor', d.moPintor], ['Materiales', d.materiales], ['Refacciones', d.refacciones],
    ['Suma', d.suma, true], ['IVA', d.iva], ['Total', d.total, true],
  ]
  der.forEach(([txt, v, gris], i) => {
    const fondo = gris ? 'E6E6E6' : undefined
    put({ r: p[i], c: 8, cs: 2, v: txt, b: true, borde: true, fondo, tam: 7 })
    put({ r: p[i], c: 10, v: '$', b: true, borde: true, fondo, al: 'left', tam: 7 })
    put({ r: p[i], c: 11, cs: 2, v, b: true, borde: true, fondo, al: 'right', tam: 7, fmt: 'contable' })
  })
  return { celdas, alturas }
}

const fmtNum = (v: number, fmt: Celda['fmt']) => {
  if (fmt === 'general') return String(+v.toFixed(2))
  const s = Math.abs(v).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (fmt === 'contable') return v === 0 ? '-' : (v < 0 ? `-${s}` : s)
  return v < 0 ? `-${s}` : s
}

async function logoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}img/cova_logo.png`)
    const b = await res.blob()
    return await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result)); fr.readAsDataURL(b) })
  } catch { return null }
}

const nombreArchivo = (d: DatosReporte, ext: string) => `Reporte_gastos_economicos_OS_${d.orden}${d.placas ? `_${d.placas}` : ''}.${ext}`.replace(/[^\w.\-]+/g, '_')

function descargar(blob: Blob, nombre: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = nombre
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

/* ----------------------------- EXCEL ----------------------------- */
export async function exportarExcel(d: DatosReporte) {
  const { default: ExcelJS } = await import('exceljs')
  const hoja = construir(d)
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Reporte de gastos', {
    pageSetup: { paperSize: 1 as never, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1, margins: { left: 0.3, right: 0.3, top: 0.3, bottom: 0.3, header: 0, footer: 0 }, horizontalCentered: true },
    views: [{ showGridLines: false }],
  })
  ws.columns = COLS.map(w => ({ width: Math.max(1, w / 6.2) }))
  hoja.alturas.forEach((h, i) => { ws.getRow(i + 1).height = h * 0.78 })
  const delgado = { style: 'thin' as const, color: { argb: 'FF000000' } }
  for (const x of hoja.celdas) {
    const r1 = x.r + 1, c1 = x.c + 1, r2 = r1 + (x.rs ?? 1) - 1, c2 = c1 + (x.cs ?? 1) - 1
    if (r2 > r1 || c2 > c1) ws.mergeCells(r1, c1, r2, c2)
    const cell = ws.getCell(r1, c1)
    if (x.formula) cell.value = { formula: x.formula, result: Number(x.v ?? 0) }
    else if (x.v !== undefined && x.v !== null && x.v !== '') cell.value = x.v
    cell.font = { name: x.fuente === 'serif' ? 'Times New Roman' : 'Arial', size: x.tam ?? 8, bold: !!x.b, color: { argb: 'FF' + (x.color ?? '000000') } }
    cell.alignment = { horizontal: x.al ?? 'left', vertical: 'middle', wrapText: false, shrinkToFit: true }
    if (x.fmt === 'moneda') cell.numFmt = '#,##0.00'
    if (x.fmt === 'contable') cell.numFmt = x.c === 12 ? '_-"$"* #,##0.00_-;-"$"* #,##0.00_-;_-"$"* "-"??_-;_-@_-' : '#,##0.00;-#,##0.00;"-"'
    if (x.borde || x.fondo) for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
      const cc = ws.getCell(r, c)
      if (x.borde) cc.border = { top: delgado, left: delgado, bottom: delgado, right: delgado }
      if (x.fondo) cc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + x.fondo } }
    }
  }
  const logo = await logoDataUrl()
  if (logo) {
    const id = wb.addImage({ base64: logo, extension: 'png' })
    ws.addImage(id, { tl: { col: 9.2, row: 0.15 }, ext: { width: 200, height: 72 } })
  }
  ws.pageSetup.printArea = `A1:M${hoja.alturas.length}`
  const buf = await wb.xlsx.writeBuffer()
  descargar(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nombreArchivo(d, 'xlsx'))
}

/* ----------------------------- PDF ----------------------------- */
export async function exportarPdf(d: DatosReporte) {
  const { jsPDF } = await import('jspdf')
  const hoja = construir(d)
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const W = 612, H = 792, M = 26
  const anchoPx = COLS.reduce((a, b) => a + b, 0)
  const altoPx = hoja.alturas.reduce((a, b) => a + b, 0) + 10
  const s = Math.min((W - 2 * M) / anchoPx, (H - 2 * M) / altoPx)
  const x0 = (W - anchoPx * s) / 2, y0 = M
  const colX = [0]; COLS.forEach((w, i) => colX.push(colX[i] + w))
  const rowY = [0]; hoja.alturas.forEach((h, i) => rowY.push(rowY[i] + h))
  doc.setLineWidth(0.5)
  for (const x of hoja.celdas) {
    const cx = x0 + colX[x.c] * s, cy = y0 + rowY[x.r] * s
    const w = (colX[x.c + (x.cs ?? 1)] - colX[x.c]) * s, h = (rowY[x.r + (x.rs ?? 1)] - rowY[x.r]) * s
    if (x.fondo) { const n = parseInt(x.fondo, 16); doc.setFillColor((n >> 16) & 255, (n >> 8) & 255, n & 255); doc.rect(cx, cy, w, h, 'F') }
    if (x.borde) { doc.setDrawColor(0); doc.rect(cx, cy, w, h, 'S') }
    let txt = x.v === null || x.v === undefined ? '' : typeof x.v === 'number' ? fmtNum(x.v, x.fmt) : x.v
    if (x.c === 12 && x.fmt === 'contable') txt = txt === '-' ? '$      -' : `$ ${txt}`
    if (!txt) continue
    const tam = (x.tam ?? 8) * (s / 0.72) * 0.96
    doc.setFont(x.fuente === 'serif' ? 'times' : 'helvetica', x.b ? 'bold' : 'normal')
    doc.setFontSize(tam)
    const n = parseInt(x.color ?? '000000', 16); doc.setTextColor((n >> 16) & 255, (n >> 8) & 255, n & 255)
    let t = txt
    while (t.length > 1 && doc.getTextWidth(t) > w - 4) t = t.slice(0, -1)
    const ty = cy + h / 2 + tam * 0.35
    if (x.al === 'center') doc.text(t, cx + w / 2, ty, { align: 'center' })
    else if (x.al === 'right') doc.text(t, cx + w - 2.5, ty, { align: 'right' })
    else doc.text(t, cx + 2.5, ty)
  }
  const logo = await logoDataUrl()
  if (logo) doc.addImage(logo, 'PNG', x0 + (colX[9] + 20) * s, y0 + 2 * s, 190 * s, 66 * s)
  doc.save(nombreArchivo(d, 'pdf'))
}
