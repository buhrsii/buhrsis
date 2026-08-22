const SUPABASE_URL="https://qxjxopqvhnkoexpvnsrr.supabase.co"; const SUPABASE_KEY="sb_publishable_37_1NuI52Z7QP5STRQh8iw_RocldPyv";
let sb,user,child,childModeSession=false;
const $=s=>document.querySelector(s), msg=t=>$("#cloudMessage").textContent=t||"";
function show(id){["roleView","childLoginView","authView","profileView"].forEach(x=>$("#"+x).hidden=x!==id);}
function app(on){$("#authGate").hidden=on;$(".app").hidden=!on}
function choose(p,isChild=false){
 child=p;childModeSession=isChild;$("#profileName").textContent=p.name;
 try{
   localStorage.setItem("buhrsiChild",JSON.stringify(p));
   localStorage.setItem("buhrsiChildMode",isChild?"1":"0");
 }catch(e){}
 app(true)
}
async function profiles(){let {data,error}=await sb.from("child_profiles").select("id,name,username,buhrsi_code,xp,gloss,streak,egg_energy").order("created_at");if(error)return msg(error.message);show("profileView");$("#profileList").innerHTML="";(data||[]).forEach(p=>{let b=document.createElement("button");b.className="profile-choice";b.type="button";b.innerHTML=`<b>${p.name}</b><small>@${p.username||"noch-ohne-login"} · ${p.buhrsi_code||""}</small>`;b.onclick=()=>window.openParentAdmin010?window.openParentAdmin010(p):choose(p);$("#profileList").append(b)})}
$("#childMode").onclick=()=>{msg();show("childLoginView")}; $("#parentMode").onclick=()=>{msg();show("authView")};
document.querySelectorAll(".back-auth").forEach(b=>b.onclick=()=>{msg();show("roleView")});
$("#childLoginForm").onsubmit=async e=>{e.preventDefault();msg();let {data,error}=await sb.rpc("verify_child_pin",{p_username:$("#childUsernameLogin").value.trim(),p_pin:$("#childPinLogin").value});if(error)return msg(error.message);if(!data?.length)return msg("Name oder PIN stimmt nicht.");choose(data[0],true)};
$("#authForm").onsubmit=async e=>{e.preventDefault();msg();let email=$("#email").value.trim(),password=$("#password").value,mode=e.submitter.dataset.mode;if(mode==="signup"){let {error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:location.origin}});if(error)return msg(error.message);return msg("Konto erstellt. Bitte E-Mail bestätigen.")}let {data,error}=await sb.auth.signInWithPassword({email,password});if(error)return msg("Anmeldung fehlgeschlagen: "+error.message);user=data.user;await profiles()};
$("#childForm").onsubmit=async e=>{e.preventDefault();msg();let {data,error}=await sb.rpc("create_child_account",{p_name:$("#childName").value.trim(),p_username:$("#childUsername").value.trim(),p_pin:$("#childPin").value});if(error)return msg(error.message);$("#childForm").reset();await profiles()};
$("#logoutBtn").onclick=async()=>{
try{localStorage.removeItem("buhrsiChild");localStorage.removeItem("buhrsiChildMode");window.BuhrsiDeviceSession?.clearChild?.()}catch(e){}
child=null;if(user)await sb.auth.signOut();user=null;childModeSession=false;app(false);show("roleView")};
try{let m=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");sb=m.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});let saved=null,savedMode=false;
try{saved=localStorage.getItem("buhrsiChild");savedMode=localStorage.getItem("buhrsiChildMode")==="1"}catch(e){}
if(saved){try{choose(JSON.parse(saved),savedMode)}catch(e){localStorage.removeItem("buhrsiChild")}}
else{let {data}=await sb.auth.getSession();user=data.session?.user||null;if(user)await profiles();else{app(false);show("roleView")}}}catch(e){console.error(e);msg("Cloud-Verbindung konnte nicht geladen werden.")}
window.BuhrsiCloud={get child(){return child},async saveProgress(p){if(!sb||!child||childModeSession)return {ok:false};let {data,error}=await sb.from("child_profiles").update({xp:+p.xp||0,gloss:Math.max(0,Math.min(100,+p.gloss||0)),streak:+p.streak||0,egg_energy:+p.eggEnergy||0}).eq("id",child.id).select().single();if(!error)child=data;return {ok:!error,data,error}},async logBrush(){}};

window.BuhrsiCollection={
 async list(){
   if(!sb||!child||childModeSession) return [];
   const {data,error}=await sb.from("buhrsis").select("*").eq("child_id",child.id).order("born_at",{ascending:false});
   if(error){console.error(error);return []} return data||[];
 },
 async hatch(){
   if(!sb||!child||childModeSession) return null;
   const {data,error}=await sb.rpc("hatch_buhrsi",{p_child:child.id});
   if(error){console.error(error);return null} child.egg_energy=0; return data;
 }
};

window.BuhrsiStreaks={
 async complete(duration=120){
   if(!sb||!child||childModeSession)return {ok:false,reason:"child-session"};
   const {data,error}=await sb.rpc("complete_brushing_v091",{p_child:child.id,p_duration:duration});
   if(error){console.error(error);return {ok:false,error}}
   child=data.profile;return {ok:true,...data}
 },
 profile(){return child}
};

