/* ---------- map ---------- */
const mapEl=$('#map');
//#if amsterdam,portaal
const map=L.map(mapEl,{zoomControl:true,attributionControl:false,minZoom:13,maxZoom:19,zoomSnap:0.5,zoomDelta:0.5,wheelPxPerZoomLevel:90,maxBounds:L.latLngBounds(toLL([-2600,-2300]),toLL([3400,2400])),maxBoundsViscosity:0.8});
//#elif groningen
const map=L.map(mapEl,{zoomControl:true,attributionControl:false,minZoom:13,maxZoom:19,zoomSnap:0.5,zoomDelta:0.5,wheelPxPerZoomLevel:90,maxBounds:L.latLngBounds(toLL([-2700,-2000]),toLL([2600,2000])),maxBoundsViscosity:0.8});
//#elif utrecht
const map=L.map(mapEl,{zoomControl:true,attributionControl:false,minZoom:13,maxZoom:19,zoomSnap:0.5,zoomDelta:0.5,wheelPxPerZoomLevel:90,maxBounds:L.latLngBounds(toLL([-2600,-2400]),toLL([2600,2400])),maxBoundsViscosity:0.8});
//#elif gebied
const map=L.map(mapEl,{zoomControl:true,attributionControl:false,minZoom:13,maxZoom:19,zoomSnap:0.5,zoomDelta:0.5,wheelPxPerZoomLevel:90,maxBounds:L.latLngBounds(toLL(__GEB.bounds[0]),toLL(__GEB.bounds[1])),maxBoundsViscosity:0.8});
//#endif
L.control.scale({imperial:false,position:'topleft'}).addTo(map);
const renderer=L.canvas({padding:0.4});
const waterLayers=WATER.map(f=>L.polygon(f.rings.map(r=>r.map(toLL)),{renderer,weight:0.8,interactive:false}).addTo(map));
const SCLS=[0,1,2,3,4];const SW=[5,4.5,7,8,9];const SCOL=[['--m-street','--m-casing'],['--m-ped','--m-ped-c'],['--m-ter','--m-ter-c'],['--m-sec','--m-sec-c'],['--m-pri','--m-pri-c']];
const sGroups=SCLS.map(c=>STREETS.filter(s=>s.c===c).map(s=>s.pts.map(toLL)));
const casingL=sGroups.map(g=>L.polyline(g.length?g:[[toLL([0,0]),toLL([0,0])]],{renderer,interactive:false,lineCap:'round',lineJoin:'round'}).addTo(map));
const streetL=sGroups.map(g=>L.polyline(g.length?g:[[toLL([0,0]),toLL([0,0])]],{renderer,interactive:false,lineCap:'round',lineJoin:'round'}).addTo(map));
const labelLayer=L.layerGroup(LABELS.map(l=>L.marker(toLL([l.x,l.y]),{interactive:false,keyboard:false,icon:L.divIcon({className:'canal-lbl'+(l.t>400?' major':''),iconSize:[0,0],html:'<span style="transform:rotate('+(-l.a)+'deg) translate(-50%,-50%)">'+esc(l.n)+'</span>'})}))).addTo(map);
const sLabelLayer=L.layerGroup(SLABELS.map(l=>L.marker(toLL([l.x,l.y]),{interactive:false,keyboard:false,icon:L.divIcon({className:'st-lbl'+(l.c>=2||l.d>140?' major':''),iconSize:[0,0],html:'<span style="transform:rotate('+(-l.a)+'deg) translate(-50%,-50%)">'+esc(l.n)+'</span>'})}))).addTo(map);
const poiLayer=L.layerGroup(POIS.map(p=>L.marker(toLL(p.pos),{interactive:false,keyboard:false,icon:L.divIcon({className:'poi-lbl',iconSize:[0,0],html:'<i></i><span>'+esc(p.n)+'</span>'})}))).addTo(map);
//#if groningen,utrecht,gebied
const allBridgeLayer=L.layerGroup(BRIDGES.map(b=>L.circleMarker(toLL([b.x,b.y]),{renderer,radius:3,weight:1.5,fillOpacity:1}).bindTooltip(esc(bridgeLabel(b))+'',{direction:'top',offset:[0,-4]})));
//#elif amsterdam,portaal
const allBridgeLayer=L.layerGroup(BRIDGES.map(b=>L.circleMarker(toLL([b.x,b.y]),{renderer,radius:3,weight:1.5,fillOpacity:1}).bindTooltip(esc(bridgeLabel(b))+(b.ref?' · brug '+esc(b.ref):''),{direction:'top',offset:[0,-4]})));
//#endif
const LG={route:L.layerGroup().addTo(map),bridges:L.layerGroup().addTo(map),items:L.layerGroup().addTo(map),wps:L.layerGroup().addTo(map)};
function styleStreets(){const z=map.getZoom();const f=Math.pow(2,(z-16)*0.85);SCLS.forEach(c=>{const w=Math.max(0.6,SW[c]*f);streetL[c].setStyle({color:cssv(SCOL[c][0]),weight:w,opacity:1});casingL[c].setStyle({color:cssv(SCOL[c][1]),weight:w+(z>=14.5?2:0.8),opacity:1})})}
function styleMap(){const w=cssv('--m-water'),e=cssv('--m-edge');waterLayers.forEach(l=>l.setStyle({color:e,fillColor:w,fillOpacity:1,opacity:1}));allBridgeLayer.eachLayer(l=>l.setStyle({color:cssv('--ink-3'),fillColor:cssv('--panel')}));styleStreets()}
function zoomClasses(){const z=map.getZoom();mapEl.classList.toggle('z15',z>=15);mapEl.classList.toggle('z16',z>=16);mapEl.classList.toggle('z17',z>=16.5);if(z>=15.5){if(!map.hasLayer(allBridgeLayer))allBridgeLayer.addTo(map)}else if(map.hasLayer(allBridgeLayer))map.removeLayer(allBridgeLayer);styleStreets()}
map.on('zoomend',zoomClasses);map.on('zoomend',()=>{if(R&&R.ok&&APP.mode==='edit')drawRoute()});
const icon=(cls,txt,sz=22)=>L.divIcon({className:'',html:'<span class="lf-num '+cls+'">'+esc(txt)+'</span>',iconSize:[sz,sz],iconAnchor:[sz/2,sz/2]});
function offsetPts(pts,d){const q=pts.filter((p,i)=>i===0||p[0]!==pts[i-1][0]||p[1]!==pts[i-1][1]);if(q.length<2)return q.slice();const nrm=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1;return[dy/L,-dx/L]};const out=[];
  for(let i=0;i<q.length;i++){const p=q[i];const n1=i>0?nrm(q[i-1],p):null,n2=i<q.length-1?nrm(p,q[i+1]):null;if(!n1||!n2){const n=n1||n2;out.push([p[0]+n[0]*d,p[1]+n[1]*d]);continue}const sx=n1[0]+n2[0],sy=n1[1]+n2[1],sl=Math.hypot(sx,sy);if(sl<0.5){out.push([p[0]+n1[0]*d,p[1]+n1[1]*d],[p[0]+n2[0]*d,p[1]+n2[1]*d]);continue}const mx=sx/sl,my=sy/sl,c=mx*n1[0]+my*n1[1],k=d/Math.max(c,0.5);out.push([p[0]+mx*k,p[1]+my*k])}return out}
