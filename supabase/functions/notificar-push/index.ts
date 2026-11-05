// Envía notificaciones push (Web Push) a los celulares del técnico.
// Dos formas de llamarla:
//  1) Desde la base de datos (disparador en actividades) con el encabezado x-webhook-secret:
//     { tipo: 'asignado' | 'retrabajo', actividad_id }
//     { tipo: 'cliente_listo' | 'cliente_encuesta', orden_id } → avisos a la app del cliente
//     { tipo: 'gerencia_ingreso' | 'gerencia_entrega' | 'gerencia_encuesta', orden_id } | { tipo: 'gerencia_resumen' } → app de gerencia
//  2) Desde la app, con la sesión del usuario: { tipo: 'prueba' } → aviso de prueba a sus propios celulares.
// Las llaves VAPID se leen de Supabase Vault mediante push_config() (solo service_role).
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const APP_URL = 'https://jhonygarpz-alt.github.io/TALLER/tecnicos/'
const APP_CLIENTE = 'https://jhonygarpz-alt.github.io/TALLER/cliente/'
const APP_GERENCIA = 'https://jhonygarpz-alt.github.io/TALLER/gerencia/'
const TZ = 'America/Mexico_City'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    const { data: cfg, error: eCfg } = await admin.rpc('push_config')
    if (eCfg || !cfg?.vapid_privada) return json({ error: 'Notificaciones no configuradas' }, 500)
    webpush.setVapidDetails(APP_URL, cfg.vapid_publica, cfg.vapid_privada)

    const body = await req.json().catch(() => ({}))
    let perfilId: string | null = null
    let aviso: { title: string; body: string; url: string; tag: string }
    // deno-lint-ignore no-explicit-any
    let subs: any[] | null = null
    let tablaSubs = 'push_suscripciones'

    if (req.headers.get('x-webhook-secret') && String(body.tipo ?? '').startsWith('cliente_')) {
      if (req.headers.get('x-webhook-secret') !== cfg.push_webhook) return json({ error: 'No autorizado' }, 401)
      const { data: o } = await admin.from('ordenes').select('id, folio, vehiculo_id, vehiculos(marca, modelo, placas)').eq('id', body.orden_id).single()
      // deno-lint-ignore no-explicit-any
      const ord = o as any
      if (!ord) return json({ ok: true, omitido: 'orden no encontrada' })
      const v = ord.vehiculos
      const auto = v ? `${v.marca} ${v.modelo}${v.placas ? ` (${v.placas})` : ''}` : 'Tu vehículo'
      aviso = body.tipo === 'cliente_listo'
        ? { title: '🚗 ¡Tu vehículo está listo!', body: `${auto} ya está listo para entregarse. Te esperamos en el taller.`, url: APP_CLIENTE, tag: `orden-${ord.id}` }
        : { title: '⭐ ¿Cómo te atendimos?', body: `Gracias por confiar en nosotros. Califica el servicio de tu ${auto}; solo toma un minuto.`, url: `${APP_CLIENTE}#/encuesta/${ord.id}`, tag: `encuesta-${ord.id}` }
      tablaSubs = 'cliente_push'
      subs = (await admin.from('cliente_push').select('id, endpoint, p256dh, auth').eq('vehiculo_id', ord.vehiculo_id)).data
    } else if (req.headers.get('x-webhook-secret') && String(body.tipo ?? '').startsWith('gerencia_')) {
      if (req.headers.get('x-webhook-secret') !== cfg.push_webhook) return json({ error: 'No autorizado' }, 401)
      const tipo = String(body.tipo)
      if (tipo === 'gerencia_resumen') {
        const hoy = new Date().toLocaleDateString('en-CA', { timeZone: TZ })
        const { data: d, error: eD } = await admin.rpc('_gerencia_datos', { p_desde: hoy, p_hasta: hoy, p_finanzas: false })
        if (eD) throw eD
        const x = (d as { dia: Record<string, number> }).dia
        aviso = { title: '📊 Resumen del día', body: `Ingresaron ${x.ingresos} · Entregados ${x.entregas}\nEn taller ${x.en_taller} · Retrasados ${x.retrasados} · Listos ${x.listos}`, url: APP_GERENCIA, tag: `resumen-${hoy}` }
      } else {
        const { data: o } = await admin.from('v_ordenes').select('id, folio, tipo, marca, modelo, placas, aseguradora_nombre, dias_en_taller, satisfaccion, encuesta_comentario, cliente_nombre').eq('id', body.orden_id).single()
        // deno-lint-ignore no-explicit-any
        const ord = o as any
        if (!ord) return json({ ok: true, omitido: 'orden no encontrada' })
        const auto = `${ord.marca} ${ord.modelo}${ord.placas ? ` · ${ord.placas}` : ''}`
        const origen = ord.tipo === 'aseguradora' ? (ord.aseguradora_nombre ?? 'Aseguradora') : 'Particular'
        aviso = tipo === 'gerencia_ingreso'
          ? { title: '🚗 Ingresó un vehículo', body: `${ord.folio} · ${auto}\n${origen}`, url: APP_GERENCIA, tag: `g-ing-${ord.id}` }
          : tipo === 'gerencia_entrega'
          ? { title: '✅ Vehículo entregado', body: `${ord.folio} · ${auto}\n${origen} · ${ord.dias_en_taller} días en taller`, url: APP_GERENCIA, tag: `g-ent-${ord.id}` }
          : { title: `⚠️ Calificación baja: ${'★'.repeat(ord.satisfaccion ?? 0)}`, body: `${ord.folio} · ${auto} · ${ord.cliente_nombre}${ord.encuesta_comentario ? `\n“${ord.encuesta_comentario}”` : ''}`, url: APP_GERENCIA, tag: `g-enc-${ord.id}` }
      }
      // Destinatarios: celulares de la app de gerencia de usuarios activos con permiso de reportes que aceptan este aviso
      const { data: s } = await admin.from('push_suscripciones').select('id, endpoint, p256dh, auth, avisos, perfiles(rol, activo)').eq('app', 'gerencia')
      const { data: rp } = await admin.from('rol_permisos').select('rol').eq('permiso', 'reportes.ver')
      const roles = new Set(['direccion', ...(rp ?? []).map((r: { rol: string }) => r.rol)])
      const clave = tipo.replace('gerencia_', '')
      // deno-lint-ignore no-explicit-any
      subs = (s ?? []).filter((x: any) => x.perfiles?.activo && roles.has(x.perfiles.rol) && (!x.avisos || x.avisos.includes(clave)))
    } else if (req.headers.get('x-webhook-secret')) {
      if (req.headers.get('x-webhook-secret') !== cfg.push_webhook) return json({ error: 'No autorizado' }, 401)
      const { data: a } = await admin.from('actividades')
        .select('id, actividad, pieza, importe_destajo, motivo_rechazo, tecnicos(perfil_id, nombre), ordenes(folio, vehiculos(marca, modelo, placas, color))')
        .eq('id', body.actividad_id).single()
      // deno-lint-ignore no-explicit-any
      const act = a as any
      if (!act?.tecnicos?.perfil_id) return json({ ok: true, omitido: 'técnico sin usuario' })
      perfilId = act.tecnicos.perfil_id
      const v = act.ordenes?.vehiculos
      const auto = v ? `${v.marca} ${v.modelo}${v.placas ? ` · ${v.placas}` : ''}${v.color ? ` · ${v.color}` : ''}` : act.ordenes?.folio
      const trabajo = `${act.actividad}${act.pieza ? ` (${act.pieza})` : ''}`
      aviso = body.tipo === 'retrabajo'
        ? { title: '⚠️ Retrabajo solicitado', body: `${trabajo} · ${auto}${act.motivo_rechazo ? `\nMotivo: ${act.motivo_rechazo}` : ''}`, url: `${APP_URL}#/trabajo/${act.id}`, tag: `act-${act.id}` }
        : { title: '🔧 Nuevo trabajo asignado', body: `${trabajo}\n${auto} · ${act.ordenes?.folio ?? ''}`, url: `${APP_URL}#/trabajo/${act.id}`, tag: `act-${act.id}` }
    } else {
      // Prueba solicitada por el propio usuario
      const usuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
      const { data: u } = await usuario.auth.getUser()
      if (!u?.user || body.tipo !== 'prueba') return json({ error: 'No autorizado' }, 401)
      perfilId = u.user.id
      const app = body.app === 'gerencia' ? 'gerencia' : 'tecnicos'
      aviso = app === 'gerencia'
        ? { title: '✅ Notificaciones activadas', body: 'Te avisaremos de ingresos, entregas, calificaciones bajas y el resumen del día.', url: APP_GERENCIA, tag: 'prueba' }
        : { title: '✅ Notificaciones activadas', body: 'Así te avisaremos cuando te asignen un trabajo.', url: APP_URL, tag: 'prueba' }
      subs = (await admin.from('push_suscripciones').select('id, endpoint, p256dh, auth').eq('perfil_id', perfilId).eq('app', app)).data
    }

    if (!subs) subs = (await admin.from('push_suscripciones').select('id, endpoint, p256dh, auth').eq('perfil_id', perfilId).eq('app', 'tecnicos')).data
    let enviados = 0, fallidos = 0
    const errores: string[] = []
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(aviso), { TTL: 86400, urgency: 'high' })
        enviados++
      } catch (e) {
        fallidos++
        const code = (e as { statusCode?: number }).statusCode
        errores.push(String(code ?? (e as Error).message))
        if (code === 404 || code === 410) await admin.from(tablaSubs).delete().eq('id', s.id) // celular dado de baja
      }
    }
    await admin.from('push_envios').insert({ tipo: body.tipo ?? 'desconocido', actividad_id: body.actividad_id ?? null, perfil_id: perfilId, enviados, fallidos, detalle: [body.orden_id ? `orden ${body.orden_id}` : '', ...errores].filter(Boolean).join(', ') || null })
    return json({ ok: true, enviados, fallidos })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