window.BuhrsiAdmin={
 async resetProgress(id){const {error}=await sb.rpc("reset_child_progress",{p_child:id});return {ok:!error,error}},
 async deleteChild(id){const {error}=await sb.rpc("delete_child_account",{p_child:id});return {ok:!error,error}},
 async resetPin(id,pin){const {error}=await sb.rpc("reset_child_pin",{p_child:id,p_pin:pin});return {ok:!error,error}},
 async reload(){await profiles()}
};

window.BuhrsiHatch={
 async hatch(){
   if(!sb||!child||childModeSession)return {ok:false,reason:"child-session"};
   const {data,error}=await sb.rpc("hatch_ready_egg",{p_child:child.id});
   if(error){console.error(error);return {ok:false,error}}
   child.egg_energy=0;return {ok:true,data};
 },
 async collection(){
   if(!sb||!child||childModeSession)return [];
   const {data,error}=await sb.from("buhrsis").select("*").eq("child_id",child.id).order("born_at",{ascending:false});
   return error?[]:(data||[]);
 },
 profile(){return child}
};

window.BuhrsiEvolution={
 async refresh(){
   if(!sb||!child||childModeSession)return [];
   const {data,error}=await sb.rpc("update_buhrsi_values",{p_child:child.id});
   if(error){console.error(error);return []}return data||[];
 },
 async rewardBrush(){
   if(!sb||!child||childModeSession)return false;
   const {error}=await sb.rpc("feed_buhrsi_brush_xp",{p_child:child.id});
   return !error;
 }
};

// v0.14.7 persistent device session
window.BuhrsiDeviceSession={
 saveChild(p){
   try{
     localStorage.setItem("buhrsis:lastChildId",p?.id||"");
     localStorage.setItem("buhrsis:lastChildName",p?.name||"");
   }catch(e){}
 },
 clearChild(){
   try{
     localStorage.removeItem("buhrsis:lastChildId");
     localStorage.removeItem("buhrsis:lastChildName");
   }catch(e){}
 },
 lastChildId(){
   try{return localStorage.getItem("buhrsis:lastChildId")||""}catch(e){return ""}
 }
};

window.restoreLastBuhrsiChild=async function(){
 try{
   if(!sb)return false;
   const {data:{session}}=await sb.auth.getSession();
   if(!session)return false;
   const id=window.BuhrsiDeviceSession?.lastChildId?.();
   if(!id)return false;
   const {data,error}=await sb.from("child_profiles").select("*").eq("id",id).eq("parent_id",session.user.id).maybeSingle();
   if(error||!data)return false;
   child=data;
   childModeSession=false;
   window.BuhrsiDeviceSession.saveChild(data);
   try{showApp?.()}catch(e){}
   try{render?.()}catch(e){}
   try{window.renderStreak091?.(data)}catch(e){}
   return true;
 }catch(e){console.error("restore child",e);return false}
};

window.BuhrsiLeaderboard={
 async load(){
   if(!sb)return [];
   const {data,error}=await sb.rpc("buhrsi_leaderboard");
   if(error){console.error(error);return []}
   return data||[];
 }
};

// v0.15.2 parent navigation
window.parentOpenChild0152=function(profile){
  if(!profile)return;
  child=profile;
  childModeSession=false;
  try{
    localStorage.setItem("buhrsiChild",JSON.stringify(profile));
    localStorage.setItem("buhrsiChildMode","0");
    window.BuhrsiDeviceSession?.saveChild?.(profile);
  }catch(e){}
  try{$("#profileName").textContent=profile.name}catch(e){}
  document.body.classList.remove("locked");
  document.querySelectorAll(".overlay.open,.modal.open,.popup.open").forEach(x=>x.classList.remove("open"));
  try{app(true)}catch(e){try{showApp?.()}catch(_){}}
  try{render?.()}catch(e){}
};

// v0.15.3 explicit parent child controls
window.renderParentChildActions0153=function(){
 const list=document.getElementById("parentList");
 if(!list)return;
 [...list.children].forEach((card,i)=>{
   if(card.querySelector(".open-child0153"))return;
   const btn=document.createElement("button");
   btn.type="button";btn.className="open-child0153";
   btn.textContent="ALS KIND STARTEN";
   btn.addEventListener("click",async e=>{
     e.preventDefault();e.stopPropagation();
     const username=(card.textContent.match(/@([a-zA-Z0-9._-]+)/)||[])[1]||"";
     if(!username)return;
     const {data,error}=await sb.from("child_profiles").select("*").eq("username",username).limit(1).maybeSingle();
     if(error||!data){console.error(error);return}
     child=data;childModeSession=false;
     try{
       localStorage.setItem("buhrsiChild",JSON.stringify(data));
       localStorage.setItem("buhrsiChildMode","0");
       window.BuhrsiDeviceSession?.saveChild?.(data);
     }catch(_){}
     document.body.classList.remove("locked");
     try{$("#profileName").textContent=data.name}catch(_){}
     try{app(true)}catch(_){try{showApp?.()}catch(__){}}
     try{render?.()}catch(_){}
   });
   card.appendChild(btn);
 });
};
