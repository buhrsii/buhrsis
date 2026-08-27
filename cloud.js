const SUPABASE_URL="https://qxjxopqvhnkoexpvnsrr.supabase.co"; const SUPABASE_KEY="sb_publishable_37_1NuI52Z7QP5STRQh8iw_RocldPyv";
let sb,user,child,childModeSession=false,childPin="";
try{childPin=localStorage.getItem("buhrsiChildDeviceToken")||sessionStorage.getItem("buhrsiChildPin")||""}catch(e){}
const $=s=>document.querySelector(s), msg=t=>$("#cloudMessage").textContent=t||"";
function show(id){["roleView","childLoginView","authView","profileView"].forEach(x=>$("#"+x).hidden=x!==id);}
function app(on){$("#authGate").hidden=on;$(".app").hidden=!on}
function choose(p,isChild=false){
 child=p;childModeSession=isChild;$("#profileName").textContent=p.name;
 try{
   localStorage.setItem("buhrsiChild",JSON.stringify(p));
   localStorage.setItem("buhrsiChildMode",isChild?"1":"0");
   window.BuhrsiDeviceSession?.saveChild?.(p);
 }catch(e){}
 app(true);
 window.dispatchEvent(new CustomEvent("buhrsi:child-change",{detail:p}));
}
async function profiles(){
 let {data,error}=await sb.from("child_profiles").select("id,parent_id,name,username,buhrsi_code,xp,gloss,streak,perfect_streak,egg_energy,last_brush_date,last_perfect_date").order("created_at");
 if(error)return msg(error.message);
 show("profileView");
 const isAdmin=Boolean(user?.app_metadata?.buhrsi_admin);
 const heading=$("#profileHeading"),eyebrow=$("#profileEyebrow");
 if(heading)heading.textContent=isAdmin?"Alle Profile verwalten":"Profile verwalten";
 if(eyebrow)eyebrow.textContent=isAdmin?"ADMINISTRATION":"PROFILE";
 const list=$("#profileList");list.innerHTML="";
 (data||[]).forEach(p=>{
   const card=document.createElement("div");card.className="profile-choice profile-choice-v154";
   card.innerHTML=`<div class="profile-info-v154"><b>${p.name}</b><small>@${p.username||"noch-ohne-login"} · ${p.buhrsi_code||""}</small></div>`;
   const start=document.createElement("button");start.type="button";start.className="child-start-v154";start.textContent="ÖFFNEN";
   start.onclick=e=>{e.preventDefault();e.stopPropagation();choose(p,false)};
   const admin=document.createElement("button");admin.type="button";admin.className="child-admin-v154";admin.textContent="VERWALTEN";
   admin.onclick=e=>{e.preventDefault();e.stopPropagation();window.openParentAdmin010?.(p)};
   card.append(start,admin);list.append(card);
 });
}
$("#openSignup").onclick=()=>{msg();show("authView")};
document.querySelectorAll(".back-auth").forEach(b=>b.onclick=()=>{msg();show("roleView")});
$("#unifiedLoginForm").onsubmit=async e=>{
 e.preventDefault();msg();
 const identity=$("#loginIdentity").value.trim(),secret=$("#loginSecret").value;
 if(identity.includes("@")){
   const {data,error}=await sb.auth.signInWithPassword({email:identity,password:secret});
   if(error)return msg("Anmeldung fehlgeschlagen. Bitte Eingaben prüfen.");
   user=data.user;await profiles();return;
 }
 if(!/^\d{4}$/.test(secret))return msg("Für einen Benutzernamen wird eine 4-stellige PIN benötigt.");
 let {data,error}=await sb.rpc("verify_child_pin",{p_username:identity,p_pin:secret});
 if(error||!data?.length)return msg("Benutzername oder PIN stimmt nicht.");
 let credential=secret;
 const sessionRes=await sb.rpc("buhrsi_create_child_device_session",{p_child:data[0].id,p_pin:secret});
 if(!sessionRes.error&&sessionRes.data){credential=sessionRes.data;try{localStorage.setItem("buhrsiChildDeviceToken",credential)}catch(e){}}
 childPin=credential;try{sessionStorage.setItem("buhrsiChildPin",credential)}catch(e){}
 choose(data[0],true);
};
$("#authForm").onsubmit=async e=>{
 e.preventDefault();msg();
 const email=$("#email").value.trim(),password=$("#password").value;
 const {error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:location.origin}});
 if(error)return msg(error.message);
 msg("Konto erstellt. Bitte E-Mail bestätigen.");
};
$("#childForm").onsubmit=async e=>{e.preventDefault();msg();let {data,error}=await sb.rpc("create_child_account",{p_name:$("#childName").value.trim(),p_username:$("#childUsername").value.trim(),p_pin:$("#childPin").value});if(error)return msg(error.message);$("#childForm").reset();await profiles()};
async function logoutToLogin041(){
 const token=(()=>{try{return localStorage.getItem("buhrsiChildDeviceToken")||""}catch(e){return ""}})();
 if(token&&sb){try{await sb.rpc("buhrsi_revoke_child_device_session",{p_token:token})}catch(e){}}
 try{localStorage.removeItem("buhrsiChild");localStorage.removeItem("buhrsiChildMode");localStorage.removeItem("buhrsiChildDeviceToken");sessionStorage.removeItem("buhrsiChildPin");window.BuhrsiDeviceSession?.clearChild?.()}catch(e){}
 childPin="";child=null;if(user)await sb.auth.signOut();user=null;childModeSession=false;app(false);show("roleView");
}
$("#logoutBtn").onclick=logoutToLogin041;
$("#backToLogin041").onclick=logoutToLogin041;
try{
 let m=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
 sb=m.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 const {data:sessionData}=await sb.auth.getSession();
 user=sessionData.session?.user||null;
 let saved=null,savedMode=false;
 try{saved=localStorage.getItem("buhrsiChild");savedMode=localStorage.getItem("buhrsiChildMode")==="1"}catch(e){}
 if(saved&&savedMode&&childPin){
   if(childPin.length>4){
     const {data,error}=await sb.rpc("buhrsi_restore_child_device_session",{p_token:childPin});
     if(!error&&data?.length)choose(data[0],true);
     else{try{localStorage.removeItem("buhrsiChild");localStorage.removeItem("buhrsiChildMode");localStorage.removeItem("buhrsiChildDeviceToken");sessionStorage.removeItem("buhrsiChildPin")}catch(e){}childPin="";app(false);show("childLoginView")}
   }else{
     try{choose(JSON.parse(saved),true)}catch(e){localStorage.removeItem("buhrsiChild");app(false);show("childLoginView")}
   }
 }
 else if(saved&&!savedMode&&user){try{choose(JSON.parse(saved),false)}catch(e){localStorage.removeItem("buhrsiChild")}}
 else if(saved){try{localStorage.removeItem("buhrsiChild");localStorage.removeItem("buhrsiChildMode")}catch(e){}app(false);show(savedMode?"childLoginView":"roleView")}
 else if(user)await profiles();
 else{app(false);show("roleView")}
}catch(e){console.error(e);msg("Cloud-Verbindung konnte nicht geladen werden.")}

