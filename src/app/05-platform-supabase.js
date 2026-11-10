/* ---------- platform: Supabase ---------- */
const SB_URL='https://egehozcyhbdzefjghsfb.supabase.co';
const SB_KEY='sb_publishable_9tJMHZx8eKWhU_jCcjSLNA_Y9QeOrhm';
const APP={mode:'laden',role:'local',sb:null,user:null,uid:null,lid:null,isStaff:false,isLm:false,lmOf:{},lmFor:{},target:null,targetNaam:'',exists:false,chans:[],fb:null,roster:[],staffNames:{},dirty:new Set(),saving:false,lastRev:null,t:null,fbT:null,fbSaving:false,fbDirty:false,dashFilter:'actief',meta:{},photoCache:{},loginTab:'in',th:null};
const editable=()=>['local','kandidaat','staff'].includes(APP.role)&&APP.mode==='edit'&&!(APP.role==='staff'&&APP.isLm);
const one=x=>Array.isArray(x)?(x[0]||null):(x||null);
const normCode=c=>String(c||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const fmtCode=c=>{const n=normCode(c);return n.length===8?n.slice(0,4)+'-'+n.slice(4):n};
const siteUrl=()=>location.origin+location.pathname.replace(/index\.html$/,'');
/* PORTAL=true op het hoofdadres (inloggen + doorsturen); elk gebied heeft een eigen adres /<gebied>/ */
//#if amsterdam,groningen,utrecht,gebied
const PORTAL=false;
//#elif portaal
const PORTAL=true;
//#endif
const ROOT=()=>PORTAL?siteUrl():siteUrl().replace(/[a-z0-9-]+\/$/,'');
const STADS=['amsterdam','groningen','utrecht'];
const STAD_NAAM={amsterdam:'Amsterdam',groningen:'Groningen',utrecht:'Utrecht'};
const cityUrl=st=>ROOT()+(st||'amsterdam')+'/';
const cityRel=st=>(PORTAL?'':'../')+(st||'amsterdam')+'/';
const stadOpts=sel=>STADS.map(c=>'<option value="'+c+'"'+(c===sel?' selected':'')+'>'+STAD_NAAM[c]+'</option>').join('');
function setSaveState(t,bad){const el=$('#saveState');el.textContent=t||'';el.style.color=bad?'var(--err)':''}
function markDirty(key){if(APP.role==='local'){saveLocal();return}if(APP.role==='voorbeeld'||!APP.target)return;if(key)APP.dirty.add(key);clearTimeout(APP.t);APP.t=setTimeout(flush,900);setSaveState('Wijzigingen opslaan…')}
let saveTimer=null;
function saveLocal(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{const s=Object.assign(casusData(),{v:2,isVoorbeeld:state.isVoorbeeld,ui:{step:state.ui.step}});localStorage.setItem(LS_KEY,JSON.stringify(s));setSaveState('Automatisch opgeslagen in deze browser')}catch(e){setSaveState('Niet opgeslagen: de browseropslag is vol of geblokkeerd. Maak een back-up.',true)}},350)}
async function flush(){if(!APP.target||!APP.sb)return;if(APP.saving){clearTimeout(APP.t);APP.t=setTimeout(flush,500);return}if(!APP.dirty.size&&APP.exists)return;APP.saving=true;const id=APP.target;let keys=[];
  try{
    if(!APP.exists){const {data,error}=await APP.sb.from('casussen').select('casus,rev').eq('kandidaat_id',id).maybeSingle();if(error)throw error;
      if(data){APP.exists=true;APP.lastRev=data.rev;CASUS_KEYS.forEach(k=>{if(!APP.dirty.has(k)&&data.casus&&data.casus[k]!==undefined)state[k]=clone(data.casus[k])});state=migrate(state);computeRoute();changed({route:true,items:true,panel:false})}}
    keys=APP.exists?[...APP.dirty]:CASUS_KEYS.slice();APP.dirty.clear();
    const rev=uid();APP.lastRev=rev;const patch={};keys.forEach(k=>patch[k]=clone(state[k]));const pct=progressPct();
    const {error}=await APP.sb.rpc('bewaar_casus',{p_id:id,p_patch:patch,p_voortgang:pct,p_rev:rev});if(error)throw error;
    APP.exists=true;Object.assign(APP.meta,{rev,voortgang:pct,bijgewerkt:nowIso()});setSaveState('Opgeslagen · '+fmtDate(nowIso()).split(' ').pop())}
  catch(e){keys.forEach(k=>APP.dirty.add(k));dbError(e,'opslaan')}
  finally{APP.saving=false;if(APP.dirty.size){clearTimeout(APP.t);APP.t=setTimeout(flush,2000)}}}
function dbError(e,what){const c=e&&e.code,msg=(e&&e.message)||'';
  if(c==='42501'||/row-level security|permission denied/i.test(msg)){setSaveState('Opslaan is geweigerd: je hebt hier geen toegang (meer).',true);toast('Je wijzigingen kunnen niet worden opgeslagen. Mogelijk is je toegang gewijzigd.',true);checkStillMember();return}
  if(c==='PGRST301'||/jwt|token/i.test(msg)){toast('Je sessie is verlopen. Log opnieuw in.',true);showLogin();return}
  if(/failed to fetch|network/i.test(msg)){setSaveState('Geen verbinding. We proberen het opnieuw.',true);return}
  setSaveState('Niet opgeslagen'+(msg?' ('+msg+')':'')+'. We proberen het opnieuw.',true)}
