// Sistema web ADMIN TALLER: solo notificaciones push (sin caché ni intercepción de red)
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))
self.addEventListener('push', e => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch { d = { title: 'Taller', body: e.data ? e.data.text() : '' } }
  const icono = new URL('gerencia/icon-192.png', self.registration.scope).href
  e.waitUntil(self.registration.showNotification(d.title || 'ADMIN TALLER', {
    body: d.body || '', tag: d.tag, renotify: true, icon: icono, badge: icono, data: { url: d.url || self.registration.scope },
  }))
})
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const destino = (e.notification.data && e.notification.data.url) || self.registration.scope
  const gerencia = new URL('gerencia/', self.registration.scope).href
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ventanas => {
    for (const v of ventanas) if (v.url.startsWith(self.registration.scope) && !v.url.startsWith(gerencia) && !/\/(movil|tecnicos|cliente)\//.test(v.url)) { v.navigate(destino); return v.focus() }
    return self.clients.openWindow(destino)
  }))
})
