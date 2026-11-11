/* ---------- instellingen (alleen medewerkers): privacyverklaring, AI, opslag en back-up ----------
   Alles op deze pagina staat in de tabel instellingen (database-update 022). Zo kan een medewerker
   de privacyverklaring publiceren en AI-conceptfeedback aan- of uitzetten zonder de code aan te passen. */
APP.inst={privacy:{},ai:{},opslag:{}};APP.instDb=null;APP.instX={};
const PV_VELDEN=[['datum','Versiedatum','date',''],['adres','Adres van Flagship Academy','text','Straat 1, 1000 AA Amsterdam'],['kvk','KvK-nummer','text','12345678'],['email','E-mailadres voor vragen over gegevens','email','privacy@voorbeeld.nl'],['hosting','Hostingpartij van de website','text','bijvoorbeeld GitHub of Flagship'],['maildienst','Maildienst voor feedback-mails','text','bijvoorbeeld Microsoft 365'],['termijn','Bewaartermijn na de opleiding','text','bijvoorbeeld 12 maanden']];
const pvCompleet=()=>PV_VELDEN.every(v=>String((APP.inst.privacy||{})[v[0]]||'').trim());
function privacyLive(){return!!(APP.instDb&&APP.inst.privacy&&APP.inst.privacy.gepubliceerd&&pvCompleet())}
function aiAan(){return!!(APP.instDb&&APP.inst.ai&&APP.inst.ai.aan)}
const PV_KNOP='<button type="button" class="linkbtn" data-lact="privacy">Privacyverklaring</button>';
function pvLinkZet(){$$('.pvslot').forEach(el=>{el.innerHTML=privacyLive()?' '+PV_KNOP:''})}
async function instLoad(){if(!APP.sb)return;const {data,error}=await APP.sb.from('instellingen').select('sleutel,waarde');
  if(error){if(dbOntbreekt(error))APP.instDb=false;return}
  APP.instDb=true;const o={privacy:{},ai:{},opslag:{}};(data||[]).forEach(r=>{if(o[r.sleutel])o[r.sleutel]=r.waarde||{}});APP.inst=o;pvLinkZet()}
async function instSave(sleutel,waarde){const {error}=await APP.sb.from('instellingen').upsert({sleutel,waarde,bijgewerkt:new Date().toISOString(),bijgewerkt_door:APP.uid});
  if(error){toast('Opslaan is mislukt: '+(error.message||''),true);return false}APP.inst[sleutel]=waarde;return true}
const fmtMB=b=>{b=+b||0;return b>=1048576?(b/1048576).toFixed(b>=10485760?0:1).replace('.',',')+' MB':Math.max(b?1:0,Math.round(b/1024))+' kB'};
const OPSLAG_GRENS=500*1048576;/* gratis Supabase-plan: 500 MB database */

/* extra gegevens voor de pagina: opslagoverzicht, AI-gebruik, AI-status en voorbeeldcasussen */
async function instExtraLoad(){const mnd=Math.max(1,Math.min(120,parseInt((APP.inst.opslag||{}).maanden,10)||6));const m=new Date();const maand=m.getFullYear()+'-'+String(m.getMonth()+1).padStart(2,'0')+'-01';
  const [op,ge,vb,st]=await Promise.all([APP.sb.rpc('opslag_overzicht',{p_maanden:mnd}),APP.sb.from('ai_gebruik').select('aantal').eq('maand',maand).maybeSingle(),APP.sb.from('ai_voorbeeld').select('kandidaat_id'),
    APP.sb.functions.invoke('ai-feedback',{body:{status:true}}).then(r=>r,()=>({error:true}))]);
  APP.instX={opslag:op&&!op.error?op.data:null,gebruik:ge&&!ge.error?((ge.data||{}).aantal||0):null,voorbeelden:vb&&!vb.error?(vb.data||[]).map(x=>x.kandidaat_id):null,
    ai:st&&!st.error&&st.data&&typeof st.data.sleutel==='boolean'?st.data:null,geladen:true};
  if(APP.mode==='dash'&&APP.dashView==='instellingen')renderInstellingen()}

