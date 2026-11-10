/* ---------- traject: examendatum, deadlines en vrijstelling vaardagen ---------- */
// casus en vrijstelling moeten een week voor de generale rond zijn (zonder generale-datum: een week voor het examen);
// Flagship mailt de formulieren uiterlijk 5 weken voor die datum. Het CBR doet tot 6 weken over een vrijstelling.
// voorlopig alleen voor medewerkers: kandidaten en leermeesters zien het traject nog niet
const TRAJECT_KANDIDAAT=true,TRAJECT_LM=false;
const trajectZichtbaar=()=>APP.isStaff||(APP.isLm&&TRAJECT_LM);
const TJ={casusDagen:7,vrijDagen:7,verstuurDagen:35,waarschuwCasus:14,waarschuwVrij:21,waarschuwVerstuur:7};
/* instellingen per gebied (gebieden.traject): termijnen, basis (generale of examen), vrijstelling aan/uit en eigen stappen */
function tjCfg(st){const g=typeof gebiedVan==='function'?gebiedVan(st||'amsterdam'):null,tr=(g&&g.traject)||{},tm=tr.termijnen||{};const c=Object.assign({},TJ);
  Object.keys(TJ).forEach(k=>{const v=Number(tm[k]);if(Number.isFinite(v)&&v>=0&&v<=365)c[k]=Math.round(v)});
  c.basis=tr.basis==='examen'?'examen':'generale';c.vrij=tr.vrij!==false;c.stappen=Array.isArray(tr.stappen)?tr.stappen.filter(x=>x&&x.id&&x.titel):[];return c}
const termTxt=n=>n===0?'op de dag zelf':n===7?'een week':n%7===0?(n/7)+' weken':n===1?'1 dag':n+' dagen';
const dParse=s=>{if(!s)return null;const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));return m?new Date(+m[1],+m[2]-1,+m[3]):null};
const dIso=d=>d?d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'):'';
const dAdd=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const dToday=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
const dDiff=d=>Math.round((d-dToday())/864e5);
const MND=['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'],DAG=['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'];
const dFmt=(d,lang)=>d?(lang?DAG[d.getDay()]+' ':'')+d.getDate()+' '+MND[d.getMonth()]+(d.getFullYear()!==new Date().getFullYear()?' '+d.getFullYear():''):'–';
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
const overTxt=n=>n===0?'vandaag':n===1?'morgen':n<0?(n===-1?'gisteren':Math.abs(n)+' dagen geleden'):'over '+n+' dagen';
const dagenTxt=n=>n===0?'vandaag':n===1?'morgen':n===-1?'gisteren':n>0?'nog '+n+' dagen':Math.abs(n)+' dagen te laat';
const groepOf=r=>(r&&r.groep_id&&(APP.groepen||[]).find(g=>g.id===r.groep_id))||null;
function traject(r){const g=groepOf(r),c=tjCfg(r.stad);const exam=dParse(r.examen_op)||dParse(g&&g.examen_op),gen=dParse(r.generale_op)||dParse(g&&g.generale_op);
  const basis=c.basis==='examen'?exam:(gen||exam),casusDl=basis?dAdd(basis,-c.casusDagen):null,vrijDl=basis?dAdd(basis,-c.vrijDagen):null,verstuurDl=basis?dAdd(basis,-c.verstuurDagen):null;
  const casusOk=r.status==='ingeleverd'||r.status==='geslaagd',vrijNodig=c.vrij&&r.vrij_nodig!==false,vrijOk=!vrijNodig||!!r.vrij_geregistreerd_op;
  const gedaan=r.stappen||{},extra=c.stappen.map(x=>{const n=Math.max(0,Math.min(365,Math.round(Number(x.dagen)||0)));return{id:x.id,titel:x.titel,wie:x.wie==='flagship'?'flagship':'kandidaat',dagen:n,dl:basis?dAdd(basis,-n):null,op:dParse(gedaan[x.id])}});
  const t={g,c,exam,gen,basisGen:c.basis!=='examen'&&!!gen,basisNaam:c.basis==='examen'||!gen?'examen':'generale',casusDl,vrijDl,verstuurDl,casusOk,vrijNodig,vrijOk,extra,acties:[]};
  if(r.status==='geslaagd'||!exam)return t;
  const niv=n=>n<0?'late':n<=3?'urgent':'soon';
  if(!casusOk){const n=dDiff(casusDl);if(n<=c.waarschuwCasus)t.acties.push({k:'casus',wie:'kandidaat',tekst:n<0?'Casus te laat':'Casus inleveren',dl:casusDl,n,niveau:niv(n)})}
  if(vrijNodig&&!vrijOk){
    if(!r.vrij_verstuurd_op){const n=dDiff(verstuurDl);if(n<=c.waarschuwVerstuur)t.acties.push({k:'verstuur',wie:'flagship',tekst:'Formulieren vrijstelling mailen',dl:verstuurDl,n,niveau:niv(n)})}
    else{const n=dDiff(vrijDl);if(n<=c.waarschuwVrij)t.acties.push({k:'vrij',wie:'kandidaat',tekst:r.vrij_geupload_op?'Vrijstelling nog niet geregistreerd':'Vrijstelling aanvragen bij CBR',dl:vrijDl,n,niveau:niv(n)})}}
  t.extra.forEach(x=>{if(x.op||!x.dl)return;const n=dDiff(x.dl);if(n<=(x.wie==='flagship'?c.waarschuwVerstuur:c.waarschuwCasus))t.acties.push({k:'stap',id:x.id,wie:x.wie,tekst:x.titel,dl:x.dl,n,niveau:niv(n)})});
  t.acties.sort((a,b)=>a.dl-b.dl);return t}