function lineWalk(pts){const cum=[0];for(let i=1;i<pts.length;i++)cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));const len=cum[cum.length-1];return{pts,cum,len,at(s){if(s<=0)return pts[0].slice();if(s>=len)return pts[pts.length-1].slice();let lo=0,hi=cum.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(cum[m]<=s)lo=m;else hi=m}const t=(s-cum[lo])/((cum[hi]-cum[lo])||1);return[pts[lo][0]+t*(pts[hi][0]-pts[lo][0]),pts[lo][1]+t*(pts[hi][1]-pts[lo][1])]}}}
function routeOffset(){let z=map.getZoom();if(!isFinite(z))z=16;const mpp=156543*Math.cos(LAT0*Math.PI/180)/Math.pow(2,z);return Math.min(7,Math.max(3.5,3*mpp))}
function drawRoute(){LG.route.clearLayers();LG.bridges.clearLayers();if(!R||!R.ok||R.pts.length<2)return;const RW=lineWalk(offsetPts(R.pts,routeOffset()));const ll=RW.pts.map(toLL);const rc=cssv('--route');
  L.polyline(ll,{renderer,color:'#ffffff',weight:9,opacity:.95,interactive:false,lineJoin:'round'}).addTo(LG.route);
  L.polyline(ll,{renderer,color:rc,weight:4.5,opacity:1,interactive:false,lineJoin:'round',dashArray:R.broken?'8 6':null}).addTo(LG.route);
  for(let s=60;s<RW.len-20;s+=130){const p=RW.at(s),q=RW.at(Math.min(RW.len,s+6));const ang=Math.atan2(q[1]-p[1],q[0]-p[0])*180/Math.PI;L.marker(toLL(p),{interactive:false,keyboard:false,icon:L.divIcon({className:'',html:'<span class="lf-arrow" style="transform:rotate('+(90-ang)+'deg)"></span>',iconSize:[12,12],iconAnchor:[6,6]})}).addTo(LG.route)}
//#if groningen,utrecht,gebied
  R.bridges.forEach((f,i)=>{const st=bridgeStatus(f.br);L.marker(toLL([f.br.x,f.br.y]),{icon:icon('bridge st-'+st.k,i+1,20),keyboard:false}).bindTooltip('<b>'+(i+1)+'. '+esc(bridgeLabel(f.br))+'</b>'+''+'<br>'+esc(st.t)+(st.eff!=null?' · '+nf(st.eff)+' m':''),{direction:'top',offset:[0,-10]}).on('click',()=>{if(state.ui.step!=='bruggen')setStep('bruggen');setTimeout(()=>flashEl('[data-brow="'+f.br.key+'"]'),60)}).addTo(LG.bridges)})}
