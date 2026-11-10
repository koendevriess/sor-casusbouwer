/* ---------- leermodules per vaargebied (sjablonen: hoofdstuk met quiz, vaargebied leren kennen) ---------- */
const MOD_SOORT={hoofdstuk:'Hoofdstuk met quiz',vaargebied:'Vaargebied leren kennen'};
const MOD_PUNT={brug:'Brug',sluis:'Sluis',opstap:'Opstapplaats',aandacht:'Aandachtspunt',bez:'Bezienswaardigheid',ligplaats:'Ligplaats',kruising:'Kruising'};
const MV={v:'les',q:null,sel:null};
async function loadModules(){APP.modules=[];if(!APP.sb||!APP.user)return;try{let q=APP.sb.from('leermodules').select('*').eq('gebied',CITY.id);if(!isPreview())q=q.eq('actief',true);const {data,error}=await q;if(!error&&data)APP.modules=data.sort((a,b)=>(a.volgorde-b.volgorde)||String(a.titel).localeCompare(b.titel))}catch(e){}}
function modSt(){const d=APP.th&&APP.th.data;if(!d)return{};d.x=d.x||{};return d.x.mod=d.x.mod||{}}
const modRes=id=>modSt()[id]||null;
const modVragen=m=>{const i=m.inhoud||{};let v=(i.vragen||[]).filter(q=>q&&q.v&&Array.isArray(q.o)&&q.o.filter(Boolean).length>=2);
  if(m.soort==='vaargebied'){const ps=(i.punten||[]).filter(p=>p&&p.naam&&Number.isFinite(p.x)&&Number.isFinite(p.y));if(ps.length>=2)v=shuffle(ps).slice(0,8).map(p=>({kaart:p.id,v:'Waar ligt '+p.naam+'?'})).concat(v)}return v};
function modMeta(m){const r=modRes(m.id),n=modVragen(m).length;return r&&r.van?(r.best/r.van>=LEER_PASS?starRow(r.best/r.van>=1?3:r.best/r.van>=.9?2:1)+'<span class="lmeta">Gehaald · beste score '+Math.round(r.best/r.van*100)+'%</span>':'<span class="lmeta">Beste score '+Math.round(r.best/r.van*100)+'% · nog niet gehaald</span>'):'<span class="lmeta">'+(r&&r.gelezen?'Gelezen':'Nog niet begonnen')+(n?' · quiz van '+n+' vragen':'')+'</span>'}
/* kaart als SVG uit de kaartgegevens van dit vaargebied */
function modBox(pts,marge,min){if(!pts.length){let a=1e9,b=1e9,c=-1e9,d=-1e9;WATER.forEach(w=>{a=Math.min(a,w.bb[0]);b=Math.min(b,w.bb[1]);c=Math.max(c,w.bb[2]);d=Math.max(d,w.bb[3])});WAYS.forEach(w=>w.pts.forEach(p=>{a=Math.min(a,p[0]);b=Math.min(b,p[1]);c=Math.max(c,p[0]);d=Math.max(d,p[1])}));return a<c?[a-100,b-100,c+100,d+100]:[-1500,-1500,1500,1500]}
  let a=1e9,b=1e9,c=-1e9,d=-1e9;pts.forEach(p=>{a=Math.min(a,p.x);b=Math.min(b,p.y);c=Math.max(c,p.x);d=Math.max(d,p.y)});a-=marge;b-=marge;c+=marge;d+=marge;
  if(c-a<min){const m=(a+c)/2;a=m-min/2;c=m+min/2}if(d-b<min*.62){const m=(b+d)/2;b=m-min*.31;d=m+min*.31}return[a,b,c,d]}
