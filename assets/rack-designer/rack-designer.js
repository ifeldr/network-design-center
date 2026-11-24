/* =====================================================================
   Network Design Center — allestimento ed etichettatura degli armadi di rete, con planimetrie
   Pagina statica per GitHub Pages: progetto in localStorage, planimetrie in IndexedDB.
   ===================================================================== */
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,10);
const LET=i=>String.fromCharCode(65+i);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fmt=(n,d=1)=>Number(n).toLocaleString('it-IT',{maximumFractionDigits:d,minimumFractionDigits:0});
const STORE='rd-progetto-v1';
const VENDOR=new URL('assets/rack-designer/vendor/pdfjs/',document.baseURI).href;
const CAFFE='https://www.paypal.me/lorenzogarbi/1EUR';
const SITO='https://ifeldr.github.io';

/* ---------------- catalogo armadio ---------------- */
const CAT={
  fibra:{label:'Raccordo fibra ottica',rank:1,note:'dall\'alto'},
  rame:{label:'Raccordo rame',rank:2,note:'sotto la fibra'},
  attivi:{label:'Apparati attivi',rank:3,note:'primo spazio utile'},
  accessori:{label:'Ripiani e batterie',rank:4,note:'su ripiano'},
  alimentazione:{label:'Alimentazione',rank:5,note:'dal basso'},
  servizio:{label:'Passacavi e ciechi',rank:0,note:'ogni due unità'}
};
const KINDS={
  fo:{name:'Cassetto ottico',cat:'fibra',h:1,term:true,d:{ports:24,fiber:'OS2',use:'dorsale',dir:'arrivo',conn:'LC'}},
  patch:{name:'Patch panel rame',cat:'rame',h:1,term:true,d:{ports:24,cls:'Cat 6A'}},
  fw:{name:'Firewall',cat:'attivi',sub:1,h:1,d:{ports:8}},
  router:{name:'Router',cat:'attivi',sub:2,h:1,d:{ports:8}},
  sw:{name:'Switch',cat:'attivi',sub:3,h:1,d:{ports:24,sfp:4,poe:true}},
  hub:{name:'Hub',cat:'attivi',sub:4,h:1,d:{ports:16}},
  mc:{name:'Adattatore di segnale',cat:'attivi',sub:5,h:1,d:{ports:4}},
  srv:{name:'Server / NAS',cat:'attivi',sub:6,h:2,d:{size:2}},
  shelf:{name:'Mensola / ripiano',cat:'accessori',h:3,d:{real:2.5}},
  ups:{name:'Batterie / UPS',cat:'accessori',h:2,d:{size:2,onShelf:true}},
  unel:{name:'Multipresa Unel 16/32 A',cat:'alimentazione',h:1,d:{sockets:6}},
  vde:{name:'PDU serie VDE C13/C19',cat:'alimentazione',h:1,d:{c13:8,c19:2}},
  poe:{name:'Barra PoE',cat:'alimentazione',h:1,d:{ports:8}},
  cm:{name:'Passacavi metallico',cat:'servizio',h:1,d:{}},
  blank:{name:'Pannello cieco',cat:'servizio',h:1,d:{size:1,reserve:'none'}}
};
const TYPES={CD:{n:'Campus Distributor',it:'Armadio di campus',rank:0},BD:{n:'Building Distributor',it:'Armadio di edificio',rank:1},FD:{n:'Floor Distributor',it:'Armadio di piano',rank:2},LD:{n:'Local Distributor',it:'Armadio locale',rank:3}};
/* ---------------- catalogo planimetria ---------------- */
const ICO={
  rack:'<path d="M7 3h10v18H7zM9.5 7h5M9.5 11h5M9.5 15h5"/>',
  to:'<path d="M5 6h14v12H5z"/><path d="M9 18v-3h6v3M8.5 10h7"/>',
  ap:'<path d="M4.5 10.5a11 11 0 0 1 15 0M7.5 13.5a6.5 6.5 0 0 1 9 0"/><circle cx="12" cy="17" r="1.2"/>',
  cam:'<path d="M3 8h11v8H3zM14 11l7-3v8l-7-3"/>',
  altro:'<circle cx="12" cy="12" r="3.5"/>'
};
const DEV={
  to:{name:'Presa di rete (TO)',short:'Presa',desc:'Presa utente a muro, etichetta ABC.DE',col:'#0d6efd'},
  ap:{name:'Access point Wi-Fi',short:'Access point',desc:'Antenna wireless collegata a una presa',col:'#198754'},
  cam:{name:'Telecamera IP',short:'Telecamera',desc:'Videosorveglianza su presa di rete',col:'#6f42c1'},
  altro:{name:'Altro apparato',short:'Apparato',desc:'Stampante, terminale, pannello…',col:'#6c757d'}
};
const TCOL={CD:'#7a4df5',BD:'#0d6efd',FD:'#198754',LD:'#e5822a'};
const svgI=(k,extra='')=>`<svg viewBox="0 0 24 24" ${extra}>${ICO[k]}</svg>`;

/* ---------------- catalogo modelli per marca ----------------
   Rack: [marca, modello, tipo, U, porte RJ45, porte SFP/SFP+/QSFP, PoE, nota]
   In campo: [marca, modello, tipo (ap|cam|altro), nota]
   Dati dalle schede tecniche dei produttori; per gli apparati modulari si indica la configurazione base. */