//#elif amsterdam,portaal
  R.bridges.forEach((f,i)=>{const st=bridgeStatus(f.br);L.marker(toLL([f.br.x,f.br.y]),{icon:icon('bridge st-'+st.k,i+1,20),keyboard:false}).bindTooltip('<b>'+(i+1)+'. '+esc(bridgeLabel(f.br))+'</b>'+(f.br.ref?' · brug '+esc(f.br.ref):'')+'<br>'+esc(st.t)+(st.eff!=null?' · '+nf(st.eff)+' m':''),{direction:'top',offset:[0,-10]}).on('click',()=>{if(state.ui.step!=='bruggen')setStep('bruggen');setTimeout(()=>flashEl('[data-brow="'+f.br.key+'"]'),60)}).addTo(LG.bridges)})}
//#endif
function drawWps(){LG.wps.clearLayers();if(state.ui.step!=='route'||APP.mode!=='edit')return;const ed=editable();state.route.wps.forEach((p,i)=>{const m=L.marker(toLL(p),{draggable:ed,autoPan:true,title:'Routepunt '+(i+1)+(ed?' (slepen om te verplaatsen)':''),icon:L.divIcon({className:'',html:'<span class="lf-wp'+(i===0?' start':'')+'">'+(i===0?'S':'')+'</span>',iconSize:[22,22],iconAnchor:[11,11]})});if(ed)m.on('dragend',e=>{pushHist();state.route.wps[i]=fromLL(e.target.getLatLng());afterRoute()});m.addTo(LG.wps)})}
function drawItems(){LG.items.clearLayers();const step=state.ui.step;const ed=editable();
  const mk=(pos,html,drag,onDrag,onClick,tip)=>{const m=L.marker(toLL(pos),{draggable:!!(drag&&ed),autoPan:true,icon:L.divIcon({className:'',html,iconSize:[24,24],iconAnchor:[12,12]}),keyboard:false});if(tip)m.bindTooltip(tip,{direction:'top',offset:[0,-12]});if(drag&&ed)m.on('dragend',e=>onDrag(fromLL(e.target.getLatLng())));if(onClick)m.on('click',onClick);m.addTo(LG.items)};
  const go=(st,sel)=>()=>{SEL=sel;if(state.ui.step!==st)setStep(st);setTimeout(()=>{applySel();flashEl(sel)},60)};
  sortByRoute(state.aandacht,a=>a.pos).forEach((o,n)=>{const a=o.it;if(!a.pos)return;mk(a.pos,'<span class="lf-num aand">A'+(n+1)+'</span>',step==='aandacht',p=>{a.pos=p;markDirty('aandacht');changed({items:true,panel:true})},go('aandacht','[data-aid="'+a.id+'"]'),'A'+(n+1)+' · '+esc(a.cat.map(catName).join(', ')||'Aandachtspunt')+(a.titel?' — '+esc(a.titel):''))});
  sortByRoute(state.meldpunten,m=>m.pos).forEach((o,n)=>{const m=o.it;if(!m.pos)return;mk(m.pos,'<span class="lf-num meld">M'+(n+1)+'</span>',step==='marifoon',p=>{m.pos=p;markDirty('meldpunten');changed({items:true,panel:true})},go('marifoon','[data-mid="'+m.id+'"]'),'Meldpunt M'+(n+1)+(m.melding?': '+esc(m.melding):''))});
  MANS.forEach(M=>{const x=state.manoeuvres[M.k];if(!x.pos)return;mk(x.pos,'<span class="lf-num man">'+M.code+'</span>',step==='manoeuvres',p=>{x.pos=p;markDirty('manoeuvres');changed({items:true,panel:true})},go('manoeuvres','[data-man="'+M.k+'"]'),esc(M.t))});
  state.borden.forEach(b=>{if(!b.pos)return;mk(b.pos,'<span class="lf-sign">'+signSvg(b.code)+'</span>',step==='borden',p=>{b.pos=p;markDirty('borden');changed({items:true,panel:true})},go('borden','[data-sid="'+b.id+'"]'),b.locatie?esc(b.locatie):'Bord')});
  state.teksten.bez.forEach((b,n)=>{if(!b.pos)return;mk(b.pos,'<span class="lf-num bez">B'+(n+1)+'</span>',step==='teksten',p=>{b.pos=p;markDirty('teksten');changed({items:true})},go('teksten','[data-bid="'+b.id+'"]'),esc(b.titel||'Bezienswaardigheid'))})}