function modMap(pts,opt){opt=opt||{};const bx=opt.box||modBox(pts,opt.marge||250,opt.min||900),W=bx[2]-bx[0],H=bx[3]-bx[1],sw=W/600;const isct=bb=>!(bb[2]<bx[0]||bb[0]>bx[2]||bb[3]<bx[1]||bb[1]>bx[3]);
  const P=p=>p[0].toFixed(0)+' '+(-p[1]).toFixed(0);let h='';
  WATER.forEach(w=>{if(isct(w.bb))h+='<path d="'+w.rings.map(r=>'M'+r.map(P).join('L')+'Z').join('')+'" class="mw" fill-rule="evenodd"/>'});
  WAYS.forEach(w=>{const q=w.pts;if(q.length<2)return;let a=1e9,b=1e9,c=-1e9,d=-1e9;q.forEach(p=>{a=Math.min(a,p[0]);b=Math.min(b,p[1]);c=Math.max(c,p[0]);d=Math.max(d,p[1])});if(isct([a,b,c,d]))h+='<path d="M'+q.map(P).join('L')+'" class="mwy" stroke-width="'+(sw*2.2).toFixed(1)+'"/>'});
  const r=sw*11;h+=pts.map((p,i)=>'<g class="mpt'+(opt.sel===p.id?' on':'')+'"'+(opt.klik?' data-mpt="'+esc(p.id)+'" tabindex="0" role="button" aria-label="'+esc((opt.labels?opt.labels[i]:String(i+1))+(opt.namen?' '+p.naam:''))+'"':'')+'><circle cx="'+p.x.toFixed(0)+'" cy="'+(-p.y).toFixed(0)+'" r="'+r.toFixed(1)+'"/><text x="'+p.x.toFixed(0)+'" y="'+(-p.y+r*.38).toFixed(0)+'" font-size="'+(r*1.05).toFixed(1)+'" text-anchor="middle">'+esc(opt.labels?opt.labels[i]:String(i+1))+'</text></g>').join('');
  return'<svg class="mmap'+(opt.edit?' edit':'')+'" viewBox="'+bx[0].toFixed(0)+' '+(-bx[3]).toFixed(0)+' '+W.toFixed(0)+' '+H.toFixed(0)+'" role="img" aria-label="'+esc(opt.aria||'Kaart van het vaargebied')+'"'+(opt.edit?' data-medit="1"':'')+'><rect x="'+bx[0]+'" y="'+(-bx[3])+'" width="'+W+'" height="'+H+'" class="mbg"/>'+h+'</svg>'}
const modTekst=t=>{const lines=String(t||'').split('\n');let h='',ul=[];const flush=()=>{if(ul.length){h+='<ul>'+ul.map(x=>'<li>'+fmtT(x)+'</li>').join('')+'</ul>';ul=[]}};
  lines.forEach(l=>{const s=l.trim();if(/^[-•*]\s+/.test(s))ul.push(s.replace(/^[-•*]\s+/,''));else{flush();if(s)h+='<p>'+fmtT(s)+'</p>'}});flush();return h};
/* kandidaat: module bekijken en de quiz maken */
function viewMod(){const m=(APP.modules||[]).find(x=>x.id===LV.id);if(!m)return viewHome();const i=m.inhoud||{};
  if(MV.v==='quiz'&&MV.q)return modQuiz(m);if(MV.v==='res'&&MV.q)return modRes2(m);
  let h='<div class="lbar"><button type="button" class="btn soft sm" data-lact="home">← Overzicht</button><span class="lcrumb">Extra voor '+esc(CITY.naam)+'</span></div>';
  h+='<header class="lhead"><div class="eyebrow">'+esc(MOD_SOORT[m.soort]||'')+(m.actief?'':' · concept')+'</div><h1>'+esc(m.titel)+'</h1>'+(i.intro?modTekst(i.intro):'')+'</header>';
  if(m.soort==='hoofdstuk')h+=(i.secties||[]).filter(s=>s&&(s.kop||s.tekst)).map(s=>'<section class="lsec">'+(s.kop?'<div class="lsec-h"><h2>'+esc(s.kop)+'</h2></div>':'')+modTekst(s.tekst)+'</section>').join('');
  else{const ps=(i.punten||[]).filter(p=>p&&p.naam);h+='<section class="lsec"><div class="lsec-h"><h2>De kaart</h2></div><p class="note">Klik op een nummer op de kaart of in de lijst om het punt te bekijken.</p><div class="mwrap">'+modMap(ps,{sel:MV.sel,klik:true,namen:true,aria:'Kaart van '+CITY.naam+' met '+ps.length+' genummerde punten'})+'</div>'+
    '<ol class="mlist">'+ps.map((p,k)=>'<li class="'+(MV.sel===p.id?'on':'')+'"><button type="button" class="mli" data-mpt="'+esc(p.id)+'"><span class="mnr">'+(k+1)+'</span><span><b>'+esc(p.naam)+'</b> <span class="pill unk">'+esc(MOD_PUNT[p.soort]||'Punt')+'</span>'+(p.tekst?'<small>'+esc(p.tekst)+'</small>':'')+'</span></button></li>').join('')+'</ol></section>'}
  const n=modVragen(m).length;if(n)h+='<div class="lnext"><div><b>Klaar?</b><span>'+n+' vragen · 80% goed om de module te halen</span></div><button type="button" class="btn primary" data-lact="mquiz">Start de quiz</button></div>';
  return h}
