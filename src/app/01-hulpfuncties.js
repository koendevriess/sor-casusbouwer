/* ---------- helpers ---------- */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,10);
const nf=(v,d=2)=>(v==null||v===''||isNaN(v))?'':Number(v).toLocaleString('nl-NL',{minimumFractionDigits:d,maximumFractionDigits:d});
const parseNum=s=>{if(s==null)return null;const t=String(s).trim().replace(/\s/g,'').replace(',','.');if(t===''||t==='-')return null;const v=parseFloat(t);return isNaN(v)?null:v};
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const cssv=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const clone=o=>JSON.parse(JSON.stringify(o));
const nowIso=()=>new Date().toISOString();
const fmtDate=iso=>{if(!iso)return'';const d=new Date(iso);return d.toLocaleDateString('nl-NL',{day:'numeric',month:'short'})+' '+d.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})};
const ago=iso=>{if(!iso)return'–';const s=(Date.now()-new Date(iso).getTime())/1000;if(s<90)return'net';if(s<3600)return Math.round(s/60)+' min geleden';if(s<86400)return Math.round(s/3600)+' uur geleden';const d=Math.round(s/86400);return d===1?'gisteren':d+' dagen geleden'};
const LOGO=window.SOR_LOGO||{s:'',b:''};
$('#logoImg').src=LOGO.s;

