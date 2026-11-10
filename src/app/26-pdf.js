/* ---------- PDF ---------- */
const clean=t=>String(t==null?'':t).replace(/[“”„]/g,'"').replace(/[‘’]/g,"'").replace(/−/g,'-').replace(/→/g,'->').replace(/←/g,'<-').replace(/≥/g,'>=').replace(/≤/g,'<=').replace(/✓/g,'v').replace(/✕/g,'x').replace(/₂/g,'2').replace(/[^\u0000-ÿ–—‘-„•…€]/g,'');
const firstName=()=>(state.kandidaat.naam||'').trim().split(/\s+/)[0]||'[naam]';
const fillName=t=>(t||'').replace(/\[naam\]/gi,firstName());
async function buildPdf(){const J=window.jspdf&&window.jspdf.jsPDF;if(!J)throw new Error('lib');
  if(document.fonts&&document.fonts.ready){try{await document.fonts.ready}catch(e){}}
  const doc=new J({unit:'mm',format:'a4',compress:true});const W=210,H=297,M=16,CW=W-2*M;let y=M;
  const INK=[26,43,73],MUT=[83,96,119],ACC=[250,124,0],GRN=[26,140,78],RED=[208,45,45],VIO=[106,74,181],LINE=[214,221,228],SOFT=[240,246,249];
  const font=(sz,st,col)=>{doc.setFont('helvetica',st||'normal');doc.setFontSize(sz);doc.setTextColor(...(col||INK))};
  const lh=sz=>sz*0.3528*1.4;const newPage=()=>{doc.addPage();y=M+10};const ensure=hh=>{if(y+hh>H-M-6)newPage()};
  const para=(t,o)=>{o=o||{};const sz=o.size||10.5;const x=M+(o.indent||0);const w=(o.width||CW)-(o.indent||0);String(clean(t)).split(/\n/).forEach(pl=>{if(!pl.trim()){y+=lh(sz)*0.5;return}font(sz,o.style,o.color);doc.splitTextToSize(pl,w).forEach(ln=>{ensure(lh(sz));font(sz,o.style,o.color);doc.text(ln,x,y+lh(sz)*0.75);y+=lh(sz)})});y+=(o.after==null?2.2:o.after)};
  const h1=t=>{ensure(20);y+=3;font(13.5,'bold',INK);doc.text(clean(t),M,y+5);y+=7.5;doc.setDrawColor(...ACC);doc.setLineWidth(0.9);doc.line(M,y,M+16,y);y+=6};
  const h2=t=>{ensure(13);y+=2;font(11,'bold',INK);doc.splitTextToSize(clean(t),CW).forEach(l=>{doc.text(l,M,y+4.3);y+=5});y+=1.8};
  const kv=(k,v)=>{const kw=48;font(10,'bold',MUT);const lines=doc.splitTextToSize(clean(v||'-'),CW-kw);ensure(lines.length*lh(10.5)+1);doc.text(clean(k),M,y+lh(10.5)*0.75);font(10.5,'normal',INK);lines.forEach((l,i)=>doc.text(l,M+kw,y+lh(10.5)*(0.75+i)));y+=lines.length*lh(10.5)+1.2};
  const dot=(x,yy,col,txt,sq)=>{doc.setFillColor(...col);if(sq)doc.roundedRect(x-2.6,yy-2.6,5.2+(txt.length>2?1.8:0),5.2,0.8,0.8,'F');else doc.circle(x,yy,2.6,'F');font(txt.length>2?5.5:6.5,'bold',[255,255,255]);doc.text(txt,x+(sq&&txt.length>2?0.9:0),yy+0.9,{align:'center'})};
  const img=(src,w0,h0,maxW,maxH)=>{if(!src)return;let w=Math.min(maxW,CW),hh=w*h0/w0;if(hh>maxH){hh=maxH;w=hh*w0/h0}ensure(hh+2);doc.addImage(src,src.startsWith('data:image/png')?'PNG':'JPEG',M,y,w,hh);y+=hh+3};
  const k=state.kandidaat,s=state.schip,it=orderedItems();
  const signImgs={},signPng={};for(const code of new Set(state.borden.map(b=>b.code))){const cv=await svgToImg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'+(SIGNS[code]||SIGNS.EIGEN).s+'</svg>',200);if(cv){signImgs[code]=cv;signPng[code]=cv.toDataURL('image/png')}}
  const cov=renderMapCanvas(1050,1485,{cover:true,bounds:[-1500,-1400,1800,1500]});doc.addImage(cov.toDataURL('image/jpeg',0.85),'JPEG',0,0,W,H);
  doc.setFillColor(255,255,255);doc.setDrawColor(200,208,216);doc.setLineWidth(0.4);doc.roundedRect(14,20,W-28,H-40,4,4,'FD');
  if(LOGO.b)doc.addImage(LOGO.b,'PNG',W/2-15,38,30,30);
  font(9,'normal',MUT);doc.text('Casus praktijktoets 3 SOR',W/2,14,{align:'center'});
  doc.setCharSpace(1.2);font(36,'bold',INK);doc.text('FLAGSHIP',W/2,92,{align:'center'});font(15,'bold',ACC);doc.setCharSpace(2.4);doc.text('ACADEMY',W/2,101,{align:'center'});doc.setCharSpace(0.5);
  font(19,'bold',INK);doc.text('CASUS PRAKTIJKTOETS 3',W/2,136,{align:'center'});doc.setCharSpace(0);
  font(13.5,'normal',MUT);doc.text('Schipper Open Rondvaartboot',W/2,147,{align:'center'});doc.text('Beperkt Vaargebied',W/2,154,{align:'center'});
  let cy=176;[['Naam',k.naam],['Geboortedatum',k.geboortedatum],['CBR-relatienummer',k.cbr]].forEach(([a,b])=>{font(9.5,'bold',MUT);doc.text(a.toUpperCase(),W/2,cy,{align:'center'});font(14,'normal',INK);doc.text(clean(b||'-'),W/2,cy+6.5,{align:'center'});cy+=17});
  const today=new Date().toLocaleDateString('nl-NL',{day:'numeric',month:'long',year:'numeric'});font(10,'normal',MUT);doc.text(clean('Opgesteld op '+today+' door '+(k.naam||'de kandidaat')),W/2,H-34,{align:'center'});doc.text('naar de richtlijnen van het CBR',W/2,H-29,{align:'center'});
  newPage();h1('Vaarroute');
  const mh=132;const mc=renderMapCanvas(1800,Math.round(1800*mh/CW),{signImgs});doc.addImage(mc.toDataURL('image/png'),'PNG',M,y,CW,mh);doc.setDrawColor(...LINE);doc.setLineWidth(0.3);doc.rect(M,y,CW,mh);y+=mh+4;
  let lx=M+3;[['Route',[194,24,122],'',0],['Brug',GRN,'1',0],['Aandachtspunt',INK,'A',0],['Meldpunt',RED,'M',1],['Manoeuvre',ACC,'K',1],['Bezienswaardigheid',VIO,'B',0]].forEach(([t,col,sym,sq])=>{if(!sym){doc.setDrawColor(...col);doc.setLineWidth(1.2);doc.line(lx-2.5,y+1,lx+2.5,y+1)}else dot(lx,y+1,col,sym,sq);font(8.5,'normal',MUT);doc.text(t,lx+4.5,y+2.2);lx+=4.5+doc.getTextWidth(t)+7});y+=7;
  const d=duration();
  kv('Opstaplocatie',state.opstap);kv('Schip',(s.naam||'')+(s.lengte?'  ·  '+nf(s.lengte)+' x '+nf(s.breedte)+' m':'')+(s.hoogte?'  ·  hoogte '+nf(s.hoogte)+' m':'')+(s.diepgang?'  ·  diepgang '+nf(s.diepgang)+' m':'')+(s.pax?'  ·  max. '+s.pax+' passagiers':''));
  if((state.route.motivatie||'').trim()){h2('Motivatie voor deze vaarroute');para(state.route.motivatie)}
  if(CITY.toel&&(state.toelichting.waterstand||'').trim()){h2('Waterstand');para(state.toelichting.waterstand)}
  if(CITY.toel&&(state.toelichting.brughoogte||'').trim()){h2('Brughoogtes');para(state.toelichting.brughoogte)}
  if(R&&R.ok){kv('Routelengte',nf(R.len/1000,2)+' km');kv('Geschatte duur',Math.round(d.total)+' minuten (vaartijd '+Math.round(d.vaart)+' min bij '+nf(state.snelheid,1)+' km/u, plus manoeuvres)')}
  if(it.meld.length){h2('Meldpunten');it.meld.forEach(o=>{ensure(7);dot(M+2.6,y+2.4,RED,o.lbl,1);para(o.it.melding?'"'+o.it.melding+'"':'(nog geen melding)',{indent:8,after:0.8,style:'bold'});if(o.it.manoeuvre)para(o.it.manoeuvre,{indent:8,size:10,color:MUT,after:1.8})})}
//#if groningen,utrecht,gebied
  if(R&&R.ok&&R.bridges.length){h2('Bruggen op de route');const col=CW/2;const rows=Math.ceil(R.bridges.length/2);const rh=5.6;if(y+rows*rh>H-M-6)newPage();const sy=y;R.bridges.forEach((f,i)=>{const c2=i>=rows?1:0;const r2=c2?i-rows:i;const yy=sy+r2*rh;dot(M+2.6+c2*col,yy+2.2,GRN,String(i+1));font(9.5,'normal',INK);doc.text(clean(doc.splitTextToSize(bridgeLabel(f.br)+'',col-10)[0]),M+7+c2*col,yy+3.3)});y=sy+rows*rh+3}
//#elif amsterdam,portaal
  if(R&&R.ok&&R.bridges.length){h2('Bruggen op de route');const col=CW/2;const rows=Math.ceil(R.bridges.length/2);const rh=5.6;if(y+rows*rh>H-M-6)newPage();const sy=y;R.bridges.forEach((f,i)=>{const c2=i>=rows?1:0;const r2=c2?i-rows:i;const yy=sy+r2*rh;dot(M+2.6+c2*col,yy+2.2,GRN,String(i+1));font(9.5,'normal',INK);doc.text(clean(doc.splitTextToSize(bridgeLabel(f.br)+(f.br.ref?' (brug '+f.br.ref+')':''),col-10)[0]),M+7+c2*col,yy+3.3)});y=sy+rows*rh+3}
//#endif
  newPage();h1('1. Aandachtspunten op de route');
  if(!it.aand.length)para('Nog geen aandachtspunten beschreven.',{color:MUT});
  for(const o of sortByRoute(state.aandacht,a=>a.pos).map((o,n)=>({a:o.it,n}))){const a=o.a;ensure(16);dot(M+2.6,y+2.8,INK,'A'+(o.n+1));font(11,'bold',INK);const tl=doc.splitTextToSize(clean(a.titel||catName(a.cat[0])||'Aandachtspunt'),CW-9);tl.forEach((l,i)=>doc.text(l,M+8,y+4+i*5));y+=tl.length*5+1;if(a.cat.length)para(a.cat.map(catName).join(' · '),{indent:8,size:9,color:MUT,after:1});para(a.tekst||'-',{indent:8});if(a.foto){const src=await photoSrc(a.foto);if(src)img(src,a.foto.w,a.foto.h,95,70)}y+=1.5}
//#if groningen,utrecht,gebied
  if(R&&R.ok&&R.bridges.length){h2('Bruggen op de route');const cols=[['#',9],['Brug',120],['Type',49]];if(CITY.bh){cols[1][1]-=35;cols[cols.length-1][1]=36;cols.push(['Streefpeil',24],['Doorvaarth.',24])}const th=()=>{ensure(8);doc.setFillColor(...SOFT);doc.rect(M,y,CW,6.5,'F');font(8,'bold',MUT);let x=M+1.5;cols.forEach(([t,w])=>{doc.text(t.toUpperCase(),x,y+4.4);x+=w});y+=7};th();
    R.bridges.forEach((f,i)=>{const b=f.br,st=bridgeStatus(b);const cells=[String(i+1),bridgeLabel(b),(b.mv?'beweegbaar':'vast')+(b.k===2?', spoor':'')];if(CITY.bh){const v=bhVal(b.key);cells.push(v.peil==null?'-':nf(v.peil),v.h==null?'-':nf(v.h))}font(9,'normal',INK);const nl=doc.splitTextToSize(clean(cells[1]),cols[1][1]-2);const rh=Math.max(1,nl.length)*4.2+2;if(y+rh>H-M-6){newPage();th()}let x=M+1.5;cells.forEach((c,ci)=>{if(ci===1)nl.forEach((l,li)=>doc.text(l,x,y+3.6+li*4.2));else{if(ci===6&&st.k==='err')doc.setTextColor(...RED);else if(ci===6&&st.k==='warn')doc.setTextColor(168,106,0);else doc.setTextColor(...INK);doc.text(clean(c),x,y+3.6)}x+=cols[ci][1]});doc.setDrawColor(...LINE);doc.setLineWidth(0.2);doc.line(M,y+rh,M+CW,y+rh);y+=rh});
//#elif amsterdam,portaal
  if(R&&R.ok&&R.bridges.length){h2('Bruggen op de route');const cols=[['#',9],['Brug',100],['Nr.',20],['Type',49]];if(CITY.bh){cols[1][1]-=35;cols[cols.length-1][1]=36;cols.push(['Streefpeil',24],['Doorvaarth.',24])}const th=()=>{ensure(8);doc.setFillColor(...SOFT);doc.rect(M,y,CW,6.5,'F');font(8,'bold',MUT);let x=M+1.5;cols.forEach(([t,w])=>{doc.text(t.toUpperCase(),x,y+4.4);x+=w});y+=7};th();
    R.bridges.forEach((f,i)=>{const b=f.br,st=bridgeStatus(b);const cells=[String(i+1),bridgeLabel(b),b.ref||'-',(b.mv?'beweegbaar':'vast')+(b.k===2?', spoor':'')];if(CITY.bh){const v=bhVal(b.key);cells.push(v.peil==null?'-':nf(v.peil),v.h==null?'-':nf(v.h))}font(9,'normal',INK);const nl=doc.splitTextToSize(clean(cells[1]),cols[1][1]-2);const rh=Math.max(1,nl.length)*4.2+2;if(y+rh>H-M-6){newPage();th()}let x=M+1.5;cells.forEach((c,ci)=>{if(ci===1)nl.forEach((l,li)=>doc.text(l,x,y+3.6+li*4.2));else{if(ci===6&&st.k==='err')doc.setTextColor(...RED);else if(ci===6&&st.k==='warn')doc.setTextColor(168,106,0);else doc.setTextColor(...INK);doc.text(clean(c),x,y+3.6)}x+=cols[ci][1]});doc.setDrawColor(...LINE);doc.setLineWidth(0.2);doc.line(M,y+rh,M+CW,y+rh);y+=rh});
//#endif
    y+=2}
  if(state.borden.length){h2('Verkeerstekens op de route');state.borden.forEach(b=>{const sz=16;const tx=[b.code==='EIGEN'&&b.naam?b.naam:'',b.locatie?'Waar: '+b.locatie:'',b.uitleg||''].filter(Boolean).join('\n');font(10,'normal',INK);const nlines=doc.splitTextToSize(clean(tx||'-'),CW-sz-5).length;ensure(Math.max(sz,nlines*lh(10))+3);if(signPng[b.code])doc.addImage(signPng[b.code],'PNG',M,y,sz,sz);const y0=y;para(tx||'-',{indent:sz+4,size:10,after:0});y=Math.max(y,y0+sz)+3})}
  h1('2. Bijzondere manoeuvres');para('Hiervan kan tijdens de toets worden afgeweken.',{size:9.5,color:MUT});
  MANS.forEach(M_=>{const x=state.manoeuvres[M_.k];ensure(14);dot(M+3,y+2.8,ACC,M_.code,1);font(11,'bold',INK);doc.text(clean(M_.t),M+9,y+4);y+=6.5;if(x.pos){const nm=nearName(x.pos);para('Locatie: '+(nm||'zie kaart')+' (op de kaart: '+M_.code+')',{indent:9,size:9.5,color:MUT,after:1})}para(x.tekst||'Nog niet beschreven.',{indent:9})});
  if(CITY.marifoon){
  h1('3 en 4. Meldpunten met de marifoon');
  if(!it.meld.length)para('Nog geen meldpunten.',{color:MUT});
  it.meld.forEach(o=>{ensure(14);dot(M+2.8,y+2.8,RED,o.lbl,1);font(11,'bold',INK);doc.text(clean(o.it.melding?'"'+o.it.melding+'"':'(nog geen melding)'),M+9,y+4);y+=6.5;const nm=nearName(o.pos);if(nm)para('Plaats: '+nm,{indent:9,size:9.5,color:MUT,after:1});para('Manoeuvre: '+(o.it.manoeuvre||'-'),{indent:9})});
  }else{const tl=state.toelichting;h1('3. Melden met de marifoon');para('In '+CITY.naam+' wordt op deze route geen marifoon gebruikt om te melden.',{size:9.5,color:MUT});h2('3a. Waarom hoeft er op deze route nergens gemeld te worden?');para(tl.mariWaarom||'-');h2('3b. Waar staat beschreven wanneer een marifoon verplicht is?');para(tl.mariWaar||'-');h1('4. Calamiteiten');h2('4a. Hoe handel je tijdens een calamiteit en welke manoeuvres maak je?');para(tl.calamiteit||'-')}
  const t=state.teksten;newPage();h1('5. Welkomstwoord');h2('Nederlands');para(fillName(t.welkomNL)||'-');if((t.welkomEN||'').trim()){h2('English');para(fillName(t.welkomEN))}
  h1('6. Bezienswaardigheden');t.bez.forEach((b,n)=>{h2('B'+(n+1)+'. '+(b.titel||'Bezienswaardigheid'));if((b.nl||'').trim())para(b.nl);if((b.en||'').trim())para(b.en,{color:MUT,style:'italic'})});if(!t.bez.length)para('Nog niet beschreven.',{color:MUT});
  h1('7. Slotwoord');h2('Nederlands');para(fillName(t.slotNL)||'-');if((t.slotEN||'').trim()){h2('English');para(fillName(t.slotEN))}
  const v=state.veiligheid;newPage();h1('8. Reddingsmiddelen aan boord');
  kv('Reddingsvesten',(v.vesten!=null?v.vesten+' stuks':'-')+(v.vestenLoc?'. '+v.vestenLoc:''));kv('Bemanning',(v.crew!=null?v.crew+' vesten':'-')+(v.crewType?'. '+v.crewType:''));kv('Reddingsboeien',v.boeien!=null?v.boeien+' stuks':'-');kv('Pikhaak',v.pikhaak?'Aanwezig':'Niet aanwezig');kv('EHBO-kit',v.ehboLoc);if(v.overig)kv('Overig',v.overig);y+=2;for(const f of (v.fotos||[])){const src=await photoSrc(f);if(src)img(src,f.w,f.h,80,62)}
  h1('9. Pictogram verbanddoos');ensure(26);doc.setFillColor(22,155,85);doc.roundedRect(M,y,20,20,1.5,1.5,'F');doc.setFillColor(255,255,255);doc.rect(M+8,y+4,4,12,'F');doc.rect(M+4,y+8,12,4,'F');font(10.5,'normal',INK);doc.text('Wit kruis op een groen vlak (ISO 7010, E003).',M+25,y+8);if(v.ehboLoc)doc.text(clean('Aan boord: '+v.ehboLoc),M+25,y+14);y+=26;
  h1('10. Brandblusser in de passagiersruimte');kv('Type',BLUS_NAMES[v.blusType]||'-');kv('Plaats',v.blusLoc);
  h1('11. Blussende werking');para((v.werking||[]).length?(v.werking.map(x=>WERK_NAMES[x]).join(', ')+'.'):'-');if(v.werkingToel)para(v.werkingToel,{color:MUT});
  const mi=state.milieu;h1('12. Energiebesparende maatregelen');para(mi.maatregelen||'-');
  h1('13. Gelden deze maatregelen ook bij elektrisch varen?');para((mi.elektrisch?(mi.elektrisch==='ja'?'Ja. ':'Nee. '):'')+(mi.elektrischToel||''));
  h1('14. Wat wordt bedoeld met 0% uitstoot?');para(mi.nul||'-');
  h1('15. Ontwikkelingen in milieuvriendelijke aandrijvingen');para(mi.ontw||'-');
  y+=4;para('Let op: het kan zijn dat er tijdens de praktijktoets wordt afgeweken van deze vaarroute.',{size:9.5,color:MUT,style:'italic'});
  {const bt=CITY.boats&&BOATS.find(b=>b.id===s.preset&&b.cvo);if(bt){const du=await cvoDataUrl(bt.id);if(du){newPage();h1('Bijlage: CVO '+bt.naam+' (pagina 2)');const maxH=H-y-M-8;let w=CW,hh=w*bt.cvo[1]/bt.cvo[0];if(hh>maxH){hh=maxH;w=hh*bt.cvo[0]/bt.cvo[1]}doc.addImage(du,'JPEG',M+(CW-w)/2,y,w,hh);y+=hh}}}
  const n=doc.getNumberOfPages();for(let i=2;i<=n;i++){doc.setPage(i);if(LOGO.s)doc.addImage(LOGO.s,'PNG',W-M-7,4,7,7);font(8.5,'normal',MUT);doc.text('Casus praktijktoets 3 SOR',W/2,9.5,{align:'center'});doc.text(clean(k.naam||''),M,9.5);doc.text(String(i),W/2,H-8,{align:'center'});doc.setDrawColor(...LINE);doc.setLineWidth(0.25);doc.line(M,12.5,W-M,12.5)}
  return doc.output('blob')}
let pdfBusy=false;
async function cvoDataUrl(id){try{const r=await fetch(CITY.assets+'assets/cvo/'+id+'.jpg');if(!r.ok)return null;const b=await r.blob();return await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(b)})}catch(e){return null}}
async function downloadPdf(){if(pdfBusy)return;pdfBusy=true;const btn=$('#btnPdf');if(btn){btn.disabled=true;btn.textContent='PDF maken…'}try{const blob=await buildPdf();await saveFile('Casus SOR praktijktoets 3 '+safeName(state.kandidaat.naam)+'.pdf',blob)}catch(e){console.error(e);toast(e&&e.message==='lib'?'De PDF-bibliotheek is niet geladen. Controleer je internetverbinding en herlaad de pagina.':'Het maken van de PDF is mislukt.',true)}finally{pdfBusy=false;if(btn){btn.disabled=false;btn.textContent='PDF downloaden'}}}

