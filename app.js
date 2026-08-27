const $=s=>document.querySelector(s);
const defaults={xp:0,glanz:0,streak:0,lastBrush:null,eggEnergy:0};
const state={...defaults,...JSON.parse(localStorage.getItem('buhrsiState')||'{}')};
const BRUSH_DURATION=120;
let left=BRUSH_DURATION,timer=null,lastZone=-1;
const zones=[
  ['OBEN AUSSEN','Putze die Außenflächen oben'],
  ['UNTEN AUSSEN','Jetzt die Außenflächen unten'],
  ['INNENFLÄCHEN','Weiter mit den Innenflächen'],
  ['KAUFLÄCHEN','Zum Schluss die Kauflächen']
];
function save(){localStorage.setItem('buhrsiState',JSON.stringify(state))}
function render(){
 const lvl=Math.floor(state.xp/200)+1,into=state.xp%200;
 $('#xpTop').textContent=state.xp;$('#level').textContent=lvl;
 $('#xpBar').style.width=(into/2)+'%';$('#xpToNext').textContent=into;
 const egg=Math.min(state.eggEnergy||0,200);$('#eggXp').textContent=egg;$('#eggBar').style.width=(egg/2)+'%';
 $('#streak').textContent=state.streak;$('#glanzHome').textContent=state.glanz;
 $('#week').innerHTML='';for(let i=0;i<7;i++){let d=document.createElement('i');d.className='day'+(i<Math.min(state.streak,7)?' done':'');d.textContent=i<Math.min(state.streak,7)?'✓':'';$('#week').append(d)}
}
window.resetBuhrsiLocalProgress=()=>{
 Object.assign(state,defaults);
 save();render();
 window.renderStreak091?.({streak:0,perfect_streak:0},0,false);
 window.refreshCollection?.();
 window.refreshLeaderboard?.();
};
function format(s){return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
let brushEndAt=0,brushStartedAt=0,lastSignalZone=0,audioCtx=null,finishing=false;
function initBrushAudio(){
 try{
   audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();
   if(audioCtx.state==="suspended") audioCtx.resume();
 }catch(e){}
}
let zoneAudio=null,finishAudio=null,audioUnlocked=false;
function prepareBrushAudio(){
 try{
   zoneAudio=zoneAudio||new Audio("./assets/zone.wav");
   finishAudio=finishAudio||new Audio("./assets/finish.wav");
   zoneAudio.preload="auto";finishAudio.preload="auto";
   zoneAudio.load();finishAudio.load();
 }catch(e){}
}
async function unlockBrushAudio(){
 prepareBrushAudio();
 if(audioUnlocked)return;
 try{
   zoneAudio.muted=true;zoneAudio.currentTime=0;
   await zoneAudio.play();zoneAudio.pause();zoneAudio.currentTime=0;zoneAudio.muted=false;
   finishAudio.muted=true;finishAudio.currentTime=0;
   await finishAudio.play();finishAudio.pause();finishAudio.currentTime=0;finishAudio.muted=false;
   audioUnlocked=true;
 }catch(e){console.info("Audio unlock:",e.message)}
}
function brushTone(done=false){
 try{
   const a=done?finishAudio:zoneAudio;if(!a)return;
   a.pause();a.currentTime=0;a.muted=false;a.volume=1;
   const p=a.play();if(p?.catch)p.catch(e=>console.info("Audio play:",e.message));
 }catch(e){}
}
function brushVibrate(done=false){
 try{if(navigator.vibrate)navigator.vibrate(done?[120,70,120]:[90])}catch(e){}
}
function openBrush(){
 if(timer)return;
 initBrushAudio(); prepareBrushAudio(); unlockBrushAudio(); left=BRUSH_DURATION;lastZone=-1;lastSignalZone=0;finishing=false;
 brushStartedAt=Date.now();brushEndAt=brushStartedAt+(BRUSH_DURATION*1000);
 sessionStorage.setItem("buhrsiBrushEndAt",String(brushEndAt));
 $('#brushScreen').classList.add('open');document.body.classList.add('locked');
 $('#brushTime').textContent=format(BRUSH_DURATION);$('#brushRing').style.setProperty('--progress','0deg');updateZone(true);
 window.dispatchEvent(new Event("buhrsi:brush-start"));
 setTimeout(()=>brushTone(false),80);
 setTimeout(runTimer,250);
}
function runTimer(){
 if(timer)clearInterval(timer);
 const tick=()=>{
   if(!brushEndAt)brushEndAt=Number(sessionStorage.getItem("buhrsiBrushEndAt")||0);
   const remaining=Math.max(0,Math.ceil((brushEndAt-Date.now())/1000));
   const previousLeft=left;
   left=remaining;
   if(left>0 && left<=10 && left!==previousLeft) brushTone(false);
   $('#brushTime').textContent=format(left);
   $('#brushRing').style.setProperty('--progress',((BRUSH_DURATION-left)/BRUSH_DURATION*360)+'deg');
   updateZone();
   if(left<=0)finish();
 };
 tick();timer=setInterval(tick,250);
}
function updateZone(force=false){
 const elapsed=Math.min(BRUSH_DURATION,Math.max(0,BRUSH_DURATION-left)),zi=Math.min(3,Math.floor(elapsed/(BRUSH_DURATION/4)));
 if(force||zi!==lastZone){
   const previous=lastZone;lastZone=zi;
   $('#brushZone').textContent=zones[zi][0];$('#brushHint').textContent=zones[zi][1];
   $('#brushCreature').classList.remove('react');void $('#brushCreature').offsetWidth;$('#brushCreature').classList.add('react');
   if(!force && zi>previous && zi>lastSignalZone){lastSignalZone=zi;brushTone(false);brushVibrate(false)}
 }
 if(left<=10&&left>0){$('#brushZone').textContent='ENDSPURT';$('#brushHint').textContent=left+' …';$('#brushScreen').classList.add('finale')}else $('#brushScreen').classList.remove('finale');
}
function finish(){
 if(finishing)return;finishing=true;
 clearInterval(timer);timer=null;brushEndAt=0;sessionStorage.removeItem("buhrsiBrushEndAt");
 brushTone(true);brushVibrate(true);
 $('#brushScreen').classList.remove('open','finale');
 const oldLevel=Math.floor(state.xp/200)+1;state.xp+=20;state.glanz=Math.min(100,state.glanz+3);state.eggEnergy=Math.min(200,(state.eggEnergy||0)+20);
 const today=new Date().toISOString().slice(0,10);if(state.lastBrush!==today){state.streak+=1;state.lastBrush=today}
 const newLevel=Math.floor(state.xp/200)+1;save();render();
 $('#rewardLevel').textContent=newLevel>oldLevel?'LEVEL '+newLevel+'!':'GESCHAFFT!';$('#rewardXp').textContent='+20 XP';$('#rewardGlanz').textContent='+3 Glanz';$('#rewardStreak').textContent='🔥 '+state.streak+' Tage';
 $('#reward').classList.add('open');confetti();
 // Notify cloud/game systems only after the completion UI is fully established.
 setTimeout(()=>window.dispatchEvent(new Event("buhrsi:brush-complete")),0);
}
function confetti(){const box=$('#sparkles');box.innerHTML='';for(let i=0;i<24;i++){const s=document.createElement('i');s.style.left=(45+Math.random()*10)+'%';s.style.top='48%';s.style.setProperty('--x',(Math.random()*360-180)+'px');s.style.setProperty('--y',(-80-Math.random()*280)+'px');s.style.animationDelay=(Math.random()*.25)+'s';box.append(s)}}
function closeReward(){
 const reward=$('#reward'),brush=$('#brushScreen');
 if(reward)reward.classList.remove('open');
 if(brush)brush.classList.remove('open','finale');
 document.body.classList.remove('locked');
 document.documentElement.classList.remove('tips-open');
 finishing=false;
 toast('✨ Fortschritt gespeichert');
}
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),2200)}
$('#start').onclick=openBrush;$('#rewardDone').onclick=closeReward;
render();

