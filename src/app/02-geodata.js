/* ---------- geodata ---------- */
//#if amsterdam,portaal
const LAT0=52.371,LON0=4.8965,KX=68115,KY=111274;
//#elif groningen
const LAT0=53.219,LON0=6.568,KX=66797,KY=111290;
//#elif utrecht
const LAT0=52.090,LON0=5.121,KX=68540,KY=111269;
//#elif gebied
const LAT0=__GEB.proj[0],LON0=__GEB.proj[1],KX=__GEB.proj[2],KY=__GEB.proj[3];
//#endif
const toLL=p=>[LAT0+p[1]/KY,LON0+p[0]/KX];
const fromLL=ll=>[(ll.lng-LON0)*KX,(ll.lat-LAT0)*KY];
const m2=(lat,lon)=>[(lon-LON0)*KX,(lat-LAT0)*KY];
function decLine(g){const n=g.split(',');let x=+n[0],y=+n[1];const p=[[x,y]];for(let i=2;i<n.length;i+=2){x+=+n[i];y+=+n[i+1];p.push([x,y])}return p}
const D=window.SOR_DATA;
const NAMES=D.names.split('~');
const WAYS=D.ways.split(';').map(s=>{const k=s.indexOf('/');const m=s.slice(0,k).split(':');return{n:+m[0],o:+(m[1]||0),ty:m[2]||'c',mw:+(m[3]||0),ml:+(m[4]||0),md:+(m[5]||0),lk:m[6]||'',pts:decLine(s.slice(k+1))}});
const wayName=wi=>(wi!=null&&wi>=0&&WAYS[wi]&&WAYS[wi].n>=0)?NAMES[WAYS[wi].n]:'';
//#if groningen,utrecht,gebied
const HIDE_ST=new Set([]);
const BR_FIX={};
const BR_POSFIX={};
//#elif amsterdam,portaal
const HIDE_ST=new Set(['Grachtenvlinder','Liefdesverklaring','De Oase','De Octopus','abel weetnietburg']);
const BR_FIX={'Armbrug':{ref:'208'},'Oudekerksbrug':{ref:'206'},'Sint-Jansbrug':{ref:'205'},'Varkenssluis':{ref:'204'},'Sleutelbrug':{ref:'201'},'Aluminiumbrug':{ref:'222'},'Doelensluis':{ref:'220'},'Odebrug':{ref:'2358'},'Zandbrug':{ref:'225',force:true},'Niezelbrug':{ref:'207',nm:'Niezelbrug (Liesdelsluis)'}};
const BR_POSFIX={'-261,-210':{nm:'Grimnessesluis',ref:'202'},'401,629':{nm:'Kolkwaterkeringbrug',ref:'301'}};
//#endif
const BRIDGES=D.bridges.split(';').map(s=>{const f=s.split('~');return{x:+f[0],y:+f[1],nm:f[2]||'',ref:(f[3]||'').replace(/^brug\s*/i,''),st:f[4]||'',k:+(f[5]||0),mv:f[6]==='1'}}).filter(b=>!HIDE_ST.has(b.st)).map(b=>{b.key=b.x+','+b.y;const fx=BR_FIX[b.nm];if(fx){if(fx.ref&&(!b.ref||fx.force))b.ref=fx.ref;if(fx.nm)b.nm=fx.nm}const pf=BR_POSFIX[b.key];if(pf){b.nm=pf.nm;b.ref=pf.ref}return b});
const bridgeLabel=b=>b.nm||((b.k===2?'Spoorbrug':'Brug')+(b.st?' '+b.st:''));
const bridgeType=b=>[b.mv?'beweegbaar':'vast',b.k===2?'spoor':(b.k===1?'voet/fiets':'weg')].join(' · ');
const LABELS=D.labels.split(';').map(s=>{const f=s.split(',').map(Number);return{n:NAMES[f[0]],x:f[1],y:f[2],a:f[3],t:f[4]}});
const WATER=D.water.split(';').map(f=>{const rings=f.split('|').map(decLine);let a=1e9,b=1e9,c=-1e9,d=-1e9;rings.forEach(r=>r.forEach(p=>{a=Math.min(a,p[0]);b=Math.min(b,p[1]);c=Math.max(c,p[0]);d=Math.max(d,p[1])}));return{rings,bb:[a,b,c,d]}});
const ST=window.SOR_STREETS||{names:'',lines:''};const SNAMES=ST.names.split('~');
const STREETS=ST.lines?ST.lines.split(';').map(s=>{const k=s.indexOf('/');const m=s.slice(0,k).split(':');return{c:+m[0],n:(m[1]!=null&&m[1]!=='')?+m[1]:-1,pts:decLine(s.slice(k+1))}}):[];
const SLABELS=(()=>{const out=[];STREETS.forEach(l=>{if(l.n<0)return;let best=null;for(let i=1;i<l.pts.length;i++){const a=l.pts[i-1],b=l.pts[i];const d=dist(a,b);if(!best||d>best.d)best={d,a,b}}if(!best||best.d<50)return;let ang=Math.atan2(best.b[1]-best.a[1],best.b[0]-best.a[0])*180/Math.PI;if(ang>90)ang-=180;if(ang<-90)ang+=180;out.push({n:SNAMES[l.n],x:(best.a[0]+best.b[0])/2,y:(best.a[1]+best.b[1])/2,a:ang,d:best.d,c:l.c})});out.sort((p,q)=>q.d-p.d);const kept=[];for(const l of out){if(kept.some(k=>k.n===l.n&&Math.hypot(k.x-l.x,k.y-l.y)<380))continue;if(kept.some(k=>Math.hypot(k.x-l.x,k.y-l.y)<45))continue;kept.push(l)}return kept})();
//#if amsterdam,portaal
const POIS=[['Sea Palace',52.37576,4.90629],['NEMO',52.37385,4.91211],['Amsterdam Centraal',52.3789,4.90058],['Waag',52.37277,4.90032],['Oude Kerk',52.37436,4.89807],['Rembrandthuis',52.36937,4.90125],['Montelbaanstoren',52.37204,4.90566],['Munttoren',52.36706,4.89322],['Koninklijk Paleis',52.37314,4.89134],['Het Scheepvaartmuseum',52.37201,4.91479],['Schreierstoren',52.37636,4.90224],['Zuiderkerk',52.37029,4.89975],['Westerkerk',52.37456,4.88392],['Anne Frank Huis',52.37515,4.8841],['Rijksmuseum',52.35986,4.885],['Hortus Botanicus',52.36664,4.90778],['Oost-Indisch Huis',52.371,4.89803],["Ons' Lieve Heer op Solder",52.37517,4.89937],['Magere Brug',52.36358,4.90236],['Scheepvaarthuis',52.37432,4.90413],['Portugese Synagoge',52.36754,4.90534],['Joods Museum',52.36715,4.90382],['Nieuwe Kerk',52.37392,4.89169],["H'ART Museum",52.36565,4.90221],['Allard Pierson',52.36881,4.89305]].map(p=>({n:p[0],pos:m2(p[1],p[2])}));
const WAY_RESTR={31:{ml:14,mw:3.75,src:'bord bij de Grimnessesluis'}};
//#elif groningen
const POIS=[['Martinitoren',53.21944,6.56823],['Groningen Centraal',53.21055,6.56417],['Groninger Museum',53.21236,6.56621],['Grote Markt',53.21858,6.56750],['Der Aa-kerk',53.21903,6.56222],['Academiegebouw',53.21925,6.56306],['Prinsenhof',53.22131,6.56894],['Forum Groningen',53.21772,6.57028],['Noorderplantsoen',53.22444,6.55917]].map(p=>({n:p[0],pos:m2(p[1],p[2])}));
const WAY_RESTR={};
//#elif utrecht
const POIS=[['Domtoren',52.09079,5.12138],['Utrecht Centraal',52.08914,5.10999],['Stadhuis',52.09176,5.11954],['Janskerk',52.09372,5.12268],['Pieterskerk',52.09049,5.12473],['Centraal Museum',52.08355,5.12567],['TivoliVredenburg',52.09263,5.11311],['Neude',52.0934,5.1192]].map(p=>({n:p[0],pos:m2(p[1],p[2])}));
const WAY_RESTR={};
//#elif gebied
const POIS=(__GEB.pois||[]).map(p=>({n:p[0],pos:m2(p[1],p[2])}));
const WAY_RESTR={};
//#endif
const EX_MELD=[
 {key:'m-antonie',pos:[380,-85],melding:'Oudeschans, Antonie Zwanenburgwal',manoeuvre:'Versmalling die je goed open moet varen, zodat je tegenliggend verkeer kunt zien.'},
 {key:'m-europe',pos:[-120,-414],melding:"L'Europe, Rokin op",manoeuvre:'Bocht waar je tegenverkeer niet goed kunt zien: goed stuurboord houden en niet te snel varen.'},
 {key:'m-kolkin',pos:[250,500],melding:'Oudezijds Kolkje in',manoeuvre:'Versmalling waar maar één boot tegelijk door kan, maar wel tweerichtingsverkeer: goed open varen.'},
 {key:'m-kolkuit',pos:[395,625],melding:'Kolkje, Open Haven stuurboord uit',manoeuvre:'Rustig uitvaren, stil liggen tussen het einde van de brug en de twee palen die daarna volgen. Kijken en dan naar stuurboord.'}];