function modStart(m){const vs=modVragen(m),ps=((m.inhoud||{}).punten||[]).filter(p=>p&&p.naam);
  MV.q={i:0,ok:0,ans:null,qs:vs.map(v=>{if(v.kaart){const goed=ps.find(p=>p.id===v.kaart);const rest=shuffle(ps.filter(p=>p.id!==v.kaart)).slice(0,Math.min(3,ps.length-1));const opts=shuffle([goed].concat(rest));return{v:v.v,kaart:opts,o:opts.map((p,k)=>'Punt '+'ABCD'[k]),g:opts.indexOf(goed),u:goed.naam+' is punt '+'ABCD'[opts.indexOf(goed)]+'.'+(goed.tekst?' '+goed.tekst:'')}}
    const o=v.o.map((t,k)=>({t,k})).filter(x=>x.t);const sh=shuffle(o);return{v:v.v,o:sh.map(x=>x.t),g:sh.findIndex(x=>x.k===(+v.g||0)),u:v.u||''}})};MV.v='quiz'}
function modQuiz(m){const Q=MV.q,q=Q.qs[Q.i],n=Q.qs.length,a=Q.ans;
  let h='<div class="lbar"><button type="button" class="btn soft sm" data-lact="mstop">Stoppen</button><span class="lcrumb">'+esc(m.titel)+'</span></div><div class="qprog"><div class="qbar" role="progressbar" aria-valuemin="0" aria-valuemax="'+n+'" aria-valuenow="'+(Q.i+(a!=null?1:0))+'" aria-label="Voortgang quiz"><span style="width:'+Math.round((Q.i+(a!=null?1:0))/n*100)+'%"></span></div><span>Vraag '+(Q.i+1)+' van '+n+'</span></div>';
  h+='<section class="qcard"><h2 id="qText">'+esc(q.v)+'</h2>'+(q.kaart?'<div class="mwrap">'+modMap(q.kaart,{labels:q.kaart.map((p,k)=>'ABCD'[k]),marge:200,min:700,aria:'Kaart met de punten A tot en met '+'ABCD'[q.kaart.length-1]})+'</div>':'')+'<div class="qopts" role="group" aria-labelledby="qText">'+q.o.map((o,k)=>{let c='qopt';if(a!=null){if(k===q.g)c+=' good';else if(k===a)c+=' bad';else c+=' dim'}return'<button type="button" class="'+c+'" data-mq="'+k+'"'+(a!=null?' disabled':'')+'><span class="ql" aria-hidden="true">'+'ABCD'[k]+'</span><span>'+esc(o)+'</span></button>'}).join('')+'</div>';
  if(a!=null)h+='<div class="qfb '+(a===q.g?'good':'bad')+'" role="status"><b>'+(a===q.g?'Goed!':'Helaas, dat is niet goed.')+'</b>'+(q.u?'<p>'+esc(q.u)+'</p>':'')+'</div><div class="qnext"><button type="button" class="btn primary" data-lact="mnext" id="mNext">'+(Q.i+1<n?'Volgende vraag':'Bekijk je resultaat')+'</button></div>';
  return h+'</section>'}
function modRes2(m){const Q=MV.q,n=Q.qs.length,p=Q.ok/n,ok=p>=LEER_PASS;
  return'<div class="lbar"><button type="button" class="btn soft sm" data-lact="home">← Overzicht</button></div><section class="qres"><h1>'+(ok?'Gehaald!':'Nog niet gehaald')+'</h1>'+starRow(ok?(p>=1?3:p>=.9?2:1):0,true)+'<p><b>'+Q.ok+' van de '+n+'</b> goed ('+Math.round(p*100)+'%). '+(ok?'Goed gedaan.':'Je hebt 80% nodig. Lees de module nog eens en probeer het opnieuw.')+'</p><div class="row qres-a"><button type="button" class="btn" data-lact="mles">Terug naar de module</button><button type="button" class="btn primary" data-lact="mquiz">Opnieuw</button></div></section>'}
function modPick(k){const Q=MV.q;if(!Q||Q.ans!=null)return;Q.ans=k;if(k===Q.qs[Q.i].g)Q.ok++;renderLeer();setTimeout(()=>{const b=$('#mNext');if(b)b.focus()},30)}
function modNext(){const Q=MV.q;if(!Q||Q.ans==null)return;if(Q.i+1<Q.qs.length){Q.i++;Q.ans=null;renderLeer();setTimeout(()=>{const b=$('#leer [data-mq]');if(b)b.focus()},30);return}
  const s=modSt(),r=s[LV.id]||{};s[LV.id]=Object.assign(r,{gelezen:true,van:Q.qs.length,best:Math.max(r.van===Q.qs.length?(r.best||0):0,Q.ok),op:nowIso()});thSave();MV.v='res';renderLeer();leerScroll()}