function applyCloudProfile026(profile){
 if(!profile)return;
 state.xp=Number(profile.xp)||0;
 state.glanz=Number(profile.gloss)||0;
 state.streak=Number(profile.streak)||0;
 state.eggEnergy=Number(profile.egg_energy)||0;
 save();render();
}
window.applyCloudProfile026=applyCloudProfile026;
window.addEventListener("buhrsi:child-change",event=>applyCloudProfile026(event.detail||window.BuhrsiStreaks?.profile?.()));

// v0.5 cloud/egg adapter
(function(){
  const EGG_MAX=200;
  function readLocal(){
    let s={};
    try{s=JSON.parse(localStorage.getItem("buhrsiState")||localStorage.getItem("buhrsis-state")||"{}")}catch(e){}
    return {
      xp:Number(s.xp)||0, gloss:Number(s.gloss ?? s.shine)||50,
      streak:Number(s.streak)||0, eggEnergy:Number(s.eggEnergy ?? s.egg_energy)||0
    };
  }
  function eggStage(e){ return Math.min(10,Math.floor(Math.max(0,e)/20)+1); }
  function renderEgg(){
    const p=readLocal(), el=document.getElementById("eggV05");
    if(!el)return;
    const st=eggStage(p.eggEnergy);
    el.dataset.stage=String(st);
    el.querySelector(".egg-v05-fill").style.width=Math.min(100,p.eggEnergy/2)+"%";
    el.querySelector(".egg-v05-label").textContent=p.eggEnergy>=200?"Bereit zum Erwecken":p.eggEnergy+" / "+EGG_MAX+" Energie";
  }
  async function sync(){
    const c=window.BuhrsiCloud;
    if(c?.saveProgress) await c.saveProgress(readLocal());
    renderEgg();
  }
  window.addEventListener("buhrsi:brush-complete",()=>renderEgg());
  document.addEventListener("click",e=>{
    if(e.target.closest(".reward-close,.reward-continue,[data-action='continue']")) setTimeout(sync,100);
  });
  setTimeout(renderEgg,500);
})();

