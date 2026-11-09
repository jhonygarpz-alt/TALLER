// Service worker de la app móvil: guarda la "cáscara" de la app para abrir rápido y sin conexión.
// Los datos (Supabase) siempre se piden a la red; nunca se guardan en caché.
const CACHE = 'ordenes-v4'
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