function drawAll(){drawRoute();drawWps();drawItems();updateHint()}
function fitRoute(){const pts=(R&&R.ok&&R.pts.length>1)?R.pts:state.route.wps;if(pts&&pts.length>1)map.fitBounds(L.latLngBounds(pts.map(toLL)),{padding:[40,40]});else if(pts&&pts.length===1)map.setView(toLL(pts[0]),16);else map.setView(toLL([250,150]),15)}
const HINTS={route:'Klik op het water voor een routepunt · sleep punten om te schuiven',aandacht:'Klik op de kaart en kies wat voor aandachtspunt het is',borden:'Klik op de kaart op de plek van het bord en kies het bord',marifoon:'Klik op de kaart op de plek waar je meldt'};
function updateHint(){const h=$('#mapHint');const pend=state.ui.pending;const ed=editable();document.body.classList.toggle('pending-mode',!!pend);document.body.classList.toggle('click-mode',ed&&!!HINTS[state.ui.step]);
  if(pend){h.hidden=false;h.className='map-hint pending';h.innerHTML='<span>'+esc(pend.label)+'</span><button class="btn sm" type="button" data-act="cancel-pending">Annuleren</button>'}
  else if(ed&&HINTS[state.ui.step]){h.hidden=false;h.className='map-hint';h.innerHTML='<span>'+esc(HINTS[state.ui.step])+'</span>'}else h.hidden=true}