// v0.6 Wake Lock + hatch reveal
(function(){
 let wakeLock=null, brushing=false;
 async function requestWake(){
   if(!("wakeLock" in navigator)) return;
   try{ wakeLock=await navigator.wakeLock.request("screen"); }
   catch(e){ console.info("Wake Lock nicht verfügbar:",e.message); }
 }
 async function releaseWake(){
   try{ if(wakeLock) await wakeLock.release(); }catch(e){}
   wakeLock=null;
 }
 document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible"&&brushing) requestWake(); });
 document.addEventListener("click",e=>{
   if(e.target.closest("#startBtn,.start-button,[data-action='start'],button") && /putzen starten/i.test(e.target.closest("button")?.textContent||"")){
     brushing=true; requestWake();
   }
   if(e.target.closest(".reward-close,.reward-continue,[data-action='continue']")){ brushing=false; releaseWake(); setTimeout(checkHatch,250); }
 });
 window.addEventListener("buhrsi:brush-complete",()=>{ brushing=false; releaseWake(); setTimeout(checkHatch,250); });

 function state(){
   try{return JSON.parse(localStorage.getItem("buhrsiState")||localStorage.getItem("buhrsis-state")||"{}")}catch(e){return{}}
 }
 function rarity(){
   const r=Math.random()*100;
   if(r<2)return ["LEGENDÄR",1800];
   if(r<10)return ["EPISCH",950];
   if(r<32)return ["SELTEN",520];
   return ["GEWÖHNLICH",240];
 }
 function checkHatch(){
   const s=state(), energy=Number(s.eggEnergy??s.egg_energy)||0;
   if(energy<200 || s.lastHatchAt) return;
   showHatch();
 }
 function showHatch(){
   const ov=document.getElementById("hatchV06"); if(!ov)return;
   ov.hidden=false; ov.classList.add("hatching");
   setTimeout(()=>ov.classList.add("cracked"),900);
   setTimeout(()=>{
     const [rar,base]=rarity(), value=base+Math.floor(Math.random()*180);
     ov.classList.add("revealed");
     ov.querySelector(".hatch-rarity").textContent=rar;
     ov.querySelector(".hatch-value").textContent=value+" Sammlerwert";
   },1900);
 }
 
})();

