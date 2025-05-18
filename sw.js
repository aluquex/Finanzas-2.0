// sw.js
const CACHE_NAME = 'finanzas-pro-cache-v1.1'; // Incrementa la versión si cambias los archivos a cachear
const urlsToCache = [
    './', // La raíz, que servirá index.html
    './index.html',
    './style.css',
    './script.js',
    'imagenes/ahorro.png', // Asegúrate que esta ruta sea correcta
    'imagenes/contabilidad.png', // Asegúrate que esta ruta sea correcta
    'imagenes/ingresos.png', // Si añadiste este ícono
    'https://fonts.googleapis.com/css2?family=Orbitron:wght@700&family=Roboto:wght@300;400;700&display=swap',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.23/jspdf.plugin.autotable.min.js'
    // Puedes añadir aquí una página offline.html si la creas: './offline.html'
];

// Evento 'install': se dispara cuando el SW se instala por primera vez.
self.addEventListener('install', event => {
    console.log('[Service Worker] Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Cache abierto, cacheando archivos principales:', urlsToCache);
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.error('[Service Worker] Fallo al cachear durante la instalación:', error);
            })
            .then(() => {
                console.log('[Service Worker] Archivos principales cacheados correctamente.');
                return self.skipWaiting(); // Forzar activación inmediata del nuevo SW
            })
    );
});

// Evento 'activate': se dispara cuando el SW se activa.
// Se usa para limpiar cachés antiguas.
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activando...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Borrando caché antigua:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[Service Worker] Cachés antiguas limpiadas.');
            return self.clients.claim(); // Tomar control inmediato de las páginas abiertas
        })
    );
});

// Evento 'fetch': intercepta todas las peticiones de red.
self.addEventListener('fetch', event => {
    // No interceptar peticiones que no sean GET o que sean para extensiones de Chrome
    if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension://')) {
        event.respondWith(fetch(event.request));
        return;
    }
    
    // Estrategia: Cache First, then Network
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    // console.log('[Service Worker] Sirviendo desde caché:', event.request.url);
                    return cachedResponse;
                }

                // console.log('[Service Worker] Recurso no en caché, buscando en red:', event.request.url);
                return fetch(event.request).then(
                    networkResponse => {
                        // Comprobar si recibimos una respuesta válida para cachear
                        if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== 'basic' && networkResponse.type !== 'opaque' && networkResponse.type !== 'cors')) {
                            // console.log('[Service Worker] Respuesta de red no cacheable:', event.request.url, networkResponse);
                            return networkResponse;
                        }

                        // Clonar la respuesta para poder usarla y cachearla
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                // console.log('[Service Worker] Cacheando nuevo recurso:', event.request.url);
                                cache.put(event.request, responseToCache);
                            });
                        return networkResponse;
                    }
                ).catch(error => {
                    console.error('[Service Worker] Error en fetch y sin caché:', event.request.url, error);
                    // Aquí podrías devolver una página offline por defecto si la tienes cacheada
                    // return caches.match('./offline.html');
                    // Por ahora, simplemente dejamos que el error de red se propague
                    // para que el navegador muestre su página de error estándar.
                });
            })
    );
});