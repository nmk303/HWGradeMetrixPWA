const CACHE_NAME = 'grade-calculator-v1.0.2'; // Updated version with all icons and new logo
const urlsToCache = [
  './',
  './index.html',
  './js/xlsx.full.min.js',
  './Logo G.png',
  // Windows 11 Icons from manifest
  './windows11/SmallTile.scale-100.png',
  './windows11/SmallTile.scale-125.png',
  './windows11/SmallTile.scale-150.png',
  './windows11/SmallTile.scale-200.png',
  './windows11/SmallTile.scale-400.png',
  './windows11/Square150x150Logo.scale-100.png',
  './windows11/Square150x150Logo.scale-125.png',
  './windows11/Square150x150Logo.scale-150.png',
  './windows11/Square150x150Logo.scale-200.png',
  './windows11/Square150x150Logo.scale-400.png',
  './windows11/Wide310x150Logo.scale-100.png',
  './windows11/Wide310x150Logo.scale-125.png',
  './windows11/Wide310x150Logo.scale-150.png',
  './windows11/Wide310x150Logo.scale-200.png',
  './windows11/Wide310x150Logo.scale-400.png',
  './windows11/LargeTile.scale-100.png',
  './windows11/LargeTile.scale-125.png',
  './windows11/LargeTile.scale-150.png',
  './windows11/LargeTile.scale-200.png',
  './windows11/LargeTile.scale-400.png',
  './windows11/Square44x44Logo.scale-100.png',
  './windows11/Square44x44Logo.scale-125.png',
  './windows11/Square44x44Logo.scale-150.png',
  './windows11/Square44x44Logo.scale-200.png',
  './windows11/Square44x44Logo.scale-400.png',
  './windows11/StoreLogo.scale-100.png',
  './windows11/StoreLogo.scale-125.png',
  './windows11/StoreLogo.scale-150.png',
  './windows11/StoreLogo.scale-200.png',
  './windows11/StoreLogo.scale-400.png',
  './windows11/SplashScreen.scale-100.png',
  './windows11/SplashScreen.scale-125.png',
  './windows11/SplashScreen.scale-150.png',
  './windows11/SplashScreen.scale-200.png',
  './windows11/SplashScreen.scale-400.png',

  // Android Icons from manifest
  './android/android-launchericon-512-512.png',
  './android/android-launchericon-192-192.png',
  './android/android-launchericon-144-144.png',
  './android/android-launchericon-96-96.png',
  './android/android-launchericon-72-72.png',
  './android/android-launchericon-48-48.png',

  // iOS Icons from manifest
  './ios/1024.png',
  './ios/512.png',
  './ios/192.png',
  './ios/180.png',
  './ios/167.png',
  './ios/152.png',
  './ios/144.png',
  './ios/120.png'
];


// Installation
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Remove old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Serve from cache if available
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});