const actieNodig=r=>r.rol==='kandidaat'&&r.status!=='geslaagd'&&traject(r).acties.length>0;
const eersteDl=r=>{const a=traject(r).acties[0];return a?a.dl.getTime():Infinity};
const actiePill=a=>'<span class="pill '+(a.niveau==='late'?'err':a.niveau==='urgent'?'acc':'warn')+'" title="'+esc((a.wie==='flagship'?'Flagship: ':'Kandidaat: ')+a.tekst+' vóór '+dFmt(a.dl))+'">'+(a.wie==='flagship'?'Flagship · ':'')+esc(a.tekst)+(a.n>=0?' · '+(a.n===0?'vandaag':a.n+' d'):'')+'</span>';

/* overzicht: kolom met datums en acties */
function trCell(r){const t=traject(r);let h='';
  if(!t.exam)h='<span class="note">Nog geen examendatum</span>';
  else{h='<b class="tr-ex">Examen '+esc(dFmt(t.exam))+'</b>'+(r.status==='geslaagd'?'':'<small>'+(dDiff(t.exam)<0?'Examen geweest':cap(overTxt(dDiff(t.exam))))+'</small>');
    if(r.status!=='geslaagd')h+=t.acties.length?'<span class="tr-acts">'+t.acties.map(actiePill).join('')+'</span>':(t.casusOk&&t.vrijOk?'<span class="pill ok">Klaar voor het examen</span>':'')}
  return APP.isLm?'<div class="trcell">'+h+'</div>':'<button type="button" class="trcell" data-dact="traject" data-id="'+esc(r.id)+'" title="Traject en datums">'+h+'</button>'}

/* medewerker: traject van één kandidaat */
async function editTraject(r){const t=traject(r),gs=(APP.groepen||[]).slice().sort((a,b)=>String(a.examen_op||'9').localeCompare(String(b.examen_op||'9')));
  const dIn=(id,lab,val,note)=>'<div class="field"><label for="'+id+'">'+lab+'</label><input type="date" id="'+id+'" value="'+esc(val||'')+'">'+(note?'<small class="note">'+note+'</small>':'')+'</div>';
  const stap=(id,lab,val)=>'<div class="tjstap"><label class="kopt"><input type="checkbox" id="'+id+'c"'+(val?' checked':'')+'> <span>'+lab+'</span></label><input type="date" id="'+id+'" value="'+esc(val||'')+'" aria-label="Datum: '+lab+'"></div>';
  const g=t.g;const body='<div class="tjedit"><div class="field"><label for="tjGroep">Groep</label><select id="tjGroep"><option value="">Geen groep</option>'+gs.map(x=>'<option value="'+esc(x.id)+'"'+(x.id===r.groep_id?' selected':'')+'>'+esc(x.naam)+' · '+STAD_NAAM[x.stad]+(x.examen_op?' · examen '+esc(dFmt(dParse(x.examen_op))):'')+'</option>').join('')+'</select><small class="note">De kandidaat krijgt de datums van de groep, tenzij je hieronder een eigen datum invult.</small></div>'+
    '<div class="grid2">'+dIn('tjEx','Eigen examendatum',r.examen_op,g&&g.examen_op?'Groep: '+esc(dFmt(dParse(g.examen_op))):'')+dIn('tjGen','Eigen datum generale',r.generale_op,g&&g.generale_op?'Groep: '+esc(dFmt(dParse(g.generale_op))):'')+'</div>'+
    (t.c.vrij?'<h3 class="tjh">Vrijstelling vaardagen</h3><label class="kopt"><input type="checkbox" id="tjNodig"'+(r.vrij_nodig!==false?' checked':'')+'> <span>Deze kandidaat heeft een vrijstelling van vaardagen nodig</span></label>'+
    '<div id="tjStappen">'+stap('tjV','Flagship: vaartijdenformulier en werkgeversverklaring gemaild',r.vrij_verstuurd_op)+stap('tjU','Kandidaat: vrijstelling aangevraagd bij het CBR',r.vrij_geupload_op)+stap('tjR','Geregistreerd bij het CBR (bevestiging ontvangen)',r.vrij_geregistreerd_op)+'</div>'+((APP.cbrAll||{})[r.id]?'<p class="note cbrnote">CBR-bevestiging geüpload door de kandidaat op '+esc(dFmt(dParse(APP.cbrAll[r.id].geupload)))+': <b>'+esc(APP.cbrAll[r.id].naam)+'</b> <button type="button" class="linkbtn" id="tjCbr">Bekijken</button></p>':''):'')+
    (t.extra.length?'<h3 class="tjh">Stappen '+esc(STAD_NAAM[r.stad||'amsterdam']||'')+'</h3><div id="tjExtra">'+t.extra.map(x=>stap('tjX_'+x.id,(x.wie==='flagship'?'Flagship: ':'Kandidaat: ')+esc(x.titel)+(x.dl?' <small>(uiterlijk '+esc(dFmt(x.dl))+')</small>':''),x.op?dIso(x.op):'')).join('')+'</div>':'')+
    (t.exam?'<p class="note">Deadline casus: <b>'+esc(dFmt(t.casusDl,1))+'</b>, '+termTxt(t.c.casusDagen)+' voor '+(t.basisGen?'de generale':t.c.basis==='examen'?'het examen':'het examen (er is nog geen generale-datum)')+'.'+(t.c.vrij?' Vrijstelling geregistreerd uiterlijk '+esc(dFmt(t.vrijDl))+'. Formulieren mailen uiterlijk '+esc(dFmt(t.verstuurDl))+'.':'')+'</p>':'<p class="note">Vul een examendatum in (of kies een groep met een datum), dan rekent het systeem de deadlines uit.</p>')+'</div>';
  const y=await modalBox('Traject van '+r.naam,'',body,'Opslaan','Annuleren',()=>{
    $$('#tjStappen .tjstap, #tjExtra .tjstap').forEach(s=>{const c=s.querySelector('input[type=checkbox]'),d=s.querySelector('input[type=date]');c.addEventListener('change',()=>{if(c.checked&&!d.value)d.value=dIso(dToday());if(!c.checked)d.value=''});d.addEventListener('change',()=>{c.checked=!!d.value})});
    const cb=$('#tjCbr');if(cb)cb.addEventListener('click',()=>{$('#modalNo').click();setTimeout(()=>cbrBekijk(r.id,r.naam),60)});const n=$('#tjNodig');if(n){const upd=()=>{$('#tjStappen').classList.toggle('dim',!n.checked)};n.addEventListener('change',upd);upd()}$('#tjGroep').focus()});
  if(!y)return;const v=id=>{const el=$('#'+id);return el&&el.value?el.value:null};
  const patch={groep_id:v('tjGroep'),examen_op:v('tjEx'),generale_op:v('tjGen')};if($('#tjNodig'))Object.assign(patch,{vrij_nodig:$('#tjNodig').checked,vrij_verstuurd_op:v('tjV'),vrij_geupload_op:v('tjU'),vrij_geregistreerd_op:v('tjR')});
  if(t.extra.length){const st=Object.assign({},r.stappen||{});t.extra.forEach(x=>{const d=v('tjX_'+x.id);if(d)st[x.id]=d;else delete st[x.id]});patch.stappen=st}
  const {error}=await APP.sb.from('leden').update(patch).eq('id',r.id);if(error){toast('Opslaan is mislukt: '+error.message,true);return}
  Object.assign(r,patch);toast('Traject van '+r.naam+' opgeslagen');renderDash();loadRoster()}