async function checkStillMember(){if(!APP.sb||!APP.user)return;const {data,error}=await APP.sb.from('leden').select('id').eq('user_id',APP.user.id).maybeSingle();if(!error&&!data)showBlocked()}

/* login & session */
async function initPlatform(){
  if(!(window.supabase&&window.supabase.createClient)){showScreen('Geen verbinding','De casusbouwer kan nu geen verbinding maken. Controleer je internetverbinding en probeer het opnieuw.',[['Opnieuw proberen','reload']]);return}
  APP.sb=window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'sor-casusbouwer-auth'}});
  APP.sb.auth.onAuthStateChange((ev,session)=>{if(ev==='SIGNED_OUT'){APP.user=null;APP.uid=null;APP.lid=null;if(APP.role!=='local')showLogin()}else if(session&&session.user){APP.user=session.user;APP.uid=session.user.id}});
  showScreen('Casusbouwer laden','Even geduld…',null,true);
  let session=null;try{const {data}=await APP.sb.auth.getSession();session=data&&data.session}catch(e){}
  if(session&&session.user){APP.user=session.user;APP.uid=session.user.id;await afterLogin()}else showLogin()}
/* duidelijke foutmelding; op een database zonder de nieuwste update (015/016) geen technische tekst */
const dbOntbreekt=e=>!!e&&/schema cache|does not exist|PGRST205|PGRST204|42P01|42703/i.test(String(e.message||'')+' '+String(e.code||''));
const foutTekst=(e,actie)=>dbOntbreekt(e)?'Dit onderdeel werkt nog niet: de database moet eerst worden bijgewerkt (zie OVERDRACHT.md, database-update 015 t/m 019).':(actie||'Opslaan')+' is mislukt: '+((e&&e.message)||'onbekende fout');
/* gebieden uit de database: namen en volgorde, plus nieuwe gebieden (zonder de kaart, die is groot) */
async function loadGebieden(){if(!APP.sb)return;try{const {data,error}=await APP.sb.from('gebieden').select('slug,naam,actief,ingebouwd,volgorde,instellingen,traject');APP.verouderd=!!(error&&dbOntbreekt(error));if(error||!data)return;data.sort((a,b)=>(a.volgorde-b.volgorde)||String(a.naam).localeCompare(b.naam));APP.gebieden=data;
  data.forEach(g=>{STAD_NAAM[g.slug]=g.naam;if(!STADS.includes(g.slug)&&(g.actief||APP.isStaff))STADS.push(g.slug)})}catch(e){}}
const gebiedVan=st=>(APP.gebieden||[]).find(g=>g.slug===st)||null;
/* geslaagd: de kandidaat ziet alleen nog een felicitatiescherm en kan zijn casus downloaden; leeromgeving en casusbouwer zijn dicht */
const isGeslaagd=()=>!!(APP.lid&&!APP.isStaff&&!APP.isLm&&(APP.lid.rol||'kandidaat')==='kandidaat'&&APP.lid.status==='geslaagd');
function showGeslaagd(){unsubAll();APP.role='geslaagd';APP.mode='screen';APP.target=null;APP.fb=null;try{LQ=null}catch(e){}showMode('screen');renderTop();
  const vn=((APP.lid&&APP.lid.naam)||'').trim().split(/\s+/)[0]||'';const op=APP.lid&&APP.lid.geslaagd_op?new Date(APP.lid.geslaagd_op).toLocaleDateString('nl-NL',{day:'numeric',month:'long',year:'numeric'}):'';
  $('#screen').innerHTML='<div class="screen-card" style="max-width:520px"><img src="'+LOGO.b+'" alt=""><div aria-hidden="true" style="width:72px;height:72px;margin:6px auto 4px;border-radius:50%;display:grid;place-items:center;background:var(--ok-soft);color:var(--ok);font-size:38px;font-weight:800">✓</div>'+
    '<h2>Gefeliciteerd'+(vn?', '+esc(vn):'')+'!</h2><p>Je bent geslaagd voor praktijktoets 3 Schipper Open Rondvaartboot'+(op?' ('+esc(op)+')':'')+'. Goed gedaan!</p>'+
    '<p>Je leeromgeving en de casusbouwer zijn nu afgesloten. Je casus kun je hieronder nog downloaden als PDF.</p>'+
    '<div class="row" style="justify-content:center;gap:10px;flex-wrap:wrap"><button type="button" class="btn primary" data-geslaagd="pdf">Casus downloaden (PDF)</button><button type="button" class="btn ghost" data-screen="logout">Uitloggen</button></div>'+
    '<p class="note" style="margin-top:14px">Vragen? Neem contact op met Flagship Academy.</p></div>';
  subscribeGeslaagd();navPush({k:'geslaagd'})}
function subscribeGeslaagd(){const id=APP.lid&&APP.lid.id;if(!id||!APP.sb)return;try{const ch=APP.sb.channel('geslaagd-'+id+'-'+uid())
  .on('postgres_changes',{event:'UPDATE',schema:'public',table:'leden',filter:'id=eq.'+id},p=>{if(p&&p.new&&p.new.status&&p.new.status!=='geslaagd'){APP.lid=Object.assign(APP.lid,p.new);afterLogin()}})
  .on('postgres_changes',{event:'DELETE',schema:'public',table:'leden'},p=>{if(p&&p.old&&p.old.id===id)showBlocked()})
  .subscribe();APP.chans.push(ch)}catch(e){}}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-geslaagd]');if(!b||APP.role!=='geslaagd'||!APP.lid)return;b.disabled=true;
  try{await casusPdf({id:APP.lid.id,naam:APP.lid.naam,stad:APP.lid.stad||'amsterdam'})}finally{b.disabled=false}});
