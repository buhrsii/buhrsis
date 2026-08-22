const SUPABASE_URL="https://qxjxopqvhnkoexpvnsrr.supabase.co";
const SUPABASE_KEY="sb_publishable_37_1NuI52Z7QP5STRQh8iw_RocldPyv";
let sb,user,child;
const $=s=>document.querySelector(s);
function msg(t=""){$("#cloudMessage").textContent=t}
function app(show){$("#authGate").hidden=show;$(".app").hidden=!show}
async function profiles(){
 const {data,error}=await sb.from("child_profiles").select("*").order("created_at");
 if(error){msg(error.message);return}
 if(!data.length){$("#authView").hidden=true;$("#profileView").hidden=false;app(false);return}
 $("#profileList").innerHTML="";
 data.forEach(p=>{let b=document.createElement("button");b.type="button";b.className="profile-choice";b.textContent=p.name;b.onclick=()=>choose(p);$("#profileList").append(b)});
 $("#authView").hidden=true;$("#profileView").hidden=false;app(false)
}
function choose(p){child=p;$("#profileName").textContent=p.name;app(true)}
async function gate(){
 const {data}=await sb.auth.getSession();user=data.session?.user||null;
 if(!user){$("#authView").hidden=false;$("#profileView").hidden=true;app(false);return}
 await profiles()
}
$("#authForm").addEventListener("submit",async e=>{
 e.preventDefault();msg();let email=$("#email").value.trim(),password=$("#password").value,mode=e.submitter.dataset.mode;
 if(mode==="signup"){let {error}=await sb.auth.signUp({email,password});if(error)return msg(error.message);msg("Konto erstellt. Prüfe ggf. deine E-Mail zur Bestätigung.");}
 else{let {data,error}=await sb.auth.signInWithPassword({email,password});if(error)return msg("Anmeldung fehlgeschlagen: "+error.message);user=data.user;await profiles()}
});
$("#childForm").addEventListener("submit",async e=>{
 e.preventDefault();msg();let name=$("#childName").value.trim().slice(0,30);if(!name)return;
 let {data,error}=await sb.from("child_profiles").insert({parent_id:user.id,name}).select().single();
 if(error)return msg(error.message);choose(data)
});
$("#logoutBtn").addEventListener("click",async()=>{await sb.auth.signOut();user=child=null;await gate()});
try{let m=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");sb=m.createClient(SUPABASE_URL,SUPABASE_KEY);await gate()}
catch(e){console.error(e);msg("Cloud-Verbindung konnte nicht geladen werden.")}

window.BuhrsiCloud = {
  get child(){ return child; },
  async saveProgress(progress){
    if(!sb || !user || !child) return {ok:false};
    const payload={
      xp: Math.max(0, Number(progress.xp)||0),
      gloss: Math.max(0, Math.min(100, Number(progress.gloss)||0)),
      streak: Math.max(0, Number(progress.streak)||0),
      egg_energy: Math.max(0, Number(progress.eggEnergy)||0)
    };
    const {data,error}=await sb.from("child_profiles").update(payload).eq("id",child.id).select().single();
    if(error){ console.error(error); return {ok:false,error}; }
    child=data; return {ok:true,data};
  },
  async logBrush(duration=120,xpEarned=20,glossEarned=3){
    if(!sb || !user || !child) return;
    const {error}=await sb.from("brushing_sessions").insert({
      child_id:child.id,parent_id:user.id,duration_seconds:duration,
      xp_earned:xpEarned,gloss_earned:glossEarned
    });
    if(error) console.error(error);
  }
};
