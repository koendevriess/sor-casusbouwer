/* ---------- route editing ---------- */
const HIST=[];
function pushHist(){HIST.push(clone(state.route.wps));if(HIST.length>40)HIST.shift()}
function addWaypoint(p){pushHist();const w=state.route.wps;const sn=snap(p);const q=sn&&sn.d<60?sn.q:p;
  if(R&&R.ok&&w.length>=2){const rd=routeDist(q);if(rd.d<18){let li=R.legs.findIndex(l=>rd.s>=R.cum[l.start]-0.5&&rd.s<=R.cum[l.end]+0.5);if(li<0)li=R.legs.length-1;w.splice(li+1,0,[Math.round(q[0]),Math.round(q[1])]);afterRoute();return}}
  w.push([Math.round(q[0]),Math.round(q[1])]);afterRoute()}
function afterRoute(){computeRoute();markDirty('route');changed({items:true,panel:true,route:true})}

