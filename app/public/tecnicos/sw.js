// Service worker de la app de técnicos: guarda la "cáscara" de la app para abrir rápido y sin conexión.
// Los datos (Supabase) siempre se piden a la red; nunca se guardan en caché.
const CACHE = 'tecnicos-v5'
self.addEventListener('install', e => { self.skipWaiting() })
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // Supabase, fuentes, etc.: directo a la red
  // Red primero; si no hay conexión, lo último guardado
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)) }
      return res
    }).catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match(new URL('./', self.registration.scope).href) : undefined)))
  )
})

// ---- Notificaciones push: nuevo trabajo asignado / retrabajo ----
self.addEventListener('push', e => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch { d = { title: 'Taller', body: e.data ? e.data.text() : '' } }
  e.waitUntil(self.registration.showNotification(d.title || 'Taller · Técnicos', {
    body: d.body || '', tag: d.tag, renotify: true, requireInteraction: true,
    icon: new URL('icon-192.png', self.registration.scope).href, badge: new URL('icon-192.png', self.registration.scope).href,
    vibrate: [200, 100, 200], data: { url: d.url || self.registration.scope },
  }))
})
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const destino = (e.notification.data && e.notification.data.url) || self.registration.scope
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ventanas => {
    for (const v of ventanas) if (v.url.startsWith(self.registration.scope)) { v.navigate(destino); return v.focus() }
    return self.clients.openWindow(destino)
  }))
})