/* medewerker: groepen (lichtingen) met gedeelde datums */
async function loadGroepen(){if(!APP.sb)return;const {data,error}=await APP.sb.from('groepen').select('*').order('examen_op',{ascending:true});if(!error)APP.groepen=data||[]}
/* examengroepen: eigen pagina per vaargebied, en leermeesters aan een hele groep koppelen */
const FOLDER_SVG='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l2 2h8.4A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/></svg>';
const grLms=g=>((APP.lmGroep&&APP.lmGroep[g.id])||[]).map(id=>APP.roster.find(x=>x.id===id)).filter(Boolean);
const grLmCel=g=>{const n=grLms(g).map(r=>r.naam);return n.length?esc(n.join(', ')):'<span class="note">Nog niemand</span>'};
const lmGroepTxt=r=>{const gs=((APP.lmGroepVan&&APP.lmGroepVan[r.id])||[]).map(id=>(APP.groepen||[]).find(g=>g.id===id)).filter(Boolean);return gs.length?'<small>Groepen: '+esc(gs.map(g=>g.naam).join(', '))+'</small>':''};
const lmMijnGroepenTxt=()=>{if(!APP.isLm||!APP.lid)return'';const gs=((APP.lmGroepVan&&APP.lmGroepVan[APP.lid.id])||[]).map(id=>(APP.groepen||[]).find(g=>g.id===id)).filter(Boolean);return gs.length?' Je bent gekoppeld aan '+(gs.length===1?'de groep ':'de groepen ')+esc(gs.map(g=>g.naam).join(', '))+'. Nieuwe kandidaten in die groep'+(gs.length===1?'':'en')+' verschijnen vanzelf.':''};
function renderGroepen(){const st=STADS.includes(APP.grMap)?APP.grMap:'alle';APP.grMap=st;const all=APP.groepen||[];
  let h='<div class="dash-in vg"><div class="row" style="justify-content:space-between;align-items:flex-end"><div><div class="eyebrow">Medewerkers</div><h1>Examengroepen</h1></div></div>';
  h+='<div class="dbar"><div class="folders" role="tablist" aria-label="Vaargebied">'+[['alle','Alle vaargebieden',all.length]].concat(STADS.map(c=>[c,STAD_NAAM[c]||c,all.filter(g=>g.stad===c).length])).map(x=>'<button type="button" role="tab" class="folder'+(st===x[0]?' on':'')+'" aria-selected="'+(st===x[0])+'" data-grmap="'+esc(x[0])+'">'+(x[0]==='alle'?'':FOLDER_SVG)+'<span>'+esc(x[1])+'</span><b>'+x[2]+'</b></button>').join('')+'</div></div>';
  if(APP.lmGroepOk===false)h+='<p class="note">Leermeesters aan een groep koppelen werkt pas als database-update 021 is uitgevoerd.</p>';
  $('#dash').innerHTML=h+groepenView('',st)+'</div>'}