async function afterLogin(){APP.loginTab='in';showScreen('Casusbouwer laden','Even geduld…',null,true);
  const {data,error}=await APP.sb.from('leden').select('*').eq('user_id',APP.user.id).maybeSingle();
  if(error){if(/jwt|token/i.test(error.message||'')){await APP.sb.auth.signOut();return}showScreen('Er ging iets mis','Je gegevens konden niet worden geladen. Controleer je internetverbinding en probeer het opnieuw.',[['Opnieuw proberen','reload'],['Uitloggen','logout']]);return}
  if(!data){showClaim();return}
  APP.lid=data;APP.isStaff=data.rol==='medewerker';APP.isLm=data.rol==='leermeester';const st=data.stad||'amsterdam';
  await loadGebieden();
  if(!APP.isStaff&&!APP.isLm&&(PORTAL||st!==CITY.id)){showScreen('Even geduld','Je gaat naar de casusbouwer voor '+(STAD_NAAM[st]||st)+'…',null,true);location.replace(cityUrl(st));return}
  if(APP.isStaff||APP.isLm){const sp=new URLSearchParams(location.search);if(APP.isStaff&&sp.get('leermodules')){APP.dashView='leeromgeving';APP.gbTab='modules';ME.st=CITY.id;history.replaceState(history.state,'',location.pathname)}openDashboard();const pdfId=sp.get('pdf');if(pdfId&&APP.isStaff||pdfId&&APP.isLm){history.replaceState(history.state,'',location.pathname);setTimeout(()=>casusPdfId(pdfId),300)}const op=sp.get('open');if(op){history.replaceState(history.state,'',location.pathname);openCasus(op,'staff')}}else if(isGeslaagd())showGeslaagd();else if(LEER_LIVE)openLeer(true);else openCasus(data.id,'kandidaat')}
function loginCard(inner){return'<div class="screen-card login"><img src="'+LOGO.b+'" alt="Flagship Academy"><h2>Casusbouwer</h2><p>Praktijktoets 3 SOR · Flagship Academy</p>'+inner+'</div>'}
function showLogin(msg){unsubAll();APP.role='login';APP.target=null;APP.mode='screen';showMode('screen');renderTop();const t=APP.loginTab;
  const tabs='<div class="seg" role="tablist"><button type="button" role="tab" data-ltab="in" aria-selected="'+(t==='in')+'">Inloggen</button><button type="button" role="tab" data-ltab="up" aria-selected="'+(t==='up')+'">Account aanmaken</button></div>';
  const fin='<form id="loginForm" class="lform" novalidate><div class="field"><label for="lEmail">E-mailadres</label><input id="lEmail" type="email" autocomplete="email" required></div><div class="field"><label for="lPw">Wachtwoord</label><input id="lPw" type="password" autocomplete="current-password" required></div><div class="lerr" id="lErr" role="alert"></div><button class="btn primary" type="submit">Inloggen</button><button type="button" class="linkbtn" data-lact="forgot">Wachtwoord vergeten?</button></form>';
  const fup='<form id="signupForm" class="lform" novalidate><p class="note">Je hebt een uitnodigingscode van Flagship Academy nodig.</p><div class="field"><label for="sCode">Uitnodigingscode</label><input id="sCode" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD-EFGH" required></div><div class="field"><label for="sEmail">E-mailadres</label><input id="sEmail" type="email" autocomplete="email" required></div><div class="field"><label for="sPw">Kies een wachtwoord (minstens 8 tekens)</label><input id="sPw" type="password" autocomplete="new-password" minlength="8" required></div><div class="lerr" id="lErr" role="alert"></div><button class="btn primary" type="submit">Account aanmaken</button></form>';
  $('#screen').innerHTML=loginCard(tabs+(t==='in'?fin:fup)+'<p class="note small">Toegang alleen met een uitnodigingscode van Flagship Academy.'+(PRIVACY_LIVE?' <button type="button" class="linkbtn" data-lact="privacy">Privacyverklaring</button>':'')+'</p>');
  if(msg)setLErr(msg)}
function showClaim(msg){unsubAll();APP.role='login';APP.mode='screen';showMode('screen');renderTop();
  $('#screen').innerHTML=loginCard('<form id="claimForm" class="lform" novalidate><p class="note">Je bent ingelogd als <b>'+esc(APP.user&&APP.user.email||'')+'</b>, maar je account is nog niet gekoppeld. Vul de uitnodigingscode in die je van Flagship Academy hebt gekregen.</p><div class="field"><label for="cCode">Uitnodigingscode</label><input id="cCode" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD-EFGH" required></div><div class="lerr" id="lErr" role="alert"></div><button class="btn primary" type="submit">Koppelen</button><button type="button" class="linkbtn" data-lact="logout">Uitloggen</button></form>');
  if(msg)setLErr(msg)}
