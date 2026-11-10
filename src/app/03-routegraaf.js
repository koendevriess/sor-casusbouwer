/* ---------- graph & routing ---------- */
const G={xy:[],adj:[],key:new Map()};
function nid(p){const k=p[0]+','+p[1];let id=G.key.get(k);if(id===undefined){id=G.xy.length;G.xy.push(p);G.adj.push([]);G.key.set(k,id)}return id}
const SEGS=[];
WAYS.forEach((w,wi)=>{let prev=nid(w.pts[0]);for(let i=1;i<w.pts.length;i++){const cur=nid(w.pts[i]);if(cur===prev)continue;const l=dist(G.xy[prev],G.xy[cur]);G.adj[prev].push({t:cur,l,w:wi,ag:w.o===-1});G.adj[cur].push({t:prev,l,w:wi,ag:w.o===1});SEGS.push({a:prev,b:cur,w:wi});prev=cur}});
const NODE_COUNT=G.xy.length;
function projSeg(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1];const L2=dx*dx+dy*dy;let t=L2?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L2:0;t=Math.max(0,Math.min(1,t));const q=[a[0]+t*dx,a[1]+t*dy];return{t,q,d:Math.hypot(p[0]-q[0],p[1]-q[1])}}
function snap(p){let best=null;for(const s of SEGS){const pr=projSeg(p,G.xy[s.a],G.xy[s.b]);if(!best||pr.d<best.d)best={d:pr.d,q:pr.q,t:pr.t,s}}return best}
class Heap{constructor(){this.a=[]}get size(){return this.a.length}push(k,v){const a=this.a;a.push([k,v]);let i=a.length-1;while(i>0){const p=(i-1)>>1;if(a[p][0]<=a[i][0])break;const t=a[p];a[p]=a[i];a[i]=t;i=p}}pop(){const a=this.a;const top=a[0];const last=a.pop();if(a.length){a[0]=last;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;if(l<a.length&&a[l][0]<a[m][0])m=l;if(r<a.length&&a[r][0]<a[m][0])m=r;if(m===i)break;const t=a[m];a[m]=a[i];a[i]=t;i=m}}return top}}
function dijkstra(src,dst,cost){const n=G.xy.length;const d=new Float64Array(n).fill(Infinity);const prev=new Int32Array(n).fill(-1);const pe=new Array(n);d[src]=0;const h=new Heap();h.push(0,src);while(h.size){const [k,u]=h.pop();if(k>d[u])continue;if(u===dst)break;for(const e of G.adj[u]){const c=k+cost(e);if(c<d[e.t]){d[e.t]=c;prev[e.t]=u;pe[e.t]=e;h.push(c,e.t)}}}if(d[dst]===Infinity)return null;const nodes=[],edges=[];let v=dst;while(v!==-1){nodes.push(v);if(pe[v])edges.push(pe[v]);v=prev[v]}nodes.reverse();edges.reverse();return{nodes,edges}}
function routeLeg(sa,sb,cost){const base=G.xy.length;const touched=[];
  const link=(u,v,l,wi,agUV)=>{const o=WAYS[wi].o;G.adj[u].push({t:v,l,w:wi,ag:agUV});G.adj[v].push({t:u,l,w:wi,ag:o!==0&&!agUV});touched.push(u,v)};
  const addTemp=sn=>{const id=G.xy.length;G.xy.push(sn.q);G.adj.push([]);const s=sn.s,o=WAYS[s.w].o;link(id,s.a,dist(sn.q,G.xy[s.a]),s.w,o===1);link(id,s.b,dist(sn.q,G.xy[s.b]),s.w,o===-1);return id};
  let res=null;
  try{const A=addTemp(sa),B=addTemp(sb);
    if(sa.s===sb.s){const o=WAYS[sa.s.w].o;const fwd=sb.t>=sa.t;link(A,B,dist(sa.q,sb.q),sa.s.w,(o===1&&!fwd)||(o===-1&&fwd))}
    const r=dijkstra(A,B,cost);if(r)res={pts:r.nodes.map(id=>G.xy[id].slice()),edges:r.edges.map(e=>({l:e.l,w:e.w,ag:e.ag}))};
  }finally{for(let i=touched.length-1;i>=0;i--){const v=touched[i];if(v<base)G.adj[v].pop()}G.xy.length=base;G.adj.length=base}
  return res}
function restrOf(wi){const w=WAYS[wi];const r={mw:w.mw||0,ml:w.ml||0,md:w.md||0,src:'OpenStreetMap'};const c=WAY_RESTR[w.n];if(c){if(c.mw&&(!r.mw||c.mw<r.mw))r.mw=c.mw;if(c.ml&&(!r.ml||c.ml<r.ml))r.ml=c.ml;r.src=c.src}return r}
function violation(wi){if(wi<0)return[];const r=restrOf(wi),b=state.schip||{};const v=[];if(r.mw&&b.breedte&&b.breedte>r.mw)v.push('breedte '+nf(b.breedte)+' m, max. '+nf(r.mw)+' m');if(r.ml&&b.lengte&&b.lengte>r.ml)v.push('lengte '+nf(b.lengte)+' m, max. '+nf(r.ml)+' m');if(r.md&&b.diepgang&&b.diepgang>r.md)v.push('diepgang '+nf(b.diepgang)+' m, max. '+nf(r.md)+' m');return v}