const VENDORS={
  ubiquiti:{n:'Ubiquiti',logo:'UniFi',c:'#006fff'},
  mikrotik:{n:'MikroTik',logo:'MikroTik',c:'#d0312d'},
  hpe:{n:'HP / HPE',logo:'HPE',c:'#01a982'},
  aruba:{n:'Aruba',logo:'aruba',c:'#ff8300'},
  cisco:{n:'Cisco',logo:'cisco',c:'#049fd9'},
  zte:{n:'ZTE',logo:'ZTE',c:'#0066b3'},
  ruckus:{n:'Ruckus',logo:'RUCKUS',c:'#f58025'},
  synology:{n:'Synology',logo:'Synology',c:'#3a4b5c'},
  dell:{n:'Dell',logo:'DELL',c:'#007db8'},
  qnap:{n:'QNAP',logo:'QNAP',c:'#1f6fb5',bc:'#5aa9ff'},
  hikvision:{n:'Hikvision',logo:'HIKVISION',c:'#d7000f',bc:'#ff4d4d'},
  apc:{n:'APC',logo:'APC',c:'#3dcd58',bc:'#3dcd58'},
  eaton:{n:'Eaton',logo:'EATON',c:'#005eb8',bc:'#4da3ff'},
  fortinet:{n:'Fortinet',logo:'FORTINET',c:'#da291c',bc:'#ff5a4d'},
  sophos:{n:'Sophos',logo:'SOPHOS',c:'#0b5ed7',bc:'#6ea8fe'},
  watchguard:{n:'WatchGuard',logo:'WatchGuard',c:'#c8102e',bc:'#ff5a6e'},
  paloalto:{n:'Palo Alto Networks',logo:'paloalto',c:'#fa582d',bc:'#fa582d'},
  lenovo:{n:'Lenovo',logo:'Lenovo',c:'#e2231a',bc:'#ff5a52'},
  supermicro:{n:'Supermicro',logo:'SUPERMICRO',c:'#00a651',bc:'#3ddc84'},
  fujitsu:{n:'Fujitsu',logo:'FUJITSU',c:'#e60012',bc:'#ff4d5e'},
  tplink:{n:'TP-Link Omada',logo:'tp-link',c:'#0aa1b5',bc:'#36c6d6'},
  netgear:{n:'Netgear',logo:'NETGEAR',c:'#5c2d91',bc:'#b07ee8'},
  zyxel:{n:'Zyxel',logo:'ZYXEL',c:'#0068b7',bc:'#4da3ff'},
  dlink:{n:'D-Link',logo:'D-Link',c:'#00a0b0',bc:'#36c6d6'},
  juniper:{n:'Juniper / Mist',logo:'JUNIPER',c:'#6ba539',bc:'#8fd14f'},
  extreme:{n:'Extreme Networks',logo:'EXTREME',c:'#7b2fbe',bc:'#b884ef'},
  panduit:{n:'Panduit',logo:'PANDUIT',c:'#3a3a3a'},
  commscope:{n:'CommScope',logo:'CommScope',c:'#ff6a13'},
  legrand:{n:'Legrand',logo:'legrand',c:'#4d4d4f'},
  schneider:{n:'Schneider Electric',logo:'Schneider',c:'#3dcd58'},
  powertronix:{n:'Powertronix',logo:'POWERTRONIX',c:'#e30613',bc:'#ff4d4d'}
};
const RACK_MODELS=[
  // Ubiquiti
  ['ubiquiti','UniFi Dream Machine Pro (UDM-Pro)','fw',1,9,2,false,'gateway / firewall, 8 LAN + WAN'],
  ['ubiquiti','UniFi Dream Machine SE (UDM-SE)','fw',1,9,2,true,'gateway con 8 porte PoE'],
  ['ubiquiti','UniFi Dream Machine Pro Max (UDM-Pro-Max)','fw',1,9,2,false,'gateway / firewall'],
  ['ubiquiti','UniFi Gateway Pro (UXG-Pro)','fw',1,2,2,false,'gateway'],
  ['ubiquiti','EdgeRouter Infinity (ER-8-XG)','router',1,1,8,false,'router 8× SFP+'],
  ['ubiquiti','USW-24','sw',1,24,2,false,''],
  ['ubiquiti','USW-24-PoE','sw',1,24,2,true,'16 porte PoE+'],
  ['ubiquiti','USW-48','sw',1,48,4,false,''],
  ['ubiquiti','USW-48-PoE','sw',1,48,4,true,'32 porte PoE+'],
  ['ubiquiti','USW-16-PoE','sw',1,16,2,true,'8 porte PoE+'],
  ['ubiquiti','USW-Lite-16-PoE','sw',1,16,0,true,'8 porte PoE+'],
  ['ubiquiti','USW-Pro-24','sw',1,24,2,false,'uplink SFP+'],
  ['ubiquiti','USW-Pro-24-PoE','sw',1,24,2,true,'uplink SFP+'],
  ['ubiquiti','USW-Pro-48','sw',1,48,4,false,'uplink SFP+'],
  ['ubiquiti','USW-Pro-48-PoE','sw',1,48,4,true,'uplink SFP+'],
  ['ubiquiti','USW-Pro-Max-24','sw',1,24,2,false,'2,5 GbE + SFP+'],
  ['ubiquiti','USW-Pro-Max-24-PoE','sw',1,24,2,true,'2,5 GbE + SFP+'],
  ['ubiquiti','USW-Pro-Max-48-PoE','sw',1,48,4,true,'2,5 GbE + SFP+'],
  ['ubiquiti','USW-Enterprise-24-PoE','sw',1,24,2,true,'2,5 GbE + SFP+'],
  ['ubiquiti','USW-Enterprise-48-PoE','sw',1,48,4,true,'2,5 GbE + SFP+'],
  ['ubiquiti','USW-EnterpriseXG-24','sw',1,24,2,false,'10 GbE + SFP28'],
  ['ubiquiti','USW-Aggregation','sw',1,0,8,false,'8× SFP+'],
  ['ubiquiti','USW-Pro-Aggregation','sw',1,0,32,false,'28× SFP+ + 4× SFP28'],
  ['ubiquiti','EdgeSwitch 24 250W (ES-24-250W)','sw',1,24,2,true,''],
  ['ubiquiti','EdgeSwitch 48 500W (ES-48-500W)','sw',1,48,4,true,''],
  ['ubiquiti','UniFi NVR (UNVR)','srv',1,1,1,false,'NVR 4 dischi'],
  ['ubiquiti','UniFi NVR Pro (UNVR-Pro)','srv',2,1,1,false,'NVR 7 dischi'],
  ['ubiquiti','UniFi Patch Panel 24 (UACC-Rack-Panel-Patch-24)','patch',1,24,0,false,'patch panel Cat 6'],
  // Ubiquiti — modelli meno recenti (le porte combo sono contate una volta, come RJ45)
  ['ubiquiti','UniFi Security Gateway Pro 4 (USG-PRO-4)','fw',1,4,0,false,'gateway, 2 porte combo SFP'],
  ['ubiquiti','EdgeRouter Pro (ERPro-8)','router',1,8,0,false,'router, 2 porte combo SFP'],
  ['ubiquiti','EdgeRouter 8 (ER-8)','router',1,8,0,false,'router 8 porte'],
  ['ubiquiti','UniFi Switch 16 150W (US-16-150W)','sw',1,16,2,true,''],
  ['ubiquiti','UniFi Switch 24 (US-24)','sw',1,24,2,false,''],
  ['ubiquiti','UniFi Switch 24 250W (US-24-250W)','sw',1,24,2,true,''],
  ['ubiquiti','UniFi Switch 24 500W (US-24-500W)','sw',1,24,2,true,''],
  ['ubiquiti','UniFi Switch 48 (US-48)','sw',1,48,4,false,'2× SFP + 2× SFP+'],
  ['ubiquiti','UniFi Switch 48 500W (US-48-500W)','sw',1,48,4,true,'2× SFP + 2× SFP+'],
  ['ubiquiti','UniFi Switch 48 750W (US-48-750W)','sw',1,48,4,true,'2× SFP + 2× SFP+'],
  ['ubiquiti','UniFi Switch 16 XG (US-16-XG)','sw',1,4,12,false,'12× SFP+ + 4× 10GBASE-T'],
  ['ubiquiti','EdgeSwitch 16 150W (ES-16-150W)','sw',1,16,2,true,''],
  ['ubiquiti','EdgeSwitch 24 Lite (ES-24-Lite)','sw',1,24,2,false,''],
  ['ubiquiti','EdgeSwitch 24 500W (ES-24-500W)','sw',1,24,2,true,''],
  ['ubiquiti','EdgeSwitch 48 Lite (ES-48-Lite)','sw',1,48,4,false,'2× SFP + 2× SFP+'],
  ['ubiquiti','EdgeSwitch 48 750W (ES-48-750W)','sw',1,48,4,true,'2× SFP + 2× SFP+'],
  ['ubiquiti','EdgeSwitch 12 Fiber (ES-12F)','sw',1,4,12,false,'12× SFP + 4× RJ45'],
  ['ubiquiti','EdgeSwitch 16 XG (ES-16-XG)','sw',1,4,12,false,'12× SFP+ + 4× 10GBASE-T'],
  // MikroTik
  ['mikrotik','CCR2004-16G-2S+','router',1,16,2,false,'Cloud Core Router'],
  ['mikrotik','CCR2004-1G-12S+2XS','router',1,1,14,false,'12× SFP+ + 2× SFP28'],
  ['mikrotik','CCR2116-12G-4S+','router',1,13,4,false,'Cloud Core Router'],
  ['mikrotik','CCR2216-1G-12XS-2XQ','router',1,1,14,false,'12× SFP28 + 2× QSFP28'],
  ['mikrotik','CCR1036-8G-2S+','router',1,8,2,false,'Cloud Core Router'],
  ['mikrotik','CCR1009-7G-1C-1S+','router',1,8,2,false,'Cloud Core Router'],
  ['mikrotik','RB4011iGS+RM','router',1,10,1,false,'RouterBOARD'],
  ['mikrotik','RB1100AHx4','router',1,13,0,false,'RouterBOARD'],
  ['mikrotik','RB5009UG+S+IN','router',1,8,1,false,'da tavolo, a rack con kit'],
  ['mikrotik','CRS326-24G-2S+RM','sw',1,24,2,false,'Cloud Router Switch'],
  ['mikrotik','CRS328-24P-4S+RM','sw',1,24,4,true,'24 porte PoE'],
  ['mikrotik','CRS320-8P-8B-4S+RM','sw',1,16,4,true,'8 PoE+ e 8 PoE-bt'],
  ['mikrotik','CRS354-48G-4S+2Q+RM','sw',1,48,6,false,'4× SFP+ + 2× QSFP+'],
  ['mikrotik','CRS354-48P-4S+2Q+RM','sw',1,48,6,true,'4× SFP+ + 2× QSFP+'],
  ['mikrotik','CRS317-1G-16S+RM','sw',1,1,16,false,'16× SFP+'],
  ['mikrotik','CRS326-24S+2Q+RM','sw',1,1,26,false,'24× SFP+ + 2× QSFP+'],
  ['mikrotik','CRS518-16XS-2XQ-RM','sw',1,1,18,false,'16× SFP28 + 2× QSFP28'],
  ['mikrotik','CRS510-8XS-2XQ-IN','sw',1,1,10,false,'8× SFP28 + 2× QSFP28'],
  ['mikrotik','CRS309-1G-8S+IN','sw',1,1,8,false,'8× SFP+, a rack con kit'],
  ['mikrotik','CSS326-24G-2S+RM','sw',1,24,2,false,'SwOS'],
  // MikroTik — modelli meno recenti
  ['mikrotik','CCR1072-1G-8S+','router',1,1,8,false,'Cloud Core Router'],
  ['mikrotik','CCR1036-12G-4S','router',1,12,4,false,'Cloud Core Router'],
  ['mikrotik','CCR1036-12G-4S-EM','router',1,12,4,false,'Cloud Core Router'],
  ['mikrotik','CCR1036-8G-2S+EM','router',1,8,2,false,'Cloud Core Router'],
  ['mikrotik','CCR1016-12G','router',1,12,0,false,'Cloud Core Router'],
  ['mikrotik','CCR1009-8G-1S-1S+','router',1,8,2,false,'Cloud Core Router'],
  ['mikrotik','RB1100AHx2','router',1,13,0,false,'RouterBOARD'],
  ['mikrotik','RB1100AH','router',1,13,0,false,'RouterBOARD'],
  ['mikrotik','RB3011UiAS-RM','router',1,10,1,false,'RouterBOARD'],
  ['mikrotik','RB2011UiAS-RM','router',1,10,1,false,'RouterBOARD, 5 porte Gigabit + 5 Fast Ethernet'],
  ['mikrotik','RB2011iLS-IN','router',1,10,1,false,'RouterBOARD da tavolo, 5 porte Gigabit + 5 Fast Ethernet'],
  ['mikrotik','CRS125-24G-1S-RM','sw',1,24,1,false,'Cloud Router Switch'],
  ['mikrotik','CRS226-24G-2S+RM','sw',1,24,2,false,'Cloud Router Switch'],
  ['mikrotik','CRS328-4C-20S-4S+RM','sw',1,4,24,false,'4 combo + 20 SFP + 4 SFP+'],
  ['mikrotik','CRS326-24G-2S+IN','sw',1,24,2,false,'da tavolo, a rack con kit'],
  ['mikrotik','CSS326-24G-2S+IN','sw',1,24,2,false,'SwOS, da tavolo'],
  ['mikrotik','CRS212-1G-10S-1S+IN','sw',1,1,11,false,'10 SFP + 1 SFP+, da tavolo'],
  ['mikrotik','CRS210-8G-2S+IN','sw',1,8,2,false,'da tavolo, a rack con kit'],
  ['mikrotik','CRS112-8G-4S-IN','sw',1,8,4,false,'da tavolo'],
  ['mikrotik','CRS112-8P-4S-IN','sw',1,8,4,true,'8 porte PoE, da tavolo'],
  // HP / HPE
  ['hpe','OfficeConnect 1820 24G (J9980A)','sw',1,24,2,false,''],
  ['hpe','OfficeConnect 1820 48G (J9981A)','sw',1,48,4,false,''],
  ['hpe','OfficeConnect 1820 24G PoE+ (J9983A)','sw',1,24,2,true,'12 porte PoE+'],
  ['hpe','OfficeConnect 1920S 24G 2SFP (JL381A)','sw',1,24,2,false,''],
  ['hpe','OfficeConnect 1920S 48G 4SFP (JL382A)','sw',1,48,4,false,''],
  ['hpe','OfficeConnect 1920S 24G 2SFP PoE+ 370W (JL385A)','sw',1,24,2,true,''],
  ['hpe','OfficeConnect 1920S 48G 4SFP PoE+ 370W (JL386A)','sw',1,48,4,true,''],
  ['hpe','OfficeConnect 1950 24G 2SFP+ 2XGT (JG960A)','sw',1,26,2,false,''],
  ['hpe','OfficeConnect 1950 48G 2SFP+ 2XGT (JG961A)','sw',1,50,2,false,''],
  ['hpe','HP 2530-24G (J9776A)','sw',1,24,4,false,''],
  ['hpe','HP 2530-48G (J9775A)','sw',1,48,4,false,''],
  ['hpe','HP 2530-24G-PoE+ (J9773A)','sw',1,24,4,true,''],
  ['hpe','HP 2530-48G-PoE+ (J9772A)','sw',1,48,4,true,''],
  ['hpe','FlexNetwork 5130 24G 4SFP+ EI (JG932A)','sw',1,24,4,false,''],
  ['hpe','FlexNetwork 5130 48G 4SFP+ EI (JG934A)','sw',1,48,4,false,''],
  // HP / HPE — switch meno recenti (le porte combo sono contate una volta, come RJ45)
  ['hpe','ProCurve 1700-24 (J9080A)','sw',1,24,0,false,'10/100, 2 porte combo Gigabit'],
  ['hpe','ProCurve 1810G-24 (J9450A)','sw',1,24,0,false,'2 porte combo SFP'],
  ['hpe','HP 1810-24G v2 (J9803A)','sw',1,24,0,false,'2 porte combo SFP'],
  ['hpe','HP 1810-48G (J9660A)','sw',1,48,0,false,'4 porte combo SFP'],
  ['hpe','HP 1910-24G (JE006A)','sw',1,24,4,false,''],
  ['hpe','HP 1910-24G-PoE 365W (JE007A)','sw',1,24,4,true,''],
  ['hpe','HP 1910-48G (JE009A)','sw',1,48,4,false,''],
  ['hpe','HP 1920-8G (JG920A)','sw',1,8,2,false,'da tavolo, a rack con kit'],
  ['hpe','HP 1920-24G (JG924A)','sw',1,24,4,false,''],
  ['hpe','HP 1920-24G-PoE+ 370W (JG926A)','sw',1,24,4,true,''],
  ['hpe','HP 1920-48G (JG927A)','sw',1,48,4,false,''],
  ['hpe','HP 1920-48G-PoE+ 370W (JG928A)','sw',1,48,4,true,''],
  ['hpe','ProCurve 2510-24 (J9019B)','sw',1,26,0,false,'10/100, 2 porte combo Gigabit'],
  ['hpe','ProCurve 2510-48 (J9020A)','sw',1,50,2,false,'10/100 + 2 Gigabit + 2 SFP'],
  ['hpe','ProCurve 2510-24G (J9279A)','sw',1,24,0,false,'4 porte combo SFP'],
  ['hpe','ProCurve 2510-48G (J9280A)','sw',1,48,0,false,'4 porte combo SFP'],
  ['hpe','ProCurve 2520-8-PoE (J9137A)','sw',1,10,0,true,'10/100, 2 porte combo Gigabit, da tavolo'],
  ['hpe','ProCurve 2520-24-PoE (J9138A)','sw',1,26,0,true,'10/100, 2 porte combo Gigabit'],
  ['hpe','HP 2520G-8-PoE (J9298A)','sw',1,10,0,true,'2 porte combo SFP, da tavolo'],
  ['hpe','HP 2520G-24-PoE (J9299A)','sw',1,24,0,true,'4 porte combo SFP'],
  ['hpe','ProCurve 2610-24 (J9085A)','sw',1,26,2,false,'10/100 + 2 Gigabit + 2 SFP'],
  ['hpe','ProCurve 2610-24-PWR (J9087A)','sw',1,26,2,true,'10/100 + 2 Gigabit + 2 SFP'],
  ['hpe','ProCurve 2610-48 (J9088A)','sw',1,50,2,false,'10/100 + 2 Gigabit + 2 SFP'],
  ['hpe','ProCurve 2610-48-PWR (J9089A)','sw',1,50,2,true,'10/100 + 2 Gigabit + 2 SFP'],
  ['hpe','HP 2620-24 (J9623A)','sw',1,26,2,false,'10/100 + 2 Gigabit + 2 SFP'],
  ['hpe','HP 2620-24-PoE+ (J9625A)','sw',1,26,2,true,'10/100 + 2 Gigabit + 2 SFP'],
  ['hpe','HP 2620-48 (J9626A)','sw',1,50,2,false,'10/100 + 2 Gigabit + 2 SFP'],
  ['hpe','HP 2620-48-PoE+ (J9627A)','sw',1,50,2,true,'10/100 + 2 Gigabit + 2 SFP'],
  ['hpe','HP 2530-8G-PoE+ (J9774A)','sw',1,10,0,true,'2 porte combo SFP, da tavolo'],
  ['hpe','HP 2530-24 (J9782A)','sw',1,26,2,false,'10/100 + 2 Gigabit + 2 SFP'],
  ['hpe','HP 2530-48 (J9781A)','sw',1,50,2,false,'10/100 + 2 Gigabit + 2 SFP'],
  ['hpe','HP 2530-24-PoE+ (J9779A)','sw',1,26,2,true,'10/100 + 2 Gigabit + 2 SFP'],
  ['hpe','HP 2530-48-PoE+ (J9778A)','sw',1,50,2,true,'10/100 + 2 Gigabit + 2 SFP'],
  ['hpe','HP 2530-24G-2SFP+ (J9856A)','sw',1,24,2,false,'uplink SFP+'],
  ['hpe','HP 2530-48G-2SFP+ (J9855A)','sw',1,48,2,false,'uplink SFP+'],
  ['hpe','HP 2530-24G-PoE+-2SFP+ (J9854A)','sw',1,24,2,true,'uplink SFP+'],
  ['hpe','HP 2530-48G-PoE+-2SFP+ (J9853A)','sw',1,48,2,true,'uplink SFP+'],
  ['hpe','ProCurve 2810-24G (J9021A)','sw',1,24,0,false,'4 porte combo SFP'],
  ['hpe','ProCurve 2810-48G (J9022A)','sw',1,48,0,false,'4 porte combo SFP'],
  ['hpe','ProCurve 2910al-24G (J9145A)','sw',1,24,0,false,'4 porte combo SFP, slot per moduli 10G'],
  ['hpe','ProCurve 2910al-24G-PoE+ (J9146A)','sw',1,24,0,true,'4 porte combo SFP, slot per moduli 10G'],
  ['hpe','ProCurve 2910al-48G (J9147A)','sw',1,48,0,false,'4 porte combo SFP, slot per moduli 10G'],
  ['hpe','ProCurve 2910al-48G-PoE+ (J9148A)','sw',1,48,0,true,'4 porte combo SFP, slot per moduli 10G'],
  ['hpe','HP 2920-24G (J9726A)','sw',1,24,0,false,'4 porte combo SFP, slot per moduli 10G e stack'],
  ['hpe','HP 2920-24G-PoE+ (J9727A)','sw',1,24,0,true,'4 porte combo SFP, slot per moduli 10G e stack'],
  ['hpe','HP 2920-48G (J9728A)','sw',1,48,0,false,'4 porte combo SFP, slot per moduli 10G e stack'],
  ['hpe','HP 2920-48G-PoE+ (J9729A)','sw',1,48,0,true,'4 porte combo SFP, slot per moduli 10G e stack'],
  ['hpe','ProCurve 3500yl-24G-PWR (J8692A)','sw',1,24,0,true,'4 porte combo SFP, slot per moduli 10G'],
  ['hpe','ProCurve 3500yl-48G-PWR (J8693A)','sw',1,48,0,true,'4 porte combo SFP, slot per moduli 10G'],
  ['hpe','HP 3800-24G-2SFP+ (J9575A)','sw',1,24,2,false,'uplink SFP+, stack'],
  ['hpe','HP 3800-48G-4SFP+ (J9574A)','sw',1,48,4,false,'uplink SFP+, stack'],
  ['hpe','HP 5120-24G EI (JE068A)','sw',1,24,0,false,'4 porte combo SFP, slot per moduli 10G'],
  ['hpe','HP 5120-48G EI (JE069A)','sw',1,48,0,false,'4 porte combo SFP, slot per moduli 10G'],
  ['hpe','HP 5500-24G EI (JD377A)','sw',1,24,0,false,'4 porte combo SFP, slot per moduli 10G'],
  ['hpe','HP 5500-48G EI (JD375A)','sw',1,48,0,false,'4 porte combo SFP, slot per moduli 10G'],
  ['hpe','ProLiant DL20 Gen10 Plus','srv',1,2,0,false,'server'],
  ['hpe','ProLiant DL360 Gen10','srv',1,4,0,false,'server'],
  ['hpe','ProLiant DL380 Gen10','srv',2,4,0,false,'server'],
  ['hpe','ProLiant DL360 Gen11','srv',1,4,0,false,'server'],
  ['hpe','ProLiant DL380 Gen11','srv',2,4,0,false,'server'],
  ['hpe','MSA 2060','srv',2,0,4,false,'storage SAN'],
  // Aruba
  ['aruba','2930F 24G 4SFP+ (JL253A)','sw',1,24,4,false,''],
  ['aruba','2930F 48G 4SFP+ (JL254A)','sw',1,48,4,false,''],
  ['aruba','2930F 24G PoE+ 4SFP+ (JL255A)','sw',1,24,4,true,''],
  ['aruba','2930F 48G PoE+ 4SFP+ (JL256A)','sw',1,48,4,true,''],
  ['aruba','CX 6100 24G 4SFP+ (JL678A)','sw',1,24,4,false,''],
  ['aruba','CX 6100 48G 4SFP+ (JL676A)','sw',1,48,4,false,''],
  ['aruba','CX 6100 24G Class4 PoE 4SFP+ (JL677A)','sw',1,24,4,true,''],
  ['aruba','CX 6100 48G Class4 PoE 4SFP+ (JL675A)','sw',1,48,4,true,''],
  ['aruba','CX 6200F 24G 4SFP+ (JL724A)','sw',1,24,4,false,''],
  ['aruba','CX 6200F 48G 4SFP+ (JL726A)','sw',1,48,4,false,''],
  ['aruba','CX 6200F 24G Class4 PoE 4SFP+ (JL725A)','sw',1,24,4,true,''],
  ['aruba','CX 6200F 48G Class4 PoE 4SFP+ (JL727A)','sw',1,48,4,true,''],
  ['aruba','CX 6300M 48G 4SFP56','sw',1,48,4,false,''],
  ['aruba','Instant On 1830 24G 2SFP (JL812A)','sw',1,24,2,false,''],
  ['aruba','Instant On 1830 24G 12p PoE 2SFP (JL813A)','sw',1,24,2,true,''],
  ['aruba','Instant On 1830 48G 4SFP (JL814A)','sw',1,48,4,false,''],
  ['aruba','Instant On 1830 48G 24p PoE 4SFP (JL815A)','sw',1,48,4,true,''],
  ['aruba','Instant On 1930 24G 4SFP+ (JL682A)','sw',1,24,4,false,''],
  ['aruba','Instant On 1930 24G PoE 195W 4SFP+ (JL683A)','sw',1,24,4,true,''],
  ['aruba','Instant On 1930 24G PoE 370W 4SFP+ (JL684A)','sw',1,24,4,true,''],
  ['aruba','Instant On 1930 48G 4SFP+ (JL685A)','sw',1,48,4,false,''],
  ['aruba','Instant On 1930 48G PoE 370W 4SFP+ (JL686A)','sw',1,48,4,true,''],
  ['aruba','Instant On 1960 24G 2XGT 2SFP+ (JL806A)','sw',1,26,2,false,''],
  ['aruba','Instant On 1960 24G PoE 2XGT 2SFP+ (JL807A)','sw',1,26,2,true,''],
  ['aruba','Instant On 1960 48G 2XGT 2SFP+ (JL808A)','sw',1,50,2,false,''],
  ['aruba','Instant On 1960 48G PoE 2XGT 2SFP+ (JL809A)','sw',1,50,2,true,''],
  // Aruba (HPE) — switch meno recenti
  ['aruba','2540 24G 4SFP+ (JL354A)','sw',1,24,4,false,''],
  ['aruba','2540 48G 4SFP+ (JL355A)','sw',1,48,4,false,''],
  ['aruba','2540 24G PoE+ 4SFP+ (JL356A)','sw',1,24,4,true,''],
  ['aruba','2540 48G PoE+ 4SFP+ (JL357A)','sw',1,48,4,true,''],
  ['aruba','2930M 24G 1-slot (JL319A)','sw',1,24,0,false,'slot per moduli 10G e stack'],
  ['aruba','2930M 48G 1-slot (JL321A)','sw',1,48,0,false,'slot per moduli 10G e stack'],
  ['aruba','2930M 24G PoE+ 1-slot (JL320A)','sw',1,24,0,true,'slot per moduli 10G e stack'],
  ['aruba','2930M 48G PoE+ 1-slot (JL322A)','sw',1,48,0,true,'slot per moduli 10G e stack'],
  // Cisco
  ['cisco','Catalyst 1000-24T-4G-L','sw',1,24,4,false,''],
  ['cisco','Catalyst 1000-48T-4G-L','sw',1,48,4,false,''],
  ['cisco','Catalyst 1000-24P-4G-L','sw',1,24,4,true,''],
  ['cisco','Catalyst 1000-48P-4G-L','sw',1,48,4,true,''],
  ['cisco','Catalyst 1000-24T-4X-L','sw',1,24,4,false,'uplink SFP+'],
  ['cisco','Catalyst 2960X-24TS-L','sw',1,24,4,false,''],
  ['cisco','Catalyst 2960X-48TS-L','sw',1,48,4,false,''],
  ['cisco','Catalyst 2960X-24PS-L','sw',1,24,4,true,''],
  ['cisco','Catalyst 2960X-48FPS-L','sw',1,48,4,true,''],
  ['cisco','Catalyst 9200L-24T-4G','sw',1,24,4,false,''],
  ['cisco','Catalyst 9200L-48T-4G','sw',1,48,4,false,''],
  ['cisco','Catalyst 9200L-24P-4G','sw',1,24,4,true,''],
  ['cisco','Catalyst 9200L-48P-4G','sw',1,48,4,true,''],
  ['cisco','Catalyst 9200L-48P-4X','sw',1,48,4,true,'uplink SFP+'],
  ['cisco','Catalyst 9300-24P','sw',1,24,4,true,'modulo di rete 4× SFP+'],
  ['cisco','Catalyst 9300-48P','sw',1,48,4,true,'modulo di rete 4× SFP+'],
  ['cisco','Catalyst 9300-48U','sw',1,48,4,true,'UPOE, modulo 4× SFP+'],
  ['cisco','Catalyst 9500-24Y4C','sw',1,0,28,false,'24× SFP28 + 4× QSFP28'],
  ['cisco','Business CBS250-24T-4G','sw',1,24,4,false,''],
  ['cisco','Business CBS350-24T-4G','sw',1,24,4,false,''],
  ['cisco','Business CBS350-48T-4G','sw',1,48,4,false,''],
  ['cisco','Business CBS350-24P-4G','sw',1,24,4,true,''],
  ['cisco','Business CBS350-48P-4G','sw',1,48,4,true,''],
  ['cisco','Meraki MS120-24P','sw',1,24,4,true,''],
  ['cisco','Meraki MS120-48LP','sw',1,48,4,true,''],
  ['cisco','Meraki MS225-48FP','sw',1,48,4,true,'uplink SFP+'],
  ['cisco','Meraki MS250-48FP','sw',1,48,4,true,'uplink SFP+'],
  ['cisco','ISR 4331','router',1,3,0,false,'router a servizi integrati'],
  ['cisco','ISR 4431','router',1,4,0,false,'router a servizi integrati'],
  ['cisco','Catalyst 8200-1N-4T','router',1,4,0,false,'edge router'],
  ['cisco','Firepower 1120','fw',1,8,4,false,'firewall'],
  ['cisco','Firepower 1140','fw',1,8,4,false,'firewall'],
  ['cisco','Secure Firewall 3105','fw',1,8,8,false,'firewall'],
  ['cisco','ASA 5525-X','fw',1,8,0,false,'firewall'],
  ['cisco','UCS C220 M5','srv',1,2,0,false,'server'],
  ['cisco','UCS C240 M5','srv',2,2,0,false,'server'],
  // ZTE
  ['zte','ZXR10 5260-28TD-H','sw',1,24,4,false,''],
  ['zte','ZXR10 5260-28PD-H','sw',1,24,4,true,''],
  ['zte','ZXR10 5260-52TD-H','sw',1,48,4,false,''],
  ['zte','ZXR10 5260-52PD-H','sw',1,48,4,true,''],
  ['zte','ZXR10 5950-28TD-L','sw',1,24,4,false,''],
  ['zte','ZXR10 5950-28PD-L','sw',1,24,4,true,''],
  ['zte','ZXR10 5950-52TD-L','sw',1,48,4,false,''],
  ['zte','ZXR10 5950-52PD-L','sw',1,48,4,true,''],
  ['zte','ZXR10 5960-52DU-H','sw',1,0,52,false,'48× SFP+ + 4× QSFP28'],
  ['zte','ZXA10 C320','router',2,1,2,false,'OLT GPON compatta'],
  ['zte','ZXA10 C620','router',2,0,4,false,'OLT GPON / XGS-PON'],
  ['zte','ZXA10 C600','router',11,0,8,false,'OLT ad alta capacità'],
  // Ruckus
  ['ruckus','ICX 7150-24','sw',1,26,4,false,'24 + 2 uplink RJ45'],
  ['ruckus','ICX 7150-24P','sw',1,26,4,true,'24 + 2 uplink RJ45'],
  ['ruckus','ICX 7150-48','sw',1,50,4,false,'48 + 2 uplink RJ45'],
  ['ruckus','ICX 7150-48P','sw',1,50,4,true,'48 + 2 uplink RJ45'],
  ['ruckus','ICX 7150-48ZP','sw',1,48,8,true,'multigigabit PoE'],
  ['ruckus','ICX 8200-24','sw',1,24,4,false,'uplink SFP28'],
  ['ruckus','ICX 8200-24P','sw',1,24,4,true,'uplink SFP28'],
  ['ruckus','ICX 8200-24ZP','sw',1,24,4,true,'2,5 GbE PoE++'],
  ['ruckus','ICX 8200-48','sw',1,48,4,false,'uplink SFP28'],
  ['ruckus','ICX 8200-48P','sw',1,48,4,true,'uplink SFP28'],
  ['ruckus','SmartZone 144 (SZ-144)','srv',1,4,2,false,'controller Wi-Fi'],
  // Synology
  ['synology','RS422+','srv',1,0,0,false,'4 dischi'],
  ['synology','RS822+','srv',1,0,0,false,'4 dischi'],
  ['synology','RS822RP+','srv',1,0,0,false,'4 dischi, alimentazione ridondata'],
  ['synology','RS1619xs+','srv',1,0,0,false,'4 dischi'],
  ['synology','RS820+','srv',1,0,0,false,'4 dischi'],
  ['synology','RS820RP+','srv',1,0,0,false,'4 dischi, alimentazione ridondata'],
  ['synology','RS819','srv',1,0,0,false,'4 dischi'],
  ['synology','RS217','srv',1,0,0,false,'2 dischi'],
  ['synology','RS1221+','srv',2,0,0,false,'8 dischi'],
  ['synology','RS1221RP+','srv',2,0,0,false,'8 dischi, alimentazione ridondata'],
  ['synology','RS1219+','srv',2,0,0,false,'8 dischi'],
  ['synology','RS2421+','srv',2,0,0,false,'12 dischi'],
  ['synology','RS2421RP+','srv',2,0,0,false,'12 dischi, alimentazione ridondata'],
  ['synology','RS2423+','srv',2,0,0,false,'12 dischi'],
  ['synology','RS2423RP+','srv',2,0,0,false,'12 dischi, alimentazione ridondata'],
  ['synology','RS2418+','srv',2,0,0,false,'12 dischi'],
  ['synology','RS3621xs+','srv',2,0,0,false,'12 dischi'],
  ['synology','RS3621RPxs','srv',2,0,0,false,'12 dischi, alimentazione ridondata'],
  ['synology','RS3618xs','srv',2,0,0,false,'12 dischi'],
  ['synology','RS2825RP+','srv',3,0,0,false,'16 dischi, alimentazione ridondata'],
  ['synology','RS2821RP+','srv',3,0,0,false,'16 dischi, alimentazione ridondata'],
  ['synology','RS2818RP+','srv',3,0,0,false,'16 dischi, alimentazione ridondata'],
  ['synology','RS4021xs+','srv',3,0,0,false,'16 dischi'],
  ['synology','SA3400','srv',2,0,0,false,'12 dischi'],
  ['synology','SA3410','srv',2,0,0,false,'12 dischi'],
  ['synology','SA3610','srv',2,0,0,false,'12 dischi'],
  ['synology','SA6400','srv',2,0,0,false,'12 dischi'],
  ['synology','SA3200D','srv',2,0,0,false,'12 dischi, doppio controller'],
  ['synology','UC3200','srv',2,0,0,false,'SAN 12 dischi, doppio controller'],
  ['synology','UC3400','srv',2,0,0,false,'SAN 12 dischi, doppio controller'],
  ['synology','FS2500','srv',1,0,0,false,'all-flash 12 SSD'],
  ['synology','FS3410','srv',2,0,0,false,'all-flash 24 SSD'],
  ['synology','FS3600','srv',2,0,0,false,'all-flash 24 SSD'],
  ['synology','FS6400','srv',2,0,0,false,'all-flash 24 SSD'],
  ['synology','HD6500','srv',4,0,0,false,'60 dischi'],
  ['synology','RX418','srv',1,0,0,false,'espansione 4 dischi'],
  ['synology','RX1217','srv',2,0,0,false,'espansione 12 dischi'],
  ['synology','RX1217RP','srv',2,0,0,false,'espansione 12 dischi'],
  ['synology','RX1222sas','srv',2,0,0,false,'espansione 12 dischi SAS'],
  ['synology','RX1223RP','srv',2,0,0,false,'espansione 12 dischi'],
  ['synology','RX1225RP','srv',2,0,0,false,'espansione 12 dischi'],
  ['synology','RX6022sas','srv',4,0,0,false,'espansione 60 dischi SAS'],
  // Dell
  ['dell','PowerEdge R470','srv',1,0,0,false,'server 17ª gen., Intel'],
  ['dell','PowerEdge R570','srv',2,0,0,false,'server 17ª gen., Intel'],
  ['dell','PowerEdge R670','srv',1,0,0,false,'server 17ª gen., Intel'],
  ['dell','PowerEdge R770','srv',2,0,0,false,'server 17ª gen., Intel'],
  ['dell','PowerEdge R770AP','srv',2,0,0,false,'server 17ª gen., Intel'],
  ['dell','PowerEdge R6715','srv',1,0,0,false,'server 17ª gen., AMD'],
  ['dell','PowerEdge R6725','srv',1,0,0,false,'server 17ª gen., AMD'],
  ['dell','PowerEdge R7715','srv',2,0,0,false,'server 17ª gen., AMD'],
  ['dell','PowerEdge R7725','srv',2,0,0,false,'server 17ª gen., AMD'],
  ['dell','PowerEdge R7725xd','srv',2,0,0,false,'server 17ª gen., AMD'],
  ['dell','PowerEdge R260','srv',1,0,0,false,'server 16ª gen., Intel'],
  ['dell','PowerEdge R360','srv',1,0,0,false,'server 16ª gen., Intel'],
  ['dell','PowerEdge R660','srv',1,0,0,false,'server 16ª gen., Intel'],
  ['dell','PowerEdge R660xs','srv',1,0,0,false,'server 16ª gen., Intel'],
  ['dell','PowerEdge R760','srv',2,0,0,false,'server 16ª gen., Intel'],
  ['dell','PowerEdge R760xs','srv',2,0,0,false,'server 16ª gen., Intel'],
  ['dell','PowerEdge R760xa','srv',2,0,0,false,'server 16ª gen., GPU'],
  ['dell','PowerEdge R760xd2','srv',2,0,0,false,'server 16ª gen., storage'],
  ['dell','PowerEdge R860','srv',2,0,0,false,'server 16ª gen., 4 socket'],
  ['dell','PowerEdge R960','srv',4,0,0,false,'server 16ª gen., 4 socket'],
  ['dell','PowerEdge R6615','srv',1,0,0,false,'server 16ª gen., AMD'],
  ['dell','PowerEdge R6625','srv',1,0,0,false,'server 16ª gen., AMD'],
  ['dell','PowerEdge R7615','srv',2,0,0,false,'server 16ª gen., AMD'],
  ['dell','PowerEdge R7625','srv',2,0,0,false,'server 16ª gen., AMD'],
  ['dell','PowerEdge R250','srv',1,0,0,false,'server 15ª gen., Intel'],
  ['dell','PowerEdge R350','srv',1,0,0,false,'server 15ª gen., Intel'],
  ['dell','PowerEdge R450','srv',1,0,0,false,'server 15ª gen., Intel'],
  ['dell','PowerEdge R550','srv',2,0,0,false,'server 15ª gen., Intel'],
  ['dell','PowerEdge R650','srv',1,0,0,false,'server 15ª gen., Intel'],
  ['dell','PowerEdge R650xs','srv',1,0,0,false,'server 15ª gen., Intel'],
  ['dell','PowerEdge R750','srv',2,0,0,false,'server 15ª gen., Intel'],
  ['dell','PowerEdge R750xs','srv',2,0,0,false,'server 15ª gen., Intel'],
  ['dell','PowerEdge R750xa','srv',2,0,0,false,'server 15ª gen., GPU'],
  ['dell','PowerEdge R6515','srv',1,0,0,false,'server 15ª gen., AMD'],
  ['dell','PowerEdge R6525','srv',1,0,0,false,'server 15ª gen., AMD'],
  ['dell','PowerEdge R7515','srv',2,0,0,false,'server 15ª gen., AMD'],
  ['dell','PowerEdge R7525','srv',2,0,0,false,'server 15ª gen., AMD'],
  ['dell','PowerEdge R240','srv',1,0,0,false,'server 14ª gen.'],
  ['dell','PowerEdge R340','srv',1,0,0,false,'server 14ª gen.'],
  ['dell','PowerEdge R440','srv',1,0,0,false,'server 14ª gen.'],
  ['dell','PowerEdge R540','srv',2,0,0,false,'server 14ª gen.'],
  ['dell','PowerEdge R640','srv',1,0,0,false,'server 14ª gen.'],
  ['dell','PowerEdge R740','srv',2,0,0,false,'server 14ª gen.'],
  ['dell','PowerEdge R740xd','srv',2,0,0,false,'server 14ª gen.'],
  ['dell','PowerEdge R940','srv',3,0,0,false,'server 14ª gen., 4 socket'],
  ['dell','PowerVault ME4012','srv',2,0,0,false,'storage 12 dischi'],
  ['dell','PowerVault ME4024','srv',2,0,0,false,'storage 24 dischi'],
  ['dell','PowerVault ME5012','srv',2,0,0,false,'storage 12 dischi'],
  ['dell','PowerVault ME5024','srv',2,0,0,false,'storage 24 dischi'],
  ['dell','PowerVault ME5084','srv',5,0,0,false,'storage 84 dischi'],
  ['qnap','TS-464U','srv',1,0,0,false,'NAS 4 dischi'],
  ['qnap','TS-432PXU','srv',1,0,0,false,'NAS 4 dischi'],
  ['qnap','TS-977XU','srv',1,0,0,false,'NAS 9 dischi'],
  ['qnap','TS-h987XU-RP','srv',1,0,0,false,'NAS 9 dischi, alimentazione ridondata'],
  ['qnap','TS-864eU','srv',2,0,0,false,'NAS 8 dischi, profondità ridotta'],
  ['qnap','TS-873AeU','srv',2,0,0,false,'NAS 8 dischi, profondità ridotta'],
  ['qnap','TS-832PXU','srv',2,0,0,false,'NAS 8 dischi'],
  ['qnap','TS-1264U-RP','srv',2,0,0,false,'NAS 12 dischi, alimentazione ridondata'],
  ['qnap','TS-1273AU-RP','srv',2,0,0,false,'NAS 12 dischi, alimentazione ridondata'],
  ['qnap','TS-1232PXU-RP','srv',2,0,0,false,'NAS 12 dischi, alimentazione ridondata'],
  ['qnap','TS-h1886XU-RP','srv',2,0,0,false,'NAS 18 dischi, alimentazione ridondata'],
  ['qnap','TS-h1887XU-RP','srv',2,0,0,false,'NAS 18 dischi, alimentazione ridondata'],
  ['qnap','TS-h2287XU-RP','srv',2,0,0,false,'NAS 22 dischi, alimentazione ridondata'],
  ['qnap','TS-1673AU-RP','srv',3,0,0,false,'NAS 16 dischi, alimentazione ridondata'],
  ['qnap','TS-h1683XU-RP','srv',3,0,0,false,'NAS 16 dischi, alimentazione ridondata'],
  ['qnap','TS-h3087XU-RP','srv',3,0,0,false,'NAS 30 dischi, alimentazione ridondata'],
  ['qnap','TS-h2483XU-RP','srv',4,0,0,false,'NAS 24 dischi, alimentazione ridondata'],
  ['qnap','TL-R400S','srv',1,0,0,false,'NAS espansione 4 dischi'],
  ['qnap','TL-R1200S-RP','srv',2,0,0,false,'NAS espansione 12 dischi'],
  ['hikvision','DS-7608NI-K2','srv',1,0,0,false,'NVR 8 canali, 2 dischi'],
  ['hikvision','DS-7616NI-K2','srv',1,0,0,false,'NVR 16 canali, 2 dischi'],
  ['hikvision','DS-7632NI-K2','srv',1,0,0,false,'NVR 32 canali, 2 dischi'],
  ['hikvision','DS-7616NXI-I2/S','srv',1,0,0,false,'NVR AcuSense 16 canali, 2 dischi'],
  ['hikvision','DS-7716NI-K4','srv',2,0,0,false,'NVR 16 canali, 4 dischi — 1,5 U, occupa 2 U'],
  ['hikvision','DS-7732NI-K4','srv',2,0,0,false,'NVR 32 canali, 4 dischi — 1,5 U, occupa 2 U'],
  ['hikvision','DS-7716NI-K4/16P','srv',2,0,0,false,'NVR 16 canali con 16 PoE — 1,5 U, occupa 2 U'],
  ['hikvision','DS-7716NXI-I4/S','srv',2,0,0,false,'NVR AcuSense 16 canali — 1,5 U, occupa 2 U'],
  ['hikvision','DS-7716NI-M4','srv',2,0,0,false,'NVR 8K 16 canali — 1,5 U, occupa 2 U'],
  ['hikvision','DS-9632NI-M8','srv',2,0,0,false,'NVR 32 canali, 8 dischi'],
  ['hikvision','DS-9664NI-M8','srv',2,0,0,false,'NVR 64 canali, 8 dischi'],
  ['hikvision','DS-3E0526P-E/M','sw',1,24,2,true,'switch PoE'],
  // Hikvision — modelli meno recenti
  ['hikvision','DS-7608NI-E2','srv',1,0,0,false,'NVR 8 canali, 2 dischi'],
  ['hikvision','DS-7608NI-I2','srv',1,0,0,false,'NVR 8 canali, 2 dischi'],
  ['hikvision','DS-7608NI-Q2','srv',1,0,0,false,'NVR 8 canali, 2 dischi'],
  ['hikvision','DS-7616NI-E2','srv',1,0,0,false,'NVR 16 canali, 2 dischi'],
  ['hikvision','DS-7616NI-I2','srv',1,0,0,false,'NVR 16 canali, 2 dischi'],
  ['hikvision','DS-7616NI-Q2','srv',1,0,0,false,'NVR 16 canali, 2 dischi'],
  ['hikvision','DS-7632NI-E2','srv',1,0,0,false,'NVR 32 canali, 2 dischi'],
  ['hikvision','DS-7632NI-I2','srv',1,0,0,false,'NVR 32 canali, 2 dischi'],
  ['hikvision','DS-7632NI-Q2','srv',1,0,0,false,'NVR 32 canali, 2 dischi'],
  ['hikvision','DS-7608NI-E2/8P','srv',1,0,0,false,'NVR 8 canali con 8 PoE, 2 dischi'],
  ['hikvision','DS-7608NI-I2/8P','srv',1,0,0,false,'NVR 8 canali con 8 PoE, 2 dischi'],
  ['hikvision','DS-7608NI-Q2/8P','srv',1,0,0,false,'NVR 8 canali con 8 PoE, 2 dischi'],
  ['hikvision','DS-7608NI-K2/8P','srv',1,0,0,false,'NVR 8 canali con 8 PoE, 2 dischi'],
  ['hikvision','DS-7616NI-E2/16P','srv',1,0,0,false,'NVR 16 canali con 16 PoE, 2 dischi'],
  ['hikvision','DS-7616NI-I2/16P','srv',1,0,0,false,'NVR 16 canali con 16 PoE, 2 dischi'],
  ['hikvision','DS-7616NI-Q2/16P','srv',1,0,0,false,'NVR 16 canali con 16 PoE, 2 dischi'],
  ['hikvision','DS-7616NI-K2/16P','srv',1,0,0,false,'NVR 16 canali con 16 PoE, 2 dischi'],
  ['hikvision','DS-7716NI-E4','srv',2,0,0,false,'NVR 16 canali, 4 dischi — 1,5 U, occupa 2 U'],
  ['hikvision','DS-7716NI-I4','srv',2,0,0,false,'NVR 16 canali, 4 dischi — 1,5 U, occupa 2 U'],
  ['hikvision','DS-7716NI-Q4','srv',2,0,0,false,'NVR 16 canali, 4 dischi — 1,5 U, occupa 2 U'],
  ['hikvision','DS-7732NI-E4','srv',2,0,0,false,'NVR 32 canali, 4 dischi — 1,5 U, occupa 2 U'],
  ['hikvision','DS-7732NI-I4','srv',2,0,0,false,'NVR 32 canali, 4 dischi — 1,5 U, occupa 2 U'],
  ['hikvision','DS-7732NI-Q4','srv',2,0,0,false,'NVR 32 canali, 4 dischi — 1,5 U, occupa 2 U'],
  ['hikvision','DS-7716NI-E4/16P','srv',2,0,0,false,'NVR 16 canali con 16 PoE, 4 dischi — 1,5 U, occupa 2 U'],
  ['hikvision','DS-7716NI-I4/16P','srv',2,0,0,false,'NVR 16 canali con 16 PoE, 4 dischi — 1,5 U, occupa 2 U'],
  ['hikvision','DS-7716NI-Q4/16P','srv',2,0,0,false,'NVR 16 canali con 16 PoE, 4 dischi — 1,5 U, occupa 2 U'],
  ['hikvision','DS-9616NI-I8','srv',2,0,0,false,'NVR 16 canali, 8 dischi'],
  ['hikvision','DS-9632NI-I8','srv',2,0,0,false,'NVR 32 canali, 8 dischi'],
  ['hikvision','DS-9664NI-I8','srv',2,0,0,false,'NVR 64 canali, 8 dischi'],
  ['hikvision','DS-9616NI-E8','srv',2,0,0,false,'NVR 16 canali, 8 dischi'],
  ['hikvision','DS-9632NI-E8','srv',2,0,0,false,'NVR 32 canali, 8 dischi'],
  ['hikvision','DS-9632NI-I16','srv',3,0,0,false,'NVR 32 canali, 16 dischi'],
  ['hikvision','DS-9664NI-I16','srv',3,0,0,false,'NVR 64 canali, 16 dischi'],
  ['hikvision','DS-3E0318P-E','sw',1,18,0,true,'10/100 PoE, 2 porte combo Gigabit'],
  ['hikvision','DS-3E0326P-E','sw',1,26,0,true,'10/100 PoE, 2 porte combo Gigabit'],
  ['apc','Smart-UPS SMT750RMI2U','ups',2,0,0,false,'UPS 750 VA, line-interactive'],
  ['apc','Smart-UPS SMT1000RMI2U','ups',2,0,0,false,'UPS 1000 VA, line-interactive'],
  ['apc','Smart-UPS SMT1500RMI2U','ups',2,0,0,false,'UPS 1500 VA, line-interactive'],
  ['apc','Smart-UPS SMT2200RMI2U','ups',2,0,0,false,'UPS 2200 VA, line-interactive'],
  ['apc','Smart-UPS SMT3000RMI2U','ups',2,0,0,false,'UPS 3000 VA, line-interactive'],
  ['apc','Smart-UPS C SMC1000I-2U','ups',2,0,0,false,'UPS 1000 VA'],
  ['apc','Smart-UPS C SMC1500I-2U','ups',2,0,0,false,'UPS 1500 VA'],
  ['apc','Smart-UPS On-Line SRT1000RMXLI','ups',2,0,0,false,'UPS 1000 VA, on-line'],
  ['apc','Smart-UPS On-Line SRT2200RMXLI','ups',2,0,0,false,'UPS 2200 VA, on-line'],
  ['apc','Smart-UPS On-Line SRT3000RMXLI','ups',2,0,0,false,'UPS 3000 VA, on-line'],
  ['apc','Easy UPS SRV SRVSPM3KRIL','ups',2,0,0,false,'UPS 3 kVA, on-line'],
  ['apc','Rack PDU Switched AP7920B','vde',1,8,0,false,''],
  ['apc','Rack PDU Switched AP7921B','vde',1,8,0,false,''],
  ['apc','Rack PDU Basic AP9559','vde',1,10,0,false,''],
  ['eaton','5P 650i Rack 1U','ups',1,0,0,false,'UPS 650 VA, line-interactive'],
  ['eaton','5P 1150i Rack 1U','ups',1,0,0,false,'UPS 1150 VA, line-interactive'],
  ['eaton','5P 1550i Rack 1U','ups',1,0,0,false,'UPS 1550 VA, line-interactive'],
  ['eaton','5PX 1500i RT2U G2','ups',2,0,0,false,'UPS 1500 VA, line-interactive'],
  ['eaton','5PX 2200i RT2U G2','ups',2,0,0,false,'UPS 2200 VA, line-interactive'],
  ['eaton','5PX 3000i RT2U G2','ups',2,0,0,false,'UPS 3000 VA, line-interactive'],
  ['eaton','5SC 2200i RT','ups',2,0,0,false,'UPS 2200 VA, line-interactive'],
  ['eaton','9PX 1000i RT2U','ups',2,0,0,false,'UPS 1000 VA, on-line'],
  ['eaton','9PX 1500i RT2U','ups',2,0,0,false,'UPS 1500 VA, on-line'],
  ['eaton','9PX 2200i RT2U','ups',2,0,0,false,'UPS 2200 VA, on-line'],
  ['eaton','9PX 3000i RT2U','ups',2,0,0,false,'UPS 3000 VA, on-line'],
  ['eaton','5PX EBM 72V RT2U','ups',2,0,0,false,'modulo batterie aggiuntivo'],
  ['fortinet','FortiGate 40F','fw',1,0,0,false,'firewall da tavolo, a rack con kit'],
  ['fortinet','FortiGate 60F','fw',1,0,0,false,'firewall da tavolo, a rack con kit'],
  ['fortinet','FortiGate 80F','fw',1,0,0,false,'firewall da tavolo, a rack con kit'],
  ['fortinet','FortiGate 100F','fw',1,0,0,false,'firewall'],
  ['fortinet','FortiGate 120G','fw',1,0,0,false,'firewall'],
  ['fortinet','FortiGate 200F','fw',1,0,0,false,'firewall'],
  ['fortinet','FortiGate 400F','fw',1,0,0,false,'firewall'],
  ['fortinet','FortiGate 600F','fw',1,0,0,false,'firewall'],
  ['fortinet','FortiSwitch 124F','sw',1,24,4,false,''],
  ['fortinet','FortiSwitch 124F-POE','sw',1,24,4,true,''],
  ['fortinet','FortiSwitch 148F','sw',1,48,4,false,''],
  ['fortinet','FortiSwitch 148F-POE','sw',1,48,4,true,''],
  ['fortinet','FortiSwitch 424E','sw',1,24,4,false,''],
  ['fortinet','FortiSwitch 448E','sw',1,48,4,false,''],
  ['sophos','XGS 2100','fw',1,0,0,false,'firewall'],
  ['sophos','XGS 2300','fw',1,0,0,false,'firewall'],
  ['sophos','XGS 3100','fw',1,0,0,false,'firewall'],
  ['sophos','XGS 3300','fw',1,0,0,false,'firewall'],
  ['sophos','XGS 4300','fw',1,0,0,false,'firewall'],
  ['sophos','XGS 4500','fw',1,0,0,false,'firewall'],
  ['sophos','XGS 87','fw',1,0,0,false,'firewall da tavolo, a rack con kit'],
  ['sophos','XGS 107','fw',1,0,0,false,'firewall da tavolo, a rack con kit'],
  ['sophos','XGS 116','fw',1,0,0,false,'firewall da tavolo, a rack con kit'],
  ['sophos','XGS 126','fw',1,0,0,false,'firewall da tavolo, a rack con kit'],
  ['sophos','XGS 136','fw',1,0,0,false,'firewall da tavolo, a rack con kit'],
  ['watchguard','Firebox M290','fw',1,0,0,false,'firewall'],
  ['watchguard','Firebox M390','fw',1,0,0,false,'firewall'],
  ['watchguard','Firebox M590','fw',1,0,0,false,'firewall'],
  ['watchguard','Firebox M690','fw',1,0,0,false,'firewall'],
  ['watchguard','Firebox M4800','fw',1,0,0,false,'firewall'],
  ['watchguard','Firebox T45','fw',1,0,0,false,'firewall da tavolo, a rack con kit'],
  ['watchguard','Firebox T85','fw',1,0,0,false,'firewall da tavolo, a rack con kit'],
  ['paloalto','PA-1410','fw',1,0,0,false,'firewall'],
  ['paloalto','PA-1420','fw',1,0,0,false,'firewall'],
  ['paloalto','PA-3410','fw',1,0,0,false,'firewall'],
  ['paloalto','PA-3420','fw',1,0,0,false,'firewall'],
  ['paloalto','PA-3430','fw',1,0,0,false,'firewall'],
  ['paloalto','PA-3440','fw',1,0,0,false,'firewall'],
  ['paloalto','PA-440','fw',1,0,0,false,'firewall da tavolo, a rack con kit'],
  ['paloalto','PA-450','fw',1,0,0,false,'firewall da tavolo, a rack con kit'],
  ['paloalto','PA-460','fw',1,0,0,false,'firewall da tavolo, a rack con kit'],
  ['lenovo','ThinkSystem SR250 V3','srv',1,0,0,false,'server'],
  ['lenovo','ThinkSystem SR630 V2','srv',1,0,0,false,'server'],
  ['lenovo','ThinkSystem SR630 V3','srv',1,0,0,false,'server'],
  ['lenovo','ThinkSystem SR635 V3','srv',1,0,0,false,'server'],
  ['lenovo','ThinkSystem SR645 V3','srv',1,0,0,false,'server'],
  ['lenovo','ThinkSystem SR650 V2','srv',2,0,0,false,'server'],
  ['lenovo','ThinkSystem SR650 V3','srv',2,0,0,false,'server'],
  ['lenovo','ThinkSystem SR655 V3','srv',2,0,0,false,'server'],
  ['lenovo','ThinkSystem SR665 V3','srv',2,0,0,false,'server'],
  ['lenovo','ThinkSystem SR850 V3','srv',2,0,0,false,'server'],
  ['fujitsu','PRIMERGY RX1330 M5','srv',1,0,0,false,'server'],
  ['fujitsu','PRIMERGY RX2530 M6','srv',1,0,0,false,'server'],
  ['fujitsu','PRIMERGY RX2530 M7','srv',1,0,0,false,'server'],
  ['fujitsu','PRIMERGY RX2540 M6','srv',2,0,0,false,'server'],
  ['fujitsu','PRIMERGY RX2540 M7','srv',2,0,0,false,'server'],
  ['fujitsu','PRIMERGY RX4770 M7','srv',2,0,0,false,'server'],
  ['supermicro','SuperServer 1U','srv',1,0,0,false,'server, configurazione a scelta'],
  ['supermicro','SuperServer 2U','srv',2,0,0,false,'server, configurazione a scelta'],
  ['supermicro','SuperServer 4U','srv',4,0,0,false,'server, configurazione a scelta'],
  ['supermicro','SuperStorage 4U 36 dischi','srv',4,0,0,false,'storage 36 dischi'],
  ['tplink','SG2428P','sw',1,24,4,true,''],
  ['tplink','SG3428','sw',1,24,4,false,''],
  ['tplink','SG3428MP','sw',1,24,4,true,''],
  ['tplink','SG3452','sw',1,48,4,false,''],
  ['tplink','SG3452P','sw',1,48,4,true,''],
  ['tplink','SX3008F','sw',1,0,8,false,'8× SFP+'],
  ['tplink','TL-SG1024D','sw',1,24,0,false,'non gestito'],
  ['tplink','TL-SG1048','sw',1,48,0,false,'non gestito'],
  ['netgear','GS724T','sw',1,24,2,false,''],
  ['netgear','GS748T','sw',1,48,4,false,''],
  ['netgear','M4250-26G4F-PoE+','sw',1,26,4,true,''],
  ['netgear','M4300-52G','sw',1,50,2,false,'2 porte 10GBASE-T'],
  ['netgear','XS708T','sw',1,8,2,false,'10 GbE'],
  ['zyxel','GS1920-24HPv2','sw',1,24,4,true,'uplink combo'],
  ['zyxel','XGS1930-28','sw',1,24,4,false,'uplink SFP+'],
  ['zyxel','XGS1930-52','sw',1,48,4,false,'uplink SFP+'],
  ['zyxel','USG FLEX 500','fw',1,0,0,false,'firewall'],
  ['zyxel','USG FLEX 700','fw',1,0,0,false,'firewall'],
  ['dlink','DGS-1024D','sw',1,24,0,false,'non gestito'],
  ['dlink','DGS-1100-24V2','sw',1,24,0,false,'smart'],
  ['dlink','DGS-1210-28','sw',1,24,4,false,''],
  ['dlink','DGS-1210-28P','sw',1,24,4,true,''],
  ['dlink','DGS-1210-52','sw',1,48,4,false,''],
  ['dlink','DGS-1510-28X','sw',1,24,4,false,'uplink SFP+'],
  ['juniper','EX2300-24T','sw',1,24,4,false,'uplink SFP+'],
  ['juniper','EX2300-24P','sw',1,24,4,true,'uplink SFP+'],
  ['juniper','EX2300-48T','sw',1,48,4,false,'uplink SFP+'],
  ['juniper','EX2300-48P','sw',1,48,4,true,'uplink SFP+'],
  ['juniper','EX3400-24P','sw',1,24,6,true,'4× SFP+ + 2× QSFP+'],
  ['juniper','EX3400-48P','sw',1,48,6,true,'4× SFP+ + 2× QSFP+'],
  ['extreme','X440-G2-24t-10GE4','sw',1,24,4,false,'uplink SFP+'],
  ['extreme','X440-G2-48p-10GE4','sw',1,48,4,true,'uplink SFP+'],
  ['extreme','5320-24P-8XE','sw',1,24,8,true,'8× SFP+'],
  ['extreme','5320-48P-8XE','sw',1,48,8,true,'8× SFP+'],
  ['panduit','Patch panel 24 porte Cat 6 (CP24BLY)','patch',1,24,0,false,''],
  ['panduit','Patch panel 48 porte Cat 6 (CP48BLY)','patch',2,48,0,false,''],
  ['panduit','Cassetto fibra Opticom FRME1','fo',1,24,0,false,'LC'],
  ['panduit','Passacavi NetManager NM1','cm',1,0,0,false,''],
  ['panduit','Passacavi NetManager NM2','cm',2,0,0,false,'doppia altezza'],
  ['commscope','SYSTIMAX 360 patch panel 24 porte Cat 6A','patch',1,24,0,false,''],
  ['commscope','SYSTIMAX 360 patch panel 48 porte Cat 6A','patch',2,48,0,false,''],
  ['commscope','360 G2 cassetto fibra 1U','fo',1,24,0,false,'LC'],
  ['commscope','Passacavi orizzontale 1U','cm',1,0,0,false,''],
  ['legrand','LCS3 patch panel 24 porte Cat 6A','patch',1,24,0,false,''],
  ['legrand','LCS3 patch panel 24 porte Cat 6','patch',1,24,0,false,''],
  ['legrand','LCS3 cassetto ottico 1U','fo',1,24,0,false,'LC'],
  ['legrand','LCS3 passacavi 1U','cm',1,0,0,false,''],
  ['schneider','Actassi patch panel 24 porte Cat 6A','patch',1,24,0,false,''],
  ['schneider','Actassi patch panel 24 porte Cat 6','patch',1,24,0,false,''],
  ['schneider','Actassi cassetto fibra 1U','fo',1,24,0,false,'LC'],
  ['schneider','Actassi passacavi 1U','cm',1,0,0,false,''],
  ['powertronix','Antares Pro 1K Rack/Tower','ups',2,0,0,false,'UPS 1 kVA / 0,9 kW, rack/tower'],
  ['powertronix','Antares Pro 2K Rack/Tower','ups',2,0,0,false,'UPS 2 kVA / 1,8 kW, rack/tower'],
  ['powertronix','Antares Pro 3K Rack/Tower','ups',2,0,0,false,'UPS 3 kVA / 2,7 kW, rack/tower'],
  ['powertronix','Antares Pro 6K Rack/Tower','ups',3,0,0,false,'UPS 6 kVA / 5,4 kW, rack/tower'],
  ['powertronix','Antares Pro 10K Rack/Tower','ups',3,0,0,false,'UPS 10 kVA / 9 kW, rack/tower'],
  ['powertronix','Vector RI 1/1-10K (modulo)','ups',3,0,0,false,'UPS modulare monofase 10 kVA, modulo 132 mm'],
  ['powertronix','Vector RI 3/1-10K (modulo)','ups',3,0,0,false,'UPS modulare trifase/monofase 10 kVA, modulo 132 mm'],
  ['powertronix','Vector RI 3/3-10K (modulo)','ups',3,0,0,false,'UPS modulare trifase 10 kVA, modulo 132 mm'],
  ['powertronix','CMP-R CMPR2U024','ups',2,0,0,false,'raddrizzatore DC 19"'],
  // Cisco, TP-Link, Synology, QNAP e Dell — modelli meno recenti
  ['cisco','Catalyst 2960-24TT-L','sw',1,26,0,false,'10/100 + 2 Gigabit'],
  ['cisco','Catalyst 2960-48TT-L','sw',1,50,0,false,'10/100 + 2 Gigabit'],
  ['cisco','Catalyst 2960-24TC-L','sw',1,26,0,false,'10/100, 2 porte combo Gigabit'],
  ['cisco','Catalyst 2960-48TC-L','sw',1,50,0,false,'10/100, 2 porte combo Gigabit'],
  ['cisco','Catalyst 2960-24PC-L','sw',1,26,0,true,'10/100, 2 porte combo Gigabit'],
  ['cisco','Catalyst 2960-48PST-L','sw',1,50,0,true,'10/100, 2 porte combo Gigabit'],
  ['cisco','Catalyst 2960-Plus 24TC-L','sw',1,26,0,false,'10/100, 2 porte combo Gigabit'],
  ['cisco','Catalyst 2960-Plus 48TC-L','sw',1,50,0,false,'10/100, 2 porte combo Gigabit'],
  ['cisco','Catalyst 2960-Plus 24PC-L','sw',1,26,0,true,'10/100, 2 porte combo Gigabit'],
  ['cisco','Catalyst 2960G-24TC-L','sw',1,24,0,false,'4 porte combo SFP'],
  ['cisco','Catalyst 2960G-48TC-L','sw',1,48,0,false,'4 porte combo SFP'],
  ['cisco','Catalyst 2960S-24TS-L','sw',1,24,4,false,''],
  ['cisco','Catalyst 2960S-48TS-L','sw',1,48,4,false,''],
  ['cisco','Catalyst 2960S-24PS-L','sw',1,24,4,true,''],
  ['cisco','Catalyst 2960S-48FPS-L','sw',1,48,4,true,''],
  ['cisco','Catalyst 3560G-24TS','sw',1,24,4,false,''],
  ['cisco','Catalyst 3560G-48TS','sw',1,48,4,false,''],
  ['cisco','Catalyst 3560G-24PS','sw',1,24,4,true,''],
  ['cisco','Catalyst 3560G-48PS','sw',1,48,4,true,''],
  ['cisco','Catalyst 3650-24PS','sw',1,24,4,true,''],
  ['cisco','Catalyst 3650-48PS','sw',1,48,4,true,''],
  ['cisco','Catalyst 3650-24TS','sw',1,24,4,false,''],
  ['cisco','Catalyst 3650-48TS','sw',1,48,4,false,''],
  ['cisco','Catalyst 2960X-48FPD-L','sw',1,48,2,true,'uplink SFP+'],
  ['cisco','Catalyst 2960X-24PD-L','sw',1,24,2,true,'uplink SFP+'],
  ['cisco','Catalyst 2960X-24TD-L','sw',1,24,2,false,'uplink SFP+'],
  ['cisco','Catalyst 3560-24PS','sw',1,24,2,true,'10/100'],
  ['cisco','Catalyst 3560-48PS','sw',1,48,4,true,'10/100'],
  ['cisco','Catalyst 3560V2-24PS','sw',1,24,2,true,'10/100'],
  ['cisco','Catalyst 3750V2-24PS','sw',1,24,2,true,'10/100, stack'],
  ['cisco','Catalyst 3560X-24T','sw',1,24,0,false,'slot per moduli di rete'],
  ['cisco','Catalyst 3560X-48T','sw',1,48,0,false,'slot per moduli di rete'],
  ['cisco','Catalyst 3560X-24P','sw',1,24,0,true,'slot per moduli di rete'],
  ['cisco','Catalyst 3560X-48P','sw',1,48,0,true,'slot per moduli di rete'],
  ['cisco','Catalyst 3750X-24T','sw',1,24,0,false,'stack, slot per moduli di rete'],
  ['cisco','Catalyst 3750X-48T','sw',1,48,0,false,'stack, slot per moduli di rete'],
  ['cisco','Catalyst 3750X-24P','sw',1,24,0,true,'stack, slot per moduli di rete'],
  ['cisco','Catalyst 3750X-48P','sw',1,48,0,true,'stack, slot per moduli di rete'],
  ['cisco','Catalyst 3850-24T','sw',1,24,0,false,'stack, slot per moduli di rete'],
  ['cisco','Catalyst 3850-48T','sw',1,48,0,false,'stack, slot per moduli di rete'],
  ['cisco','Catalyst 3850-24P','sw',1,24,0,true,'stack, slot per moduli di rete'],
  ['cisco','Catalyst 3850-48P','sw',1,48,0,true,'stack, slot per moduli di rete'],
  ['cisco','Small Business SG200-26','sw',1,26,0,false,'2 porte combo SFP'],
  ['cisco','Small Business SG200-50','sw',1,50,0,false,'2 porte combo SFP'],
  ['cisco','Small Business SG250-26','sw',1,26,0,false,'2 porte combo SFP'],
  ['cisco','Small Business SG250-50','sw',1,50,0,false,'2 porte combo SFP'],
  ['cisco','Small Business SG300-28','sw',1,28,0,false,'2 porte combo SFP'],
  ['cisco','Small Business SG300-28P','sw',1,28,0,true,'2 porte combo SFP'],
  ['cisco','Small Business SG300-52','sw',1,52,0,false,'2 porte combo SFP'],
  ['cisco','Small Business SG300-52P','sw',1,52,0,true,'2 porte combo SFP'],
  ['cisco','Small Business SF300-24','sw',1,26,0,false,'10/100 + 2 Gigabit + 2 combo'],
  ['cisco','Small Business SF300-48','sw',1,50,0,false,'10/100 + 2 Gigabit + 2 combo'],
  ['cisco','Small Business SG350-28','sw',1,26,2,false,'2 porte combo SFP'],
  ['cisco','Small Business SG350-28P','sw',1,26,2,true,'2 porte combo SFP'],
  ['cisco','Small Business SG350-52','sw',1,50,2,false,'2 porte combo SFP'],
  ['cisco','Small Business SG350-52P','sw',1,50,2,true,'2 porte combo SFP'],
  ['cisco','Small Business SG350X-24','sw',1,26,2,false,'2 combo 10G + 2 SFP+, stack'],
  ['cisco','Small Business SG350X-48','sw',1,50,2,false,'2 combo 10G + 2 SFP+, stack'],
  ['cisco','Small Business SG110-24','sw',1,24,0,false,'non gestito'],
  ['cisco','Meraki MS220-24P','sw',1,24,4,true,''],
  ['cisco','Meraki MS220-48LP','sw',1,48,4,true,''],
  ['cisco','Meraki MS220-48','sw',1,48,4,false,''],
  ['cisco','Meraki MS320-48LP','sw',1,48,4,true,''],
  ['cisco','Meraki MS350-48LP','sw',1,48,4,true,'stack'],
  ['cisco','ISR 4321','router',1,2,0,false,'router a servizi integrati'],
  ['cisco','ISR 4351','router',2,3,0,false,'router a servizi integrati'],
  ['cisco','ISR 4221','router',1,2,0,false,'router a servizi integrati'],
  ['cisco','ISR 2901','router',1,2,0,false,'router a servizi integrati'],
  ['cisco','ISR 2911','router',2,3,0,false,'router a servizi integrati'],
  ['cisco','ISR 2921','router',2,3,0,false,'router a servizi integrati'],
  ['cisco','ISR 1921','router',1,2,0,false,'router a servizi integrati'],
  ['cisco','ISR 1941','router',2,2,0,false,'router a servizi integrati'],
  ['cisco','ISR 3925','router',3,3,0,false,'router a servizi integrati'],
  ['cisco','ASA 5508-X','fw',1,8,0,false,'firewall'],
  ['cisco','ASA 5516-X','fw',1,8,0,false,'firewall'],
  ['cisco','ASA 5512-X','fw',1,6,0,false,'firewall'],
  ['cisco','ASA 5515-X','fw',1,6,0,false,'firewall'],
  ['cisco','ASA 5545-X','fw',1,8,0,false,'firewall'],
  ['cisco','ASA 5555-X','fw',1,8,0,false,'firewall'],
  ['cisco','ASA 5510','fw',1,5,0,false,'firewall'],
  ['cisco','ASA 5520','fw',1,5,0,false,'firewall'],
  ['cisco','ASA 5540','fw',1,5,0,false,'firewall'],
  ['cisco','Firepower 2110','fw',1,12,4,false,'firewall'],
  ['cisco','Firepower 2120','fw',1,12,4,false,'firewall'],
  ['cisco','Firepower 2130','fw',1,12,4,false,'firewall'],
  ['cisco','UCS C220 M4','srv',1,2,0,false,'server'],
  ['cisco','UCS C240 M4','srv',2,2,0,false,'server'],
  ['cisco','UCS C220 M3','srv',1,2,0,false,'server'],
  ['cisco','UCS C240 M3','srv',2,2,0,false,'server'],
  ['tplink','T1600G-28TS (TL-SG2424)','sw',1,24,4,false,''],
  ['tplink','T1600G-52TS (TL-SG2452)','sw',1,48,4,false,''],
  ['tplink','T1600G-28PS (TL-SG2424P)','sw',1,24,4,true,''],
  ['tplink','T1600G-52PS (TL-SG2452P)','sw',1,48,4,true,''],
  ['tplink','T2600G-28TS (TL-SG3424)','sw',1,24,4,false,''],
  ['tplink','T2600G-52TS (TL-SG3452)','sw',1,48,4,false,''],
  ['tplink','T2600G-28MPS (TL-SG3424P)','sw',1,24,4,true,''],
  ['tplink','T2600G-28SQ','sw',1,4,24,false,'24 SFP + 4 combo'],
  ['tplink','T2500G-10TS (TL-SG3210)','sw',1,8,2,false,'da tavolo, a rack con kit'],
  ['tplink','T3700G-28TQ','sw',1,24,0,false,'4 porte combo SFP, slot per moduli 10G e stack'],
  ['tplink','T2700G-28TQ','sw',1,24,0,false,'4 porte combo SFP, slot per moduli 10G'],
  ['tplink','TL-SG3424','sw',1,24,4,false,''],
  ['tplink','TL-SG3428','sw',1,24,4,false,''],
  ['tplink','TL-SG2428P','sw',1,24,4,true,''],
  ['tplink','TL-SL2428P','sw',1,26,4,true,'10/100 PoE + 2 Gigabit'],
  ['tplink','TL-SL3428','sw',1,26,2,false,'10/100 + 2 Gigabit'],
  ['tplink','TL-SG1016DE','sw',1,16,0,false,'easy smart'],
  ['tplink','TL-SG1024DE','sw',1,24,0,false,'easy smart'],
  ['tplink','TL-SG1016','sw',1,16,0,false,'non gestito'],
  ['tplink','TL-SG1024','sw',1,24,0,false,'non gestito'],
  ['tplink','TL-SF1024','sw',1,24,0,false,'10/100, non gestito'],
  ['tplink','TL-SF1048','sw',1,48,0,false,'10/100, non gestito'],
  ['tplink','TL-SG1428PE','sw',1,26,2,true,'easy smart'],
  ['tplink','TL-SG1210MPE','sw',1,10,0,true,'easy smart'],
  ['synology','RS214','srv',1,0,0,false,'2 dischi'],
  ['synology','RS409','srv',1,0,0,false,'4 dischi'],
  ['synology','RS411','srv',1,0,0,false,'4 dischi'],
  ['synology','RS812','srv',1,0,0,false,'4 dischi'],
  ['synology','RS812+','srv',1,0,0,false,'4 dischi'],
  ['synology','RS814','srv',1,0,0,false,'4 dischi'],
  ['synology','RS815','srv',1,0,0,false,'4 dischi'],
  ['synology','RS816','srv',1,0,0,false,'4 dischi'],
  ['synology','RS815+','srv',1,0,0,false,'4 dischi'],
  ['synology','RS818+','srv',1,0,0,false,'4 dischi'],
  ['synology','RS812RP+','srv',1,0,0,false,'4 dischi, alimentazione ridondata'],
  ['synology','RS814RP+','srv',1,0,0,false,'4 dischi, alimentazione ridondata'],
  ['synology','RS815RP+','srv',1,0,0,false,'4 dischi, alimentazione ridondata'],
  ['synology','RS818RP+','srv',1,0,0,false,'4 dischi, alimentazione ridondata'],
  ['synology','RS2211+','srv',2,0,0,false,'10 dischi'],
  ['synology','RS2212+','srv',2,0,0,false,'10 dischi'],
  ['synology','RS2414+','srv',2,0,0,false,'12 dischi'],
  ['synology','RS2416+','srv',2,0,0,false,'12 dischi'],
  ['synology','RS3412xs','srv',2,0,0,false,'10 dischi'],
  ['synology','RS3413xs+','srv',2,0,0,false,'10 dischi'],
  ['synology','RS3614xs','srv',2,0,0,false,'12 dischi'],
  ['synology','RS3617xs','srv',2,0,0,false,'12 dischi'],
  ['synology','RS18017xs+','srv',2,0,0,false,'12 dischi'],
  ['synology','RS10613xs+','srv',2,0,0,false,'10 dischi'],
  ['synology','RS2211RP+','srv',2,0,0,false,'10 dischi, alimentazione ridondata'],
  ['synology','RS2212RP+','srv',2,0,0,false,'10 dischi, alimentazione ridondata'],
  ['synology','RS2414RP+','srv',2,0,0,false,'12 dischi, alimentazione ridondata'],
  ['synology','RS2416RP+','srv',2,0,0,false,'12 dischi, alimentazione ridondata'],
  ['synology','RS2418RP+','srv',2,0,0,false,'12 dischi, alimentazione ridondata'],
  ['synology','RS3412RPxs','srv',2,0,0,false,'10 dischi, alimentazione ridondata'],
  ['synology','RS3614RPxs','srv',2,0,0,false,'12 dischi, alimentazione ridondata'],
  ['synology','RS3617RPxs','srv',2,0,0,false,'12 dischi, alimentazione ridondata'],
  ['synology','RS4017xs+','srv',3,0,0,false,'16 dischi'],
  ['synology','RX410','srv',1,0,0,false,'espansione 4 dischi'],
  ['synology','RX1211','srv',2,0,0,false,'espansione 12 dischi'],
  ['synology','RX1211RP','srv',2,0,0,false,'espansione 12 dischi, alimentazione ridondata'],
  ['synology','RX1214','srv',2,0,0,false,'espansione 12 dischi'],
  ['synology','RX1214RP','srv',2,0,0,false,'espansione 12 dischi, alimentazione ridondata'],
  ['synology','RX1216sas','srv',2,0,0,false,'espansione 12 dischi'],
  ['synology','RX2417sas','srv',2,0,0,false,'espansione 24 dischi'],
  ['qnap','TS-412U','srv',1,0,0,false,'NAS 4 dischi'],
  ['qnap','TS-419U II','srv',1,0,0,false,'NAS 4 dischi'],
  ['qnap','TS-421U','srv',1,0,0,false,'NAS 4 dischi'],
  ['qnap','TS-431U','srv',1,0,0,false,'NAS 4 dischi'],
  ['qnap','TS-431XeU','srv',1,0,0,false,'NAS 4 dischi'],
  ['qnap','TS-453U','srv',1,0,0,false,'NAS 4 dischi'],
  ['qnap','TS-453BU','srv',1,0,0,false,'NAS 4 dischi'],
  ['qnap','TS-463U','srv',1,0,0,false,'NAS 4 dischi'],
  ['qnap','TS-463XU','srv',1,0,0,false,'NAS 4 dischi'],
  ['qnap','TS-459U-RP','srv',1,0,0,false,'NAS 4 dischi, alimentazione ridondata'],
  ['qnap','TS-469U-RP','srv',1,0,0,false,'NAS 4 dischi, alimentazione ridondata'],
  ['qnap','TS-453U-RP','srv',1,0,0,false,'NAS 4 dischi, alimentazione ridondata'],
  ['qnap','TS-453BU-RP','srv',1,0,0,false,'NAS 4 dischi, alimentazione ridondata'],
  ['qnap','TS-463U-RP','srv',1,0,0,false,'NAS 4 dischi, alimentazione ridondata'],
  ['qnap','TS-463XU-RP','srv',1,0,0,false,'NAS 4 dischi, alimentazione ridondata'],
  ['qnap','TS-470U-RP','srv',1,0,0,false,'NAS 4 dischi, alimentazione ridondata'],
  ['qnap','TS-831XU','srv',2,0,0,false,'NAS 8 dischi'],
  ['qnap','TS-853U','srv',2,0,0,false,'NAS 8 dischi'],
  ['qnap','TS-853BU','srv',2,0,0,false,'NAS 8 dischi'],
  ['qnap','TS-863U','srv',2,0,0,false,'NAS 8 dischi'],
  ['qnap','TS-873U','srv',2,0,0,false,'NAS 8 dischi'],
  ['qnap','TS-873AU','srv',2,0,0,false,'NAS 8 dischi'],
  ['qnap','TS-877XU','srv',2,0,0,false,'NAS 8 dischi'],
  ['qnap','TS-883XU','srv',2,0,0,false,'NAS 8 dischi'],
  ['qnap','TS-879U-RP','srv',2,0,0,false,'NAS 8 dischi, alimentazione ridondata'],
  ['qnap','TS-853U-RP','srv',2,0,0,false,'NAS 8 dischi, alimentazione ridondata'],
  ['qnap','TS-853BU-RP','srv',2,0,0,false,'NAS 8 dischi, alimentazione ridondata'],
  ['qnap','TS-863U-RP','srv',2,0,0,false,'NAS 8 dischi, alimentazione ridondata'],
  ['qnap','TS-873U-RP','srv',2,0,0,false,'NAS 8 dischi, alimentazione ridondata'],
  ['qnap','TS-873AU-RP','srv',2,0,0,false,'NAS 8 dischi, alimentazione ridondata'],
  ['qnap','TS-877XU-RP','srv',2,0,0,false,'NAS 8 dischi, alimentazione ridondata'],
  ['qnap','TS-883XU-RP','srv',2,0,0,false,'NAS 8 dischi, alimentazione ridondata'],
  ['qnap','TS-1231XU','srv',2,0,0,false,'NAS 12 dischi'],
  ['qnap','TS-1253U','srv',2,0,0,false,'NAS 12 dischi'],
  ['qnap','TS-1253BU','srv',2,0,0,false,'NAS 12 dischi'],
  ['qnap','TS-1279U-RP','srv',2,0,0,false,'NAS 12 dischi, alimentazione ridondata'],
  ['qnap','TS-EC1279U-RP','srv',2,0,0,false,'NAS 12 dischi, alimentazione ridondata'],
  ['qnap','TS-1253U-RP','srv',2,0,0,false,'NAS 12 dischi, alimentazione ridondata'],
  ['qnap','TS-1253BU-RP','srv',2,0,0,false,'NAS 12 dischi, alimentazione ridondata'],
  ['qnap','TS-1263U-RP','srv',2,0,0,false,'NAS 12 dischi, alimentazione ridondata'],
  ['qnap','TS-1273U-RP','srv',2,0,0,false,'NAS 12 dischi, alimentazione ridondata'],
  ['qnap','TS-1277XU-RP','srv',2,0,0,false,'NAS 12 dischi, alimentazione ridondata'],
  ['qnap','TS-1283XU-RP','srv',2,0,0,false,'NAS 12 dischi, alimentazione ridondata'],
  ['qnap','TS-1231XU-RP','srv',2,0,0,false,'NAS 12 dischi, alimentazione ridondata'],
  ['qnap','TS-1679U-RP','srv',3,0,0,false,'NAS 16 dischi, alimentazione ridondata'],
  ['qnap','TS-EC1679U-RP','srv',3,0,0,false,'NAS 16 dischi, alimentazione ridondata'],
  ['qnap','TS-1673U-RP','srv',3,0,0,false,'NAS 16 dischi, alimentazione ridondata'],
  ['qnap','TS-1677XU-RP','srv',3,0,0,false,'NAS 16 dischi, alimentazione ridondata'],
  ['qnap','TS-1683XU-RP','srv',3,0,0,false,'NAS 16 dischi, alimentazione ridondata'],
  ['qnap','TS-EC2480U-RP','srv',4,0,0,false,'NAS 24 dischi, alimentazione ridondata'],
  ['qnap','TS-2483XU-RP','srv',4,0,0,false,'NAS 24 dischi, alimentazione ridondata'],
  ['qnap','TS-2477XU-RP','srv',4,0,0,false,'NAS 24 dischi, alimentazione ridondata'],
  ['qnap','UX-800U-RP','srv',2,0,0,false,'NAS espansione 8 dischi'],
  ['qnap','UX-1200U-RP','srv',2,0,0,false,'NAS espansione 12 dischi'],
  ['qnap','REXP-1220U-RP','srv',2,0,0,false,'NAS espansione 12 dischi'],
  ['qnap','REXP-1620U-RP','srv',3,0,0,false,'NAS espansione 16 dischi'],
  ['dell','PowerEdge R210 II','srv',1,0,0,false,'server 11ª gen.'],
  ['dell','PowerEdge R310','srv',1,0,0,false,'server 11ª gen.'],
  ['dell','PowerEdge R410','srv',1,0,0,false,'server 11ª gen.'],
  ['dell','PowerEdge R510','srv',2,0,0,false,'server 11ª gen.'],
  ['dell','PowerEdge R610','srv',1,0,0,false,'server 11ª gen.'],
  ['dell','PowerEdge R710','srv',2,0,0,false,'server 11ª gen.'],
  ['dell','PowerEdge R810','srv',2,0,0,false,'server 11ª gen.'],
  ['dell','PowerEdge R910','srv',4,0,0,false,'server 11ª gen.'],
  ['dell','PowerEdge R220','srv',1,0,0,false,'server 12ª gen.'],
  ['dell','PowerEdge R320','srv',1,0,0,false,'server 12ª gen.'],
  ['dell','PowerEdge R420','srv',1,0,0,false,'server 12ª gen.'],
  ['dell','PowerEdge R520','srv',2,0,0,false,'server 12ª gen.'],
  ['dell','PowerEdge R620','srv',1,0,0,false,'server 12ª gen.'],
  ['dell','PowerEdge R720','srv',2,0,0,false,'server 12ª gen.'],
  ['dell','PowerEdge R720xd','srv',2,0,0,false,'server 12ª gen.'],
  ['dell','PowerEdge R820','srv',2,0,0,false,'server 12ª gen.'],
  ['dell','PowerEdge R920','srv',4,0,0,false,'server 12ª gen.'],
  ['dell','PowerEdge R230','srv',1,0,0,false,'server 13ª gen.'],
  ['dell','PowerEdge R330','srv',1,0,0,false,'server 13ª gen.'],
  ['dell','PowerEdge R430','srv',1,0,0,false,'server 13ª gen.'],
  ['dell','PowerEdge R530','srv',2,0,0,false,'server 13ª gen.'],
  ['dell','PowerEdge R630','srv',1,0,0,false,'server 13ª gen.'],
  ['dell','PowerEdge R730','srv',2,0,0,false,'server 13ª gen.'],
  ['dell','PowerEdge R730xd','srv',2,0,0,false,'server 13ª gen.'],
  ['dell','PowerEdge R830','srv',2,0,0,false,'server 13ª gen.'],
  ['dell','PowerEdge R930','srv',4,0,0,false,'server 13ª gen.'],
  ['dell','PowerVault MD1200','srv',2,0,0,false,'espansione 12 dischi'],
  ['dell','PowerVault MD1220','srv',2,0,0,false,'espansione 24 dischi'],
  ['dell','PowerVault MD1400','srv',2,0,0,false,'espansione 12 dischi'],
  ['dell','PowerVault MD1420','srv',2,0,0,false,'espansione 24 dischi'],
  ['dell','PowerVault MD3200','srv',2,0,0,false,'SAN 12 dischi, doppio controller'],
  ['dell','PowerVault MD3220','srv',2,0,0,false,'SAN 24 dischi, doppio controller'],
  ['dell','PowerVault MD3400','srv',2,0,0,false,'SAN 12 dischi, doppio controller'],
  ['dell','PowerVault MD3420','srv',2,0,0,false,'SAN 24 dischi, doppio controller'],
  ['dell','PowerVault ME4084','srv',5,0,0,false,'storage 84 dischi'],
  ['dell','PowerConnect 2824','sw',1,24,0,false,'2 porte combo SFP'],
  ['dell','PowerConnect 2848','sw',1,48,0,false,'2 porte combo SFP'],
  ['dell','PowerConnect 3524','sw',1,26,2,false,'10/100 + 2 Gigabit + 2 SFP'],
  ['dell','PowerConnect 3548','sw',1,50,2,false,'10/100 + 2 Gigabit + 2 SFP'],
  ['dell','PowerConnect 3524P','sw',1,26,2,true,'10/100 + 2 Gigabit + 2 SFP'],
  ['dell','PowerConnect 3548P','sw',1,50,2,true,'10/100 + 2 Gigabit + 2 SFP'],
  ['dell','PowerConnect 5424','sw',1,24,0,false,'4 porte combo SFP'],
  ['dell','PowerConnect 5448','sw',1,48,0,false,'4 porte combo SFP'],
  ['dell','PowerConnect 5524','sw',1,24,2,false,'uplink SFP+'],
  ['dell','PowerConnect 5548','sw',1,48,2,false,'uplink SFP+'],
  ['dell','PowerConnect 5524P','sw',1,24,2,true,'uplink SFP+'],
  ['dell','PowerConnect 5548P','sw',1,48,2,true,'uplink SFP+'],
  ['dell','PowerConnect 6224','sw',1,24,0,false,'4 porte combo SFP, slot per moduli 10G e stack'],
  ['dell','PowerConnect 6248','sw',1,48,0,false,'4 porte combo SFP, slot per moduli 10G e stack'],
  ['dell','PowerConnect 6224P','sw',1,24,0,true,'4 porte combo SFP, slot per moduli 10G e stack'],
  ['dell','PowerConnect 6248P','sw',1,48,0,true,'4 porte combo SFP, slot per moduli 10G e stack'],
  ['dell','PowerConnect 7024','sw',1,24,0,false,'4 porte combo SFP, slot per moduli 10G e stack'],
  ['dell','PowerConnect 7048','sw',1,48,0,false,'4 porte combo SFP, slot per moduli 10G e stack'],
  ['dell','Networking N1524','sw',1,24,4,false,'uplink SFP+'],
  ['dell','Networking N1548','sw',1,48,4,false,'uplink SFP+'],
  ['dell','Networking N1524P','sw',1,24,4,true,'uplink SFP+'],
  ['dell','Networking N1548P','sw',1,48,4,true,'uplink SFP+'],
  ['dell','Networking N2024','sw',1,24,2,false,'uplink SFP+, stack'],
  ['dell','Networking N2048','sw',1,48,2,false,'uplink SFP+, stack'],
  ['dell','Networking N2024P','sw',1,24,2,true,'uplink SFP+, stack'],
  ['dell','Networking N2048P','sw',1,48,2,true,'uplink SFP+, stack'],
  ['dell','Networking N3024','sw',1,24,2,false,'uplink SFP+, stack'],
  ['dell','Networking N3048','sw',1,48,2,false,'uplink SFP+, stack'],
  ['dell','Networking N3024P','sw',1,24,2,true,'uplink SFP+, stack'],
  ['dell','Networking N3048P','sw',1,48,2,true,'uplink SFP+, stack'],
  ['dell','Networking X1026','sw',1,24,2,false,'web managed'],
  ['dell','Networking X1052','sw',1,48,4,false,'web managed'],
  ['dell','Networking X1026P','sw',1,24,2,true,'web managed'],
  ['dell','Networking X1052P','sw',1,48,4,true,'web managed'],
  ['dell','Networking S3048-ON','sw',1,48,4,false,'uplink SFP+'],
  ['dell','Networking S4048-ON','sw',1,0,54,false,'48× SFP+ + 6× QSFP+'],
];
const FIELD_MODELS=[
  // Ubiquiti — access point
  ['ubiquiti','U7 Pro','ap','Wi-Fi 7'],['ubiquiti','U7 Pro Max','ap','Wi-Fi 7'],['ubiquiti','U7 Pro Wall','ap','Wi-Fi 7 a parete'],['ubiquiti','U7 Outdoor','ap','Wi-Fi 7 esterno'],
  ['ubiquiti','U6+','ap','Wi-Fi 6'],['ubiquiti','U6 Lite','ap','Wi-Fi 6'],['ubiquiti','U6 Pro','ap','Wi-Fi 6'],['ubiquiti','U6 Long-Range','ap','Wi-Fi 6'],['ubiquiti','U6 Enterprise','ap','Wi-Fi 6E'],
  ['ubiquiti','U6 Mesh','ap','Wi-Fi 6 interno/esterno'],['ubiquiti','U6 In-Wall','ap','Wi-Fi 6 a parete'],['ubiquiti','U6 Enterprise In-Wall','ap','Wi-Fi 6E a parete'],
  ['ubiquiti','UAP-AC-Lite','ap','Wi-Fi 5'],['ubiquiti','UAP-AC-LR','ap','Wi-Fi 5'],['ubiquiti','UAP-AC-Pro','ap','Wi-Fi 5'],['ubiquiti','UAP-AC-HD','ap','Wi-Fi 5'],['ubiquiti','UAP-nanoHD','ap','Wi-Fi 5'],['ubiquiti','UAP-AC-M','ap','Wi-Fi 5 mesh'],
  // Ubiquiti — telecamere e altro
  ['ubiquiti','G5 Bullet','cam','UniFi Protect'],['ubiquiti','G5 Dome','cam','UniFi Protect'],['ubiquiti','G5 Turret Ultra','cam','UniFi Protect'],['ubiquiti','G5 Flex','cam','UniFi Protect'],['ubiquiti','G5 Pro','cam','UniFi Protect'],
  ['ubiquiti','G4 Pro','cam','UniFi Protect'],['ubiquiti','G4 Bullet','cam','UniFi Protect'],['ubiquiti','G4 Dome','cam','UniFi Protect'],['ubiquiti','AI Pro','cam','UniFi Protect'],['ubiquiti','AI 360','cam','UniFi Protect fisheye'],['ubiquiti','AI Bullet','cam','UniFi Protect'],
  ['ubiquiti','G4 Doorbell Pro PoE','cam','videocitofono'],
  ['ubiquiti','USW-Flex-Mini','altro','switch 5 porte da scrivania'],['ubiquiti','USW-Flex','altro','switch PoE 5 porte'],['ubiquiti','USW-Lite-8-PoE','altro','switch 8 porte PoE'],
  // Ubiquiti — modelli meno recenti
  ['ubiquiti','UAP','ap','Wi-Fi 4'],['ubiquiti','UAP-LR','ap','Wi-Fi 4 lunga portata'],['ubiquiti','UAP-Pro','ap','Wi-Fi 4'],['ubiquiti','UAP-Outdoor+','ap','Wi-Fi 4 esterno'],
  ['ubiquiti','UAP-AC','ap','Wi-Fi 5'],['ubiquiti','UAP-AC-EDU','ap','Wi-Fi 5'],['ubiquiti','UAP-AC-SHD','ap','Wi-Fi 5 alta densità'],['ubiquiti','UAP-XG','ap','Wi-Fi 5 alta densità'],['ubiquiti','UAP-FlexHD','ap','Wi-Fi 5'],['ubiquiti','UAP-BeaconHD','ap','Wi-Fi 5 mesh'],
  ['ubiquiti','UAP-AC-M-Pro','ap','Wi-Fi 5 mesh esterno'],['ubiquiti','UAP-AC-Outdoor','ap','Wi-Fi 5 esterno'],['ubiquiti','UAP-AC-IW','ap','Wi-Fi 5 a parete'],['ubiquiti','UAP-AC-IW-Pro','ap','Wi-Fi 5 a parete'],['ubiquiti','UAP-IW-HD','ap','Wi-Fi 5 a parete'],
  ['ubiquiti','UniFi Dream Machine (UDM)','ap','router Wi-Fi 5'],
  ['ubiquiti','NanoStation M5','ap','ponte radio 5 GHz'],['ubiquiti','NanoStation loco M5','ap','ponte radio 5 GHz'],['ubiquiti','NanoStation 5AC','ap','ponte radio 5 GHz'],['ubiquiti','NanoStation 5AC Loco','ap','ponte radio 5 GHz'],
  ['ubiquiti','NanoBeam 5AC','ap','ponte radio 5 GHz'],['ubiquiti','LiteBeam 5AC','ap','ponte radio 5 GHz'],['ubiquiti','PowerBeam 5AC','ap','ponte radio 5 GHz'],['ubiquiti','Rocket 5AC Prism','ap','ponte radio 5 GHz'],
  ['ubiquiti','G4 Instant','cam','UniFi Protect Wi-Fi'],['ubiquiti','G4 Flex','cam','UniFi Protect'],['ubiquiti','G4 Doorbell','cam','videocitofono Wi-Fi'],
  ['ubiquiti','G3 Bullet (UVC-G3-Bullet)','cam','UniFi Protect'],['ubiquiti','G3 Flex (UVC-G3-Flex)','cam','UniFi Protect'],['ubiquiti','G3 Dome (UVC-G3-Dome)','cam','UniFi Protect'],['ubiquiti','G3 Pro (UVC-G3-Pro)','cam','UniFi Protect'],
  ['ubiquiti','G3 Instant','cam','UniFi Protect Wi-Fi'],['ubiquiti','G3 Micro (UVC-G3-Micro)','cam','UniFi Protect Wi-Fi'],
  ['ubiquiti','UniFi Video Camera (UVC)','cam','UniFi Video'],['ubiquiti','UVC-Dome','cam','UniFi Video'],['ubiquiti','UVC-Pro','cam','UniFi Video'],['ubiquiti','airCam','cam','UniFi Video'],['ubiquiti','airCam Dome','cam','UniFi Video'],['ubiquiti','airCam Mini','cam','UniFi Video'],
  ['ubiquiti','UniFi Security Gateway (USG)','altro','gateway 3 porte'],['ubiquiti','UniFi Cloud Key Gen2 Plus (UCK-G2-PLUS)','altro','controller UniFi con disco'],['ubiquiti','UniFi Cloud Key (UC-CK)','altro','controller Wi-Fi'],['ubiquiti','UniFi Video NVR (UVC-NVR)','altro','NVR da tavolo, 1 disco'],
  ['ubiquiti','EdgeRouter X (ER-X)','altro','router 5 porte'],['ubiquiti','EdgeRouter X SFP (ER-X-SFP)','altro','router 5 porte PoE + SFP'],['ubiquiti','EdgeRouter Lite (ERLite-3)','altro','router 3 porte'],['ubiquiti','EdgeRouter PoE (ERPoe-5)','altro','router 5 porte PoE'],
  ['ubiquiti','EdgeRouter 4 (ER-4)','altro','router 3 porte + SFP'],['ubiquiti','EdgeRouter 6P (ER-6P)','altro','router 5 porte PoE + SFP'],['ubiquiti','EdgeRouter 12 (ER-12)','altro','router 10 porte + 2 SFP'],
  ['ubiquiti','UniFi Switch 8 (US-8)','altro','switch 8 porte da tavolo'],['ubiquiti','UniFi Switch 8 60W (US-8-60W)','altro','switch 8 porte PoE'],['ubiquiti','UniFi Switch 8 150W (US-8-150W)','altro','switch 8 porte PoE + 2 SFP'],
  ['ubiquiti','UniFi Switch XG 6 PoE (US-XG-6POE)','altro','switch 10G 4 porte PoE + 2 SFP+'],['ubiquiti','USW-Flex-XG','altro','switch 10G 5 porte da tavolo'],
  ['ubiquiti','EdgeSwitch 8 150W (ES-8-150W)','altro','switch 8 porte PoE + 2 SFP'],['ubiquiti','EdgeSwitch 10X (ES-10X)','altro','switch 8 porte + 2 SFP da tavolo'],['ubiquiti','EdgeSwitch 10XP (ES-10XP)','altro','switch 8 porte PoE + 2 SFP'],
  // MikroTik
  ['mikrotik','cAP ax','ap','Wi-Fi 6 a soffitto'],['mikrotik','cAP ac','ap','Wi-Fi 5 a soffitto'],['mikrotik','cAP XL ac','ap','Wi-Fi 5 a soffitto'],['mikrotik','wAP ax','ap','Wi-Fi 6 interno/esterno'],['mikrotik','wAP ac','ap','Wi-Fi 5 esterno'],
  ['mikrotik','hAP ax²','ap','router Wi-Fi 6'],['mikrotik','hAP ax³','ap','router Wi-Fi 6'],['mikrotik','hEX (RB750Gr3)','altro','router 5 porte'],['mikrotik','CRS305-1G-4S+IN','altro','switch 4× SFP+ da tavolo'],
  ['mikrotik','hAP ac³','ap','router Wi-Fi 5'],['mikrotik','hAP ac²','ap','router Wi-Fi 5'],['mikrotik','hAP ac (RB962UiGS-5HacT2HnT)','ap','router Wi-Fi 5'],['mikrotik','hAP ac lite','ap','router Wi-Fi 5'],
  ['mikrotik','hAP (RB951Ui-2nD)','ap','router Wi-Fi 4'],['mikrotik','hAP lite (RB941-2nD)','ap','router Wi-Fi 4'],['mikrotik','RB951G-2HnD','ap','router Wi-Fi 4'],['mikrotik','RB2011UiAS-2HnD-IN','ap','router Wi-Fi 4'],
  ['mikrotik','cAP lite','ap','Wi-Fi 4 a soffitto'],['mikrotik','cAP (RBcAP2n)','ap','Wi-Fi 4 a soffitto'],['mikrotik','wAP (RBwAP2nD)','ap','Wi-Fi 4 esterno'],['mikrotik','wAP ac (RBwAPG-5HacT2HnD)','ap','Wi-Fi 5 esterno'],
  ['mikrotik','mAP lite','ap','Wi-Fi 4 portatile'],['mikrotik','SXT Lite5','ap','ponte radio 5 GHz'],['mikrotik','LHG 5','ap','ponte radio 5 GHz'],['mikrotik','LHG XL 5 ac','ap','ponte radio 5 GHz'],
  ['mikrotik','hEX (RB750Gr2)','altro','router 5 porte'],['mikrotik','hEX lite (RB750r2)','altro','router 5 porte'],['mikrotik','hEX S (RB760iGS)','altro','router 5 porte + SFP'],['mikrotik','hEX PoE (RB960PGS)','altro','router 5 porte PoE + SFP'],['mikrotik','hEX PoE lite (RB750UPr2)','altro','router 5 porte PoE'],
  ['mikrotik','RB750GL','altro','router 5 porte'],['mikrotik','RB450G','altro','router 5 porte'],['mikrotik','RB850Gx2','altro','router 5 porte'],
  ['mikrotik','CSS106-5G-1S (RB260GS)','altro','switch 5 porte + SFP da scrivania'],['mikrotik','CSS610-8G-2S+IN','altro','switch 8 porte + 2× SFP+ da tavolo'],['mikrotik','CRS106-1C-5S','altro','switch 5× SFP da tavolo'],
  // Aruba / HPE
  ['aruba','AP-303','ap','Wi-Fi 5'],['aruba','AP-505','ap','Wi-Fi 6'],['aruba','AP-515','ap','Wi-Fi 6'],['aruba','AP-535','ap','Wi-Fi 6'],['aruba','AP-503H','ap','Wi-Fi 6 a parete'],
  ['aruba','AP-635','ap','Wi-Fi 6E'],['aruba','AP-655','ap','Wi-Fi 6E'],['aruba','AP-735','ap','Wi-Fi 7'],
  ['aruba','Instant On AP11','ap','Wi-Fi 5'],['aruba','Instant On AP15','ap','Wi-Fi 5'],['aruba','Instant On AP22','ap','Wi-Fi 6'],['aruba','Instant On AP25','ap','Wi-Fi 6'],['aruba','Instant On AP32','ap','Wi-Fi 6E'],['aruba','Instant On AP27','ap','Wi-Fi 6 esterno'],
  ['hpe','Aruba Instant On AP22 (HPE)','ap','Wi-Fi 6'],
  // Cisco
  ['cisco','Catalyst 9105AXI','ap','Wi-Fi 6'],['cisco','Catalyst 9115AXI','ap','Wi-Fi 6'],['cisco','Catalyst 9120AXI','ap','Wi-Fi 6'],['cisco','Catalyst 9130AXI','ap','Wi-Fi 6'],['cisco','Catalyst 9136I','ap','Wi-Fi 6E'],
  ['cisco','CW9162I','ap','Wi-Fi 6E'],['cisco','CW9164I','ap','Wi-Fi 6E'],['cisco','CW9166I','ap','Wi-Fi 6E'],['cisco','CW9172I','ap','Wi-Fi 7'],['cisco','CW9176I','ap','Wi-Fi 7'],
  ['cisco','Meraki MR36','ap','Wi-Fi 6'],['cisco','Meraki MR44','ap','Wi-Fi 6'],['cisco','Meraki MR46','ap','Wi-Fi 6'],['cisco','Meraki MR56','ap','Wi-Fi 6'],['cisco','Meraki MR57','ap','Wi-Fi 6E'],
  ['cisco','Aironet 1832I','ap','Wi-Fi 5'],['cisco','Aironet 2802I','ap','Wi-Fi 5'],['cisco','Aironet 3802I','ap','Wi-Fi 5'],['cisco','Business CBW240AC','ap','Wi-Fi 5'],['cisco','Business CBW150AX','ap','Wi-Fi 6'],
  ['cisco','Meraki MV12','cam','telecamera cloud'],['cisco','Meraki MV22','cam','telecamera cloud'],['cisco','Meraki MV32','cam','fisheye cloud'],['cisco','Meraki MV63','cam','esterno cloud'],['cisco','Meraki MV72','cam','esterno cloud'],
  // Ruckus
  ['ruckus','R350','ap','Wi-Fi 6'],['ruckus','R550','ap','Wi-Fi 6'],['ruckus','R650','ap','Wi-Fi 6'],['ruckus','R750','ap','Wi-Fi 6'],['ruckus','R850','ap','Wi-Fi 6'],
  ['ruckus','R560','ap','Wi-Fi 6E'],['ruckus','R670','ap','Wi-Fi 7'],['ruckus','R770','ap','Wi-Fi 7'],['ruckus','H350','ap','Wi-Fi 6 a parete'],['ruckus','H550','ap','Wi-Fi 6 a parete'],['ruckus','T350c','ap','Wi-Fi 6 esterno'],['ruckus','T750','ap','Wi-Fi 6 esterno'],
  // ZTE
  ['zte','ZXHN F6640','altro','ONT fibra Wi-Fi 6'],['zte','ZXHN F680','altro','ONT fibra Wi-Fi 5'],['zte','ZXHN H3600','altro','router Wi-Fi 6'],['zte','ZXHN H388X','altro','router FWA'],
  // Synology
  ['synology','DS124','altro','NAS da tavolo, 1 disco'],['synology','DS223','altro','NAS da tavolo, 2 dischi'],['synology','DS223j','altro','NAS da tavolo, 2 dischi'],['synology','DS224+','altro','NAS da tavolo, 2 dischi'],['synology','DS225+','altro','NAS da tavolo, 2 dischi'],['synology','DS725+','altro','NAS da tavolo, 2 dischi'],['synology','DS423','altro','NAS da tavolo, 4 dischi'],['synology','DS423+','altro','NAS da tavolo, 4 dischi'],['synology','DS425+','altro','NAS da tavolo, 4 dischi'],['synology','DS723+','altro','NAS da tavolo, 2 dischi'],['synology','DS923+','altro','NAS da tavolo, 4 dischi'],['synology','DS925+','altro','NAS da tavolo, 4 dischi'],['synology','DS1522+','altro','NAS da tavolo, 5 dischi'],['synology','DS1525+','altro','NAS da tavolo, 5 dischi'],['synology','DS1621+','altro','NAS da tavolo, 6 dischi'],['synology','DS1821+','altro','NAS da tavolo, 8 dischi'],['synology','DS1825+','altro','NAS da tavolo, 8 dischi'],['synology','DS1823xs+','altro','NAS da tavolo, 8 dischi'],['synology','DS2422+','altro','NAS da tavolo, 12 dischi'],['synology','DS3622xs+','altro','NAS da tavolo, 12 dischi'],['synology','DS620slim','altro','NAS da tavolo, 6 dischi 2,5″'],
  ['synology','DVA1622','altro','NVR da tavolo, 2 dischi'],['synology','DVA3221','altro','NVR da tavolo, 4 dischi'],['synology','DVA3219','altro','NVR da tavolo, 4 dischi'],['synology','NVR1218','altro','NVR da tavolo, 2 dischi'],
  ['synology','BC500','cam','bullet 5 MP'],['synology','TC500','cam','turret 5 MP'],['synology','BC800Z','cam','bullet 4K varifocale'],['synology','CC400W','cam','Wi-Fi 4 MP da interno'],
  ['synology','RT6600ax','ap','router Wi-Fi 6'],['synology','RT2600ac','ap','router Wi-Fi 5'],['synology','WRX560','ap','router Wi-Fi 6 mesh'],
  ['qnap','TS-233','altro','NAS da tavolo, 2 dischi'],['qnap','TS-264','altro','NAS da tavolo, 2 dischi'],['qnap','TS-464','altro','NAS da tavolo, 4 dischi'],['qnap','TS-664','altro','NAS da tavolo, 6 dischi'],['qnap','TS-873A','altro','NAS da tavolo, 8 dischi'],['qnap','TS-h973AX','altro','NAS da tavolo, 9 dischi'],['qnap','TVS-h874','altro','NAS da tavolo, 8 dischi'],['hikvision','DS-2CD2043G2-I','cam','bullet 4 MP'],['hikvision','DS-2CD2143G2-I','cam','dome 4 MP'],['hikvision','DS-2CD2347G2-LU','cam','turret ColorVu 4 MP'],['hikvision','DS-2CD2387G2-LU','cam','turret ColorVu 8 MP'],['hikvision','DS-2CD2T46G2-4I','cam','bullet 4 MP lunga portata'],['hikvision','DS-2CD2546G2-IS','cam','mini dome 4 MP'],['hikvision','DS-2CD2H46G2-IZS','cam','dome varifocale 4 MP'],['hikvision','DS-2DE4425IW-DE','cam','speed dome PTZ 4 MP'],['hikvision','DS-7608NI-K1','altro','NVR da tavolo, 8 canali'],['hikvision','DS-3E0105P-E','altro','switch PoE 5 porte'],['fortinet','FortiAP 231F','ap','Wi-Fi 6'],['fortinet','FortiAP 431F','ap','Wi-Fi 6'],['fortinet','FortiAP 231G','ap','Wi-Fi 6E'],['fortinet','FortiAP 431G','ap','Wi-Fi 6E'],['tplink','EAP225','ap','Wi-Fi 5'],['tplink','EAP245','ap','Wi-Fi 5'],['tplink','EAP610','ap','Wi-Fi 6'],['tplink','EAP650','ap','Wi-Fi 6'],['tplink','EAP670','ap','Wi-Fi 6'],['tplink','EAP773','ap','Wi-Fi 7'],['tplink','EAP225-Outdoor','ap','Wi-Fi 5 esterno'],['tplink','OC200','altro','controller Omada'],['tplink','ER7206','altro','router VPN da tavolo'],['netgear','WAX615','ap','Wi-Fi 6'],['netgear','WAX618','ap','Wi-Fi 6'],['netgear','WAX620','ap','Wi-Fi 6'],['netgear','WAX630','ap','Wi-Fi 6'],['zyxel','NWA210AX','ap','Wi-Fi 6'],['zyxel','NWA220AX-6E','ap','Wi-Fi 6E'],['zyxel','WAX510D','ap','Wi-Fi 6'],['zyxel','WAX610D','ap','Wi-Fi 6'],['zyxel','WAX630S','ap','Wi-Fi 6'],['zyxel','WBE660S','ap','Wi-Fi 7'],['zyxel','USG FLEX 100','altro','firewall da tavolo'],['zyxel','USG FLEX 200','altro','firewall da tavolo'],['juniper','Mist AP12','ap','Wi-Fi 6 a parete'],['juniper','Mist AP32','ap','Wi-Fi 6'],['juniper','Mist AP34','ap','Wi-Fi 6E'],['juniper','Mist AP43','ap','Wi-Fi 6'],['juniper','Mist AP45','ap','Wi-Fi 6E'],['juniper','Mist AP47','ap','Wi-Fi 7'],['extreme','AP305C','ap','Wi-Fi 6'],['extreme','AP410C','ap','Wi-Fi 6'],['extreme','AP3000','ap','Wi-Fi 6E'],['extreme','AP4000','ap','Wi-Fi 6E'],['extreme','AP5010','ap','Wi-Fi 7'],['sophos','XGS 87','altro','firewall da tavolo'],['watchguard','Firebox T45','altro','firewall da tavolo'],['fortinet','FortiGate 40F','altro','firewall da tavolo'],
  // Hikvision — modelli meno recenti
  ['hikvision','DS-2CD2020F-I','cam','bullet 2 MP'],['hikvision','DS-2CD2120F-I','cam','dome 2 MP'],['hikvision','DS-2CD2032-I','cam','bullet 3 MP'],['hikvision','DS-2CD2132F-IS','cam','dome 3 MP'],['hikvision','DS-2CD2042WD-I','cam','bullet 4 MP'],['hikvision','DS-2CD2142FWD-I','cam','dome 4 MP'],['hikvision','DS-2CD2342WD-I','cam','turret 4 MP'],['hikvision','DS-2CD2345FWD-I','cam','turret 4 MP'],['hikvision','DS-2CD2T42WD-I5','cam','bullet 4 MP lunga portata'],['hikvision','DS-2CD2522FWD-IS','cam','mini dome 2 MP'],['hikvision','DS-2CD2542FWD-IS','cam','mini dome 4 MP'],['hikvision','DS-2CD2085FWD-I','cam','bullet 8 MP'],
  ['hikvision','DS-2CD2185FWD-I','cam','dome 8 MP'],['hikvision','DS-2CD2385FWD-I','cam','turret 8 MP'],['hikvision','DS-2CD2642FWD-IZS','cam','bullet varifocale 4 MP'],['hikvision','DS-2CD2742FWD-IZS','cam','dome varifocale 4 MP'],['hikvision','DS-2CD2955FWD-IS','cam','fisheye 5 MP'],['hikvision','DS-2CD2043G0-I','cam','bullet 4 MP'],['hikvision','DS-2CD2143G0-I','cam','dome 4 MP'],['hikvision','DS-2CD2343G0-I','cam','turret 4 MP'],['hikvision','DS-2CD2T43G0-I5','cam','bullet 4 MP lunga portata'],['hikvision','DS-2CD2643G0-IZS','cam','bullet varifocale 4 MP'],['hikvision','DS-2CD2743G0-IZS','cam','dome varifocale 4 MP'],['hikvision','DS-2CD2043G1-I','cam','bullet 4 MP'],
  ['hikvision','DS-2CD2143G1-I','cam','dome 4 MP'],['hikvision','DS-2CD2047G1-L','cam','bullet ColorVu 4 MP'],['hikvision','DS-2CD2347G1-LU','cam','turret ColorVu 4 MP'],['hikvision','DS-2CD1043G0-I','cam','bullet 4 MP'],['hikvision','DS-2CD1143G0-I','cam','dome 4 MP'],['hikvision','DS-2CD1343G0-I','cam','turret 4 MP'],['hikvision','DS-2CD2420F-IW','cam','cubo Wi-Fi 2 MP'],['hikvision','DS-2DE4225IW-DE','cam','speed dome PTZ 2 MP'],['hikvision','DS-2DE4A425IW-DE','cam','speed dome PTZ 4 MP'],['hikvision','DS-2DE2A404IW-DE3','cam','mini PTZ 4 MP'],
  ['hikvision','DS-KV6113-WPE1','cam','posto esterno videocitofono'],['hikvision','DS-KV8113-WME1','cam','posto esterno videocitofono'],['hikvision','DS-KD8003-IME1','cam','posto esterno videocitofono modulare'],['hikvision','DS-KH6320-WTE1','altro','monitor videocitofono'],['hikvision','DS-7104NI-Q1/4P','altro','NVR da tavolo, 4 canali con 4 PoE'],['hikvision','DS-7108NI-Q1/8P','altro','NVR da tavolo, 8 canali con 8 PoE'],['hikvision','DS-7604NI-K1/4P','altro','NVR da tavolo, 4 canali con 4 PoE'],['hikvision','DS-7608NI-K1/8P','altro','NVR da tavolo, 8 canali con 8 PoE'],['hikvision','DS-7604NI-E1/4P','altro','NVR da tavolo, 4 canali con 4 PoE'],['hikvision','DS-3E0310P-E','altro','switch 8 porte PoE + 2 uplink'],['hikvision','DS-3E0109P-E/M','altro','switch 8 porte PoE + 1 uplink'],
  // Cisco, TP-Link, Synology, QNAP e Dell — modelli meno recenti
  ['cisco','Aironet 1602I','ap','Wi-Fi 4'],
  ['cisco','Aironet 2602I','ap','Wi-Fi 4'],
  ['cisco','Aironet 3602I','ap','Wi-Fi 4'],
  ['cisco','Aironet 1142N','ap','Wi-Fi 4'],
  ['cisco','Aironet 1702I','ap','Wi-Fi 5'],
  ['cisco','Aironet 2702I','ap','Wi-Fi 5'],
  ['cisco','Aironet 3702I','ap','Wi-Fi 5'],
  ['cisco','Aironet 1815I','ap','Wi-Fi 5'],
  ['cisco','Aironet 1815W','ap','Wi-Fi 5 a parete'],
  ['cisco','Aironet 1852I','ap','Wi-Fi 5'],
  ['cisco','Aironet 1542I','ap','Wi-Fi 5 esterno'],
  ['cisco','Aironet 1562I','ap','Wi-Fi 5 esterno'],
  ['cisco','Meraki MR18','ap','Wi-Fi 4'],
  ['cisco','Meraki MR32','ap','Wi-Fi 5'],
  ['cisco','Meraki MR33','ap','Wi-Fi 5'],
  ['cisco','Meraki MR42','ap','Wi-Fi 5'],
  ['cisco','Meraki MR52','ap','Wi-Fi 5'],
  ['cisco','Meraki MR53','ap','Wi-Fi 5'],
  ['cisco','Meraki MR74','ap','Wi-Fi 5 esterno'],
  ['cisco','Business CBW140AC','ap','Wi-Fi 5'],
  ['cisco','Business CBW145AC','ap','Wi-Fi 5 a parete'],
  ['cisco','WAP371','ap','Wi-Fi 5'],
  ['cisco','WAP581','ap','Wi-Fi 5'],
  ['cisco','WAP125','ap','Wi-Fi 5'],
  ['cisco','Meraki MV21','cam','telecamera cloud'],
  ['cisco','Meraki MV71','cam','telecamera cloud'],
  ['cisco','ISR 881','altro','router da tavolo'],
  ['cisco','ISR 891F','altro','router da tavolo'],
  ['cisco','ISR 1111-8P','altro','router da tavolo'],
  ['cisco','ASA 5505','altro','firewall da tavolo'],
  ['cisco','ASA 5506-X','altro','firewall da tavolo'],
  ['cisco','Firepower 1010','altro','firewall da tavolo'],
  ['cisco','Meraki MX64','altro','firewall da tavolo'],
  ['cisco','Meraki MX67','altro','firewall da tavolo'],
  ['cisco','Meraki MX68','altro','firewall da tavolo'],
  ['cisco','Meraki MX84','altro','firewall'],
  ['cisco','Small Business SG250-08','altro','switch 8 porte da tavolo'],
  ['cisco','Small Business SG350-10','altro','switch 8 porte + 2 SFP da tavolo'],
  ['cisco','Catalyst 2960C-8TC-L','altro','switch 8 porte da tavolo'],
  ['cisco','Catalyst 2960CX-8PC-L','altro','switch 8 porte PoE + 2 uplink'],
  ['tplink','EAP110','ap','Wi-Fi 4'],
  ['tplink','EAP115','ap','Wi-Fi 4'],
  ['tplink','EAP120','ap','Wi-Fi 4'],
  ['tplink','EAP320','ap','Wi-Fi 5'],
  ['tplink','EAP330','ap','Wi-Fi 5'],
  ['tplink','EAP115-Wall','ap','Wi-Fi 4 a parete'],
  ['tplink','EAP225-Wall','ap','Wi-Fi 5 a parete'],
  ['tplink','EAP230-Wall','ap','Wi-Fi 5 a parete'],
  ['tplink','EAP235-Wall','ap','Wi-Fi 5 a parete'],
  ['tplink','EAP110-Outdoor','ap','Wi-Fi 4 esterno'],
  ['tplink','EAP265 HD','ap','Wi-Fi 5'],
  ['tplink','EAP620 HD','ap','Wi-Fi 6'],
  ['tplink','EAP615-Wall','ap','Wi-Fi 6 a parete'],
  ['tplink','CAP1200','ap','Wi-Fi 5'],
  ['tplink','CAP300','ap','Wi-Fi 4'],
  ['tplink','CPE210','ap','ponte radio 2,4 GHz'],
  ['tplink','CPE510','ap','ponte radio 5 GHz'],
  ['tplink','CPE710','ap','ponte radio 5 GHz'],
  ['tplink','OC100','altro','controller Omada'],
  ['tplink','TL-R600VPN','altro','router VPN da tavolo'],
  ['tplink','TL-R480T+','altro','router da tavolo'],
  ['tplink','TL-ER6020','altro','router VPN da tavolo'],
  ['tplink','TL-ER6120','altro','router VPN da tavolo'],
  ['tplink','ER605','altro','router VPN da tavolo'],
  ['tplink','TL-SG108E','altro','switch 8 porte da tavolo'],
  ['tplink','TL-SG108PE','altro','switch 8 porte PoE'],
  ['tplink','TL-SG2008','altro','switch 8 porte da tavolo'],
  ['tplink','TL-SG2210P','altro','switch 8 porte PoE + 2 SFP'],
  ['tplink','T1500G-10PS','altro','switch 8 porte PoE + 2 SFP'],
  ['tplink','TL-SG1005D','altro','switch 5 porte da scrivania'],
  ['synology','DS115j','altro','NAS da tavolo, 1 disco'],
  ['synology','DS118','altro','NAS da tavolo, 1 disco'],
  ['synology','DS119j','altro','NAS da tavolo, 1 disco'],
  ['synology','DS213j','altro','NAS da tavolo, 2 dischi'],
  ['synology','DS214','altro','NAS da tavolo, 2 dischi'],
  ['synology','DS214play','altro','NAS da tavolo, 2 dischi'],
  ['synology','DS216j','altro','NAS da tavolo, 2 dischi'],
  ['synology','DS216play','altro','NAS da tavolo, 2 dischi'],
  ['synology','DS216+II','altro','NAS da tavolo, 2 dischi'],
  ['synology','DS218','altro','NAS da tavolo, 2 dischi'],
  ['synology','DS218j','altro','NAS da tavolo, 2 dischi'],
  ['synology','DS218play','altro','NAS da tavolo, 2 dischi'],
  ['synology','DS218+','altro','NAS da tavolo, 2 dischi'],
  ['synology','DS220j','altro','NAS da tavolo, 2 dischi'],
  ['synology','DS220+','altro','NAS da tavolo, 2 dischi'],
  ['synology','DS718+','altro','NAS da tavolo, 2 dischi'],
  ['synology','DS720+','altro','NAS da tavolo, 2 dischi'],
  ['synology','DS414','altro','NAS da tavolo, 4 dischi'],
  ['synology','DS415+','altro','NAS da tavolo, 4 dischi'],
  ['synology','DS416','altro','NAS da tavolo, 4 dischi'],
  ['synology','DS416play','altro','NAS da tavolo, 4 dischi'],
  ['synology','DS418','altro','NAS da tavolo, 4 dischi'],
  ['synology','DS418j','altro','NAS da tavolo, 4 dischi'],
  ['synology','DS418play','altro','NAS da tavolo, 4 dischi'],
  ['synology','DS420j','altro','NAS da tavolo, 4 dischi'],
  ['synology','DS420+','altro','NAS da tavolo, 4 dischi'],
  ['synology','DS916+','altro','NAS da tavolo, 4 dischi'],
  ['synology','DS918+','altro','NAS da tavolo, 4 dischi'],
  ['synology','DS920+','altro','NAS da tavolo, 4 dischi'],
  ['synology','DS1515+','altro','NAS da tavolo, 5 dischi'],
  ['synology','DS1517+','altro','NAS da tavolo, 5 dischi'],
  ['synology','DS1520+','altro','NAS da tavolo, 5 dischi'],
  ['synology','DS1618+','altro','NAS da tavolo, 6 dischi'],
  ['synology','DS1815+','altro','NAS da tavolo, 8 dischi'],
  ['synology','DS1817+','altro','NAS da tavolo, 8 dischi'],
  ['synology','DS2419+','altro','NAS da tavolo, 12 dischi'],
  ['synology','DS3617xs','altro','NAS da tavolo, 12 dischi'],
  ['synology','DS3018xs','altro','NAS da tavolo, 6 dischi'],
  ['synology','DS1019+','altro','NAS da tavolo, 5 dischi'],
  ['synology','DS1819+','altro','NAS da tavolo, 8 dischi'],
  ['synology','NVR216','altro','NVR da tavolo, 2 dischi'],
  ['synology','RT1900ac','ap','router Wi-Fi 5'],
  ['synology','MR2200ac','ap','router Wi-Fi 5 mesh'],
  ['qnap','TS-128A','altro','NAS da tavolo, 1 disco'],
  ['qnap','TS-131P','altro','NAS da tavolo, 1 disco'],
  ['qnap','TS-228A','altro','NAS da tavolo, 2 dischi'],
  ['qnap','TS-230','altro','NAS da tavolo, 2 dischi'],
  ['qnap','TS-231K','altro','NAS da tavolo, 2 dischi'],
  ['qnap','TS-231P','altro','NAS da tavolo, 2 dischi'],
  ['qnap','TS-231P2','altro','NAS da tavolo, 2 dischi'],
  ['qnap','TS-251+','altro','NAS da tavolo, 2 dischi'],
  ['qnap','TS-251B','altro','NAS da tavolo, 2 dischi'],
  ['qnap','TS-251D','altro','NAS da tavolo, 2 dischi'],
  ['qnap','TS-253A','altro','NAS da tavolo, 2 dischi'],
  ['qnap','TS-253B','altro','NAS da tavolo, 2 dischi'],
  ['qnap','TS-253D','altro','NAS da tavolo, 2 dischi'],
  ['qnap','TS-332X','altro','NAS da tavolo, 3 dischi'],
  ['qnap','TS-431K','altro','NAS da tavolo, 4 dischi'],
  ['qnap','TS-431P','altro','NAS da tavolo, 4 dischi'],
  ['qnap','TS-431P2','altro','NAS da tavolo, 4 dischi'],
  ['qnap','TS-431X','altro','NAS da tavolo, 4 dischi'],
  ['qnap','TS-451+','altro','NAS da tavolo, 4 dischi'],
  ['qnap','TS-451D2','altro','NAS da tavolo, 4 dischi'],
  ['qnap','TS-453A','altro','NAS da tavolo, 4 dischi'],
  ['qnap','TS-453B','altro','NAS da tavolo, 4 dischi'],
  ['qnap','TS-453Be','altro','NAS da tavolo, 4 dischi'],
  ['qnap','TS-453D','altro','NAS da tavolo, 4 dischi'],
  ['qnap','TS-473','altro','NAS da tavolo, 4 dischi'],
  ['qnap','TS-473A','altro','NAS da tavolo, 4 dischi'],
  ['qnap','TS-653A','altro','NAS da tavolo, 6 dischi'],
  ['qnap','TS-653B','altro','NAS da tavolo, 6 dischi'],
  ['qnap','TS-653D','altro','NAS da tavolo, 6 dischi'],
  ['qnap','TS-673','altro','NAS da tavolo, 6 dischi'],
  ['qnap','TS-h686','altro','NAS da tavolo, 6 dischi'],
  ['qnap','TS-853A','altro','NAS da tavolo, 8 dischi'],
  ['qnap','TS-873','altro','NAS da tavolo, 8 dischi'],
  ['qnap','TS-877','altro','NAS da tavolo, 8 dischi'],
  ['qnap','TS-h886','altro','NAS da tavolo, 8 dischi'],
  ['qnap','TS-1277','altro','NAS da tavolo, 12 dischi'],
  ['qnap','TS-1635AX','altro','NAS da tavolo, 16 dischi'],
  ['qnap','TVS-471','altro','NAS da tavolo, 4 dischi'],
  ['qnap','TVS-473','altro','NAS da tavolo, 4 dischi'],
  ['qnap','TVS-682','altro','NAS da tavolo, 6 dischi'],
  ['qnap','TVS-672XT','altro','NAS da tavolo, 6 dischi'],
  ['qnap','TVS-872XT','altro','NAS da tavolo, 8 dischi'],
  ['qnap','TVS-882','altro','NAS da tavolo, 8 dischi'],
  ['qnap','TVS-1282','altro','NAS da tavolo, 12 dischi'],
  ['qnap','TVS-h674','altro','NAS da tavolo, 6 dischi'],
  ['dell','PowerEdge T110 II','altro','server tower'],
  ['dell','PowerEdge T130','altro','server tower'],
  ['dell','PowerEdge T140','altro','server tower'],
  ['dell','PowerEdge T320','altro','server tower'],
  ['dell','PowerEdge T330','altro','server tower'],
  ['dell','PowerEdge T340','altro','server tower'],
  ['dell','PowerEdge T430','altro','server tower'],
  ['dell','PowerEdge T440','altro','server tower'],
  ['dell','PowerEdge T620','altro','server tower'],
  ['dell','PowerEdge T630','altro','server tower'],
  ['dell','PowerEdge T640','altro','server tower']
];
const mslug=s=>s.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const MODELS={};
RACK_MODELS.forEach(([v,m,k,h,rj,sfp,poe,note])=>{let id=v+'-'+mslug(m);if(MODELS[id])id+=m.includes('+')?'-plus':'-2';MODELS[id]={id,v,m,k,h,rj,sfp,poe,note,rack:true}});
FIELD_MODELS.forEach(([v,m,k,note])=>{let id='f-'+v+'-'+mslug(m);if(MODELS[id])id+=m.includes('+')?'-plus':'-2';MODELS[id]={id,v,m,k,note,rack:false}});
const mName=m=>`${VENDORS[m.v].n.split(' / ')[0]} ${m.m}`;
const mSpec=m=>!m.rack?m.note:['srv','ups'].includes(m.k)?`${m.h} U · ${m.note}`:['patch','fo'].includes(m.k)?`${m.h} U · ${m.rj} porte${m.note?' '+m.note:''}`:m.k==='cm'?`${m.h} U${m.note?' · '+m.note:''}`:m.k==='vde'?`${m.h} U · ${m.rj} prese C13${m.sfp?' + '+m.sfp+' C19':''}`:m.rack?[`${m.h} U`,m.rj?`${m.rj} RJ45`:'',m.sfp?`${m.sfp} SFP`:'',m.poe?'PoE':''].filter(Boolean).join(' · '):m.note;
function modelProps(m){switch(m.k){
  case 'patch':case 'fo':return {ports:m.rj,model:m.id};
  case 'cm':return {model:m.id};
  case 'ups':return {size:m.h,onShelf:true,model:m.id};
  case 'vde':return {c13:m.rj,c19:m.sfp,model:m.id};
  case 'unel':return {sockets:m.rj,model:m.id};
  default:return {ports:m.rj,sfp:m.sfp,poe:m.poe,size:m.h,model:m.id}}}
