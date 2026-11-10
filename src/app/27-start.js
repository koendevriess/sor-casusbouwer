/* ---------- theme & init ---------- */
const mq=window.matchMedia('(prefers-color-scheme: dark)');const retheme=()=>{styleMap();if(APP.mode==='edit')drawAll()};
if(mq.addEventListener)mq.addEventListener('change',retheme);
new MutationObserver(retheme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
window.addEventListener('resize',()=>map.invalidateSize());
window.addEventListener('beforeunload',()=>{if(APP.dirty.size)flush()});
/* item in de lijst aanklikken -> uitlichten op de kaart */
var SEL=null;let spotLayer=null,spotT=null;
function spotlight(pos,label,zoom){if(!pos)return;const ll=toLL(pos);const inView=map.getBounds().pad(-0.12).contains(ll);if(zoom||!inView)map.flyTo(ll,Math.max(map.getZoom(),17),{duration:0.55});
  if(spotLayer)map.removeLayer(spotLayer);clearTimeout(spotT);spotLayer=L.marker(ll,{interactive:false,keyboard:false,zIndexOffset:2000,icon:L.divIcon({className:'',html:'<span class="spot"></span>',iconSize:[64,64],iconAnchor:[32,32]})}).addTo(map);
  if(label)spotLayer.bindTooltip(label,{permanent:true,direction:'top',offset:[0,-30],className:'spot-tip'}).openTooltip();
  spotT=setTimeout(()=>{if(spotLayer){map.removeLayer(spotLayer);spotLayer=null}},3200)}
function spotFor(el){if(el.dataset.aid){const a=state.aandacht.find(x=>x.id===el.dataset.aid);return a&&a.pos?[a.pos,a.titel||(a.cat&&a.cat.length?catName(a.cat[0]):'Aandachtspunt')]:null}
  if(el.dataset.mid){const m=state.meldpunten.find(x=>x.id===el.dataset.mid);return m&&m.pos?[m.pos,m.melding||'Meldpunt']:null}
  if(el.dataset.sid){const b=state.borden.find(x=>x.id===el.dataset.sid);return b&&b.pos?[b.pos,b.locatie||'Bord']:null}
  if(el.dataset.man){const x=state.manoeuvres[el.dataset.man];const M=MANS.find(q=>q.k===el.dataset.man);return x&&x.pos?[x.pos,M?M.t:'Manoeuvre']:null}
  if(el.dataset.brow){const f=R&&R.bridges.find(q=>q.br.key===el.dataset.brow);return f?[[f.br.x,f.br.y],bridgeLabel(f.br)]:null}
  return null}
/* het aangeklikte item ook in de lijst oranje markeren */
function selOf(el){for(const k of ['aid','mid','sid','man','brow']){if(el.dataset[k]!=null){const a='data-'+(k==='brow'?'brow':k);return'['+a+'="'+el.dataset[k]+'"]'}}return null}
function applySel(){$$('.sel',panel).forEach(x=>x.classList.remove('sel'));if(!SEL)return;const el=panel.querySelector(SEL);if(el)el.classList.add('sel')}
function selectEl(el){SEL=selOf(el);applySel()}
const _renderPanel=renderPanel;renderPanel=function(){_renderPanel();applySel()};
panel.addEventListener('click',e=>{if(e.target.closest('button,select,a,input,.btn,[data-act$="-del"]'))return;const c=e.target.closest('[data-aid],[data-mid],[data-sid],[data-man],[data-brow]');if(!c)return;selectEl(c);const sp=spotFor(c);if(sp)spotlight(sp[0],sp[1],false)});
panel.addEventListener('click',e=>{const b=e.target.closest('[data-act$="-zoom"]');if(!b)return;e.stopImmediatePropagation();const c=b.closest('[data-aid],[data-mid],[data-sid],[data-man]');if(c)selectEl(c);const sp=c&&spotFor(c);if(sp)spotlight(sp[0],sp[1],true)},true);
document.addEventListener('click',e=>{const a=e.target.closest('[data-rws]');if(!a)return;copyText(a.dataset.rws).then(ok=>{if(ok)toast('“'+a.dataset.rws+'” gekopieerd. Plak de naam in het zoekveld van Rijkswaterstaat.')})});
if(!CITY.marifoon){delete HINTS.marifoon;const lg=[...document.querySelectorAll('.map-legend span')].find(x=>/Meldpunt/.test(x.textContent));if(lg)lg.remove()}
styleMap();zoomClasses();
initPlatform();
window.__casus={buildPdf,state:()=>state,route:()=>R,checks:()=>CHECKS,app:APP};
//#if amsterdam,portaal,groningen,utrecht
//#elif gebied
};