$('#dash').addEventListener('click',e=>{if(APP.dashView!=='groepen'||!APP.isStaff)return;const m=e.target.closest('[data-grmap]');if(m){APP.grMap=m.dataset.grmap;renderGroepen()}});
async function groepLeermeesters(g){if(APP.lmGroepOk===false){toast('Voer eerst database-update 021 uit in Supabase. Daarna kun je leermeesters aan een groep koppelen.',true);return}
  const lms=APP.roster.filter(r=>r.rol==='leermeester').sort((a,b)=>a.naam.localeCompare(b.naam));const cur=new Set(grLms(g).map(r=>r.id));
  const body=lms.length?'<div class="klist">'+lms.map(l=>{const geb=((APP.lmGeb||{})[l.id]||[]).includes(g.stad);return'<label class="kopt"><input type="checkbox" value="'+esc(l.id)+'"'+(cur.has(l.id)?' checked':'')+'> <span><b>'+esc(l.naam)+'</b>'+(geb?' <small>ziet al alle kandidaten uit '+esc(STAD_NAAM[g.stad]||g.stad)+'</small>':'')+'</span></label>'}).join('')+'</div>':'<p class="note">Er zijn nog geen leermeesters. Voeg ze eerst toe bij Kandidaten → Team.</p>';
  const y=await modalBox('Leermeesters voor '+g.naam,'Vink aan wie deze groep begeleidt. Een gekoppelde leermeester ziet alle kandidaten in de groep, ook wie je er later bij zet.',body,lms.length?'Opslaan':'Sluiten',lms.length?'Annuleren':null);if(!y||!lms.length)return;
  const ids=$$('#modalBody .kopt input:checked').map(i=>i.value);const {error}=await APP.sb.rpc('groep_leermeesters_zetten',{p_groep:g.id,p_lms:ids});if(error){toast('Opslaan is mislukt: '+error.message,true);return}
  toast(ids.length?ids.length+' leermeester'+(ids.length===1?'':'s')+' gekoppeld aan '+g.naam:'Er is geen leermeester meer gekoppeld aan '+g.naam);loadRoster()}
function groepenView(q,st){const gs=(APP.groepen||[]).filter(g=>(!q||g.naam.toLowerCase().includes(q))&&(!st||st==='alle'||g.stad===st)).slice().sort((a,b)=>String(a.examen_op||'9').localeCompare(String(b.examen_op||'9')));
  let h='<div class="row" style="justify-content:space-between"><p class="note" style="margin:0">Zet kandidaten met dezelfde examenperiode in een groep. De datums van de groep gelden dan voor iedereen in die groep. Koppel je een leermeester aan de groep, dan ziet die alle kandidaten in de groep.</p><button type="button" class="btn sm primary" data-dact="groep-nieuw">+ Groep toevoegen</button></div>';
  if(!gs.length)return h+'<p class="note">Nog geen groepen.</p>';
  return h+'<div class="tbl-wrap"><table class="tbl dtbl"><thead><tr><th>Groep</th><th>Generale</th><th>Examen</th><th>Kandidaten</th><th>Leermeesters</th><th></th></tr></thead><tbody>'+gs.map(g=>{const ks=APP.roster.filter(r=>r.rol==='kandidaat'&&r.groep_id===g.id);const act=ks.filter(actieNodig).length;const ex=dParse(g.examen_op);
    return'<tr><td class="c-person"><b>'+esc(g.naam)+'</b> <span class="pill stad '+g.stad+'">'+STAD_NAAM[g.stad]+'</span></td><td data-l="Generale" class="c-date">'+esc(dFmt(dParse(g.generale_op)))+'</td><td data-l="Examen" class="c-date">'+esc(dFmt(ex))+(ex?'<small>'+(dDiff(ex)<0?'geweest':overTxt(dDiff(ex)))+'</small>':'')+'</td><td data-l="Kandidaten">'+ks.length+(act?' <span class="pill acc">'+act+' actie nodig</span>':'')+'</td><td data-l="Leermeesters">'+grLmCel(g)+'</td><td class="c-act"><div class="acts"><button type="button" class="btn sm primary" data-dact="groep-kand" data-gid="'+esc(g.id)+'">Kandidaten</button><button type="button" class="btn sm primary" data-dact="groep-lm" data-gid="'+esc(g.id)+'">Leermeesters</button><button type="button" class="btn sm" data-dact="groep-edit" data-gid="'+esc(g.id)+'">Bewerken</button><button type="button" class="btn sm danger" data-dact="groep-weg" data-gid="'+esc(g.id)+'">Verwijderen</button></div></td></tr>'}).join('')+'</tbody></table></div>'}
