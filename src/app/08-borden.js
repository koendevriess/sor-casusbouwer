/* ---------- signs & pictograms ---------- */
const SQ='<rect x="7" y="7" width="86" height="86" rx="4" fill="#fff" stroke="#d52b1e" stroke-width="9"/>';
const DG='<line x1="16" y1="16" x2="84" y2="84" stroke="#d52b1e" stroke-width="9"/>';
const SIGNS={
 'A.1':{n:'Verboden door te varen',s:'<rect x="4" y="16" width="92" height="68" fill="#d52b1e" stroke="#222" stroke-width="2"/><rect x="5" y="39" width="90" height="22" fill="#fff"/>'},
 'A.5':{n:'Verboden ligplaats te nemen',s:SQ+'<text x="50" y="71" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="56" fill="#111">P</text>'+DG},
 'A.7':{n:'Verboden vast te maken aan de oever',s:SQ+'<path d="M36 72h28V52c5-2 8-5 8-10H28c0 5 3 8 8 10z" fill="#111"/><rect x="30" y="72" width="40" height="7" fill="#111"/>'+DG},
 'A.9':{n:'Verboden hinderlijke golfslag te veroorzaken',s:SQ+'<path d="M22 42q7-8 14 0t14 0 14 0 14 0M22 60q7-8 14 0t14 0 14 0 14 0" fill="none" stroke="#111" stroke-width="6"/>'+DG},
 'A.10':{n:'Verboden buiten de aangegeven ruimte te varen',s:'<path d="M50 8 50 92 8 50z" fill="#d52b1e"/><path d="M50 8 92 50 50 92z" fill="#fff"/><path d="M50 8 92 50 50 92 8 50z" fill="none" stroke="#222" stroke-width="2.5"/>'},
 'B.1':{n:'Verplicht de richting van de pijl te volgen',s:SQ+'<path d="M20 50h44" stroke="#111" stroke-width="10"/><path d="M58 32l22 18-22 18z" fill="#111"/>'},
 'B.6':{n:'Verplicht de aangegeven snelheid niet te overschrijden',s:SQ+'<text x="50" y="68" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="48" fill="#111">6</text>'},
 'B.8':{n:'Verplicht bijzonder goed op te letten',s:SQ+'<rect x="44" y="22" width="12" height="56" fill="#111"/>'},
 'C.2':{n:'Vrije hoogte beperkt',s:SQ+'<path d="M50 30v40" stroke="#111" stroke-width="7"/><path d="M36 36l14-16 14 16zM36 64l14 16 14-16z" fill="#111"/>'},
 'C.3':{n:'Breedte van het vaarwater beperkt',s:SQ+'<path d="M30 50h40" stroke="#111" stroke-width="7"/><path d="M36 36L20 50l16 14zM64 36l16 14-16 14z" fill="#111"/>'},
 'D.1a':{n:'Aanbevolen doorvaartopening (beide richtingen)',s:'<path d="M50 8 92 50 50 92 8 50z" fill="#f5c400" stroke="#222" stroke-width="2.5"/>'},
 'D.1b':{n:'Aanbevolen doorvaartopening (tegenverkeer verboden)',s:'<path d="M27 24 48 50 27 76 6 50z" fill="#f5c400" stroke="#222" stroke-width="2"/><path d="M73 24 94 50 73 76 52 50z" fill="#f5c400" stroke="#222" stroke-width="2"/>'},
 'D.2':{n:'Aanbevolen binnen de aangegeven ruimte te blijven',s:'<path d="M50 8 50 92 8 50z" fill="#169b4f"/><path d="M50 8 92 50 50 92z" fill="#fff"/><path d="M50 8 92 50 50 92 8 50z" fill="none" stroke="#222" stroke-width="2.5"/>'},
 'EIGEN':{n:'Ander bord',s:'<rect x="7" y="7" width="86" height="86" rx="6" fill="#eef1f4" stroke="#9aa6b2" stroke-width="4" stroke-dasharray="8 6"/><text x="50" y="64" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="40" fill="#7b8794">?</text>'}};
const SIGN_KEYS=Object.keys(SIGNS);
const signSvg=code=>'<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+(SIGNS[code]||SIGNS.EIGEN).s+'</svg>';
const PICTO={a:'<rect x="5" y="5" width="90" height="90" rx="6" fill="#169b55"/><path d="M40 20h20v20h20v20H60v20H40V60H20V40h20z" fill="#fff"/>',b:'<rect x="5" y="5" width="90" height="90" rx="6" fill="#fff" stroke="#c9d1d9" stroke-width="3"/><path d="M40 20h20v20h20v20H60v20H40V60H20V40h20z" fill="#d52b1e"/>',c:'<rect x="5" y="5" width="90" height="90" rx="6" fill="#fff" stroke="#c9d1d9" stroke-width="3"/><path d="M40 20h20v20h20v20H60v20H40V60H20V40h20z" fill="#169b55"/>',d:'<rect x="5" y="5" width="90" height="90" rx="6" fill="#d52b1e"/><path d="M40 20h20v20h20v20H60v20H40V60H20V40h20z" fill="#fff"/>'};
const PICTO_LBL={a:'Wit kruis op groen vlak',b:'Rood kruis op wit vlak',c:'Groen kruis op wit vlak',d:'Wit kruis op rood vlak'};

