// ORACLE Alpha Service Worker v1.0.0
const CACHE_NAME = 'oracle-alpha-v1';
const OFFLINE_URL = '/offline.html';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/landing.html',
  '/offline.html',
  '/manifest.json',
  '/assets/logo.svg',
  '/assets/banner.svg',
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip WebSocket and API requests (always go to network)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws')) {
    return;
  }

  // Skip chrome-extension and other non-http(s) protocols
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    // Try network first
    fetch(request)
      .then((response) => {
        // Clone response for caching
        const responseClone = response.clone();
        
        // Cache successful responses
        if (response.status === 200) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        
        return response;
      })
      .catch(async () => {
        // Network failed, try cache
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // If it's a navigation request, show offline page
        if (request.mode === 'navigate') {
          const offlineResponse = await caches.match(OFFLINE_URL);
          if (offlineResponse) {
            return offlineResponse;
          }
        }
        
        // Return a simple offline response
        return new Response('Offline - Please check your connection', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' }
        });
      })
  );
});

// Background sync for pending actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-signals') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(
      // Could sync pending trades or signal preferences
      Promise.resolve()
    );
  }
});

// Push notification handler
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'New signal detected!',
      icon: '/assets/icon-192.png',
      badge: '/assets/icon-192.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/index.html',
        signalId: data.signalId
      },
      actions: [
        { action: 'view', title: '👀 View Signal' },
        { action: 'dismiss', title: '❌ Dismiss' }
      ],
      tag: data.tag || 'oracle-signal',
      renotify: true
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || '🔮 ORACLE Alpha', options)
    );
  } catch (e) {
    console.error('[SW] Push notification error:', e);
  }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'dismiss') return;
  
  const url = event.notification.data?.url || '/index.html';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if found
        for (const client of clientList) {
          if (client.url.includes('oracle-alpha') && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// Message handler for client communication
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

console.log('[SW] Service worker loaded');
