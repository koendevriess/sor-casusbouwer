/* ---------- map image for the PDF ---------- */
function orderedItems(){const aand=sortByRoute(state.aandacht,a=>a.pos).map((o,n)=>({pos:o.it.pos,lbl:'A'+(n+1),it:o.it})).filter(x=>x.pos);const meld=sortByRoute(state.meldpunten,m=>m.pos).map((o,n)=>({pos:o.it.pos,lbl:'M'+(n+1),it:o.it})).filter(x=>x.pos);const man=MANS.filter(M=>state.manoeuvres[M.k].pos).map(M=>({pos:state.manoeuvres[M.k].pos,lbl:M.code,M}));const bez=state.teksten.bez.map((b,n)=>({pos:b.pos,lbl:'B'+(n+1),it:b})).filter(x=>x.pos);const signs=state.borden.filter(b=>b.pos).map(b=>({pos:b.pos,code:b.code}));return{aand,meld,man,bez,signs}}
function renderMapCanvas(w,h,opt){opt=opt||{};const cv=document.createElement('canvas');cv.width=w;cv.height=h;const c=cv.getContext('2d');const cover=opt.cover;
  let x0,y0,x1,y1;if(opt.bounds){[x0,y0,x1,y1]=opt.bounds}else{const pts=[];if(R&&R.ok)pts.push(...R.pts);const it=orderedItems();[].concat(it.aand,it.meld,it.man,it.bez,it.signs).forEach(o=>pts.push(o.pos));if(!pts.length)pts.push([-400,-400],[800,700]);x0=Math.min(...pts.map(p=>p[0]))-90;x1=Math.max(...pts.map(p=>p[0]))+90;y0=Math.min(...pts.map(p=>p[1]))-90;y1=Math.max(...pts.map(p=>p[1]))+90}
  const ar=w/h;if((x1-x0)/(y1-y0)>ar){const nh=(x1-x0)/ar,cy=(y0+y1)/2;y0=cy-nh/2;y1=cy+nh/2}else{const nw=(y1-y0)*ar,cx=(x0+x1)/2;x0=cx-nw/2;x1=cx+nw/2}
  const s=w/(x1-x0);const X=x=>(x-x0)*s,Y=y=>h-(y-y0)*s;
  const P=cover?{land:'#f4f8fa',water:'#d6e8f0',edge:'#c3dbe6'}:{land:'#f2efe9',water:'#aad3df',edge:'#96c3d3',label:'#3c6e8f',street:'#ffffff',casing:'#d6cec2',pri:'#fcd6a4',sec:'#f7fabf',slabel:'#555b64'};
  c.fillStyle=P.land;c.fillRect(0,0,w,h);c.lineJoin='round';c.lineCap='round';
  const inb=b=>!(b[2]<x0||b[0]>x1||b[3]<y0||b[1]>y1);
  c.fillStyle=P.water;c.strokeStyle=P.edge;c.lineWidth=Math.max(1,s*0.5);
  WATER.forEach(f=>{if(!inb(f.bb))return;c.beginPath();f.rings.forEach(r=>{r.forEach((p,i)=>i?c.lineTo(X(p[0]),Y(p[1])):c.moveTo(X(p[0]),Y(p[1])));c.closePath()});c.fill('evenodd');c.stroke()});
  if(cover)return cv;
  const sw=[4.5,4,6,7,8].map(v=>Math.max(1,v*s*0.55));
  const drawSt=(pass)=>STREETS.forEach(l=>{const cs=pass==='casing'?P.casing:(l.c===4?P.pri:l.c===3?P.sec:P.street);c.strokeStyle=cs;c.lineWidth=sw[l.c]+(pass==='casing'?2:0);c.beginPath();l.pts.forEach((p,i)=>i?c.lineTo(X(p[0]),Y(p[1])):c.moveTo(X(p[0]),Y(p[1])));c.stroke()});
  drawSt('casing');drawSt('fill');
  const fs=Math.round(Math.max(13,Math.min(24,s*8)));c.textAlign='center';c.textBaseline='middle';
  c.font='italic 700 '+fs+'px "Atkinson Hyperlegible", Arial, sans-serif';c.fillStyle=P.label;
  LABELS.forEach(l=>{if(l.x<x0||l.x>x1||l.y<y0||l.y>y1)return;const tw=c.measureText(l.n).width;if(l.t*s<tw*1.3)return;c.save();c.translate(X(l.x),Y(l.y));c.rotate(-l.a*Math.PI/180);c.lineWidth=4;c.strokeStyle=P.water;c.strokeText(l.n,0,0);c.fillText(l.n,0,0);c.restore()});
  c.font='400 '+Math.round(fs*0.8)+'px "Atkinson Hyperlegible", Arial, sans-serif';c.fillStyle=P.slabel;
  SLABELS.forEach(l=>{if(l.x<x0||l.x>x1||l.y<y0||l.y>y1)return;const tw=c.measureText(l.n).width;if(l.d*s<tw*1.1)return;c.save();c.translate(X(l.x),Y(l.y));c.rotate(-l.a*Math.PI/180);c.lineWidth=3.5;c.strokeStyle='#ffffff';c.strokeText(l.n,0,0);c.fillText(l.n,0,0);c.restore()});
  const rw=Math.max(4,w/330);
  if(R&&R.ok&&R.pts.length>1){const RW=lineWalk(offsetPts(R.pts,4.5));c.strokeStyle='#ffffff';c.lineWidth=rw*2.4;c.beginPath();RW.pts.forEach((p,i)=>i?c.lineTo(X(p[0]),Y(p[1])):c.moveTo(X(p[0]),Y(p[1])));c.stroke();c.strokeStyle='#c2187a';c.lineWidth=rw;c.stroke();
    c.fillStyle='#c2187a';const step=Math.max(90,160/(s/1.5));for(let d=step/2;d<RW.len-20;d+=step){const p=RW.at(d),q=RW.at(Math.min(RW.len,d+5));const a=Math.atan2(-(q[1]-p[1]),q[0]-p[0]);const sz=rw*2.2;c.save();c.translate(X(p[0]),Y(p[1]));c.rotate(a);c.beginPath();c.moveTo(sz,0);c.lineTo(-sz*0.8,sz*0.75);c.lineTo(-sz*0.8,-sz*0.75);c.closePath();c.fill();c.restore()}}
  const r=Math.max(12,w/115);
  const badge=(x,y,txt,col,shape,lead)=>{if(lead){c.strokeStyle=col;c.lineWidth=Math.max(1.5,r/9);c.beginPath();c.moveTo(lead[0],lead[1]);c.lineTo(x,y);c.stroke()}c.font='700 '+Math.round(r*0.95)+'px "Atkinson Hyperlegible", Arial, sans-serif';const tw=c.measureText(txt).width;const bw=Math.max(r*2,tw+r*0.9),bh=r*2;c.fillStyle=col;c.strokeStyle='#fff';c.lineWidth=Math.max(2,r/6);c.beginPath();const rad=shape==='sq'?r*0.35:r;const lx=x-bw/2,ly=y-bh/2;c.moveTo(lx+rad,ly);c.arcTo(lx+bw,ly,lx+bw,ly+bh,rad);c.arcTo(lx+bw,ly+bh,lx,ly+bh,rad);c.arcTo(lx,ly+bh,lx,ly,rad);c.arcTo(lx,ly,lx+bw,ly,rad);c.closePath();c.fill();c.stroke();c.fillStyle='#fff';c.textAlign='center';c.textBaseline='middle';c.fillText(txt,x,y+1)};
  const it=orderedItems();const off=r*2.1;
  if(opt.signImgs){const sz=r*2.2;it.signs.forEach(o=>{const im=opt.signImgs[o.code];if(!im)return;const x=X(o.pos[0]),y=Y(o.pos[1]);c.fillStyle='#fff';c.strokeStyle='rgba(0,0,0,.35)';c.lineWidth=2;c.fillRect(x-sz/2-3,y-sz/2-3,sz+6,sz+6);c.strokeRect(x-sz/2-3,y-sz/2-3,sz+6,sz+6);c.drawImage(im,x-sz/2,y-sz/2,sz,sz)})}
  if(R&&R.ok)R.bridges.forEach((f,i)=>badge(X(f.br.x),Y(f.br.y),String(i+1),'#1a8c4e','c'));
  it.aand.forEach(o=>badge(X(o.pos[0])+off,Y(o.pos[1])-off,o.lbl,'#1a2b49','c',[X(o.pos[0]),Y(o.pos[1])]));
  it.meld.forEach(o=>badge(X(o.pos[0])-off,Y(o.pos[1])-off,o.lbl,'#d02d2d','sq',[X(o.pos[0]),Y(o.pos[1])]));
  it.man.forEach(o=>badge(X(o.pos[0])+off,Y(o.pos[1])+off,o.lbl,'#fa7c00','sq',[X(o.pos[0]),Y(o.pos[1])]));
  it.bez.forEach(o=>badge(X(o.pos[0]),Y(o.pos[1]),o.lbl,'#6a4ab5','c'));
  if(state.route.wps.length){const p=state.route.wps[0];badge(X(p[0]),Y(p[1]),'Start','#c2187a','sq')}
  const sb=[50,100,200,250,500].find(v=>v*s>w/9)||500;const bx=r*1.5,by=h-r*1.6;c.fillStyle='rgba(255,255,255,.88)';c.fillRect(bx-8,by-r*1.4,sb*s+16+r*3,r*2);c.strokeStyle='#1a2b49';c.lineWidth=2;c.beginPath();c.moveTo(bx,by-6);c.lineTo(bx,by);c.lineTo(bx+sb*s,by);c.lineTo(bx+sb*s,by-6);c.stroke();c.fillStyle='#1a2b49';c.font='700 '+Math.round(r*0.85)+'px "Atkinson Hyperlegible", Arial, sans-serif';c.textAlign='left';c.textBaseline='alphabetic';c.fillText(sb+' m',bx+sb*s+8,by);
  const nx=w-r*2,ny=r*2.2;c.fillStyle='#1a2b49';c.beginPath();c.moveTo(nx,ny-r*1.2);c.lineTo(nx+r*0.6,ny+r*0.4);c.lineTo(nx,ny);c.lineTo(nx-r*0.6,ny+r*0.4);c.closePath();c.fill();c.font='700 '+Math.round(r*0.9)+'px "Atkinson Hyperlegible", Arial, sans-serif';c.textAlign='center';c.fillText('N',nx,ny+r*1.4);
  c.font='400 '+Math.round(r*0.7)+'px "Atkinson Hyperlegible", Arial, sans-serif';c.textAlign='right';c.fillStyle='#536077';c.fillText('Kaartdata © OpenStreetMap-bijdragers',w-8,h-8);
  return cv}
function svgToImg(svg,size){return new Promise(res=>{const img=new Image();img.onload=()=>{const cv=document.createElement('canvas');cv.width=size;cv.height=size;const c=cv.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,size,size);c.drawImage(img,0,0,size,size);res(cv)};img.onerror=()=>res(null);img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)})}

