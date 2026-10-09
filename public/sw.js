const CACHE_NAME = 'alif-shohoj-print-v1';
const AUDIO_CACHE_NAME = 'alif-shohoj-audio-v1';

// Files to cache for offline support
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

const AUDIO_ASSETS = [
  '/audio/manifest.json',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
      caches.open(AUDIO_CACHE_NAME).then((cache) => cache.addAll(AUDIO_ASSETS)),
    ])
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== AUDIO_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Handle audio files - cache first strategy
  if (url.pathname.startsWith('/audio/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(AUDIO_CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => {
          // Offline fallback - return empty response for audio
          return new Response('', { status: 503, statusText: 'Offline' });
        });
      })
    );
    return;
  }

  // Handle API requests - network first, cache fallback for GET
  if (url.pathname.startsWith('/api/')) {
    if (event.request.method === 'GET') {
      event.respondWith(
        fetch(event.request)
          .then((response) => {
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
              });
            }
            return response;
          })
          .catch(() => caches.match(event.request))
      );
    } else {
      // POST requests (like TTS) - network only
      event.respondWith(fetch(event.request));
    }
    return;
  }

  // Handle other requests - network first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/index.html')))
  );
});

// Message handling for cache updates
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  
  if (event.data === 'clearAudioCache') {
    caches.delete(AUDIO_CACHE_NAME).then(() => {
      event.ports[0].postMessage({ success: true });
    });
  }
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-audio-manifest') {
    event.waitUntil(updateAudioManifest());
  }
});

async function updateAudioManifest() {
  try {
    const response = await fetch('/audio/manifest.json');
    if (response.ok) {
      const manifest = await response.json();
      const cache = await caches.open(AUDIO_CACHE_NAME);
      await cache.put('/audio/manifest.json', new Response(JSON.stringify(manifest)));
    }
  } catch (error) {
    console.warn('Failed to update audio manifest:', error);
  }
}