async function editGroep(g){const nieuw=!g;g=g||{naam:'',stad:APP.dashView==='groepen'&&STADS.includes(APP.grMap)?APP.grMap:STADS.includes(APP.vgMap)?APP.vgMap:STADS.includes(APP.dashMap)?APP.dashMap:'amsterdam',examen_op:null,generale_op:null};
  const body='<div class="field"><label for="gNaam">Naam</label><input id="gNaam" type="text" maxlength="80" placeholder="Bijvoorbeeld Lichting maart 2027" value="'+esc(g.naam)+'"></div><div class="field"><label for="gStad">Vaargebied</label><select id="gStad">'+stadOpts(g.stad)+'</select></div><div class="grid2"><div class="field"><label for="gGen">Generale repetitie</label><input id="gGen" type="date" value="'+esc(g.generale_op||'')+'"></div><div class="field"><label for="gEx">Examen</label><input id="gEx" type="date" value="'+esc(g.examen_op||'')+'"></div></div><p class="note">De deadlines rekent het systeem zelf uit met de termijnen van het vaargebied (menu Voortgang → Instellingen).</p>'+(APP.sjDb?'<div class="field"><label for="gSj">Leeromgeving-sjabloon</label><select id="gSj"><option value="">Standaard van het vaargebied</option>'+(APP.sjAll||[]).map(s=>'<option value="'+s.id+'"'+(g.sjabloon_id===s.id?' selected':'')+'>'+esc((STAD_NAAM[s.gebied]||s.gebied)+' · '+s.naam)+'</option>').join('')+'</select></div>':'');
  const y=await modalBox(nieuw?'Groep toevoegen':'Groep bewerken','',body,nieuw?'Toevoegen':'Opslaan','Annuleren',()=>$('#gNaam').focus());if(!y)return;
  const row={naam:$('#gNaam').value.trim().replace(/\s+/g,' '),stad:$('#gStad').value,generale_op:$('#gGen').value||null,examen_op:$('#gEx').value||null};if(!row.naam){toast('Geef de groep een naam.',true);return}
  if($('#gSj')){row.sjabloon_id=$('#gSj').value||null;const sj=(APP.sjAll||[]).find(s=>s.id===row.sjabloon_id);if(sj&&sj.gebied!==row.stad){toast('Dit sjabloon hoort bij '+(STAD_NAAM[sj.gebied]||sj.gebied)+'. Kies een sjabloon van hetzelfde vaargebied als de groep.',true);return}}
  const {error}=nieuw?await APP.sb.from('groepen').insert(row):await APP.sb.from('groepen').update(row).eq('id',g.id);if(error){toast('Opslaan is mislukt: '+error.message,true);return}
  toast(nieuw?'Groep '+row.naam+' toegevoegd':'Groep opgeslagen');await loadGroepen();loadRoster()}
async function groepKandidaten(g){const ks=APP.roster.filter(r=>r.rol==='kandidaat'&&r.status!=='geslaagd'&&((r.stad||'amsterdam')===g.stad||r.groep_id===g.id)).sort((a,b)=>((b.groep_id===g.id)-(a.groep_id===g.id))||((a.stad||'amsterdam')!==g.stad)-((b.stad||'amsterdam')!==g.stad)||a.naam.localeCompare(b.naam));
  const body=ks.length?'<div class="klist">'+ks.map(k=>{const og=groepOf(k);return'<label class="kopt"><input type="checkbox" value="'+esc(k.id)+'"'+(k.groep_id===g.id?' checked':'')+'> <span><b>'+esc(k.naam)+'</b> <small>'+STAD_NAAM[k.stad||'amsterdam']+(og&&og.id!==g.id?' · nu in '+esc(og.naam):'')+'</small></span></label>'}).join('')+'</div>':'<p class="note">Er zijn geen actieve kandidaten.</p>';
  const y=await modalBox('Kandidaten in '+g.naam,'Vink de kandidaten aan die in deze groep horen. Je ziet alleen kandidaten uit '+(STAD_NAAM[g.stad]||g.stad)+'. Een kandidaat kan maar in één groep zitten.',body,'Opslaan','Annuleren');if(!y)return;
  const ids=$$('#modalBody .kopt input:checked').map(i=>i.value);const {data,error}=await APP.sb.rpc('groep_koppelen',{p_groep:g.id,p_kandidaten:ids});if(error){toast('Opslaan is mislukt: '+error.message,true);return}
  toast(ids.length+' kandida'+(ids.length===1?'at':'ten')+' in '+g.naam);loadRoster()}
async function verwijderGroep(g){const n=APP.roster.filter(r=>r.groep_id===g.id).length;const y=await confirmBox('Groep verwijderen?',(n?n+' kandida'+(n===1?'at staat':'ten staan')+' in deze groep. Zij houden hun eigen datums, maar niet meer de datums van de groep. ':'')+'De kandidaten zelf blijven bestaan.','Verwijderen');if(!y)return;
  const {error}=await APP.sb.from('groepen').delete().eq('id',g.id);if(error){toast('Verwijderen is mislukt: '+error.message,true);return}toast('Groep verwijderd');await loadGroepen();loadRoster()}

