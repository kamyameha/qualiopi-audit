const CACHE='entre-deux-qualiopi-secours-v5';
const SECOURS=['./','./index.html','./css/main.css','./css/site-alignment.css','./css/audit-ui.css','./js/app.js','./js/version.js','./data/qualiopi.json','./assets/logo-entre-deux.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SECOURS))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{if(e.data?.type==='ACTIVER_MAINTENANT')self.skipWaiting()});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const copie=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copie));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))))});