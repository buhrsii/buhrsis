const SUPABASE_URL="https://qxjxopqvhnkoexpvnsrr.supabase.co"; const SUPABASE_KEY="sb_publishable_37_1NuI52Z7QP5STRQh8iw_RocldPyv";
let sb,user,child,family,childModeSession=false,childPin="",parentTab="overview";
try{childPin=localStorage.getItem("buhrsiChildDeviceToken")||sessionStorage.getItem("buhrsiChildPin")||""}catch(e){}
const $=s=>document.querySelector(s), msg=t=>$("#cloudMessage").textContent=t||"";
function show(id){if(!id||id==="childLoginView")id="roleView";["roleView","childLoginView","authView","familyView","profileView"].forEach(x=>$("#"+x).hidden=x!==id);}
function app(on){$("#authGate").hidden=on;$(".app").hidden=!on}
const safe=t=>String(t??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const FAMILY_EMOJIS=["👨‍👩‍👧‍👦","🏡","❤️","🌟","🐻","🦊","🐼","🦁","🌈","🚀"];
function initials(name){const first=String(name||"").trim().match(/\p{L}/u)?.[0]||"K",familyWords=String(family?.name||"Buhrs").match(/\p{L}+/gu)||["Buhrs"],last=familyWords.at(-1)?.[0]||"B";return `${first}${last}`.toUpperCase()}
function choose(p,isChild=false){
 child=p;childModeSession=isChild;const profileInitials=initials(p.name);$("#profileName").textContent=p.name;document.querySelector(".top .avatar").textContent=profileInitials;$("#areaProfileName").textContent=p.name;$("#areaAvatar").textContent=profileInitials;
 try{
   localStorage.setItem("buhrsiChild",JSON.stringify(p));
   localStorage.setItem("buhrsiChildMode",isChild?"1":"0");
   window.BuhrsiDeviceSession?.saveChild?.(p);
 }catch(e){}
 app(true);
 window.dispatchEvent(new CustomEvent("buhrsi:child-change",{detail:p}));
}
async function profiles(){
 let {data,error}=await sb.from("child_profiles").select("id,parent_id,family_id,name,username,buhrsi_code,xp,gloss,streak,perfect_streak,egg_energy,last_brush_date,last_perfect_date").order("created_at");
 if(error)return msg(error.message);
 show("profileView");
 const isAdmin=Boolean(user?.app_metadata?.buhrsi_admin);
 const heading=$("#profileHeading"),eyebrow=$("#profileEyebrow");
 if(heading)heading.textContent=isAdmin?"Alle Profile verwalten":parentTab==="manage"?"Familie verwalten":`${family?.emoji||FAMILY_EMOJIS[0]} ${family?.name||"Familie"}`;
 if(eyebrow)eyebrow.textContent=isAdmin?"ADMINISTRATION":"FAMILIE";
 const summary=$("#familySummary");
 if(summary)summary.innerHTML=family?`<div class="family-identity"><div><small>FAMILIENGRUPPE</small><b><span class="family-emoji-inline" aria-hidden="true">${safe(family.emoji||FAMILY_EMOJIS[0])}</span> ${safe(family.name)}</b><span>${(family.adults||[]).length} Elternzugang${(family.adults||[]).length===1?"":"e"}</span></div></div><p>${(family.adults||[]).map(a=>`<b>${safe(a.display_name||a.email||"Elternteil")}</b> · Elternkonto${a.role==="owner"?" (Ersteller)":""}${a.display_name&&a.email?`<small>${safe(a.email)}</small>`:""}`).join("<br>")}</p>`:"";
 const manageSummary=$("#familyManageSummary");
 if(manageSummary)manageSummary.innerHTML=family?`<div><small>CODE FÜR WEITERE ELTERN</small><button type="button" id="copyFamilyCode">${safe(family.invite_code)} · KOPIEREN</button></div><form id="familySettingsForm" class="family-settings"><label><small>FAMILIENNAME</small><input id="editFamilyName" maxlength="60" required value="${safe(family.name)}"></label><label><small>EMOJI</small><select id="editFamilyEmoji" aria-label="Familien-Emoji">${FAMILY_EMOJIS.map(emoji=>`<option value="${emoji}"${emoji===(family.emoji||FAMILY_EMOJIS[0])?" selected":""}>${emoji}</option>`).join("")}</select></label><button type="submit">FAMILIE SPEICHERN</button></form>`:"";
 $("#copyFamilyCode")?.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(family.invite_code);msg("Familiencode kopiert.")}catch(e){msg("Familiencode: "+family.invite_code)}});
 $("#familySettingsForm")?.addEventListener("submit",async e=>{e.preventDefault();msg();const button=e.submitter;button.disabled=true;const {data,error}=await sb.rpc("buhrsi_family_update",{p_name:$("#editFamilyName").value.trim(),p_emoji:$("#editFamilyEmoji").value});button.disabled=false;if(error)return msg(error.message);family=data;msg("Familie gespeichert.");await profiles()});
 const list=$("#profileList"),manageList=$("#manageProfileList");list.innerHTML="";manageList.innerHTML="";
 (data||[]).forEach(p=>{renderOverviewChild(list,p);renderManageChild(manageList,p)});
 setParentTab(parentTab,false);
 loadParentChildSummaries(data||[]);
}
function openChildArea(p,tab){choose(p,false);if(tab)setTimeout(()=>window.BuhrsiOrganizer?.open?.(tab),60)}
function renderOverviewChild(list,p){const card=document.createElement("article");card.className="parent-child-card";card.dataset.childCard=p.id;card.innerHTML=`<div class="parent-child-head"><div class="parent-child-avatar">${safe(initials(p.name))}</div><div><h2>${safe(p.name)}</h2><small>@${safe(p.username||"noch-ohne-login")}</small></div><span>${Number(p.xp)||0} XP</span></div><div class="parent-child-school" data-school-summary><p>Schulinfos werden geladen …</p></div><div class="parent-child-actions"><button type="button" data-open-profile>PROFIL ÖFFNEN</button><button type="button" class="primary-parent-action" data-open-school>SCHULINFOS</button></div>`;card.querySelector("[data-open-profile]").onclick=()=>openChildArea(p);card.querySelector("[data-open-school]").onclick=()=>openChildArea(p,"overview");list.append(card)}
function renderManageChild(list,p){const card=document.createElement("div");card.className="profile-choice profile-choice-v154";card.innerHTML=`<div class="profile-info-v154"><b>${safe(p.name)}</b><small>@${safe(p.username||"noch-ohne-login")} · ${safe(p.buhrsi_code||"")}</small></div>`;const school=document.createElement("button");school.type="button";school.className="child-school-v050";school.textContent="SCHULE & NOTEN BEARBEITEN";school.onclick=()=>openChildArea(p,"manage");const start=document.createElement("button");start.type="button";start.className="child-start-v154";start.textContent="PROFIL ÖFFNEN";start.onclick=()=>openChildArea(p);const admin=document.createElement("button");admin.type="button";admin.className="child-admin-v154";admin.textContent="KINDERKONTO";admin.onclick=()=>window.openParentAdmin010?.(p);card.append(school,start,admin);list.append(card)}
async function loadParentChildSummaries(rows){await Promise.all(rows.map(async p=>{const host=document.querySelector(`[data-child-card="${p.id}"] [data-school-summary]`);if(!host)return;const {data,error}=await sb.rpc("buhrsi_organizer_snapshot",{p_child:p.id,p_token:null});if(error||!data){host.innerHTML='<p>Noch keine Schulinfos verfügbar.</p>';return}const profile=data.profile||{},grades=data.grades||[],weight=grades.reduce((n,g)=>n+Number(g.weight||0),0),average=weight?(grades.reduce((n,g)=>n+Number(g.grade)*Number(g.weight||0),0)/weight).toFixed(2):"—",next=(data.events||[]).filter(e=>!e.completed&&new Date(e.due_at)>=new Date()).sort((a,b)=>new Date(a.due_at)-new Date(b.due_at))[0],phone=profile.school_phone?`<span>☎ ${safe(profile.school_phone)}</span>`:"";host.innerHTML=`<div><small>SCHULE</small><b>${safe(profile.school_name||"Noch nicht eingetragen")}</b><span>${safe(profile.class_name||"Klasse offen")}</span>${phone}</div><div><small>NOTENSCHNITT</small><b>${average}</b><span>${grades.length} Note${grades.length===1?"":"n"}</span></div><div><small>NÄCHSTER TERMIN</small><b>${safe(next?.title||"Kein Termin")}</b><span>${next?new Date(next.due_at).toLocaleDateString("de-DE"):"Alles aktuell"}</span></div>`}))}
function setParentTab(tab,reloadHeading=true){parentTab=tab==="manage"?"manage":"overview";$("#parentOverview").hidden=parentTab!=="overview";$("#parentManage").hidden=parentTab!=="manage";document.querySelectorAll("[data-parent-tab]").forEach(b=>b.classList.toggle("active",b.dataset.parentTab===parentTab));if(reloadHeading){const isAdmin=Boolean(user?.app_metadata?.buhrsi_admin);$("#profileHeading").textContent=isAdmin?"Alle Profile verwalten":parentTab==="manage"?"Familie verwalten":`${family?.emoji||FAMILY_EMOJIS[0]} ${family?.name||"Familie"}`}}
document.querySelector(".parent-tabs")?.addEventListener("click",e=>{const tab=e.target.closest("[data-parent-tab]")?.dataset.parentTab;if(tab)setParentTab(tab)});
async function afterParentLogin(){
 const isAdmin=Boolean(user?.app_metadata?.buhrsi_admin);
 const {data,error}=await sb.rpc("buhrsi_family_status");
 if(error&&!isAdmin)return msg(error.message);
 family=data||null;
 if(!family&&!isAdmin){app(false);show("familyView");return}
 await profiles();
}
$("#openSignup").onclick=()=>{msg();show("authView")};
document.querySelectorAll(".back-auth").forEach(b=>b.onclick=()=>{msg();show("roleView")});
$("#unifiedLoginForm").onsubmit=async e=>{
 e.preventDefault();msg();
 const identity=$("#loginIdentity").value.trim(),secret=$("#loginSecret").value;
 if(identity.includes("@")){
   try{localStorage.removeItem("buhrsiChild");localStorage.removeItem("buhrsiChildMode");localStorage.removeItem("buhrsiChildDeviceToken");sessionStorage.removeItem("buhrsiChildPin")}catch(e){}
   child=null;childPin="";childModeSession=false;
   const {data,error}=await sb.auth.signInWithPassword({email:identity,password:secret});
   if(error)return msg("Anmeldung fehlgeschlagen. Bitte Eingaben prüfen.");
   user=data.user;await afterParentLogin();return;
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
$("#createFamilyForm").onsubmit=async e=>{e.preventDefault();msg();const button=e.submitter;button.disabled=true;const {data,error}=await sb.rpc("buhrsi_family_create",{p_name:$("#familyName").value.trim()});button.disabled=false;if(error)return msg(error.message);family=data;await profiles()};
$("#joinFamilyForm").onsubmit=async e=>{e.preventDefault();msg();const button=e.submitter;button.disabled=true;const {data,error}=await sb.rpc("buhrsi_family_join",{p_code:$("#familyCode").value.trim().toUpperCase()});button.disabled=false;if(error)return msg(error.message);family=data;await profiles()};
document.querySelectorAll(".family-logout").forEach(b=>b.onclick=()=>logoutToLogin041());
$("#childForm").onsubmit=async e=>{e.preventDefault();msg();let {data,error}=await sb.rpc("create_child_account",{p_name:$("#childName").value.trim(),p_username:$("#childUsername").value.trim(),p_pin:$("#childPin").value});if(error)return msg(error.message);$("#childForm").reset();await profiles()};
async function logoutToLogin041(){
 const token=(()=>{try{return localStorage.getItem("buhrsiChildDeviceToken")||""}catch(e){return ""}})();
 const hadUser=Boolean(user);
 try{localStorage.removeItem("buhrsiChild");localStorage.removeItem("buhrsiChildMode");localStorage.removeItem("buhrsiChildDeviceToken");sessionStorage.removeItem("buhrsiChildPin");window.BuhrsiDeviceSession?.clearChild?.()}catch(e){}
 childPin="";child=null;family=null;user=null;childModeSession=false;document.body.classList.remove("school-mode","locked");app(false);show("roleView");msg();
 if(token&&sb){try{await sb.rpc("buhrsi_revoke_child_device_session",{p_token:token})}catch(e){}}
 if(hadUser&&sb){try{await sb.auth.signOut({scope:"local"})}catch(e){}}
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
     else if(error){try{choose(JSON.parse(saved),true);msg("Verbindung wird wiederhergestellt. Das Profil bleibt angemeldet.")}catch(e){app(false);show("roleView")}}
     else{try{localStorage.removeItem("buhrsiChild");localStorage.removeItem("buhrsiChildMode");localStorage.removeItem("buhrsiChildDeviceToken");sessionStorage.removeItem("buhrsiChildPin")}catch(e){}childPin="";app(false);show("roleView");msg("Die Kinder-Sitzung ist abgelaufen. Bitte erneut anmelden.")}
   }else{
     try{choose(JSON.parse(saved),true)}catch(e){localStorage.removeItem("buhrsiChild");app(false);show("roleView")}
   }
 }
 else if(saved&&!savedMode&&user){try{choose(JSON.parse(saved),false)}catch(e){localStorage.removeItem("buhrsiChild")}}
 else if(saved){try{localStorage.removeItem("buhrsiChild");localStorage.removeItem("buhrsiChildMode")}catch(e){}app(false);show("roleView")}
 else if(user)await afterParentLogin();
 else{app(false);show("roleView")}
}catch(e){console.error(e);msg("Cloud-Verbindung konnte nicht geladen werden.")}

