const CACHE="life-tracker-no-money-v9";
const CORE=["./","./index.html","./style.css?v=9","./app.js?v=9","./manifest.webmanifest","./icon-192.png","./icon-512.png"];
self.addEventListener("install",event=>event.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(CORE);await self.skipWaiting();})()));
self.addEventListener("activate",event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim();})()));
self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET")return;
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin)return;
 event.respondWith((async()=>{
  try{const response=await fetch(event.request,{cache:"no-store"});if(response&&response.ok){const c=await caches.open(CACHE);c.put(event.request,response.clone());}return response;}
  catch(error){const cached=await caches.match(event.request);if(cached)return cached;return caches.match("./index.html");}
 })());
});
