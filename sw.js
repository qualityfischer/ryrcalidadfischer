/* Fischer MSA Studio: permite abrir la aplicación sin señal después de la primera visita (requiere https).
   Para publicar una versión nueva, cambie VERSION: los equipos descargarán los archivos nuevos la próxima vez que tengan señal. */
const VERSION = 'msa-studio-v1';
const NUCLEO = ['./', 'index.html', 'rr.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(VERSION).then(c => c.addAll(NUCLEO)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);
    const propio = url.origin === self.location.origin, libreria = url.hostname === 'cdnjs.cloudflare.com';   // la librería de Excel también se guarda
    if (!propio && !libreria) return;
    e.respondWith(
        fetch(e.request).then(r => { if (r && (r.ok || r.type === 'opaque')) { const copia = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copia)); } return r; })
            .catch(() => caches.match(e.request).then(r => r || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error())))
    );
});