// v0.16 fixed 25-slot collection with real PNG assets
(function(){
 const BUHRSI_CATALOG=[
  {number:1,species:"Moxu",variant:"moxu",rarity:"COMMON"},
  {number:2,species:"Pünktchen",variant:"puenktchen",rarity:"COMMON"},
  {number:3,species:"Pombli",legacySpecies:"Sonnenschein",variant:"sonnenschein",rarity:"COMMON"},
  {number:4,species:"Zorli",legacySpecies:"Flämmchen",variant:"flaemmchen",rarity:"COMMON"},
  {number:5,species:"Nubbi",legacySpecies:"Bluupy",variant:"bluupy",rarity:"COMMON"},
  {number:6,species:"Raxu",legacySpecies:"Rosalie",variant:"rosalie",rarity:"RARE"},
  {number:7,species:"Quenzi",legacySpecies:"Brillberto",variant:"brillberto",rarity:"RARE"},
  {number:8,species:"Mivaro",legacySpecies:"Zauberlin",variant:"zauberlin",rarity:"RARE"},
  {number:9,species:"Kivvi",legacySpecies:"Herzilein",variant:"herzilein",rarity:"RARE"},
  {number:10,species:"Tovvi",legacySpecies:"Zitro",variant:"zitro",rarity:"COMMON"},
  {number:11,species:"Aveli",legacySpecies:"Pinkadora",variant:"pinkadora",rarity:"RARE"},
  {number:12,species:"Droxu",legacySpecies:"Wellenbob",variant:"wellenbob",rarity:"COMMON"},
  {number:13,species:"Fendri",legacySpecies:"Detekto",variant:"detekto",rarity:"RARE"},
  {number:14,species:"Orvix",legacySpecies:"Königchen",variant:"koenigchen",rarity:"RARE"},
  {number:15,species:"Kraxlo",legacySpecies:"Lavaknirp",variant:"lavaknirp",rarity:"LEGENDARY"},
  {number:16,species:"Tulmo",legacySpecies:"Schlumpfi",variant:"schlumpfi",rarity:"COMMON"},
  {number:17,species:"Zelvi",legacySpecies:"Glitzerglück",variant:"glitzerglueck",rarity:"EPIC"},
  {number:18,species:"Amethysta",variant:"amethysta",rarity:"EPIC"},
  {number:19,species:"Smaragdus",variant:"smaragdus",rarity:"EPIC"},
  {number:20,species:"Käpt'n Keks",variant:"kaeptn_keks",rarity:"RARE"},
  {number:21,species:"Regenknirps",variant:"regenknirps",rarity:"COMMON"},
  {number:22,species:"Nexari",legacySpecies:"Aurorix",variant:"aurorix",rarity:"LEGENDARY"},
  {number:23,species:"Mondmäuschen",variant:"mondmaeuschen",rarity:"LEGENDARY"},
  {number:24,species:"Sonnenfürst",variant:"sonnenfuerst",rarity:"LEGENDARY"},
  {number:25,species:"Kuro",variant:"kuro",rarity:"NEUTRAL",companion:true}
 ].map(entry=>({...entry,image:`assets/buhrsis/${entry.variant}.png`}));

 const grid=document.getElementById("buhrsiGrid");
 const count=document.getElementById("collectionCount");
 const detail=document.getElementById("buhrsiDetail");
 const detailVisual=document.getElementById("detailVisual");
 const detailImage=document.getElementById("detailImage");
 const byVariant=new Map(BUHRSI_CATALOG.map(entry=>[entry.variant,entry]));
 const availableAssets=new Set(["moxu","sonnenschein","flaemmchen","bluupy","rosalie","brillberto","zauberlin","herzilein","zitro","pinkadora","wellenbob","detekto","koenigchen","lavaknirp","schlumpfi","glitzerglueck","aurorix"]);
 const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/ß/g,"ss").replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
 const bySpecies=new Map(BUHRSI_CATALOG.flatMap(entry=>[entry.species,entry.legacySpecies].filter(Boolean).map(species=>[normalize(species),entry])));
 const rarityLabel=rarity=>({COMMON:"GEWÖHNLICH",RARE:"SELTEN",EPIC:"EPISCH",LEGENDARY:"LEGENDÄR",NEUTRAL:"BEGLEITER"})[rarity]||rarity;
 const numberOr=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
 let activeProfileId="";

 function catalogEntry(row){
  return byVariant.get(normalize(row?.variant))||bySpecies.get(normalize(row?.species));
 }

 function ownedByVariant(rows){
  const owned=new Map();
  (rows||[]).forEach(row=>{
   const entry=catalogEntry(row);
   if(entry&&!owned.has(entry.variant))owned.set(entry.variant,row);
  });
  return owned;
 }

 function createVisual(entry,isDiscovered){
  const visual=document.createElement("div");
  visual.className="buhrsi-visual "+(isDiscovered?"is-discovered":"is-silhouette");
  if(!isDiscovered||!availableAssets.has(entry.variant)){
   visual.classList.add("image-missing");
   return visual;
  }
  const img=document.createElement("img");
  img.className="buhrsi-image";
  img.src=entry.image;
  img.alt=isDiscovered?entry.species:"";
  img.loading="lazy";
  img.decoding="async";
  img.addEventListener("error",()=>{img.hidden=true;visual.classList.add("image-missing")},{once:true});
  visual.append(img);
  return visual;
 }

 function createCard(entry,row){
  const discovered=Boolean(row);
  const rarity=entry.companion?"NEUTRAL":entry.rarity||row?.rarity;
  const card=document.createElement("button");
  card.type="button";
  card.className="buhrsi-card"+(discovered?" is-discovered":" is-undiscovered");
  card.dataset.rarity=discovered?rarity:"UNKNOWN";
  card.setAttribute("aria-label",discovered?`${entry.species}, ${rarityLabel(rarity)}`:`Unentdecktes Buhrsi Nummer ${entry.number}`);
  card.append(createVisual(entry,discovered));

  const slot=document.createElement("span");
  slot.className="buhrsi-slot";
  slot.textContent=String(entry.number).padStart(2,"0");
  const name=document.createElement("strong");
  name.textContent=discovered?entry.species:"???";
  const rarityText=document.createElement("small");
  rarityText.textContent=discovered?rarityLabel(rarity):"UNENTDECKT";
  const value=document.createElement("span");
  value.className="buhrsi-card-value";
  value.textContent=discovered?(entry.companion?"Standardbegleiter":`${numberOr(row.current_value,0)} Wert`):"Noch nicht entdeckt";
  card.append(slot,name,rarityText,value);

  if(discovered)card.addEventListener("click",()=>openDetail(entry,row,rarity));
  else card.disabled=true;
  return card;
 }

 function openDetail(entry,row,rarity){
  document.getElementById("detailRarity").textContent=rarityLabel(rarity);
  document.getElementById("detailName").textContent=entry.species;
  document.getElementById("detailValue").textContent=numberOr(row.current_value,0);
  document.getElementById("detailBond").textContent=numberOr(row.bond,50);
  document.getElementById("detailGloss").textContent=numberOr(row.gloss,50);
  detailVisual?.classList.remove("image-missing");
  if(detailImage){
   detailImage.hidden=false;
   detailImage.alt=entry.species;
   detailImage.onerror=()=>{detailImage.hidden=true;detailVisual?.classList.add("image-missing")};
   detailImage.src=entry.image;
  }
  detail.hidden=false;
 }

 function renderCollection(rows){
  if(!grid)return;
  const owned=ownedByVariant(rows);
  const homeCount=document.getElementById("homeCollectionCount");
  const homePreview=document.getElementById("homeCollectionPreview");
  if(homeCount)homeCount.textContent=owned.size+" entdeckt";
  if(homePreview){
   const first=[...owned.entries()][0];
   if(!first){
    homePreview.className="home-collection-empty";
    homePreview.innerHTML='<img src="assets/buhrsis/moxu.png" alt="" aria-hidden="true"><div><b>Noch kein Buhrsi entdeckt</b><p>Dein erstes Buhrsi wartet im Ei.</p></div>';
   }else{
    const [variant,row]=first,entry=byVariant.get(variant);
    homePreview.className="home-collection-discovered";
    homePreview.innerHTML='<img src="'+entry.image+'" alt="'+entry.species+'"><div><b>'+entry.species+'</b><p>'+rarityLabel(entry.rarity||row?.rarity)+'</p></div>';
   }
  }
  grid.innerHTML="";
  if(!owned.size){
   grid.innerHTML='<div class="collection-empty-state"><img src="assets/buhrsis/moxu.png" alt="" aria-hidden="true"><div><b>Noch kein Buhrsi entdeckt</b><p>Dein erstes Buhrsi wartet im Ei.</p></div></div>';
   if(count)count.textContent="0 entdeckt";
   return;
  }
  BUHRSI_CATALOG.forEach(entry=>grid.append(createCard(entry,owned.get(entry.variant))));
  if(count)count.textContent=owned.size+" entdeckt";
 }

 document.getElementById("closeBuhrsiDetail")?.addEventListener("click",()=>detail.hidden=true);
 detail?.addEventListener("click",event=>{if(event.target===detail)detail.hidden=true});
 document.addEventListener("keydown",event=>{if(event.key==="Escape"&&detail&&!detail.hidden)detail.hidden=true});

 window.BuhrsiCatalog=BUHRSI_CATALOG;
 window.refreshCollection=async()=>{
  const api=window.BuhrsiCollection;
  if(!api){renderCollection([]);return}
  renderCollection(await api.list());
  activeProfileId=String(window.BuhrsiHatch?.profile?.()?.id||"");
 };

 renderCollection([]);
 setTimeout(window.refreshCollection,1200);
 window.addEventListener("buhrsi:child-change",()=>window.refreshCollection());
})();

