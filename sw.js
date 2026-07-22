const CACHE='entre-deux-qualiopi-secours-v19';
const SECOURS=['./','./index.html','./css/main.css?v=1.0.9','./css/site-alignment.css?v=1.0.9','./css/audit-ui.css?v=1.0.9','./js/app.js?v=1.0.9','./js/version.js?v=1.0.9','./js/supabase-config.js','./js/supabase-service.js?v=1.0.9','./data/qualiopi.json','./assets/logo-entre-deux.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SECOURS))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{if(e.data?.type==='ACTIVER_MAINTENANT')self.skipWaiting()});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const copie=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copie));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))))});
