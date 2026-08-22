const $=s=>document.querySelector(s);
const defaults={xp:120,glanz:68,streak:0,lastBrush:null,eggEnergy:0};
const state={...defaults,...JSON.parse(localStorage.getItem('buhrsiState')||'{}')};
let left=120,timer=null,lastZone=-1;
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
function openBrush(){
 if(timer)return; left=120;lastZone=-1; $('#brushScreen').classList.add('open');document.body.classList.add('locked');
 $('#brushTime').textContent='02:00';$('#brushRing').style.setProperty('--progress','0deg');updateZone(true);
 setTimeout(runTimer,500);
}
function runTimer(){timer=setInterval(()=>{left--;$('#brushTime').textContent=format(left);$('#brushRing').style.setProperty('--progress',((120-left)/120*360)+'deg');updateZone();if(left<=0)finish()},1000)}
function updateZone(force=false){
 const elapsed=120-left;const zi=Math.min(3,Math.floor(elapsed/30));
 if(force||zi!==lastZone){lastZone=zi;$('#brushZone').textContent=zones[zi][0];$('#brushHint').textContent=zones[zi][1];$('#brushCreature').classList.remove('react');void $('#brushCreature').offsetWidth;$('#brushCreature').classList.add('react')}
 if(left<=10&&left>0){$('#brushZone').textContent='ENDSPURT';$('#brushHint').textContent=left+' …';$('#brushScreen').classList.add('finale')}else $('#brushScreen').classList.remove('finale');
}
function finish(){
 clearInterval(timer);timer=null;$('#brushScreen').classList.remove('open','finale');
 const oldLevel=Math.floor(state.xp/200)+1;state.xp+=20;state.glanz=Math.min(100,state.glanz+3);state.eggEnergy=Math.min(200,(state.eggEnergy||0)+20);
 const today=new Date().toISOString().slice(0,10);if(state.lastBrush!==today){state.streak+=1;state.lastBrush=today}
 const newLevel=Math.floor(state.xp/200)+1;save();render();
 $('#rewardLevel').textContent=newLevel>oldLevel?'LEVEL '+newLevel+'!':'GESCHAFFT!';$('#rewardXp').textContent='+20 XP';$('#rewardGlanz').textContent='+3 Glanz';$('#rewardStreak').textContent='🔥 '+state.streak+' Tage';
 $('#reward').classList.add('open');confetti();
}
function confetti(){const box=$('#sparkles');box.innerHTML='';for(let i=0;i<24;i++){const s=document.createElement('i');s.style.left=(45+Math.random()*10)+'%';s.style.top='48%';s.style.setProperty('--x',(Math.random()*360-180)+'px');s.style.setProperty('--y',(-80-Math.random()*280)+'px');s.style.animationDelay=(Math.random()*.25)+'s';box.append(s)}}
function closeReward(){$('#reward').classList.remove('open');document.body.classList.remove('locked');toast('✨ Fortschritt gespeichert')}
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),2200)}
$('#start').onclick=openBrush;$('#tips').onclick=()=>toast('30 Sek. pro Bereich • sanft kreisen • alle Flächen');$('#rewardDone').onclick=closeReward;
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
 document.getElementById("hatchContinue")?.addEventListener("click",()=>{
   const ov=document.getElementById("hatchV06"); ov.hidden=true; ov.className="hatch-v06";
 });
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
