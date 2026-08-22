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