const CATS=[{id:'engte',t:'Engtes',s:'Engte'},{id:'brug',t:'Bruggen',s:'Brug'},{id:'passage',t:'Bijzondere passages',s:'Bijzondere passage'},{id:'kruisend',t:'Kruisende vaarwateren',s:'Kruisend vaarwater'},{id:'draai',t:'Scherpe draaimomenten',s:'Scherp draaimoment'},{id:'teken',t:'Verkeerstekens',s:'Verkeersteken'},{id:'eenrichting',t:'Eenrichtingsverkeer',s:'Eenrichtingsverkeer'}];
const catName=id=>(CATS.find(c=>c.id===id)||{s:''}).s;
const MANS=[
 {k:'keren',code:'K',t:'Keren op nauw vaarwater',tip:'Kies een smalle plek waar keren nog net kan, bijvoorbeeld bij een verbreding of een steiger.'},
 {k:'achteruitBrug',code:'AB',t:'Achteruit door een brug varen',tip:'Kies een brug zonder druk verkeer, waar je recht achteruit doorheen kunt.'},
 {k:'aanmeren',code:'AM',t:'Aanmeren',tip:'Kies een steiger of kade waar aanleggen mag.'},
 {k:'vijfLengtes',code:'5L',t:'Vijf scheepslengtes achteruit in nauw vaarwater',tip:'Kies een smalle gracht waar je niet kunt keren.'}];