const ACTIVE=['sw','fw','router','srv','hub','mc'];
function mkModelItem(id,pos=1){const m=MODELS[id];const it=mkItem(m.k,pos,modelProps(m),{name:mName(m)});it.h=hOf(it);return it}


function hOf(it){const p=it.props;if(p.model&&MODELS[p.model])return MODELS[p.model].h;switch(it.kind){
  case 'patch':return +p.ports>24?2:1;
  case 'blank':return +p.size||1;
  case 'shelf':return Math.ceil(+p.real||1);
  case 'srv':case 'ups':return +p.size||2;
  default:return KINDS[it.kind].h}}
function mkItem(kind,pos=1,props={},extra={}){const it={id:uid(),kind,pos,props:{...KINDS[kind].d,...props},ports:{},name:'',...extra};it.h=hOf(it);return it}
const isPlainBlank=it=>it.kind==='blank'&&it.props.reserve==='none';
const topU=it=>it.pos+it.h-1;
const nm=it=>it.name||KINDS[it.kind].name;

/* ---------------- stato ---------------- */
let P=null;
const S={view:'rack',rack:null,item:null,port:null,plan:null,mk:null,leftR:'lib',leftP:'el',right:'props',hist:[],fut:[],uh:26,legend:true,q:'',pz:{},calib:null,placing:null,serve:'auto',labels:true,vend:'all',mqR:'',mqP:''};
function newRack(o={}){return {id:uid(),type:'FD',b:'A',x:'A',auto:true,floor:0,units:24,server:false,techRoom:true,lock:true,outdoor:false,sealed:false,numbered:true,strip:false,evolution:false,hasLocals:false,note:'',items:[],loc:null,...o}}
function normalize(p){p.plans??=[];p.devices??=[];p.slack??=6;p.cables??=true;p.racks.forEach(r=>{r.loc??=null});return p}
const R=()=>P.racks.find(r=>r.id===S.rack)||P.racks[0];
const rackById=id=>P.racks.find(r=>r.id===id);
const planById=id=>P.plans.find(p=>p.id===id);
const PL=()=>planById(S.plan)||P.plans[0]||null;