// v0.8.2: Zahnputz-Tipps vollständig entfernt.
document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll("button,a").forEach(el=>{
    const t=(el.textContent||"").toLowerCase();
    if(t.includes("zahnputz")&&t.includes("tipp")) el.remove();
  });
});

// v0.9.1 daily + perfect streak display
(function(){
 function render(p,n=0,perfect=false){
  if(!p)return;
  const d=document.getElementById("dailyStreak091"),ps=document.getElementById("perfectStreak091"),s=document.getElementById("todayStatus091");
  if(d)d.textContent=(p.streak||0)+" Tage"; if(ps)ps.textContent=(p.perfect_streak||0)+" Tage";
  document.getElementById("brushDot1")?.classList.toggle("done",n>=1);
  document.getElementById("brushDot2")?.classList.toggle("done",n>=2);
  if(s)s.textContent=perfect?"⭐ Perfekter Tag!":n>=1?"🔥 Serie gesichert · abends noch einmal":"Noch nicht geputzt";
 }
 window.renderStreak091=render;
 setTimeout(()=>render(window.BuhrsiStreaks?.profile?.()),600);
 window.addEventListener("buhrsi:child-change",()=>render(window.BuhrsiStreaks?.profile?.()));
 window.addEventListener("buhrsi:brush-complete",async()=>{
   const r=await window.BuhrsiStreaks?.complete?.(120);
   if(!r?.ok){
     applyCloudProfile026(window.BuhrsiStreaks?.profile?.());
     toast("Speichern fehlgeschlagen – bitte neu anmelden");
     return;
   }
   if(r?.ok){
     applyCloudProfile026(r.profile);
     render(r.profile,r.brushes_today,r.perfect_day);
     window.dispatchEvent(new CustomEvent("buhrsi:progress-saved",{detail:r.profile}));
   }
 });
})();

// v0.10 parent administration
(function(){
 let selected=null;const modal=document.getElementById("parentAdmin010"),msg=document.getElementById("adminMsg010");
 window.openParentAdmin010=p=>{selected=p;document.getElementById("adminName010").textContent=p.name;document.getElementById("adminMeta010").textContent="@"+(p.username||"—")+" · "+(p.buhrsi_code||"");const edit=document.getElementById("adminProgress041");const isAdmin=Boolean(window.BuhrsiAdmin?.isAdmin?.());if(edit)edit.hidden=!isAdmin;const xp=document.getElementById("adminXp041"),streak=document.getElementById("adminStreak041");if(xp)xp.value=Number(p.xp)||0;if(streak)streak.value=Number(p.streak)||0;msg.textContent="";modal.hidden=false};
 const close=()=>{modal.hidden=true;selected=null};
 document.getElementById("adminClose010")?.addEventListener("click",close);
 document.getElementById("saveProgressAdmin041")?.addEventListener("click",async event=>{
   if(!selected||!window.BuhrsiAdmin?.isAdmin?.())return;
   const button=event.currentTarget,xp=document.getElementById("adminXp041")?.value,streak=document.getElementById("adminStreak041")?.value;
   button.disabled=true;msg.textContent="Werte werden gespeichert …";
   const r=await window.BuhrsiAdmin.setProgress(selected.id,xp,streak);
   button.disabled=false;
   if(!r.ok){msg.textContent="Speichern fehlgeschlagen: "+(r.error?.message||"Keine Berechtigung");return}
   selected={...selected,...r.data};
   window.dispatchEvent(new CustomEvent("buhrsi:progress-saved",{detail:selected}));
   await window.BuhrsiAdmin.reload();await window.refreshLeaderboard?.();
   msg.textContent="XP und Streak wurden gespeichert.";
 });
 document.getElementById("resetPin010")?.addEventListener("click",async()=>{if(!selected)return;let pin=prompt("Neue 4-stellige PIN:");if(!/^\d{4}$/.test(pin||""))return msg.textContent="Bitte genau 4 Ziffern eingeben.";let r=await window.BuhrsiAdmin.resetPin(selected.id,pin);msg.textContent=r.ok?"PIN wurde geändert.":"PIN konnte nicht geändert werden."});
 document.getElementById("resetProgress010")?.addEventListener("click",async event=>{
   if(!selected||!confirm("Spielstand wirklich zurücksetzen? XP, Streaks, Ei und Sammlung werden gelöscht."))return;
   const button=event.currentTarget;button.disabled=true;msg.textContent="Spielstand wird zurückgesetzt …";
   const r=await window.BuhrsiAdmin.resetProgress(selected.id);
   button.disabled=false;
   if(!r.ok){msg.textContent="Zurücksetzen fehlgeschlagen: "+(r.error?.message||"Unbekannter Fehler");return}
   const activeId=String(window.BuhrsiHatch?.profile?.()?.id||"");
   if(!activeId||activeId===String(selected.id))window.resetBuhrsiLocalProgress?.();
   selected={...selected,xp:0,gloss:0,streak:0,egg_energy:0,perfect_streak:0,last_brush_date:null,last_perfect_date:null};
   window.dispatchEvent(new CustomEvent("buhrsi:progress-reset",{detail:selected}));
   await window.refreshLeaderboard?.();
   msg.textContent="Spielstand und Rangliste wurden auf 0 XP zurückgesetzt.";
 });
 document.getElementById("deleteChild010")?.addEventListener("click",async()=>{if(!selected||!confirm("Kinderkonto wirklich vollständig löschen? Dieser Schritt kann nicht rückgängig gemacht werden."))return;let r=await window.BuhrsiAdmin.deleteChild(selected.id);if(r.ok){close();await window.BuhrsiAdmin.reload()}else msg.textContent="Löschen fehlgeschlagen."});
 document.getElementById("startChildAdmin0154")?.addEventListener("click",()=>{if(!selected)return;const profile=selected;close();window.parentOpenChild0152?.(profile)});
})();

