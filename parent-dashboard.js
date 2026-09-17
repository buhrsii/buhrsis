const startupStylePD=document.createElement("link");
startupStylePD.rel="stylesheet";
startupStylePD.href="./auth-startup.css?v=069";
document.head.appendChild(startupStylePD);
const revealAuthPD=()=>document.documentElement.classList.add("buhrsi-auth-ready");
const authReadyPD=setInterval(()=>{if(window.BuhrsiAuth){clearInterval(authReadyPD);revealAuthPD()}},25);
setTimeout(()=>{clearInterval(authReadyPD);revealAuthPD()},4000);

const escPD=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const localDatePD=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const todayISO=()=>localDatePD();
const shiftDatePD=(value,days)=>{const date=new Date(value+"T12:00:00Z");date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10)};
const dayLabelPD=value=>new Date(value).toLocaleDateString("de-DE",{weekday:"short",day:"2-digit",month:"2-digit"});
const timePD=value=>new Date(value).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"});
const localInputPD=value=>{const date=new Date(value),offset=date.getTimezoneOffset()*60000;return new Date(date-offset).toISOString().slice(0,16)};
const subjectPD=(snapshot,id)=>(snapshot.subjects||[]).find(item=>String(item.id)===String(id));
let sbPD=null;
const dashboardCachePD=new Map();

async function clientPD(){
 if(window.BuhrsiDBClient)return window.BuhrsiDBClient;
 if(sbPD)return sbPD;
 const source=await fetch("./cloud.js",{cache:"no-store"}).then(response=>response.text());
 const url=source.match(/SUPABASE_URL="([^"]+)/)?.[1],key=source.match(/SUPABASE_KEY="([^"]+)/)?.[1];
 if(!url||!key)throw new Error("Cloud-Konfiguration fehlt");
 const module=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
 sbPD=module.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 return sbPD;
}

function calculateStreaksPD(rows){
 const counts=new Map();
 rows.forEach(row=>{const date=String(row.completed_at).slice(0,10);counts.set(date,(counts.get(date)||0)+1)});
 const dates=[...counts.keys()].sort().reverse(),latest=dates[0]||null;
 let streak=0,day=latest;
 while(day&&(counts.get(day)||0)>0){streak++;day=shiftDatePD(day,-1)}
 const perfectDates=dates.filter(date=>(counts.get(date)||0)>=2),lastPerfect=perfectDates[0]||null;
 let perfect=0;day=lastPerfect;
 while(day&&(counts.get(day)||0)>=2){perfect++;day=shiftDatePD(day,-1)}
 return {streak,perfect,lastBrush:latest,lastPerfect};
}

async function loadDashboardPD(card,force=false){
 const childId=card.dataset.childCard;
 if(!force&&dashboardCachePD.has(childId))return dashboardCachePD.get(childId);
 const client=await clientPD(),since=new Date(Date.now()-31*86400000).toISOString();
 const [organizer,timers,brushes]=await Promise.all([
  client.rpc("buhrsi_organizer_snapshot",{p_child:childId,p_token:null}),
  client.rpc("buhrsi_activity_timers_snapshot",{p_child:childId,p_token:null}),
  client.from("brushing_sessions").select("id,completed_at,duration_seconds,xp_earned,gloss_earned").eq("child_id",childId).gte("completed_at",since).order("completed_at",{ascending:false}).limit(100)
 ]);
 if(organizer.error||!organizer.data)throw organizer.error||new Error("Statistik konnte nicht geladen werden");
 if(timers.error)throw timers.error;
 if(brushes.error)throw brushes.error;
 const data={snapshot:organizer.data,timers:timers.data||{active:[],history:[]},brushes:brushes.data||[]};
 dashboardCachePD.set(childId,data);
 return data;
}

function weekTotalsPD(data){
 const since=Date.now()-7*86400000;
 const today=data.brushes.filter(row=>String(row.completed_at).slice(0,10)===todayISO()).length;
 const brushing=data.brushes.filter(row=>new Date(row.completed_at).getTime()>=since).length;
 const learning=(data.snapshot.learning||[]).filter(row=>new Date(row.completed_at).getTime()>=since).reduce((sum,row)=>sum+Number(row.minutes||0),0);
 return {today,brushing,learning};
}