$('#mapHint').addEventListener('click',e=>{if(e.target.closest('[data-act="cancel-pending"]')){state.ui.pending=null;updateHint();renderPanel()}});
function popup(latlng,el){L.popup({closeButton:true,autoPan:true,autoPanPaddingTopLeft:L.point(70,86),autoPanPaddingBottomRight:L.point(20,70),className:'lf-pop',maxWidth:300}).setLatLng(latlng).setContent(el).openOn(map)}
function catPopup(latlng){const p=fromLL(latlng);const el=document.createElement('div');el.innerHTML='<div class="pop-t">Wat voor aandachtspunt is dit?</div><div class="pop-grid">'+CATS_A.map(c=>'<button type="button" data-cat="'+c.id+'">'+esc(c.s)+'</button>').join('')+'</div>';el.addEventListener('click',e=>{const b=e.target.closest('[data-cat]');if(!b)return;map.closePopup();const a={id:uid(),pos:p,cat:[b.dataset.cat],titel:'',tekst:'',foto:null};state.aandacht.push(a);markDirty('aandacht');changed({items:true,panel:true});setTimeout(()=>{flashEl('[data-aid="'+a.id+'"]');const t=$('[data-aid="'+a.id+'"] input');if(t)t.focus()},80)});popup(latlng,el)}
function signPopup(latlng){const p=fromLL(latlng);const el=document.createElement('div');el.innerHTML='<div class="pop-t">Welk bord staat hier?</div><div class="pop-signs">'+SIGN_KEYS.map((c,i)=>'<button type="button" data-sign="'+c+'" aria-label="Bord '+(i+1)+'">'+signSvg(c)+'</button>').join('')+'</div>';el.addEventListener('click',e=>{const b=e.target.closest('[data-sign]');if(!b)return;map.closePopup();addSign(b.dataset.sign,p)});popup(latlng,el)}
function addSign(code,pos){const b={id:uid(),code,naam:'',pos:pos||null,locatie:pos?nearName(pos):'',uitleg:''};state.borden.push(b);markDirty('borden');changed({items:true,panel:true});setTimeout(()=>{flashEl('[data-sid="'+b.id+'"]');const t=$('[data-sid="'+b.id+'"] textarea');if(t)t.focus()},80)}
map.on('click',e=>{if(!editable())return;const p=fromLL(e.latlng);const pend=state.ui.pending;
  if(pend){state.ui.pending=null;if(pend.type==='man'){state.manoeuvres[pend.k].pos=p;markDirty('manoeuvres')}else if(pend.type==='bez'){const b=state.teksten.bez.find(x=>x.id===pend.id);if(b)b.pos=p;markDirty('teksten')}else if(pend.type==='aand'){const a=state.aandacht.find(x=>x.id===pend.id);if(a)a.pos=p;markDirty('aandacht')}else if(pend.type==='signpos'){const b=state.borden.find(x=>x.id===pend.id);if(b){b.pos=p;if(!b.locatie)b.locatie=nearName(p)}markDirty('borden')}else if(pend.type==='signnew'){addSign(pend.code,p);return}changed({items:true,panel:true});return}
  const st=state.ui.step;
  if(st==='route')addWaypoint(p);
  else if(st==='aandacht')catPopup(e.latlng);
  else if(st==='borden')signPopup(e.latlng);
  else if(st==='marifoon'&&CITY.marifoon){const m={id:uid(),pos:p,melding:'',manoeuvre:''};state.meldpunten.push(m);markDirty('meldpunten');changed({items:true,panel:true});setTimeout(()=>{flashEl('[data-mid="'+m.id+'"]');const t=$('[data-mid="'+m.id+'"] input');if(t)t.focus()},80)}});
$('#btnFit').addEventListener('click',fitRoute);
map.on('popupopen',()=>$('#mapHint').classList.add('under-pop'));map.on('popupclose',()=>$('#mapHint').classList.remove('under-pop'));
function flashEl(sel){const el=$(sel);if(!el)return;el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash')}

