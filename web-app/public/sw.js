/* Public-only shell. Never cache navigations, APIs, RSC payloads, files or chat. */
const CACHE='ohmi-app-public-shell-v2';
const PUBLIC_SHELL=['/app/offline.html','/app/mascot.png','/app/icons/icon-192.png','/app/icons/icon-512.png','/app/icons/icon-maskable-512.png','/app/icons/apple-touch-icon.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PUBLIC_SHELL))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('ohmi-app-public-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||url.search||!url.pathname.startsWith('/app/'))return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).catch(()=>caches.match('/app/offline.html')));return;
  }
  if(PUBLIC_SHELL.includes(url.pathname))event.respondWith(caches.open(CACHE).then(cache=>cache.match(request)).then(cached=>cached||fetch(request)));
});
