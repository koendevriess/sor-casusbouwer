/* ---------- change handling ---------- */
function changed(o){o=o||{};if(o.route)drawRoute();CHECKS=checks();renderProgress();renderRail();if(o.items)drawItems();if(o.route)drawWps();if(o.panel)renderPanel();updateHint()}
function setStep(id){if(state.ui.step!==id)navPush({k:'step',step:id,id:APP.target||null,role:APP.role});state.ui.step=id;state.ui.pending=null;map.closePopup();renderRail();renderPanel();drawWps();drawItems();updateHint();panel.scrollTop=0;if(APP.role==='local')saveLocal();if(window.matchMedia('(max-width:780px)').matches){const b=$('#steps .stp.on');if(b)b.scrollIntoView({inline:'center',block:'nearest'})}}
document.addEventListener('click',e=>{const st=e.target.closest('[data-step]');if(st&&st.dataset.step!=='-'&&!e.target.closest('input,textarea')&&APP.mode==='edit'){e.preventDefault();setStep(st.dataset.step)}});
const topKey=p=>p.split('.')[0];
panel.addEventListener('input',e=>{const t=e.target;if(t.dataset.fb){setFb(t.dataset.fb,{tekst:t.value});return}const p=t.dataset.path;if(!p||!editable())return;let v;if(t.type==='checkbox')v=t.checked;else if(t.type==='radio'){if(!t.checked)return;v=t.value}else if(t.dataset.num)v=parseNum(t.value);else v=t.value;setPath(state,p,v);markDirty(topKey(p));
  if(state.isVoorbeeld&&p.startsWith('kandidaat.')){state.isVoorbeeld=false;renderBanner()}
  if(p.startsWith('schip.')&&state.schip.preset&&state.schip.preset!=='eigen'&&['schip.lengte','schip.breedte','schip.pax','schip.naam'].includes(p))state.schip.preset='eigen';
  if(p.startsWith('schip.')||p==='route.eenrichting'){computeRoute();changed({route:true,items:true});if(p==='route.eenrichting')renderPanel();return}
  if(p==='waterstand'){changed({route:true});return}
  if(p==='snelheid'||p==='manTijd'){changed({});return}
  if(p.startsWith('hoogtes.')){refreshBridgeCells();changed({route:true});return}
  if(p.startsWith('brughoogtes.')){refreshBh();changed({});return}
  if(p==='schip.hoogte'&&CITY.bh)refreshBh();
  if(p==='veiligheid.blusType'){changed({panel:true});return}
  if(p.startsWith('aandacht.')){const c=$('#covChips');if(c)c.innerHTML=covChips(coverage())}
  if(t.tagName==='TEXTAREA'&&p.startsWith('teksten.')&&!p.startsWith('teksten.bez')){const wc=words(t.value);const w=$('[data-wc="'+p+'"]');if(w)w.textContent=wc+' woorden · ± '+Math.round(wc/130*60)+' s';const kw=$('[data-kw="'+p+'"]');if(kw){const lang=p.endsWith('EN')?'EN':'NL';kw.innerHTML=kwChips(t.value,(p.includes('welkom')?KW_W:KW_S)[lang])}}
  if((p.startsWith('teksten.bez')&&p.endsWith('.titel'))||(p.startsWith('aandacht.')&&p.endsWith('.titel'))||(p.startsWith('borden.')&&p.endsWith('.locatie'))||(p.startsWith('meldpunten.')&&p.endsWith('.melding')))drawItems();
  changed({})});
panel.addEventListener('change',async e=>{const t=e.target;if(!editable())return;if(t.type==='radio'&&t.dataset.path){setPath(state,t.dataset.path,t.value);markDirty(topKey(t.dataset.path));changed({});return}
  const act=t.dataset.act;if(!act)return;
  if(act==='boat-sel'){const s=state.schip;const v=t.value;if(v==='eigen'){s.preset='eigen'}else{const bt=BOATS.find(x=>x.id===v);if(bt)Object.assign(s,{preset:bt.id,naam:bt.naam,lengte:bt.lengte,breedte:bt.breedte,pax:bt.pax})}markDirty('schip');computeRoute();changed({panel:true,route:true});return}
  if(act==='a-cat'){const a=state.aandacht.find(x=>x.id===t.dataset.id);if(a){a.cat=t.value?[t.value]:[];markDirty('aandacht');const c=$('#covChips');if(c)c.innerHTML=covChips(coverage());changed({items:true})}return}
  if(act==='werking'){const v=state.veiligheid;const s=new Set(v.werking||[]);t.checked?s.add(t.dataset.k):s.delete(t.dataset.k);v.werking=Object.keys(WERK_NAMES).filter(k=>s.has(k));markDirty('veiligheid');$('#werkFb').innerHTML=werkFb();changed({});return}
  if(act==='a-foto'||act==='v-foto'){const f=t.files&&t.files[0];if(!f)return;try{const ph=await readPhoto(f);const stored=await storePhoto(ph);if(act==='a-foto'){const a=state.aandacht.find(x=>x.id===t.dataset.id);if(a)a.foto=stored;markDirty('aandacht')}else{state.veiligheid.fotos=(state.veiligheid.fotos||[]).concat([stored]).slice(0,3);markDirty('veiligheid')}changed({panel:true})}catch(err){toast(err&&err.message==='groot'?'Deze foto is te groot om op te slaan. Kies een kleinere foto.':'Deze foto kon niet worden gelezen. Gebruik een JPG- of PNG-bestand.',true)}}});