function modOpen(id){LV.v='mod';LV.id=id;LQ=null;MV.v='les';MV.q=null;MV.sel=null;renderLeer();leerScroll();navPush({k:'leer',v:'mod',id});const s=modSt();if(APP.th&&!(s[id]&&s[id].gelezen)){s[id]=Object.assign({},s[id]||{},{gelezen:true});thSave()}}
$('#leer').addEventListener('click',e=>{if(LV.v!=='mod')return;const o=e.target.closest('[data-mq]');if(o){modPick(+o.dataset.mq);return}const p=e.target.closest('[data-mpt]');if(p){MV.sel=MV.sel===p.dataset.mpt?null:p.dataset.mpt;renderLeer();return}
  const b=e.target.closest('[data-lact]');if(!b)return;const a=b.dataset.lact,m=(APP.modules||[]).find(x=>x.id===LV.id);if(!m)return;
  if(a==='mquiz'){modStart(m);renderLeer();leerScroll()}else if(a==='mnext')modNext();else if(a==='mles'||a==='mstop'){MV.v='les';MV.q=null;renderLeer();leerScroll()}});
$('#leer').addEventListener('keydown',e=>{if(LV.v!=='mod')return;const g=e.target.closest&&e.target.closest('g[data-mpt]');if(g&&(e.key==='Enter'||e.key===' ')){e.preventDefault();g.dispatchEvent(new MouseEvent('click',{bubbles:true}))}});

/* medewerker: leermodules maken en beheren (pagina Vaargebieden, tab Leermodules) */
const ME={st:null,edit:null};
async function meLoad(st){const {data,error}=await APP.sb.from('leermodules').select('*').eq('gebied',st);APP.meMods=APP.meMods||{};if(error){APP.meFout=foutTekst(error,'Leermodules laden');APP.meMods[st]=[];return}APP.meFout=null;APP.meMods[st]=(data||[]).sort((a,b)=>(a.volgorde-b.volgorde)||String(a.titel).localeCompare(b.titel))}
const meHier=st=>st===CITY.id;
const meNieuw=soort=>({id:null,soort,titel:'',actief:false,inhoud:soort==='hoofdstuk'?{intro:'',secties:[{kop:'',tekst:''}],vragen:[{v:'',o:['','','',''],g:0,u:''}]}:{intro:'',punten:[],vragen:[]}});
function meView(){const st=ME.st&&STADS.includes(ME.st)?ME.st:CITY.id;ME.st=st;const mods=(APP.meMods||{})[st];
  if(APP.meFout)return'<p class="note warn">'+esc(APP.meFout)+'</p>';
  if(!mods){meLoad(st).then(()=>{if(gbPagina())renderGebiedBouwer()});return'<p class="note">Leermodules laden…</p>'}
  let h='<div class="row" style="gap:8px;align-items:flex-end;flex-wrap:wrap"><div class="field" style="margin:0"><label for="meSt">Vaargebied</label><select id="meSt">'+stadOpts(st)+'</select></div>'+(ME.edit?'':'<button type="button" class="btn primary" data-me="nieuw" data-soort="hoofdstuk">+ Hoofdstuk met quiz</button><button type="button" class="btn" data-me="nieuw" data-soort="vaargebied">+ Vaargebied leren kennen</button>')+'</div>';
  if(ME.edit)return h+meEditor(st);
  h+='<p class="note">Leermodules verschijnen bij kandidaten van '+esc(STAD_NAAM[st]||st)+' in de leeromgeving onder “Extra voor '+esc(STAD_NAAM[st]||st)+'”, zodra je ze activeert. Ze tellen niet mee voor de eindtoets.</p>';
  if(!mods.length)return h+'<p class="note">Nog geen leermodules voor '+esc(STAD_NAAM[st]||st)+'.</p>';
  return h+'<div class="tbl-wrap"><table class="tbl dtbl"><thead><tr><th>Module</th><th>Sjabloon</th><th>Status</th><th></th></tr></thead><tbody>'+mods.map((m,k)=>'<tr><td class="c-person"><b>'+esc(m.titel)+'</b><small>'+modVragen(m).length+' quizvragen'+(m.soort==='vaargebied'?' · '+((m.inhoud||{}).punten||[]).length+' punten':'')+'</small></td><td data-l="Sjabloon">'+esc(MOD_SOORT[m.soort])+'</td><td data-l="Status">'+(m.actief?'<span class="pill ok">Actief</span>':'<span class="pill warn">Concept</span>')+'</td><td class="c-act"><div class="acts"><button type="button" class="btn sm" data-me="op" data-k="'+k+'"'+(k?'':' disabled')+' aria-label="'+esc(m.titel)+' omhoog">↑</button><button type="button" class="btn sm" data-me="neer" data-k="'+k+'"'+(k<mods.length-1?'':' disabled')+' aria-label="'+esc(m.titel)+' omlaag">↓</button><button type="button" class="btn sm primary" data-me="bewerk" data-k="'+k+'">Bewerken</button><button type="button" class="btn sm" data-me="actief" data-k="'+k+'">'+(m.actief?'Deactiveren':'Activeren')+'</button><button type="button" class="btn sm danger" data-me="weg" data-k="'+k+'">Verwijderen</button></div></td></tr>').join('')+'</tbody></table></div>'}
