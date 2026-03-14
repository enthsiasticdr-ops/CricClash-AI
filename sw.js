const CACHE_NAME = 'cricclash-v4';
const ASSETS = [
    '/',
    '/index.html',
    '/battlefield.html',
    '/studio.html',
    '/quiz.html',
    '/style.css',
    '/app.js',
    '/js/supabase.js',
    '/js/auth.js',
    '/js/gamification.js',
    '/js/chat.js',
    '/js/social.js',
    '/js/engagement.js',
    '/js/memes.js',
    '/js/dm.js',
    '/js/quiz.js',
    '/images/logo.png',
    '/manifest.json'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
