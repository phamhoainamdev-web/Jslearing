/* Service worker cho Habit Checker.
   Chiến lược network-first: có mạng thì luôn lấy bản mới nhất (để cập nhật app
   không cần đổi tên cache), mất mạng thì trả bản đã cache — app vẫn mở được offline.
   Request ra ngoài (api.github.com...) đi thẳng mạng, không cache. */
'use strict';

const CACHE = 'habitchecker-shell-v1';
const ASSETS = ['./', './index.html', './habit-model.js', './manifest.json', './icon-512.png', './icon-maskable-512.png', './icon-180.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() =>
        caches.match(e.request, { ignoreSearch: true })
          .then((r) => r || caches.match('./index.html'))
      )
  );
});