/* ---------------- archivio immagini (IndexedDB) ---------------- */
const IMG={};       // id -> objectURL
const MEM={};       // ripiego se IndexedDB non è disponibile
const DB={db:null,
  open(){return new Promise((res,rej)=>{if(this.db)return res(this.db);if(!window.indexedDB)return rej('no idb');const r=indexedDB.open('rack-designer',1);r.onupgradeneeded=()=>r.result.createObjectStore('img');r.onsuccess=()=>{this.db=r.result;res(this.db)};r.onerror=()=>rej(r.error)})},
  async tx(mode,fn){const db=await this.open();return new Promise((res,rej)=>{const t=db.transaction('img',mode);const q=fn(t.objectStore('img'));t.oncomplete=()=>res(q&&q.result);t.onerror=()=>rej(t.error)})},
  async put(k,v){MEM[k]=v;try{await this.tx('readwrite',s=>s.put(v,k))}catch(e){}},
  async get(k){if(MEM[k])return MEM[k];try{return await this.tx('readonly',s=>s.get(k))}catch(e){return null}},
  async del(k){delete MEM[k];try{await this.tx('readwrite',s=>s.delete(k))}catch(e){}},
  async keys(){try{return await this.tx('readonly',s=>s.getAllKeys())}catch(e){return Object.keys(MEM)}}
};
const loading={};
async function imgUrl(id){
  if(IMG[id])return IMG[id];
  if(loading[id])return loading[id];
  return loading[id]=(async()=>{const b=await DB.get(id);delete loading[id];if(!b)return null;IMG[id]=URL.createObjectURL(b);return IMG[id]})();
}
function imgEl(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src})}
const blobToData=b=>new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b)});
const dataToBlob=async d=>(await fetch(d)).blob();