/* privacyverklaring (AVG) */
const PRIVACY_LIVE=false;
const PV=t=>'<span class="pvfill">['+t+']</span>';
function privacyHtml(){const sec=(h,b)=>'<h3>'+h+'</h3>'+b;
  return'<div class="pvtext"><p class="note">Versie '+PV('datum')+'. In deze verklaring lees je welke gegevens Flagship Academy verwerkt als je de leeromgeving en de casusbouwer gebruikt, waarom, en welke rechten je hebt.</p>'+
  sec('Wie is verantwoordelijk?','<p>Flagship Academy B.V., '+PV('adres')+', KvK '+PV('KvK-nummer')+'. Vragen over je gegevens stel je via '+PV('e-mailadres')+'.</p>')+
  sec('Welke gegevens?','<ul><li><b>Account:</b> je naam, e-mailadres, wachtwoord (versleuteld opgeslagen) en je vaargebied.</li><li><b>Casus:</b> wat je in de casusbouwer invult, zoals geboortedatum, CBR-relatienummer, opstaplocatie, gegevens van het schip, je route, teksten en foto’s die je toevoegt.</li><li><b>Theorie:</b> je antwoorden, scores en voortgang in de leeromgeving.</li><li><b>Feedback:</b> de feedback die je opleider of leermeester op je casus geeft.</li></ul><p>We gebruiken geen advertentie- of volgcookies. Alleen je inlogsessie wordt in je browser bewaard, zodat je ingelogd blijft.</p>')+
  sec('Waarvoor?','<p>Om je op te leiden voor het kwalificatiecertificaat Schipper open rondvaartboot (SOR): je theorie en casus voor praktijktoets 3 voorbereiden, je voortgang volgen en je feedback geven. Je geboortedatum en CBR-relatienummer staan op de casus die je bij het CBR-examen gebruikt.</p><p>We verwerken je gegevens omdat dat nodig is voor de opleiding die je bij ons volgt (uitvoering van de overeenkomst).</p><p>Na het inleveren laten we je casus met hulp van AI (Claude van Anthropic) analyseren, zodat je opleider sneller feedback kan geven. Je naam, geboortedatum, CBR-relatienummer en foto’s gaan daarbij niet mee. Je opleider beoordeelt alle feedback zelf voordat je die te zien krijgt.</p>')+
  sec('Wie kan je gegevens zien?','<ul><li>Medewerkers van Flagship Academy.</li><li>Leermeesters die aan jou of aan jouw vaargebied zijn gekoppeld.</li></ul><p>We verkopen je gegevens niet en delen ze niet met anderen. Je casus geef je zelf af bij het CBR.</p>')+
  sec('Waar staan je gegevens?','<p>De gegevens staan in een beveiligde database van Supabase op servers in de Europese Unie (Ierland). De website wordt gehost door '+PV('hostingpartij')+'. Met deze partijen '+PV('is / wordt')+' een verwerkersovereenkomst gesloten. Feedback-e-mails worden verstuurd via '+PV('maildienst')+'.</p>')+
  sec('Hoe lang?','<p>We bewaren je gegevens zolang je de opleiding volgt en daarna nog '+PV('termijn, bijvoorbeeld 12 maanden')+'. Daarna verwijderen we je account, je casus, je foto’s en je feedback.</p>')+
  sec('Beveiliging','<p>De verbinding is versleuteld (https), je wachtwoord wordt versleuteld opgeslagen en iedereen ziet alleen de gegevens die bij zijn rol horen. Een account aanmaken kan alleen met een persoonlijke uitnodigingscode.</p>')+
  sec('Jouw rechten','<p>Je mag je gegevens inzien, laten verbeteren of laten verwijderen. Je kunt ook bezwaar maken, de verwerking laten beperken of je gegevens opvragen om mee te nemen. Stuur daarvoor een e-mail naar '+PV('e-mailadres')+'. We reageren binnen een maand. Ben je niet tevreden, dan kun je een klacht indienen bij de Autoriteit Persoonsgegevens.</p>')+'</div>'}
async function showPrivacy(){await modalBox('Privacyverklaring','',privacyHtml(),'Sluiten',null)}
document.addEventListener('click',e=>{if(e.target.closest('[data-lact="privacy"]'))showPrivacy()});
function setLErr(t,info){const el=$('#lErr');if(!el)return;el.textContent=t||'';el.classList.toggle('info',!!info)}
function busyForm(f,on){if(!f)return;$$('button,input',f).forEach(x=>x.disabled=on);const b=$('button[type=submit]',f);if(b){if(on){b.dataset.t=b.textContent;b.textContent='Even geduld…'}else if(b.dataset.t)b.textContent=b.dataset.t}}
async function doLogin(f){const email=$('#lEmail').value.trim(),pw=$('#lPw').value;if(!email||!pw){setLErr('Vul je e-mailadres en wachtwoord in.');return}setLErr('');busyForm(f,true);
  const {data,error}=await APP.sb.auth.signInWithPassword({email,password:pw});busyForm(f,false);
  if(error){const m=error.message||'';setLErr(/invalid/i.test(m)?'E-mailadres of wachtwoord klopt niet.':/confirm/i.test(m)?'Je e-mailadres is nog niet bevestigd. Neem contact op met Flagship Academy.':/fetch|network/i.test(m)?'Geen verbinding. Controleer je internet en probeer het opnieuw.':'Inloggen lukt niet: '+m);return}
  APP.user=data.user;APP.uid=data.user.id;await afterLogin()}
