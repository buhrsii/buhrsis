const EGG_STAGE_ASSETS={
  1:"./assets/eggs/egg-stage-01.webp",
  2:"./assets/eggs/egg-stage-02.webp",
  3:"./assets/eggs/egg-stage-03.webp",
  4:"./assets/eggs/egg-stage-04.webp",
  5:"./assets/eggs/egg-stage-05.webp",
  // Stufen 6–8 haben noch die alten Entwürfe. Bis die neuen Motive
  // freigegeben sind, bleibt das zuletzt freigegebene Ei sichtbar.
  9:"./assets/eggs/egg-stage-09.webp",
  10:"./assets/eggs/egg-stage-10.webp"
};
const TRANSPARENT_EGG_CACHE=new Map();

function transparentEggAsset(src){
  if(TRANSPARENT_EGG_CACHE.has(src))return TRANSPARENT_EGG_CACHE.get(src);
  const result=new Promise(resolve=>{
    const source=new Image();
    source.decoding="async";
    source.onerror=()=>resolve(src);
    source.onload=()=>{
      try{
        const width=source.naturalWidth,height=source.naturalHeight;
        const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
        const context=canvas.getContext("2d",{willReadFrequently:true});
        if(!context)return resolve(src);
        context.drawImage(source,0,0);
        const image=context.getImageData(0,0,width,height),pixels=image.data;
        const visited=new Uint8Array(width*height),queue=new Int32Array(width*height);
        let head=0,tail=0;
        const add=index=>{
          if(visited[index])return;
          visited[index]=1;
          const offset=index*4;
          if(Math.max(pixels[offset],pixels[offset+1],pixels[offset+2])>64)return;
          pixels[offset+3]=0;queue[tail++]=index;
        };
        for(let x=0;x<width;x++){add(x);add((height-1)*width+x)}
        for(let y=1;y<height-1;y++){add(y*width);add(y*width+width-1)}
        while(head<tail){
          const index=queue[head++],x=index%width;
          if(index>=width)add(index-width);
          if(index<width*(height-1))add(index+width);
          if(x>0)add(index-1);
          if(x<width-1)add(index+1);
        }
        context.putImageData(image,0,0);
        canvas.toBlob(blob=>resolve(blob?URL.createObjectURL(blob):src),"image/png");
      }catch(error){console.error("Ei-Hintergrund konnte nicht entfernt werden",error);resolve(src)}
    };
    source.src=src;
  });
  TRANSPARENT_EGG_CACHE.set(src,result);
  return result;
}

function showEggAsset(img,src){
  if(img.dataset.assetSource===src)return;
  img.dataset.assetSource=src;
  img.classList.add("is-processing");
  transparentEggAsset(src).then(displaySrc=>{
    if(img.dataset.assetSource!==src)return;
    img.src=displaySrc;
    img.classList.remove("is-processing");
  });
}

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
    showEggAsset(img,src);
    img.dataset.stage=String(stage);
  });
  const progress=document.getElementById("eggV05");
  if(progress){
    progress.dataset.energyStage=String(stage);
    const fill=progress.querySelector(".egg-v05-fill");if(fill)fill.style.width=(energy/2)+"%";
    const label=progress.querySelector(".egg-v05-label");if(label)label.textContent=energy>=200?"Bereit zum Erwecken":energy+" / 200 Ei-Energie · Stufe "+stage+" / 10";
  }
}

const css=document.createElement("link");css.rel="stylesheet";css.href="./egg-stages.css?v=064";document.head.appendChild(css);
window.BuhrsiEggStages={render:renderEggArtwork,assets:EGG_STAGE_ASSETS,transparentAsset:transparentEggAsset};
window.addEventListener("buhrsi:brush-complete",()=>setTimeout(renderEggArtwork,30));
window.addEventListener("buhrsi:child-change",()=>setTimeout(renderEggArtwork,50));
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")renderEggArtwork()});
setTimeout(renderEggArtwork,150);
setTimeout(renderEggArtwork,900);
