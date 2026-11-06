// One-time retirement of legacy caches. New application does not register a SW.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('daily-movie')).map(k=>caches.delete(k)));
 await self.clients.claim();await self.registration.unregister();
})()));