function compactCardPD(card,data,streak){
 const host=card.querySelector("[data-school-summary]"),totals=weekTotalsPD(data);
 if(host)host.innerHTML=`<div class="parent-child-facts simple"><div class="parent-mini-stat"><small>XP</small><b>${escPD((card.querySelector(".parent-child-head>span")?.textContent||"0").replace(/[^0-9]/g,""))}</b></div><div class="parent-mini-stat ${totals.today?"brush-ok":"brush-open"}"><small>HEUTE GEPUTZT</small><b>${totals.today}×</b></div><div class="parent-mini-stat"><small>7 TAGE GELERNT</small><b>${totals.learning} Min.</b></div></div><p class="parent-quick-status">🔥 ${Number(streak||0)} Tage Putzserie · 🪥 ${totals.brushing} Putzrunden in 7 Tagen</p>`;
 const actions=card.querySelector(".parent-child-actions");
 if(actions&&!actions.querySelector("[data-open-statistics]")){
  const stats=document.createElement("button");
  stats.type="button";stats.className="parent-stats-action";stats.dataset.openStatistics="";
  stats.innerHTML="<span>▥</span> STATISTIK & KORRIGIEREN";
  stats.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();openStatsPD(card)});
  actions.prepend(stats);
 }
}

function activityRowsPD(data){
 const timers=(data.timers.history||[]).map(row=>({kind:row.timer_type,at:row.ended_at||row.started_at,row}));
 const brushes=data.brushes.map(row=>({kind:"brush",at:row.completed_at,row}));
 return [...timers,...brushes].sort((a,b)=>new Date(b.at)-new Date(a.at)).slice(0,40);
}

function activityButtonPD(activity,data){
 if(activity.kind==="brush")return `<button type="button" class="parent-activity-row" data-edit-brush="${String(activity.row.completed_at).slice(0,10)}"><span class="parent-activity-icon">🪥</span><span><b>Zähneputzen</b><small>${escPD(dayLabelPD(activity.at))} · ${escPD(timePD(activity.at))} Uhr</small></span><em>ÄNDERN</em></button>`;
 const learning=activity.kind==="learning",subject=subjectPD(data.snapshot,activity.row.subject_id)?.name||"Ohne Fach";
 return `<button type="button" class="parent-activity-row" data-edit-timer="${activity.row.id}"><span class="parent-activity-icon">${learning?"📚":"📝"}</span><span><b>${learning?escPD(subject)+" lernen":"Hausaufgaben · "+escPD(subject)}</b><small>${escPD(dayLabelPD(activity.at))} · ${Number(activity.row.minutes)||0} Min. · +${Number(activity.row.xp_awarded)||0} XP</small></span><em>ÄNDERN</em></button>`;
}

function ensureStatsDialogPD(){
 let dialog=document.getElementById("parentStatsDialog072");
 if(dialog)return dialog;
 dialog=document.createElement("section");dialog.id="parentStatsDialog072";dialog.className="parent-stats-dialog";dialog.hidden=true;dialog.setAttribute("role","dialog");dialog.setAttribute("aria-modal","true");
 dialog.innerHTML='<div class="parent-stats-sheet"><button type="button" class="parent-stats-close" aria-label="Schließen">×</button><div data-parent-stats-content></div></div>';
 dialog.querySelector(".parent-stats-close").onclick=closeStatsPD;
 dialog.addEventListener("click",event=>{if(event.target===dialog)closeStatsPD()});
 document.body.append(dialog);return dialog;
}
function closeStatsPD(){const dialog=document.getElementById("parentStatsDialog072");if(dialog)dialog.hidden=true;document.body.classList.remove("locked")}