/* ---------------- identificativi armadi, pannelli e prese ---------------- */
function scopeKey(r){return r.type==='CD'?'CD':r.type==='BD'?'BD|'+r.b:r.type+'|'+r.b+'|'+r.floor}
function assignLetters(){
  const used={};
  P.racks.forEach(r=>{if(!r.auto)(used[scopeKey(r)]??=new Set()).add(r.x)});
  P.racks.forEach(r=>{if(r.auto){const s=(used[scopeKey(r)]??=new Set());let i=0;while(s.has(LET(i)))i++;r.x=LET(i);s.add(r.x)}});
}
function rid(r,short=false){
  if(!r)return '?';
  const x=r.x,p=r.floor,b=r.b;
  switch(r.type){
    case 'CD':return `C${x}${p}`;
    case 'BD':return `B${b}${x}${p}`;
    case 'FD':return short?`F${x}${p}`:`B${b}.F${x}${p}`;
    case 'LD':return short?`L${x}${p}`:`B${b}.L${x}${p}`;
  }}
const syntax=t=>({CD:'C x p',BD:'B b x p',FD:'B b . F x p',LD:'B b . L x p'}[t]);
function panelLetters(r){const m={};[...r.items].filter(i=>KINDS[i.kind].term).sort((a,b)=>b.pos-a.pos).forEach((it,i)=>m[it.id]=LET(i));return m}
function linkFromIsThis(r,rem,flip){const base=TYPES[r.type].rank<=TYPES[rem.type].rank;return flip?!base:base}
function linkLabel(r,pd){
  const rem=rackById(pd.r);if(!rem)return '?.'+rid(r)+'.'+pd.g;
  const ft=linkFromIsThis(r,rem,pd.flip);const from=ft?r:rem,to=ft?rem:r;
  const simp=P.simplify&&from.type!=='CD'&&to.type!=='CD'&&from.b===to.b;
  return `${rid(from,simp)}.${rid(to,simp)}.${pd.g}`;
}
function portLabel(r,it,n,L){const pd=it.ports[n];if(pd&&pd.t==='link')return linkLabel(r,pd);return (L||panelLetters(r))[it.id]+n}
function wallLabel(r,it,n,L){return rid(r)+'.'+(L||panelLetters(r))[it.id]+n}
function nextG(r,remId){const used=new Set();r.items.forEach(it=>Object.values(it.ports).forEach(pd=>{if(pd.t==='link'&&pd.r===remId)used.add(+pd.g)}));let g=1;while(used.has(g))g++;return g}

/* ---------------- occupazione armadio ---------------- */
function occ(r,ex){const o=new Array(r.units+2).fill(null);r.items.forEach(it=>{if(it.id===ex)return;for(let u=it.pos;u<=topU(it);u++)o[u]=it});return o}
function fits(r,pos,h,ex){if(pos<1||pos+h-1>r.units)return false;const o=occ(r,ex);for(let u=pos;u<pos+h;u++)if(o[u])return false;return true}
function freeSlot(r,h,fromTop){if(fromTop){for(let p=r.units-h+1;p>=1;p--)if(fits(r,p,h))return p}else{for(let p=1;p<=r.units-h+1;p++)if(fits(r,p,h))return p}return null}

/* ---------------- dispositivi in campo ---------------- */
function devPort(d){const r=rackById(d.rack);if(!r)return null;const it=r.items.find(i=>i.id===d.item);if(!it||it.kind!=='patch'||!(d.port>=1&&d.port<=+it.props.ports))return null;return {r,it,n:d.port}}
function devLabel(d,L){const p=devPort(d);if(!p)return null;return wallLabel(p.r,p.it,p.n,L)}
function devAtPort(rackId,itemId,n){return P.devices.find(d=>d.rack===rackId&&d.item===itemId&&+d.port===+n)}
function freePorts(r){const out=[];[...r.items].filter(i=>i.kind==='patch').sort((a,b)=>b.pos-a.pos).forEach(it=>{for(let n=1;n<=+it.props.ports;n++){const pd=it.ports[n];if(pd&&pd.t==='link')continue;if(devAtPort(r.id,it.id,n))continue;out.push({it,n,note:pd?.note})}});return out}
function cleanRefs(){P.devices.forEach(d=>{if(d.rack&&!devPort(d)){d.rack=null;d.item=null;d.port=null}});P.racks.forEach(r=>{if(r.loc&&!planById(r.loc.plan))r.loc=null});P.devices=P.devices.filter(d=>planById(d.plan))}
function cableInfo(d){
  const p=devPort(d);if(!p)return {st:'none',txt:'non collegato'};
  const r=p.r;if(!r.loc)return {st:'unk',txt:`${rid(r)} non posizionato`};
  if(r.loc.plan!==d.plan)return {st:'unk',txt:`${rid(r)} su un'altra planimetria`};
  const pl=planById(d.plan);if(!pl.scale)return {st:'unk',txt:'scala non impostata'};
  const m=(Math.abs(r.loc.x-d.x)+Math.abs(r.loc.y-d.y))*pl.scale+(+P.slack||0);
  return {st:m>90?'err':m>80?'warn':'ok',m,txt:`≈ ${fmt(m)} m`};
}

/* ---------------- validatore armadio ---------------- */
function needsFiberReserve(r){return r.evolution||(r.type==='FD'&&!r.hasLocals)}
function validate(r){
  const I=[];const add=(lvl,ref,msg,id)=>I.push({lvl,ref,msg,id});
  const ids={};P.racks.forEach(x=>{(ids[rid(x)]??=[]).push(x)});
  if(ids[rid(r)].length>1)add('err','Identificazione armadi',`Identificativo ${rid(r)} duplicato nel progetto: ogni armadio deve avere una nomenclatura univoca.`);
  if(!/^[A-Z]$/.test(r.x))add('err','Identificazione armadi','Il progressivo armadio deve essere una lettera dell\'alfabeto inglese (A–Z).');
  if(!r.numbered&&!r.strip)add('err','Numerazione unità','Telai non numerati: numerare i montanti anteriori con striscia adesiva serigrafata.');
  if(r.techRoom&&!r.lock)add('err','Installazione','In un locale tecnico l\'armadio di terminazione deve essere dotato di serratura.');
  if(r.outdoor&&!r.sealed)add('err','Armadi da esterno','Armadio da esterno: sigillare tutti gli ingressi con tappi o schiuma poliuretanica.');
  const s=[...r.items].sort((a,b)=>b.pos-a.pos);
  if(!s.length){add('info','','Armadio vuoto: trascina gli elementi dalla libreria oppure fai clic su un elemento per inserirlo.');return I}
  const o=occ(r);
  let maxR=0,maxIt=null;
  s.forEach(it=>{const rk=CAT[KINDS[it.kind].cat].rank;if(!rk)return;
    if(rk<maxR)add('err','Disposizione',`${nm(it)} (U${it.pos}) è sotto ${nm(maxIt)} (U${maxIt.pos}): dall'alto fibra → rame → apparati attivi; l'alimentazione parte dal basso.`,it.id);
    else if(rk>maxR){maxR=rk;maxIt=it}});
  let maxS=0,maxSI=null;
  s.filter(i=>KINDS[i.kind].cat==='attivi').forEach(it=>{const sb=KINDS[it.kind].sub;
    if(sb<maxS)add('warn','Apparati attivi',`${nm(it)} è sotto ${nm(maxSI)}: si consiglia l'ordine ISO/OSI decrescente (firewall → router → switch → hub → adattatori).`,it.id);
    else if(sb>maxS){maxS=sb;maxSI=it}});
  let c=0,prevBottom=null;
  s.forEach(it=>{
    if(prevBottom!==null&&topU(it)<prevBottom-1)c=0;
    prevBottom=it.pos;
    if(it.kind==='cm'||isPlainBlank(it)){c=0;return}
    const w=Math.min(it.h,2);
    if(c+w>2){add('err','Disposizione',`Manca il passacavi metallico sopra ${nm(it)} (U${topU(it)}): va montato un passacavi ogni due unità.`,it.id);c=w}else c+=w;
  });
  s.filter(i=>i.kind==='cm').forEach(it=>{const up=o[topU(it)+1],dn=o[it.pos-1];
    if(up&&dn&&isPlainBlank(up)&&isPlainBlank(dn))add('warn','Disposizione',`Passacavi a U${it.pos} tra due pannelli ciechi: va sostituito con un pannello cieco.`,it.id);
    if(up&&up.kind==='cm')add('info','Disposizione',`Due passacavi consecutivi (U${it.pos}–U${up.pos}): uno è superfluo.`,it.id)});
  const core=s.filter(i=>!['alimentazione','accessori'].includes(KINDS[i.kind].cat)&&!isPlainBlank(i)&&i.kind!=='cm');
  if(core.length&&topU(s[0])<r.units)add('warn','Disposizione',`La composizione parte dall'alto: le U${topU(s[0])+1}–U${r.units} sono libere sopra il primo elemento.`,s[0].id);
  const pw=s.filter(i=>KINDS[i.kind].cat==='alimentazione');
  if(pw.length){const lo=pw[pw.length-1];if(lo.pos>1&&!o.slice(1,lo.pos).some(Boolean))add('warn','Alimentazione',`Le multiprese partono dalla parte inferiore: ${nm(lo)} è a U${lo.pos}, dovrebbe partire da U1.`,lo.id)}
  if(s.some(i=>KINDS[i.kind].cat==='attivi')&&!pw.some(i=>i.kind!=='poe'))add('warn','Alimentazione','Ci sono apparati attivi ma nessuna multipresa di alimentazione a rack.');
  pw.filter(i=>i.kind==='vde').forEach(it=>{if(!r.server)add('warn','Alimentazione',`${nm(it)}: negli armadi generici usare multiprese Unel bi-passo 16/32 A (la PDU VDE è prevista nelle sale server).`,it.id)});
  const fo=s.filter(i=>i.kind==='fo');
  fo.forEach(it=>{if(it.props.use==='mista')add('err','Disposizione',`${nm(it)} (U${it.pos}) mescola dorsale e distribuzione: usare cassetti ottici distinti.`,it.id)});
  for(let i=2;i<fo.length;i++){const a=fo[i-2].props.use,b=fo[i-1].props.use,cc=fo[i].props.use;if(a===cc&&b!==a){add('warn','Disposizione','Cassetti di dorsale e di distribuzione intercalati: tenerli in sezioni separate.',fo[i-1].id);break}}
  if(r.type==='LD')fo.filter(f=>f.props.dir==='partenza').forEach(it=>add('warn','Disposizione',`Armadio local: sono previsti solo cassetti ottici in arrivo (${nm(it)} è in partenza).`,it.id));
  const hasDep=fo.some(f=>f.props.dir==='partenza');
  const hasRes=s.some(i=>i.kind==='blank'&&i.props.reserve==='fibra');
  if(fo.length&&needsFiberReserve(r)&&!hasDep&&!hasRes)add('err','Disposizione',r.type==='FD'&&!r.hasLocals?'Armadio floor senza armadi local: oltre al cassetto di arrivo va lasciato lo spazio (pannello cieco di riserva fibra) per un eventuale cassetto di partenza.':'Evoluzione ottica prevista: lasciare lo spazio coperto da pannello cieco per i cassetti di rimando.');
  if((r.type==='FD'&&r.hasLocals||r.type==='CD'||r.type==='BD')&&fo.length&&!hasDep)add('warn','Disposizione',`${TYPES[r.type].it}: mancano i cassetti ottici di partenza verso gli armadi di gerarchia inferiore.`);
  if(!fo.length&&r.type!=='CD')add('info','Disposizione','Nessun cassetto ottico: verifica come arriva la dorsale a questo armadio.');
  const empty=[];const lo=s[s.length-1].pos,hi=topU(s[0]);for(let u=lo;u<=hi;u++)if(!o[u])empty.push(u);
  if(empty.length)add('info','Disposizione',`${empty.length} U libere tra il primo e l'ultimo elemento (U${empty[0]}${empty.length>1?'…U'+empty[empty.length-1]:''}): coprirle con pannelli ciechi.`);
  if(!o.slice(1,r.units+1).filter(x=>!x||x.kind==='blank').length)add('warn','Disposizione','Nessuna unità libera o cieca: lasciare spazio per le espansioni dell\'infrastruttura.');
  s.filter(i=>i.kind==='shelf').forEach(it=>{if(+it.props.real%1)add('info','Installazione',`${nm(it)} di ${fmt(it.props.real)} U occupa ${it.h} U: le posizioni residue non sono utilizzabili.`,it.id)});
  s.filter(i=>i.kind==='ups').forEach(it=>{if(!it.props.onShelf)add('err','Installazione',`${nm(it)}: le batterie devono essere installate su appositi ripiani.`,it.id)});
  const terms=s.filter(i=>KINDS[i.kind].term);
  if(terms.length>26)add('err','Etichettatura prese','Più di 26 pannelli: le lettere dell\'alfabeto inglese non bastano per identificarli.');
  const seen={};
  terms.forEach(it=>Object.entries(it.ports).forEach(([n,pd])=>{if(pd.t!=='link')return;const rem=rackById(pd.r);
    if(!rem){add('err','Collegamenti tra armadi',`Porta ${n} di ${nm(it)}: armadio remoto inesistente.`,it.id);return}
    const lab=linkLabel(r,pd);if(seen[lab])add('err','Collegamenti tra armadi',`Etichetta ${lab} usata su più prese dello stesso armadio.`,it.id);seen[lab]=1;
    if(!rem.items.some(x=>Object.values(x.ports).some(q=>q.t==='link'&&q.r===r.id&&linkLabel(rem,q)===lab)))add('warn','Collegamenti tra armadi',`Tratta ${lab}: presente solo in ${rid(r)}. Marcare la presa corrispondente in ${rid(rem)} (e riportarla nell'IRM).`,it.id)}));
  return I;
}
/* ---------------- validatore planimetria ---------------- */
function validatePlan(pl){
  const I=[];const add=(lvl,ref,msg,id)=>I.push({lvl,ref,msg,id});
  if(!pl)return I;
  if(!pl.scale)add('info','Planimetria','Scala non impostata: calibrala con due punti a distanza nota per stimare la lunghezza dei cavi.');
  const devs=P.devices.filter(d=>d.plan===pl.id);
  const used={};
  devs.forEach(d=>{const key=d.rack+'|'+d.item+'|'+d.port;if(d.rack)(used[key]??=[]).push(d)});
  devs.forEach(d=>{const id='mk:'+d.id;const lab=devLabel(d);const nmD=d.name||DEV[d.kind].short;
    if(!lab){add(d.kind==='altro'?'info':'warn','Etichettatura prese',`${nmD}: non è associato a nessuna presa del patch panel, quindi manca l'etichetta ABC.DE.`,id);return}
    if(used[d.rack+'|'+d.item+'|'+d.port].length>1)add('err','Etichettatura prese',`La presa ${lab} è assegnata a più elementi in planimetria: l'identificazione deve essere univoca.`,id);
    const ci=cableInfo(d);
    if(ci.st==='err')add('err','ISO/IEC 11801',`${lab}: cavo stimato ${ci.txt}, oltre i 90 m del canale permanente. Servire la presa da un armadio più vicino.`,id);
    else if(ci.st==='warn')add('warn','ISO/IEC 11801',`${lab}: cavo stimato ${ci.txt}, vicino al limite di 90 m.`,id);
    const r=devPort(d).r;
    if((d.kind==='ap'||d.kind==='cam')&&!r.items.some(i=>(i.kind==='sw'&&i.props.poe)||i.kind==='poe'))add('warn','Alimentazione PoE',`${lab}: ${DEV[d.kind].short.toLowerCase()} da alimentare in PoE, ma in ${rid(r)} non c'è uno switch PoE né una barra PoE.`,id);
    if(r.type!=='CD'&&(r.b!==pl.b))add('warn','Topologia',`${lab} è servita da ${rid(r)}, che si trova in un altro edificio.`,id);
  });
  P.racks.forEach(r=>{
    if(r.loc&&r.loc.plan===pl.id&&(r.type!=='CD'&&(r.b!==pl.b||+r.floor!==+pl.floor)))add('warn','Identificazione armadi',`${rid(r)} è posizionato su questa planimetria (edificio ${pl.b}, piano ${pl.floor}) ma il suo identificativo indica edificio ${r.b}, piano ${r.floor}.`,'rk:'+r.id);
    if(!r.loc&&r.type!=='CD'&&r.b===pl.b&&+r.floor===+pl.floor)add('info','Planimetria',`${rid(r)} appartiene a questo piano ma non è ancora posizionato.`);
  });
  if(!devs.length)add('info','Planimetria','Nessun elemento posizionato: trascina armadi, prese e apparati dalla colonna a sinistra.');
  return I;
}
const score=I=>Math.max(0,100-I.filter(i=>i.lvl==='err').length*15-I.filter(i=>i.lvl==='warn').length*5);

/* ---------------- auto-organizzazione ---------------- */
function autoArrange(r){
  const keep=r.items.filter(i=>i.kind!=='cm'&&!isPlainBlank(i));
  const f=c=>keep.filter(i=>KINDS[i.kind].cat===c);
  const ord={dorsale:0,distribuzione:1,mista:2};
  const fo=keep.filter(i=>i.kind==='fo').sort((a,b)=>ord[a.props.use]-ord[b.props.use]||(a.props.dir===b.props.dir?0:a.props.dir==='arrivo'?-1:1));
  let foRes=keep.filter(i=>i.kind==='blank'&&i.props.reserve==='fibra');
  const cuRes=keep.filter(i=>i.kind==='blank'&&i.props.reserve==='rame');
  const notes=[];
  if(fo.length&&needsFiberReserve(r)&&!fo.some(x=>x.props.dir==='partenza')&&!foRes.length){foRes=[mkItem('blank',1,{reserve:'fibra'})];notes.push('aggiunto un pannello cieco di riserva per il cassetto di partenza')}
  const act=f('attivi').sort((a,b)=>KINDS[a.kind].sub-KINDS[b.kind].sub);
  const pw=f('alimentazione').sort((a,b)=>(a.kind==='poe')-(b.kind==='poe'));
  const cmPool=r.items.filter(i=>i.kind==='cm'&&i.props.model);const newCm=()=>cmPool.shift()||mkItem('cm');
  const withCm=seq=>{const out=[];let c=0;seq.forEach(it=>{const w=Math.min(it.h,2);if(c+w>2){out.push(newCm());c=0}out.push(it);c+=w});if(seq.length)out.push(newCm());return out};
  const T=withCm([...fo,...foRes,...f('rame'),...cuRes,...act]);
  const B=withCm([...pw,...f('accessori')]);
  const sum=a=>a.reduce((s,i)=>s+i.h,0);
  if(sum(T)+sum(B)>r.units&&B.length&&B[B.length-1].kind==='cm')B.pop();
  if(sum(T)+sum(B)>r.units&&T.length&&T[T.length-1].kind==='cm')T.pop();
  if(sum(T)+sum(B)>r.units){toast(`Spazio insufficiente: servono ${sum(T)+sum(B)} U su ${r.units}.`);return false}
  let u=r.units;T.forEach(it=>{it.pos=u-it.h+1;u-=it.h});
  let b=1;B.forEach(it=>{it.pos=b;b+=it.h});
  const fill=[];
  if(P.fill){let p=b;while(p<=u){const h=Math.min(2,u-p+1);fill.push(mkItem('blank',p,{size:h}));p+=h}}
  r.items=[...T,...B,...fill];
  toast('Armadio riorganizzato secondo le regole di allestimento'+(notes.length?' · '+notes.join(', '):''));
}

/* ---------------- persistenza e cronologia ---------------- */
/* ---------------- archivio dei progetti nel browser ---------------- */
const PIDX='ndc-progetti',PCUR='ndc-corrente',PKEY=id=>'ndc-p:'+id;
function projIndex(){try{return JSON.parse(localStorage.getItem(PIDX))||[]}catch(_){return []}}
function projSetIndex(l){localStorage.setItem(PIDX,JSON.stringify(l))}
function projGet(id){try{return JSON.parse(localStorage.getItem(PKEY(id)))}catch(_){return null}}
function projMeta(p,upd){return {id:p.pid,name:p.name||'',upd:upd||Date.now(),racks:(p.racks||[]).length,plans:(p.plans||[]).length,devices:(p.devices||[]).length}}
function projExists(id){return !!id&&projIndex().some(x=>x.id===id)}
function freshPid(j){if(!j.pid||(projExists(j.pid)&&j.pid!==P?.pid))j.pid=uid();return j}
function save(){try{P.pid??=uid();localStorage.setItem(PKEY(P.pid),JSON.stringify(P));const l=projIndex().filter(x=>x.id!==P.pid);l.unshift(projMeta(P));projSetIndex(l);localStorage.setItem(PCUR,P.pid)}catch(e){toast('Salvataggio nel browser non riuscito (spazio esaurito?)')}}
function openProject(id){const j=projGet(id);if(!j)return false;j.pid=id;P=normalize(j);S.rack=P.racks[0]?.id;S.plan=P.plans[0]?.id||null;S.item=null;S.port=null;S.mk=null;S.pz={};S.hist=[];S.fut=[];S.calib=null;S.placing=null;try{localStorage.setItem(PCUR,id)}catch(_){}render();return true}
function newProject(){blankProject();P.pid=uid();save();render()}
/* immagini e foto usate da altri progetti salvati (o dalle versioni): non si cancellano */
function imgRefs(p){const s=new Set();(p.plans||[]).forEach(x=>s.add(x.id));const ph=o=>(o.photos||[]).forEach(x=>s.add(x));(p.racks||[]).forEach(r=>{ph(r);(r.items||[]).forEach(ph)});(p.devices||[]).forEach(ph);return s}
function usedElsewhere(k){k=String(k);if(k.startsWith('ver:'))return true;return projIndex().some(x=>x.id!==P?.pid&&imgRefs(projGet(x.id)||{}).has(k))}
{const _d=DB.del.bind(DB);DB.del=async k=>{if(usedElsewhere(k))return;return _d(k)};DB.purge=_d}
function mutate(fn){
  const snap=JSON.stringify(P);
  const res=fn();
  if(res===false){P=JSON.parse(snap);render();return false}
  S.hist.push(snap);if(S.hist.length>150)S.hist.shift();S.fut=[];
  save();render();return res;
}
function undo(){if(!S.hist.length)return;S.fut.push(JSON.stringify(P));P=JSON.parse(S.hist.pop());fixSel();save();render()}
function redo(){if(!S.fut.length)return;S.hist.push(JSON.stringify(P));P=JSON.parse(S.fut.pop());fixSel();save();render()}
function fixSel(){if(!rackById(S.rack))S.rack=P.racks[0]?.id;const r=R();if(!r||!r.items.some(i=>i.id===S.item)){S.item=null;S.port=null}if(S.plan&&!planById(S.plan))S.plan=P.plans[0]?.id||null;if(S.mk&&!mkObj(S.mk))S.mk=null}
function mkObj(k){if(!k)return null;const[t,id]=k.split(':');return t==='rk'?rackById(id):P.devices.find(d=>d.id===id)}

/* ---------------- progetto vuoto ---------------- */
function blankProject(){P={name:'Nuovo progetto',simplify:true,fill:true,slack:6,cables:true,racks:[newRack({units:24})],plans:[],devices:[]};S.rack=P.racks[0].id;S.item=null;S.plan=null;S.mk=null;S.hist=[];S.fut=[];S.pz={}}

/* ---------------- faccia degli elementi a rack ---------------- */
function portsHtml(n,{rows=1,cls='p',group=6,marks,style=''}={}){
  const per=Math.ceil(n/rows);let h='<div class="ports">';
  for(let r=0;r<rows;r++){h+='<div class="rw">';for(let g=0;g<per;g+=group){h+='<div class="g">';for(let k=g;k<Math.min(g+group,per);k++){const idx=r*per+k+1;if(idx>n)break;h+=`<i class="${cls} ${marks?marks(idx):''}" ${style}></i>`}h+='</div>'}h+='</div>'}
  return h+'</div>';
}
function faceHtml(it,letter){
  const p=it.props;let fc='',extra='';
  const md=p.model&&MODELS[p.model];
  if(md&&ACTIVE.includes(it.kind)){const V=VENDORS[md.v];
    if(it.kind==='srv')fc=`<span class="brand-t" ${V.bc?`style="color:${V.bc}"`:''}>${esc(V.logo)}</span><div class="bays">${'<i></i>'.repeat(md.h>1?12:6)}</div><i class="led"></i>`;
    else{const many=md.sfp>8;fc=`<span class="brand-t" ${V.bc?`style="color:${V.bc}"`:''}>${esc(V.logo)}</span><span style="flex:1"></span>${md.rj?portsHtml(md.rj,{rows:md.rj>28?2:1}):''}${md.sfp?(many?portsHtml(md.sfp,{rows:2,cls:'p sf',group:4}):`<span style="display:flex;gap:2px">${'<i class="sfp"></i>'.repeat(md.sfp)}</span>`):''}${md.poe?'<span class="cap">PoE</span>':''}<i class="led"></i>`}
    return {cls:'k-'+it.kind+' vf v-'+md.v,html:`<i class="ear"></i><div class="fc">${fc}</div><i class="ear"></i>${letter?`<span class="tag">${letter}</span>`:''}`}}
  const mark=i=>{const d=it.ports[i];return d?d.t==='link'?'lk':d.note?'nt':'':''};
  switch(it.kind){
    case 'fo':{const col=p.fiber==='OS2'?'#f2c200':p.fiber==='OM4'?'#b23bb6':'#19b5c9';
      fc=`<span class="cap" style="color:#cfd3d8">${esc(p.conn)}</span>${portsHtml(+p.ports,{cls:'p lc',marks:mark,style:`style="background:${col}"`})}<span style="flex:1"></span><span class="cap" style="color:#9aa1a9">${p.dir==='arrivo'?'▼':'▲'} ${p.use==='dorsale'?'DOR':p.use==='mista'?'MIX':'DIS'}</span>`;break}
    case 'patch':fc=portsHtml(+p.ports,{rows:+p.ports>24?2:1,marks:mark});break;
    case 'cm':fc='<i class="ring2"></i>'.repeat(5);break;
    case 'blank':fc=p.reserve==='fibra'?'riserva fibra':p.reserve==='rame'?'riserva rame':'';extra=p.reserve!=='none'?' res':'';break;
    case 'sw':fc=`<i class="brand"></i><span style="flex:1"></span>${portsHtml(+p.ports,{rows:+p.ports>24?2:1})}<span style="display:flex;gap:2px">${'<i class="sfp"></i>'.repeat(+p.sfp||0)}</span>${p.poe?'<span class="cap">PoE</span>':''}`;break;
    case 'fw':fc=`<i class="brand"></i><i class="lcd"></i><span style="flex:1"></span>${portsHtml(+p.ports)}<i class="sfp"></i><i class="led"></i>`;break;
    case 'router':fc=`<i class="brand"></i><span class="cap">ROUTER</span><span style="flex:1"></span>${portsHtml(+p.ports)}<i class="sfp"></i><i class="led"></i>`;break;
    case 'hub':fc=`<span class="cap">HUB</span><span style="flex:1"></span>${portsHtml(+p.ports)}<i class="led"></i>`;break;
    case 'mc':fc=`<span class="cap">MEDIA CONV.</span><span style="flex:1"></span>${portsHtml(+p.ports,{group:1})}<i class="sfp"></i>`;break;
    case 'srv':fc=`<div class="bays">${'<i></i>'.repeat(12)}</div><i class="led"></i>`;break;
    case 'shelf':fc=`ripiano ${fmt(p.real)} U`;break;
    case 'ups':fc=`<i class="lcd"></i><span>${md?esc(VENDORS[md.v].logo)+' UPS':'UPS'+(p.onShelf?' · su ripiano':'')}</span><span style="flex:1"></span><i class="led"></i>`;break;
    case 'unel':fc=`<i class="swt"></i>${'<i class="sk"></i>'.repeat(+p.sockets)}`;break;
    case 'vde':fc=`<i class="swt"></i>${'<i class="c13"></i>'.repeat(+p.c13)}${'<i class="c19"></i>'.repeat(+p.c19)}`;break;
    case 'poe':fc=`<span>PoE</span>${portsHtml(+p.ports,{group:2})}<i class="led"></i>`;break;
  }
  return {cls:'k-'+it.kind+extra,html:`<i class="ear"></i><div class="fc">${fc}</div><i class="ear"></i>${letter?`<span class="tag">${letter}</span>`:''}`};
}

/* ---------------- rendering generale ---------------- */
function render(){
  if(!P.racks.length)P.racks.push(newRack());
  if(!rackById(S.rack))S.rack=P.racks[0].id;
  if(!planById(S.plan))S.plan=P.plans[0]?.id||null;
  assignLetters();cleanRefs();
  const r=R();
  r._issues=validate(r);
  $('#projName').value=P.name;
  $('#undoBtn').disabled=!S.hist.length;$('#redoBtn').disabled=!S.fut.length;
  $$('[data-view]').forEach(b=>b.classList.toggle('on',b.dataset.view===S.view));
  $('#autoBtn').hidden=S.view!=='rack';$('#uploadBtn').hidden=S.view!=='plan';
  $('#stage').hidden=S.view!=='rack';$('#pv').hidden=S.view!=='plan';
  renderLeft();
  if(S.view==='rack')renderRack(r);else renderPlan();
  renderFloat();renderRight();renderFoot();
}
function curIssues(){return S.view==='rack'?R()._issues:validatePlan(PL())}