// v0.11 real persistent hatch trigger
(function(){
 const btn=document.getElementById("hatchNow011");
 function rarityLabel(r){return ({COMMON:"GEWÖHNLICH",RARE:"SELTEN",EPIC:"EPISCH",LEGENDARY:"LEGENDÄR"})[r]||r}
 function update(){
   const p=window.BuhrsiHatch?.profile?.();
   if(btn)btn.hidden=!p || Number(p.egg_energy||0)<200;
 }
 setTimeout(update,600);
 window.addEventListener("buhrsi:child-change",update);
 window.addEventListener("buhrsi:brush-complete",update);
 window.addEventListener("buhrsi:progress-saved",update);
 window.addEventListener("buhrsi:progress-reset",update);
 btn?.addEventListener("click",async()=>{
   btn.disabled=true;btn.textContent="DAS EI BRICHT AUF …";
   const r=await window.BuhrsiHatch?.hatch?.();
   if(!r?.ok){btn.disabled=false;btn.textContent="EI SCHLÜPFEN LASSEN";return}
   const b=r.data,ov=document.getElementById("hatchV06");
   if(ov){
     ov.hidden=false;ov.classList.add("hatching");
     setTimeout(()=>ov.classList.add("cracked"),800);
     setTimeout(()=>{
       ov.classList.add("revealed");
       ov.querySelector(".hatch-rarity").textContent=rarityLabel(b.rarity);
       ov.querySelector(".hatch-value").textContent=b.current_value+" Sammlerwert";
     },1700);
   }
   btn.disabled=false;btn.textContent="EI SCHLÜPFEN LASSEN";update();
   window.refreshCollection?.();
 });
})();

// v0.17: the event-driven wake lock above replaces the old DOM-scanning timer watcher.

// v0.13: when iOS resumes the page, recalculate from the absolute end timestamp.
document.addEventListener("visibilitychange",()=>{
 if(document.visibilityState==="visible" && sessionStorage.getItem("buhrsiBrushEndAt")){
   brushEndAt=Number(sessionStorage.getItem("buhrsiBrushEndAt"));
   if(!timer)runTimer();
 }
});
window.addEventListener("pageshow",()=>{
 if(sessionStorage.getItem("buhrsiBrushEndAt")){
   brushEndAt=Number(sessionStorage.getItem("buhrsiBrushEndAt"));
   if(Date.now()>=brushEndAt)finish(); else if(!timer)runTimer();
 }
});

document.addEventListener("DOMContentLoaded",prepareBrushAudio);

// v0.14 Buhrsi evolution/value layer
(function(){
 function decorate(){
   document.querySelectorAll(".buhrsi-card").forEach(card=>{
     if(card.querySelector(".evo-tag"))return;
     const tag=document.createElement("em");tag.className="evo-tag";tag.textContent="Lebendiger Sammlerwert";card.append(tag);
   });
 }
 setTimeout(decorate,1800);
 window.addEventListener("buhrsi:child-change",()=>setTimeout(decorate,0));
 window.addEventListener("buhrsi:brush-complete",async()=>{
   await window.BuhrsiEvolution?.rewardBrush?.();
   await window.BuhrsiEvolution?.refresh?.();
   window.refreshCollection?.();
 });
 setTimeout(async()=>{await window.BuhrsiEvolution?.refresh?.();window.refreshCollection?.()},1800);
})();

// v0.14.1 stability guard: reward overlay must never trap the UI.
document.addEventListener("click",e=>{
 const b=e.target.closest("#rewardDone,.reward-close,.reward-continue,[data-action='continue']");
 if(!b)return;
 const reward=document.getElementById("reward"),brush=document.getElementById("brushScreen");
 reward?.classList.remove("open");brush?.classList.remove("open","finale");
 document.body.classList.remove("locked");
},true);

// v0.14.2 authoritative hatch completion flow
(function(){
 function closeHatchAndReturn(){
   const ov=document.getElementById("hatchV06");
   const reward=document.getElementById("reward");
   const brush=document.getElementById("brushScreen");
   if(ov){
     ov.hidden=true;
     ov.classList.remove("hatching","cracked","revealed");
     ov.style.pointerEvents="none";
   }
   reward?.classList.remove("open");
   brush?.classList.remove("open","finale");
   document.body.classList.remove("locked");
   document.documentElement.classList.remove("tips-open");
   try{ finishing=false; }catch(e){}
   try{ window.refreshCollection?.(); }catch(e){}
   window.scrollTo({top:0,left:0,behavior:"instant"});
 }
 document.addEventListener("click",e=>{
   const b=e.target.closest("#hatchContinue");
   if(!b)return;
   e.preventDefault();
   e.stopImmediatePropagation();
   closeHatchAndReturn();
 },true);
 window.closeHatchAndReturn=closeHatchAndReturn;
})();

