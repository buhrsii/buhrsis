const SUPABASE_URL="https://qxjxopqvhnkoexpvnsrr.supabase.co";
const SUPABASE_KEY="sb_publishable_37_1NuI52Z7QP5STRQh8iw_RocldPyv";
let socialSb=null,currentChild=null,currentPin="",pollTimer=null,lastLiveIds=new Set();

function readChild(){
  try{return JSON.parse(localStorage.getItem("buhrsiChild")||"null")}catch(e){return null}
}
function readPin(){try{return sessionStorage.getItem("buhrsiChildPin")||""}catch(e){return ""}}
function rpcArgs(extra={}){return {p_child:currentChild?.id,p_pin:currentPin||null,...extra}}
function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}

function mount(){
  if(document.getElementById("social027"))return;
  const anchor=document.getElementById("homeSection");
  if(!anchor)return;
  const section=document.createElement("section");
  section.id="social027";section.className="social027";
  section.innerHTML=`
    <div class="social027-head">
      <div><span class="eyebrow">FREUNDE</span><h2>Gemeinsam putzen</h2></div>
      <div class="social027-code">DEIN CODE<b id="socialCode027">—</b></div>
    </div>
    <form id="socialAdd027" class="social027-add">
      <input id="socialCodeInput027" aria-label="Freundescode" maxlength="30" placeholder="Freundescode eingeben" autocomplete="off">
      <button type="submit">HINZUFÜGEN</button>
    </form>
    <p id="socialMsg027" class="social027-message"></p>
    <div id="socialRequests027" class="social027-requests"></div>
    <div id="socialList027" class="social027-list"><p class="social027-empty">Freunde werden geladen …</p></div>`;
  anchor.insertAdjacentElement("afterend",section);

  const banner=document.createElement("div");
  banner.id="socialLiveBanner027";banner.className="social027-live-banner";banner.hidden=true;
  banner.innerHTML=`<span id="socialLiveText027">Ein Freund putzt gerade 🪥</span><button id="socialLiveJoin027" type="button">MITPUTZEN</button>`;
  document.body.appendChild(banner);

  document.getElementById("socialAdd027").addEventListener("submit",sendRequest);
  document.getElementById("socialLiveJoin027").addEventListener("click",joinBrush);
}

function setMessage(text=""){const el=document.getElementById("socialMsg027");if(el)el.textContent=text}
function joinBrush(){document.getElementById("socialLiveBanner027").hidden=true;document.getElementById("start")?.click()}

async function sendRequest(e){
  e.preventDefault();
  if(!currentChild)return;
  const input=document.getElementById("socialCodeInput027"),code=input.value.trim();
  if(!code)return setMessage("Bitte einen Freundescode eingeben.");
  setMessage("Freundschaftsanfrage wird gesendet …");
  const {data,error}=await socialSb.rpc("buhrsi_social_send_request",rpcArgs({p_code:code}));
  if(error)return setMessage(error.message||"Anfrage konnte nicht gesendet werden.");
  input.value="";
  setMessage(data?.accepted?"Ihr seid jetzt Freunde!":data?.already_friends?"Ihr seid bereits Freunde.":"Anfrage gesendet.");
  await refreshSocial();
}

async function acceptRequest(id){
  const {error}=await socialSb.rpc("buhrsi_social_accept_request",rpcArgs({p_request:id}));
  if(error)return setMessage(error.message||"Anfrage konnte nicht angenommen werden.");
  setMessage("Freundschaft bestätigt ✨");
  await refreshSocial();
}

function renderRequests(rows=[]){
  const box=document.getElementById("socialRequests027");if(!box)return;
  box.innerHTML="";
  rows.forEach(r=>{
    const row=document.createElement("div");row.className="social027-request";
    row.innerHTML=`<div class="social027-person"><b>${esc(r.display_name)}</b><small>@${esc(r.username||"")}</small></div><button type="button">ANNEHMEN</button>`;
    row.querySelector("button").addEventListener("click",()=>acceptRequest(r.request_id));
    box.appendChild(row);
  });
}

function renderFriends(rows=[]){
  const box=document.getElementById("socialList027");if(!box)return;
  box.innerHTML="";
  if(!rows.length){box.innerHTML='<p class="social027-empty">Noch keine Freunde. Tauscht euren Buhrsi-Code aus und fügt euch hier hinzu.</p>';return}
  rows.forEach(f=>{
    const row=document.createElement("div");row.className="social027-friend";
    row.innerHTML=`<div class="social027-person"><b>${esc(f.display_name)}</b><small>@${esc(f.username||"")} · 🔥 ${Number(f.streak)||0} · ⭐ ${Number(f.xp)||0} XP</small></div><div class="social027-status">${f.is_brushing?'<span class="social027-live"><i></i>PUTZT GERADE</span><button class="social027-join" type="button">MITPUTZEN</button>':'<small>offline</small>'}</div>`;
    row.querySelector(".social027-join")?.addEventListener("click",joinBrush);
    box.appendChild(row);
  });
}

function maybeShowLive(rows=[]){
  const live=rows.filter(x=>x.is_brushing),ids=new Set(live.map(x=>String(x.friend_id)));
  const newcomer=live.find(x=>!lastLiveIds.has(String(x.friend_id)));
  lastLiveIds=ids;
  if(!newcomer)return;
  const banner=document.getElementById("socialLiveBanner027");
  const text=document.getElementById("socialLiveText027");
  if(!banner||!text)return;
  text.textContent=`${newcomer.display_name} putzt gerade 🪥`;
  banner.hidden=false;
  setTimeout(()=>{banner.hidden=true},15000);
}

async function refreshSocial(){
  if(!socialSb||!currentChild)return;
  const code=document.getElementById("socialCode027");if(code)code.textContent=currentChild.buhrsi_code||"—";
  const [friendsRes,requestsRes]=await Promise.all([
    socialSb.rpc("buhrsi_social_list",rpcArgs()),
    socialSb.rpc("buhrsi_social_requests",rpcArgs())
  ]);
  if(friendsRes.error){
    console.info("Social noch nicht eingerichtet:",friendsRes.error.message);
    document.getElementById("socialList027").innerHTML='<p class="social027-empty">Freunde werden nach der Datenbank-Einrichtung verfügbar.</p>';
    return;
  }
  renderFriends(friendsRes.data||[]);
  if(!requestsRes.error)renderRequests(requestsRes.data||[]);
  maybeShowLive(friendsRes.data||[]);
}

async function setBrushing(active){
  if(!socialSb||!currentChild)return;
  const {error}=await socialSb.rpc("buhrsi_social_set_brushing",rpcArgs({p_brushing:!!active}));
  if(error)console.info("Social status:",error.message);
  setTimeout(refreshSocial,500);
}

function selectChild(profile){
  currentChild=profile||readChild();currentPin=readPin();lastLiveIds=new Set();
  if(currentChild){mount();refreshSocial();}
  if(pollTimer)clearInterval(pollTimer);
  pollTimer=currentChild?setInterval(refreshSocial,5000):null;
}

window.addEventListener("buhrsi:child-change",e=>selectChild(e.detail));
window.addEventListener("buhrsi:brush-start",()=>setBrushing(true));
window.addEventListener("buhrsi:brush-complete",()=>setBrushing(false));
window.addEventListener("pagehide",()=>{if(currentChild)setBrushing(false)});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")refreshSocial()});

try{
  const m=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
  socialSb=m.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  selectChild(readChild());
}catch(e){console.error("Social konnte nicht geladen werden",e)}
