/* 서재 · 서비스 워커 (오프라인 지원)
 * 배포할 때마다 CACHE 값을 올려 주세요. 올리면 모든 기기가 새 버전을 받아요. */
const CACHE = 'seoga-reader-v1.0.0';
const SCOPE = self.registration.scope;

const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
].map((p) => new URL(p, SCOPE).href);

const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    // 라이브러리는 실패해도 설치를 막지 않고, 사용 중 캐시되도록 둡니다.
    await Promise.allSettled(LIBS.map(async (url) => {
      const res = await fetch(url, { mode: 'cors' });
      if (res.ok) await cache.put(url, res);
    }));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req));
  } else if (url.hostname === 'cdnjs.cloudflare.com') {
    event.respondWith(cacheFirst(req));
  }
});

// 내 파일: 온라인이면 최신본을 받고 캐시를 갱신, 오프라인이면 캐시를 씁니다.
async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (_) {
    const hit = (await cache.match(req, { ignoreSearch: true })) ||
                (await cache.match(new URL('./index.html', SCOPE).href));
    return hit || new Response('오프라인 상태이고 캐시에 없는 파일이에요.', { status: 503 });
  }
}

// 외부 라이브러리: 한 번 받은 것은 캐시에서 바로 씁니다.
async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}