/* CBR-bevestiging: de kandidaat uploadt de mail of pdf van het CBR (tabel cbr_bevestiging, migratie 016) */
const CBR_TYPES=['application/pdf','image/jpeg','image/png','image/webp'],CBR_MAX=5*1024*1024;
async function loadCbr(){APP.cbr=null;APP.cbrNiet=false;if(isPreview()||!APP.sb||!APP.lid)return;try{const {data,error}=await APP.sb.from('cbr_bevestiging').select('kandidaat_id,naam,type,grootte,geupload').eq('kandidaat_id',APP.lid.id).maybeSingle();if(error){APP.cbrNiet=true;return}APP.cbr=data||null}catch(e){APP.cbrNiet=true}}
function cbrKnop(reg,up){if(APP.cbrNiet)return reg?'<button type="button" class="linkbtn" data-lact="tj" data-stap="geregistreerd" data-aan="0">Ongedaan maken</button>':'<button type="button" class="btn sm'+(up?' primary':'')+'" data-lact="tj" data-stap="geregistreerd" data-aan="1">Bevestiging ontvangen</button>';
  const c=isPreview()?APP.cbrVb:APP.cbr;
  if(c)return'<div class="cbrbox"><span class="cbrfile">Geüpload: <b>'+esc(c.naam)+'</b> <small>op '+esc(dFmt(dParse(c.geupload)))+'</small></span><button type="button" class="linkbtn" data-lact="cbr-zien">Downloaden</button><button type="button" class="linkbtn" data-lact="cbr-weg">Verwijderen</button></div>';
  return'<div class="cbrbox"><label class="btn sm'+(up?' primary':'')+' cbrup">Bevestiging uploaden<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" data-cbr></label>'+(reg?'<button type="button" class="linkbtn" data-lact="tj" data-stap="geregistreerd" data-aan="0">Ongedaan maken</button>':'')+'</div>'}
async function cbrUpload(f){if(!f)return;if(!CBR_TYPES.includes(f.type)){toast('Kies een pdf of een foto (jpg, png of webp).',true);return}if(f.size>CBR_MAX){toast('Het bestand is groter dan 5 MB. Maak een kleinere foto of pdf.',true);return}
  let data;try{data=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(f)})}catch(e){toast('Het bestand kon niet worden gelezen.',true);return}
  const row={kandidaat_id:APP.lid?APP.lid.id:'voorbeeld',naam:(f.name||'bevestiging').slice(0,200),type:f.type,grootte:f.size,data,geupload:nowIso()};
  if(isPreview()){APP.cbrVb=row;return trajectMelden('geregistreerd',true)}
  setSaveState('Uploaden…');const {error}=await APP.sb.from('cbr_bevestiging').upsert(row);if(error){toast(foutTekst(error,'Uploaden'),true);setSaveState('Niet geüpload',true);return}
  APP.cbr={kandidaat_id:row.kandidaat_id,naam:row.naam,type:row.type,grootte:row.grootte,geupload:row.geupload};await trajectMelden('geregistreerd',true);toast('Bevestiging geüpload. Je opleider ziet hem direct.')}
async function cbrDownload(id){let c;if(isPreview())c=APP.cbrVb;else{const {data,error}=await APP.sb.from('cbr_bevestiging').select('naam,type,data').eq('kandidaat_id',id).maybeSingle();if(error||!data){toast(error?foutTekst(error,'Downloaden'):'Er is geen bevestiging geüpload.',true);return}c=data}
  if(!c)return;try{const blob=await (await fetch(c.data)).blob();saveBlob(blob,c.naam)}catch(e){toast('Downloaden is mislukt.',true)}}
/* medewerker/leermeester: bevestiging bekijken in een venster (pdf of foto), met downloadknop */
async function cbrBekijk(id,naam){const {data,error}=await APP.sb.from('cbr_bevestiging').select('naam,type,data,geupload').eq('kandidaat_id',id).maybeSingle();
  if(error){toast(foutTekst(error,'Openen'),true);return}if(!data){toast('Er is nog geen CBR-bevestiging geüpload.',true);return}
  let blob;try{blob=await (await fetch(data.data)).blob()}catch(e){toast('Het bestand kon niet worden geopend.',true);return}
  const url=URL.createObjectURL(blob),pdf=data.type==='application/pdf';
  const body='<div class="cbrview">'+(pdf?'<iframe class="cbrframe" src="'+url+'#view=FitH" title="CBR-bevestiging van '+esc(naam)+'"></iframe>':'<img class="cbrimg" src="'+url+'" alt="CBR-bevestiging van '+esc(naam)+'">')+(pdf?'<p class="note small">Zie je de pdf niet? Klik op Downloaden en open hem op je computer.</p>':'')+'</div>';
  const card=$('#modal .modal-card');card.classList.add('wide');
  const y=await modalBox('CBR-bevestiging van '+naam,data.naam+' · geüpload op '+dFmt(dParse(data.geupload)),body,'Downloaden','Sluiten');
  card.classList.remove('wide');$('#modalBody').innerHTML='';if(y)saveBlob(blob,data.naam);setTimeout(()=>URL.revokeObjectURL(url),60000)}