async function openChildSelector(){
 msg();
 app(false);
 if(!user&&sb){
   const {data}=await sb.auth.getSession();
   user=data.session?.user||null;
 }
 if(user)await afterParentLogin();
 else show("roleView");
}
window.BuhrsiAuth={openChildSelector,logout:logoutToLogin041};
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
   const args={p_child:child.id,p_pin:childModeSession?childPin:null,p_duration:duration};
   const {data,error}=await sb.rpc("complete_child_brushing_v024",args);
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

// v0.44 Kids-Organizer cloud bridge
window.BuhrsiOrganizerAPI={
 isParent(){return Boolean(user&&!childModeSession)},
 child(){return child},
 async snapshot(){
   if(!sb||!child)return null;
   const {data,error}=await sb.rpc("buhrsi_organizer_snapshot",{p_child:child.id,p_token:childModeSession?childPin:null});
   if(error){console.error("organizer snapshot",error);throw error}return data;
 },
 async save(table,row,upsert=false){
   const allowed=new Set(["school_profiles","school_subjects","school_teachers","school_timetable","school_schedule_entries","school_events","home_tasks"]);
   if(!this.isParent()||!allowed.has(table))throw new Error("Nur Eltern dürfen diese Angaben ändern.");
   const payload={...row,child_id:child.id};
   const conflicts={school_profiles:"child_id",school_timetable:"child_id,weekday,period",school_schedule_entries:"child_id,period"};
   const query=upsert?sb.from(table).upsert(payload,{onConflict:conflicts[table]||"id"}):sb.from(table).insert(payload);
   const {data,error}=await query.select().single();if(error)throw error;return data;
 },
 async remove(table,id){
   const allowed=new Set(["school_subjects","school_teachers","school_timetable","school_schedule_entries","school_events","home_tasks"]);
   if(!this.isParent()||!allowed.has(table))throw new Error("Nur Eltern dürfen Einträge löschen.");
   const {error}=await sb.from(table).delete().eq("id",id).eq("child_id",child.id);if(error)throw error;
 },
 async learn(minutes,subject){
   const {data,error}=await sb.rpc("buhrsi_log_learning",{p_child:child.id,p_minutes:minutes,p_subject:subject||null,p_token:childModeSession?childPin:null});
   if(error)throw error;child.xp=data.xp;try{localStorage.setItem("buhrsiChild",JSON.stringify(child))}catch(e){}window.dispatchEvent(new CustomEvent("buhrsi:progress-saved",{detail:child}));return data;
 },
 async completeTask(taskId){
   const {data,error}=await sb.rpc("buhrsi_complete_home_task",{p_child:child.id,p_task:taskId,p_token:childModeSession?childPin:null});
   if(error)throw error;child.xp=data.xp;try{localStorage.setItem("buhrsiChild",JSON.stringify(child))}catch(e){}window.dispatchEvent(new CustomEvent("buhrsi:progress-saved",{detail:child}));return data;
 },
 async addGrade(values){
   if(!this.isParent())throw new Error("Nur Eltern dürfen Noten eintragen.");
   const {data,error}=await sb.rpc("buhrsi_add_grade",{p_child:child.id,p_subject:values.subject,p_grade:values.grade,p_category:values.category,p_weight:values.weight,p_title:values.title||null,p_graded_on:values.date});
   if(error)throw error;child.xp=data.xp;window.dispatchEvent(new CustomEvent("buhrsi:progress-saved",{detail:child}));return data;
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
