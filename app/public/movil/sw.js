// Service worker de la app móvil: guarda la "cáscara" de la app para abrir rápido y sin conexión.
// Los datos (Supabase) siempre se piden a la red; nunca se guardan en caché.
const CACHE = 'ordenes-v16'
self.addEventListener('install', e => { self.skipWaiting() })
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // Supabase, fuentes, etc.: directo a la red
  // Red primero, con límite: si la red no contesta en 5 s (señal débil) se abre con lo último guardado,
  // para que la app no se quede detenida en la pantalla de inicio. Sin copia guardada, se espera a la red.
  const red = fetch(req).then(res => {
    if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)) }
    return res
  })
  const guardado = () => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match(new URL('./', self.registration.scope).href) : undefined))
  e.respondWith(new Promise(resolve => {
    let listo = false
    const fin = r => { if (!listo && r) { listo = true; resolve(r) } }
    const t = setTimeout(() => guardado().then(fin), 5000)
    red.then(r => { clearTimeout(t); fin(r) }).catch(() => { clearTimeout(t); guardado().then(r => { if (r) fin(r); else if (!listo) { listo = true; resolve(Response.error()) } }) })
  }))
})
