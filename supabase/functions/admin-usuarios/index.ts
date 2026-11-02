// Administración de usuarios de TallerPro (alta y cambio de contraseña).
// Corre en el servidor con la clave de servicio, que nunca llega al navegador.
// Solo atiende a usuarios activos con el permiso "usuarios.gestionar".
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const ROLES = ['direccion', 'administracion', 'supervisor', 'compras', 'asesor', 'tecnico']

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Cliente con la sesión de quien llama: valida su identidad y su permiso
    const caller = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: quien } = await caller.auth.getUser()
    if (!quien?.user) return json({ error: 'Sesión no válida' }, 401)
    const { data: permitido, error: ePerm } = await caller.rpc('puede', { p: 'usuarios.gestionar' })
    if (ePerm || !permitido) return json({ error: 'No tienes permiso para administrar usuarios' }, 403)

    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
    const body = await req.json()
    const auditar = (registro: string, accion: string, despues: Record<string, unknown>) =>
      admin.from('auditoria').insert({ usuario_id: quien.user.id, tabla: 'usuarios', registro_id: registro, accion, despues })

    if (body.accion === 'crear') {
      const email = String(body.email ?? '').trim().toLowerCase()
      const nombre = String(body.nombre ?? '').trim()
      const rol = String(body.rol ?? '')
      const password = String(body.password ?? '')
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Correo no válido' }, 400)
      if (!nombre) return json({ error: 'Indica el nombre' }, 400)
      if (!ROLES.includes(rol)) return json({ error: 'Rol no válido' }, 400)
      if (password.length < 8) return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400)

      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nombre } })
      if (error) {
        const dup = /already|registered|exists/i.test(error.message)
        return json({ error: dup ? 'Ya existe un usuario con ese correo' : error.message }, 400)
      }
      // El trigger crea el perfil; aquí se fija el rol elegido y se activa
      const { error: eP } = await admin.from('perfiles').update({ nombre, rol, activo: true }).eq('id', data.user.id)
      if (eP) return json({ error: 'Usuario creado, pero no se pudo asignar el rol: ' + eP.message }, 500)
      await auditar(data.user.id, 'alta_usuario', { email, nombre, rol })
      return json({ id: data.user.id })
    }

    if (body.accion === 'password') {
      const id = String(body.id ?? '')
      const password = String(body.password ?? '')
      if (password.length < 8) return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400)
      const { error } = await admin.auth.admin.updateUserById(id, { password })
      if (error) return json({ error: error.message }, 400)
      await auditar(id, 'cambio_contrasena', { por: quien.user.email })
      return json({ ok: true })
    }

    return json({ error: 'Acción desconocida' }, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