async function doSignup(f){const code=$('#sCode').value,email=$('#sEmail').value.trim(),pw=$('#sPw').value;
  if(normCode(code).length!==8){setLErr('Vul de uitnodigingscode van 8 tekens in.');return}if(!/^\S+@\S+\.\S+$/.test(email)){setLErr('Vul een geldig e-mailadres in.');return}if(pw.length<8){setLErr('Kies een wachtwoord van minstens 8 tekens.');return}
  setLErr('');busyForm(f,true);const {data,error}=await APP.sb.auth.signUp({email,password:pw});
  if(error){busyForm(f,false);const m=error.message||'';setLErr(/registered|exists/i.test(m)?'Er bestaat al een account met dit e-mailadres. Kies Inloggen.':/password/i.test(m)?'Dit wachtwoord is niet sterk genoeg. Kies een langer wachtwoord.':/rate|limit/i.test(m)?'Te veel pogingen. Probeer het over een paar minuten opnieuw.':'Account aanmaken lukt niet: '+m);return}
  if(!data.session){busyForm(f,false);setLErr('Je account is aangemaakt, maar inloggen kan nog niet omdat e-mailbevestiging aanstaat. Neem contact op met Flagship Academy.');return}
  APP.user=data.user;APP.uid=data.user.id;const r=await claim(code);busyForm(f,false);if(r)afterLogin();else if(APP.mode==='screen'&&!$('#claimForm')){const m=$('#lErr').textContent;showClaim(m)}}
async function doClaim(f){const code=$('#cCode').value;if(normCode(code).length!==8){setLErr('Vul de uitnodigingscode van 8 tekens in.');return}setLErr('');busyForm(f,true);const r=await claim(code);busyForm(f,false);if(r)afterLogin()}
async function claim(code){const {data,error}=await APP.sb.rpc('code_koppelen',{p_code:code});if(error){setLErr(error.message||'Koppelen is mislukt.');return null}if(!data||!data.id){setLErr('Deze code klopt niet of is al gebruikt. Controleer de code of vraag een nieuwe aan je opleider.');return null}return data}
async function logout(){try{await flushNow()}catch(e){}unsubAll();APP.lid=null;APP.isStaff=false;APP.isLm=false;APP.loginTab='in';try{await APP.sb.auth.signOut()}catch(e){}showLogin()}
$('#screen').addEventListener('click',e=>{const tb=e.target.closest('[data-ltab]');if(tb){APP.loginTab=tb.dataset.ltab;showLogin();return}const l=e.target.closest('[data-lact]');if(l){const a=l.dataset.lact;if(a==='forgot')setLErr('Vraag je opleider om een nieuwe uitnodigingscode. Maak daarna met die code opnieuw een account aan; je casus blijft gewoon bewaard.',true);else if(a==='logout')logout();return}
  const b=e.target.closest('[data-screen]');if(!b)return;const s=b.dataset.screen;if(s==='reload')location.reload();else if(s==='logout')logout();else if(s==='login')showLogin()});
$('#screen').addEventListener('submit',e=>{e.preventDefault();const f=e.target;if(f.id==='loginForm')doLogin(f);else if(f.id==='signupForm')doSignup(f);else if(f.id==='claimForm')doClaim(f)});

function startLocal(){unsubAll();APP.role='local';APP.target=null;let s=null;try{const raw=localStorage.getItem(LS_KEY);s=raw?loadCasus(JSON.parse(raw)):null;if(s){const r=JSON.parse(raw);s.isVoorbeeld=!!r.isVoorbeeld;s.ui={step:(r.ui&&r.ui.step)||'kandidaat'}}}catch(e){s=null}
  state=s||exampleState();enterEditor()}
function unsubAll(){if(APP.sb)APP.chans.forEach(c=>{try{APP.sb.removeChannel(c)}catch(e){}});APP.chans=[]}

/* casus */
function applyLid(r){APP.meta.status=r.status==='uitgenodigd'?'bezig':r.status;APP.meta.ingeleverdOp=r.ingeleverd_op;APP.meta.geslaagdOp=r.geslaagd_op;APP.targetNaam=r.naam;APP.targetEmail=r.email||'';APP.targetStad=r.stad||'amsterdam'}
async function openCasus(id,role){if(role==='kandidaat'&&isGeslaagd()){showGeslaagd();return}unsubAll();await flushNow();APP.role=role;APP.target=id;APP.exists=false;APP.dirty.clear();APP.fb=null;APP.meta={};APP.fbDirty=false;APP.lastRev=null;APP.ai=null;clearTimeout(APP.aiT);
  showScreen('Casus laden','Even geduld…',null,true);
  const [c,f,l]=await Promise.all([APP.sb.from('casussen').select('*').eq('kandidaat_id',id).maybeSingle(),APP.sb.from('feedback').select('*').eq('kandidaat_id',id).maybeSingle(),APP.sb.from('leden').select('*').eq('id',id).maybeSingle()]);
  if(APP.target!==id)return;
  if(c.error||l.error||f.error){showScreen('Casus niet geladen','De casus kon niet worden geladen. Controleer je internetverbinding en probeer het opnieuw.',[['Opnieuw proberen','reload']]);return}
  if(!l.data){showBlocked();return}
  if(role==='staff'&&(PORTAL||(l.data.stad||'amsterdam')!==CITY.id)){showScreen('Even geduld','Deze casus hoort bij '+(STAD_NAAM[l.data.stad]||l.data.stad)+'. Je wordt doorgestuurd…',null,true);location.href=cityUrl(l.data.stad)+'?open='+encodeURIComponent(id);return}
  applyLid(l.data);
  if(c.data){state=loadCasus(c.data.casus);APP.exists=true;APP.lastRev=c.data.rev;Object.assign(APP.meta,{voortgang:c.data.voortgang,bijgewerkt:c.data.bijgewerkt,rev:c.data.rev})}
  else{state=emptyState();if(role==='kandidaat'&&l.data.naam)state.kandidaat.naam=l.data.naam}
  APP.fb=f.data?{stappen:f.data.stappen||{}}:null;APP.fbMailOp=(f.data&&f.data.gemaild_op)||null;
  state.ui={step:'kandidaat'};enterEditor();subscribeCasus(id);navPush({k:'step',step:'kandidaat',id,role});
  if(role==='staff')aiLoad(id).then(()=>{if(APP.target!==id)return;if(APP.mode==='edit'&&!panel.contains(document.activeElement))renderPanel();aiAuto(id)})}
