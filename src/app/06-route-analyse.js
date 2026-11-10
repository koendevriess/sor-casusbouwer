/* ---------- route analysis ---------- */
let R=null;
function cost(e){let c=e.l;if(e.ag&&state.route.eenrichting!==false)c*=40;if(violation(e.w).length)c*=40;return c}
function computeRoute(){const wps=state.route.wps||[];if(wps.length<2){R={ok:false,pts:[],cum:[0],len:0,edges:[],legs:[],bridges:[],against:[],viol:[],snaps:wps.map(snap)};return}
  const snaps=wps.map(snap);const pts=[],edges=[],legs=[];let broken=false;
  for(let i=0;i<wps.length-1;i++){const start=pts.length?pts.length-1:0;const leg=routeLeg(snaps[i],snaps[i+1],cost);
    if(!leg){broken=true;if(!pts.length)pts.push(snaps[i].q.slice());pts.push(snaps[i+1].q.slice());edges.push({l:dist(snaps[i].q,snaps[i+1].q),w:-1,ag:false});legs.push({i,start,end:pts.length-1,gap:true});continue}
    if(!pts.length)pts.push(leg.pts[0]);for(let k=1;k<leg.pts.length;k++)pts.push(leg.pts[k]);edges.push(...leg.edges);legs.push({i,start,end:pts.length-1})}
  const cum=[0];for(let i=1;i<pts.length;i++)cum.push(cum[i-1]+dist(pts[i-1],pts[i]));
  R={ok:true,pts,cum,len:cum[cum.length-1],edges,legs,snaps,broken};analyze()}
function pointAt(s){const c=R.cum,p=R.pts;if(s<=0)return p[0].slice();if(s>=R.len)return p[p.length-1].slice();let lo=0,hi=c.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(c[m]<=s)lo=m;else hi=m}const t=(s-c[lo])/((c[hi]-c[lo])||1);return[p[lo][0]+t*(p[hi][0]-p[lo][0]),p[lo][1]+t*(p[hi][1]-p[lo][1])]}
function routeDist(p){if(!R||!R.ok||R.pts.length<2)return{d:Infinity,s:0};let best={d:Infinity,s:0};for(let i=0;i<R.pts.length-1;i++){const a=R.pts[i],b=R.pts[i+1];const pr=projSeg(p,a,b);if(pr.d<best.d)best={d:pr.d,s:R.cum[i]+pr.t*dist(a,b)}}return best}
function analyze(){const pts=R.pts,cum=R.cum;const found=[];const last=new Map();
  for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1];const x0=Math.min(a[0],b[0])-7,x1=Math.max(a[0],b[0])+7,y0=Math.min(a[1],b[1])-7,y1=Math.max(a[1],b[1])+7;
    for(const br of BRIDGES){if(br.x<x0||br.x>x1||br.y<y0||br.y>y1)continue;const pr=projSeg([br.x,br.y],a,b);if(pr.d<6){const s=cum[i]+pr.t*dist(a,b);const ls=last.get(br.key);if(ls!=null&&Math.abs(s-ls)<40)continue;last.set(br.key,s);found.push({br,s})}}}
  found.sort((p,q)=>p.s-q.s);R.bridges=found;
  const ag=new Set(),viol=[];
  R.edges.forEach((e,i)=>{if(e.w<0)return;const nm=wayName(e.w)||'naamloos vaarwater';if(e.ag)ag.add(nm);const v=violation(e.w);if(v.length&&!viol.some(x=>x.nm===nm))viol.push({nm,v,s:cum[i],pos:pts[i],src:restrOf(e.w).src})});
  R.against=[...ag];R.viol=viol}
function duration(){if(!R||!R.ok)return null;const v=Math.max(1,state.snelheid||6);const vaart=R.len/1000/v*60;const man=4*Math.max(0,state.manTijd==null?2:state.manTijd);return{vaart,man,total:vaart+man}}
function bridgeStatus(br){return{k:'ok',t:''}}
function nearName(p){const sn=snap(p);return sn&&sn.d<80?wayName(sn.s.w):''}
function sortByRoute(items,getPos){return items.map((it,idx)=>{const p=getPos(it);const rd=p?routeDist(p):{d:Infinity,s:Infinity};return{it,idx,s:rd.d<80?rd.s:1e9+idx}}).sort((a,b)=>a.s-b.s)}
function coverage(){const cov={};CATS.forEach(c=>cov[c.id]=state.aandacht.some(a=>a.cat.includes(c.id)&&(a.tekst||'').trim()));if(!cov.teken&&state.borden.some(b=>(b.uitleg||'').trim()))cov.teken=true;return cov}