function meVraagHtml(q,k){return'<div class="mevraag" data-k="'+k+'"><div class="field"><label for="meQ'+k+'">Vraag '+(k+1)+'</label><input id="meQ'+k+'" data-f="v" type="text" maxlength="200" value="'+esc(q.v||'')+'"></div><div class="meopts">'+[0,1,2,3].map(j=>'<label class="meopt"><input type="radio" name="meG'+k+'" value="'+j+'"'+((+q.g||0)===j?' checked':'')+' aria-label="Antwoord '+'ABCD'[j]+' is goed"><span>'+'ABCD'[j]+'</span><input type="text" data-f="o'+j+'" maxlength="140" value="'+esc((q.o||[])[j]||'')+'" placeholder="Antwoord '+'ABCD'[j]+(j>1?' (mag leeg)':'')+'" aria-label="Antwoord '+'ABCD'[j]+'"></label>').join('')+'</div><div class="field"><label for="meU'+k+'">Uitleg na het antwoord</label><input id="meU'+k+'" data-f="u" type="text" maxlength="300" value="'+esc(q.u||'')+'"></div><button type="button" class="btn sm danger" data-me="vraag-weg" data-k="'+k+'">Vraag verwijderen</button></div>'}
function meEditor(st){const m=ME.edit,i=m.inhoud;const hier=meHier(st);
  let h='<div id="meForm" class="meform"><div class="lsec-h"><h2>'+(m.id?'Module bewerken':'Nieuwe module')+' · '+esc(MOD_SOORT[m.soort])+'</h2></div>'+
    '<div class="field"><label for="meTitel">Titel</label><input id="meTitel" type="text" maxlength="100" value="'+esc(m.titel)+'" placeholder="'+(m.soort==='hoofdstuk'?'Bijvoorbeeld Sluizen in Leiden':'Bijvoorbeeld Het vaargebied van Leiden')+'"></div>'+
    '<div class="field"><label for="meIntro">Inleiding</label><textarea id="meIntro" rows="3" maxlength="2000">'+esc(i.intro||'')+'</textarea><small class="note">Tip: **vet** en regels die beginnen met - worden een opsomming.</small></div>';
  if(m.soort==='hoofdstuk')h+='<h3 class="tjh">Onderdelen</h3><div id="meSecties">'+(i.secties||[]).map((s,k)=>'<div class="mesectie" data-k="'+k+'"><div class="field"><label for="meK'+k+'">Kop onderdeel '+(k+1)+'</label><input id="meK'+k+'" data-f="kop" type="text" maxlength="120" value="'+esc(s.kop||'')+'"></div><div class="field"><label for="meT'+k+'">Tekst</label><textarea id="meT'+k+'" data-f="tekst" rows="5" maxlength="6000">'+esc(s.tekst||'')+'</textarea></div><button type="button" class="btn sm danger" data-me="sectie-weg" data-k="'+k+'">Onderdeel verwijderen</button></div>').join('')+'</div><button type="button" class="btn sm" data-me="sectie-nieuw">+ Onderdeel</button>';
  else{const ps=i.punten||[];
    h+='<h3 class="tjh">Punten op de kaart</h3>'+(hier?'<p class="note">Klik op de kaart om een punt toe te voegen, of kies een brug uit de lijst. De quiz vraagt kandidaten om de punten op de kaart terug te vinden.</p><div class="mwrap">'+modMap(ps,{edit:true,box:modBox([],0,0),aria:'Kaart van '+STAD_NAAM[st]+'; klik om een punt toe te voegen'})+'</div>'+
      '<div class="row" style="gap:8px;margin:8px 0"><label class="sr" for="meBrug">Brug toevoegen</label><select id="meBrug"><option value="">Brug toevoegen…</option>'+BRIDGES.map((b,k)=>({b,k})).filter(x=>x.b.nm).sort((a,b)=>a.b.nm.localeCompare(b.b.nm)).map(x=>'<option value="'+x.k+'">'+esc(x.b.nm)+'</option>').join('')+'</select></div>':
      '<p class="note warn">De kaart van '+esc(STAD_NAAM[st]||st)+' is alleen beschikbaar in de casusbouwer van '+esc(STAD_NAAM[st]||st)+'. <a href="'+esc(cityUrl(st))+'?leermodules=1">Open de leermodules daar</a> om punten te plaatsen.</p>')+
      '<div id="mePunten">'+(ps.length?ps.map((p,k)=>'<div class="mepunt" data-k="'+k+'"><span class="mnr">'+(k+1)+'</span><div class="field"><label for="meP'+k+'">Naam</label><input id="meP'+k+'" data-f="naam" type="text" maxlength="80" value="'+esc(p.naam||'')+'"></div><div class="field"><label for="meS'+k+'">Soort</label><select id="meS'+k+'" data-f="soort">'+Object.keys(MOD_PUNT).map(s=>'<option value="'+s+'"'+(p.soort===s?' selected':'')+'>'+MOD_PUNT[s]+'</option>').join('')+'</select></div><div class="field mewide"><label for="meX'+k+'">Uitleg</label><input id="meX'+k+'" data-f="tekst" type="text" maxlength="300" value="'+esc(p.tekst||'')+'"></div><button type="button" class="btn sm danger" data-me="punt-weg" data-k="'+k+'" aria-label="Punt '+(k+1)+' verwijderen">Verwijderen</button></div>').join(''):'<p class="note">Nog geen punten.</p>')+'</div>'}
  h+='<h3 class="tjh">Quizvragen'+(m.soort==='vaargebied'?' (extra, naast de kaartvragen)':'')+'</h3><div id="meVragen">'+(i.vragen||[]).map(meVraagHtml).join('')+'</div><button type="button" class="btn sm" data-me="vraag-nieuw">+ Vraag</button>';
  h+='<div class="row" style="gap:8px;margin-top:16px"><button type="button" class="btn primary" data-me="opslaan">Opslaan</button><button type="button" class="btn ghost" data-me="annuleer">Annuleren</button>'+(m.id&&hier?'<button type="button" class="btn" data-me="bekijk">Bekijken als kandidaat</button>':'')+'</div></div>';
  return h}
