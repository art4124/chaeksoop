/* 책숲 v1.8: offline reader and Korean MP3 audio, including iOS byte-range playback. */
const SHELL_CACHE = 'chaeksoop-shell-v1.8.0';
const AUDIO_CACHE = 'chaeksoop-korean-audio-v1';
const SHELL = [
  './', './index.html', './styles.css', './app.js', './stories.js',
  './audio/index.js', './audio/files.json', './manifest.webmanifest',
  './assets/icon-192.png', './assets/icon-512.png'
];
const AUDIO_PATH = new URL('audio/', self.registration.scope).pathname;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(name => name.startsWith('chaeksoop-shell-') && name !== SHELL_CACHE)
      .map(name => caches.delete(name))
  )).then(() => self.clients.claim()));
});

async function shellResponse(request, refresh = false) {
  const cache = await caches.open(SHELL_CACHE);
  if (!refresh) {
    const saved = await cache.match(request);
    if (saved) return saved;
  }
  try {
    const reply = await fetch(request);
    if (reply.ok) await cache.put(request, reply.clone());
    return reply;
  } catch (_) {
    return (await cache.match(request)) ||
      (request.mode === 'navigate' ? await cache.match('./index.html') : Response.error());
  }
}

async function recordedResponse(request) {
  const cache = await caches.open(AUDIO_CACHE);
  let whole = await cache.match(request.url);
  if (!whole) {
    try {
      // A range-free request obtains the whole MP3 for reliable offline caching.
      const response = await fetch(new Request(request.url, {cache: 'no-store'}));
      if (!response.ok || response.status !== 200) return response;
      await cache.put(request.url, response.clone());
      whole = response;
    } catch (_) {
      return Response.error();
    }
  }
  const range = request.headers.get('range');
  if (!range) return whole;
  // Safari can request 'Range: bytes=0-'. Cached MP3 files must reply 206.
  const data = await whole.arrayBuffer();
  const length = data.byteLength;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) return new Response(null, {status: 416, headers: {'Content-Range': 'bytes */' + length}});
  const suffix = !match[1] && match[2];
  const start = suffix ? Math.max(0, length - Number(match[2])) : Number(match[1] || 0);
  const end = suffix ? length - 1 : Math.min(length - 1, Number(match[2] || length - 1));
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= length || start > end) {
    return new Response(null, {status: 416, headers: {'Content-Range': 'bytes */' + length}});
  }
  return new Response(data.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': whole.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': 'bytes ' + start + '-' + end + '/' + length,
      'Accept-Ranges': 'bytes',
      'Content-Length': String(end - start + 1)
    }
  });
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith(AUDIO_PATH) && url.pathname.endsWith('.mp3')) {
    event.respondWith(recordedResponse(req));
  } else if (url.pathname === AUDIO_PATH + 'index.js' ||
             url.pathname === AUDIO_PATH + 'files.json') {
    // A new audio build must not be hidden by a stale cached word index.
    event.respondWith(shellResponse(req, true));
  } else {
    event.respondWith(shellResponse(req));
  }
});

let downloadingAudio = null;
self.addEventListener('message', event => {
  if (event.data?.type !== 'CACHE_KOREAN_AUDIO' || !event.source) return;
  if (!downloadingAudio) {
    downloadingAudio = cacheKoreanAudio(event.source).finally(() => { downloadingAudio = null; });
  }
  event.waitUntil(downloadingAudio);
});

async function cacheKoreanAudio(client) {
  const notify = detail => { try { client.postMessage(detail); } catch (_) {} };
  try {
    const response = await fetch(new URL('audio/files.json', self.registration.scope), {cache: 'no-store'});
    if (!response.ok) throw new Error('The audio list is not published yet.');
    const list = await response.json();
    if (!Array.isArray(list) || !list.length || list.length > 2500) throw new Error('Invalid offline audio list');
    const cache = await caches.open(AUDIO_CACHE);
    const total = list.length;
    let next = 0, done = 0, failed = 0;
    const downloadWorker = async () => {
      while (next < total) {
        const entry = list[next++];
        try {
          if (typeof entry !== 'string' || !/^audio\/[a-zA-Z0-9/_-]+\.mp3$/.test(entry)) {
            throw new Error('Invalid audio file path');
          }
          const url = new URL(entry, self.registration.scope).href;
          if (!await cache.match(url)) {
            const clip = await fetch(url, {cache: 'no-store'});
            if (!clip.ok || clip.status !== 200) throw new Error('MP3 not available');
            await cache.put(url, clip);
          }
        } catch (error) {
          failed++;
          console.warn('Audio download error:', entry, error);
        }
        done++;
        if (done % 15 === 0 || done === total) notify({type:'KOREAN_AUDIO_PROGRESS', done, total});
      }
    };
    await Promise.all(Array.from({length: 5}, () => downloadWorker()));
    notify({type:'KOREAN_AUDIO_COMPLETE', done: total - failed, failed});
  } catch (error) {
    notify({type:'KOREAN_AUDIO_ERROR', message: String(error.message || error)});
  }
}