function statsMarkupPD(card,data){
 const name=card.querySelector(".parent-child-head h2")?.textContent?.trim()||"Kind",totals=weekTotalsPD(data),rows=activityRowsPD(data);
 return `<header class="parent-stats-heading"><span class="eyebrow">${escPD(name)}</span><h2>Statistik & Korrekturen</h2><p>Tippe eine Aktivität an, wenn Zeit oder Eintrag nicht stimmt.</p></header><div class="parent-stats-totals"><div><small>XP</small><b>${escPD((card.querySelector(".parent-child-head>span")?.textContent||"0").replace(/[^0-9]/g,""))}</b></div><div><small>7 TAGE LERNEN</small><b>${totals.learning} Min.</b></div><div><small>7 TAGE PUTZEN</small><b>${totals.brushing}×</b></div></div><div class="parent-filter-tabs" role="tablist"><button class="active" type="button" data-activity-filter="all">ALLE</button><button type="button" data-activity-filter="learning">LERNEN</button><button type="button" data-activity-filter="homework">HAUSAUFGABEN</button><button type="button" data-activity-filter="brush">ZÄHNE</button></div><div class="parent-correction-editor" data-correction-editor hidden></div><div class="parent-activity-rows">${rows.length?rows.map(row=>`<div data-activity-kind="${row.kind}">${activityButtonPD(row,data)}</div>`).join(""):'<p class="parent-activity-empty">Noch keine Aktivitäten gespeichert.</p>'}</div>`;
}

function brushEditorPD(date,data){
 const count=data.brushes.filter(row=>String(row.completed_at).slice(0,10)===date).length;
 return `<form data-brush-correction class="parent-edit-form"><div><span>🪥</span><h3>Putzrunden korrigieren</h3><p>${new Date(date+"T12:00:00").toLocaleDateString("de-DE",{weekday:"long",day:"2-digit",month:"long"})}</p></div><label>Tag<input name="date" type="date" max="${todayISO()}" value="${date}" required></label><label>Anzahl<select name="count"><option value="0"${count===0?" selected":""}>0× – nicht geputzt</option><option value="1"${count===1?" selected":""}>1× – geputzt</option><option value="2"${count>=2?" selected":""}>2× – morgens & abends</option></select></label><button type="submit">PUTZTAG SPEICHERN</button><small>Die Putzserie wird danach automatisch neu berechnet.</small><p data-edit-message></p></form>`;
}

function timerEditorPD(timer,data){
 const learning=timer.timer_type==="learning",subject=subjectPD(data.snapshot,timer.subject_id)?.name||"Ohne Fach";
 return `<form data-timer-correction="${timer.id}" class="parent-edit-form"><div><span>${learning?"📚":"📝"}</span><h3>${learning?escPD(subject)+" lernen":"Hausaufgaben korrigieren"}</h3><p>${escPD(dayLabelPD(timer.ended_at||timer.started_at))} · aktuell ${Number(timer.minutes)||0} Minuten</p></div><label>Start<input name="started" type="datetime-local" value="${localInputPD(timer.started_at)}" required></label><label>Ende<input name="ended" type="datetime-local" value="${localInputPD(timer.ended_at)}" required></label><button type="submit">ZEIT & XP NEU BERECHNEN</button><small>Erlaubt sind 5 bis 240 Minuten. Die XP werden passend angepasst.</small><p data-edit-message></p></form>`;
}