// v0.14.3 hard reset of hatch continuation + countdown audio
(function(){
 function hardCloseHatch(){
   const ov=document.getElementById("hatchV06");
   document.getElementById("reward")?.classList.remove("open");
   document.getElementById("brushScreen")?.classList.remove("open","finale");
   if(ov){
     ov.hidden=true;
     ov.className="hatch-v06";
     ov.removeAttribute("style");
   }
   document.body.classList.remove("locked");
   document.body.style.overflow="";
   document.body.style.pointerEvents="";
   document.documentElement.style.overflow="";
   document.documentElement.classList.remove("tips-open");
   document.querySelectorAll(".overlay.open,.modal.open,.popup.open").forEach(x=>x.classList.remove("open"));
   try{finishing=false}catch(e){}
   try{window.refreshCollection?.()}catch(e){}
   requestAnimationFrame(()=>window.scrollTo(0,0));
 }
 function bindHatchButton(){
   const old=document.getElementById("hatchContinue");
   if(!old)return;
   const fresh=old.cloneNode(true);
   old.replaceWith(fresh);
   fresh.addEventListener("click",e=>{e.preventDefault();hardCloseHatch()});
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bindHatchButton);
 else bindHatchButton();
 window.hardCloseHatch0143=hardCloseHatch;

})();

// v0.14.4 hatch exit: direct pointer handler installed after reveal
(function(){
 function exitHatch0144(e){
   if(e){e.preventDefault();e.stopPropagation();}
   const hatch=document.getElementById("hatchV06");
   const reward=document.getElementById("reward");
   const brush=document.getElementById("brushScreen");
   if(hatch){
     hatch.hidden=true;
     hatch.setAttribute("aria-hidden","true");
     hatch.classList.remove("hatching","cracked","revealed","open");
     hatch.style.cssText="display:none!important;pointer-events:none!important;visibility:hidden!important;";
   }
   reward?.classList.remove("open");
   brush?.classList.remove("open","finale");
   document.body.classList.remove("locked");
   document.body.removeAttribute("style");
   document.documentElement.classList.remove("tips-open");
   document.documentElement.style.overflow="";
   try{finishing=false}catch(_){}
   setTimeout(()=>{
     try{window.refreshCollection?.()}catch(_){}
     window.scrollTo(0,0);
   },0);
 }
 function wire(){
   const b=document.getElementById("hatchContinue");
   if(!b)return;
   b.onpointerup=exitHatch0144;
   b.onclick=exitHatch0144;
   b.style.pointerEvents="auto";
   b.style.touchAction="manipulation";
 }
 document.addEventListener("DOMContentLoaded",wire);
 window.exitHatch0144=exitHatch0144;
})();

// v0.14.7 restore signed-in device session on launch
window.addEventListener("load",()=>{
 setTimeout(async()=>{
   const restored=await window.restoreLastBuhrsiChild?.();
   if(restored){
     document.body.classList.remove("locked");
     try{window.refreshCollection?.()}catch(e){}
   }
 },250);
});

// v0.14.9 XP leaderboard
(function(){
 async function loadBoard(){
   const box=document.getElementById("leaderList0149");if(!box)return;
   const rows=await window.BuhrsiLeaderboard?.load?.()||[];
   box.innerHTML="";
   if(!rows.length){box.innerHTML="<p>Noch keine Ranglistendaten.</p>";return}
   const uniqueByName=new Map();
   rows.forEach((row,sourceIndex)=>{
     const displayName=String(row.display_name||"").trim();
     if(!displayName)return;
     const key=displayName.toLocaleLowerCase("de");
     const previous=uniqueByName.get(key);
     if(!previous){
       uniqueByName.set(key,{...row,display_name:displayName,_sourceIndex:sourceIndex});
       return;
     }
     previous.xp=Math.max(Number(previous.xp)||0,Number(row.xp)||0);
     previous.streak=Math.max(Number(previous.streak)||0,Number(row.streak)||0);
     previous.is_me=Boolean(previous.is_me||row.is_me);
   });
   const ranked=[...uniqueByName.values()].sort((a,b)=>(Number(b.xp)||0)-(Number(a.xp)||0)||a._sourceIndex-b._sourceIndex);
   ranked.slice(0,20).forEach((r,i)=>{
     const el=document.createElement("div");el.className="leader-row0149"+(r.is_me?" me":"");
     const rank=i+1;
     const medal=rank===1?"🥇":rank===2?"🥈":rank===3?"🥉":"#"+rank;
     el.innerHTML=`<b>${medal}</b><span><strong>${r.display_name}</strong><small>🔥 ${r.streak||0} Tage</small></span><em>${r.xp||0} XP</em>`;
     box.append(el);
   });
 }
 window.refreshLeaderboard=loadBoard;
 setTimeout(loadBoard,1200);
 window.addEventListener("buhrsi:child-change",()=>setTimeout(loadBoard,100));
 window.addEventListener("buhrsi:progress-saved",loadBoard);
 window.addEventListener("buhrsi:progress-reset",loadBoard);
})();