async function cbrWeg(){if(!(await confirmBox('Bevestiging verwijderen?','Je geüploade bevestiging van het CBR wordt verwijderd. Je kunt daarna een nieuwe uploaden.','Verwijderen')))return;
  if(isPreview()){APP.cbrVb=null;return trajectMelden('geregistreerd',false)}
  const {error}=await APP.sb.from('cbr_bevestiging').delete().eq('kandidaat_id',APP.lid.id);if(error){toast(foutTekst(error,'Verwijderen'),true);return}APP.cbr=null;await trajectMelden('geregistreerd',false)}
$('#leer').addEventListener('change',e=>{const i=e.target;if(i&&i.matches&&i.matches('input[data-cbr]')){const f=i.files&&i.files[0];i.value='';cbrUpload(f)}});

/* kandidaat: mijn traject */
function mijnTraject(){const pv=isPreview();if(!pv&&(!TRAJECT_KANDIDAAT||APP.isStaff||APP.isLm))return'';const r=pv?trajectVoorbeeld():APP.lid;if(!r)return'';const t=traject(r);const today=dToday();
  const item=(st,titel,datum,sub,extra)=>'<li class="tj-i '+st+'"><span class="tj-dot" aria-hidden="true">'+(st==='done'?'✓':st==='late'?'!':'')+'</span><div class="tj-b"><div class="tj-t"><b>'+titel+'</b>'+(datum?'<span class="tj-d">'+datum+'</span>':'')+'</div>'+(sub?'<p>'+sub+'</p>':'')+(extra||'')+'</div></li>';
  let h='<section class="lsec ltraject"><div class="lsec-h"><h2>Jouw traject</h2>'+(pv?'<span class="pill acc">Voorbeeld, alleen zichtbaar voor medewerkers</span>':'')+(t.exam?'<button type="button" class="btn sm" data-lact="ics">Zet in je agenda</button>':'')+'</div>';
  if(!t.exam)return h+'<p class="note">Je opleider vult je examendatum in. Daarna zie je hier je deadlines en krijg je een melding als iets bijna moet zijn ingeleverd.</p></section>';
  const urgent=t.acties.filter(a=>a.wie==='kandidaat');if(urgent.length)h+='<div class="tj-alert'+(urgent.some(a=>a.niveau==='late')?' late':'')+'" role="status">'+urgent.map(a=>'<div><b>'+(a.niveau==='late'?'Te laat: ':'Let op: ')+esc(a.k==='stap'?a.tekst+', uiterlijk '+dFmt(a.dl,1):a.k==='casus'?'je casus moet uiterlijk '+dFmt(a.dl,1)+' zijn ingeleverd':a.k==='vrij'&&a.tekst.includes('aanvragen')?'vraag je vrijstelling nu aan bij het CBR, hij moet uiterlijk '+dFmt(a.dl,1)+' geregistreerd staan':'je vrijstelling moet uiterlijk '+dFmt(a.dl,1)+' bij het CBR geregistreerd staan')+'</b> ('+dagenTxt(a.n)+')</div>').join('')+'</div>';
  const items=[];const pst=(ok,dl)=>ok?'done':dl&&dDiff(dl)<0?'late':dl&&dDiff(dl)<=3?'urgent':'open';
  if(t.gen)items.push([t.gen,item(t.gen<today?'done':'open','Generale repetitie',esc(dFmt(t.gen,1)),t.gen<today?'Geweest.':cap(overTxt(dDiff(t.gen)))+'.')]);
  items.push([t.casusDl,item(pst(t.casusOk,t.casusDl),'Casus inleveren','uiterlijk '+esc(dFmt(t.casusDl,1)),t.casusOk?'Ingeleverd. Goed bezig!':cap(termTxt(t.c.casusDagen))+' voor je '+t.basisNaam+'. '+cap(dagenTxt(dDiff(t.casusDl)))+'.',!t.casusOk&&casusOpen()?'<button type="button" class="btn sm primary" data-lact="casus">Naar je casus</button>':'')]);
  if(t.vrijNodig){const s=(ok,txt,datum,btn)=>'<li class="'+(ok?'ok':'')+'"><span aria-hidden="true">'+(ok?'✓':'○')+'</span><span>'+txt+(datum?' <small>'+esc(datum)+'</small>':'')+'</span>'+(btn||'')+'</li>';
    const ver=dParse(r.vrij_verstuurd_op),up=dParse(r.vrij_geupload_op),reg=dParse(r.vrij_geregistreerd_op);
    const stappen='<ol class="tj-stappen">'+s(!!ver,'Flagship mailt je het vaartijdenformulier en de werkgeversverklaring.',ver?'verstuurd op '+dFmt(ver):'nog niet verstuurd')+
      s(!!(up||reg),'Vraag in de webshop van het SAB je vaartijdverklaring aan: <b>Vaartijdenverklaring</b> → <b>Aanvraagverklaring vaartijd open rondvaartboot</b> → kies loondienst of zzp. Na goedkeuring krijg je hem thuis.','')+
      s(!!up,'Vul op cbr.nl het <a href="https://www.cbr.nl/nl/service/nl/formulier/aanvraagformulier-vrijstelling-praktijktoetsen-1-en-2-schipper-open-rondvaartboot-beperkt-vaargebied" target="_blank" rel="noopener">aanvraagformulier vrijstelling praktijktoetsen 1 en 2</a> in en mail het met je SAB-vaartijdverklaring naar het CBR.',up?'gemeld op '+dFmt(up):'',reg?'':up?'<button type="button" class="linkbtn" data-lact="tj" data-stap="geupload" data-aan="0">Ongedaan maken</button>':'<button type="button" class="btn sm'+(ver?' primary':'')+'" data-lact="tj" data-stap="geupload" data-aan="1">Ik heb hem aangevraagd</button>')+
      s(!!reg,'Het CBR mailt je het besluit. Dat duurt maximaal 6 weken. '+(APP.cbrNiet?'':'Upload de bevestiging van het CBR hier: de pdf, of de mail als pdf of schermafbeelding.'),reg?'gemeld op '+dFmt(reg):'',cbrKnop(reg,up))+'</ol>';
    items.push([t.vrijDl,item(pst(t.vrijOk,t.vrijDl),'Vrijstelling vaardagen','uiterlijk '+esc(dFmt(t.vrijDl,1)),t.vrijOk?'Geregistreerd bij het CBR.':'Moet '+termTxt(t.c.vrijDagen)+' voor je '+t.basisNaam+' bij het CBR geregistreerd staan. Het CBR doet er tot 6 weken over, dus begin op tijd.',stappen)])}
  t.extra.filter(x=>x.dl).forEach(x=>items.push([x.dl,item(pst(!!x.op,x.dl),esc(x.titel),'uiterlijk '+esc(dFmt(x.dl,1)),x.op?'Afgerond op '+esc(dFmt(x.op))+'.':(x.wie==='flagship'?'Dit regelt Flagship. ':'')+cap(dagenTxt(dDiff(x.dl)))+'.')]));
  items.push([t.exam,item(t.exam<today?'done':'open','Examen praktijktoets 3',esc(dFmt(t.exam,1)),t.exam<today?'Geweest.':cap(overTxt(dDiff(t.exam)))+'.')]);
  items.sort((a,b)=>a[0]-b[0]);return h+'<ol class="tj-list">'+items.map(x=>x[1]).join('')+'</ol></section>'}
