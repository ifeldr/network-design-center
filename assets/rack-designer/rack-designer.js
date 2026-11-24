/* =====================================================================
   Rack Designer — allestimento ed etichettatura degli armadi di rete, con planimetrie
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

function hOf(it){const p=it.props;switch(it.kind){
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
const S={view:'rack',rack:null,item:null,port:null,plan:null,mk:null,leftR:'lib',leftP:'el',right:'props',hist:[],fut:[],uh:26,legend:true,q:'',pz:{},calib:null,placing:null,serve:'auto',labels:true};
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
    const r=devPort(d).r;if(r.type!=='CD'&&(r.b!==pl.b))add('warn','Topologia',`${lab} è servita da ${rid(r)}, che si trova in un altro edificio.`,id);
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
  const withCm=seq=>{const out=[];let c=0;seq.forEach(it=>{const w=Math.min(it.h,2);if(c+w>2){out.push(mkItem('cm'));c=0}out.push(it);c+=w});if(seq.length)out.push(mkItem('cm'));return out};
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
function save(){try{localStorage.setItem(STORE,JSON.stringify(P))}catch(e){toast('Salvataggio nel browser non riuscito (spazio esaurito?)')}}
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

/* ---------------- progetto di esempio ---------------- */
function demoSvg(){
  const W=2000,H=1100;
  const rooms=[[60,60,500,420,'Aula 1.01'],[560,60,440,420,'Aula 1.02'],[1000,60,400,420,'Segreteria'],[1400,60,300,420,'Locale tecnico'],[1700,60,240,420,'Servizi'],
    [60,620,840,420,'Aula informatica'],[900,620,500,420,'Sala docenti'],[1400,620,540,420,'Laboratorio']];
  let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>`;
  s+=`<defs><pattern id="g" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="#eef1f4" stroke-width="2"/></pattern></defs><rect x="60" y="60" width="1880" height="980" fill="url(#g)"/>`;
  s+='<g fill="none" stroke="#3b4048" stroke-width="10">';rooms.forEach(([x,y,w,h])=>s+=`<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`);s+='</g>';
  s+='<g fill="#fff">';rooms.forEach(([x,y,w,h])=>{const dy=y<300?y+h-6:y-6;s+=`<rect x="${x+w/2-45}" y="${dy}" width="90" height="12"/>`});s+='</g>';
  s+='<g stroke="#3b4048" stroke-width="3" fill="none">';rooms.forEach(([x,y,w,h])=>{const cx=x+w/2-45,dy=y<300?y+h:y;s+=`<path d="M${cx} ${dy} A90 90 0 0 ${y<300?0:1} ${cx+90} ${dy+(y<300?-90:90)}"/>`});s+='</g>';
  s+='<g font-family="Arial,sans-serif" font-size="34" fill="#5a6270" text-anchor="middle">';rooms.forEach(([x,y,w,h,t])=>s+=`<text x="${x+w/2}" y="${y+h/2+12}">${t}</text>`);
  s+='<text x="1000" y="562" font-size="30" fill="#9aa1ab">Corridoio</text><text x="1000" y="1085" font-size="24" fill="#9aa1ab">Edificio A · Piano 1 · planimetria di esempio (40 × 22 m)</text></g>';
  s+='<g stroke="#9aa1ab" stroke-width="3">';for(let i=0;i<8;i++)s+=`<line x1="${1760+i*22}" y1="500" x2="${1760+i*22}" y2="600"/>`;s+='</g>';
  return s+'</svg>';
}
function demo(){
  const bd=newRack({type:'BD',b:'A',floor:0,units:42,server:true,note:'Centro stella edificio A — sala server piano terra'});
  const fd=newRack({type:'FD',b:'A',floor:1,units:24,hasLocals:true,note:'Armadio di piano, locale tecnico primo piano'});
  const ld=newRack({type:'LD',b:'A',floor:1,units:12,techRoom:false,note:'Armadio locale aula informatica — da sistemare'});
  bd.items=[mkItem('fo',1,{use:'dorsale',dir:'partenza'}),mkItem('fo',1,{use:'distribuzione',dir:'partenza',ports:12,fiber:'OM4'}),mkItem('patch'),mkItem('patch'),
    mkItem('fw',1,{},{name:'Firewall perimetrale'}),mkItem('router'),mkItem('sw',1,{ports:48,poe:false},{name:'Core switch'}),mkItem('sw',1,{ports:24}),mkItem('ups',1,{size:2}),mkItem('vde'),mkItem('vde')];
  fd.items=[mkItem('fo',1,{use:'dorsale',dir:'arrivo',ports:12}),mkItem('fo',1,{use:'distribuzione',dir:'partenza',ports:12,fiber:'OM4'}),mkItem('patch'),mkItem('patch'),
    mkItem('sw',1,{ports:24,poe:true}),mkItem('sw',1,{ports:24,poe:true}),mkItem('unel'),mkItem('poe')];
  ld.items=[mkItem('sw',12,{ports:24}),mkItem('patch',11),mkItem('fo',10,{use:'distribuzione',dir:'arrivo',ports:12,fiber:'OM4'}),mkItem('unel',3)];
  P={name:'Sede di esempio',simplify:true,fill:true,slack:6,cables:true,racks:[bd,fd,ld],plans:[],devices:[]};
  assignLetters();
  quiet=true;autoArrange(bd);autoArrange(fd);quiet=false;
  const link=(r1,it1,n1,r2,it2,n2)=>{const g=nextG(r1,r2.id);it1.ports[n1]={t:'link',r:r2.id,g,flip:false};it2.ports[n2]={t:'link',r:r1.id,g,flip:false}};
  const foBD=bd.items.find(i=>i.kind==='fo'),foFD=fd.items.find(i=>i.kind==='fo');
  link(bd,foBD,1,fd,foFD,1);link(bd,foBD,2,fd,foFD,2);
  link(fd,fd.items.filter(i=>i.kind==='fo')[1],1,ld,ld.items.find(i=>i.kind==='fo'),1);
  const pFD=fd.items.find(i=>i.kind==='patch'),pLD=ld.items.find(i=>i.kind==='patch');
  link(fd,pFD,12,ld,pLD,20);
  // planimetria di esempio: edificio A, piano 1 — 2000 px = 40 m
  const pl={id:uid(),name:'Piano primo',b:'A',floor:1,w:2000,h:1100,scale:0.02,opacity:1};
  P.plans.push(pl);
  const blob=new Blob([demoSvg()],{type:'image/svg+xml'});IMG[pl.id]=URL.createObjectURL(blob);DB.put(pl.id,blob);
  fd.loc={plan:pl.id,x:1550,y:330};ld.loc={plan:pl.id,x:170,y:960};
  const dev=(kind,x,y,name,r,it,n)=>{const d={id:uid(),kind,plan:pl.id,x,y,name,rack:r?.id||null,item:it?.id||null,port:n||null};P.devices.push(d);if(it&&n)it.ports[n]={...(it.ports[n]||{t:'user'}),note:name};return d};
  dev('to',230,140,'Aula 1.01',fd,pFD,1);dev('to',470,140,'Aula 1.01',fd,pFD,2);dev('to',780,140,'Aula 1.02',fd,pFD,3);dev('to',1200,140,'Segreteria',fd,pFD,4);
  dev('ap',780,550,'Corridoio',fd,pFD,5);dev('cam',1840,550,'Ingresso servizi',fd,pFD,6);dev('to',1150,960,'Sala docenti',fd,pFD,7);
  dev('to',330,1000,'Aula informatica',ld,pLD,1);dev('to',560,1000,'Aula informatica',ld,pLD,2);dev('to',850,760,'Aula informatica',ld,pLD,3);
  dev('to',1880,960,'Laboratorio',null,null,null);
  S.rack=fd.id;S.item=null;S.port=null;S.plan=pl.id;S.mk=null;S.hist=[];S.fut=[];S.pz={};
}
function blankProject(){P={name:'Nuovo progetto',simplify:true,fill:true,slack:6,cables:true,racks:[newRack({units:24})],plans:[],devices:[]};S.rack=P.racks[0].id;S.item=null;S.plan=null;S.mk=null;S.hist=[];S.fut=[];S.pz={}}

/* ---------------- faccia degli elementi a rack ---------------- */
function portsHtml(n,{rows=1,cls='p',group=6,marks,style=''}={}){
  const per=Math.ceil(n/rows);let h='<div class="ports">';
  for(let r=0;r<rows;r++){h+='<div class="rw">';for(let g=0;g<per;g+=group){h+='<div class="g">';for(let k=g;k<Math.min(g+group,per);k++){const idx=r*per+k+1;if(idx>n)break;h+=`<i class="${cls} ${marks?marks(idx):''}" ${style}></i>`}h+='</div>'}h+='</div>'}
  return h+'</div>';
}
function faceHtml(it,letter){
  const p=it.props;let fc='',extra='';
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
    case 'ups':fc=`<i class="lcd"></i><span>UPS${p.onShelf?' · su ripiano':''}</span><span style="flex:1"></span><i class="led"></i>`;break;
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
  const tabs=S.view==='rack'?[['lib','Libreria'],['racks',`Armadi <span class="badge">${P.racks.length}</span>`]]:[['el','Elementi'],['plans',`Planimetrie <span class="badge">${P.plans.length}</span>`]];
  const cur=S.view==='rack'?S.leftR:S.leftP;
  $('#leftTabs').innerHTML=tabs.map(([k,l])=>`<button class="scheda ${k===cur?'on':''}" data-lt="${k}">${l}</button>`).join('')+`<span class="sp"></span><button class="btn icona trasp solo-sm" data-act="closeLib" aria-label="Chiudi">✕</button>`;
  const el=$('#leftBody');
  if(cur==='lib')el.innerHTML=libHtml();
  else if(cur==='racks')el.innerHTML=racksHtml();
  else if(cur==='el')el.innerHTML=planPaletteHtml();
  else el.innerHTML=plansHtml();
  if(S._qfocus){const qi=$('#q');if(qi){qi.focus();qi.setSelectionRange(qi.value.length,qi.value.length)}}
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
  let h=`<div class="gruppo-t"><span>Apparati in campo</span><span>trascina sulla pianta</span></div>`;
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
  if(P.cables)devs.forEach(d=>{const p=devPort(d);if(!p||!p.r.loc||p.r.loc.plan!==pl.id)return;const ci=cableInfo(d);const col=ci.st==='err'?'#dc3545':ci.st==='warn'?'#e8a200':TCOL[p.r.type];
    const sel=S.mk==='mk:'+d.id||S.mk==='rk:'+p.r.id;
    cav+=`<path d="M${p.r.loc.x} ${p.r.loc.y} H${d.x} V${d.y}" fill="none" stroke="${col}" stroke-width="${sel?3.5:2}" stroke-dasharray="${sel?'':'7 5'}" vector-effect="non-scaling-stroke" opacity="${sel?1:.75}"/>`});
  P.racks.filter(r=>r.loc&&r.loc.plan===pl.id).forEach(r=>{const k='rk:'+r.id;
    mk+=`<div class="mk mk-rack ${S.mk===k?'sel':''} ${bad[k]?'bad':''} ${S.labels?'':'nolbl'}" data-mk="${k}" style="left:${r.loc.x}px;top:${r.loc.y}px" title="${esc(rid(r)+' · '+TYPES[r.type].it)}"><div class="sym" style="background:${TCOL[r.type]}">${svgI('rack')}${esc(rid(r,true))}</div><div class="ml">${esc(rid(r))}<small>${TYPES[r.type].it}</small></div></div>`});
  devs.forEach(d=>{const k='mk:'+d.id;const lab=devLabel(d);
    mk+=`<div class="mk mk-${d.kind} ${lab?'':'libero'} ${S.mk===k?'sel':''} ${bad[k]?'bad':''} ${S.labels?'':'nolbl'}" data-mk="${k}" style="left:${d.x}px;top:${d.y}px" title="${esc((d.name||DEV[d.kind].short)+(lab?' · '+lab:' · non collegato'))}"><div class="sym">${svgI(d.kind)}</div><div class="ml">${esc(lab||'—')}${d.name?`<small>${esc(d.name)}</small>`:''}</div></div>`});
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
function addDevice(kind,x,y,port){
  const pl=PL();const d={id:uid(),kind,plan:pl.id,x:Math.round(x),y:Math.round(y),name:'',rack:null,item:null,port:null};
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
  switch(it.kind){
    case 'fo':props=`<div class="f"><label>Uso</label>${sel('use',p.use,[['dorsale','Dorsale'],['distribuzione','Distribuzione'],['mista','Misto (non conforme)']])}</div>
      <div class="f"><label>Verso</label>${sel('dir',p.dir,[['arrivo','Arrivo'],['partenza','Partenza / rimando']])}</div>
      <div class="f"><label>Porte</label>${sel('ports',p.ports,[6,12,24])}</div>
      <div class="f"><label>Fibra</label>${sel('fiber',p.fiber,[['OS2','OS2 monomodale'],['OM3','OM3 multimodale'],['OM4','OM4 multimodale']])}</div>
      <div class="f"><label>Connettore</label>${sel('conn',p.conn,['LC','SC','ST'])}</div>`;break;
    case 'patch':props=`<div class="f"><label>Porte</label>${sel('ports',p.ports,[[12,'12 (1 U)'],[24,'24 (1 U)'],[48,'48 (2 U)']])}</div><div class="f"><label>Categoria</label>${sel('cls',p.cls,['Cat 5e','Cat 6','Cat 6A','Cat 7'])}</div>`;break;
    case 'sw':props=`<div class="f"><label>Porte RJ45</label>${sel('ports',p.ports,[8,16,24,48])}</div><div class="f"><label>Porte SFP</label>${sel('sfp',p.sfp,[0,2,4])}</div>${chk('poe',p.poe,'PoE')}`;break;
    case 'fw':case 'router':case 'hub':case 'mc':case 'poe':props=`<div class="f"><label>Porte</label>${sel('ports',p.ports,[2,4,8,12,16,24])}</div>`;break;
    case 'srv':props=`<div class="f"><label>Altezza</label>${sel('size',p.size,[[1,'1 U'],[2,'2 U'],[3,'3 U'],[4,'4 U']])}</div>`;break;
    case 'ups':props=`<div class="f"><label>Altezza</label>${sel('size',p.size,[[1,'1 U'],[2,'2 U'],[3,'3 U'],[4,'4 U']])}</div>${chk('onShelf',p.onShelf,'Installate su apposito ripiano','obbligatorio')}`;break;
    case 'shelf':props=`<div class="f"><label>Altezza reale</label><input type="number" data-f="real" min="0.5" max="10" step="0.5" value="${p.real}"></div><div class="kv"><span>Occupa (arrotondato)</span><b>${it.h} U</b></div>`;break;
    case 'unel':props=`<div class="f"><label>Prese</label>${sel('sockets',p.sockets,[4,6,8,9])}</div>`;break;
    case 'vde':props=`<div class="f"><label>Prese C13</label>${sel('c13',p.c13,[4,6,8,10])}</div><div class="f"><label>Prese C19</label>${sel('c19',p.c19,[0,2,4])}</div>`;break;
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
  <div class="idbox"><div style="display:flex;align-items:center;gap:10px"><div class="ic" style="background:${D.col};width:34px;height:34px">${svgI(d.kind,'width="18" height="18" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"')}</div><div><div class="big" style="font-size:18px">${esc(lab||'non collegato')}</div><div class="syn">${esc(d.name||'senza locale')}</div></div></div></div>
  <div class="f"><label>Tipo</label>${sel('kind',d.kind,Object.entries(DEV).map(([k,v])=>[k,v.short]),'data-dv')}</div>
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
  $('#foot').innerHTML=`<span>© ${new Date().getFullYear()} <a href="${SITO}">Lorenzo Garbi</a></span><span class="hide-sm">Rack Designer</span><a href="${CAFFE}" target="_blank" rel="noopener">☕ Offrimi un caffè</a><span class="sp"></span>${st}`;
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
    else mutate(()=>{const it=mkItem(d.kind,d.pos);R().items.push(it);S.item=it.id;S.port=null;S.right='props'});
  }else if(d.pos)toast('Posizione occupata o fuori dall\'armadio');
}
function addKind(kind){
  const r=R();const it=mkItem(kind);const c=KINDS[kind].cat;
  const pos=freeSlot(r,it.h,!(c==='alimentazione'||c==='accessori'));
  if(!pos){toast(`Nessuno spazio libero di ${it.h} U in ${rid(r)}`);return}
  it.pos=pos;mutate(()=>{r.items.push(it);S.item=it.id;S.port=null;S.right='props'});
  document.body.classList.remove('lib');
}
function vpCenter(){const vp=$('#pv').getBoundingClientRect();return toImg(vp.left+vp.width/2,vp.top+vp.height/2)}
function placeRack(rackId,p){mutate(()=>{const r=rackById(rackId);r.loc={plan:PL().id,x:Math.round(p.x),y:Math.round(p.y)};S.mk='rk:'+r.id;S.right='props'})}

/* ---------------- eventi: colonna sinistra ---------------- */
$('#leftBody').addEventListener('pointerdown',e=>{
  const c=e.target.closest('.card');if(!c)return;
  if(c.dataset.kind){e.preventDefault();const k=c.dataset.kind;startDrag(e,{kind:k,h:hOf(mkItem(k)),label:KINDS[k].name,onClick:()=>addKind(k)});return}
  if(c.dataset.dev){e.preventDefault();const k=c.dataset.dev;startDrag(e,{plan:true,label:DEV[k].name,onDrop:p=>addDevice(k,p.x,p.y),onClick:()=>{const p=vpCenter();addDevice(k,p.x,p.y);document.body.classList.remove('lib')}});return}
  if(c.dataset.prack){e.preventDefault();const r=rackById(c.dataset.prack);const here=r.loc&&r.loc.plan===PL().id;
    startDrag(e,{plan:true,label:rid(r),onDrop:p=>placeRack(r.id,p),onClick:()=>{if(here){S.mk='rk:'+r.id;S.right='props';render();centerOn(r.loc.x,r.loc.y)}else placeRack(r.id,vpCenter());document.body.classList.remove('lib')}});return}
  if(c.dataset.tport){e.preventDefault();const [rk,it,n]=c.dataset.tport.split('|');const port={rack:rk,item:it,port:+n};
    startDrag(e,{plan:true,label:c.querySelector('b').textContent,onDrop:p=>addDevice('to',p.x,p.y,port),onClick:()=>{const p=vpCenter();addDevice('to',p.x,p.y,port)}})}
});
$('#leftBody').addEventListener('input',e=>{if(e.target.id==='q'){S.q=e.target.value;S._qfocus=true;renderLeft();S._qfocus=false}});
$('#leftBody').addEventListener('change',e=>{if(e.target.matches('[data-serve]')){S.serve=e.target.value;renderRight()}});
$('#leftTabs').addEventListener('click',e=>{const t=e.target.closest('[data-lt]');if(t){if(S.view==='rack')S.leftR=t.dataset.lt;else S.leftP=t.dataset.lt;renderLeft()}if(e.target.closest('[data-act=closeLib]'))document.body.classList.remove('lib')});
$('#leftBody').addEventListener('click',e=>{
  const ri=e.target.closest('[data-rack]');if(ri){S.rack=ri.dataset.rack;S.item=null;S.port=null;render();document.body.classList.remove('lib');return}
  const pi=e.target.closest('[data-plan]');if(pi){S.plan=pi.dataset.plan;S.mk=null;S.calib=null;render();document.body.classList.remove('lib');return}
  const a=e.target.closest('[data-act]')?.dataset.act;
  if(a==='addRack')mutate(()=>{const cur=R();const r=newRack({b:cur?.b||'A',type:cur?.type==='CD'?'BD':cur?.type||'FD',floor:cur?.floor||0});P.racks.push(r);S.rack=r.id;S.item=null;S.right='props'});
  if(a==='upload')$('#planIn').click();
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
    else if(dvf==='kind')d.kind=t.value;
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
    demo:()=>{if(confirm('Sostituire il progetto corrente con quello di esempio?')){const old=JSON.stringify(P);demo();S.hist=[old];save();render()}},
    new:()=>{if(confirm('Creare un nuovo progetto vuoto? Puoi tornare indietro con Ctrl+Z.')){const old=JSON.stringify(P);blankProject();S.hist=[old];save();render()}}})[m]?.();
});
$('#fileIn').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{const j=JSON.parse(await f.text());if(!j.racks)throw 0;
  const imgs=j.images||{};delete j.images;for(const [id,data] of Object.entries(imgs)){const b=await dataToBlob(data);await DB.put(id,b);if(IMG[id])URL.revokeObjectURL(IMG[id]);IMG[id]=URL.createObjectURL(b)}
  const old=JSON.stringify(P);P=normalize(j);S.hist.push(old);S.rack=P.racks[0]?.id;S.plan=P.plans[0]?.id||null;S.item=null;S.mk=null;S.pz={};save();render();toast('Progetto importato')}catch(_){toast('File non valido')}};
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
  assignLetters();const rows=[['Armadio','Tipologia','Edificio','Piano','Pannello','Elemento','U','Presa','Etichetta in armadio','Etichetta presa / tratta','Tipo','Armadio remoto','Locale / nota','Apparato in planimetria','Planimetria','Cavo stimato (m)']];
  P.racks.forEach(r=>{const L=panelLetters(r);[...r.items].filter(i=>KINDS[i.kind].term).sort((a,b)=>b.pos-a.pos).forEach(it=>{for(let n=1;n<=+it.props.ports;n++){const d=it.ports[n];const lk=d?.t==='link';const dv=devAtPort(r.id,it.id,n);const ci=dv?cableInfo(dv):null;
    rows.push([rid(r),r.type,r.type==='CD'?'':r.b,r.floor,L[it.id],nm(it),it.pos,n,portLabel(r,it,n,L),lk?linkLabel(r,d):wallLabel(r,it,n,L),lk?'tratta':'utente',lk?rid(rackById(d.r)):'',d?.note||'',dv?DEV[dv.kind].short:'',dv?planById(dv.plan)?.name||'':'',ci?.m?ci.m.toFixed(1).replace('.',','):''])}})});
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
    const j=JSON.parse(json);if(!j.racks)throw 0;P=normalize(j);S.rack=P.racks[0].id;history.replaceState(null,'',location.pathname+location.search);toast('Progetto caricato dal link');return true}catch(e){toast('Link non valido');return false}
}
async function planCanvas(pl,maxDim=3200){
  const url=await imgUrl(pl.id);if(!url)throw new Error('img');const im=await imgEl(url);
  const s=Math.min(1,maxDim/Math.max(pl.w,pl.h));const c=document.createElement('canvas');c.width=Math.round(pl.w*s);c.height=Math.round(pl.h*s);
  const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.globalAlpha=pl.opacity??1;ctx.drawImage(im,0,0,c.width,c.height);ctx.globalAlpha=1;ctx.scale(s,s);
  const u=Math.max(pl.w,pl.h)/1100;const devs=P.devices.filter(d=>d.plan===pl.id);
  if(P.cables)devs.forEach(d=>{const p=devPort(d);if(!p||!p.r.loc||p.r.loc.plan!==pl.id)return;const ci=cableInfo(d);ctx.strokeStyle=ci.st==='err'?'#dc3545':ci.st==='warn'?'#e8a200':TCOL[p.r.type];ctx.lineWidth=2*u;ctx.setLineDash([7*u,5*u]);ctx.globalAlpha=.8;ctx.beginPath();ctx.moveTo(p.r.loc.x,p.r.loc.y);ctx.lineTo(d.x,p.r.loc.y);ctx.lineTo(d.x,d.y);ctx.stroke();ctx.globalAlpha=1});
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
  h+=`<h2>Elementi posizionati (${devs.length})</h2><table><tr><th>Etichetta</th><th>Tipo</th><th>Locale</th><th>Armadio</th><th>Cavo stimato</th></tr>${devs.map(d=>{const ci=cableInfo(d);return `<tr><td>${esc(devLabel(d)||'—')}</td><td>${DEV[d.kind].short}</td><td>${esc(d.name)}</td><td>${esc(devPort(d)?rid(devPort(d).r):'')}</td><td>${esc(ci.m?fmt(ci.m)+' m':ci.txt)}</td></tr>`}).join('')}</table>`;
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
    let saved=null;try{saved=JSON.parse(localStorage.getItem(STORE))}catch(_){}
    if(saved&&saved.racks?.length){P=normalize(saved);S.rack=P.racks[0].id;S.plan=P.plans[0]?.id||null}else demo();
  }
  if(innerWidth<820)S.uh=Math.min(S.uh,20);
  render();
  // pulizia: immagini non più usate da nessuna planimetria
  try{const keys=await DB.keys();const used=new Set(P.plans.map(p=>p.id));(keys||[]).forEach(k=>{if(!used.has(k))DB.del(k)})}catch(_){}
})();