const BOATS=[{id:'agatha',naam:"Agatha",lengte:null,breedte:null,pax:null,cvo:[636,893]},{id:'amelie-zahra',naam:"Amelie Zahra",lengte:null,breedte:null,pax:null,cvo:[642,902]},{id:'amigo',naam:"Amigo",lengte:null,breedte:null,pax:null,cvo:[658,902]},{id:'apsara',naam:"Apsara",lengte:null,breedte:null,pax:null,cvo:[639,892]},{id:'atlantis',naam:"Atlantis",lengte:null,breedte:null,pax:null,cvo:[652,899]},{id:'barracuda',naam:"Barracuda",lengte:null,breedte:null,pax:null,cvo:[638,886]},{id:'bartolotti',naam:"Bartolotti",lengte:null,breedte:null,pax:null,cvo:[642,894]},{id:'creusen-1',naam:"Creusen 1",lengte:null,breedte:null,pax:null,cvo:[638,890]},{id:'dirck-van-os',naam:"Dirck van Os",lengte:null,breedte:null,pax:null,cvo:[642,899]},{id:'dude',naam:"Dude",lengte:null,breedte:null,pax:null,cvo:[655,899]},{id:'dutchman',naam:"Dutchman",lengte:null,breedte:null,pax:null,cvo:[624,884]},{id:'eve',naam:"Eve",lengte:null,breedte:null,pax:null,cvo:[626,887]},{id:'eveline',naam:"Eveline",lengte:null,breedte:null,pax:null,cvo:[646,895]},{id:'fayen',naam:"Fayen",lengte:null,breedte:null,pax:null,cvo:[641,901]},{id:'flagship',naam:"Flagship",lengte:null,breedte:null,pax:null,cvo:[655,893]},{id:'fleur',naam:"Fleur",lengte:null,breedte:null,pax:null,cvo:[632,876]},{id:'freewilly',naam:"FreeWilly",lengte:8.61,breedte:3,pax:38,cvo:[910,1286],vol:true},{id:'gast',naam:"Gast",lengte:null,breedte:null,pax:null,cvo:[655,894]},{id:'green-marine',naam:"Green Marine",lengte:null,breedte:null,pax:null,cvo:[636,891]},{id:'griffioen',naam:"Griffioen",lengte:null,breedte:null,pax:null,cvo:[655,894]},{id:'harry-slinger',naam:"Harry Slinger",lengte:null,breedte:null,pax:null,cvo:[636,893]},{id:'herman-brood',naam:"Herman Brood",lengte:null,breedte:null,pax:null,cvo:[705,898]},{id:'hilda',naam:"Hilda",lengte:null,breedte:null,pax:null,cvo:[660,902]},{id:'iris',naam:"Iris",lengte:null,breedte:null,pax:null,cvo:[646,890]},{id:'jan-van-der-heijden',naam:"Jan van der Heijden",lengte:null,breedte:null,pax:null,cvo:[659,894]},{id:'jean-schmitz',naam:"Jean Schmitz",lengte:null,breedte:null,pax:null,cvo:[680,896]},{id:'koning',naam:"Koning",lengte:null,breedte:null,pax:null,cvo:[676,901]},{id:'lucky-stripper',naam:"Lucky Stripper",lengte:null,breedte:null,pax:null,cvo:[643,890]},{id:'majestic',naam:"Majestic",lengte:null,breedte:null,pax:null,cvo:[640,892]},{id:'mana',naam:"Mana",lengte:null,breedte:null,pax:null,cvo:[644,900]},{id:'manhattan',naam:"Manhattan",lengte:null,breedte:null,pax:null,cvo:[645,901]},{id:'meike',naam:"Meike",lengte:9.96,breedte:3.07,pax:35,cvo:[646,892]},{id:'monne-de-miranda',naam:"Monne de Miranda",lengte:null,breedte:null,pax:null,cvo:[668,903]},{id:'naut',naam:"Naut",lengte:null,breedte:null,pax:null,cvo:[647,892]},{id:'nomag',naam:"Nomag",lengte:null,breedte:null,pax:null,cvo:[646,901]},{id:'old-queen',naam:"Old Queen",lengte:null,breedte:null,pax:null,cvo:[630,900]},{id:'papi',naam:"Papi",lengte:null,breedte:null,pax:null,cvo:[641,897]},{id:'pax',naam:"Pax",lengte:null,breedte:null,pax:null,cvo:[635,895]},{id:'roos-salon',naam:"Roos Salon",lengte:null,breedte:null,pax:null,cvo:[655,898]},{id:'rosalie',naam:"Rosalie",lengte:null,breedte:null,pax:null,cvo:[634,891]},{id:'royalty',naam:"Royalty",lengte:null,breedte:null,pax:null,cvo:[637,901]},{id:'russian-star',naam:"Russian Star",lengte:null,breedte:null,pax:null,cvo:[652,898]},{id:'saloonsloep',naam:"Saloonsloep",lengte:null,breedte:null,pax:null,cvo:[643,892]},{id:'simon',naam:"Simon",lengte:null,breedte:null,pax:null,cvo:[690,902]},{id:'sloepvrienden',naam:"Sloepvrienden",lengte:9.95,breedte:3.15,pax:42,cvo:[910,1286],vol:true},{id:'sofia',naam:"Sofia",lengte:null,breedte:null,pax:null,cvo:[674,893]},{id:'stella-maris',naam:"Stella Maris",lengte:null,breedte:null,pax:null,cvo:[647,890]},{id:'swaen',naam:"Swaen",lengte:null,breedte:null,pax:null,cvo:[652,895]},{id:'theo-kok',naam:"Theo Kok",lengte:null,breedte:null,pax:null,cvo:[652,892]},{id:'tijd-zal-het-leren',naam:"Tijd zal het leren",lengte:null,breedte:null,pax:null,cvo:[629,901]},{id:'titanic',naam:"Titanic",lengte:null,breedte:null,pax:null,cvo:[644,896]},{id:'vibe',naam:"Vibe",lengte:null,breedte:null,pax:null,cvo:[645,899]},{id:'vording',naam:"Vording",lengte:null,breedte:null,pax:null,cvo:[633,892]},{id:'wolk',naam:"Wolk",lengte:null,breedte:null,pax:null,cvo:[632,888]}];

