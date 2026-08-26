const EGG_STAGE_ASSETS={
  1:"./assets/eggs/egg-stage-01.webp",
  2:"./assets/eggs/egg-stage-02.webp",
  3:"./assets/eggs/egg-stage-03.webp",
  4:"./assets/eggs/egg-stage-04.webp",
  5:"./assets/eggs/egg-stage-05.webp",
  6:"./assets/eggs/egg-stage-06.webp",
  7:"./assets/eggs/egg-stage-07.webp",
  8:"./assets/eggs/egg-stage-08.webp",
  9:"./assets/eggs/egg-stage-09.webp",
  10:"./assets/eggs/egg-stage-10.webp"
};

function readEggEnergy(){
  try{
    const s=JSON.parse(localStorage.getItem("buhrsiState")||"{}");
    return Math.max(0,Math.min(200,Number(s.eggEnergy??s.egg_energy)||0));
  }catch(e){return 0}
}
function stageForEnergy(energy){
  return Math.min(10,Math.floor(energy/20)+1);
}
function nearestAvailableStage(stage){
  for(let s=stage;s>=1;s--)if(EGG_STAGE_ASSETS[s])return s;
  return 1;
}
function ensureEggArtwork(){
  const home=document.querySelector(".egg-art");
  if(home&&!home.querySelector(".egg-stage-image")){
    home.innerHTML='<img class="egg-stage-image egg-stage-image-home" alt="Buhrsi-Ei">';
  }
  const progress=document.querySelector("#eggV05 .egg-v05-art");
  if(progress&&!progress.querySelector(".egg-stage-image")){
    progress.innerHTML='<img class="egg-stage-image egg-stage-image-progress" alt="" aria-hidden="true">';
  }
}
function renderEggArtwork(){
  ensureEggArtwork();
  const energy=readEggEnergy(),stage=stageForEnergy(energy),assetStage=nearestAvailableStage(stage),src=EGG_STAGE_ASSETS[assetStage];
  document.querySelectorAll(".egg-stage-image").forEach(img=>{
    if(img.getAttribute("src")!==src)img.src=src;
    img.dataset.stage=String(stage);
  });
  const progress=document.getElementById("eggV05");
  if(progress){
    progress.dataset.energyStage=String(stage);
    const fill=progress.querySelector(".egg-v05-fill");if(fill)fill.style.width=(energy/2)+"%";
    const label=progress.querySelector(".egg-v05-label");if(label)label.textContent=energy>=200?"Bereit zum Erwecken":energy+" / 200 XP · Stufe "+stage+" / 10";
  }
}

const css=document.createElement("link");css.rel="stylesheet";css.href="./egg-stages.css";document.head.appendChild(css);
window.BuhrsiEggStages={render:renderEggArtwork,assets:EGG_STAGE_ASSETS};
window.addEventListener("buhrsi:brush-complete",()=>setTimeout(renderEggArtwork,30));
window.addEventListener("buhrsi:child-change",()=>setTimeout(renderEggArtwork,50));
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")renderEggArtwork()});
setTimeout(renderEggArtwork,150);
setTimeout(renderEggArtwork,900);
