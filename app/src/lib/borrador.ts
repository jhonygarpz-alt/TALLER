import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Borradores locales: guarda en el navegador (IndexedDB) lo que se va capturando en un formulario largo,
 * incluidas las fotos, para no perderlo si se cierra la pestaña, se recarga, se va la señal o expira la sesión.
 * Solo vive en este equipo y navegador; se borra al guardar la orden o al descartarlo.
 */
const DB = 'admin-taller', STORE = 'borradores'
const VIGENCIA_DIAS = 14

function abrir(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE) }
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}
async function op<T>(modo: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  try {
    const db = await abrir()
    return await new Promise<T | undefined>((res, rej) => {
      const tx = db.transaction(STORE, modo)
      const req = f(tx.objectStore(STORE))
      req.onsuccess = () => res(req.result as T)
      req.onerror = () => rej(req.error)
    })
  } catch { return undefined }   // sin IndexedDB (modo privado estricto): el formulario sigue funcionando sin borrador
}
export const leerBorrador = <T,>(clave: string) => op<{ guardado: number; datos: T }>('readonly', s => s.get(clave))
export const guardarBorrador = <T,>(clave: string, datos: T) => op('readwrite', s => s.put({ guardado: Date.now(), datos }, clave))
export const borrarBorrador = (clave: string) => op('readwrite', s => s.delete(clave))

/**
 * Autoguardado de un formulario.
 * - `datos`: estado actual a guardar; `conContenido`: si ya hay algo capturado que valga la pena guardar.
 * - Al abrir, si hay un borrador previo, lo expone en `pendiente` y pausa el autoguardado hasta que el usuario
 *   decida continuar (`restaurar`) o empezar de nuevo (`descartar`).
 */
export function useBorrador<T>(clave: string | null, datos: T, conContenido: boolean) {
  const [pendiente, setPendiente] = useState<{ guardado: number; datos: T } | null>(null)
  const [listo, setListo] = useState(false)          // ya se revisó si había borrador
  const [ultimo, setUltimo] = useState<number | null>(null)
  const decidido = useRef(false)

  useEffect(() => {
    if (!clave) return
    let vivo = true
    leerBorrador<T>(clave).then(b => {
      if (!vivo) return
      if (b && Date.now() - b.guardado < VIGENCIA_DIAS * 86400000) setPendiente(b)
      else { if (b) borrarBorrador(clave); decidido.current = true }
      setListo(true)
    })
    return () => { vivo = false }
  }, [clave])

  // Autoguardado (medio segundo después del último cambio)
  useEffect(() => {
    if (!clave || !listo || !decidido.current || !conContenido) return
    const t = setTimeout(() => { guardarBorrador(clave, datos).then(() => setUltimo(Date.now())) }, 500)
    return () => clearTimeout(t)
  }, [clave, listo, datos, conContenido])

  const restaurar = useCallback(() => { const d = pendiente?.datos ?? null; decidido.current = true; setPendiente(null); return d }, [pendiente])
  const descartar = useCallback(() => { decidido.current = true; setPendiente(null); if (clave) borrarBorrador(clave) }, [clave])
  const limpiar = useCallback(() => clave ? borrarBorrador(clave) : Promise.resolve(undefined), [clave])
  return { pendiente, restaurar, descartar, limpiar, ultimo }
}

export const horaCorta = (ms: number) => {
  const d = new Date(ms), hoy = new Date()
  const h = d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })
  return d.toDateString() === hoy.toDateString() ? `hoy ${h}` : `${d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} ${h}`
}