function subscribeCasus(id){try{const ch=APP.sb.channel('casus-'+id+'-'+uid())
  .on('postgres_changes',{event:'*',schema:'public',table:'casussen',filter:'kandidaat_id=eq.'+id},p=>{const n=p&&p.new;if(n&&n.rev&&n.rev===APP.lastRev)return;refreshCasus()})
  .on('postgres_changes',{event:'*',schema:'public',table:'feedback',filter:'kandidaat_id=eq.'+id},()=>refreshFb())
  .on('postgres_changes',{event:'*',schema:'public',table:'ai_concept',filter:'kandidaat_id=eq.'+id},()=>{if(APP.role==='staff')aiLoad(id).then(()=>{if(APP.mode==='edit'&&!panel.contains(document.activeElement))renderPanel()})})
  .on('postgres_changes',{event:'UPDATE',schema:'public',table:'leden',filter:'id=eq.'+id},p=>{if(p&&p.new&&APP.target===id&&APP.role==='kandidaat'&&p.new.status==='geslaagd'){if(APP.lid)APP.lid.status='geslaagd';showGeslaagd();return}if(p&&p.new&&APP.target===id){applyLid(p.new);renderTop();if(state.ui.step==='controle')renderPanel()}})
  .on('postgres_changes',{event:'DELETE',schema:'public',table:'leden'},p=>{if(p&&p.old&&p.old.id===id&&APP.target===id){if(APP.role==='kandidaat')showBlocked();else{toast('Deze kandidaat is verwijderd');openDashboard()}}})
  .subscribe();APP.chans.push(ch)}catch(e){}}
let rcT=null;
function refreshCasus(){clearTimeout(rcT);rcT=setTimeout(async()=>{if(!APP.target||APP.mode!=='edit'||!['kandidaat','staff'].includes(APP.role))return;const id=APP.target;
  const {data,error}=await APP.sb.from('casussen').select('*').eq('kandidaat_id',id).maybeSingle();if(error||!data||APP.target!==id)return;
  APP.exists=true;Object.assign(APP.meta,{voortgang:data.voortgang,bijgewerkt:data.bijgewerkt});if(data.rev===APP.lastRev)return;APP.lastRev=data.rev;
  const changedKeys=[];CASUS_KEYS.forEach(k=>{if(APP.dirty.has(k))return;const nv=data.casus?data.casus[k]:undefined;if(nv===undefined)return;if(stableStr(nv)!==stableStr(state[k])){state[k]=clone(nv);changedKeys.push(k)}});
  if(changedKeys.length){state=migrate(state);computeRoute();const typing=panel.contains(document.activeElement)&&/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);changed({route:true,items:true,panel:!typing});toast(data.bijgewerkt_door&&data.bijgewerkt_door!==APP.uid?(APP.role==='kandidaat'?'Je opleider heeft je casus bijgewerkt':'De kandidaat heeft de casus bijgewerkt'):'Casus bijgewerkt')}},250)}