function meLees(){const m=ME.edit;if(!m||!$('#meForm'))return m;const i=m.inhoud;m.titel=$('#meTitel').value.trim().replace(/\s+/g,' ');i.intro=$('#meIntro').value.trim();
  if(m.soort==='hoofdstuk')i.secties=$$('#meSecties .mesectie').map(r=>({kop:r.querySelector('[data-f="kop"]').value.trim(),tekst:r.querySelector('[data-f="tekst"]').value.trim()}));
  else i.punten=$$('#mePunten .mepunt').map(r=>{const p=i.punten[+r.dataset.k]||{};return Object.assign({},p,{naam:r.querySelector('[data-f="naam"]').value.trim(),soort:r.querySelector('[data-f="soort"]').value,tekst:r.querySelector('[data-f="tekst"]').value.trim()})});
  i.vragen=$$('#meVragen .mevraag').map(r=>{const k=r.dataset.k,g=r.querySelector('input[name="meG'+k+'"]:checked');return{v:r.querySelector('[data-f="v"]').value.trim(),o:[0,1,2,3].map(j=>r.querySelector('[data-f="o'+j+'"]').value.trim()),g:g?+g.value:0,u:r.querySelector('[data-f="u"]').value.trim()}});return m}
function meCheck(m){if(!m.titel)return'Geef de module een titel.';const vs=m.inhoud.vragen||[];
  for(let k=0;k<vs.length;k++){const q=vs[k];if(!q.v&&!q.o.some(Boolean))continue;if(!q.v)return'Vraag '+(k+1)+' heeft nog geen tekst.';if(q.o.filter(Boolean).length<2)return'Vraag '+(k+1)+' heeft minstens twee antwoorden nodig.';if(!q.o[q.g])return'Bij vraag '+(k+1)+' is het goede antwoord leeg.'}
  if(m.soort==='vaargebied'&&(m.inhoud.punten||[]).some(p=>!p.naam))return'Geef elk punt op de kaart een naam.';return''}
async function meOpslaan(){const m=meLees(),st=ME.st;const fout=meCheck(m);if(fout){toast(fout,true);return}
  const inh=Object.assign({},m.inhoud,{vragen:(m.inhoud.vragen||[]).filter(q=>q.v)});const mods=(APP.meMods||{})[st]||[];
  const row={titel:m.titel,inhoud:inh,bijgewerkt:nowIso()};const res=m.id?await APP.sb.from('leermodules').update(row).eq('id',m.id):await APP.sb.from('leermodules').insert(Object.assign(row,{gebied:st,soort:m.soort,actief:false,volgorde:(mods.length?Math.max(...mods.map(x=>x.volgorde||0)):0)+10}));
  if(res.error){toast(foutTekst(res.error,'Opslaan'),true);return}ME.edit=null;await meLoad(st);toast('Module '+m.titel+' opgeslagen'+(m.id?'':' als concept'));if(APP.sjTerug&&SJ.edit){APP.sjTerug=false;APP.gbTab='sjablonen'}renderGebiedBouwer()}