async function saveBrushCorrectionPD(card,date,count){
 const client=await clientPD(),childId=card.dataset.childCard,start=`${date}T00:00:00.000Z`,end=`${shiftDatePD(date,1)}T00:00:00.000Z`;
 const [profileResult,currentResult]=await Promise.all([client.from("child_profiles").select("parent_id").eq("id",childId).single(),client.from("brushing_sessions").select("id,completed_at,xp_earned").eq("child_id",childId).gte("completed_at",start).lt("completed_at",end).order("completed_at",{ascending:true})]);
 if(profileResult.error)throw profileResult.error;if(currentResult.error)throw currentResult.error;
 const current=currentResult.data||[];
 if(current.length>count){const remove=current.slice().sort((a,b)=>Number(a.xp_earned||0)-Number(b.xp_earned||0)||new Date(b.completed_at)-new Date(a.completed_at)).slice(0,current.length-count).map(row=>row.id),result=await client.from("brushing_sessions").delete().in("id",remove);if(result.error)throw result.error}
 else if(current.length<count){const times=["07:30:00.000Z","19:30:00.000Z"],rows=Array.from({length:count-current.length},(_,index)=>({child_id:childId,parent_id:profileResult.data.parent_id,duration_seconds:120,xp_earned:0,gloss_earned:0,completed_at:`${date}T${times[Math.min(current.length+index,1)]}`})),result=await client.from("brushing_sessions").insert(rows);if(result.error)throw result.error}
 const all=await client.from("brushing_sessions").select("completed_at").eq("child_id",childId).order("completed_at",{ascending:false}).limit(1000);if(all.error)throw all.error;
 const stats=calculateStreaksPD(all.data||[]),update=await client.from("child_profiles").update({streak:stats.streak,perfect_streak:stats.perfect,last_brush_date:stats.lastBrush,last_perfect_date:stats.lastPerfect}).eq("id",childId);if(update.error)throw update.error;
 return stats;
}

async function refreshStatsPD(card){const data=await loadDashboardPD(card,true),streak=calculateStreaksPD(data.brushes).streak;compactCardPD(card,data,streak);renderStatsPD(card,data)}

function bindStatsPD(card,data){
 const dialog=ensureStatsDialogPD(),content=dialog.querySelector("[data-parent-stats-content]"),editor=content.querySelector("[data-correction-editor]");
 content.querySelectorAll("[data-activity-filter]").forEach(button=>button.onclick=()=>{content.querySelectorAll("[data-activity-filter]").forEach(item=>item.classList.toggle("active",item===button));content.querySelectorAll("[data-activity-kind]").forEach(row=>row.hidden=button.dataset.activityFilter!=="all"&&row.dataset.activityKind!==button.dataset.activityFilter)});
 content.querySelectorAll("[data-edit-brush]").forEach(button=>button.onclick=()=>{editor.hidden=false;editor.innerHTML=brushEditorPD(button.dataset.editBrush,data);editor.scrollIntoView({behavior:"smooth",block:"start"});const form=editor.querySelector("form");form.onsubmit=async event=>{event.preventDefault();const submit=event.submitter,message=form.querySelector("[data-edit-message]"),values=Object.fromEntries(new FormData(form));submit.disabled=true;message.textContent="Wird gespeichert …";try{await saveBrushCorrectionPD(card,values.date,Number(values.count));await refreshStatsPD(card)}catch(error){message.textContent="Speichern fehlgeschlagen: "+error.message;submit.disabled=false}}});
 content.querySelectorAll("[data-edit-timer]").forEach(button=>button.onclick=()=>{const timer=(data.timers.history||[]).find(row=>row.id===button.dataset.editTimer);if(!timer)return;editor.hidden=false;editor.innerHTML=timerEditorPD(timer,data);editor.scrollIntoView({behavior:"smooth",block:"start"});const form=editor.querySelector("form");form.onsubmit=async event=>{event.preventDefault();const submit=event.submitter,message=form.querySelector("[data-edit-message]"),values=Object.fromEntries(new FormData(form));submit.disabled=true;message.textContent="Wird gespeichert …";try{const client=await clientPD(),result=await client.rpc("buhrsi_edit_activity_timer",{p_child:card.dataset.childCard,p_timer:timer.id,p_started_at:new Date(values.started).toISOString(),p_ended_at:new Date(values.ended).toISOString()});if(result.error)throw result.error;await refreshStatsPD(card)}catch(error){message.textContent=error.message;submit.disabled=false}}});
}

