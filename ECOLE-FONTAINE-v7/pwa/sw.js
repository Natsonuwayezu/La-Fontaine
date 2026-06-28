// pwa/sw.js
// Service Worker for PWA functionality

const CACHE_NAME = 'ecole-la-fontaine-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/offline.html',
    '/css/app.css',
    '/js/core/app.js',
    '/js/core/state.js',
    '/js/core/router.js',
    '/js/core/auth.js',
    '/js/core/supabase-client.js',
    '/js/core/utils.js',
    '/js/ui/sidebar.js',
    '/js/ui/topbar.js',
    '/js/ui/modals.js',
    '/js/modules/dashboard.js',
    '/assets/logos/school-logo.png'
];

// Install event - cache assets
self.addEventListener('install', event => {
    console.log('[SW] Install');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Caching app assets');
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
    console.log('[SW] Activate');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);

    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        event.respondWith(fetch(event.request));
        return;
    }

    // Skip API calls
    if (requestUrl.pathname.includes('/rest/v1/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Skip Supabase calls
    if (requestUrl.hostname.includes('supabase.co')) {
        event.respondWith(fetch(event.request));
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }

                return fetch(event.request)
                    .then(response => {
                        // Don't cache non-successful responses
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch(() => {
                        // Return offline page for navigation requests
                        if (event.request.mode === 'navigate') {
                            return caches.match('/offline.html');
                        }
                        return new Response('Offline - Please check your connection');
                    });
            })
    );
});

// Background sync for offline marks
self.addEventListener('sync', event => {
    console.log('[SW] Sync event:', event.tag);
    if (event.tag === 'sync-marks') {
        event.waitUntil(syncOfflineMarks());
    }
});

// Push notification handler
self.addEventListener('push', event => {
    console.log('[SW] Push notification received');
    const options = {
        body: event.data ? event.data.text() : 'New notification',
        icon: '/assets/logos/icon-192.png',
        badge: '/assets/logos/icon-72.png',
        vibrate: [200, 100, 200],
        data: {
            url: '/'
        }
    };

    event.waitUntil(
        self.registration.showNotification('ECOLE LA FONTAINE', options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
    console.log('[SW] Notification click');
    event.notification.close();

    event.waitUntil(
        clients.openWindow(event.notification.data.url || '/')
    );
});

// Function to sync offline marks (would need to import or communicate with main thread)
async function syncOfflineMarks() {
    // This would communicate with the main thread via postMessage
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage({
            type: 'SYNC_MARKS',
            payload: {}
        });
    });
}