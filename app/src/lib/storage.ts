import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const BUCKET = 'evidencias'
const cache = new Map<string, { url: string; exp: number }>()

export async function urlFirmada(path: string): Promise<string | null> {
  const c = cache.get(path)
  if (c && c.exp > Date.now()) return c.url
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  if (!data) return null
  cache.set(path, { url: data.signedUrl, exp: Date.now() + 3500_000 })
  return data.signedUrl
}

export function useUrlFirmada(path?: string | null) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    if (path) urlFirmada(path).then(u => vivo && setUrl(u))
    else setUrl(null)
    return () => { vivo = false }
  }, [path])
  return url
}

/** Reduce fotografías grandes a máx. 1600px para que la captura sea rápida desde el celular */
async function comprimir(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/heic' || file.size < 600_000) return file
  try {
    const bmp = await createImageBitmap(file)
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * k); canvas.height = Math.round(bmp.height * k)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((res) => canvas.toBlob(b => res(b ?? file), 'image/jpeg', 0.82))
  } catch { return file }
}

export type CategoriaFoto = 'recepcion' | 'diagnostico' | 'dano' | 'actividad' | 'entrega' | 'conformidad' | 'pieza_retirada' | 'proceso' | 'factura'

export async function subirFoto(file: File, ordenId: number, categoria: CategoriaFoto, refId?: number | null, descripcion?: string) {
  const blob = await comprimir(file)
  const ext = blob.type === 'application/pdf' ? 'pdf' : blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `ordenes/${ordenId}/${categoria}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false })
  if (up.error) throw up.error
  const { error } = await supabase.from('fotos').insert({ orden_id: ordenId, categoria, ref_id: refId ?? null, path, descripcion: descripcion || null })
  if (error) throw error
  return path
}