async function refreshFb(){if(APP.fbDirty||!APP.target)return;const id=APP.target;const {data,error}=await APP.sb.from('feedback').select('*').eq('kandidaat_id',id).maybeSingle();if(error||APP.target!==id||APP.fbDirty)return;APP.fb=data?{stappen:data.stappen||{}}:null;APP.fbMailOp=(data&&data.gemaild_op)||null;if(APP.mode==='edit'){renderRail();if(APP.role!=='staff'||!panel.contains(document.activeElement))renderPanel()}}
async function refreshLid(){if(!APP.target)return;const id=APP.target;const {data}=await APP.sb.from('leden').select('*').eq('id',id).maybeSingle();if(APP.target!==id)return;if(!data){if(APP.role==='kandidaat')showBlocked();return}applyLid(data);renderTop();if(state.ui.step==='controle')renderPanel()}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible'||!APP.sb)return;if(APP.mode==='edit'&&APP.target){refreshCasus();refreshFb();refreshLid()}else if(APP.mode==='dash')loadRoster();else if(APP.mode==='leer')refreshLeer()});
async function flushNow(){clearTimeout(APP.t);if(APP.dirty.size&&APP.target){await flush()}clearTimeout(APP.fbT);if(APP.fbDirty)await writeFb()}
function showBlocked(){unsubAll();APP.target=null;showScreen('Geen toegang','Je account is niet (meer) gekoppeld aan een casus. Heb je je examen gehaald, dan is je casus afgesloten. Klopt dit niet? Neem contact op met Flagship Academy.',[['Uitloggen','logout']])}
function showScreen(title,text,actions,spinner){APP.mode='screen';showMode('screen');renderTop();$('#screen').innerHTML='<div class="screen-card"><img src="'+LOGO.b+'" alt=""><h2>'+esc(title)+'</h2><p>'+esc(text)+'</p>'+(spinner?'<div class="spin" aria-hidden="true"></div>':'')+(actions?'<div class="row" style="justify-content:center">'+actions.map(a=>'<button type="button" class="btn primary" data-screen="'+a[1]+'">'+esc(a[0])+'</button>').join('')+'</div>':'')+'</div>'}
function showMode(m){const app=$('#app');if(m!=='edit'){setSaveState('');renderBanner()}app.classList.toggle('m-dash',m==='dash'||m==='leer');$('#leer').hidden=m!=='leer';app.classList.toggle('m-screen',m==='screen');$('#dash').hidden=m!=='dash';$('#screen').hidden=m!=='screen';if(m==='edit')setTimeout(()=>map.invalidateSize(),60)}
function enterEditor(){APP.mode='edit';showMode('edit');HIST.length=0;computeRoute();CHECKS=checks();renderTop();renderBanner();renderRail();renderPanel();renderProgress();drawAll();fitRoute();setSaveState(APP.role==='local'?'':APP.role==='voorbeeld'?'Voorbeeld: wijzigingen worden niet opgeslagen':(APP.exists?'Opgeslagen':'Wordt automatisch opgeslagen'))}

/* feedback & status */
const fbStep=id=>(APP.fb&&APP.fb.stappen&&APP.fb.stappen[id])||null;
function setFb(step,patch){const fb=APP.fb?clone(APP.fb):{stappen:{}};fb.stappen=fb.stappen||{};fb.stappen[step]=Object.assign({},fb.stappen[step]||{},patch,{door:APP.uid,op:nowIso()});APP.fb=fb;APP.fbDirty=true;clearTimeout(APP.fbT);APP.fbT=setTimeout(writeFb,800);setSaveState('Feedback opslaan…')}
async function writeFb(){if(!APP.sb||!APP.target)return;if(APP.fbSaving){APP.fbT=setTimeout(writeFb,400);return}APP.fbSaving=true;const snap=clone(APP.fb)||{stappen:{}};APP.fbDirty=false;
  try{const {error}=await APP.sb.from('feedback').upsert({kandidaat_id:APP.target,stappen:snap.stappen||{},bijgewerkt:nowIso(),bijgewerkt_door:APP.uid});if(error)throw error;setSaveState('Feedback opgeslagen')}
  catch(e){APP.fbDirty=true;dbError(e,'feedback')}finally{APP.fbSaving=false}}
async function setStatus(id,status){try{let error;
  if(!APP.isStaff&&status==='ingeleverd'){await flushNow();({error}=await APP.sb.rpc('lever_in'))}
  else{const patch={status};if(status==='ingeleverd')patch.ingeleverd_op=nowIso();if(status==='geslaagd')patch.geslaagd_op=nowIso();({error}=await APP.sb.from('leden').update(patch).eq('id',id))}
  if(error)throw error;
  if(status==='ingeleverd')aiStart(APP.isStaff?id:(APP.target||(APP.lid&&APP.lid.id)),APP.isStaff?'handmatig':'inleveren',true);
  if(id===APP.target){APP.meta.status=status;if(APP.lid&&APP.lid.id===id)APP.lid.status=status;if(status==='ingeleverd')APP.meta.ingeleverdOp=nowIso();if(status==='geslaagd')APP.meta.geslaagdOp=nowIso();renderTop();renderBanner();if(state.ui.step==='controle')renderPanel()}
  if(APP.mode==='dash')loadRoster();
  toast(status==='ingeleverd'?'Casus ingeleverd bij Flagship Academy':status==='geslaagd'?'Gemarkeerd als geslaagd. De kandidaat ziet nu alleen nog het felicitatiescherm.':'Status bijgewerkt')}catch(e){dbError(e,'status')}}

/* feedback per e-mail naar de kandidaat (Edge Function feedback-mail; anders via het eigen mailprogramma) */
function fbMailRow(){if(!APP.targetEmail)return'<span class="note">Versturen kan zodra de kandidaat een account heeft.</span>';return'<button type="button" class="btn sm" data-top-mail>Feedback naar kandidaat sturen</button>'+(APP.fbMailOp?'<span class="note">Laatst verstuurd '+esc(fmtDate(APP.fbMailOp))+'</span>':'')}
function fbMailText(){const st=(APP.fb&&APP.fb.stappen)||{};const items=STEPS.filter(x=>x.id!=='controle'&&st[x.id]&&((st[x.id].tekst||'').trim()||st[x.id].status)).map(x=>{const f=st[x.id];return'- '+x.t+(f.status==='aanpassen'?' (aanpassen)':f.status==='ok'?' (akkoord)':'')+((f.tekst||'').trim()?': '+f.tekst.trim():'')});
  const alg=((st.algemeen&&st.algemeen.tekst)||'').trim();const voornaam=(APP.targetNaam||'').trim().split(/\s+/)[0]||'';
  const body='Hoi '+voornaam+',\n\nIk heb feedback gegeven op je casus voor praktijktoets 3.\n\n'+(alg?'Algemene feedback:\n'+alg+'\n\n':'')+(items.length?'Feedback per stap:\n'+items.join('\n')+'\n\n':'')+'Je ziet de feedback ook bij de stappen in de casusbouwer:\n'+cityUrl(APP.targetStad)+'\n\nGroet,\n'+((APP.lid&&APP.lid.naam)||'Flagship Academy');
  return{body,n:items.length+(alg?1:0),subject:'Feedback op je casus praktijktoets 3'}}
