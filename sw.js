const CACHE = "buhrsis-v064-authoritative-profile-transparent-eggs";
const ASSETS = ["./","./index.html","./styles.css","./social.css","./reminders.css","./organizer.css","./egg-stages.css","./app.js","./cloud.js","./social.js","./reminders.js","./organizer.js","./egg-stages.js","./assets/eggs/egg-stage-01.webp","./assets/eggs/egg-stage-02.webp","./assets/eggs/egg-stage-03.webp","./assets/eggs/egg-stage-04.webp","./assets/eggs/egg-stage-05.webp","./assets/eggs/egg-stage-06.webp","./assets/eggs/egg-stage-07.webp","./assets/eggs/egg-stage-08.webp","./assets/eggs/egg-stage-09.webp","./assets/eggs/egg-stage-10.webp","./assets/buhrsis/moxu-toothbrush-celebrate.webp","./assets/zone.wav","./assets/finish.wav","./manifest.webmanifest","./icon-moxu-192.png","./icon-moxu-512.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match(event.request).then(r => r || caches.match("./index.html")))
  );
});

self.addEventListener("push", event => {
  let data={};
  try{data=event.data?.json()||{}}catch(e){data={body:event.data?.text()||"Zeit zum Zähneputzen!"}}
  const title=data.title||"Buhrsi’s erinnert dich 🪥";
  const options={
    body:data.body||"Zeit zum Zähneputzen!",
    icon:"./icon-moxu-192.png",
    badge:"./icon-moxu-192.png",
    tag:data.tag||"buhrsii-brush-reminder",
    renotify:true,
    data:{url:data.url||"./"},
    actions:[{action:"brush",title:"JETZT PUTZEN"}]
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target=new URL(event.notification.data?.url||"./",self.location.origin).href;
  event.waitUntil((async()=>{
    const clientsList=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    for(const client of clientsList){
      if("focus" in client){await client.focus();client.postMessage({type:"buhrsi:push-open",startBrush:event.action==="brush"});return}
    }
    const client=await self.clients.openWindow(target);
    if(client&&event.action==="brush")setTimeout(()=>client.postMessage?.({type:"buhrsi:push-open",startBrush:true}),600);
  })());
});
