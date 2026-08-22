const SUPABASE_URL="https://qxjxopqvhnkoexpvnsrr.supabase.co"; const SUPABASE_KEY="sb_publishable_37_1NuI52Z7QP5STRQh8iw_RocldPyv";
let sb,user,child,childModeSession=false;
const $=s=>document.querySelector(s), msg=t=>$("#cloudMessage").textContent=t||"";
function show(id){["roleView","childLoginView","authView","profileView"].forEach(x=>$("#"+x).hidden=x!==id);}
function app(on){$("#authGate").hidden=on;$(".app").hidden=!on}
function choose(p,isChild=false){child=p;childModeSession=isChild;$("#profileName").textContent=p.name;sessionStorage.setItem("buhrsiChild",JSON.stringify(p));app(true)}
async function profiles(){let {data,error}=await sb.from("child_profiles").select("id,name,username,buhrsi_code,xp,gloss,streak,egg_energy").order("created_at");if(error)return msg(error.message);show("profileView");$("#profileList").innerHTML="";(data||[]).forEach(p=>{let b=document.createElement("button");b.className="profile-choice";b.type="button";b.innerHTML=`<b>${p.name}</b><small>@${p.username||"noch-ohne-login"} · ${p.buhrsi_code||""}</small>`;b.onclick=()=>choose(p);$("#profileList").append(b)})}
$("#childMode").onclick=()=>{msg();show("childLoginView")}; $("#parentMode").onclick=()=>{msg();show("authView")};
document.querySelectorAll(".back-auth").forEach(b=>b.onclick=()=>{msg();show("roleView")});
$("#childLoginForm").onsubmit=async e=>{e.preventDefault();msg();let {data,error}=await sb.rpc("verify_child_pin",{p_username:$("#childUsernameLogin").value.trim(),p_pin:$("#childPinLogin").value});if(error)return msg(error.message);if(!data?.length)return msg("Name oder PIN stimmt nicht.");choose(data[0],true)};
$("#authForm").onsubmit=async e=>{e.preventDefault();msg();let email=$("#email").value.trim(),password=$("#password").value,mode=e.submitter.dataset.mode;if(mode==="signup"){let {error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:location.origin}});if(error)return msg(error.message);return msg("Konto erstellt. Bitte E-Mail bestätigen.")}let {data,error}=await sb.auth.signInWithPassword({email,password});if(error)return msg("Anmeldung fehlgeschlagen: "+error.message);user=data.user;await profiles()};
$("#childForm").onsubmit=async e=>{e.preventDefault();msg();let {data,error}=await sb.rpc("create_child_account",{p_name:$("#childName").value.trim(),p_username:$("#childUsername").value.trim(),p_pin:$("#childPin").value});if(error)return msg(error.message);$("#childForm").reset();await profiles()};
$("#logoutBtn").onclick=async()=>{sessionStorage.removeItem("buhrsiChild");child=null;if(user)await sb.auth.signOut();user=null;childModeSession=false;app(false);show("roleView")};
try{let m=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");sb=m.createClient(SUPABASE_URL,SUPABASE_KEY);let saved=sessionStorage.getItem("buhrsiChild");if(saved)choose(JSON.parse(saved),true);else{let {data}=await sb.auth.getSession();user=data.session?.user||null;if(user)await profiles();else{app(false);show("roleView")}}}catch(e){console.error(e);msg("Cloud-Verbindung konnte nicht geladen werden.")}
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