function openMailto(to,m){const a=document.createElement('a');a.href='mailto:'+encodeURIComponent(to)+'?subject='+encodeURIComponent(m.subject)+'&body='+encodeURIComponent(m.body);document.body.appendChild(a);a.click();a.remove()}
async function mailFeedback(){try{await flushNow()}catch(e){}const to=APP.targetEmail;if(!to){toast('Van deze kandidaat is nog geen e-mailadres bekend. De kandidaat moet eerst een account aanmaken.',true);return}
  const m=fbMailText();if(!m.n){toast('Er is nog geen feedback om te versturen.',true);return}
  const y=await modalBox('Feedback naar '+(APP.targetNaam||'de kandidaat')+' sturen','','<p class="note">De kandidaat krijgt deze e-mail op <b>'+esc(to)+'</b>. Een antwoord van de kandidaat komt bij jou binnen.</p><pre class="mailprev">'+esc(m.body)+'</pre>','Versturen','Annuleren');if(!y)return;
  setSaveState('E-mail versturen…');let why='';
  try{const {data,error}=await APP.sb.functions.invoke('feedback-mail',{body:{kandidaat_id:APP.target,onderwerp:m.subject,tekst:m.body}});
    if(!error&&data&&data.ok){APP.fbMailOp=data.op||nowIso();setSaveState('E-mail verstuurd');toast('Feedback verstuurd naar '+to);if(APP.mode==='edit')renderPanel();return}
    if(error&&error.context&&typeof error.context.json==='function'){try{const j=await error.context.json();why=j&&j.error||''}catch(_){}}else if(data&&data.error)why=data.error}
  catch(e){why=''}
  setSaveState('E-mail niet verstuurd');
  const y2=await modalBox('Automatisch versturen lukt nu niet',why==='niet_ingesteld'?'Het automatisch versturen van e-mail is nog niet ingesteld. Wil je de e-mail openen in je eigen mailprogramma?':'De e-mail kon niet automatisch worden verstuurd'+(why&&why!=='niet_ingesteld'?' ('+why+')':'')+'. Wil je hem openen in je eigen mailprogramma?','','Mailprogramma openen','Annuleren');
  if(y2)openMailto(to,m)}
document.addEventListener('click',e=>{if(e.target.closest('[data-top-mail]'))mailFeedback()});
async function goHome(){if(APP.role==='login'||!APP.sb)return;try{await flushNow()}catch(e){}
  if(APP.lid&&(APP.isStaff||APP.isLm)){openDashboard();return}
  if(APP.lid&&!APP.isStaff&&!APP.isLm){if(LEER_LIVE)openLeer(false);else if(APP.mode==='edit'&&APP.role==='kandidaat')setStep('kandidaat');else afterLogin();return}
  if(APP.user)afterLogin();else showLogin()}
document.getElementById('homeLink').addEventListener('click',e=>{e.preventDefault();goHome()});

/* terugknop van de browser: stappen, overzicht en leeromgeving in de geschiedenis */
const NAV={busy:false};
function navPush(st){if(NAV.busy)return;const cur=history.state;try{if(cur&&JSON.stringify(cur)===JSON.stringify(st))return;if(!cur||!cur.k)history.replaceState(st,'');else history.pushState(st,'')}catch(e){}}
window.addEventListener('popstate',async e=>{const st=e.state;if(!st||!st.k)return;NAV.busy=true;try{
  if(st.k==='step'){if(APP.mode==='edit'&&(st.id||null)===(APP.target||null)&&(st.role===APP.role||APP.role==='local')){setStep(st.step);return}
    if(st.role==='voorbeeld'&&APP.isStaff){unsubAll();APP.role='voorbeeld';APP.target=null;APP.fb=null;state=exampleState();enterEditor();setStep(st.step);return}
    if(st.id&&APP.sb){try{await flushNow()}catch(_){}await openCasus(st.id,st.role);if(APP.target===st.id)setStep(st.step)}return}
  if(st.k==='dash'&&APP.sb&&(APP.isStaff||APP.isLm)){try{await flushNow()}catch(_){}APP.dashView=st.v||'';openDashboard();return}
  if(st.k==='leer'&&APP.lid){if(APP.mode!=='leer'){if(APP.isStaff||APP.isLm)openLeerPreview();else await openLeer(false)}LQ=null;LV.v=['les','extra','home','start','voortgang','mod','tr'].includes(st.v)?st.v:'start';LV.u=st.u==null?null:st.u;APP.trQ=null;if(st.v==='mod'){MV.v='les';MV.q=null}if(st.v==='extra'){GXV.v=st.gx||'home';GXV.i=st.i||0;GXV.q=null}LV.id=st.id||null;renderLeer();leerScroll()}
}finally{NAV.busy=false}});