function renderInstellingen(){const el=$('#dash');const p=APP.inst.privacy||{},ai=APP.inst.ai||{},os=APP.inst.opslag||{},x=APP.instX||{};
  let h='<div class="dash-in inst"><div><div class="eyebrow">Medewerkers</div><h1 class="pagetitle">Instellingen</h1></div>';
  if(APP.instDb===false){el.innerHTML=h+'<section class="lsec"><h2>Database-update nodig</h2><p>Deze pagina werkt pas als database-update 022 is uitgevoerd in Supabase (SQL Editor). Tot die tijd blijven de privacyverklaring en AI-conceptfeedback uit.</p></section></div>';return}
  if(APP.instDb==null){el.innerHTML=h+'<p class="note">Instellingen laden…</p></div>';instLoad().then(()=>{if(APP.mode==='dash'&&APP.dashView==='instellingen'&&APP.instDb!=null)renderInstellingen()});return}
  if(!x.geladen&&!APP.instBezig){APP.instBezig=true;instExtraLoad().finally(()=>{APP.instBezig=false})}
  /* privacyverklaring */
  const compl=pvCompleet(),live=privacyLive();const mist=PV_VELDEN.filter(v=>!String(p[v[0]]||'').trim()).map(v=>v[1]);
  h+='<section class="lsec" id="instPrivacy"><div class="lsec-h"><h2>Privacyverklaring</h2>'+(live?'<span class="pill ok">Zichtbaar voor kandidaten</span>':compl?'<span class="pill warn">Ingevuld, nog niet zichtbaar</span>':'<span class="pill unk">Nog niet compleet</span>')+'</div>'+
    '<p class="note">De tekst staat klaar. Vul hier de laatste gegevens in. Daarna kun je de verklaring zichtbaar maken; kandidaten zien dan een link op de inlogpagina.</p><form id="instPvForm" class="instgrid">'+
    PV_VELDEN.map(v=>'<div class="field"><label for="pv_'+v[0]+'">'+v[1]+'</label><input id="pv_'+v[0]+'" name="'+v[0]+'" type="'+v[2]+'" value="'+esc(p[v[0]]||'')+'" placeholder="'+esc(v[3])+'" maxlength="200"></div>').join('')+
    '<div class="field"><label for="pv_verwerker">Verwerkersovereenkomst met hosting en database</label><select id="pv_verwerker" name="verwerker"><option value="is"'+(p.verwerker!=='wordt'?' selected':'')+'>Is gesloten</option><option value="wordt"'+(p.verwerker==='wordt'?' selected':'')+'>Wordt nog gesloten</option></select></div>'+
    '<label class="instcheck"><input type="checkbox" name="gepubliceerd"'+(p.gepubliceerd?' checked':'')+'> <span>Zichtbaar maken voor kandidaten<small>Kan pas als alle velden zijn ingevuld.</small></span></label>'+
    '<div class="row instrow"><button type="submit" class="btn primary">Opslaan</button><button type="button" class="btn" data-inst="pv-voorbeeld">Voorbeeld bekijken</button></div></form>'+
    (mist.length?'<p class="note">Nog invullen: '+esc(mist.join(', '))+'.</p>':'')+'</section>';
  /* AI */
  const sleutel=x.ai?x.ai.sleutel:null;const lim=Math.max(0,parseInt(ai.maandlimiet,10)||100);
  h+='<section class="lsec" id="instAi"><div class="lsec-h"><h2>AI-conceptfeedback</h2>'+(ai.aan?(sleutel===false?'<span class="pill warn">Aan, maar de sleutel ontbreekt</span>':'<span class="pill ok">Aan</span>'):'<span class="pill unk">Uit</span>')+'</div>'+
    '<p class="note">Na het inleveren maakt de AI per stap een concept voor de feedback. Alleen medewerkers en leermeesters zien dat concept; de kandidaat ziet pas iets als jij het overneemt. Er worden alleen kosten gemaakt als dit aan staat én de API-sleutel in Supabase is ingesteld.</p>'+
    '<ul class="instlist"><li><b>API-sleutel in Supabase:</b> '+(sleutel===true?'<span class="pill ok">Ingesteld</span>':sleutel===false?'<span class="pill unk">Nog niet ingesteld</span> <span class="note">Zolang de sleutel ontbreekt, wordt er niets verstuurd en kost het niets.</span>':x.geladen?'<span class="pill unk">Onbekend</span>':'laden…')+'</li>'+
    '<li><b>Gebruik deze maand:</b> '+(x.gebruik==null?(x.geladen?'onbekend':'laden…'):x.gebruik+' van '+lim+' analyses')+'</li>'+
    '<li><b>Voorbeeldcasussen:</b> de modelcasus van Flagship Academy'+(x.voorbeelden&&x.voorbeelden.length?' en '+x.voorbeelden.length+' aangewezen casus'+(x.voorbeelden.length===1?'':'sen')+' ('+esc(x.voorbeelden.map(id=>{const r=APP.roster.find(q=>q.id===id);return r?r.naam:'onbekend'}).join(', '))+')':'')+'. <span class="note">Aanwijzen doe je bij Kandidaten via ⋯ → Als voorbeeldcasus voor de AI gebruiken. Dat kan als AI aan staat.</span></li></ul>'+
    '<form id="instAiForm" class="instgrid"><label class="instcheck"><input type="checkbox" name="aan"'+(ai.aan?' checked':'')+'> <span>AI-conceptfeedback aanzetten<small>Zet dit pas aan als de kosten zijn goedgekeurd.</small></span></label>'+
    '<div class="field"><label for="ai_lim">Maximaal aantal analyses per maand</label><input id="ai_lim" name="maandlimiet" type="number" min="0" max="100000" step="1" value="'+lim+'"></div>'+
    '<div class="row instrow"><button type="submit" class="btn primary">Opslaan</button></div></form></section>';
  /* opslag */
  const o=x.opslag;const mnd=Math.max(1,Math.min(120,parseInt(os.maanden,10)||6));
  h+='<section class="lsec" id="instOpslag"><div class="lsec-h"><h2>Opslag</h2></div>';
  if(!o)h+='<p class="note">'+(x.geladen?'Het opslagoverzicht kon niet worden geladen.':'Opslag laden…')+'</p>';
  else{const pct=Math.min(100,Math.round(o.database/OPSLAG_GRENS*100));
    h+='<div class="instmeter" role="img" aria-label="'+pct+' procent van de database in gebruik"><span style="width:'+Math.max(2,pct)+'%"'+(pct>=80?' class="vol"':'')+'></span></div>'+
      '<p><b>'+fmtMB(o.database)+'</b> van 500 MB in gebruik ('+pct+'%). Dat is de grens van het gratis Supabase-plan.</p>'+
      '<ul class="instlist"><li>Foto’s in casussen: '+o.fotos_aantal+' ('+fmtMB(o.fotos)+')</li><li>CBR-bevestigingen: '+o.cbr_aantal+' ('+fmtMB(o.cbr)+')</li><li>Kandidaten: '+o.kandidaten+', waarvan '+o.geslaagd+' geslaagd</li></ul>'+
      '<form id="instOpslagForm" class="instgrid"><div class="field"><label for="os_mnd">Opruimen: aantal maanden na het slagen</label><input id="os_mnd" name="maanden" type="number" min="1" max="120" step="1" value="'+mnd+'"></div>'+
      '<div class="row instrow"><button type="submit" class="btn">Termijn opslaan</button><button type="button" class="btn danger" data-inst="opruimen"'+(o.weg_fotos+o.weg_cbr?'':' disabled')+'>Nu opruimen</button></div></form>'+
      '<p class="note">'+(o.weg_fotos+o.weg_cbr?'Nu op te ruimen: '+o.weg_fotos+' foto’s en '+o.weg_cbr+' CBR-bevestiging'+(o.weg_cbr===1?'':'en')+' van '+o.weg_kandidaten+' kandida'+(o.weg_kandidaten===1?'at':'ten')+' ('+fmtMB(o.weg_bytes)+').':'Er valt nu niets op te ruimen.')+' Opruimen wist alleen foto’s en CBR-bevestigingen van kandidaten die langer dan '+mnd+' maanden geleden zijn geslaagd. De casus zelf, de feedback en het account blijven staan.</p>'}
  h+='</section>';
  /* back-up */
  h+='<section class="lsec" id="instBackup"><div class="lsec-h"><h2>Back-up</h2></div><p class="note">Download alle gegevens uit de database als één bestand: kandidaten, casussen, foto’s, feedback, theorie, groepen en instellingen. Bewaar het bestand op een veilige plek; er staan persoonsgegevens in. Wachtwoorden zitten er niet in.</p>'+
    '<div class="row instrow"><button type="button" class="btn primary" data-inst="backup">Back-up downloaden</button><span class="note" id="instBackupStatus" role="status"></span></div></section>';
  el.innerHTML=h+'</div>'}