// v0.15.0 child onboarding guard
(function(){
 async function enterNewestChild(){
   try{
     if(!sb)return false;
     const {data:{session}}=await sb.auth.getSession();
     if(!session)return false;
     const {data,error}=await sb.from("child_profiles")
       .select("*").eq("parent_id",session.user.id)
       .order("created_at",{ascending:false}).limit(1).maybeSingle();
     if(error||!data)return false;
     child=data;childModeSession=false;
     try{localStorage.setItem("buhrsiChild",JSON.stringify(data));localStorage.setItem("buhrsiChildMode","0")}catch(e){}
     try{window.BuhrsiDeviceSession?.saveChild?.(data)}catch(e){}
     document.body.classList.remove("locked");
     document.querySelectorAll(".overlay.open,.modal.open,.popup.open").forEach(x=>x.classList.remove("open"));
     try{showApp?.()}catch(e){try{app?.(true)}catch(_){}}
     try{render?.()}catch(e){}
     return true;
   }catch(e){console.error("enter newest child",e);return false}
 }
 // After any successful child-create interaction, re-check and enter newest child.
 document.addEventListener("click",e=>{
   const b=e.target.closest("#createChildBtn,#childCreateBtn,[data-action='create-child']");
   if(!b)return;
   setTimeout(enterNewestChild,900);
 },true);
 window.enterNewestChild0150=enterNewestChild;
})();

// v0.15.1 parent-area interaction safety
(function(){
 function unlockParentUI(){
   const parent=document.querySelector("#parentScreen,.parent-screen,#parentArea,.parent-area,[data-screen='parent']");
   if(!parent)return;
   const visible=!parent.hidden && getComputedStyle(parent).display!=="none";
   if(!visible)return;
   document.body.classList.remove("locked");
   document.body.style.pointerEvents="";
   document.body.style.overflow="";
   document.documentElement.style.pointerEvents="";
   document.documentElement.style.overflow="";
   ["reward","brushScreen","hatchV06"].forEach(id=>{
     const x=document.getElementById(id);
     if(!x)return;
     x.classList.remove("open","finale");
     if(id==="hatchV06")x.hidden=true;
   });
   parent.style.pointerEvents="auto";
   parent.querySelectorAll("button,a,input,select,textarea,[role='button']").forEach(x=>{
     x.style.pointerEvents="auto";x.style.touchAction="manipulation";
   });
 }
 document.addEventListener("click",e=>{
   if(e.target.closest("#parentScreen,.parent-screen,#parentArea,.parent-area,[data-screen='parent']")) unlockParentUI();
 },true);
 window.addEventListener("load",()=>setTimeout(unlockParentUI,400));
 window.unlockParentUI0151=unlockParentUI;
})();

// v0.15.2: remove parent-area dead end
(function(){
 async function resolveAndOpenCard(card){
   if(!sb)return;
   const username=(card.textContent.match(/@([a-zA-Z0-9._-]+)/)||[])[1]||"";
   const name=(card.querySelector("b,strong")?.textContent||card.firstElementChild?.textContent||"").trim();
   let q=sb.from("child_profiles").select("*");
   if(username)q=q.eq("username",username);
   else if(name)q=q.eq("name",name);
   const {data,error}=await q.limit(1).maybeSingle();
   if(!error&&data)window.parentOpenChild0152?.(data);
 }
 function wireParentCards(){
   const parent=document.querySelector("#parentScreen,.parent-screen,#parentArea,.parent-area,[data-screen='parent']");
   if(!parent)return;
   const cards=[...parent.querySelectorAll(".profile-card,.child-card,[data-child-id]")];
   // Fallback for current UI: direct children above the create form that contain @username.
   if(!cards.length){
     parent.querySelectorAll("div").forEach(x=>{
       if(x.children.length<=4 && /@[a-zA-Z0-9._-]+/.test(x.textContent||"") && !x.querySelector("input")) cards.push(x);
     });
   }
   [...new Set(cards)].forEach(card=>{
     if(card.dataset.nav0152)return;
     card.dataset.nav0152="1";
     card.setAttribute("role","button");
     card.setAttribute("tabindex","0");
     card.style.cursor="pointer";
     card.style.pointerEvents="auto";
     card.addEventListener("click",()=>resolveAndOpenCard(card));
     card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();resolveAndOpenCard(card)}});
   });
 }
 window.addEventListener("load",()=>setTimeout(wireParentCards,500));
 window.wireParentCards0152=wireParentCards;
})();

// v0.15.3 keep explicit parent actions attached after every parent-list render
(function(){
 function attach(){window.renderParentChildActions0153?.()}
 const list=()=>document.getElementById("parentList");
 const start=()=>{
   attach();
 };
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
 setTimeout(attach,500);setTimeout(attach,1500);
})();

// v0.17 functional bottom navigation
(function(){
 const nav=document.querySelector("nav");
 if(!nav)return;
 nav.addEventListener("click",async event=>{
  const button=event.target.closest("button");
  if(!button||!nav.contains(button))return;
  nav.querySelectorAll("button").forEach(item=>item.classList.toggle("active",item===button));
  if(button.dataset.navAction==="profile"){
   await window.BuhrsiAuth?.openChildSelector?.();
   return;
  }
  const target=document.getElementById(button.dataset.navTarget||"");
  target?.scrollIntoView({behavior:"auto",block:"start"});
 });
})();
