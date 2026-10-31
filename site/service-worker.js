'use strict';
const CACHE_ID = 'addy-public-crypto15-shell-27ae2355fac36c1e';
const CACHE_PREFIX = 'addy-public-crypto15-shell-';
const SHELL_FILES = ['/', '/offline.html','/assets/app.css','/assets/app.js','/assets/model.js','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png'];
const PRECACHE_SET = new Set(SHELL_FILES);
const SHELL_HASHES = {"/": "0017aa62c2a1ddd4f6c550d5ec7fc6836408af7db22fe081b22085721fe8381c", "/assets/app.css": "7e95745ff660d14b29022dbb69ac624d0a2d4a8b763769575336bb756e11dc8d", "/assets/app.js": "fdeb59dd862672efe72689071d6319bcbf4241b63004ce293b5de9928df79999", "/assets/model.js": "ec6b53e8b95c628b629f7bc789ef929e4b3621be316c32d9d33f6e72fabbd6d4", "/icons/icon-192.png": "ec4fdc6c8d087a917ad8090368bc72409dd4c38db0f64c21bea8f4cb9f1f344e", "/icons/icon-512.png": "43bdcc94d05a395c7f8ef6d0396770733fdb74961ff9eb8ede7a2a406e3601c9", "/manifest.webmanifest": "d4a47f48f21522e6f95a49b15b1050f4135b6c6d992f1102a2f6e0dc636c5d42", "/offline.html": "592ffed0e9082b09b7e0216b9dfdded7f5c19f8420d37aece420d8779a36e1bc"};
self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    // Validate the complete release before placing any response in its cache.
    const verified=[];
    for(const path of SHELL_FILES){
      const response=await fetch(path,{cache:'no-store',redirect:'error'});
      if(!response.ok)throw new Error('SHELL_INTEGRITY_HTTP');
      const digest=await crypto.subtle.digest('SHA-256',await response.clone().arrayBuffer());
      const hex=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
      if(hex!==SHELL_HASHES[path])throw new Error('SHELL_INTEGRITY_MISMATCH');
      verified.push([path,response]);
    }
    const cache=await caches.open(CACHE_ID);
    for(const [path,response] of verified)await cache.put(path,response);
  })());
});
self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const names=await caches.keys();
    await Promise.all(names.filter(n=>n.startsWith(CACHE_PREFIX)&&n!==CACHE_ID).map(n=>caches.delete(n)));
    await self.clients.claim();
  })());
});
self.addEventListener('message',e=>{
  if(e.data?.type==='SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const u=new URL(req.url);
  if(u.origin!==self.location.origin)return;
  // Market data and version metadata always come from the network, never a PWA cache.
  if(u.pathname==='/public_catalog.json'||u.pathname==='/version.json'||u.pathname==='/service-worker.js'||u.pathname.startsWith('/api/'))return;
  if(req.mode==='navigate'){
    // Only the public entry route belongs to this shell. Never mask owner routes.
    if(u.pathname!=='/')return;
    e.respondWith((async()=>{
      const cache=await caches.open(CACHE_ID);
      // HTML and assets must come from one release until the user applies an update.
      return (await cache.match('/')) || (await cache.match('/offline.html')) || Response.error();
    })());return;
  }
  if(!PRECACHE_SET.has(u.pathname))return;
  e.respondWith((async()=>{
    const cache=await caches.open(CACHE_ID);
    return (await cache.match(u.pathname))||(await fetch(req));
  })());
});