const BACKUP_TABELLEN=[['leden',['id'],500],['casussen',['kandidaat_id'],100],['feedback',['kandidaat_id'],200],['fotos',['id'],20],['theorie',['kandidaat_id'],200],['cbr_bevestiging',['kandidaat_id'],5],['groepen',['id'],500],['gebieden',['slug'],100],['leermodules',['id'],100],['leer_sjablonen',['id'],100],['leermeester_toegang',['leermeester_id','kandidaat_id'],500],['leermeester_gebied',['leermeester_id','stad'],500],['leermeester_groep',['leermeester_id','groep_id'],500],['instellingen',['sleutel'],100],['ai_voorbeeld',['kandidaat_id'],500],['ai_concept',['kandidaat_id'],100]];
async function backupDownload(knop){const st=$('#instBackupStatus');const zeg=t=>{if(st)st.textContent=t};knop.disabled=true;const uit={soort:'flagship-academy-backup',versie:1,gemaakt:new Date().toISOString(),tabellen:{},overgeslagen:[]};let rijen=0;
  try{for(const [tabel,sleutels,stap] of BACKUP_TABELLEN){zeg('Bezig met '+tabel+'…');const alle=[];let van=0;
      for(;;){let q=APP.sb.from(tabel).select('*');sleutels.forEach(k=>{q=q.order(k)});const {data,error}=await q.range(van,van+stap-1);
        if(error){if(dbOntbreekt(error)){uit.overgeslagen.push(tabel);break}throw new Error(tabel+': '+(error.message||'fout'))}
        alle.push(...(data||[]));if(!data||data.length<stap)break;van+=stap}
      if(!uit.overgeslagen.includes(tabel)){uit.tabellen[tabel]=alle;rijen+=alle.length}}
    const blob=new Blob([JSON.stringify(uit)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='flagship-academy-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
    zeg('Klaar: '+rijen+' rijen, '+fmtMB(blob.size)+'.');toast('Back-up gedownload')}
  catch(e){zeg('');toast('De back-up is mislukt: '+(e&&e.message||e),true)}finally{knop.disabled=false}}

$('#dash').addEventListener('submit',async e=>{if(APP.dashView!=='instellingen'||!APP.isStaff)return;const f=e.target;if(!['instPvForm','instAiForm','instOpslagForm'].includes(f.id))return;e.preventDefault();const fd=new FormData(f);const knop=f.querySelector('button[type=submit]');if(knop)knop.disabled=true;
  if(f.id==='instPvForm'){const w={verwerker:fd.get('verwerker')==='wordt'?'wordt':'is'};PV_VELDEN.forEach(v=>{w[v[0]]=String(fd.get(v[0])||'').trim().slice(0,200)});const wil=!!fd.get('gepubliceerd');const compl=PV_VELDEN.every(v=>w[v[0]]);w.gepubliceerd=wil&&compl;
    if(await instSave('privacy',w))toast(wil&&!compl?'Opgeslagen. Zichtbaar maken kan pas als alle velden zijn ingevuld.':w.gepubliceerd?'Opgeslagen. De privacyverklaring is zichtbaar voor kandidaten.':'Opgeslagen',wil&&!compl)}
  else if(f.id==='instAiForm'){const w={aan:!!fd.get('aan'),maandlimiet:Math.max(0,Math.min(100000,parseInt(fd.get('maandlimiet'),10)||0))};const was=aiAan();
    if(w.aan&&!was){const y=await confirmBox('AI-conceptfeedback aanzetten?','Vanaf nu wordt elke ingeleverde casus door de AI geanalyseerd, tot maximaal '+w.maandlimiet+' per maand. Dat kost geld zodra de API-sleutel in Supabase staat. Zet dit alleen aan als de kosten zijn goedgekeurd.','Aanzetten');if(!y){renderInstellingen();return}}
    if(await instSave('ai',w))toast(w.aan?'AI-conceptfeedback staat aan':'AI-conceptfeedback staat uit')}
  else{const w={maanden:Math.max(1,Math.min(120,parseInt(fd.get('maanden'),10)||6))};if(await instSave('opslag',w)){toast('Termijn opgeslagen');APP.instX={}}}
  renderInstellingen()});
$('#dash').addEventListener('click',async e=>{const b=e.target.closest('[data-inst]');if(!b||APP.dashView!=='instellingen'||!APP.isStaff)return;const a=b.dataset.inst;
  if(a==='pv-voorbeeld'){const f=$('#instPvForm');const oud=APP.inst.privacy;const w=Object.assign({},oud);if(f){const fd=new FormData(f);PV_VELDEN.forEach(v=>{w[v[0]]=String(fd.get(v[0])||'').trim()});w.verwerker=fd.get('verwerker')}APP.inst.privacy=w;await showPrivacy();APP.inst.privacy=oud}
  else if(a==='backup')backupDownload(b);
  else if(a==='opruimen'){const o=(APP.instX||{}).opslag;const mnd=Math.max(1,Math.min(120,parseInt((APP.inst.opslag||{}).maanden,10)||6));if(!o)return;
    const y=await confirmBox('Foto’s en CBR-bevestigingen wissen?','Je wist '+o.weg_fotos+' foto’s en '+o.weg_cbr+' CBR-bevestiging'+(o.weg_cbr===1?'':'en')+' van '+o.weg_kandidaten+' kandida'+(o.weg_kandidaten===1?'at':'ten')+' die langer dan '+mnd+' maanden geleden zijn geslaagd. In hun PDF staan daarna geen foto’s meer. Dit kun je niet ongedaan maken. Maak eerst een back-up als je de bestanden wilt bewaren.','Wissen');if(!y)return;
    b.disabled=true;const {data,error}=await APP.sb.rpc('opslag_opruimen',{p_maanden:mnd});if(error){toast('Opruimen is mislukt: '+(error.message||''),true);b.disabled=false;return}
    toast('Gewist: '+((data||{}).fotos||0)+' foto’s en '+((data||{}).cbr||0)+' CBR-bevestigingen');APP.instX={};renderInstellingen()}});

/* ---------- melding als de internetverbinding wegvalt ---------- */
(function(){const bar=document.createElement('div');bar.className='offbar';bar.setAttribute('role','status');bar.hidden=true;bar.textContent='Geen internetverbinding. Wijzigingen worden nu niet opgeslagen. Wacht met verder werken tot je weer online bent.';document.body.appendChild(bar);
  const zet=()=>{const uit=navigator.onLine===false;const was=!bar.hidden;bar.hidden=!uit;if(!uit&&was){toast('Je bent weer online.');try{if(APP.dirty&&APP.dirty.size)flush()}catch(e){}}};
  window.addEventListener('offline',zet);window.addEventListener('online',zet);zet()})();

/* ---------- uitlegfilmpjes ---------- */
const VIDEOS={sor:['Zo werkt het SOR-traject','sor-traject'],casus:['Zo werkt de casusbouwer','casusbouwer']};
async function videoOpen(k){const v=VIDEOS[k];if(!v)return;const p=CITY.assets+'assets/video/'+v[1];
  await modalBox(v[0],'','<div class="videobox"><video controls playsinline preload="metadata" poster="'+p+'.jpg" src="'+p+'.mp4"></video></div>','Sluiten',null);$('#modalBody').innerHTML=''}
function videoTegels(){return Object.keys(VIDEOS).map(k=>'<button type="button" class="ltile" data-top="video-'+k+'"><span class="ltile-i" aria-hidden="true">🎬</span><span class="ltile-t"><b>'+VIDEOS[k][0]+'</b><span>Uitlegfilmpje van een paar minuten</span></span><span class="ltile-go" aria-hidden="true">→</span></button>').join('')}
/* blok Hulpmiddelen op de startpagina van de leeromgeving; sor=true: ook de filmpjes over het SOR-traject */
function leerHulpSec(sor){const t=(sor?videoTegels():'')+(cvoAan()?'<button type="button" class="ltile" data-top="cvo"><span class="ltile-i" aria-hidden="true">📄</span><span class="ltile-t"><b>CVO’s van de schepen</b><span>Pagina 2 van het certificaat van onderzoek downloaden, en van sommige schepen het volledige CVO</span></span><span class="ltile-go" aria-hidden="true">→</span></button>':'');
  return t?'<section class="lsec"><div class="lsec-h"><h2>Hulpmiddelen</h2></div><div class="ltiles">'+t+'</div></section>':''}
