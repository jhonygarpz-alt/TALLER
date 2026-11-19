// Foto real del vehículo para la app del cliente (Mi Auto).
// El cliente no tiene usuario del sistema: se valida su token de acceso (cliente_accesos) y se devuelve
// un enlace temporal (1 hora) a la foto de recepción de SU vehículo. No expone ninguna otra foto.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  try {
    const { token } = await req.json().catch(() => ({}))
    if (typeof token !== 'string' || !UUID.test(token)) return json({ error: 'Acceso no válido' }, 401)
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

    const { data: acc } = await admin.from('cliente_accesos').select('vehiculo_id').eq('token', token).gt('expira', new Date().toISOString()).maybeSingle()
    if (!acc) return json({ error: 'SESION_VENCIDA' }, 401)

    // Órdenes del vehículo (la más reciente primero) y su primera foto de recepción
    const { data: ords } = await admin.from('ordenes').select('id').eq('vehiculo_id', acc.vehiculo_id).neq('etapa', 'cancelado').order('fecha_ingreso', { ascending: false }).limit(10)
    const ids = (ords ?? []).map(o => o.id)
    if (!ids.length) return json({ url: null })
    const { data: fotos } = await admin.from('fotos').select('orden_id,path').in('orden_id', ids).eq('categoria', 'recepcion').order('id').limit(50)
    let path: string | null = null
    for (const id of ids) { const f = (fotos ?? []).find(x => x.orden_id === id); if (f) { path = f.path; break } }
    if (!path) return json({ url: null })

    const { data: firmado, error } = await admin.storage.from('evidencias').createSignedUrl(path, 3600)
    if (error) return json({ url: null })
    return json({ url: firmado.signedUrl })
  } catch (_e) {
    return json({ error: 'No se pudo cargar la foto' }, 500)
  }
})
