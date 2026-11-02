/** Descarga un archivo CSV compatible con Excel (UTF-8 con BOM, separador coma) */
export function descargarCSV(nombre: string, filas: Record<string, unknown>[], columnas?: { key: string; label: string }[]) {
  if (filas.length === 0) { alert('No hay datos para exportar con los filtros actuales.'); return }
  const cols = columnas ?? Object.keys(filas[0]).map(k => ({ key: k, label: k }))
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [cols.map(c => esc(c.label)).join(','), ...filas.map(f => cols.map(c => esc(f[c.key])).join(','))].join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${nombre}_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