/* ---------------- colonna sinistra ---------------- */
function renderLeft(){
  const tabs=S.view==='rack'?[['lib','Libreria'],['mod','Modelli'],['racks',`Armadi <span class="badge">${P.racks.length}</span>`]]:[['el','Elementi'],['mod','Modelli'],['plans',`Planimetrie <span class="badge">${P.plans.length}</span>`]];
  const cur=S.view==='rack'?S.leftR:S.leftP;
  $('#leftTabs').innerHTML=tabs.map(([k,l])=>`<button class="scheda ${k===cur?'on':''}" data-lt="${k}">${l}</button>`).join('')+`<span class="sp"></span><button class="btn icona trasp solo-sm" data-act="closeLib" aria-label="Chiudi">✕</button>`;
  const el=$('#leftBody');
  if(cur==='lib')el.innerHTML=libHtml();
  else if(cur==='racks')el.innerHTML=racksHtml();
  else if(cur==='mod')el.innerHTML=modelsHtml(S.view==='rack');
  else if(cur==='el')el.innerHTML=planPaletteHtml();
  else el.innerHTML=plansHtml();
  if(S._qfocus){const qi=$('#'+S._qfocus);if(qi){qi.focus();qi.setSelectionRange(qi.value.length,qi.value.length)}}
}
function libHtml(){
  const q=S.q.toLowerCase();
  let h=`<div class="cerca"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><input id="q" placeholder="Cerca elementi…" value="${esc(S.q)}"></div>`;
  Object.entries(CAT).forEach(([c,cd])=>{
    const ks=Object.entries(KINDS).filter(([,K])=>K.cat===c&&(!q||K.name.toLowerCase().includes(q)));
    if(!ks.length)return;
    h+=`<div class="gruppo-t"><span>${cd.label}</span><span>${cd.note}</span></div>`;
    ks.forEach(([k,K])=>{const it=mkItem(k);const f=faceHtml(it);
      h+=`<div class="card" data-kind="${k}" title="Trascina nell'armadio o fai clic per inserire"><div class="row"><b>${K.name}</b><span class="u">${it.h} U</span></div><div class="mini"><div class="it ${f.cls}">${f.html}</div></div></div>`});
  });
  return h;
}
const KLBL={fw:'Firewall e gateway',router:'Router e OLT',sw:'Switch',srv:'Server, NAS, NVR e storage',ups:'UPS e batterie',vde:'PDU',fo:'Cassetti ottici',patch:'Patch panel',cm:'Passacavi',ap:'Access point',cam:'Telecamere',altro:'Altri apparati'};
function modelsHtml(rack){
  const mq=rack?S.mqR:S.mqP;const q=mq.toLowerCase();
  const list=Object.values(MODELS).filter(m=>m.rack===rack&&(S.vend==='all'||m.v===S.vend)&&(!q||(m.m+' '+VENDORS[m.v].n+' '+(m.note||'')).toLowerCase().includes(q)));
  let h=`<div class="cerca"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><input id="mq" placeholder="Cerca modello…" value="${esc(mq)}"></div>
  <div class="chips">${[['all','Tutte'],...Object.entries(VENDORS).map(([k,v])=>[k,v.n])].map(([k,n])=>`<button class="chip ${S.vend===k?'on':''}" data-vend="${k}">${esc(n)}</button>`).join('')}</div>`;
  if(!rack&&!PL())h+='<p class="nota-sx">Carica una planimetria per posizionare i modelli.</p>';
  if(!list.length)return h+'<div class="vuoto">Nessun modello trovato.</div>';
  Object.keys(VENDORS).forEach(v=>{const lv=list.filter(m=>m.v===v);if(!lv.length)return;
    h+=`<div class="gruppo-t"><span>${esc(VENDORS[v].n)}</span><span>${lv.length} modelli</span></div>`;
    Object.keys(KLBL).forEach(k=>{const lk=lv.filter(m=>m.k===k);if(!lk.length)return;
      h+=`<div class="sotto-t">${KLBL[k]}</div>`;
      lk.forEach(m=>h+=`<div class="card riga mod" data-${rack?'rmodel':'fmodel'}="${m.id}" title="${esc(mName(m))}"><div class="ic" style="background:${VENDORS[m.v].c};width:30px;height:30px">${rack?`<span style="font-size:10px">${m.h}U</span>`:svgI(m.k,'width="16" height="16" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"')}</div><div class="tx"><b>${esc(m.m)}</b><small>${esc(mSpec(m))}</small></div></div>`)})});
  return h;
}
function racksHtml(){
  const groups={};P.racks.forEach(r=>{const k=r.type==='CD'?'Campus':'Edificio '+r.b;(groups[k]??=[]).push(r)});
  let h='<div class="rlist">';
  Object.keys(groups).sort().forEach(g=>{h+=`<div class="bld">${g}</div>`;
    groups[g].sort((a,b)=>TYPES[a.type].rank-TYPES[b.type].rank||a.floor-b.floor||a.x.localeCompare(b.x)).forEach(r=>{
      const I=validate(r);const e=I.filter(i=>i.lvl==='err').length,w=I.filter(i=>i.lvl==='warn').length;
      h+=`<div class="ritem ${r.id===S.rack?'on':''}" data-rack="${r.id}"><div class="ic ${r.type}">${r.type}</div><div class="grow"><div class="nm">${rid(r)}</div><div class="sub">${TYPES[r.type].it} · piano ${r.floor} · ${r.units} U</div></div>${e?`<span class="badge err">${e}</span>`:w?`<span class="badge warn">${w}</span>`:'<span class="badge ok">✓</span>'}</div>`})});
  return h+`</div><div style="padding:0 16px 16px"><button class="btn" style="width:100%;justify-content:center" data-act="addRack">+ Nuovo armadio</button></div>`;
}
function plansHtml(){
  let h='<div class="rlist">';
  if(!P.plans.length)h+='<div class="vuoto">Nessuna planimetria caricata.</div>';
  [...P.plans].sort((a,b)=>a.b.localeCompare(b.b)||a.floor-b.floor).forEach(pl=>{
    const I=validatePlan(pl);const e=I.filter(i=>i.lvl==='err').length,w=I.filter(i=>i.lvl==='warn').length;const n=P.devices.filter(d=>d.plan===pl.id).length;
    h+=`<div class="ritem ${pl.id===S.plan?'on':''}" data-plan="${pl.id}"><div class="ic plan">${IMG[pl.id]?`<img src="${IMG[pl.id]}" alt="">`:'▦'}</div><div class="grow"><div class="nm" style="font-family:inherit">${esc(pl.name)}</div><div class="sub">Edificio ${pl.b} · piano ${pl.floor} · ${n} elementi</div></div>${e?`<span class="badge err">${e}</span>`:w?`<span class="badge warn">${w}</span>`:'<span class="badge ok">✓</span>'}</div>`});
  return h+`</div><div style="padding:0 16px 16px"><button class="btn primario" style="width:100%;justify-content:center" data-act="upload">Carica planimetria</button><p class="piccola">Immagini PNG, JPG, WebP, SVG o PDF. Restano solo nel tuo browser.</p></div>`;
}
function planPaletteHtml(){
  const pl=PL();
  if(!pl)return `<div class="vuoto">Carica prima una planimetria per posizionare armadi e apparati.<br><br><button class="btn primario" data-act="upload">Carica planimetria</button></div>`;
  let h=`<div class="gruppo-t"><span>Apparati in campo</span><span>trascina sulla pianta</span></div><p class="nota-sx">Access point, telecamere e altri apparati di Ubiquiti, MikroTik, Aruba, Cisco, Ruckus e ZTE sono nella scheda <a href="#" data-act="goModels">Modelli</a>.</p>`;
  Object.entries(DEV).forEach(([k,D])=>h+=`<div class="card riga" data-dev="${k}"><div class="ic" style="background:${D.col};width:32px;height:32px">${svgI(k,'width="17" height="17" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"')}</div><div class="tx"><b>${D.name}</b><small>${D.desc}</small></div></div>`);
  const opts=P.racks.filter(r=>r.items.some(i=>i.kind==='patch'));
  h+=`<div class="sez" style="border-bottom:0;padding:8px 14px 4px"><div class="f" style="grid-template-columns:1fr;gap:4px"><label>Armadio che serve le nuove prese</label><select data-serve>${[['auto','Automatico: il più vicino sulla pianta'],...opts.map(r=>[r.id,rid(r)+' · '+TYPES[r.type].it])].map(([v,l])=>`<option value="${v}" ${S.serve===v?'selected':''}>${esc(l)}</option>`).join('')}</select></div></div>`;
  const racks=[...P.racks].sort((a,b)=>((b.b===pl.b&&+b.floor===+pl.floor)-(a.b===pl.b&&+a.floor===+pl.floor))||TYPES[a.type].rank-TYPES[b.type].rank);
  h+=`<div class="gruppo-t"><span>Armadi</span><span>edificio ${pl.b} · piano ${pl.floor} in alto</span></div>`;
  racks.forEach(r=>{const here=r.loc&&r.loc.plan===pl.id;const other=r.loc&&!here?planById(r.loc.plan):null;
    h+=`<div class="card riga ${here?'fatto':''}" data-prack="${r.id}" title="${here?'Già posizionato: fai clic per selezionarlo':'Trascina sulla pianta'}"><div class="ic ${r.type}" style="width:32px;height:32px;font-size:11px">${r.type}</div><div class="tx"><b class="mono">${rid(r)}</b><small>${here?'✓ posizionato':other?'su '+esc(other.name):'da posizionare'} · piano ${r.floor}</small></div></div>`});
  const todo=[];P.racks.filter(r=>r.b===pl.b&&+r.floor===+pl.floor).forEach(r=>{const L=panelLetters(r);r.items.filter(i=>i.kind==='patch').forEach(it=>{Object.entries(it.ports).forEach(([n,pd])=>{if(pd.t==='user'&&pd.note&&!devAtPort(r.id,it.id,n))todo.push({r,it,n:+n,note:pd.note,lab:wallLabel(r,it,n,L)})})})});
  if(todo.length){h+=`<div class="gruppo-t"><span>Prese da posizionare</span><span>${todo.length}</span></div><p class="nota-sx">Prese con locale assegnato nell'armadio ma non ancora in pianta.</p>`;
    todo.slice(0,150).forEach(t=>h+=`<div class="card riga" data-tport="${t.r.id}|${t.it.id}|${t.n}"><div class="ic" style="background:${DEV.to.col};width:32px;height:32px">${svgI('to','width="17" height="17" fill="none" stroke="#fff" stroke-width="2.2"')}</div><div class="tx"><b class="mono">${esc(t.lab)}</b><small>${esc(t.note)}</small></div></div>`)}
  return h;
}

/* ---------------- vista armadio ---------------- */
function renderRack(r){
  document.documentElement.style.setProperty('--uh',S.uh+'px');
  const L=panelLetters(r);const bad={};r._issues.forEach(i=>{if(i.id)bad[i.id]=bad[i.id]==='err'||i.lvl==='err'?'err':i.lvl==='warn'?'warn':bad[i.id]});
  let rails='';for(let u=1;u<=r.units;u++)rails+=`<div>${u}</div>`;
  let items='',leg='';
  r.items.forEach(it=>{const f=faceHtml(it,L[it.id]);
    const ttl=`${nm(it)} — U${it.pos}${it.h>1?'–U'+topU(it):''}${L[it.id]?' · pannello '+L[it.id]:''}`;
    items+=`<div class="it ${f.cls} ${S.item===it.id?'sel':''} ${bad[it.id]==='err'?'bad':bad[it.id]==='warn'?'wrn':''}" data-id="${it.id}" title="${esc(ttl)}" style="bottom:${(it.pos-1)*S.uh}px;height:${it.h*S.uh}px">${f.html}</div>`;
    if(S.legend&&!(isPlainBlank(it)&&!P.showBlank))leg+=`<div style="bottom:${(it.pos-1)*S.uh}px;height:${it.h*S.uh}px" class="${bad[it.id]==='err'?'bad':''}">${L[it.id]?`<em>${L[it.id]}</em>`:''}${esc(nm(it))}${it.kind==='fo'?` <em>${it.props.use} · ${it.props.dir}</em>`:''}</div>`});
  const ul=S.legend?`<div class="ulegend"><div style="bottom:0;height:${S.uh}px">unità 1</div><div style="bottom:${(r.units-1)*S.uh}px;height:${S.uh}px">unità ${r.units}</div></div>`:'';
  const pl=r.loc?planById(r.loc.plan):null;
  $('#stage').innerHTML=`<div class="rack"><div class="door"><span class="plate" title="Identificativo da riportare sulla porta frontale">${rid(r)}</span><span class="meta">${TYPES[r.type].n} · ${r.units} U${r.outdoor?' · esterno':''}${r.server?' · sala server':''}${pl?' · 📍 '+esc(pl.name):''}</span></div>
  <div class="cab"><div class="cab-in"><div class="rail l ${r.numbered||r.strip?'':'nonum'}">${rails}</div><div class="bay" id="bay" style="height:${r.units*S.uh}px">${items}${ul}<div class="legend">${leg}</div></div><div class="rail r ${r.numbered||r.strip?'':'nonum'}">${rails}</div></div></div></div>`;
}

/* ---------------- vista planimetria ---------------- */
function pz(pl){
  if(!S.pz[pl.id]){const vp=$('#main').getBoundingClientRect();const k=Math.min((vp.width-60)/pl.w,(vp.height-90)/pl.h)||0.5;S.pz[pl.id]={k,x:(vp.width-pl.w*k)/2,y:Math.max(20,(vp.height-pl.h*k)/2-20)}}
  return S.pz[pl.id];
}
function renderPlan(){
  const pv=$('#pv');const pl=PL();
  pv.classList.toggle('calib',!!S.calib||!!S.placing);
  if(!pl){pv.innerHTML=`<div class="plan-vuota"><div class="drop" id="drop">${svgI('to').replace('<svg','<svg aria-hidden="true"').replace(ICO.to,'<path d="M3 4h18v16H3z"/><path d="M3 11h8V4M11 15v5M15 4v7h6"/>')}<h2>Carica la planimetria</h2><p>Trascina qui un'immagine (PNG, JPG, WebP, SVG) o un PDF della pianta del piano, oppure sceglilo dal computer. Poi posiziona armadi, prese di rete, access point e telecamere.</p><button class="btn primario" data-act="upload">Scegli file</button><p class="piccola">Le planimetrie restano nel tuo browser: niente viene inviato a server.</p></div></div>`;return}
  const url=IMG[pl.id];
  if(!url){imgUrl(pl.id).then(u=>{if(u)render();else{pv.innerHTML=`<div class="plan-vuota"><div class="drop"><h2>Immagine non disponibile</h2><p>La planimetria «${esc(pl.name)}» non è presente in questo browser (ad esempio perché il progetto arriva da un link condiviso). Ricarica il file: armadi e apparati restano al loro posto.</p><button class="btn primario" data-act="replaceImg">Ricarica immagine</button></div></div>`}});
    if(!pv.querySelector('.planw'))pv.innerHTML='<div class="plan-vuota"><div class="vuoto">Caricamento planimetria…</div></div>';return}
  const z=pz(pl);
  const I=validatePlan(pl);const bad={};I.forEach(i=>{if(i.id&&(i.lvl==='err'||i.lvl==='warn'))bad[i.id]=1});
  let cav='',mk='';
  const devs=P.devices.filter(d=>d.plan===pl.id);
  if(P.cables)devs.forEach(d=>{if(d.route&&d.route.length)return;const p=devPort(d);if(!p||!p.r.loc||p.r.loc.plan!==pl.id)return;const ci=cableInfo(d);const col=ci.st==='err'?'#dc3545':ci.st==='warn'?'#e8a200':TCOL[p.r.type];
    const sel=S.mk==='mk:'+d.id||S.mk==='rk:'+p.r.id;
    cav+=`<path d="M${p.r.loc.x} ${p.r.loc.y} H${d.x} V${d.y}" fill="none" stroke="${col}" stroke-width="${sel?3.5:2}" stroke-dasharray="${sel?'':'7 5'}" vector-effect="non-scaling-stroke" opacity="${sel?1:.75}"/>`});
  P.racks.filter(r=>r.loc&&r.loc.plan===pl.id).forEach(r=>{const k='rk:'+r.id;
    mk+=`<div class="mk mk-rack ${S.mk===k?'sel':''} ${bad[k]?'bad':''} ${S.labels?'':'nolbl'}" data-mk="${k}" style="left:${r.loc.x}px;top:${r.loc.y}px" title="${esc(rid(r)+' · '+TYPES[r.type].it)}"><div class="sym" style="background:${TCOL[r.type]}">${svgI('rack')}${esc(rid(r,true))}</div><div class="ml">${esc(rid(r))}<small>${TYPES[r.type].it}</small></div></div>`});
  devs.forEach(d=>{const k='mk:'+d.id;const lab=devLabel(d);
    mk+=`<div class="mk mk-${d.kind} ${lab?'':'libero'} ${S.mk===k?'sel':''} ${bad[k]?'bad':''} ${S.labels?'':'nolbl'}" data-mk="${k}" style="left:${d.x}px;top:${d.y}px" title="${esc((d.model&&MODELS[d.model]?mName(MODELS[d.model])+' · ':'')+(d.name||DEV[d.kind].short)+(lab?' · '+lab:' · non collegato'))}"><div class="sym">${svgI(d.kind)}</div><div class="ml">${esc(lab||'—')}${d.name||d.model?`<small>${esc(d.name||MODELS[d.model]?.m||'')}</small>`:''}</div></div>`});
  if(S.calib)S.calib.pts.forEach(p=>mk+=`<i class="calib-pt" style="left:${p.x}px;top:${p.y}px"></i>`);
  const hint=S.calib?`<div class="suggerimento">Scala: clicca ${S.calib.pts.length?'il secondo punto':'il primo di due punti a distanza nota'} · Esc per annullare</div>`:S.placing?`<div class="suggerimento">Clicca sulla pianta per posizionare la presa ${esc(S.placing.lab)} · Esc per annullare</div>`:'';
  pv.innerHTML=`${hint}<div class="planw" id="pw" style="width:${pl.w}px;height:${pl.h}px"><img src="${url}" alt="${esc(pl.name)}" style="opacity:${pl.opacity??1}"><svg class="cavi" viewBox="0 0 ${pl.w} ${pl.h}">${cav}</svg>${mk}</div>`;
  applyPz();
}
function applyPz(){const pl=PL();const pw=$('#pw');if(!pl||!pw)return;const z=pz(pl);pw.style.transform=`translate(${z.x}px,${z.y}px) scale(${z.k})`;pw.style.setProperty('--ik',(1/z.k).toFixed(4));const zl=$('#zoomPct');if(zl)zl.textContent=Math.round(z.k*100)+'%';updScale()}
function updScale(){const el=$('#scaleBar');const pl=PL();if(!el||!pl)return;if(!pl.scale){el.innerHTML='scala non impostata';return}
  const k=pz(pl).k;const mPerScreenPx=pl.scale/k;const target=110*mPerScreenPx;const steps=[1,2,5,10,20,25,50,100,200,500];const m=steps.find(s=>s>=target*0.6)||500;el.innerHTML=`${m} m<i style="width:${Math.round(m/mPerScreenPx)}px"></i>`}
function zoomAt(f,cx,cy){const pl=PL();if(!pl)return;const z=pz(pl);const vp=$('#pv').getBoundingClientRect();if(cx==null){cx=vp.width/2;cy=vp.height/2}const nk=clamp(z.k*f,0.03,8);z.x=cx-(cx-z.x)*nk/z.k;z.y=cy-(cy-z.y)*nk/z.k;z.k=nk;applyPz()}
function fitPlan(){const pl=PL();if(!pl)return;delete S.pz[pl.id];pz(pl);applyPz()}
function toImg(cx,cy){const pl=PL();const z=pz(pl);const vp=$('#pv').getBoundingClientRect();return {x:(cx-vp.left-z.x)/z.k,y:(cy-vp.top-z.y)/z.k}}
function centerOn(x,y){const pl=PL();const z=pz(pl);const vp=$('#pv').getBoundingClientRect();z.x=vp.width/2-x*z.k;z.y=vp.height/2-y*z.k;applyPz()}
function nearestRack(pl,x,y){let best=null,bd=1e18;P.racks.forEach(r=>{if(!r.loc||r.loc.plan!==pl.id||!r.items.some(i=>i.kind==='patch'))return;const d=Math.abs(r.loc.x-x)+Math.abs(r.loc.y-y);if(d<bd){bd=d;best=r}});
  return best||P.racks.find(r=>r.b===pl.b&&+r.floor===+pl.floor&&r.items.some(i=>i.kind==='patch'))||null}
function addDevice(kind,x,y,port,model){
  const pl=PL();const d={id:uid(),kind,plan:pl.id,x:Math.round(x),y:Math.round(y),name:'',rack:null,item:null,port:null,model:model||null};
  if(port){Object.assign(d,port);const r=rackById(port.rack);const it=r.items.find(i=>i.id===port.item);d.name=it.ports[port.port]?.note||''}
  else{const r=S.serve!=='auto'?rackById(S.serve):nearestRack(pl,x,y);if(r){const f=freePorts(r)[0];if(f){d.rack=r.id;d.item=f.it.id;d.port=f.n;d.name=f.note||''}else toast(`Nessuna presa libera nei patch panel di ${rid(r)}`)}}
  mutate(()=>{P.devices.push(d);S.mk='mk:'+d.id;S.right='props'});
}

/* ---------------- barra flottante ---------------- */
function renderFloat(){
  const fb=$('#floatBar');
  if(S.view==='rack'){fb.innerHTML=`<button class="btn solo-sm" data-act="openLib">Libreria</button><div class="zoom"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><input type="range" id="zoom" min="16" max="40" step="1" value="${S.uh}" aria-label="Zoom"><span class="mono" style="width:38px;text-align:right">${S.uh}px</span></div><span class="sp"></span><button class="btn piccolo ${S.legend?'on':''}" data-act="legend">Etichette</button>`;return}
  const pl=PL();
  if(!pl){fb.innerHTML=`<button class="btn solo-sm" data-act="openLib">Elementi</button>`;return}
  fb.innerHTML=`<button class="btn solo-sm" data-act="openLib">Elementi</button><div class="zoom" style="padding:0 4px"><button class="btn icona trasp" data-act="zout" aria-label="Riduci">−</button><span id="zoomPct" class="mono" style="min-width:44px;text-align:center">100%</span><button class="btn icona trasp" data-act="zin" aria-label="Ingrandisci">+</button><button class="btn piccolo trasp" data-act="fit">Adatta</button></div><div class="scala" id="scaleBar"></div><span class="sp"></span>
  <button class="btn piccolo ${S.calib?'on':''}" data-act="calib">Calibra scala</button><button class="btn piccolo ${P.cables?'on':''}" data-act="cables">Cavi</button><button class="btn piccolo ${S.labels?'on':''}" data-act="labels">Etichette</button><button class="btn piccolo" data-act="png">PNG</button>`;
  applyPz();
}

/* ---------------- colonna destra ---------------- */
const sel=(name,val,opts,attr='data-f')=>`<select ${attr}="${name}">${opts.map(o=>{const [v,l]=Array.isArray(o)?o:[o,o];return `<option value="${esc(v)}" ${String(v)===String(val)?'selected':''}>${esc(l)}</option>`}).join('')}</select>`;
const chk=(name,val,label,hint='')=>`<label class="chk"><input type="checkbox" data-f="${name}" ${val?'checked':''}><span>${label}${hint?`<small>${hint}</small>`:''}</span></label>`;
function renderRight(){
  $$('[data-rt]').forEach(b=>b.classList.toggle('on',b.dataset.rt===S.right));
  const I=curIssues();const e=I.filter(i=>i.lvl==='err').length,w=I.filter(i=>i.lvl==='warn').length;
  const ib=$('#issCount');ib.textContent=e+w;ib.className='badge '+(e?'err':w?'warn':'ok');
  const el=$('#rightBody');
  if(S.right==='check'){el.innerHTML=checkHtml(I);return}
  if(S.view==='rack'){const r=R();const it=r.items.find(i=>i.id===S.item);el.innerHTML=it?itemHtml(r,it):rackHtml(r);return}
  const pl=PL();
  if(!pl){el.innerHTML=`<div class="sez"><h3>Planimetria</h3><p>Carica la pianta di un piano per posizionare gli armadi e gli apparati in campo. Ogni presa posizionata riceve l'etichetta <span class="lbl">ABC.DE</span> della presa del patch panel a cui è collegata.</p><button class="btn primario" data-act="upload">Carica planimetria</button></div>`;return}
  const o=mkObj(S.mk);
  el.innerHTML=!o?planHtml(pl):S.mk.startsWith('rk:')?rackMkHtml(o,pl):devHtml(o,pl);
}
function rackHtml(r){
  const t=r.type;const pl=r.loc?planById(r.loc.plan):null;
  return `<div class="sez"><h3>Identificazione</h3>
  <div class="idbox"><div class="big">${rid(r)}</div><div class="syn">Sintassi <span class="mono">${syntax(t)}</span>${t==='FD'||t==='LD'?` · forma breve nello stesso edificio <span class="mono">${rid(r,true)}</span>`:''}</div></div>
  <div class="f"><label>Tipologia</label><div class="seg" data-seg="type">${Object.keys(TYPES).map(k=>`<button data-v="${k}" class="${k===t?'on':''}" title="${TYPES[k].n}">${k}</button>`).join('')}</div></div>
  <div class="kv" style="margin:-2px 0 8px"><span>${TYPES[t].it}</span><b>${TYPES[t].n}</b></div>
  ${t!=='CD'?`<div class="f"><label>Edificio (b)</label>${sel('b',r.b,[...Array(26)].map((_,i)=>LET(i)))}</div>`:''}
  <div class="f"><label>Piano (p)</label><input type="number" data-f="floor" value="${r.floor}" step="1"></div>
  <div class="f"><label>Progressivo (x)</label><div style="display:flex;gap:6px;align-items:center">${sel('x',r.x,[...Array(26)].map((_,i)=>LET(i)))}<label class="chk" style="margin:0;white-space:nowrap"><input type="checkbox" data-f="auto" ${r.auto?'checked':''}>auto</label></div></div>
  <div class="kv"><span>Planimetria</span><b>${pl?`<a href="#" data-act="showOnPlan">${esc(pl.name)}</a>`:'non posizionato'}</b></div>
  </div>
  <div class="sez"><h3>Struttura <span>EIA-310-D</span></h3>
  <div class="f"><label>Altezza armadio</label>${sel('units',r.units,[6,9,12,15,18,21,24,27,32,36,42,45,47].map(u=>[u,u+' U']))}</div>
  <div class="kv"><span>Altezza utile</span><b>${fmt(r.units*44.45)} mm</b></div>
  ${chk('numbered',r.numbered,'Telai numerati','1 U = 3 fori, 44,45 mm · U1 = prima unità intera dal basso')}
  ${!r.numbered?chk('strip',r.strip,'Striscia adesiva serigrafata applicata','obbligatoria con telai non numerati'):''}
  ${chk('server',r.server,'Installato in sala server','consente PDU serie VDE C13/C19')}
  ${chk('techRoom',r.techRoom,'Armadio di terminazione in locale tecnico')}
  ${chk('lock',r.lock,'Dotato di serratura')}
  ${chk('outdoor',r.outdoor,'Armadio da esterno')}
  ${r.outdoor?chk('sealed',r.sealed,'Ingressi sigillati','tappi o schiuma poliuretanica'):''}
  ${chk('evolution',r.evolution,'Evoluzione ottica prevista','riserva spazio per cassetti di rimando')}
  ${t==='FD'?chk('hasLocals',r.hasLocals,'Servono armadi local a valle','se assenti va riservato lo spazio per il cassetto di partenza'):''}
  </div>
  <div class="sez"><h3>Note / IRM</h3><textarea data-f="note" placeholder="Ubicazione, riferimenti IRM…">${esc(r.note)}</textarea></div>
  <div class="sez"><h3>Azioni</h3><div class="btnrow">
    <button class="btn piccolo" data-act="auto">Auto-organizza</button>
    <button class="btn piccolo" data-act="dupRack">Duplica</button>
    <button class="btn piccolo" data-act="clearRack">Svuota</button>
    <button class="btn piccolo rosso" data-act="delRack">Elimina armadio</button></div></div>
  <div class="sez"><h3>Opzioni progetto</h3>
  ${chk('p.simplify',P.simplify,'Notazione semplificata nello stesso edificio','es. BA.FB0.C1 → FB0.C1')}
  ${chk('p.fill',P.fill,'Auto-organizza riempie i vani con pannelli ciechi')}
  ${chk('p.showBlank',P.showBlank,'Mostra i pannelli ciechi nelle etichette laterali')}
  </div>`;
}
function itemHtml(r,it){
  const K=KINDS[it.kind],p=it.props,L=panelLetters(r);
  let props='';
  const md=p.model&&MODELS[p.model];
  const hasM=Object.values(MODELS).some(m=>m.rack&&m.k===it.kind);
  const msel=!hasM?'':`<div class="f"><label>Modello</label><select data-f="model"><option value="">Generico</option>${Object.keys(VENDORS).map(v=>{const ms=Object.values(MODELS).filter(m=>m.rack&&m.v===v&&m.k===it.kind);return ms.length?`<optgroup label="${esc(VENDORS[v].n)}">${ms.map(m=>`<option value="${m.id}" ${m.id===p.model?'selected':''}>${esc(m.m)}</option>`).join('')}</optgroup>`:''}).join('')}</select></div>`;
  if(md&&ACTIVE.includes(it.kind))props=msel+`<div class="kv"><span>Marca</span><b>${esc(VENDORS[md.v].n)}</b></div><div class="kv"><span>${md.k==='srv'?'Caratteristiche':'Porte'}</span><b>${esc(mSpec(md))}</b></div>${md.note&&md.k!=='srv'?`<div class="kv"><span>Note</span><b>${esc(md.note)}</b></div>`:''}`;
  else switch(it.kind){
    case 'cm':props=msel;break;
    case 'fo':props=msel+`<div class="f"><label>Uso</label>${sel('use',p.use,[['dorsale','Dorsale'],['distribuzione','Distribuzione'],['mista','Misto (non conforme)']])}</div>
      <div class="f"><label>Verso</label>${sel('dir',p.dir,[['arrivo','Arrivo'],['partenza','Partenza / rimando']])}</div>
      <div class="f"><label>Porte</label>${sel('ports',p.ports,[6,12,24])}</div>
      <div class="f"><label>Fibra</label>${sel('fiber',p.fiber,[['OS2','OS2 monomodale'],['OM3','OM3 multimodale'],['OM4','OM4 multimodale']])}</div>
      <div class="f"><label>Connettore</label>${sel('conn',p.conn,['LC','SC','ST'])}</div>`;break;
    case 'patch':props=msel+`<div class="f"><label>Porte</label>${sel('ports',p.ports,[[12,'12 (1 U)'],[24,'24 (1 U)'],[48,'48 (2 U)']])}</div><div class="f"><label>Categoria</label>${sel('cls',p.cls,['Cat 5e','Cat 6','Cat 6A','Cat 7'])}</div>`;break;
    case 'sw':props=msel+`<div class="f"><label>Porte RJ45</label>${sel('ports',p.ports,[8,16,24,48])}</div><div class="f"><label>Porte SFP</label>${sel('sfp',p.sfp,[0,2,4])}</div>${chk('poe',p.poe,'PoE')}`;break;
    case 'fw':case 'router':case 'hub':case 'mc':case 'poe':props=(['fw','router'].includes(it.kind)?msel:'')+`<div class="f"><label>Porte</label>${sel('ports',p.ports,[2,4,8,12,16,24])}</div>`;break;
    case 'srv':props=msel+`<div class="f"><label>Altezza</label>${sel('size',p.size,[[1,'1 U'],[2,'2 U'],[3,'3 U'],[4,'4 U']])}</div>`;break;
    case 'ups':props=msel+(md?`<div class="kv"><span>Caratteristiche</span><b>${esc(mSpec(md))}</b></div>`:`<div class="f"><label>Altezza</label>${sel('size',p.size,[[1,'1 U'],[2,'2 U'],[3,'3 U'],[4,'4 U']])}</div>`)+chk('onShelf',p.onShelf,md?'Montato su guide o ripiano':'Installate su apposito ripiano','le batterie vanno sostenute da ripiani o guide');break;
    case 'shelf':props=`<div class="f"><label>Altezza reale</label><input type="number" data-f="real" min="0.5" max="10" step="0.5" value="${p.real}"></div><div class="kv"><span>Occupa (arrotondato)</span><b>${it.h} U</b></div>`;break;
    case 'unel':props=msel+`<div class="f"><label>Prese</label>${sel('sockets',p.sockets,[4,6,8,9])}</div>`;break;
    case 'vde':props=msel+`<div class="f"><label>Prese C13</label>${sel('c13',p.c13,[4,6,8,10])}</div><div class="f"><label>Prese C19</label>${sel('c19',p.c19,[0,2,4])}</div>`;break;
    case 'blank':props=`<div class="f"><label>Altezza</label>${sel('size',p.size,[[1,'1 U'],[2,'2 U'],[3,'3 U'],[4,'4 U']])}</div><div class="f"><label>Funzione</label>${sel('reserve',p.reserve,[['none','Copertura'],['fibra','Riserva cassetti ottici'],['rame','Riserva patch panel']])}</div>`;break;
  }
  let ports='';
  if(K.term){
    let g='';
    for(let i=1;i<=+p.ports;i++){const d=it.ports[i];const dv=devAtPort(r.id,it.id,i);g+=`<button class="pt ${d?.t==='link'?'link':d?.note?'note':''} ${dv?'pos':''} ${S.port==i?'sel':''}" data-port="${i}" title="${esc(d?.note||'')}${dv?' · in planimetria':''}">${esc(portLabel(r,it,i,L))}</button>`}
    ports=`<div class="sez"><h3>Prese pannello ${L[it.id]}</h3><div class="portgrid">${g}</div>${S.port?portEditor(r,it,S.port,L):`<p class="piccola">Seleziona una presa per assegnare il locale, marcarla come tratta verso un altro armadio o posizionarla in planimetria. Il punto verde indica le prese già in pianta.</p>`}</div>`;
  }
  const iss=r._issues.filter(i=>i.id===it.id);
  return `<div class="sez"><h3>${CAT[K.cat].label}<button class="btn piccolo trasp" data-act="desel">← Armadio</button></h3>
  <div class="idbox"><div class="titolo">${esc(nm(it))}</div><div class="syn">U${it.pos}${it.h>1?'–U'+topU(it):''} · ${it.h} U${L[it.id]?` · pannello <b class="mono">${L[it.id]}</b>`:''}</div></div>
  <div class="f"><label>Nome</label><input type="text" data-f="name" value="${esc(it.name)}" placeholder="${esc(K.name)}"></div>
  <div class="f"><label>Posizione (U)</label><input type="number" data-f="pos" min="1" max="${r.units}" value="${it.pos}"></div>
  ${props}
  <div class="btnrow" style="margin-top:6px"><button class="btn piccolo" data-act="up">▲ Su</button><button class="btn piccolo" data-act="down">▼ Giù</button><button class="btn piccolo" data-act="dup">Duplica</button><button class="btn piccolo rosso" data-act="del">Elimina</button></div>
  </div>${iss.length?`<div class="sez"><h3>Segnalazioni</h3>${iss.map(i=>`<div style="display:flex;gap:8px;margin-bottom:6px"><i class="dot ${i.lvl}"></i><span>${esc(i.msg)}</span></div>`).join('')}</div>`:''}${ports}`;
}
function portEditor(r,it,n,L){
  const d=it.ports[n]||{t:'user'};const others=P.racks.filter(x=>x.id!==r.id);
  let h=`<div class="pedit"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b>Presa ${L[it.id]}${n}</b><button class="btn piccolo trasp" data-act="pclose">✕</button></div>
  <div class="seg" data-seg="ptype" style="margin-bottom:10px"><button data-v="user" class="${d.t!=='link'?'on':''}">Presa utente</button><button data-v="link" class="${d.t==='link'?'on':''}" ${others.length?'':'disabled'}>Tratta tra armadi</button></div>`;
  if(d.t!=='link'){
    const dv=devAtPort(r.id,it.id,n);
    h+=`<div class="f"><label>Locale / nota</label><input type="text" data-pf="note" value="${esc(d.note||'')}" placeholder="es. Aula 1.02"></div>
    <div class="kv"><span>Etichetta in armadio</span><span class="lbl">${L[it.id]}${n}</span></div>
    <div class="kv"><span>Etichetta presa a muro</span><span class="lbl">${esc(wallLabel(r,it,n,L))}</span></div>`;
    if(it.kind==='patch'){
      if(dv){const pl=planById(dv.plan);const ci=cableInfo(dv);h+=`<div class="kv"><span>Planimetria</span><b>${esc(pl?.name||'')}</b></div>${ci.m?`<div class="kv"><span>Cavo stimato</span><b>${ci.txt}</b></div>`:''}<button class="btn piccolo" data-act="showDev" data-id="${dv.id}">Mostra in planimetria</button>`}
      else{const pl=P.plans.find(p=>p.b===r.b&&+p.floor===+r.floor)||(r.loc&&planById(r.loc.plan));h+=pl?`<button class="btn piccolo" data-act="placePort">Posiziona in planimetria</button>`:`<p class="piccola">Carica la planimetria dell'edificio ${r.b}, piano ${r.floor} per posizionare questa presa.</p>`}
    }
  }else{
    const rem=rackById(d.r);
    h+=`<div class="f"><label>Armadio remoto</label><select data-pf="r">${others.map(x=>`<option value="${x.id}" ${x.id===d.r?'selected':''}>${esc(rid(x))} (${x.type})</option>`).join('')}</select></div>
    <div class="f"><label>Progressivo G</label><input type="number" min="1" data-pf="g" value="${d.g}"></div>
    ${chk('pflip',d.flip,'Inverti verso partenza/arrivo','di norma parte dall\'armadio di gerarchia superiore')}
    <div class="kv"><span>Marchiatura</span><span class="lbl">${esc(linkLabel(r,d))}</span></div>
    <p class="piccola" style="margin-bottom:8px">La presa ${L[it.id]}${n} non è più disponibile come presa utente.</p>
    ${rem?`<button class="btn piccolo" data-act="mirror">Marca la presa corrispondente in ${esc(rid(rem))}</button>`:''}`;
  }
  return h+`<div style="margin-top:8px"><button class="btn piccolo trasp rosso" data-act="pclear">Ripristina presa</button></div></div>`;
}
function planHtml(pl){
  const devs=P.devices.filter(d=>d.plan===pl.id);const cnt=k=>devs.filter(d=>d.kind===k).length;
  const racks=P.racks.filter(r=>r.loc&&r.loc.plan===pl.id);
  const lens=devs.map(cableInfo).filter(c=>c.m);const tot=lens.reduce((s,c)=>s+c.m,0);
  return `<div class="sez"><h3>Planimetria</h3>
  <div class="idbox"><div class="titolo">${esc(pl.name)}</div><div class="syn">Edificio ${pl.b} · piano ${pl.floor} · ${pl.w} × ${pl.h} px</div></div>
  <div class="f"><label>Nome</label><input type="text" data-pl="name" value="${esc(pl.name)}"></div>
  <div class="f"><label>Edificio</label>${sel('b',pl.b,[...Array(26)].map((_,i)=>LET(i)),'data-pl')}</div>
  <div class="f"><label>Piano</label><input type="number" data-pl="floor" value="${pl.floor}" step="1"></div>
  <div class="f"><label>Opacità pianta</label><input type="range" data-pl="opacity" min="0.2" max="1" step="0.05" value="${pl.opacity??1}" style="accent-color:var(--accento)"></div>
  </div>
  <div class="sez"><h3>Scala e cavi <span>ISO/IEC 11801</span></h3>
  <div class="kv"><span>Scala</span><b>${pl.scale?`1 px = ${fmt(pl.scale*100,2)} cm`:'non impostata'}</b></div>
  <div class="f"><label>Larghezza reale</label><div style="display:flex;gap:6px;align-items:center"><input type="number" data-pl="realW" min="1" step="0.5" value="${pl.scale?+(pl.scale*pl.w).toFixed(2):''}" placeholder="es. 40"><span>m</span></div></div>
  <button class="btn piccolo ${S.calib?'on':''}" data-act="calib">Calibra con due punti</button>
  <div class="f" style="margin-top:10px"><label>Scorta per cavo</label><div style="display:flex;gap:6px;align-items:center"><input type="number" data-f="p.slack" min="0" step="0.5" value="${P.slack}"><span>m</span></div></div>
  <p class="piccola">Lunghezza stimata = percorso ortogonale armadio → presa + scorta (calate, risalite, ricchezza in armadio). Limite del canale permanente: 90 m.</p>
  ${lens.length?`<div class="kv"><span>Cavi stimati</span><b>${lens.length} · ${fmt(tot,0)} m totali</b></div><div class="kv"><span>Cavo più lungo</span><b>${fmt(Math.max(...lens.map(c=>c.m)))} m</b></div>`:''}
  </div>
  <div class="sez"><h3>Contenuto</h3>
  <div class="kv"><span>Armadi</span><b>${racks.map(r=>rid(r)).join(', ')||'—'}</b></div>
  <div class="kv"><span>Prese di rete</span><b>${cnt('to')}</b></div><div class="kv"><span>Access point</span><b>${cnt('ap')}</b></div><div class="kv"><span>Telecamere</span><b>${cnt('cam')}</b></div><div class="kv"><span>Altri apparati</span><b>${cnt('altro')}</b></div>
  </div>
  <div class="sez"><h3>Azioni</h3><div class="btnrow"><button class="btn piccolo" data-act="png">Esporta PNG</button><button class="btn piccolo" data-act="printPlan">Stampa</button><button class="btn piccolo" data-act="replaceImg">Sostituisci immagine</button><button class="btn piccolo rosso" data-act="delPlan">Elimina</button></div>
  <p class="piccola">Suggerimento: rotellina per lo zoom, trascina lo sfondo per spostarti, Canc elimina l'elemento selezionato.</p></div>`;
}
function rackMkHtml(r,pl){
  const devs=P.devices.filter(d=>devPort(d)?.r===r);
  return `<div class="sez"><h3>Armadio in planimetria<button class="btn piccolo trasp" data-act="deselMk">← Planimetria</button></h3>
  <div class="idbox"><div class="big">${rid(r)}</div><div class="syn">${TYPES[r.type].it} · ${r.units} U · piano ${r.floor}</div></div>
  <div class="btnrow"><button class="btn piccolo primario" data-act="openRack" data-id="${r.id}">Apri armadio</button><button class="btn piccolo" data-act="unplaceRack">Togli dalla pianta</button></div></div>
  <div class="sez"><h3>Prese servite <span>${devs.length}</span></h3>${devs.length?devs.map(d=>{const ci=cableInfo(d);return `<div class="kv" style="cursor:pointer" data-act="selDev" data-id="${d.id}"><span><span class="lbl">${esc(devLabel(d))}</span> ${esc(d.name||DEV[d.kind].short)}</span><b style="color:${ci.st==='err'?'var(--err)':ci.st==='warn'?'var(--warn)':'inherit'}">${ci.m?fmt(ci.m)+' m':''}</b></div>`}).join(''):'<p class="piccola">Nessuna presa collegata a questo armadio.</p>'}</div>`;
}
function devHtml(d,pl){
  const D=DEV[d.kind];const p=devPort(d);const lab=devLabel(d);const ci=cableInfo(d);
  const racks=P.racks.filter(r=>r.items.some(i=>i.kind==='patch'));
  const r=rackById(d.rack);
  let link=`<div class="f"><label>Armadio</label><select data-dv="rack"><option value="">— nessuno —</option>${racks.map(x=>`<option value="${x.id}" ${x.id===d.rack?'selected':''}>${esc(rid(x))}</option>`).join('')}</select></div>`;
  if(r){const L=panelLetters(r);const pans=r.items.filter(i=>i.kind==='patch').sort((a,b)=>b.pos-a.pos);
    link+=`<div class="f"><label>Pannello</label><select data-dv="item">${pans.map(i=>`<option value="${i.id}" ${i.id===d.item?'selected':''}>${L[i.id]} · ${esc(nm(i))} (U${i.pos})</option>`).join('')}</select></div>`;
    const it=r.items.find(i=>i.id===d.item);
    if(it){let o='';for(let n=1;n<=+it.props.ports;n++){const pd=it.ports[n];const other=devAtPort(r.id,it.id,n);const busy=pd?.t==='link'?' — tratta':other&&other!==d?' — occupata':'';o+=`<option value="${n}" ${+d.port===n?'selected':''} ${pd?.t==='link'?'disabled':''}>${L[it.id]}${n}${pd?.note?' · '+esc(pd.note):''}${busy}</option>`}
      link+=`<div class="f"><label>Presa</label><select data-dv="port">${!d.port?'<option value="">—</option>':''}${o}</select></div>`}
  }
  return `<div class="sez"><h3>${D.name}<button class="btn piccolo trasp" data-act="deselMk">← Planimetria</button></h3>
  <div class="idbox"><div style="display:flex;align-items:center;gap:10px"><div class="ic" style="background:${D.col};width:34px;height:34px">${svgI(d.kind,'width="18" height="18" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"')}</div><div><div class="big" style="font-size:18px">${esc(lab||'non collegato')}</div><div class="syn">${esc([d.model&&MODELS[d.model]?mName(MODELS[d.model]):'',d.name||'senza locale'].filter(Boolean).join(' · '))}</div></div></div></div>
  <div class="f"><label>Tipo</label>${sel('kind',d.kind,Object.entries(DEV).map(([k,v])=>[k,v.short]),'data-dv')}</div>
  <div class="f"><label>Modello</label><select data-dv="model"><option value="">Generico</option>${Object.keys(VENDORS).map(v=>{const ms=Object.values(MODELS).filter(m=>!m.rack&&m.v===v&&m.k===d.kind);return ms.length?`<optgroup label="${esc(VENDORS[v].n)}">${ms.map(m=>`<option value="${m.id}" ${m.id===d.model?'selected':''}>${esc(m.m)}</option>`).join('')}</optgroup>`:''}).join('')}</select></div>
  <div class="f"><label>Locale / nota</label><input type="text" data-dv="name" value="${esc(d.name)}" placeholder="es. Aula 1.02"></div>
  </div>
  <div class="sez"><h3>Collegamento</h3>${link}
  <div class="btnrow" style="margin-top:4px"><button class="btn piccolo" data-act="autoPort">Prima presa libera ${S.serve!=='auto'&&rackById(S.serve)?'('+rid(rackById(S.serve))+')':'dell\'armadio più vicino'}</button>${p?'<button class="btn piccolo" data-act="openPort">Apri nell\'armadio</button>':''}</div>
  ${lab?`<div class="kv" style="margin-top:10px"><span>Etichetta presa a muro</span><span class="lbl">${esc(lab)}</span></div>`:''}
  <div class="kv"><span>Cavo stimato</span><b style="color:${ci.st==='err'?'var(--err)':ci.st==='warn'?'var(--warn)':'inherit'}">${esc(ci.txt)}</b></div>
  </div>
  <div class="sez"><div class="btnrow"><button class="btn piccolo" data-act="dupDev">Duplica</button><button class="btn piccolo rosso" data-act="delMk">Elimina</button></div><p class="piccola">Il locale viene scritto anche come nota della presa nel patch panel, così compare nel foglio di armadio e nel CSV per l'IRM.</p></div>`;
}
function ringSvg(v){const c=2*Math.PI*26,col=v>=90?'var(--ok)':v>=60?'var(--warn)':'var(--err)';
  return `<svg class="ring" viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="none" stroke="var(--linea)" stroke-width="7"/><circle cx="32" cy="32" r="26" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${c*v/100} ${c}" transform="rotate(-90 32 32)"/><text x="32" y="37" text-anchor="middle" font-size="15" font-weight="700" fill="var(--titoli)">${v}</text></svg>`}