async function meWissel(k,d){const st=ME.st,mods=APP.meMods[st],a=mods[k],b=mods[k+d];if(!a||!b)return;const va=a.volgorde,vb=b.volgorde===va?va+d:b.volgorde;
  const r1=await APP.sb.from('leermodules').update({volgorde:vb}).eq('id',a.id),r2=await APP.sb.from('leermodules').update({volgorde:va}).eq('id',b.id);if(r1.error||r2.error){toast('Verplaatsen is mislukt',true)}await meLoad(st);renderGebiedBouwer()}
function meKaartKlik(e){const svg=e.target.closest('svg[data-medit]');if(!svg||!ME.edit)return;const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const c=pt.matrixTransform(svg.getScreenCTM().inverse());meLees();
  ME.edit.inhoud.punten.push({id:'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,4),naam:'',soort:'aandacht',x:Math.round(c.x),y:Math.round(-c.y),tekst:''});renderGebiedBouwer();const ins=$$('#mePunten [data-f="naam"]');if(ins.length)ins[ins.length-1].focus()}
$('#dash').addEventListener('click',async e=>{if(!gbPagina()||APP.gbTab!=='modules')return;if(e.target.closest('svg[data-medit]')){meKaartKlik(e);return}
  const b=e.target.closest('[data-me]');if(!b)return;const a=b.dataset.me,st=ME.st,mods=(APP.meMods||{})[st]||[],k=+b.dataset.k,m=mods[k];
  if(a==='nieuw'){ME.edit=meNieuw(b.dataset.soort);renderGebiedBouwer();const t=$('#meTitel');if(t)t.focus()}
  else if(a==='bewerk'&&m){ME.edit=JSON.parse(JSON.stringify(m));ME.edit.inhoud=Object.assign(meNieuw(m.soort).inhoud,ME.edit.inhoud||{});renderGebiedBouwer()}
  else if(a==='annuleer'){ME.edit=null;renderGebiedBouwer()}
  else if(a==='opslaan')meOpslaan();
  else if(a==='sectie-nieuw'){meLees().inhoud.secties.push({kop:'',tekst:''});renderGebiedBouwer()}
  else if(a==='sectie-weg'){meLees().inhoud.secties.splice(k,1);renderGebiedBouwer()}
  else if(a==='vraag-nieuw'){meLees().inhoud.vragen.push({v:'',o:['','','',''],g:0,u:''});renderGebiedBouwer();const q=$$('#meVragen [data-f="v"]');if(q.length)q[q.length-1].focus()}
  else if(a==='vraag-weg'){meLees().inhoud.vragen.splice(k,1);renderGebiedBouwer()}
  else if(a==='punt-weg'){meLees().inhoud.punten.splice(k,1);renderGebiedBouwer()}
  else if(a==='op'||a==='neer')meWissel(k,a==='op'?-1:1);
  else if(a==='actief'&&m){const {error}=await APP.sb.from('leermodules').update({actief:!m.actief,bijgewerkt:nowIso()}).eq('id',m.id);if(error){toast(foutTekst(error,'Opslaan'),true);return}toast(m.titel+(m.actief?' is weer een concept':' is actief voor kandidaten in '+(STAD_NAAM[st]||st)));await meLoad(st);renderGebiedBouwer()}
  else if(a==='weg'&&m){if(!(await confirmBox('Module verwijderen?','“'+m.titel+'” verdwijnt uit de leeromgeving van '+(STAD_NAAM[st]||st)+'. Dit kan niet ongedaan worden gemaakt.','Verwijderen')))return;const {error}=await APP.sb.from('leermodules').delete().eq('id',m.id);if(error){toast(foutTekst(error,'Verwijderen'),true);return}await meLoad(st);renderGebiedBouwer()}
  else if(a==='bekijk'&&ME.edit&&ME.edit.id){const id=ME.edit.id;openLeerPreview();await loadModules();modOpen(id)}});
$('#dash').addEventListener('change',e=>{if(!gbPagina()||APP.gbTab!=='modules')return;
  if(e.target.id==='meSt'){ME.st=e.target.value;ME.edit=null;renderGebiedBouwer()}
  else if(e.target.id==='meBrug'&&e.target.value!==''&&ME.edit){const br=BRIDGES[+e.target.value];if(br){meLees();ME.edit.inhoud.punten.push({id:'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,4),naam:br.nm,soort:'brug',x:br.x,y:br.y,tekst:''});renderGebiedBouwer()}}});
/* ---------- sjablonen voor de leeromgeving (migratie 018) ----------
   Een sjabloon hoort bij een vaargebied en bepaalt welke theoriehoofdstukken een kandidaat krijgt, in welke
   volgorde, en welke extra modules (tabel leermodules) ertussen staan. Alleen medewerkers beheren en wijzen toe.
   Welk sjabloon geldt: eigen sjabloon (leden.sjabloon_id) > groep (groepen.sjabloon_id) > standaard van het gebied > alle hoofdstukken. */
const SJ={st:null,edit:null};
const SJ_ALLE='Alle hoofdstukken (Flagship-standaard)';
APP.sj=null;APP.sjAll=[];APP.sjDb=true;
const sjNieuwId=()=>(window.crypto&&crypto.randomUUID)?crypto.randomUUID():'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(c^Math.random()*16>>c/4).toString(16));
function sjVan(r,sjs,groepen){if(!r)return null;sjs=sjs||APP.sjAll||[];groepen=groepen||APP.groepen||[];const by=id=>id?sjs.find(s=>s.id===id):null;const g=groepen.find(x=>x.id===r.groep_id);
  return by(r.sjabloon_id)||by(g&&g.sjabloon_id)||sjs.find(s=>s.standaard&&s.gebied===(r.stad||'amsterdam'))||null}
function sjHoofdstukken(tpl){if(!tpl)return LEER_ALL;const a=(tpl.items||[]).filter(i=>i&&i.t==='h').map(i=>LEER_ALL.find(c=>c.id===i.id)).filter(Boolean);return a.length?a:LEER_ALL}
function sjToepassen(tpl){APP.sj=tpl||null;LEER=sjHoofdstukken(tpl)}
function sjModulesFilter(){if(!APP.sj)return;const all=APP.modules||[];APP.modules=(APP.sj.items||[]).filter(i=>i&&i.t==='m').map(i=>all.find(m=>m.id===i.id)).filter(Boolean)}
/* kandidaat: sjabloon ophalen en toepassen (zonder database-update 018: alle hoofdstukken, zoals voorheen) */
async function sjLaadKandidaat(){sjToepassen(null);if(!APP.sb||!APP.lid)return;
  try{const {data,error}=await APP.sb.from('leer_sjablonen').select('*').eq('gebied',APP.lid.stad||'amsterdam');if(error)return;let sjs=data||[];
    const g=(APP.groepen||[]).find(x=>x.id===APP.lid.groep_id);
    for(const id of [APP.lid.sjabloon_id,g&&g.sjabloon_id]){if(id&&!sjs.find(s=>s.id===id)){const r=await APP.sb.from('leer_sjablonen').select('*').eq('id',id).maybeSingle();if(r.data)sjs=sjs.concat([r.data])}}
    sjToepassen(sjVan(APP.lid,sjs,APP.groepen));sjModulesFilter()}catch(e){}}
/* medewerkers en leermeesters: alle sjablonen (voor het overzicht en de theorie-voortgang per kandidaat) */
async function sjLaadAlles(){APP.sjAll=[];if(!APP.sb||!(APP.isStaff||APP.isLm))return;const {data,error}=await APP.sb.from('leer_sjablonen').select('*');APP.sjDb=!(error&&dbOntbreekt(error));if(!error)APP.sjAll=(data||[]).sort((a,b)=>(b.standaard-a.standaard)||String(a.naam).localeCompare(b.naam))}
/* het leerpad: hoofdstukken en extra modules in de volgorde van het sjabloon */
function sjPad(){const hs=LEER.map((c,i)=>({t:'h',c,i}));if(!APP.sj)return hs;const out=[];
  (APP.sj.items||[]).forEach(it=>{if(it.t==='h'){const i=LEER.findIndex(c=>c.id===it.id);if(i>=0)out.push({t:'h',c:LEER[i],i})}else if(it.t==='m'){const m=(APP.modules||[]).find(x=>x.id===it.id);if(m)out.push({t:'m',m})}});
  return out.some(x=>x.t==='h')?out:hs.concat(out)}
function sjModNode(m){return'<li class="lnode open sjextra"><span class="dot" aria-hidden="true">+</span><div class="lcard"><div class="lcard-t"><small>Extra'+(m.actief?'':' · concept')+'</small><b>'+esc(m.titel)+'</b><span>'+esc(MOD_SOORT[m.soort]||'')+'</span>'+modMeta(m)+'</div><div class="lcard-a"><button type="button" class="btn sm" data-lact="mod" data-id="'+esc(m.id)+'">Openen</button></div></div></li>'}
const sjNaam=t=>t?t.naam:SJ_ALLE;
const sjItemNaam=(it,mods)=>{if(it.t==='h'){const i=LEER_ALL.findIndex(c=>c.id===it.id);return i<0?null:'Hoofdstuk '+(i+1)+' · '+LEER_ALL[i].t}const m=(mods||[]).find(x=>x.id===it.id);return m?'Extra · '+m.titel:null};
const sjSamenvatting=(t,mods)=>{const it=(t.items||[]).filter(i=>sjItemNaam(i,mods));const h=it.filter(i=>i.t==='h').length,m=it.length-h;return h+' hoofdstuk'+(h===1?'':'ken')+(m?' + '+m+' extra':'')};