panel.addEventListener('click',e=>{const fs=e.target.closest('[data-fbst]');if(fs){const step=fs.dataset.fbstep;const cur=fbStep(step);const val=fs.dataset.fbst;setFb(step,{status:cur&&cur.status===val?'':val});renderPanel();renderRail();return}
  const b=e.target.closest('[data-act]');if(!b||b.tagName==='INPUT'||b.tagName==='SELECT')return;const act=b.dataset.act,id=b.dataset.id;
  if(act==='pdf'){downloadPdf();return}if(act==='backup'){downloadBackup();return}if(act==='inleveren'){confirmBox('Casus inleveren?','Flagship Academy ziet dat je casus klaar is om te beoordelen. Je kunt daarna nog steeds wijzigingen maken.','Inleveren').then(y=>{if(y)setStatus(APP.target,'ingeleverd')});return}
  if(act==='a-zoom'){const a=state.aandacht.find(x=>x.id===id);if(a&&a.pos)map.setView(toLL(a.pos),17.5);return}
  if(act==='m-zoom'){const m=state.meldpunten.find(x=>x.id===id);if(m&&m.pos)map.setView(toLL(m.pos),17.5);return}
  if(act==='s-zoom'){const s=state.borden.find(x=>x.id===id);if(s&&s.pos)map.setView(toLL(s.pos),17.5);return}
  if(act==='man-zoom'){const x=state.manoeuvres[b.dataset.k];if(x.pos)map.setView(toLL(x.pos),17.5);return}
  if(!editable())return;
  switch(act){
  case'boat':{const s=state.schip;if(id==='eigen')s.preset='eigen';else{const bt=BOATS.find(x=>x.id===id);Object.assign(s,{preset:bt.id,naam:bt.naam,lengte:bt.lengte,breedte:bt.breedte,pax:bt.pax!=null?bt.pax:s.pax})}markDirty('schip');computeRoute();changed({panel:true,route:true});break}
  case'wp-del':pushHist();state.route.wps.splice(+b.dataset.i,1);afterRoute();break;
  case'wp-undo':if(HIST.length){state.route.wps=HIST.pop();afterRoute()}break;
  case'wp-close':{const w=state.route.wps;if(w.length>1){pushHist();w.push(w[0].slice());afterRoute()}break}
  case'wp-rev':pushHist();state.route.wps.reverse();afterRoute();break;
  case'wp-clear':confirmBox('Route wissen?','Alle routepunten worden verwijderd. Je kunt dit ongedaan maken.','Wissen').then(y=>{if(y){pushHist();state.route.wps=[];afterRoute()}});break;
  case'a-del':{const i=state.aandacht.findIndex(x=>x.id===id);if(i>=0){state.aandacht.splice(i,1);markDirty('aandacht');changed({items:true,panel:true})}break}
  case'a-place':state.ui.pending={type:'aand',id,label:'Klik op de kaart om het aandachtspunt te plaatsen'};updateHint();break;
  case'a-foto-del':{const a=state.aandacht.find(x=>x.id===id);if(a){a.foto=null;markDirty('aandacht');changed({panel:true})}break}
  case'sign-pick':{const code=b.dataset.code;state.ui.pending={type:'signnew',code,label:'Klik op de kaart waar dit bord staat'};updateHint();renderPanel();break}
  case's-place':state.ui.pending={type:'signpos',id,label:'Klik op de kaart waar dit bord staat'};updateHint();break;
  case'sign-del':state.borden.splice(+b.dataset.i,1);markDirty('borden');changed({panel:true,items:true});break;
  case'man-place':{const M=MANS.find(x=>x.k===b.dataset.k);state.ui.pending={type:'man',k:M.k,label:'Klik op de kaart: '+M.t};updateHint();break}
  case'man-clear':state.manoeuvres[b.dataset.k].pos=null;markDirty('manoeuvres');changed({items:true,panel:true});break;
  case'm-del':{const i=state.meldpunten.findIndex(x=>x.id===id);if(i>=0){state.meldpunten.splice(i,1);markDirty('meldpunten');changed({items:true,panel:true})}break}
  case'bez-add':state.teksten.bez.push({id:uid(),titel:'',nl:'',en:'',pos:null});markDirty('teksten');changed({panel:true});break;
  case'bez-gen':{state.teksten.bez.push({id:uid(),titel:b.dataset.n,nl:'',en:'',pos:null});markDirty('teksten');changed({panel:true,items:true});break}
  case'bez-poi':{const p=POIS.find(x=>x.n===b.dataset.n);if(p){state.teksten.bez.push({id:uid(),titel:p.n,nl:'',en:'',pos:p.pos.slice()});markDirty('teksten');changed({panel:true,items:true})}break}
  case'bez-del':{const i=state.teksten.bez.findIndex(x=>x.id===id);if(i>=0){state.teksten.bez.splice(i,1);markDirty('teksten');changed({panel:true,items:true})}break}
  case'bez-place':state.ui.pending={type:'bez',id,label:'Klik op de kaart om de bezienswaardigheid te plaatsen'};updateHint();break;
  case'v-foto-del':state.veiligheid.fotos.splice(+b.dataset.i,1);markDirty('veiligheid');changed({panel:true});break;
  case'picto':state.veiligheid.picto=b.dataset.k;markDirty('veiligheid');changed({panel:true});break;
  }});
panel.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('a[data-step]'))setStep(e.target.dataset.step)});