function checkHtml(I){
  I=[...I].sort((a,b)=>({err:0,warn:1,info:2}[a.lvl]-{err:0,warn:1,info:2}[b.lvl]));
  const e=I.filter(i=>i.lvl==='err').length,w=I.filter(i=>i.lvl==='warn').length,n=I.filter(i=>i.lvl==='info').length;
  const what=S.view==='rack'?'Armadio '+rid(R()):'Planimetria '+(PL()?.name||'');
  return `<div class="sez"><div class="score">${ringSvg(score(I))}<div><div style="font-weight:700;font-size:16px;color:var(--titoli)">${e?'Non conforme':w?'Conforme con riserve':'Conforme'}</div><div style="color:var(--tenue)">${esc(what)}</div><div style="color:var(--tenue);font-size:13px">${e} errori · ${w} avvisi · ${n} note</div></div></div>
  ${S.view==='rack'&&(e||w)?'<button class="btn piccolo primario" style="margin-top:12px" data-act="auto">Correggi con Auto-organizza</button>':''}</div>
  ${I.length?I.map(i=>`<div class="issue" data-item="${i.id||''}"><i class="dot ${i.lvl}"></i><div><div>${esc(i.msg)}</div>${i.ref?`<div class="ref">${esc(i.ref)}</div>`:''}</div></div>`).join(''):'<div class="vuoto">Nessuna segnalazione 🎉</div>'}`;
}
function renderFoot(){
  let st='';
  if(S.view==='rack'){const r=R();const I=r._issues;const used=r.items.reduce((s,i)=>s+i.h,0);
    st=`<span>Armadio <b class="mono">${rid(r)}</b></span><span class="hide-sm">Occupazione <b>${used}/${r.units} U</b></span><span>Conformità <b style="color:${score(I)>=90?'var(--ok)':score(I)>=60?'var(--warn)':'var(--err)'}">${score(I)}%</b></span>`}
  else{const pl=PL();if(pl){const I=validatePlan(pl);st=`<span><b>${esc(pl.name)}</b></span><span class="hide-sm">${P.devices.filter(d=>d.plan===pl.id).length} elementi</span><span>Conformità <b style="color:${score(I)>=90?'var(--ok)':score(I)>=60?'var(--warn)':'var(--err)'}">${score(I)}%</b></span>`}}
  $('#foot').innerHTML=`<span>© ${new Date().getFullYear()} <a href="${SITO}">Lorenzo Garbi</a></span><span class="hide-sm">Network Design Center</span><a href="${CAFFE}" target="_blank" rel="noopener">☕ Offrimi un caffè</a><span class="sp"></span>${st}`;
}

/* ---------------- vista armadio (rendering riusato) ---------------- */

/* ---------------- trascinamento (mouse e touch) ---------------- */
let D=null;
function startDrag(e,o){
  if(e.button>0)return;
  D={...o,x0:e.clientX,y0:e.clientY,started:false,pos:null,valid:false,ip:null};
  window.addEventListener('pointermove',onMove);
  window.addEventListener('pointerup',onUp,{once:true});
}
function onMove(e){
  if(!D)return;
  if(!D.started){if(Math.hypot(e.clientX-D.x0,e.clientY-D.y0)<5)return;D.started=true;
    const g=document.createElement('div');g.className='dragghost';g.textContent=D.label;document.body.appendChild(g);D.ghost=g;
    if(D.itemId)$(`.it[data-id="${D.itemId}"]`)?.classList.add('drag');
    document.body.classList.remove('lib');}
  D.ghost.style.transform=`translate(${e.clientX+14}px,${e.clientY+10}px)`;
  if(D.plan){const vp=$('#pv').getBoundingClientRect();const pl=PL();
    if(e.clientX>vp.left&&e.clientX<vp.right&&e.clientY>vp.top&&e.clientY<vp.bottom){const p=toImg(e.clientX,e.clientY);D.ip=p.x>=0&&p.y>=0&&p.x<=pl.w&&p.y<=pl.h?p:null}else D.ip=null;
    D.ghost.textContent=D.label+(D.ip?'':' · rilascia sulla pianta');return}
  const bay=$('#bay');if(!bay)return;const b=bay.getBoundingClientRect();const r=R();
  let pv=$('.preview',bay);
  if(e.clientX>b.left-120&&e.clientX<b.right+120&&e.clientY>b.top-S.uh*2&&e.clientY<b.bottom+S.uh*2){
    const u=Math.floor((b.bottom-e.clientY)/S.uh)+1;
    D.pos=clamp(u-Math.floor((D.h-1)/2),1,Math.max(1,r.units-D.h+1));
    D.valid=D.h<=r.units&&fits(r,D.pos,D.h,D.itemId);
    if(!pv){pv=document.createElement('div');pv.className='preview';bay.appendChild(pv)}
    pv.classList.toggle('bad',!D.valid);pv.style.bottom=(D.pos-1)*S.uh+'px';pv.style.height=D.h*S.uh+'px';
    D.ghost.textContent=`${D.label} → U${D.pos}${D.h>1?'–U'+(D.pos+D.h-1):''}${D.valid?'':' (occupato)'}`;
  }else{D.pos=null;pv?.remove();D.ghost.textContent=D.label}
}
function onUp(){
  window.removeEventListener('pointermove',onMove);
  const d=D;D=null;if(!d)return;
  d.ghost?.remove();$('.preview')?.remove();$$('.it.drag').forEach(x=>x.classList.remove('drag'));
  if(!d.started){d.onClick?.();return}
  if(d.plan){if(d.ip)d.onDrop(d.ip);return}
  if(d.pos&&d.valid){
    if(d.itemId)mutate(()=>{R().items.find(i=>i.id===d.itemId).pos=d.pos});
    else mutate(()=>{const it=d.make(d.pos);R().items.push(it);S.item=it.id;S.port=null;S.right='props'});
  }else if(d.pos)toast('Posizione occupata o fuori dall\'armadio');
}
function addNew(it){
  const r=R();const c=KINDS[it.kind].cat;
  const pos=freeSlot(r,it.h,!(c==='alimentazione'||c==='accessori'));
  if(!pos){toast(`Nessuno spazio libero di ${it.h} U in ${rid(r)}`);return}
  it.pos=pos;mutate(()=>{r.items.push(it);S.item=it.id;S.port=null;S.right='props'});
  document.body.classList.remove('lib');
}
function vpCenter(){const vp=$('#pv').getBoundingClientRect();const p=toImg(vp.left+vp.width/2,vp.top+vp.height/2);const pl=PL();const step=40/(pz(pl).k||1);let i=0;while(i<30&&(P.devices.some(d=>d.plan===pl.id&&Math.hypot(d.x-p.x,d.y-p.y)<step*.6)||P.racks.some(r=>r.loc?.plan===pl.id&&Math.hypot(r.loc.x-p.x,r.loc.y-p.y)<step*.6))){p.x+=step;if(i%6===5){p.x-=step*6;p.y+=step}i++}return p}
function placeRack(rackId,p){mutate(()=>{const r=rackById(rackId);r.loc={plan:PL().id,x:Math.round(p.x),y:Math.round(p.y)};S.mk='rk:'+r.id;S.right='props'})}

/* ---------------- eventi: colonna sinistra ---------------- */
$('#leftBody').addEventListener('pointerdown',e=>{
  const c=e.target.closest('.card');if(!c)return;
  if(c.dataset.kind){e.preventDefault();const k=c.dataset.kind;startDrag(e,{make:p=>mkItem(k,p),h:hOf(mkItem(k)),label:KINDS[k].name,onClick:()=>addNew(mkItem(k))});return}
  if(c.dataset.rmodel){e.preventDefault();const id=c.dataset.rmodel;const m=MODELS[id];startDrag(e,{make:p=>mkModelItem(id,p),h:m.h,label:mName(m),onClick:()=>addNew(mkModelItem(id))});return}
  if(c.dataset.fmodel){e.preventDefault();if(!PL()){toast('Carica prima una planimetria');return}const id=c.dataset.fmodel;const m=MODELS[id];startDrag(e,{plan:true,label:mName(m),onDrop:p=>addDevice(m.k,p.x,p.y,null,id),onClick:()=>{const p=vpCenter();addDevice(m.k,p.x,p.y,null,id);document.body.classList.remove('lib')}});return}
  if(c.dataset.dev){e.preventDefault();const k=c.dataset.dev;startDrag(e,{plan:true,label:DEV[k].name,onDrop:p=>addDevice(k,p.x,p.y),onClick:()=>{const p=vpCenter();addDevice(k,p.x,p.y);document.body.classList.remove('lib')}});return}
  if(c.dataset.prack){e.preventDefault();const r=rackById(c.dataset.prack);const here=r.loc&&r.loc.plan===PL().id;
    startDrag(e,{plan:true,label:rid(r),onDrop:p=>placeRack(r.id,p),onClick:()=>{if(here){S.mk='rk:'+r.id;S.right='props';render();centerOn(r.loc.x,r.loc.y)}else placeRack(r.id,vpCenter());document.body.classList.remove('lib')}});return}
  if(c.dataset.tport){e.preventDefault();const [rk,it,n]=c.dataset.tport.split('|');const port={rack:rk,item:it,port:+n};
    startDrag(e,{plan:true,label:c.querySelector('b').textContent,onDrop:p=>addDevice('to',p.x,p.y,port),onClick:()=>{const p=vpCenter();addDevice('to',p.x,p.y,port)}})}
});
$('#leftBody').addEventListener('input',e=>{if(e.target.id==='q'){S.q=e.target.value;S._qfocus='q';renderLeft();S._qfocus=false}if(e.target.id==='mq'){S[S.view==='rack'?'mqR':'mqP']=e.target.value;S._qfocus='mq';renderLeft();S._qfocus=false}});
$('#leftBody').addEventListener('change',e=>{if(e.target.matches('[data-serve]')){S.serve=e.target.value;renderRight()}});
$('#leftTabs').addEventListener('click',e=>{const t=e.target.closest('[data-lt]');if(t){if(S.view==='rack')S.leftR=t.dataset.lt;else S.leftP=t.dataset.lt;renderLeft()}if(e.target.closest('[data-act=closeLib]'))document.body.classList.remove('lib')});
$('#leftBody').addEventListener('click',e=>{
  const ri=e.target.closest('[data-rack]');if(ri){S.rack=ri.dataset.rack;S.item=null;S.port=null;render();document.body.classList.remove('lib');return}
  const vc=e.target.closest('[data-vend]');if(vc){S.vend=vc.dataset.vend;renderLeft();return}
  const pi=e.target.closest('[data-plan]');if(pi){S.plan=pi.dataset.plan;S.mk=null;S.calib=null;render();document.body.classList.remove('lib');return}
  const a=e.target.closest('[data-act]')?.dataset.act;
  if(a==='addRack')mutate(()=>{const cur=R();const r=newRack({b:cur?.b||'A',type:cur?.type==='CD'?'BD':cur?.type||'FD',floor:cur?.floor||0});P.racks.push(r);S.rack=r.id;S.item=null;S.right='props'});
  if(a==='upload')$('#planIn').click();
  if(a==='goModels'){e.preventDefault();S.leftP='mod';renderLeft()}
});

/* ---------------- eventi: vista armadio ---------------- */
$('#stage').addEventListener('pointerdown',e=>{
  const el=e.target.closest('.it');
  if(!el){if(S.item){S.item=null;S.port=null;render()}return}
  e.preventDefault();const id=el.dataset.id;const it=R().items.find(i=>i.id===id);
  startDrag(e,{itemId:id,h:it.h,label:nm(it),onClick:()=>{S.item=id;S.port=null;S.right='props';render()}});
});

/* ---------------- eventi: vista planimetria ---------------- */
const pvEl=$('#pv');
pvEl.addEventListener('wheel',e=>{if(!PL()||!$('#pw'))return;e.preventDefault();const vp=pvEl.getBoundingClientRect();zoomAt(Math.exp(-e.deltaY*0.0015),e.clientX-vp.left,e.clientY-vp.top)},{passive:false});
pvEl.addEventListener('pointerdown',e=>{
  if(e.button>0||!$('#pw'))return;
  const pl=PL();const mk=e.target.closest('.mk');
  const x0=e.clientX,y0=e.clientY;let moved=false;
  if(mk&&!S.calib&&!S.placing){
    e.preventDefault();const key=mk.dataset.mk;const o=mkObj(key);const isR=key.startsWith('rk:');
    const sx=isR?o.loc.x:o.x,sy=isR?o.loc.y:o.y;const k=pz(pl).k;let nx=sx,ny=sy;
    const mv=ev=>{const dx=(ev.clientX-x0)/k,dy=(ev.clientY-y0)/k;if(!moved&&Math.hypot(ev.clientX-x0,ev.clientY-y0)<4)return;moved=true;nx=clamp(sx+dx,0,pl.w);ny=clamp(sy+dy,0,pl.h);mk.style.left=nx+'px';mk.style.top=ny+'px'};
    window.addEventListener('pointermove',mv);
    window.addEventListener('pointerup',()=>{window.removeEventListener('pointermove',mv);
      if(!moved){S.mk=key;S.right='props';render();return}
      mutate(()=>{if(isR){o.loc.x=Math.round(nx);o.loc.y=Math.round(ny)}else{o.x=Math.round(nx);o.y=Math.round(ny)}S.mk=key})},{once:true});
    return}
  e.preventDefault();
  const z=pz(pl);const zx=z.x,zy=z.y;
  const mv=ev=>{if(!moved&&Math.hypot(ev.clientX-x0,ev.clientY-y0)<4)return;moved=true;pvEl.classList.add('pan');z.x=zx+ev.clientX-x0;z.y=zy+ev.clientY-y0;applyPz()};
  window.addEventListener('pointermove',mv);
  window.addEventListener('pointerup',ev=>{window.removeEventListener('pointermove',mv);pvEl.classList.remove('pan');
    if(moved)return;
    const p=toImg(ev.clientX,ev.clientY);
    if(S.calib){if(p.x<0||p.y<0||p.x>pl.w||p.y>pl.h)return;S.calib.pts.push(p);
      if(S.calib.pts.length===2){const [a,b]=S.calib.pts;const px=Math.hypot(a.x-b.x,a.y-b.y);renderPlan();
        setTimeout(()=>{const v=prompt(`Distanza reale tra i due punti (in metri):`,'');S.calib=null;const m=parseFloat(String(v||'').replace(',','.'));
          if(m>0&&px>0){mutate(()=>{pl.scale=m/px});toast(`Scala impostata: 1 px = ${fmt(m/px*100,2)} cm`)}else render()},30)}
      else renderPlan();return}
    if(S.placing){if(p.x<0||p.y<0||p.x>pl.w||p.y>pl.h)return;const pp=S.placing;S.placing=null;addDevice('to',p.x,p.y,pp);return}
    if(S.mk){S.mk=null;render()}},{once:true});
});
['dragover','dragenter'].forEach(ev=>$('#main').addEventListener(ev,e=>{if(S.view==='plan'&&[...(e.dataTransfer?.types||[])].includes('Files')){e.preventDefault();$('#drop')?.classList.add('over')}}));
$('#main').addEventListener('dragleave',()=>$('#drop')?.classList.remove('over'));
$('#main').addEventListener('drop',e=>{if(S.view!=='plan')return;e.preventDefault();$('#drop')?.classList.remove('over');const f=e.dataTransfer.files[0];if(f)importPlanFile(f)});

/* ---------------- eventi: colonna destra ---------------- */
$('#rightBody').addEventListener('change',e=>{
  const t=e.target,f=t.dataset.f,pf=t.dataset.pf,plf=t.dataset.pl,dvf=t.dataset.dv;const r=R();
  if(plf){const pl=PL();mutate(()=>{
    if(plf==='name')pl.name=t.value.trim()||'Planimetria';
    else if(plf==='b')pl.b=t.value;
    else if(plf==='floor')pl.floor=parseInt(t.value)||0;
    else if(plf==='opacity')pl.opacity=+t.value;
    else if(plf==='realW'){const m=parseFloat(t.value);pl.scale=m>0?m/pl.w:null}});return}
  if(dvf){const d=mkObj(S.mk);mutate(()=>{
    if(dvf==='name'){d.name=t.value.trim();const p=devPort(d);if(p){p.it.ports[p.n]={...(p.it.ports[p.n]||{t:'user'}),note:d.name};if(!d.name&&p.it.ports[p.n].t==='user')delete p.it.ports[p.n]}}
    else if(dvf==='kind'){d.kind=t.value;if(d.model&&MODELS[d.model]?.k!==d.kind)d.model=null}
    else if(dvf==='model')d.model=t.value||null;
    else if(dvf==='rack'){d.rack=t.value||null;const rr=rackById(d.rack);const f0=rr?freePorts(rr)[0]:null;d.item=f0?f0.it.id:rr?.items.find(i=>i.kind==='patch')?.id||null;d.port=f0?f0.n:null}
    else if(dvf==='item'){d.item=t.value;const it=rackById(d.rack).items.find(i=>i.id===d.item);let n=null;for(let i=1;i<=+it.props.ports;i++){if(it.ports[i]?.t!=='link'&&!devAtPort(d.rack,d.item,i)){n=i;break}}d.port=n}
    else if(dvf==='port'){const n=+t.value||null;const other=n&&devAtPort(d.rack,d.item,n);if(other&&other!==d)toast('Attenzione: la presa è già assegnata a un altro elemento');d.port=n}
    if(['rack','item','port'].includes(dvf)){const p=devPort(d);if(p){const note=p.it.ports[p.n]?.note;if(d.name&&!note)p.it.ports[p.n]={...(p.it.ports[p.n]||{t:'user'}),note:d.name};else if(note&&!d.name)d.name=note}}
  });return}
  if(f==='pflip'){mutate(()=>{r.items.find(i=>i.id===S.item).ports[S.port].flip=t.checked});return}
  if(pf){mutate(()=>{const it=r.items.find(i=>i.id===S.item);const d=it.ports[S.port]||(it.ports[S.port]={t:'user'});
    if(pf==='note'){d.note=t.value.trim();const dv=devAtPort(r.id,it.id,S.port);if(dv)dv.name=d.note;if(!d.note&&d.t==='user')delete it.ports[S.port]}
    else if(pf==='g')d.g=Math.max(1,parseInt(t.value)||1);
    else if(pf==='r'){d.r=t.value;d.g=nextG(r,t.value)}});return}
  if(!f)return;
  const val=t.type==='checkbox'?t.checked:t.value;
  if(f.startsWith('p.')){mutate(()=>{P[f.slice(2)]=f==='p.slack'?Math.max(0,+val||0):val});return}
  const it=r.items.find(i=>i.id===S.item);
  if(it){
    mutate(()=>{
      if(f==='name'){it.name=val.trim();return}
      if(f==='model'){const old=it.props.model&&MODELS[it.props.model];const m=MODELS[val];const wasDefault=!it.name||(old&&it.name===mName(old));
        if(m){Object.assign(it.props,modelProps(m));if(wasDefault)it.name=mName(m)}else{delete it.props.model;if(wasDefault)it.name=''}
        Object.keys(it.ports).forEach(k=>{if(+k>+it.props.ports)delete it.ports[k]});
        const nh=hOf(it);if(nh!==it.h){if(!fits(r,it.pos,nh,it.id)){const alt=it.pos-(nh-it.h);if(fits(r,alt,nh,it.id))it.pos=alt;else{toast('Spazio insufficiente per l\'altezza del modello');return false}}it.h=nh}return}
      if(f==='pos'){const p=parseInt(val);if(!fits(r,p,it.h,it.id)){toast(`U${p}: posizione occupata o fuori dall'armadio`);return false}it.pos=p;return}
      it.props[f]=t.type==='checkbox'?val:(isNaN(+val)||val===''?val:+val);
      if(f==='real')it.props.real=Math.max(.5,+val||1);
      const nh=hOf(it);
      if(nh!==it.h){if(!fits(r,it.pos,nh,it.id)){const alt=it.pos-(nh-it.h);if(fits(r,alt,nh,it.id))it.pos=alt;else{toast('Spazio insufficiente per la nuova altezza');return false}}it.h=nh}
      if(f==='ports')Object.keys(it.ports).forEach(k=>{if(+k>+val)delete it.ports[k]});
    });
  }else{
    mutate(()=>{
      if(f==='units'){const u=+val;const maxTop=Math.max(0,...r.items.map(topU));if(maxTop>u){toast(`Elementi presenti fino a U${maxTop}: impossibile ridurre a ${u} U`);return false}r.units=u;return}
      if(f==='floor'){r.floor=parseInt(val)||0;return}
      if(f==='x'){r.x=val;r.auto=false;return}
      r[f]=val;
    });
  }
});
$('#rightBody').addEventListener('input',e=>{if(e.target.dataset.pl==='opacity'){const img=$('#pw>img');if(img)img.style.opacity=e.target.value}});
$('#rightBody').addEventListener('click',e=>{
  const r=R();
  const seg=e.target.closest('[data-seg] button');
  if(seg){const kind=seg.parentElement.dataset.seg,v=seg.dataset.v;
    if(kind==='type')mutate(()=>{r.type=v;if(v==='CD')r.b='A'});
    if(kind==='ptype')mutate(()=>{const it=r.items.find(i=>i.id===S.item);
      if(v==='link'){const other=P.racks.find(x=>x.id!==r.id);it.ports[S.port]={t:'link',r:other.id,g:nextG(r,other.id),flip:false};const dv=devAtPort(r.id,it.id,S.port);if(dv){dv.rack=dv.item=dv.port=null}}
      else delete it.ports[S.port]});
    return}
  const pt=e.target.closest('[data-port]');if(pt){S.port=+pt.dataset.port===S.port?null:+pt.dataset.port;renderRight();return}
  const iss=e.target.closest('.issue');if(iss){const k=iss.dataset.item;if(!k)return;
    if(S.view==='rack'){S.item=k;S.port=null;S.right='props';render();$(`.it[data-id="${k}"]`)?.scrollIntoView({block:'center',behavior:'smooth'})}
    else{S.mk=k;S.right='props';render();const o=mkObj(k);if(o){const p=k.startsWith('rk:')?o.loc:o;centerOn(p.x,p.y)}}return}
  const ae=e.target.closest('[data-act]');if(!ae)return;e.preventDefault();
  const a=ae.dataset.act;const it=r.items.find(i=>i.id===S.item);
  switch(a){
    case 'desel':S.item=null;S.port=null;render();break;
    case 'auto':mutate(()=>{if(autoArrange(r)===false)return false;S.item=null});break;
    case 'del':mutate(()=>{r.items=r.items.filter(i=>i!==it);S.item=null;S.port=null});break;
    case 'dup':{const p=freeSlot(r,it.h,true);if(!p){toast('Nessuno spazio libero');break}mutate(()=>{const c=JSON.parse(JSON.stringify(it));c.id=uid();c.pos=p;c.ports={};r.items.push(c);S.item=c.id})}break;
    case 'up':case 'down':moveSel(a==='up'?1:-1);break;
    case 'pclose':S.port=null;renderRight();break;
    case 'pclear':mutate(()=>{delete it.ports[S.port];const dv=devAtPort(r.id,it.id,S.port);if(dv)dv.name=''});break;
    case 'mirror':mirrorPort(r,it,S.port);break;
    case 'dupRack':mutate(()=>{const c=JSON.parse(JSON.stringify(r));c.id=uid();c.auto=true;c.loc=null;c.items.forEach(i=>{i.id=uid();i.ports={}});P.racks.push(c);S.rack=c.id;S.item=null});toast('Armadio duplicato (tratte e posizione non vengono copiate)');break;
    case 'clearRack':if(confirm(`Rimuovere tutti gli elementi da ${rid(r)}?`))mutate(()=>{r.items=[];S.item=null});break;
    case 'delRack':if(P.racks.length<2){toast('Il progetto deve contenere almeno un armadio');break}
      if(confirm(`Eliminare l'armadio ${rid(r)}?`))mutate(()=>{P.racks=P.racks.filter(x=>x!==r);P.racks.forEach(x=>x.items.forEach(i=>Object.keys(i.ports).forEach(k=>{if(i.ports[k].r===r.id)delete i.ports[k]})));S.rack=P.racks[0].id;S.item=null});break;
    case 'showOnPlan':S.view='plan';S.plan=r.loc.plan;S.mk='rk:'+r.id;render();centerOn(r.loc.x,r.loc.y);break;
    case 'showDev':{const d=P.devices.find(x=>x.id===ae.dataset.id);S.view='plan';S.plan=d.plan;S.mk='mk:'+d.id;render();centerOn(d.x,d.y)}break;
    case 'placePort':{const pl=P.plans.find(p=>p.b===r.b&&+p.floor===+r.floor)||planById(r.loc?.plan);S.view='plan';S.plan=pl.id;S.mk=null;S.placing={rack:r.id,item:it.id,port:S.port,lab:wallLabel(r,it,S.port)};render()}break;
    case 'upload':$('#planIn').click();break;
    case 'calib':toggleCalib();break;
    case 'png':exportPng();break;
    case 'printPlan':printPlan();break;
    case 'replaceImg':S.replace=PL().id;$('#planIn').click();break;
    case 'delPlan':{const pl=PL();if(confirm(`Eliminare la planimetria «${pl.name}» e gli elementi posizionati su di essa?`))mutate(()=>{P.plans=P.plans.filter(x=>x!==pl);P.devices=P.devices.filter(d=>d.plan!==pl.id);P.racks.forEach(x=>{if(x.loc?.plan===pl.id)x.loc=null});S.plan=P.plans[0]?.id||null;S.mk=null})}break;
    case 'deselMk':S.mk=null;render();break;
    case 'openRack':S.view='rack';S.rack=ae.dataset.id;S.item=null;S.port=null;render();break;
    case 'unplaceRack':mutate(()=>{mkObj(S.mk).loc=null;S.mk=null});break;
    case 'selDev':{const d=P.devices.find(x=>x.id===ae.dataset.id);S.mk='mk:'+d.id;render();centerOn(d.x,d.y)}break;
    case 'autoPort':{const d=mkObj(S.mk);const rr=S.serve!=='auto'&&rackById(S.serve)||nearestRack(PL(),d.x,d.y);if(!rr){toast('Nessun armadio con patch panel disponibile');break}const f0=freePorts(rr)[0];if(!f0){toast(`Nessuna presa libera in ${rid(rr)}`);break}
      mutate(()=>{d.rack=rr.id;d.item=f0.it.id;d.port=f0.n;if(f0.note&&!d.name)d.name=f0.note;else if(d.name)f0.it.ports[f0.n]={...(f0.it.ports[f0.n]||{t:'user'}),note:d.name}})}break;
    case 'openPort':{const d=mkObj(S.mk);S.view='rack';S.rack=d.rack;S.item=d.item;S.port=d.port;S.right='props';render()}break;
    case 'dupDev':{const d=mkObj(S.mk);addDevice(d.kind,d.x+40,d.y)}break;
    case 'delMk':delMk();break;
  }
});
function delMk(){const k=S.mk;if(!k)return;mutate(()=>{if(k.startsWith('rk:'))rackById(k.slice(3)).loc=null;else P.devices=P.devices.filter(d=>'mk:'+d.id!==k);S.mk=null})}
function toggleCalib(){S.calib=S.calib?null:{pts:[]};S.placing=null;if(S.calib)toast('Clicca due punti sulla pianta di cui conosci la distanza reale');render()}
function mirrorPort(r,it,n){
  const d=it.ports[n];const rem=rackById(d.r);const lab=linkLabel(r,d);
  if(rem.items.some(x=>Object.values(x.ports).some(q=>q.t==='link'&&q.r===r.id&&linkLabel(rem,q)===lab))){toast(`${lab} è già marcata in ${rid(rem)}`);return}
  const panels=[...rem.items].filter(x=>x.kind===it.kind).sort((a,b)=>b.pos-a.pos);
  const fromThis=linkFromIsThis(r,rem,d.flip);
  for(const pn of panels){for(let i=1;i<=+pn.props.ports;i++){if(!pn.ports[i]&&!devAtPort(rem.id,pn.id,i)){
    const base=TYPES[rem.type].rank<=TYPES[r.type].rank;const flip=base!==!fromThis;
    mutate(()=>{rackById(rem.id).items.find(x=>x.id===pn.id).ports[i]={t:'link',r:r.id,g:d.g,flip}});
    toast(`Marcata ${lab} in ${rid(rem)}, pannello ${panelLetters(rem)[pn.id]} presa ${i}`);return}}}
  toast(`Nessuna presa libera su ${it.kind==='fo'?'cassetti ottici':'patch panel'} in ${rid(rem)}`);
}
function moveSel(dir){
  const r=R();const it=r.items.find(i=>i.id===S.item);if(!it)return;
  let p=it.pos+dir;while(p>=1&&p+it.h-1<=r.units&&!fits(r,p,it.h,it.id))p+=dir;
  if(p<1||p+it.h-1>r.units){toast('Nessuno spazio libero in quella direzione');return}
  mutate(()=>{it.pos=p});
}