function renderStatsPD(card,data){const dialog=ensureStatsDialogPD(),content=dialog.querySelector("[data-parent-stats-content]");content.innerHTML=statsMarkupPD(card,data);bindStatsPD(card,data)}
async function openStatsPD(card){const dialog=ensureStatsDialogPD(),content=dialog.querySelector("[data-parent-stats-content]");dialog.hidden=false;document.body.classList.add("locked");content.innerHTML='<p class="parent-stats-loading">Statistik wird geladen …</p>';try{const data=await loadDashboardPD(card,true);renderStatsPD(card,data)}catch(error){content.innerHTML=`<p class="parent-stats-error">Statistik konnte nicht geladen werden.<br><small>${escPD(error.message)}</small></p>`}}

async function enhanceCardPD(card,streak,force=false){if(card.dataset.dashboardLoading==="1")return;card.dataset.dashboardLoading="1";try{const data=await loadDashboardPD(card,force);compactCardPD(card,data,streak)}catch(error){console.error("parent dashboard",error)}finally{card.dataset.dashboardLoading="0"}}
async function enrichRowsPD(force=false){const view=document.querySelector("#profileView"),list=document.querySelector("#profileList");if(!view||view.hidden||!list)return;const client=await clientPD(),profiles=await client.from("child_profiles").select("id,streak"),streaks=new Map((profiles.data||[]).map(row=>[String(row.id),Number(row.streak||0)]));list.querySelectorAll(".parent-child-card").forEach(card=>enhanceCardPD(card,streaks.get(String(card.dataset.childCard))||0,force));const heading=document.querySelector("#profileHeading");if(heading&&document.querySelector("#parentOverview:not([hidden])"))heading.textContent="Meine Kinder";if(!document.querySelector(".parent-dashboard-date")){const date=document.createElement("p");date.className="parent-dashboard-date";date.textContent=new Intl.DateTimeFormat("de-DE",{weekday:"long",day:"numeric",month:"long"}).format(new Date());heading?.insertAdjacentElement("afterend",date)}}
let timerPD=0;const observerPD=new MutationObserver(()=>{clearTimeout(timerPD);timerPD=setTimeout(()=>enrichRowsPD(false).catch(console.error),80)});observerPD.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["hidden"]});setTimeout(()=>enrichRowsPD(true).catch(console.error),900);setInterval(()=>enrichRowsPD(true).catch(console.error),60000);

function timerAlertSeenPD(id){try{const key="buhrsis:timer-alerts-seen",seen=JSON.parse(sessionStorage.getItem(key)||"[]");if(seen.includes(id))return true;sessionStorage.setItem(key,JSON.stringify([...seen,id].slice(-50)));return false}catch(error){return false}}
function showTimerAlertPD(row){if(timerAlertSeenPD(row.id))return;const kind=row.timer_type==="learning"?"Lern-Timer":"Hausaufgaben-Timer",icon=row.timer_type==="learning"?"📚":"📝",started=timePD(row.started_at),old=document.getElementById("parentTimerAlert071");old?.remove();const alert=document.createElement("aside");alert.id="parentTimerAlert071";alert.className="parent-timer-alert";alert.setAttribute("role","status");alert.innerHTML=`<span>${icon}</span><div><small>TIMER GESTARTET</small><b>${escPD(row.child_name)} hat den ${kind} gestartet</b><p>${started} Uhr${row.title?` · ${escPD(row.title)}`:""}</p></div><button type="button" aria-label="Schließen">×</button>`;alert.querySelector("button").onclick=()=>alert.remove();document.body.append(alert);setTimeout(()=>alert.remove(),12000);if(window.Notification?.permission==="granted")new Notification(`${row.child_name}: ${kind} gestartet`,{body:`Start ${started} Uhr${row.title?` · ${row.title}`:""}`,icon:"./icon-moxu-192.png"})}
async function pollTimerAlertsPD(){try{const client=await clientPD(),session=await client.auth.getSession();if(!session.data.session)return;const {data,error}=await client.rpc("buhrsi_family_timer_alerts");if(error)return;(data||[]).reverse().forEach(showTimerAlertPD)}catch(error){console.error("timer alerts",error)}}
setTimeout(pollTimerAlertsPD,1800);setInterval(pollTimerAlertsPD,15000);document.addEventListener("visibilitychange",()=>{if(!document.hidden)pollTimerAlertsPD()});
