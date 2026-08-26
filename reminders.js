const SUPABASE_URL="https://qxjxopqvhnkoexpvnsrr.supabase.co";
const SUPABASE_KEY="sb_publishable_37_1NuI52Z7QP5STRQh8iw_RocldPyv";
const VAPID_PUBLIC_KEY="BMAkLI2jWePft49ru40llM4CndEcPC_wsnGc0LuBIdTcuIacoIZ14cbPRhwGTH-vBfCTbt2kJxCymAZrCduJA2c";
let reminderSb=null,currentChild=null,currentPin="";

if(!document.querySelector('link[href="reminders.css"]')){const l=document.createElement("link");l.rel="stylesheet";l.href="reminders.css";document.head.appendChild(l)}
function readChild(){try{return JSON.parse(localStorage.getItem("buhrsiChild")||"null")}catch(e){return null}}
function readPin(){try{return localStorage.getItem("buhrsiChildDeviceToken")||sessionStorage.getItem("buhrsiChildPin")||""}catch(e){return ""}}
function args(extra={}){return {p_child:currentChild?.id,p_pin:currentPin||null,...extra}}
function setStatus(text=""){const el=document.getElementById("reminderStatus028");if(el)el.textContent=text}
function urlB64ToUint8Array(base64String){const padding="=".repeat((4-base64String.length%4)%4),base64=(base64String+padding).replace(/-/g,"+").replace(/_/g,"/");const raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))}

function mount(){
  if(document.getElementById("reminders028"))return;
  const social=document.getElementById("social027")||document.getElementById("homeSection");if(!social)return;
  const section=document.createElement("section");section.id="reminders028";section.className="reminders028";
  section.innerHTML=`<div class="reminders028-head"><div><span class="eyebrow">ERINNERUNGEN</span><h2>Zahnputz-Zeiten</h2></div><span>🔔</span></div><div class="reminders028-grid"><div class="reminders028-row"><input id="morningEnabled028" type="checkbox"><div><label for="morningTime028">Morgens</label><input id="morningTime028" type="time" value="07:00"></div></div><div class="reminders028-row"><input id="eveningEnabled028" type="checkbox"><div><label for="eveningTime028">Abends</label><input id="eveningTime028" type="time" value="19:00"></div></div></div><div class="reminders028-actions"><button id="saveReminders028" class="primary028" type="button">ZEITEN SPEICHERN</button><button id="enablePush028" class="secondary028" type="button">BENACHRICHTIGUNGEN AKTIVIEREN</button></div><p id="reminderStatus028" class="reminders028-status"></p><p class="reminders028-note">Wenn für den jeweiligen Zeitraum schon geputzt wurde, kommt keine Erinnerung mehr.</p>`;
  social.insertAdjacentElement("afterend",section);
  document.getElementById("saveReminders028").addEventListener("click",saveSettings);
  document.getElementById("enablePush028").addEventListener("click",enablePush);
}

async function loadSettings(){
  if(!reminderSb||!currentChild)return;
  const {data,error}=await reminderSb.rpc("buhrsi_reminders_get",args());
  if(error){setStatus("Erinnerungen konnten noch nicht geladen werden.");console.info(error.message);return}
  const r=data?.[0];if(!r)return;
  document.getElementById("morningEnabled028").checked=!!r.morning_enabled;
  document.getElementById("morningTime028").value=String(r.morning_time||"07:00").slice(0,5);
  document.getElementById("eveningEnabled028").checked=!!r.evening_enabled;
  document.getElementById("eveningTime028").value=String(r.evening_time||"19:00").slice(0,5);
  const perm=("Notification" in window)?Notification.permission:"unsupported";
  setStatus(perm==="granted"?"Benachrichtigungen sind auf diesem Gerät erlaubt.":perm==="denied"?"Benachrichtigungen sind im Browser blockiert.":"");
}

async function saveSettings(){
  if(!currentChild)return;
  setStatus("Speichere …");
  const tz=Intl.DateTimeFormat().resolvedOptions().timeZone||"Europe/Berlin";
  const {error}=await reminderSb.rpc("buhrsi_reminders_save",args({p_morning_enabled:document.getElementById("morningEnabled028").checked,p_morning_time:document.getElementById("morningTime028").value,p_evening_enabled:document.getElementById("eveningEnabled028").checked,p_evening_time:document.getElementById("eveningTime028").value,p_timezone:tz}));
  setStatus(error?"Speichern fehlgeschlagen: "+error.message:"Erinnerungszeiten gespeichert ✓");
}

async function enablePush(){
  if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window))return setStatus("Dieses Gerät unterstützt Web-Push leider nicht.");
  const permission=await Notification.requestPermission();if(permission!=="granted")return setStatus("Benachrichtigungen wurden nicht erlaubt.");
  setStatus("Gerät wird für Erinnerungen registriert …");
  try{
    const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();
    if(sub){try{await sub.unsubscribe()}catch(e){}sub=null}
    sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlB64ToUint8Array(VAPID_PUBLIC_KEY)});
    const json=sub.toJSON();
    const {error}=await reminderSb.rpc("buhrsi_push_upsert",args({p_endpoint:json.endpoint,p_p256dh:json.keys?.p256dh,p_auth:json.keys?.auth,p_user_agent:navigator.userAgent}));
    if(error)throw error;await saveSettings();setStatus("Benachrichtigungen sind auf diesem Gerät aktiviert ✓");
  }catch(e){console.error(e);setStatus("Aktivierung fehlgeschlagen: "+(e.message||e))}
}

function selectChild(profile){currentChild=profile||readChild();currentPin=readPin();if(currentChild){mount();loadSettings()}}
window.addEventListener("buhrsi:child-change",e=>selectChild(e.detail));
if("serviceWorker" in navigator){navigator.serviceWorker.addEventListener("message",e=>{if(e.data?.type==="buhrsi:push-open"&&e.data?.startBrush)setTimeout(()=>document.getElementById("start")?.click(),250)})}
try{const m=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");reminderSb=m.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});selectChild(readChild())}catch(e){console.error("Erinnerungen konnten nicht geladen werden",e)}

import("./collection-fix.js").catch(e=>console.error("Sammlungs-Fix konnte nicht geladen werden",e));
import("./egg-stages.js").catch(e=>console.error("Ei-Stufen konnten nicht geladen werden",e));