/* ---------------- eventi: barra flottante e testata ---------------- */
$('#floatBar').addEventListener('input',e=>{if(e.target.id==='zoom'){S.uh=+e.target.value;try{localStorage.setItem('rd-uh',S.uh)}catch(_){}renderRack(R());e.target.nextElementSibling.textContent=S.uh+'px'}});
$('#floatBar').addEventListener('click',e=>{const a=e.target.closest('[data-act]')?.dataset.act;if(!a)return;
  ({legend:()=>{S.legend=!S.legend;renderRack(R());renderFloat()},openLib:()=>document.body.classList.add('lib'),zin:()=>zoomAt(1.25),zout:()=>zoomAt(0.8),fit:fitPlan,calib:toggleCalib,
    cables:()=>mutate(()=>{P.cables=!P.cables}),labels:()=>{S.labels=!S.labels;render()},png:exportPng})[a]?.()});
$$('[data-view]').forEach(b=>b.onclick=()=>{S.view=b.dataset.view;S.calib=null;S.placing=null;render()});
$$('[data-rt]').forEach(b=>b.onclick=()=>{S.right=b.dataset.rt;renderRight()});
$('#projName').addEventListener('change',e=>mutate(()=>{P.name=e.target.value.trim()||'Progetto'}));
$('#undoBtn').onclick=undo;$('#redoBtn').onclick=redo;
$('#autoBtn').onclick=()=>mutate(()=>{if(autoArrange(R())===false)return false;S.item=null});
$('#uploadBtn').onclick=()=>$('#planIn').click();
$('#printBtn').onclick=()=>S.view==='plan'&&PL()?printPlan():printRack();
$('#moreBtn').onclick=e=>{e.stopPropagation();$('#moreMenu').classList.toggle('open')};
document.addEventListener('click',e=>{if(!e.target.closest('#moreMenu'))$('#moreMenu').classList.remove('open')});
$('#moreMenu .menu-lista').addEventListener('click',e=>{
  const m=e.target.closest('[data-m]')?.dataset.m;if(!m)return;$('#moreMenu').classList.remove('open');
  ({topo:openTopo,print:()=>$('#printBtn').onclick(),csv:exportCsv,json:exportJson,import:()=>$('#fileIn').click(),share:shareLink,mode:toggleMode,help:openHelp,
    new:()=>{newProject();toast('Nuovo progetto creato: il precedente resta in «I miei progetti»')}})[m]?.();
});
$('#fileIn').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{const j=JSON.parse(await f.text());if(!j.racks)throw 0;
  const imgs=j.images||{};delete j.images;for(const [id,data] of Object.entries(imgs)){const b=await dataToBlob(data);await DB.put(id,b);if(IMG[id])URL.revokeObjectURL(IMG[id]);IMG[id]=URL.createObjectURL(b)}
  freshPid(j);const old=JSON.stringify(P);P=normalize(j);S.hist.push(old);S.rack=P.racks[0]?.id;S.plan=P.plans[0]?.id||null;S.item=null;S.mk=null;S.pz={};save();render();toast('Progetto importato')}catch(_){toast('File non valido')}};
$('#planIn').onchange=e=>{const f=e.target.files[0];e.target.value='';if(f)importPlanFile(f)};
$('#modal').addEventListener('click',e=>{if(e.target.id==='modal'||e.target.closest('[data-close]'))closeModal();const n=e.target.closest('[data-goto]');if(n){S.view='rack';S.rack=n.dataset.goto;S.item=null;closeModal();render()}});
document.addEventListener('keydown',e=>{
  const typing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!typing){e.preventDefault();e.shiftKey?redo():undo();return}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'&&!typing){e.preventDefault();redo();return}
  if(typing)return;
  if(e.key==='Escape'){closeModal();if(S.calib||S.placing){S.calib=null;S.placing=null;render();return}S.item=null;S.port=null;S.mk=null;render();return}
  if(S.view==='plan'){if((e.key==='Delete'||e.key==='Backspace')&&S.mk){e.preventDefault();delMk()}if(e.key==='+'||e.key==='=')zoomAt(1.25);if(e.key==='-')zoomAt(0.8);return}
  if(!S.item)return;
  if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();mutate(()=>{const r=R();r.items=r.items.filter(i=>i.id!==S.item);S.item=null})}
  if(e.key==='ArrowUp'){e.preventDefault();moveSel(1)}
  if(e.key==='ArrowDown'){e.preventDefault();moveSel(-1)}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();$('[data-act="dup"]')?.click()}
});
window.addEventListener('resize',()=>{if(S.view==='plan')applyPz()});

/* ---------------- caricamento planimetrie ---------------- */
async function importPlanFile(file){
  try{
    let blob,w,h;
    const isPdf=file.type==='application/pdf'||/\.pdf$/i.test(file.name);
    if(isPdf){toast('Conversione del PDF in corso…');({blob,w,h}=await pdfToPng(file));if(!blob)return}
    else if(file.type==='image/svg+xml'||/\.svg$/i.test(file.name)){blob=file;({w,h}=svgSize(await file.text()))}
    else if(/^image\//.test(file.type)){blob=file;const url=URL.createObjectURL(file);const im=await imgEl(url);w=im.naturalWidth;h=im.naturalHeight;
      if(Math.max(w,h)>6000){const s=6000/Math.max(w,h);const c=document.createElement('canvas');c.width=Math.round(w*s);c.height=Math.round(h*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.9));w=c.width;h=c.height}
      URL.revokeObjectURL(url)}
    else{toast('Formato non supportato: usa PNG, JPG, WebP, SVG o PDF');return}
    if(S.replace){const pl=planById(S.replace);S.replace=null;if(pl){await DB.put(pl.id,blob);if(IMG[pl.id])URL.revokeObjectURL(IMG[pl.id]);IMG[pl.id]=URL.createObjectURL(blob);
      const fx=w/pl.w,fy=h/pl.h;mutate(()=>{if(fx!==1||fy!==1){P.devices.filter(d=>d.plan===pl.id).forEach(d=>{d.x*=fx;d.y*=fy});P.racks.forEach(r=>{if(r.loc?.plan===pl.id){r.loc.x*=fx;r.loc.y*=fy}});if(pl.scale)pl.scale/=fx}pl.w=w;pl.h=h});delete S.pz[pl.id];render();toast('Immagine della planimetria aggiornata');return}}
    const r=R();const base=file.name.replace(/\.[^.]+$/,'');
    planForm({name:base,b:r.type==='CD'?'A':r.b,floor:r.floor},async meta=>{
      const id=uid();await DB.put(id,blob);IMG[id]=URL.createObjectURL(blob);
      mutate(()=>{P.plans.push({id,name:meta.name,b:meta.b,floor:meta.floor,w,h,scale:meta.realW>0?meta.realW/w:null,opacity:1});S.plan=id;S.view='plan';S.mk=null;S.leftP='el'});
      if(!meta.realW)setTimeout(()=>toast('Imposta la scala con «Calibra scala» per stimare la lunghezza dei cavi'),600);
    });
  }catch(err){console.error(err);toast('Impossibile leggere il file della planimetria')}
}
function svgSize(txt){
  const vb=txt.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  const wm=txt.match(/<svg[^>]*\swidth\s*=\s*["']([\d.]+)(px)?["']/i),hm=txt.match(/<svg[^>]*\sheight\s*=\s*["']([\d.]+)(px)?["']/i);
  let w=wm?+wm[1]:vb?+vb[1]:2000,h=hm?+hm[1]:vb?+vb[2]:1400;
  const s=Math.max(1,2400/Math.max(w,h));return {w:Math.round(w*s),h:Math.round(h*s)};
}
async function pdfToPng(file){
  const pdfjs=await import(VENDOR+'pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc=VENDOR+'pdf.worker.min.mjs';
  const doc=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  let n=1;
  if(doc.numPages>1){const v=prompt(`Il PDF ha ${doc.numPages} pagine. Quale pagina contiene la planimetria?`,'1');if(v===null)return {};n=clamp(parseInt(v)||1,1,doc.numPages)}
  const page=await doc.getPage(n);const vp0=page.getViewport({scale:1});
  const scale=Math.min(5,3600/Math.max(vp0.width,vp0.height));const vp=page.getViewport({scale});
  const c=document.createElement('canvas');c.width=Math.round(vp.width);c.height=Math.round(vp.height);const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
  await page.render({canvasContext:ctx,viewport:vp}).promise;
  const blob=await new Promise(r=>c.toBlob(r,'image/png'));return {blob,w:c.width,h:c.height};
}
function planForm(def,cb){
  modal('Nuova planimetria',`<form id="plForm"><div class="f"><label>Nome</label><input type="text" name="name" value="${esc(def.name)}" required></div>
  <div class="f"><label>Edificio (b)</label>${sel('b',def.b,[...Array(26)].map((_,i)=>LET(i)),'name')}</div>
  <div class="f"><label>Piano (p)</label><input type="number" name="floor" value="${def.floor}" step="1"></div>
  <div class="f"><label>Larghezza reale</label><div style="display:flex;gap:6px;align-items:center"><input type="number" name="realW" min="0" step="0.5" placeholder="facoltativa"><span>m</span></div></div>
  <p class="piccola">Edificio e piano servono a collegare la pianta agli armadi con lo stesso identificativo (es. BA.FA1 → edificio A, piano 1). La scala si può calibrare anche dopo, cliccando due punti a distanza nota.</p>
  <div class="btnrow" style="justify-content:flex-end;margin-top:14px"><button type="button" class="btn" data-close>Annulla</button><button class="btn primario">Aggiungi planimetria</button></div></form>`,true);
  $('#plForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);closeModal();cb({name:f.get('name').trim()||'Planimetria',b:f.get('b'),floor:parseInt(f.get('floor'))||0,realW:parseFloat(String(f.get('realW')).replace(',','.'))||0})};
}

/* ---------------- topologia, guida, finestre ---------------- */
function modal(t,b,narrow=false){$('#mTitle').textContent=t;$('#mBody').innerHTML=b;$('.dialogo').classList.toggle('stretto',narrow);$('#modal').classList.add('open')}
function closeModal(){$('#modal').classList.remove('open')}
function openTopo(){
  assignLetters();
  const pairs={};P.racks.forEach(r=>r.items.forEach(it=>Object.values(it.ports).forEach(d=>{if(d.t!=='link'||!rackById(d.r))return;const k=[r.id,d.r].sort().join('|');(pairs[k]??=new Set()).add(linkLabel(r,d))})));
  let h='<p style="margin:0 0 16px;color:var(--tenue)">Modello stellare gerarchico ISO/IEC 11801. Le linee sono le tratte marcate sulle prese; fai clic su un armadio per aprirlo.</p><div class="topo" id="topo">';
  Object.keys(TYPES).forEach(t=>{h+=`<div><h4>${t} · ${TYPES[t].n}</h4>`;
    P.racks.filter(r=>r.type===t).sort((a,b)=>a.b.localeCompare(b.b)||a.floor-b.floor).forEach(r=>{const e=validate(r).filter(i=>i.lvl==='err').length;
      h+=`<div class="tnode" data-goto="${r.id}" data-node="${r.id}"><div class="ic ${r.type}"></div><b>${rid(r)}</b><small>piano ${r.floor} · ${r.units} U · ${e?`<span style="color:var(--err)">${e} errori</span>`:'conforme'}</small></div>`});h+='</div>'});
  modal('Topologia della rete',h+'<svg id="topoSvg"></svg></div>');
  requestAnimationFrame(()=>{
    const box=$('#topo').getBoundingClientRect();let s='';
    Object.entries(pairs).forEach(([k,set])=>{const [a,b]=k.split('|');const ea=$(`[data-node="${a}"]`),eb=$(`[data-node="${b}"]`);if(!ea||!eb)return;
      let A=ea.getBoundingClientRect(),B=eb.getBoundingClientRect();if(A.left>B.left)[A,B]=[B,A];
      const x1=A.right-box.left,y1=A.top+A.height/2-box.top,x2=B.left-box.left,y2=B.top+B.height/2-box.top;
      s+=`<path d="M${x1} ${y1} C ${(x1+x2)/2} ${y1}, ${(x1+x2)/2} ${y2}, ${x2} ${y2}" fill="none" stroke="var(--accento)" stroke-width="2" opacity=".7"/><text x="${(x1+x2)/2}" y="${(y1+y2)/2-5}" text-anchor="middle" font-size="12" fill="var(--tenue)">${set.size} tratt${set.size>1?'e':'a'}</text>`});
    $('#topoSvg').innerHTML=s;
  });
}
function openHelp(){modal('Regole e guida',`<div class="aiuto">
<h4>Allestimento dell'armadio</h4><ul>
<li><b>Numerazione</b> (EIA-310-D): 1 U = 44,45 mm, 3 fori a 15,9 mm; U1 è la prima unità intera dal basso. Telai non numerati → striscia adesiva serigrafata sui montanti.</li>
<li><b>Passacavi</b>: un passacavi metallico ogni due unità; tra pannelli ciechi il passacavi si sostituisce con un cieco.</li>
<li><b>Raccordo</b>: dall'alto i cassetti ottici (dorsale e distribuzione in cassetti distinti), lasciando spazio coperto da cieco per i rimandi; armadio local solo cassetti in arrivo; floor senza local → spazio per un cassetto di partenza. Sotto, i patch panel in rame; niente cavi volanti; spazio per le espansioni.</li>
<li><b>Alimentazione</b>: dal basso le multiprese a rack (sala server: PDU VDE C13/C19 o Unel; armadi generici: Unel bi-passo 16/32 A).</li>
<li><b>Apparati attivi</b>: dall'alto nel primo spazio utile, in ordine ISO/OSI decrescente: firewall → router → switch → hub → adattatori.</li>
<li><b>Installazione</b>: niente spazi non multipli di U (2,5 U → 3 U); batterie su ripiani; serratura nei locali tecnici; armadi da esterno con ingressi sigillati.</li></ul>
<h4>Identificazione ed etichettatura</h4><ul>
<li>Etichette solo con etichettatrice o stampa del <b>foglio di armadio</b>; ogni modifica va riportata nell'IRM.</li>
<li><b>Armadi</b>: <code>Cxp</code> campus · <code>Bbxp</code> edificio · <code>Bb.Fxp</code> piano · <code>Bb.Lxp</code> locale (b edificio, x progressivo, p piano).</li>
<li><b>Prese a muro</b>: <code>ABC.DE</code> (es. BA.FA1.C12); nell'armadio solo pannello + numero.</li>
<li><b>Tratte tra armadi</b>: <code>ABC.DEF.G</code> = partenza (gerarchia superiore) . arrivo . progressivo per coppia; nello stesso edificio si può omettere l'ambito.</li></ul>
<h4>Planimetria</h4><ul>
<li>Carica la pianta del piano (PNG, JPG, WebP, SVG o PDF) e indica edificio e piano: gli armadi con lo stesso identificativo vengono proposti per primi.</li>
<li>Imposta la scala con <b>Calibra scala</b> (due punti a distanza nota) o con la larghezza reale della pianta.</li>
<li>Trascina armadi, prese di rete, access point e telecamere. Ogni elemento prende la prima presa libera dell'armadio più vicino (o di quello scelto) e mostra la sua etichetta <code>ABC.DE</code>.</li>
<li>La lunghezza del cavo è stimata sul percorso ortogonale più una scorta: oltre 80 m avviso, oltre 90 m errore (canale permanente ISO/IEC 11801).</li>
<li>Rotellina per lo zoom, trascina lo sfondo per spostarti, Canc elimina l'elemento selezionato. Le immagini restano nel browser; l'export JSON le include.</li></ul></div>`)}

/* ---------------- esportazioni ---------------- */
function download(name,data,type){const b=data instanceof Blob?data:new Blob([data],{type});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},800)}
const slug=s=>(s||'progetto').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
async function exportJson(){
  const out=JSON.parse(JSON.stringify(P));out.images={};
  for(const pl of P.plans){const b=await DB.get(pl.id);if(b)out.images[pl.id]=await blobToData(b)}
  download(slug(P.name)+'.json',JSON.stringify(out),'application/json');toast('Progetto esportato con le planimetrie');
}
function exportCsv(){
  assignLetters();const rows=[['Armadio','Tipologia','Edificio','Piano','Pannello','Elemento','U','Presa','Etichetta in armadio','Etichetta presa / tratta','Tipo','Armadio remoto','Locale / nota','Apparato in planimetria','Modello','Planimetria','Cavo stimato (m)']];
  P.racks.forEach(r=>{const L=panelLetters(r);[...r.items].filter(i=>KINDS[i.kind].term).sort((a,b)=>b.pos-a.pos).forEach(it=>{for(let n=1;n<=+it.props.ports;n++){const d=it.ports[n];const lk=d?.t==='link';const dv=devAtPort(r.id,it.id,n);const ci=dv?cableInfo(dv):null;
    rows.push([rid(r),r.type,r.type==='CD'?'':r.b,r.floor,L[it.id],nm(it),it.pos,n,portLabel(r,it,n,L),lk?linkLabel(r,d):wallLabel(r,it,n,L),lk?'tratta':'utente',lk?rid(rackById(d.r)):'',d?.note||'',dv?DEV[dv.kind].short:'',dv&&MODELS[dv.model]?mName(MODELS[dv.model]):'',dv?planById(dv.plan)?.name||'':'',ci?.m?ci.m.toFixed(1).replace('.',','):''])}})});
  const csv='﻿'+rows.map(r=>r.map(v=>{v=String(v??'');return /[;"\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}).join(';')).join('\r\n');
  download(slug(P.name)+'-etichette.csv',csv,'text/csv;charset=utf-8');toast('CSV etichette esportato');
}
async function shareLink(){
  try{const json=JSON.stringify(P);let enc;
    if('CompressionStream' in window){const cs=new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));const buf=new Uint8Array(await new Response(cs).arrayBuffer());let bin='';buf.forEach(b=>bin+=String.fromCharCode(b));enc='z'+btoa(bin)}
    else enc='j'+btoa(unescape(encodeURIComponent(json)));
    enc=enc.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    await navigator.clipboard.writeText(location.href.split('#')[0]+'#p='+enc);toast(P.plans.length?'Link copiato (le immagini delle planimetrie non sono incluse: usa l\'export JSON)':'Link copiato negli appunti')}catch(e){toast('Impossibile copiare il link')}
}
async function loadFromHash(){
  const m=location.hash.match(/^#p=(.+)$/);if(!m)return false;
  try{let s=m[1].replace(/-/g,'+').replace(/_/g,'/');const kind=s[0];s=s.slice(1);while(s.length%4)s+='=';const bin=atob(s);let json;
    if(kind==='z'){const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));json=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text()}
    else json=decodeURIComponent(escape(bin));
    const j=JSON.parse(json);if(!j.racks)throw 0;freshPid(j);P=normalize(j);S.rack=P.racks[0].id;history.replaceState(null,'',location.pathname+location.search);save();toast('Progetto caricato dal link');return true}catch(e){toast('Link non valido');return false}
}
async function planCanvas(pl,maxDim=3200){
  const url=await imgUrl(pl.id);if(!url)throw new Error('img');const im=await imgEl(url);
  const s=Math.min(1,maxDim/Math.max(pl.w,pl.h));const c=document.createElement('canvas');c.width=Math.round(pl.w*s);c.height=Math.round(pl.h*s);
  const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.globalAlpha=pl.opacity??1;ctx.drawImage(im,0,0,c.width,c.height);ctx.globalAlpha=1;ctx.scale(s,s);
  const u=Math.max(pl.w,pl.h)/1100;const devs=P.devices.filter(d=>d.plan===pl.id);
  if(P.cables)devs.forEach(d=>{if(d.route&&d.route.length)return;const p=devPort(d);if(!p||!p.r.loc||p.r.loc.plan!==pl.id)return;const ci=cableInfo(d);ctx.strokeStyle=ci.st==='err'?'#dc3545':ci.st==='warn'?'#e8a200':TCOL[p.r.type];ctx.lineWidth=2*u;ctx.setLineDash([7*u,5*u]);ctx.globalAlpha=.8;ctx.beginPath();ctx.moveTo(p.r.loc.x,p.r.loc.y);ctx.lineTo(d.x,p.r.loc.y);ctx.lineTo(d.x,d.y);ctx.stroke();ctx.globalAlpha=1});
  ctx.setLineDash([]);
  const label=(x,y,t,sub)=>{ctx.font=`bold ${11*u}px monospace`;const w=Math.max(ctx.measureText(t).width,sub?(ctx.font=`${10*u}px sans-serif`,ctx.measureText(sub).width):0)+8*u;const h=(sub?28:16)*u;ctx.fillStyle='rgba(255,251,224,.95)';ctx.strokeStyle='#cfc68a';ctx.lineWidth=u;ctx.fillRect(x-w/2,y,w,h);ctx.strokeRect(x-w/2,y,w,h);ctx.fillStyle='#222';ctx.textAlign='center';ctx.textBaseline='top';ctx.font=`bold ${11*u}px monospace`;ctx.fillText(t,x,y+3*u);if(sub){ctx.font=`${10*u}px sans-serif`;ctx.fillStyle='#555';ctx.fillText(sub,x,y+15*u)}};
  const dot=(x,y,col,sq)=>{ctx.fillStyle=col;ctx.strokeStyle='#fff';ctx.lineWidth=2*u;ctx.beginPath();if(sq)ctx.rect(x-11*u,y-11*u,22*u,22*u);else ctx.arc(x,y,12*u,0,7);ctx.fill();ctx.stroke()};
  devs.forEach(d=>{const lab=devLabel(d);dot(d.x,d.y,lab?DEV[d.kind].col:'#adb5bd',d.kind==='to');if(S.labels)label(d.x,d.y+15*u,lab||'—',d.name)});
  P.racks.filter(r=>r.loc&&r.loc.plan===pl.id).forEach(r=>{const x=r.loc.x,y=r.loc.y;ctx.fillStyle=TCOL[r.type];ctx.strokeStyle='#fff';ctx.lineWidth=2*u;ctx.fillRect(x-24*u,y-13*u,48*u,26*u);ctx.strokeRect(x-24*u,y-13*u,48*u,26*u);ctx.fillStyle='#fff';ctx.font=`bold ${11*u}px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(rid(r,true),x,y);if(S.labels)label(x,y+17*u,rid(r),TYPES[r.type].it)});
  return c;
}
async function exportPng(){const pl=PL();if(!pl)return;try{const c=await planCanvas(pl);c.toBlob(b=>download(slug(pl.name)+'.png',b),'image/png');toast('Planimetria esportata in PNG')}catch(e){toast('Immagine della planimetria non disponibile')}}
async function printPlan(){
  const pl=PL();if(!pl)return;let c;try{c=await planCanvas(pl,2400)}catch(e){toast('Immagine della planimetria non disponibile');return}
  const devs=P.devices.filter(d=>d.plan===pl.id).sort((a,b)=>(devLabel(a)||'~').localeCompare(devLabel(b)||'~'));const I=validatePlan(pl);
  let h=`<h1>Planimetria — ${esc(pl.name)}</h1><div>${esc(P.name)} · edificio ${pl.b} · piano ${pl.floor}${pl.scale?` · scala 1 px = ${fmt(pl.scale*100,2)} cm`:''} · stampata il ${new Date().toLocaleDateString('it-IT')}</div><img class="pianta" src="${c.toDataURL('image/jpeg',.9)}" alt="">`;
  h+=`<h2>Elementi posizionati (${devs.length})</h2><table><tr><th>Etichetta</th><th>Tipo</th><th>Modello</th><th>Locale</th><th>Armadio</th><th>Cavo stimato</th></tr>${devs.map(d=>{const ci=cableInfo(d);return `<tr><td>${esc(devLabel(d)||'—')}</td><td>${DEV[d.kind].short}</td><td>${esc(MODELS[d.model]?mName(MODELS[d.model]):'')}</td><td>${esc(d.name)}</td><td>${esc(devPort(d)?rid(devPort(d).r):'')}</td><td>${esc(ci.m?fmt(ci.m)+' m':ci.txt)}</td></tr>`}).join('')}</table>`;
  if(I.length)h+='<h2>Segnalazioni</h2><table>'+I.map(i=>`<tr><td>${{err:'Errore',warn:'Avviso',info:'Nota'}[i.lvl]}</td><td>${esc(i.ref)}</td><td>${esc(i.msg)}</td></tr>`).join('')+'</table>';
  $('#print').innerHTML=h;setTimeout(()=>window.print(),150);
}
function printRack(){
  const r=R();assignLetters();const L=panelLetters(r);const I=validate(r);const s=[...r.items].sort((a,b)=>b.pos-a.pos);
  const terms=s.filter(i=>KINDS[i.kind].term);
  let h=`<h1>Foglio di armadio — ${rid(r)}</h1><div>${esc(P.name)} · ${TYPES[r.type].it} (${TYPES[r.type].n}) · ${r.type!=='CD'?'edificio '+r.b+' · ':''}piano ${r.floor} · ${r.units} U · stampato il ${new Date().toLocaleDateString('it-IT')}</div>${r.note?`<div>${esc(r.note)}</div>`:''}
  <div>Conformità: <b>${score(I)}%</b> — ${I.filter(i=>i.lvl==='err').length} errori, ${I.filter(i=>i.lvl==='warn').length} avvisi</div>
  <h2>Disposizione elementi (dall'alto)</h2><table><tr><th>U</th><th>Elemento</th><th>Dettagli</th><th>Pannello</th></tr>`;
  s.forEach(it=>{const p=it.props;const det=it.kind==='fo'?`${p.ports}p ${p.conn} ${p.fiber} · ${p.use} · ${p.dir}`:it.kind==='patch'?`${p.ports}p ${p.cls}`:it.kind==='blank'&&p.reserve!=='none'?'riserva '+p.reserve:it.kind==='shelf'?`${fmt(p.real)} U reali`:p.ports?`${p.ports} porte`:'';
    h+=`<tr><td>${it.h>1?`U${topU(it)}–U${it.pos}`:'U'+it.pos}</td><td>${esc(nm(it))}</td><td>${esc(det)}</td><td>${L[it.id]||''}</td></tr>`});
  h+='</table>';
  terms.forEach(it=>{h+=`<div class="avoid"><h2>Pannello ${L[it.id]} — ${esc(nm(it))} (U${it.pos}, ${it.props.ports} prese)</h2><div class="pg">`;
    for(let n=1;n<=+it.props.ports;n++){const d=it.ports[n];h+=`<div>${esc(portLabel(r,it,n,L))}${d?.note?`<small>${esc(d.note)}</small>`:''}</div>`}h+='</div></div>'});
  const wall=[];terms.forEach(it=>{for(let n=1;n<=+it.props.ports;n++){const d=it.ports[n];if(d?.t!=='link'&&it.kind==='patch')wall.push([wallLabel(r,it,n,L),d?.note||''])}});
  if(wall.length)h+=`<h2>Etichette prese a muro (${wall.length})</h2><div class="lbls">${wall.map(([l,n])=>`<div>${esc(l)}${n?`<small>${esc(n)}</small>`:''}</div>`).join('')}</div>`;
  if(I.length)h+='<h2>Segnalazioni</h2><table>'+I.map(i=>`<tr><td>${{err:'Errore',warn:'Avviso',info:'Nota'}[i.lvl]}</td><td>${esc(i.ref)}</td><td>${esc(i.msg)}</td></tr>`).join('')+'</table>';
  $('#print').innerHTML=h;window.print();
}
function toggleMode(){const d=document.documentElement;const dark=d.dataset.mode?d.dataset.mode==='dark':matchMedia('(prefers-color-scheme: dark)').matches;const m=dark?'light':'dark';d.dataset.mode=m;try{localStorage.setItem('rd-mode',m)}catch(_){}}
let tt,quiet=false;function toast(m){if(quiet)return;const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),2800)}

/* ---------------- avvio ---------------- */
(async function init(){
  try{const uh=+localStorage.getItem('rd-uh');if(uh)S.uh=uh}catch(_){}
  if(!(await loadFromHash())){
    let cur=null;try{cur=localStorage.getItem(PCUR)}catch(_){}
    // passaggio dal salvataggio singolo all'archivio dei progetti
    if(!localStorage.getItem(PIDX)){let old=null;try{old=JSON.parse(localStorage.getItem(STORE))}catch(_){}
      // il vecchio progetto di esempio, se ancora salvato nel browser, viene scartato
      const esempio=old&&old.name==='Sede di esempio'&&(old.racks||[]).some(r=>/^Centro stella edificio A/.test(r.note||''));
      if(esempio)(old.plans||[]).forEach(p=>DB.del(p.id));
      else if(old&&old.racks?.length){old.pid??=uid();try{localStorage.setItem(PKEY(old.pid),JSON.stringify(old));projSetIndex([projMeta(old)]);cur=old.pid}catch(_){}}
      try{localStorage.removeItem(STORE)}catch(_){}}
    let saved=(cur&&projGet(cur))||(projIndex()[0]&&projGet(projIndex()[0].id));
    if(saved&&saved.racks?.length){saved.pid??=cur||uid();P=normalize(saved);S.rack=P.racks[0].id;S.plan=P.plans[0]?.id||null}else{blankProject();P.pid=uid()}
    try{localStorage.setItem(PCUR,P.pid)}catch(_){}
  }
  if(innerWidth<820)S.uh=Math.min(S.uh,20);
  render();
  // pulizia: immagini non più usate da nessuna planimetria
  try{const keys=await DB.keys();const used=new Set(P.plans.map(p=>p.id));(keys||[]).forEach(k=>{if(!used.has(k))DB.del(k)})}catch(_){}
})();
