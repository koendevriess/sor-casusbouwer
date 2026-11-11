/* ---------- Extra gebied (alleen medewerkers): nieuw vaargebied uit OpenStreetMap ---------- */
/* openbare Overpass-servers (getest 16 okt 2026 vanuit een browser: FOSSGIS gaf het volledige antwoord, Kumi alleen bij kleine verzoeken) */
const OSM_EPS=[['Overpass (FOSSGIS)','https://overpass-api.de/api/interpreter'],['Kumi Systems','https://overpass.kumi.systems/api/interpreter'],['Private.coffee','https://overpass.private.coffee/api/interpreter']];
const GB_MATEN=[['2','2 × 2 km',1000,1000],['3','3 × 3 km',1500,1500],['4','4 × 3,4 km (maximaal)',2000,1700]];
/* projectie rond het midden van het kader (zelfde formules als de vaste gebieden) */
function gbProj(lat,lon){const f=lat*Math.PI/180;return[+lat.toFixed(4),+lon.toFixed(4),Math.round(111412.84*Math.cos(f)-93.5*Math.cos(3*f)),Math.round(111132.954-559.822*Math.cos(2*f)+1.175*Math.cos(4*f))]}
/* omzetten van OpenStreetMap-gegevens naar het compacte kaartformaat van de casusbouwer (zelfde als de vaste gebieden) */
function osmVerwerk(proj,IX,IY){const LAT0=proj[0],LON0=proj[1],KX=proj[2],KY=proj[3];
const P=g=>[Math.round((g.lon-LON0)*KX),Math.round((g.lat-LAT0)*KY)];
const dedup=pts=>pts.filter((p,i)=>i===0||p[0]!==pts[i-1][0]||p[1]!==pts[i-1][1]);
function dp(pts,tol){if(pts.length<3)return pts;const keep=new Uint8Array(pts.length);keep[0]=keep[pts.length-1]=1;const st=[[0,pts.length-1]];while(st.length){const [a,b]=st.pop();let md=0,mi=-1;const [x1,y1]=pts[a],[x2,y2]=pts[b];const L=Math.hypot(x2-x1,y2-y1);for(let i=a+1;i<b;i++){const d=L?Math.abs((x2-x1)*(y1-pts[i][1])-(x1-pts[i][0])*(y2-y1))/L:Math.hypot(pts[i][0]-x1,pts[i][1]-y1);if(d>md){md=d;mi=i}}if(md>tol){keep[mi]=1;st.push([a,mi],[mi,b])}}return pts.filter((p,i)=>keep[i])}
function dpRing(r,tol){r=dedup(r);if(r.length<4)return r;let far=0,fd=-1;for(let i=1;i<r.length;i++){const d=Math.hypot(r[i][0]-r[0][0],r[i][1]-r[0][1]);if(d>fd){fd=d;far=i}}const a=dp(r.slice(0,far+1),tol),b=dp(r.slice(far),tol);return a.concat(b.slice(1))}
const enc=pts=>{const o=[pts[0][0],pts[0][1]];for(let i=1;i<pts.length;i++)o.push(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);return o.join(',')};
const len=pts=>{let s=0;for(let i=1;i<pts.length;i++)s+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);return s};
function pip(p,ring){let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c}return c}
function assemble(ways){const segs=ways.map(w=>dedup(w.map(P)));const out=[];while(segs.length){let r=segs.shift();let guard=0;while((r[0][0]!==r[r.length-1][0]||r[0][1]!==r[r.length-1][1])&&guard++<500){const end=r[r.length-1];const k=segs.findIndex(s=>(s[0][0]===end[0]&&s[0][1]===end[1])||(s[s.length-1][0]===end[0]&&s[s.length-1][1]===end[1]));if(k<0)break;let s=segs.splice(k,1)[0];if(s[0][0]!==end[0]||s[0][1]!==end[1])s=s.slice().reverse();r=r.concat(s.slice(1))}if(r.length>3)out.push(dpRing(r,0.8))}return out}
function inter(a,b,c,d){const r=[b[0]-a[0],b[1]-a[1]],s=[d[0]-c[0],d[1]-c[1]];const den=r[0]*s[1]-r[1]*s[0];if(!den)return null;const t=((c[0]-a[0])*s[1]-(c[1]-a[1])*s[0])/den,u=((c[0]-a[0])*r[1]-(c[1]-a[1])*r[0])/den;return(t>=0&&t<=1&&u>=0&&u<=1)?[a[0]+t*r[0],a[1]+t*r[1]]:null}
const num=v=>{const f=parseFloat(String(v||'').replace(',','.'));return isFinite(f)?f:0};
function process(Wd,Bd,Sd){
  const NAMES=[],NI=new Map();const ni=n=>{if(!n)return -1;if(!NI.has(n)){NI.set(n,NAMES.length);NAMES.push(n)}return NI.get(n)};
  const W=Wd.elements;const wws=W.filter(e=>e.type==='way'&&e.tags&&/^(canal|river|fairway)$/.test(e.tags.waterway));
  const WAYS=[],WSEG=[];
  wws.forEach(e=>{const pts=dedup(e.geometry.map(P));if(pts.length<2)return;const t=e.tags;const o=t.oneway==='yes'?1:t.oneway==='-1'?-1:0;const n=ni(t.name);WAYS.push(n+':'+o+':c:'+num(t.maxwidth)+':'+num(t.maxlength)+':'+num(t.maxdraught||t.maxdraft)+':/'+enc(pts));for(let i=1;i<pts.length;i++)WSEG.push([pts[i-1],pts[i]])});
  const rings=[];
  W.filter(e=>e.type==='way'&&e.tags&&(e.tags.natural==='water'||/riverbank|dock/.test(e.tags.waterway||''))).forEach(e=>{const g=e.geometry;if(g&&g.length>3&&g[0].lat===g[g.length-1].lat&&g[0].lon===g[g.length-1].lon)rings.push({outer:dpRing(g.map(P),0.8),inner:[]})});
  W.filter(e=>e.type==='relation').forEach(e=>{const outers=assemble(e.members.filter(m=>m.type==='way'&&m.role!=='inner'&&m.geometry).map(m=>m.geometry));const inners=assemble(e.members.filter(m=>m.type==='way'&&m.role==='inner'&&m.geometry).map(m=>m.geometry));outers.forEach(o=>rings.push({outer:o,inner:inners.filter(i=>pip(i[0],o))}))});
  const WATER=rings.filter(r=>r.outer.length>3).map(r=>[r.outer].concat(r.inner).map(enc).join('|'));
  const BE=Bd.elements;const mm=BE.filter(e=>e.tags&&e.tags.man_made==='bridge'&&e.geometry).map(e=>({nm:e.tags.name||'',ring:e.geometry.map(P)}));
  const FOOT=/^(footway|cycleway|path|pedestrian|steps|bridleway)$/;const cand=[];
  BE.filter(e=>e.tags&&e.tags.bridge&&e.tags.bridge!=='no'&&(e.tags.highway||e.tags.railway)&&e.geometry).forEach(e=>{const pts=e.geometry.map(P);let hit=null;for(let i=1;i<pts.length&&!hit;i++)for(const s of WSEG){const q=inter(pts[i-1],pts[i],s[0],s[1]);if(q){hit=q;break}}if(!hit)return;const t=e.tags;let nm=t['bridge:name']||'';if(!nm&&t.name&&/brug|bridge|sluis|viaduct/i.test(t.name))nm=t.name;if(!nm){const m=mm.find(m=>m.nm&&m.ring.length>3&&pip(hit,m.ring));if(m)nm=m.nm}const st=(t.name&&t.name!==nm)?t.name:'';const k=t.railway?2:FOOT.test(t.highway)?1:0;const mv=(t.bridge==='movable'||t['bridge:movable'])?1:0;cand.push({x:Math.round(hit[0]),y:Math.round(hit[1]),nm,ref:t['bridge:ref']||'',st,k,mv})});
  const BR=[];cand.sort((a,b)=>(b.nm?1:0)-(a.nm?1:0)||a.k-b.k).forEach(c=>{const o=BR.find(b=>Math.hypot(b.x-c.x,b.y-c.y)<14);if(o){if(!o.st&&c.st)o.st=c.st;if(!o.nm&&c.nm)o.nm=c.nm;if(c.mv)o.mv=1;return}BR.push(c)});
  const LAB=[];wws.forEach(e=>{if(!e.tags.name)return;const pts=dedup(e.geometry.map(P));let best=null;for(let i=1;i<pts.length;i++){const d=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);if(!best||d>best.d)best={d,a:pts[i-1],b:pts[i]}}if(!best||best.d<40)return;let ang=Math.atan2(best.b[1]-best.a[1],best.b[0]-best.a[0])*180/Math.PI;if(ang>90)ang-=180;if(ang<-90)ang+=180;LAB.push({n:ni(e.tags.name),x:Math.round((best.a[0]+best.b[0])/2),y:Math.round((best.a[1]+best.b[1])/2),a:Math.round(ang),t:Math.round(best.d)})});
  LAB.sort((p,q)=>q.t-p.t);const LK=[];LAB.forEach(l=>{if(LK.some(k=>k.n===l.n&&Math.hypot(k.x-l.x,k.y-l.y)<350))return;LK.push(l)});
  const SN=[],SNI=new Map();const sni=n=>{if(!n)return '';if(!SNI.has(n)){SNI.set(n,SN.length);SN.push(n)}return SNI.get(n)};
  const CL=h=>/^(primary|trunk|primary_link)$/.test(h)?4:/^secondary/.test(h)?3:/^tertiary/.test(h)?2:h==='pedestrian'?1:0;
  const inb=p=>p[0]>-IX&&p[0]<IX&&p[1]>-IY&&p[1]<IY;
  const LINES=Sd.elements.filter(e=>e.geometry).map(e=>{let pts=dedup(e.geometry.map(P));if(!pts.some(inb))return null;pts=dp(pts,1.5);if(pts.length<2)return null;if(!e.tags.name&&len(pts)<20)return null;return CL(e.tags.highway)+':'+sni(e.tags.name)+'/'+enc(pts)}).filter(Boolean);
  return {data:{names:NAMES.join('~'),labels:LK.map(l=>[l.n,l.x,l.y,l.a,l.t].join(',')).join(';'),bridges:BR.map(b=>[b.x,b.y,b.nm,b.ref,b.st,b.k,b.mv].join('~')).join(';'),ways:WAYS.join(';'),water:WATER.join(';')},streets:{names:SN.join('~'),lines:LINES.join(';')},op:new Date().toISOString()};
}
return process}
const gbSlug=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').replace(/^[^a-z]+/,'').slice(0,31);
function gbStaat(){if(!APP.gb)APP.gb={stap:1,zoek:'',res:[],sel:null,maat:'3',kaart:null,pois:[],form:{}};return APP.gb}
function renderGebiedBouwer(){const G=gbStaat(),gs=(APP.gebieden||[]);const kand=st=>APP.roster.filter(r=>r.rol==='kandidaat'&&(r.stad||'amsterdam')===st).length;
  const leer=APP.dashView==='leeromgeving';let tab=APP.gbTab||'gebieden';if(leer&&!['sjablonen','modules','trainingen'].includes(tab))tab=APP.gbTab='sjablonen';if(!leer&&!['gebieden','nieuw'].includes(tab))tab=APP.gbTab='gebieden';if(tab!=='nieuw'&&APP.gbMap){try{APP.gbMap.remove()}catch(e){}APP.gbMap=null}
  let h='<div class="dash-in gb"><div class="row" style="justify-content:space-between;align-items:flex-end"><div><div class="eyebrow">Medewerkers</div><h1 class="pagetitle">'+(leer?'Leeromgeving':'Vaargebieden')+'</h1></div></div>';
  h+='<div class="tabs" role="tablist">'+(leer?[['sjablonen','Sjablonen per vaargebied'],['modules','Leermodules'],['trainingen','Interne trainingen']]:[['gebieden','Alle vaargebieden'],['nieuw','+ Extra gebied']]).map(x=>'<button type="button" role="tab" aria-selected="'+(tab===x[0])+'" class="chip'+(tab===x[0]?' on':'')+'" data-gbtab="'+x[0]+'">'+x[1]+'</button>').join('')+'</div>';
  if(tab==='modules'){$('#dash').innerHTML=h+'<section class="lsec" id="meSec">'+meView()+'</section></div>';return}
  if(tab==='sjablonen'){$('#dash').innerHTML=h+'<section class="lsec" id="sjSec">'+sjView()+'</section></div>';return}
  if(tab==='trainingen'){$('#dash').innerHTML=h+'<section class="lsec" id="trSec">'+trBeheer()+'</section></div>';return}
  if(tab==='gebieden')h+='<section class="lsec"><div class="lsec-h"><h2>Alle vaargebieden</h2></div>'+(gs.length?'<div class="tbl-wrap"><table class="tbl dtbl"><thead><tr><th>Vaargebied</th><th>Adres</th><th>Status</th><th>Kandidaten</th><th></th></tr></thead><tbody>'+gs.map(g=>'<tr><td class="c-person"><b>'+esc(g.naam)+'</b></td><td data-l="Adres"><a href="'+esc(cityUrl(g.slug))+'" target="_blank" rel="noopener">/'+esc(g.slug)+'/</a></td><td data-l="Status">'+(g.ingebouwd?'<span class="pill unk">Vast</span>':g.actief?'<span class="pill ok">Actief</span>':'<span class="pill warn">Concept</span>')+'</td><td data-l="Kandidaten">'+kand(g.slug)+'</td><td class="c-act"><div class="acts">'+(g.ingebouwd?'':(g.actief?'<button type="button" class="btn sm" data-gb="uit" data-slug="'+esc(g.slug)+'">Deactiveren</button>':'<button type="button" class="btn sm primary" data-gb="aan" data-slug="'+esc(g.slug)+'">Activeren</button>')+'<button type="button" class="btn sm danger" data-gb="weg" data-slug="'+esc(g.slug)+'">Verwijderen</button>')+'</div></td></tr>').join('')+'</tbody></table></div>':'<p class="note">De vaargebieden konden niet worden geladen. De database moet eerst worden bijgewerkt (migratie 015).</p>')+'</section>';
  if(tab==='gebieden'){$('#dash').innerHTML=h+'</div>';return}
  h+='<section class="lsec" id="gbNieuw"><div class="lsec-h"><h2>Nieuw vaargebied</h2><span class="pill acc">Stap '+G.stap+' van 3</span></div>';
  if(!gs.length)h+='<p class="note warn">De database is nog niet bijgewerkt (database-update 015). Je kunt een gebied al wel opzoeken en ophalen, maar opslaan lukt pas na de update.</p>';
  if(G.stap===1){h+='<p class="note">Zoek de plaats, en schuif de kaart zo dat de route binnen het oranje kader valt. De vaarwegen, bruggen en straten in het kader worden uit OpenStreetMap gehaald.</p>'+
    '<form class="row gbzoek" data-gbform="zoek" style="gap:8px;flex-wrap:wrap"><label class="sr" for="gbZoek">Plaats zoeken</label><input id="gbZoek" type="search" autocomplete="off" placeholder="Bijvoorbeeld Leiden of Delft centrum" value="'+esc(G.zoek)+'" style="flex:1;min-width:220px"><button type="submit" class="btn">Zoeken</button>'+
    '<label class="sr" for="gbMaat">Grootte van het kader</label><select id="gbMaat">'+GB_MATEN.map(m=>'<option value="'+m[0]+'"'+(G.maat===m[0]?' selected':'')+'>'+m[1]+'</option>').join('')+'</select></form>'+
    (G.res.length?'<div class="gbres" role="list">'+G.res.map((r,i)=>'<button type="button" class="chip'+(G.sel&&G.sel.i===i?' on':'')+'" role="listitem" data-gb="kies" data-i="'+i+'">'+esc(r.display_name.split(',').slice(0,3).join(','))+'</button>').join('')+'</div>':'')+
    '<div id="gbMap" class="gbmap" aria-label="Kaart om het vaargebied te kiezen"></div><div class="row" style="gap:8px;margin-top:10px"><button type="button" class="btn primary" data-gb="ophalen"'+(G.sel?'':' disabled')+'>Kaartgegevens ophalen</button><span class="note" id="gbMsg" role="status" aria-live="polite">'+(G.sel?'':'Zoek eerst een plaats.')+'</span></div>'}
  else if(G.stap===2){const k=G.kaart,f=G.form;
    h+='<div class="gbsam"><div class="gbprev">'+gbPreview(k)+'</div><div><p><b>'+k.n.vaarwegen+'</b> vaarwegen · <b>'+k.n.bruggen+'</b> bruggen · <b>'+k.n.straten+'</b> straten</p>'+(k.n.vaarwegen?'':'<p class="note warn">Er zijn geen vaarwegen gevonden in dit kader. Kies een ander kader.</p>')+(k.zonderStraten?'<p class="note warn">De straten konden niet worden opgehaald (server te druk). Je kunt zo opslaan; straatnamen ontbreken dan op de kaart. Of kies Ander kader kiezen en probeer het later opnieuw.</p>':'')+'<button type="button" class="btn sm ghost" data-gb="terug">← Ander kader kiezen</button></div></div>'+
    '<div id="gbForm"><div class="grid2"><div class="field"><label for="gbNaam">Naam</label><input id="gbNaam" type="text" maxlength="60" value="'+esc(f.naam||'')+'"></div><div class="field"><label for="gbSlug">Adres</label><div class="row" style="gap:6px;flex-wrap:nowrap;align-items:center"><span class="note" style="margin:0;white-space:nowrap">'+esc(ROOT().replace(/^https?:\/\//,''))+'</span><input id="gbSlug" type="text" maxlength="31" value="'+esc(f.slug||'')+'" pattern="[a-z][a-z0-9-]{1,30}"><span class="note" style="margin:0">/</span></div><small class="note">Kleine letters, cijfers en streepjes.</small></div>'+
    '<div class="field"><label for="gbSnel">Vaarsnelheid (km/u)</label><input id="gbSnel" type="number" min="1" max="20" step="0.5" value="'+esc(String(f.snelheid||6))+'"></div><div class="field"><label for="gbOpstap">Voorbeeld opstaplocatie</label><input id="gbOpstap" type="text" maxlength="80" placeholder="Bijvoorbeeld Steenschuur, bij de brug" value="'+esc(f.opstap||'')+'"></div></div>'+
    '<div class="field"><label for="gbVb">Korte omschrijving voor de voorbeeldcasus</label><input id="gbVb" type="text" maxlength="140" placeholder="Bijvoorbeeld Route over de Oude Rijn en de singels." value="'+esc(f.vb||'')+'"></div>'+
    '<fieldset class="gbopts"><legend>Opdrachten in de casus</legend>'+[['gbBh','bh','Brughoogtes invullen (streefpeil en doorvaarthoogte per brug)',f.bh!==false],['gbBez3','bez3','Precies drie bezienswaardigheden beschrijven',f.bez3!==false],['gbMarifoon','marifoon','Marifoon (kanalen en meldpunten)',!!f.marifoon],['gbToel','toel','Geen meetpunt voor de waterstand: toelichting verplicht',!!f.toel]].map(o=>'<label class="kopt"><input type="checkbox" id="'+o[0]+'"'+(o[3]?' checked':'')+'> <span>'+o[2]+'</span></label>').join('')+'</fieldset>'+
    '<fieldset class="gbopts"><legend>Plaatsen op de kaart (oriëntatie, maximaal 12)</legend>'+(G.pois.length?'<div class="gbpois">'+G.pois.map((p,i)=>'<label class="kopt"><input type="checkbox" data-poi="'+i+'"'+(p.aan?' checked':'')+'> <span>'+esc(p.n)+'</span></label>').join('')+'</div>':'<p class="note">Geen bekende plaatsen gevonden.</p>')+'</fieldset>'+
    '<div class="row" style="gap:8px"><button type="button" class="btn primary" data-gb="opslaan"'+(k.n.vaarwegen?'':' disabled')+'>Opslaan als concept</button><span class="note">Een concept is alleen zichtbaar voor medewerkers. Activeer het gebied pas als de casusbouwer klopt.</span></div></div>'}
  else{const g=gs.find(x=>x.slug===G.klaar)||{slug:G.klaar,naam:G.klaar};
    h+='<div class="okbox"><p><b>'+esc(g.naam)+' is opgeslagen als concept.</b></p><ol><li>Open de proefversie en controleer de kaart, de bruggen en de opdrachten.</li><li>Klopt alles? Activeer het gebied bij Alle vaargebieden. Daarna kun je kandidaten toevoegen aan '+esc(g.naam)+'.</li><li>Termijnen en eigen stappen stel je in bij Voortgang. Leermodules maak je bij Leeromgeving per gebied.</li></ol><div class="row" style="gap:8px"><a class="btn primary" href="'+esc(cityUrl(g.slug))+'" target="_blank" rel="noopener">Proefversie openen</a><button type="button" class="btn" data-gb="opnieuw">Nog een gebied toevoegen</button></div></div>'}
  $('#dash').innerHTML=h+'</section></div>';if(G.stap===1)gbMapInit()}
function gbPreview(k){const d=k.data,b=k.half;const W=b[0]*2,H=b[1]*2;let p='';
  const dec=s=>{const a=s.split(',').map(Number),o=[[a[0],a[1]]];for(let i=2;i<a.length;i+=2)o.push([o[o.length-1][0]+a[i],o[o.length-1][1]+a[i+1]]);return o};
  const path=pts=>'M'+pts.map(q=>(q[0]+b[0]).toFixed(0)+' '+(b[1]-q[1]).toFixed(0)).join('L');
  (d.water?d.water.split(';'):[]).forEach(w=>{if(w)p+='<path d="'+w.split('|').map(r=>path(dec(r))+'Z').join('')+'" fill="#bcdcf2" fill-rule="evenodd"/>'});
  (d.ways?d.ways.split(';'):[]).forEach(w=>{const i=w.indexOf('/');if(i>0)p+='<path d="'+path(dec(w.slice(i+1)))+'" fill="none" stroke="#2f7fc1" stroke-width="'+(W/220).toFixed(1)+'"/>'});
  (d.bridges?d.bridges.split(';'):[]).forEach(x=>{const f=x.split('~');if(f.length>1)p+='<circle cx="'+(+f[0]+b[0])+'" cy="'+(b[1]-f[1])+'" r="'+(W/140).toFixed(1)+'" fill="#fa7c00"/>'});
  return'<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Voorbeeld van de opgehaalde kaart: water en vaarwegen in blauw, bruggen in oranje"><rect width="'+W+'" height="'+H+'" fill="#f4f7fa"/>'+p+'</svg>'}
function gbMapInit(){const G=gbStaat(),el=$('#gbMap');if(!el||typeof L==='undefined')return;if(APP.gbMap){try{APP.gbMap.remove()}catch(e){}APP.gbMap=null}
  const c=G.sel?[G.sel.lat,G.sel.lon]:[52.16,5.3],m=L.map(el,{zoomControl:true,attributionControl:true}).setView(c,G.sel?14:7);APP.gbMap=m;
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap-bijdragers'}).addTo(m);
  const kader=()=>{const mt=GB_MATEN.find(x=>x[0]===G.maat)||GB_MATEN[1],ce=m.getCenter(),pr=gbProj(ce.lat,ce.lng);return L.latLngBounds([ce.lat-mt[3]/pr[3],ce.lng-mt[2]/pr[2]],[ce.lat+mt[3]/pr[3],ce.lng+mt[2]/pr[2]])};
  const r=L.rectangle(kader(),{color:'#fa7c00',weight:3,fill:false,interactive:false}).addTo(m);
  m.on('move zoom',()=>r.setBounds(kader()));m.on('moveend',()=>{if(G.sel){const ce=m.getCenter();G.sel.lat=ce.lat;G.sel.lon=ce.lng}});setTimeout(()=>m.invalidateSize(),50)}
/* één verzoek bij de servers op volgorde; elke server krijgt 2,5 minuut. Een fout zonder antwoord (vaak drukte) heet 'geen antwoord'. */
async function gbOverpass(q,label){const fouten=[];for(const [naam,ep] of OSM_EPS){const ac=new AbortController(),tm=setTimeout(()=>ac.abort(),150000);
    try{gbMsg(label+' bij '+naam+'… dit kan een minuut duren.');const r=await fetch(ep,{method:'POST',body:new URLSearchParams({data:q}),signal:ac.signal});
      if(r.ok){const j=await r.json();if(j&&Array.isArray(j.elements)&&!(j.remark&&/runtime error|timed out|out of memory/i.test(j.remark)))return j;fouten.push(naam+': '+(j&&j.remark?'server stopte (te veel gegevens)':'leeg antwoord'))}
      else fouten.push(naam+': '+(r.status===429||r.status===406?'te druk':r.status===504?'time-out':'HTTP '+r.status))}
    catch(e){fouten.push(naam+': '+(e&&e.name==='AbortError'?'geen antwoord binnen 2,5 minuut':'geen antwoord'))}finally{clearTimeout(tm)}}
  const err=new Error(fouten.join(' · '));throw err}
async function gbWacht(s,t){for(;s>0;s--){gbMsg(t+' Nieuwe poging over '+s+' seconden…');await new Promise(x=>setTimeout(x,1000))}}
const gbMsg=t=>{const el=$('#gbMsg');if(el)el.textContent=t};
async function gbOphalen(){const G=gbStaat();if(!G.sel)return;const mt=GB_MATEN.find(x=>x[0]===G.maat)||GB_MATEN[1],pr=gbProj(G.sel.lat,G.sel.lon);
  const s=pr[0]-mt[3]/pr[3],w=pr[1]-mt[2]/pr[2],n=pr[0]+mt[3]/pr[3],e=pr[1]+mt[2]/pr[2],BB=[s,w,n,e].map(x=>x.toFixed(5)).join(',');
  const btn=$('[data-gb="ophalen"]');if(btn)btn.disabled=true;
  try{const PAT='residential|living_street|unclassified|pedestrian|tertiary|secondary|primary|trunk|tertiary_link|secondary_link|primary_link';
    const Q='[out:json][timeout:180][bbox:'+BB+'];(way[waterway~"^(canal|river|fairway)$"];way[natural=water];rel[natural=water];way[waterway=riverbank];way[waterway=dock];way[bridge][highway];way[bridge][railway];way["man_made"="bridge"];way[highway~"^('+PAT+')$"];);out geom;'+
      '(nwr[name][tourism~"^(attraction|museum|viewpoint|gallery)$"];nwr[name][historic~"^(monument|castle|church|city_gate|building|memorial)$"];nwr[name][amenity=place_of_worship][building];node[name][railway=station];nwr[name][amenity=townhall];);out center 80;';
    const QW='[out:json][timeout:180][bbox:'+BB+'];(way[waterway~"^(canal|river|fairway)$"];way[natural=water];rel[natural=water];way[waterway=riverbank];way[waterway=dock];way[bridge][highway];way[bridge][railway];way["man_made"="bridge"];);out geom;'+Q.slice(Q.indexOf('out geom;')+9);
    const QS='[out:json][timeout:180][bbox:'+BB+'];way[highway~"^('+PAT+')$"];out geom;';
    /* eerst alles in één keer; lukt dat niet, dan na een pauze in twee kleinere delen (straten mogen ontbreken) */
    let all=null,zonderStraten=false;try{all=(await gbOverpass(Q,'Kaartgegevens ophalen')).elements||[]}catch(e1){
      await gbWacht(30,'De kaartservers zijn druk. We proberen het in twee kleinere delen.');
      all=(await gbOverpass(QW,'Vaarwegen en bruggen ophalen (1/2)')).elements||[];
      try{all=all.concat((await gbOverpass(QS,'Straten ophalen (2/2)')).elements||[])}catch(e2){zonderStraten=true}}
    const tg=e=>e.tags||{},geo=e=>!e.center&&e.type!=='node';
    const W={elements:all.filter(e=>geo(e)&&((e.type==='way'&&(/^(canal|river|fairway|riverbank|dock)$/.test(tg(e).waterway||'')||tg(e).natural==='water'))||(e.type==='relation'&&tg(e).natural==='water')))};
    const B={elements:all.filter(e=>geo(e)&&e.type==='way'&&((tg(e).bridge&&tg(e).bridge!=='no'&&(tg(e).highway||tg(e).railway))||tg(e).man_made==='bridge'))};
    const S={elements:all.filter(e=>geo(e)&&e.type==='way'&&new RegExp('^('+PAT+')$').test(tg(e).highway||''))};
    const Pq={elements:all.filter(e=>!geo(e)&&tg(e).name)};
    gbMsg('Kaart opbouwen…');let kaart;try{kaart=osmVerwerk(pr,mt[2]+100,mt[3]+100)(W,B,S)}catch(ve){gbMsg('De kaartgegevens zijn opgehaald, maar konden niet worden verwerkt ('+(ve&&ve.message||ve)+'). Kies een iets ander kader en probeer het opnieuw.');if(btn)btn.disabled=false;return}const d=kaart.data;
    const cnt=x=>x?x.split(';').filter(Boolean).length:0;
    G.kaart={data:d,streets:kaart.streets,op:kaart.op,proj:pr,half:[mt[2],mt[3]],bbox:[s,w,n,e],n:{vaarwegen:cnt(d.ways),bruggen:cnt(d.bridges),straten:cnt(kaart.streets.lines)},zonderStraten};
    const gezien=new Set();G.pois=(Pq.elements||[]).map(x=>({n:x.tags.name,lat:x.lat!=null?x.lat:x.center&&x.center.lat,lon:x.lon!=null?x.lon:x.center&&x.center.lon,w:(x.tags.wikidata||x.tags.wikipedia)?1:0,st:x.tags.railway==='station'?1:0})).filter(p=>p.n&&p.lat!=null&&!gezien.has(p.n)&&gezien.add(p.n)).sort((a,b)=>(b.st-a.st)||(b.w-a.w)||a.n.localeCompare(b.n)).slice(0,30);
    G.pois.forEach((p,i)=>p.aan=i<8);
    const nm=G.sel.naam||'';if(!G.form.naam)G.form={naam:nm,slug:gbSlug(nm),snelheid:6,bh:true,bez3:true};G.stap=2;renderGebiedBouwer()}
  catch(e){gbMsg('Ophalen is niet gelukt. De openbare kaartservers van OpenStreetMap zijn op dit moment te druk of niet bereikbaar ('+(e&&e.message||e)+'). Probeer het over een paar minuten opnieuw, of kies een kleiner kader.');if(btn)btn.disabled=false}}
function gbLeesForm(){const G=gbStaat(),f=G.form,v=id=>{const el=$('#'+id);return el?el.value:''},c=id=>{const el=$('#'+id);return!!(el&&el.checked)};if(!$('#gbForm'))return f;
  Object.assign(f,{naam:v('gbNaam').trim().replace(/\s+/g,' '),slug:v('gbSlug').trim().toLowerCase(),snelheid:Math.max(1,Math.min(20,parseFloat(String(v('gbSnel')).replace(',','.'))||6)),opstap:v('gbOpstap').trim(),vb:v('gbVb').trim(),bh:c('gbBh'),bez3:c('gbBez3'),marifoon:c('gbMarifoon'),toel:c('gbToel')});
  $$('#gbForm [data-poi]').forEach(x=>{const p=G.pois[+x.dataset.poi];if(p)p.aan=x.checked});return f}
async function gbOpslaan(){const G=gbStaat(),f=gbLeesForm(),k=G.kaart;if(!f.naam){toast('Geef het vaargebied een naam.',true);return}
  if(!/^[a-z][a-z0-9-]{1,30}$/.test(f.slug)){toast('Het adres mag alleen kleine letters, cijfers en streepjes bevatten en moet met een letter beginnen.',true);return}
  if(['assets','supabase','beta-utrecht','beta-groningen','index','404'].includes(f.slug)||(APP.gebieden||[]).some(g=>g.slug===f.slug)){toast('Het adres /'+f.slug+'/ is al in gebruik. Kies een ander adres.',true);return}
  const pois=G.pois.filter(p=>p.aan).slice(0,12).map(p=>[p.n,+(+p.lat).toFixed(5),+(+p.lon).toFixed(5)]);const mt=k.half;
  const row={slug:f.slug,naam:f.naam,actief:false,volgorde:100,instellingen:{proj:k.proj,bounds:[[-mt[0]-600,-mt[1]-600],[mt[0]+600,mt[1]+600]],bbox:k.bbox,pois,snelheid:f.snelheid,marifoon:f.marifoon,toel:f.toel,bh:f.bh,bez3:f.bez3,opstapPh:f.opstap?'Bijvoorbeeld '+f.opstap:'',vb:f.vb,bron:'OpenStreetMap',opgehaald:k.op},kaart:{data:k.data,streets:k.streets,op:k.op},traject:{}};
  const b=$('[data-gb="opslaan"]');if(b)b.disabled=true;const {error}=await APP.sb.from('gebieden').insert(row);if(b)b.disabled=false;
  if(error){toast(foutTekst(error,'Opslaan'),true);return}
  await loadGebieden();G.stap=3;G.klaar=f.slug;toast(f.naam+' opgeslagen als concept');renderGebiedBouwer()}
async function gbStatus(slug,aan){const g=(APP.gebieden||[]).find(x=>x.slug===slug);if(!g)return;
  if(!aan&&APP.roster.some(r=>r.rol==='kandidaat'&&r.stad===slug)&&!(await confirmBox(g.naam+' deactiveren?','Kandidaten in '+g.naam+' kunnen hun casusbouwer dan niet meer openen, totdat je het gebied weer activeert.','Deactiveren')))return;
  const {error}=await APP.sb.from('gebieden').update({actief:aan,bijgewerkt:nowIso()}).eq('slug',slug);if(error){toast(foutTekst(error,'Opslaan'),true);return}
  g.actief=aan;toast(g.naam+(aan?' is actief':' is gedeactiveerd'));renderGebiedBouwer()}
async function gbWeg(slug){const g=(APP.gebieden||[]).find(x=>x.slug===slug);if(!g||g.ingebouwd)return;const n=APP.roster.filter(r=>r.stad===slug).length;
  if(n){toast('In '+g.naam+' staan nog '+n+' mensen. Zet hen eerst in een ander vaargebied.',true);return}
  if((APP.groepen||[]).some(x=>x.stad===slug)){toast('Er zijn nog groepen in '+g.naam+'. Verwijder die eerst bij Voortgang.',true);return}
  if(!(await confirmBox(g.naam+' verwijderen?','De kaart, de instellingen en de leermodules van '+g.naam+' worden verwijderd. Dit kan niet ongedaan worden gemaakt.','Verwijderen')))return;
  const {error}=await APP.sb.from('gebieden').delete().eq('slug',slug);if(error){toast(foutTekst(error,'Verwijderen'),true);return}
  APP.gebieden=(APP.gebieden||[]).filter(x=>x.slug!==slug);const i=STADS.indexOf(slug);if(i>=0)STADS.splice(i,1);toast(g.naam+' verwijderd');renderGebiedBouwer()}
$('#dash').addEventListener('submit',async e=>{if(!gbPagina()||!e.target.matches('[data-gbform="zoek"]'))return;e.preventDefault();const G=gbStaat();G.zoek=$('#gbZoek').value.trim();if(!G.zoek)return;
  try{const r=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=nl&accept-language=nl&q='+encodeURIComponent(G.zoek));if(!r.ok)throw new Error('HTTP '+r.status);G.res=await r.json()}catch(err){G.res=[];toast('Zoeken is mislukt. Probeer het opnieuw.',true)}
  if(G.res.length){const x=G.res[0];G.sel={i:0,lat:+x.lat,lon:+x.lon,naam:x.name||x.display_name.split(',')[0]}}else toast('Geen plaats gevonden voor "'+G.zoek+'".',true);renderGebiedBouwer()});
$('#dash').addEventListener('change',e=>{if(!gbPagina())return;if(e.target.id==='gbMaat'){gbStaat().maat=e.target.value;if(APP.gbMap)APP.gbMap.fire('move')}
  else if(e.target.id==='gbNaam'){const s=$('#gbSlug');if(s&&(!s.value||s.dataset.auto!=='0'))s.value=gbSlug(e.target.value)}else if(e.target.id==='gbSlug')e.target.dataset.auto='0'});
$('#dash').addEventListener('click',e=>{if(!gbPagina())return;const t=e.target.closest('[data-gbtab]');if(t){if(APP.gbTab==='modules'&&typeof meLees==='function')meLees();APP.gbTab=t.dataset.gbtab;renderGebiedBouwer();return}const b=e.target.closest('[data-gb]');if(!b)return;const a=b.dataset.gb,G=gbStaat();
  if(a==='kies'){const x=G.res[+b.dataset.i];if(x){G.sel={i:+b.dataset.i,lat:+x.lat,lon:+x.lon,naam:x.name||x.display_name.split(',')[0]};renderGebiedBouwer()}}
  else if(a==='ophalen')gbOphalen();else if(a==='terug'){gbLeesForm();G.stap=1;renderGebiedBouwer()}else if(a==='opslaan')gbOpslaan();
  else if(a==='opnieuw'){APP.gb=null;renderGebiedBouwer()}else if(a==='aan'||a==='uit')gbStatus(b.dataset.slug,a==='aan');else if(a==='weg')gbWeg(b.dataset.slug)});
