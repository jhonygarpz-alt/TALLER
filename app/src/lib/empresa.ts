import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export interface Empresa { nombre: string; logoUrl: string | null }

let cache: Empresa | null = null
const oyentes = new Set<(e: Empresa) => void>()

async function cargar(): Promise<Empresa> {
  const { data } = await supabase.from('empresa').select('nombre, logo_path, updated_at').eq('id', 1).maybeSingle()
  const logoUrl = data?.logo_path
    ? `${supabase.storage.from('marca').getPublicUrl(data.logo_path).data.publicUrl}?v=${new Date(data.updated_at).getTime()}`
    : null
  cache = { nombre: data?.nombre ?? 'Admin Taller', logoUrl }
  oyentes.forEach(f => f(cache!))
  return cache
}

/** Nombre y logo de la empresa (compartidos por menú, login y encabezados) */
export function useEmpresa(): Empresa {
  const [e, setE] = useState<Empresa>(cache ?? { nombre: 'Admin Taller', logoUrl: null })
  useEffect(() => {
    oyentes.add(setE)
    if (!cache) cargar()
    return () => { oyentes.delete(setE) }
  }, [])
  return e
}

export const recargarEmpresa = cargar

/** Sube un nuevo logo (PNG, JPG, WEBP o SVG, máx. 2 MB) y lo registra */
export async function subirLogo(file: File) {
  if (file.size > 2 * 1024 * 1024) throw new Error('El logo debe pesar menos de 2 MB')
  const ext = (file.name.split('.').pop() ?? 'png').toLowerCase()
  const path = `logo-${Date.now()}.${ext}`
  const up = await supabase.storage.from('marca').upload(path, file, { contentType: file.type, upsert: false })
  if (up.error) throw up.error
  const { data: ant } = await supabase.from('empresa').select('logo_path').eq('id', 1).single()
  const { error } = await supabase.from('empresa').update({ logo_path: path, updated_at: new Date().toISOString() }).eq('id', 1)
  if (error) throw error
  if (ant?.logo_path) await supabase.storage.from('marca').remove([ant.logo_path])
  await cargar()
}

export async function quitarLogo() {
  const { data: ant } = await supabase.from('empresa').select('logo_path').eq('id', 1).single()
  const { error } = await supabase.from('empresa').update({ logo_path: null, updated_at: new Date().toISOString() }).eq('id', 1)
  if (error) throw error
  if (ant?.logo_path) await supabase.storage.from('marca').remove([ant.logo_path])
  await cargar()
}

export async function cambiarNombreEmpresa(nombre: string) {
  const { error } = await supabase.from('empresa').update({ nombre: nombre.trim() || 'Admin Taller', updated_at: new Date().toISOString() }).eq('id', 1)
  if (error) throw error
  await cargar()
}