async function openChildSelector(){
 msg();
 app(false);
 if(!user&&sb){
   const {data}=await sb.auth.getSession();
   user=data.session?.user||null;
 }
 if(user)await profiles();
 else show("roleView");
}
window.BuhrsiAuth={openChildSelector};
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
   if(!sb||!child)return {ok:false,reason:"no-child"};
   if(childModeSession&&!childPin)return {ok:false,reason:"child-login-required"};
   const fn=childModeSession?"complete_child_brushing_v024":"complete_brushing_v091";
   const args=childModeSession?{p_child:child.id,p_pin:childPin,p_duration:duration}:{p_child:child.id,p_duration:duration};
   const {data,error}=await sb.rpc(fn,args);
   if(error){console.error(error);return {ok:false,error}}
   child=data.profile;
   try{localStorage.setItem("buhrsiChild",JSON.stringify(child));window.BuhrsiDeviceSession?.saveChild?.(child)}catch(e){}
   return {ok:true,...data}
 },
 profile(){return child}
};

window.BuhrsiAdmin={
 isAdmin(){return Boolean(user?.app_metadata?.buhrsi_admin)},
 async setProgress(id,xp,streak,perfectStreak){
   if(!this.isAdmin())return {ok:false,reason:"admin-required"};
   const cleanXp=Math.max(0,Math.min(1000000,Math.trunc(Number(xp)||0)));
   const cleanStreak=Math.max(0,Math.min(9999,Math.trunc(Number(streak)||0)));
   const cleanPerfectStreak=Math.max(0,Math.min(9999,Math.trunc(Number(perfectStreak)||0)));
   const {data,error}=await sb.from("child_profiles").update({xp:cleanXp,streak:cleanStreak,perfect_streak:cleanPerfectStreak}).eq("id",id).select("id,parent_id,name,username,buhrsi_code,xp,gloss,streak,perfect_streak,egg_energy,last_brush_date,last_perfect_date").single();
   if(!error&&child&&String(child.id)===String(id)){child={...child,...data};try{localStorage.setItem("buhrsiChild",JSON.stringify(child))}catch(e){}}
   return {ok:!error,error,data};
 },
 async resetProgress(id){
   const {error}=await sb.rpc("reset_child_progress",{p_child:id});
   if(!error&&child&&String(child.id)===String(id)){
     child={...child,xp:0,gloss:0,streak:0,egg_energy:0,perfect_streak:0,last_brush_date:null,last_perfect_date:null};
     try{localStorage.setItem("buhrsiChild",JSON.stringify(child));window.BuhrsiDeviceSession?.saveChild?.(child)}catch(e){}
   }
   return {ok:!error,error}
 },
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
   choose(data,false);
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
  choose(profile,false);
  document.body.classList.remove("locked");
  document.querySelectorAll(".overlay.open,.modal.open,.popup.open").forEach(x=>x.classList.remove("open"));
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
     choose(data,false);
     document.body.classList.remove("locked");
   });
   card.appendChild(btn);
 });
};
