const $=s=>document.querySelector(s);
const defaults={xp:120,glanz:68,streak:0,lastBrush:null,eggEnergy:0};
const state={...defaults,...JSON.parse(localStorage.getItem('buhrsiState')||'{}')};
let left=45,timer=null,lastZone=-1;
const zones=[
  ['OBEN AUSSEN','Putze die Außenflächen oben'],
  ['UNTEN AUSSEN','Jetzt die Außenflächen unten'],
  ['INNENFLÄCHEN','Weiter mit den Innenflächen'],
  ['KAUFLÄCHEN','Zum Schluss die Kauflächen']
];
function save(){localStorage.setItem('buhrsiState',JSON.stringify(state))}
function render(){
 const lvl=Math.floor(state.xp/200)+1,into=state.xp%200;
 $('#xpTop').textContent=state.xp;$('#level').textContent=lvl;$('#miniLevel').textContent=lvl;
 $('#xpBar').style.width=(into/2)+'%';$('#xpToNext').textContent=200-into;
 const egg=Math.min(state.eggEnergy||0,200);$('#eggXp').textContent=egg;$('#eggBar').style.width=(egg/2)+'%';
 $('#streak').textContent=state.streak;$('#glanzHome').textContent=state.glanz;
 $('#week').innerHTML='';for(let i=0;i<7;i++){let d=document.createElement('i');d.className='day'+(i<Math.min(state.streak,7)?' done':'');d.textContent=i<Math.min(state.streak,7)?'✓':'';$('#week').append(d)}
}
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
 initBrushAudio(); prepareBrushAudio(); unlockBrushAudio(); left=45;lastZone=-1;lastSignalZone=0;finishing=false;
 brushStartedAt=Date.now();brushEndAt=brushStartedAt+45000;
 sessionStorage.setItem("buhrsiBrushEndAt",String(brushEndAt));
 $('#brushScreen').classList.add('open');document.body.classList.add('locked');
 $('#brushTime').textContent='00:45';$('#brushRing').style.setProperty('--progress','0deg');updateZone(true);
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
   $('#brushRing').style.setProperty('--progress',((45-left)/45*360)+'deg');
   updateZone();
   if(left<=0)finish();
 };
 tick();timer=setInterval(tick,250);
}
function updateZone(force=false){
 const elapsed=Math.min(45,Math.max(0,45-left)),zi=Math.min(3,Math.floor(elapsed/11.25));
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

// v0.5 cloud/egg adapter
(function(){
  const EGG_MAX=100;
  function readLocal(){
    let s={};
    try{s=JSON.parse(localStorage.getItem("buhrsiState")||localStorage.getItem("buhrsis-state")||"{}")}catch(e){}
    return {
      xp:Number(s.xp)||0, gloss:Number(s.gloss ?? s.shine)||50,
      streak:Number(s.streak)||0, eggEnergy:Number(s.eggEnergy ?? s.egg_energy)||0
    };
  }
  function eggStage(e){ if(e>=100)return 4;if(e>=75)return 3;if(e>=45)return 2;if(e>=20)return 1;return 0; }
  function renderEgg(){
    const p=readLocal(), el=document.getElementById("eggV05");
    if(!el)return;
    const st=eggStage(p.eggEnergy);
    el.dataset.stage=String(st);
    el.querySelector(".egg-v05-fill").style.width=Math.min(100,p.eggEnergy)+"%";
    el.querySelector(".egg-v05-label").textContent=p.eggEnergy>=100?"Bereit zum Schlüpfen":p.eggEnergy+" / "+EGG_MAX+" Energie";
  }
  async function sync(){
    const c=window.BuhrsiCloud;
    if(c?.saveProgress) await c.saveProgress(readLocal());
    renderEgg();
  }
  window.addEventListener("buhrsi:brush-complete",async()=>{ await sync(); await window.BuhrsiCloud?.logBrush?.(120,20,3); });
  document.addEventListener("click",e=>{
    if(e.target.closest(".reward-close,.reward-continue,[data-action='continue']")) setTimeout(sync,100);
  });
  setInterval(renderEgg,1500);
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
   if(energy<100 || s.lastHatchAt) return;
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

// v0.8 persistent collection UI
(async function(){
 const grid=document.getElementById("buhrsiGrid"), count=document.getElementById("collectionCount"), detail=document.getElementById("buhrsiDetail");
 function label(r){return ({COMMON:"GEWÖHNLICH",RARE:"SELTEN",EPIC:"EPISCH",LEGENDARY:"LEGENDÄR"})[r]||r}
 function card(b){let el=document.createElement("button");el.className="buhrsi-card";el.dataset.rarity=b.rarity;el.innerHTML=`<div class="mini-toy ${b.variant}"><i></i><b></b></div><strong>${b.species}</strong><small>${label(b.rarity)}</small><span>${b.current_value} Wert</span>`;el.onclick=()=>open(b);return el}
 function open(b){document.getElementById("detailRarity").textContent=label(b.rarity);document.getElementById("detailName").textContent=b.species;document.getElementById("detailValue").textContent=b.current_value;document.getElementById("detailBond").textContent=b.bond;document.getElementById("detailGloss").textContent=b.gloss;document.getElementById("detailToy").className="mini-toy "+b.variant;detail.hidden=false}
 document.getElementById("closeBuhrsiDetail")?.addEventListener("click",()=>detail.hidden=true);
 window.refreshCollection=async()=>{let api=window.BuhrsiCollection;if(!api)return;let a=await api.list();if(!grid)return;grid.innerHTML="";count.textContent=a.length+" entdeckt";if(!a.length)grid.innerHTML='<p class="empty-collection">Dein erstes Buhrsi wartet noch im Ei.</p>';else a.forEach(b=>grid.append(card(b)))};
 setTimeout(window.refreshCollection,1200);
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
 setInterval(()=>render(window.BuhrsiStreaks?.profile?.()),1800);
 window.addEventListener("buhrsi:brush-complete",async()=>{
   const r=await window.BuhrsiStreaks?.complete?.(120);
   if(r?.ok)render(r.profile,r.brushes_today,r.perfect_day);
 });
})();

// v0.10 parent administration
(function(){
 let selected=null;const modal=document.getElementById("parentAdmin010"),msg=document.getElementById("adminMsg010");
 window.openParentAdmin010=p=>{selected=p;document.getElementById("adminName010").textContent=p.name;document.getElementById("adminMeta010").textContent="@"+(p.username||"—")+" · "+(p.buhrsi_code||"");msg.textContent="";modal.hidden=false};
 const close=()=>{modal.hidden=true;selected=null};
 document.getElementById("adminClose010")?.addEventListener("click",close);
 document.getElementById("resetPin010")?.addEventListener("click",async()=>{if(!selected)return;let pin=prompt("Neue 4-stellige PIN:");if(!/^\d{4}$/.test(pin||""))return msg.textContent="Bitte genau 4 Ziffern eingeben.";let r=await window.BuhrsiAdmin.resetPin(selected.id,pin);msg.textContent=r.ok?"PIN wurde geändert.":"PIN konnte nicht geändert werden."});
 document.getElementById("resetProgress010")?.addEventListener("click",async()=>{if(!selected||!confirm("Spielstand wirklich zurücksetzen? XP, Streaks, Ei und Sammlung werden gelöscht."))return;let r=await window.BuhrsiAdmin.resetProgress(selected.id);msg.textContent=r.ok?"Spielstand wurde zurückgesetzt.":"Zurücksetzen fehlgeschlagen."});
 document.getElementById("deleteChild010")?.addEventListener("click",async()=>{if(!selected||!confirm("Kinderkonto wirklich vollständig löschen? Dieser Schritt kann nicht rückgängig gemacht werden."))return;let r=await window.BuhrsiAdmin.deleteChild(selected.id);if(r.ok){close();await window.BuhrsiAdmin.reload()}else msg.textContent="Löschen fehlgeschlagen."});
})();

// v0.11 real persistent hatch trigger
(function(){
 const btn=document.getElementById("hatchNow011");
 function rarityLabel(r){return ({COMMON:"GEWÖHNLICH",RARE:"SELTEN",EPIC:"EPISCH",LEGENDARY:"LEGENDÄR"})[r]||r}
 function update(){
   const p=window.BuhrsiHatch?.profile?.();
   if(btn)btn.hidden=!p || Number(p.egg_energy||0)<100;
 }
 setInterval(update,1200);
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

// v0.12 robust screen wake lock for active brushing timer
(function(){
 let lock=null,active=false,lastSeconds=null;
 async function acquire(){
   if(!active||document.visibilityState!=="visible"||!("wakeLock" in navigator))return;
   try{
     if(lock && !lock.released)return;
     lock=await navigator.wakeLock.request("screen");
     lock.addEventListener("release",()=>{lock=null});
   }catch(e){console.info("Screen Wake Lock:",e.message)}
 }
 async function release(){
   try{if(lock&&!lock.released)await lock.release()}catch(e){}
   lock=null;
 }
 function parseTimer(){
   const nodes=[...document.querySelectorAll("body *")].filter(el=>el.children.length===0);
   for(const el of nodes){
     const t=(el.textContent||"").trim();
     const m=t.match(/^([0-2]?):?([0-5]?\d):([0-5]\d)$/)||t.match(/^([0-5]?\d):([0-5]\d)$/);
     if(m){
       let sec;
       if(m.length===4)sec=(+m[1]||0)*3600+(+m[2])*60+(+m[3]);
       else sec=(+m[1])*60+(+m[2]);
       if(sec>=0&&sec<=180)return sec;
     }
   }
   return null;
 }
 function inspect(){
   const sec=parseTimer();
   if(sec!==null){
     if(lastSeconds!==null && sec<lastSeconds && sec>0){active=true;acquire()}
     if(sec===0 && active){active=false;release()}
     lastSeconds=sec;
   }
 }
 // User gesture: if a control starts the brushing flow, request immediately.
 document.addEventListener("pointerup",e=>{
   const ctl=e.target.closest("button,[role=button],a");
   if(!ctl)return;
   const text=(ctl.textContent||"").toLowerCase();
   if(text.includes("putzen")||text.includes("start")){
     active=true;acquire();setTimeout(inspect,250);
   }
 },true);
 window.addEventListener("buhrsi:brush-start",()=>{active=true;acquire()});
 window.addEventListener("buhrsi:brush-complete",()=>{active=false;release()});
 window.addEventListener("buhrsi:brush-cancel",()=>{active=false;release()});
 document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&active)acquire()});
 new MutationObserver(inspect).observe(document.body,{subtree:true,childList:true,characterData:true});
 setInterval(inspect,1000);
})();

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
 setInterval(decorate,1800);
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
 new MutationObserver(()=>{
   const h=document.getElementById("hatchV06");
   if(h && !h.hidden && h.classList.contains("revealed")) wire();
 }).observe(document.body,{subtree:true,attributes:true,attributeFilter:["class","hidden"]});
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
   rows.slice(0,20).forEach((r,i)=>{
     const el=document.createElement("div");el.className="leader-row0149"+(r.is_me?" me":"");
     const medal=r.rank==1?"🥇":r.rank==2?"🥈":r.rank==3?"🥉":"#"+r.rank;
     el.innerHTML=`<b>${medal}</b><span><strong>${r.display_name}</strong><small>🔥 ${r.streak||0} Tage</small></span><em>${r.xp||0} XP</em>`;
     box.append(el);
   });
 }
 window.refreshLeaderboard=loadBoard;
 setTimeout(loadBoard,1200);
 window.addEventListener("buhrsi:brush-complete",()=>setTimeout(loadBoard,700));
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
 new MutationObserver(unlockParentUI).observe(document.body,{subtree:true,attributes:true,attributeFilter:["class","hidden","style"]});
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
 const obs=new MutationObserver(()=>wireParentCards());
 obs.observe(document.body,{subtree:true,childList:true,attributes:true});
 window.addEventListener("load",()=>setTimeout(wireParentCards,500));
 window.wireParentCards0152=wireParentCards;
})();

// v0.15.3 keep explicit parent actions attached after every parent-list render
(function(){
 function attach(){window.renderParentChildActions0153?.()}
 const list=()=>document.getElementById("parentList");
 const start=()=>{
   attach();
   const el=list();if(el)new MutationObserver(attach).observe(el,{childList:true,subtree:true});
 };
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
 setTimeout(attach,500);setTimeout(attach,1500);
})();