function trajectVoorbeeld(){if(!APP.tjVb){const d=n=>dIso(dAdd(dToday(),n));APP.tjVb={id:'voorbeeld',status:'bezig',examen_op:d(12),generale_op:d(9),vrij_nodig:true,vrij_verstuurd_op:d(-6),vrij_geupload_op:null,vrij_geregistreerd_op:null}}return APP.tjVb}
async function trajectMelden(stap,aan){if(isPreview()){const r=trajectVoorbeeld(),k=stap==='geupload'?'vrij_geupload_op':'vrij_geregistreerd_op';r[k]=aan?dIso(dToday()):null;renderLeer();return}const {data,error}=await APP.sb.rpc('traject_melden',{p_stap:stap,p_aan:aan});if(error){toast('Opslaan is mislukt: '+error.message,true);return}
  const row=Array.isArray(data)?data[0]:data;if(row)Object.assign(APP.lid,row);toast(aan?'Opgeslagen. Je opleider ziet het direct.':'Teruggezet');renderLeer()}
function trajectIcs(){const r=isPreview()?trajectVoorbeeld():APP.lid,t=traject(r);if(!t.exam)return;const ds=d=>dIso(d).replace(/-/g,''),stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+/,'');
  const ie=x=>String(x).replace(/([\\,;])/g,'\\$1').replace(/\n/g,'\\n'),fold=l=>{let o='';while(l.length>73){o+=l.slice(0,73)+'\r\n ';l=l.slice(73)}return o+l};
  const ev=(id,d,titel,desc)=>['BEGIN:VEVENT','UID:'+id+'-'+r.id+'@flagship-academy','DTSTAMP:'+stamp,'DTSTART;VALUE=DATE:'+ds(d),'DTEND;VALUE=DATE:'+ds(dAdd(d,1)),'SUMMARY:'+ie(titel),'DESCRIPTION:'+ie(desc),'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+ie(titel),'TRIGGER:-P2D','END:VALARM','END:VEVENT'].map(fold);
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Flagship Academy//SOR traject//NL','CALSCALE:GREGORIAN'];
  lines.push(...ev('deadline',t.casusDl,'Deadline casus'+(t.vrijNodig?' en vrijstelling vaardagen':'')+' (SOR)','Casus inleveren'+(t.vrijNodig?' en vrijstelling geregistreerd bij het CBR':'')+'.'));
  if(t.gen)lines.push(...ev('generale',t.gen,'Generale repetitie praktijktoets 3 (SOR)','Generale repetitie bij Flagship Academy.'));
  lines.push(...ev('examen',t.exam,'Examen praktijktoets 3 (SOR)','CBR-examen praktijktoets 3.\n\nNeem mee:\n- een geldig identiteitsbewijs\n- je reserveringsbevestiging\n- je SAB-vaartijdverklaring (minimaal 30 vaardagen)\n- klein vaarbewijs 1 (tot 1 juni 2028) of het diploma rondvaartboot theorie\n- je casus 3 in tweevoud (twee keer geprint)'),'END:VCALENDAR');
  const blob=new Blob([lines.join('\r\n')],{type:'text/calendar'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='SOR-traject.ics';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
