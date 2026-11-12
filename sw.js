/* 책숲 v1.5: offline reading + optional cached Korean narration. */
const SHELL_CACHE = 'chaeksoop-shell-v1.5.0';
const AUDIO_CACHE = 'chaeksoop-korean-audio-v1';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './stories.js',
  './manifest.webmanifest',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(name => name.startsWith('chaeksoop-shell-') && name !== SHELL_CACHE)
        .map(name => caches.delete(name))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(request)
      .then(cached => cached || fetch(request).then(async response => {
        if (response.ok && url.pathname.includes('/chaeksoop/audio/')) {
          const audioCache = await caches.open(AUDIO_CACHE);
          await audioCache.put(request, response.clone());
        }
        return response;
      }))
      .catch(() => request.mode === 'navigate' ? caches.match('./index.html') : Response.error())
  );
});

let downloadingAudio = null;
self.addEventListener('message', event => {
  if (event.data?.type !== 'CACHE_KOREAN_AUDIO') return;
  const source = event.source;
  if (!source) return;
  if (!downloadingAudio) {
    downloadingAudio = cacheKoreanAudio(source).finally(() => { downloadingAudio = null; });
  }
  event.waitUntil(downloadingAudio);
});

async function cacheKoreanAudio(client) {
  const notify = payload => { try { client.postMessage(payload); } catch (_) {} };
  try {
    const response = await fetch(new URL('audio/files.json', self.registration.scope), {cache:'no-store'});
    if (!response.ok) throw new Error('Audio files are not published yet.');
    const list = await response.json();
    if (!Array.isArray(list) || list.length === 0 || list.length > 1000) {
      throw new Error('The audio file list is missing or invalid.');
    }
    const cache = await caches.open(AUDIO_CACHE);
    let done = 0;
    let failed = 0;
    for (const entry of list) {
      if (typeof entry !== 'string' || !/^audio\/[a-zA-Z0-9/_-]+\.mp3$/.test(entry)) {
        failed++;
        continue;
      }
      const url = new URL(entry, self.registration.scope);
      const request = new Request(url.toString(), {cache: 'reload'});
      if (!await cache.match(request)) {
        try {
          const clip = await fetch(request);
          if (!clip.ok) throw new Error('Audio file not found');
          await cache.put(request, clip);
        } catch (error) {
          failed++;
          console.warn('Audio cache failed:', entry, error);
        }
      }
      done++;
      if (done % 5 === 0 || done === list.length) {
        notify({type:'KOREAN_AUDIO_PROGRESS', done, total:list.length});
      }
    }
    notify({type:'KOREAN_AUDIO_COMPLETE', done:done - failed, failed});
  } catch(error) {
    notify({type:'KOREAN_AUDIO_ERROR', message:String(error.message || error)});
  }
}