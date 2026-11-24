/* =====================================================================
   Network Design Center — funzioni avanzate
   Si aggancia a rack-designer.js sostituendo alcune funzioni globali
   (validate, rackHtml, itemHtml, render…) e aggiungendo:
   • permutazioni presa → porta switch (colore bretella, VLAN)
   • bilancio di alimentazione: consumi, budget PoE, UPS, autonomia, calore
   • peso, portata, profondità e vista posteriore dell'armadio
   • vista sala apparati (armadi affiancati) e vista campus con gli edifici
   • dorsali in planimetria, prese libere per piano
   • QR sulla targhetta, registro modifiche, distinta materiali
   • etichette per Brother P-touch e Dymo, esportazione per NetBox
   ===================================================================== */
(function(){
'use strict';
const COLORI={blu:'#1f6feb',giallo:'#f2c200',rosso:'#d93025',verde:'#1e8e3e',grigio:'#8a8f98',nero:'#1b1b1b',bianco:'#f4f4f4',arancione:'#f28b20',viola:'#8e44ad',azzurro:'#29b6f6',rosa:'#e91e63'};
const today=()=>new Date().toISOString().slice(0,10);
const num=(v,d)=>{const n=parseFloat(String(v??'').replace(',','.'));return isFinite(n)?n:d};
const has=v=>v!==undefined&&v!==null&&v!=='';
const csvCell=v=>{v=String(v??'');return /[,;"\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
const csv=(rows,sep=';')=>'﻿'+rows.map(r=>r.map(csvCell).join(sep)).join('\r\n');

/* ---------------- dati aggiuntivi nel progetto ---------------- */
function normX(p){if(!p)return p;p.buildings??={};p.netbox??={url:'',site:''};p.author??='';(p.racks||[]).forEach(r=>{r.log??=[];r.perm??={}});return p}
const _normalize=normalize;normalize=function(p){return normX(_normalize(p))};
const _blank=blankProject;blankProject=function(){_blank();normX(P)};

/* ---------------- stime tecniche degli apparati ---------------- */
const isStorage=m=>m&&/NAS|NVR|storage|dischi|espansione/i.test((m.note||'')+' '+m.m);
function parseVA(m){if(!m)return 0;const t=(m.note||'')+' '+m.m;let x=t.match(/(\d+(?:[.,]\d+)?)\s*kVA/i);if(x)return num(x[1],0)*1000;x=t.match(/(\d{3,5})\s*VA/i);if(x)return +x[1];x=t.match(/\b(\d{1,2})K\b/);if(x)return +x[1]*1000;return 0}
function defSpec(it){
  const k=it.kind,p=it.props,m=p.model&&MODELS[p.model],h=it.h,ports=+p.ports||0;
  const s={w:0,kg:1,dep:300,poeb:0,va:0};
  switch(k){
    case 'sw':s.w=ports>24?45:ports>12?25:15;s.kg=ports>24?5:3.5;s.poeb=p.poe?(ports>24?740:ports>16?370:ports>8?150:65):0;break;
    case 'fw':s.w=40;s.kg=4;s.dep=320;break;
    case 'router':s.w=m&&/OLT/.test(m.note||'')?120*h:35;s.kg=h>1?8*h:3.5;break;
    case 'hub':s.w=10;s.kg=2;s.dep=200;break;
    case 'mc':s.w=10;s.kg=1.5;s.dep=200;break;
    case 'srv':if(isStorage(m)){s.w=60*h+20;s.kg=9*h;s.dep=h>1?560:480}else{s.w=h===1?250:180*h;s.kg=14*h;s.dep=750}break;
    case 'ups':if(m&&/batterie/i.test(m.note||'')){s.kg=30}else{s.va=parseVA(m)||1500;s.kg=s.va<=1000?16:s.va<=2200?26:s.va<=3000?30:15*h}s.dep=600;break;
    case 'unel':case 'vde':s.kg=2;s.dep=60;break;
    case 'poe':s.w=10;s.kg=2;s.dep=250;s.poeb=120;break;
    case 'patch':s.kg=ports>24?2:1;s.dep=120;break;
    case 'fo':s.kg=2;s.dep=300;break;
    case 'cm':s.kg=.6*h;s.dep=80;break;
    case 'blank':s.kg=.3*h;s.dep=10;break;
    case 'shelf':s.kg=3;s.dep=400;break;
  }
  return s;
}
function spec(it){const d=defSpec(it),p=it.props;const o=k=>has(p[k])?num(p[k],d[k]):d[k];return {w:o('w'),kg:o('kg'),dep:o('dep'),poeb:o('poeb'),va:o('va'),def:d}}
const upsPf=it=>{const m=it.props.model&&MODELS[it.props.model];return m&&/on-line/i.test(m.note||'')?0.9:0.7};
function devW(d){if(has(d.w))return num(d.w,0);const m=d.model&&MODELS[d.model];const t=m?(m.note||'')+' '+m.m:'';if(d.kind==='ap')return /Wi-Fi 7/.test(t)?25:/6E/.test(t)?20:15;if(d.kind==='cam')return /PTZ|speed dome/i.test(t)?25:8;return 0}
const rDepth=r=>num(r.depth,r.units<=15?450:800);
const rCap=r=>num(r.cap,r.units<=15?60:r.units<=27?400:800);

/* ---------------- permutazioni ---------------- */
function swPorts(it){const p=it.props,m=p.model&&MODELS[p.model];const rj=+p.ports||0;const sfp=m?(+m.sfp||0):(+p.sfp||0);return {rj,sfp,n:rj+sfp}}
const swPortName=(it,n)=>{const s=swPorts(it);return n<=s.rj?String(n):'SFP'+(n-s.rj)};
const isSwitchLike=it=>['sw','fw','router','hub','mc','poe'].includes(it.kind)&&swPorts(it).n>0;
function perms(r){const L=panelLetters(r);const out=[];Object.entries(r.perm||{}).forEach(([k,pc])=>{const [pid,n]=k.split(':');const panel=r.items.find(i=>i.id===pid);const sw=r.items.find(i=>i.id===pc.it);if(panel&&sw)out.push({panel,n:+n,pc,sw,swp:+pc.n,lab:L[pid]+n})});return out.sort((a,b)=>a.lab.localeCompare(b.lab,undefined,{numeric:true}))}
function swUse(r,swId){const m={};perms(r).forEach(p=>{if(p.sw.id===swId)(m[p.swp]??=[]).push(p)});return m}
function poeDemand(r){const d={};perms(r).forEach(p=>{const dv=devAtPort(r.id,p.panel.id,p.n);if(!dv)return;const w=devW(dv);if(!w)return;const o=(d[p.sw.id]??={w:0,n:0});o.w+=w;o.n++});return d}
function power(r){
  const pd=poeDemand(r);let load=0,kg=0,ups=0,upsN=0;
  r.items.forEach(it=>{const s=spec(it);kg+=s.kg;if(it.kind==='ups'){if(s.va){ups+=s.va*upsPf(it);upsN++}}else{load+=s.w;if(pd[it.id])load+=pd[it.id].w/0.9}});
  let run=null;if(ups>0&&load>0)run=Math.min(600,6*Math.pow(ups/load,1.3));
  return {load,kg,ups,upsN,btu:load*3.412,run,pd};
}
const _clean=cleanRefs;cleanRefs=function(){_clean();P.racks.forEach(r=>{r.perm??={};Object.keys(r.perm).forEach(k=>{const [pid,n]=k.split(':');const panel=r.items.find(i=>i.id===pid);const pc=r.perm[k];const sw=r.items.find(i=>i.id===pc.it);
  if(!panel||panel.kind!=='patch'||+n>+panel.props.ports||panel.ports[n]?.t==='link'||!sw||+pc.n>swPorts(sw).n)delete r.perm[k]})})};

/* ---------------- prese libere e dorsali ---------------- */
function freeFloor(b,floor){let free=0,tot=0;P.racks.filter(r=>r.type!=='CD'&&r.b===b&&+r.floor===+floor).forEach(r=>r.items.filter(i=>i.kind==='patch').forEach(it=>{for(let n=1;n<=+it.props.ports;n++){const pd=it.ports[n];if(pd&&pd.t==='link')continue;tot++;if(!(pd&&pd.note)&&!devAtPort(r.id,it.id,n))free++}}));return {free,tot}}
function backbones(pl){
  const seen={},out=[];
  P.racks.forEach(r=>r.items.forEach(it=>Object.entries(it.ports).forEach(([n,pd])=>{if(pd.t!=='link')return;const rem=rackById(pd.r);if(!rem)return;
    const k=[r.id,rem.id].sort().join('|')+'|'+it.kind;const lab=linkLabel(r,pd);
    if(!seen[k]){seen[k]={a:r,b:rem,kind:it.kind,fiber:it.props.fiber,labels:new Set()};out.push(seen[k])}seen[k].labels.add(lab)})));
  return out.map(o=>{let m=null;if(pl&&o.a.loc&&o.b.loc&&o.a.loc.plan===pl.id&&o.b.loc.plan===pl.id&&pl.scale)m=(Math.abs(o.a.loc.x-o.b.loc.x)+Math.abs(o.a.loc.y-o.b.loc.y))*pl.scale+(+P.slack||0);return {...o,n:o.labels.size,m}});
}

/* ---------------- validazioni aggiuntive ---------------- */
const _validate=validate;
validate=function(r){
  const I=_validate(r);if(!r.items.length)return I;
  const add=(lvl,ref,msg,id)=>I.push({lvl,ref,msg,id});
  r.items.filter(isSwitchLike).forEach(sw=>{const u=swUse(r,sw.id);Object.entries(u).forEach(([n,a])=>{if(a.length>1)add('err','Permutazioni',`Porta ${swPortName(sw,+n)} di ${nm(sw)} collegata a più prese (${a.map(x=>x.lab).join(', ')}).`,sw.id)})});
  const pw=power(r);
  Object.entries(pw.pd).forEach(([id,d])=>{const sw=r.items.find(i=>i.id===id);const s=spec(sw);
    if(!s.poeb)add('err','Alimentazione PoE',`${nm(sw)} non fornisce PoE ma è permutato verso ${d.n} apparati da alimentare (${fmt(d.w)} W).`,id);
    else if(d.w>s.poeb)add('err','Alimentazione PoE',`${nm(sw)}: richiesta PoE ${fmt(d.w)} W oltre il budget di ${fmt(s.poeb)} W.`,id);
    else if(d.w>s.poeb*.9)add('warn','Alimentazione PoE',`${nm(sw)}: richiesta PoE ${fmt(d.w)} W, oltre il 90% del budget (${fmt(s.poeb)} W).`,id)});
  if(pw.upsN){const f=pw.load/pw.ups;if(f>1)add('err','Alimentazione',`Carico stimato ${fmt(pw.load,0)} W oltre la capacità degli UPS (${fmt(pw.ups,0)} W).`);else if(f>.8)add('warn','Alimentazione',`Carico stimato ${fmt(pw.load,0)} W, pari al ${Math.round(f*100)}% della capacità degli UPS: poco margine.`)}
  else if(r.items.some(i=>['sw','fw','router','srv'].includes(i.kind)))add('info','Alimentazione',`Nessun UPS nell'armadio: carico stimato ${fmt(pw.load,0)} W.`);
  const cap=rCap(r);
  if(pw.kg>cap)add('err','Portata',`Peso stimato ${fmt(pw.kg,0)} kg oltre la portata dell'armadio (${fmt(cap,0)} kg).`);else if(pw.kg>cap*.85)add('warn','Portata',`Peso stimato ${fmt(pw.kg,0)} kg, vicino alla portata dell'armadio (${fmt(cap,0)} kg).`);
  r.items.forEach(it=>{const s=spec(it);if(s.kg>=20&&it.pos>r.units*2/3)add('info','Stabilità',`${nm(it)} pesa circa ${fmt(s.kg,0)} kg ed è nella parte alta (U${it.pos}): valuta la stabilità dell'armadio.`,it.id)});
  const ud=rDepth(r)-100;r.items.forEach(it=>{const s=spec(it);if(s.dep>ud)add('err','Profondità',`${nm(it)} è profondo circa ${fmt(s.dep,0)} mm: l'armadio da ${rDepth(r)} mm ne offre circa ${ud} utili.`,it.id)});
  return I;
};
const _validatePlan=validatePlan;
validatePlan=function(pl){
  const I=_validatePlan(pl);if(!pl)return I;
  backbones(pl).forEach(b=>{if(b.m==null)return;const labs=[...b.labels].join(', ');
    if(b.kind==='patch'&&b.m>90)I.push({lvl:'err',ref:'ISO/IEC 11801',msg:`Tratta in rame ${labs}: ≈ ${fmt(b.m)} m, oltre i 90 m. Usare la fibra.`,id:'rk:'+b.a.id});
    if(b.kind==='fo'&&b.fiber==='OM3'&&b.m>300)I.push({lvl:'warn',ref:'Fibra',msg:`Tratta ${labs} in OM3: ≈ ${fmt(b.m)} m, oltre i 300 m tipici per 10 Gb/s.`,id:'rk:'+b.a.id});
    if(b.kind==='fo'&&b.fiber==='OM4'&&b.m>400)I.push({lvl:'warn',ref:'Fibra',msg:`Tratta ${labs} in OM4: ≈ ${fmt(b.m)} m, oltre i 400 m tipici per 10 Gb/s.`,id:'rk:'+b.a.id})});
  return I;
};

/* ---------------- QR ---------------- */
function qrText(r){const u=(P.netbox?.url||'').trim().replace(/\/+$/,'');if(u)return `${u}/dcim/racks/?q=${encodeURIComponent(rid(r))}`;
  return `${rid(r)} · ${TYPES[r.type].it} · ${r.type==='CD'?'campus':'edificio '+r.b} · piano ${r.floor} · ${r.units} U${r.note?' · '+r.note:''}`}
function qrSvg(text){if(typeof qrcode!=='function')return '';try{qrcode.stringToBytes=qrcode.stringToBytesFuncs['UTF-8'];const q=qrcode(0,'M');q.addData(text,'Byte');q.make();return q.createSvgTag({cellSize:3,margin:2,scalable:true})}catch(e){return ''}}

/* ---------------- colonna destra: armadio ---------------- */
function logSection(r){
  const L=[...(r.log||[])].sort((a,b)=>b.d.localeCompare(a.d));
  return `<div class="sez"><h3>Registro modifiche <span>${L.length}</span></h3>
  <div class="f"><label>Data</label><input type="text" id="lgD" value="${today()}"></div>
  <div class="f"><label>Autore</label><input type="text" id="lgA" value="${esc(P.author||'')}" placeholder="Nome"></div>
  <textarea id="lgT" placeholder="Cosa è cambiato (es. aggiunto switch PoE, ripermutate le prese C1–C12)…"></textarea>
  <button class="btn piccolo" style="margin-top:6px" data-xa="addLog">Aggiungi al registro</button>
  ${L.map(l=>`<div class="logv"><div class="kv" style="padding:0"><span>${esc(l.d)}${l.a?' · '+esc(l.a):''}</span><button class="btn piccolo trasp rosso" data-xa="delLog" data-id="${l.id}" aria-label="Elimina">✕</button></div><div>${esc(l.t)}</div></div>`).join('')}</div>`;
}
const _rackHtml=rackHtml;
rackHtml=function(r){
  const h=_rackHtml(r);const pw=power(r);const pct=pw.ups?Math.round(pw.load/pw.ups*100):null;
  const poeTot=Object.values(pw.pd).reduce((s,d)=>s+d.w,0);
  let x=`<div class="sez"><h3>Profondità e portata</h3>
  <div class="f"><label>Profondità</label>${sel('depth',rDepth(r),[[300,'300 mm (a muro)'],[450,'450 mm'],[500,'500 mm'],[600,'600 mm'],[800,'800 mm'],[1000,'1000 mm'],[1200,'1200 mm']])}</div>
  <div class="f"><label>Portata</label><div class="um"><input type="number" data-f="cap" min="0" value="${esc(r.cap??'')}" placeholder="${rCap(r)}"><span>kg</span></div></div></div>
  <div class="sez"><h3>Alimentazione e carichi <span>stime</span></h3>
  <div class="kv"><span>Consumo stimato</span><b>${fmt(pw.load,0)} W</b></div>
  <div class="kv"><span>Calore prodotto</span><b>${fmt(pw.btu,0)} BTU/h</b></div>
  <div class="kv"><span>Peso stimato</span><b>${fmt(pw.kg,0)} / ${fmt(rCap(r),0)} kg</b></div>
  ${pw.upsN?`<div class="kv"><span>UPS (${pw.upsN})</span><b>${fmt(pw.ups,0)} W · carico ${pct}%</b></div><div class="kv"><span>Autonomia indicativa</span><b>${pw.run?'≈ '+fmt(pw.run,0)+' min':'—'}</b></div>`:'<div class="kv"><span>UPS</span><b>nessuno</b></div>'}
  ${poeTot?`<div class="kv"><span>Richiesta PoE</span><b>${fmt(poeTot,0)} W</b></div>`:''}
  <p class="piccola">Consumi, pesi e profondità sono stimati dal tipo di apparato e si correggono nei dati tecnici di ciascuno. L'autonomia segue una curva tipica degli UPS da rack.</p></div>
  <div class="sez"><h3>QR targhetta</h3><div class="qrrow"><div class="qr">${qrSvg(qrText(r))}</div><div><p class="piccola" style="margin-top:0">${P.netbox?.url?'Il QR apre l\'armadio in NetBox.':'Il QR contiene i dati dell\'armadio. Imposta l\'indirizzo di NetBox (menu ⋯ → Esporta per NetBox) per fargli aprire l\'armadio in NetBox.'}</p><button class="btn piccolo" data-xa="plate">Stampa targhetta</button></div></div></div>
  ${logSection(r)}`;
  const k=h.indexOf('<div class="sez"><h3>Azioni');return k>0?h.slice(0,k)+x+h.slice(k):h+x;
};
const _itemHtml=itemHtml;
itemHtml=function(r,it){
  let h=_itemHtml(r,it);const s=spec(it),d=s.def;
  if(it.kind==='patch')h=h.replace(/data-port="(\d+)"/g,(m0,n)=>{const pc=r.perm?.[it.id+':'+n];return pc?`${m0} style="box-shadow:inset 0 -4px 0 ${COLORI[pc.col]||COLORI.blu}"`:m0});
  const inp=(f,lab,unit,def)=>`<div class="f"><label>${lab}</label><div class="um"><input type="number" data-f="${f}" min="0" step="any" value="${esc(it.props[f]??'')}" placeholder="${fmt(def)}"><span>${unit}</span></div></div>`;
  let t=`<div class="sez"><h3>Dati tecnici <span>stime modificabili</span></h3>`;
  if(!['patch','fo','cm','blank','shelf','unel','vde','ups'].includes(it.kind))t+=inp('w','Consumo','W',d.w);
  if(it.kind==='ups'&&d.va)t+=inp('va','Potenza','VA',d.va);
  if(it.kind==='sw'||it.kind==='poe')t+=inp('poeb','Budget PoE','W',d.poeb);
  t+=inp('kg','Peso','kg',d.kg)+inp('dep','Profondità','mm',d.dep)+`<p class="piccola">Il segnaposto mostra la stima; inserisci il valore della scheda tecnica per calcoli precisi.</p></div>`;
  if(isSwitchLike(it)){
    const u=swUse(r,it.id),sp=swPorts(it),pd=poeDemand(r)[it.id];let g='';
    for(let n=1;n<=sp.n;n++){const a=u[n];g+=`<button class="pt ${a?'note':''} ${S.swsel&&S.swsel.it===it.id&&S.swsel.n===n?'sel':''}" data-swport="${n}" title="${a?esc(a.map(x=>x.lab).join(', ')):'libera'}" ${a?`style="box-shadow:inset 0 -4px 0 ${COLORI[a[0].pc.col]||COLORI.blu}"`:''}>${swPortName(it,n)}${a?`<br>${esc(a[0].lab)}`:''}</button>`}
    t+=`<div class="sez"><h3>Porte <span>${Object.keys(u).length}/${sp.n} permutate</span></h3><div class="portgrid">${g}</div>${pd?`<div class="kv" style="margin-top:8px"><span>Richiesta PoE</span><b>${fmt(pd.w)} W${s.poeb?' su '+fmt(s.poeb)+' W':''}</b></div>`:''}${S.swsel&&S.swsel.it===it.id&&S.swsel.n<=sp.n&&window.NDC_swEditor?window.NDC_swEditor(r,it,S.swsel.n):'<p class="piccola">Le permutazioni si impostano dalle prese del patch panel; fai clic su una porta per configurarla.</p>'}</div>`;
  }
  return h+t;
};
const _portEditor=portEditor;
portEditor=function(r,it,n,L){
  const h=_portEditor(r,it,n,L);const d=it.ports[n];
  if(it.kind!=='patch'||(d&&d.t==='link'))return h;
  const pc=(r.perm||{})[it.id+':'+n]||{};const sws=r.items.filter(isSwitchLike).sort((a,b)=>b.pos-a.pos);
  let x=`<div class="perm"><b>Permutazione</b>`;
  if(!sws.length)x+=`<p class="piccola">Nessuno switch nell'armadio.</p>`;
  else{
    const sw=sws.find(s=>s.id===pc.it);
    x+=`<div class="f" style="margin-top:8px"><label>Switch</label><select data-px="it"><option value="">— nessuna —</option>${sws.map(s=>`<option value="${s.id}" ${s.id===pc.it?'selected':''}>U${s.pos} · ${esc(nm(s))}</option>`).join('')}</select></div>`;
    if(sw){const u=swUse(r,sw.id);let o='';for(let k=1;k<=swPorts(sw).n;k++){const busy=u[k]&&!u[k].every(q=>q.panel.id===it.id&&q.n===n);o+=`<option value="${k}" ${+pc.n===k?'selected':''}>${swPortName(sw,k)}${busy?' — occupata ('+esc(u[k][0].lab)+')':''}</option>`}
      x+=`<div class="f"><label>Porta</label><select data-px="n">${o}</select></div>
      <div class="f"><label>Bretella</label><select data-px="col">${Object.keys(COLORI).map(c=>`<option ${(pc.col||'blu')===c?'selected':''}>${c}</option>`).join('')}</select></div>
      <div class="f"><label>VLAN</label>${window.NDC_vlanInput?window.NDC_vlanInput(pc.vlan):`<input type="text" data-px="vlan" value="${esc(pc.vlan||'')}" placeholder="es. 10">`}</div>`}
  }
  x+='</div>';
  const k=h.lastIndexOf('</div>');return h.slice(0,k)+x+h.slice(k);
};

/* ---------------- colonna destra: planimetria ---------------- */
const _devHtml=devHtml;
devHtml=function(d,pl){
  const h=_devHtml(d,pl);const p=devPort(d);let info='';
  if(p){const pc=(p.r.perm||{})[p.it.id+':'+p.n];const sw=pc&&p.r.items.find(x=>x.id===pc.it);info=sw?`<div class="kv"><span>Switch</span><b>${esc(nm(sw))} · porta ${swPortName(sw,pc.n)}${pc.vlan?' · VLAN '+esc(pc.vlan):''}</b></div>`:`<div class="kv"><span>Switch</span><b>presa non permutata</b></div>`}
  const x=`<div class="sez"><h3>Alimentazione</h3><div class="f"><label>Consumo</label><div class="um"><input type="number" data-dx="w" min="0" step="any" value="${esc(d.w??'')}" placeholder="${fmt(devW({...d,w:''}))}"><span>W</span></div></div>${info}<p class="piccola">Il consumo degli apparati PoE si somma al budget dello switch a cui la presa è permutata.</p></div>`;
  const k=h.lastIndexOf('<div class="sez"><div class="btnrow">');return k>0?h.slice(0,k)+x+h.slice(k):h+x;
};
const _rackMkHtml=rackMkHtml;
rackMkHtml=function(r,pl){
  const h=_rackMkHtml(r,pl);const bb=backbones(pl).filter(b=>b.a===r||b.b===r);
  if(!bb.length)return h;
  return h+`<div class="sez"><h3>Dorsali <span>${bb.length}</span></h3>${bb.map(b=>{const o=b.a===r?b.b:b.a;return `<div class="kv"><span>${b.kind==='fo'?'Fibra '+(b.fiber||''):'Rame'} → <b class="mono">${esc(rid(o))}</b> · ${b.n} tratt${b.n>1?'e':'a'}</span><b>${b.m!=null?'≈ '+fmt(b.m)+' m':o.loc&&o.loc.plan!==pl.id?'altro piano':'—'}</b></div>`}).join('')}</div>`;
};
const _planHtml=planHtml;
planHtml=function(pl){
  const h=_planHtml(pl);const f=freeFloor(pl.b,pl.floor);const bb=backbones(pl).filter(b=>b.m!=null);
  const x=`<div class="sez"><h3>Prese e dorsali</h3><div class="kv"><span>Prese libere al piano</span><b>${f.free} su ${f.tot}</b></div>${bb.map(b=>`<div class="kv"><span>${b.kind==='fo'?'Fibra':'Rame'} ${esc(rid(b.a,true))} ↔ ${esc(rid(b.b,true))}</span><b>≈ ${fmt(b.m)} m</b></div>`).join('')}</div>`;
  const k=h.indexOf('<div class="sez"><h3>Contenuto');return k>0?h.slice(0,k)+x+h.slice(k):h+x;
};
const _renderPlan=renderPlan;
renderPlan=function(){
  _renderPlan();const pl=PL();const svg=$('#pw svg.cavi');if(!pl||!svg||!P.cables)return;
  let s='';backbones(pl).forEach(b=>{if(!(b.a.loc&&b.b.loc&&b.a.loc.plan===pl.id&&b.b.loc.plan===pl.id))return;
    const col=b.kind==='fo'?'#f28b20':'#8e44ad';const mx=(b.a.loc.x+b.b.loc.x)/2,my=(b.a.loc.y+b.b.loc.y)/2;
    s+=`<line x1="${b.a.loc.x}" y1="${b.a.loc.y}" x2="${b.b.loc.x}" y2="${b.b.loc.y}" stroke="${col}" stroke-width="5" stroke-dasharray="14 8" vector-effect="non-scaling-stroke" opacity=".9"/>`;
    if(b.m!=null)s+=`<text x="${mx}" y="${my}" text-anchor="middle" font-size="${Math.max(pl.w,pl.h)/90}" font-weight="700" fill="${col}" stroke="#fff" stroke-width="${Math.max(pl.w,pl.h)/400}" paint-order="stroke">${b.kind==='fo'?'fibra':'rame'} ≈ ${fmt(b.m,0)} m</text>`});
  svg.insertAdjacentHTML('afterbegin',s);
};

/* ---------------- vista posteriore e sala apparati ---------------- */
const _renderRack=renderRack;
renderRack=function(r){
  $('#stage').classList.toggle('room',!!S.room);
  if(S.room){renderRoom(r);return}
  _renderRack(r);
  if(!S.rear)return;
  const ud=rDepth(r)-100;
  r.items.forEach(it=>{const el=$(`#bay .it[data-id="${it.id}"]`);if(!el)return;const s=spec(it);const pct=Math.min(100,s.dep/ud*100);
    el.classList.add('rear');el.innerHTML=`<i class="ear"></i><div class="fc"><div class="dbar ${s.dep>ud?'over':''}" style="width:${pct}%"></div><span class="rtxt">${fmt(s.dep,0)} mm · ${fmt(s.kg)} kg${s.w?' · '+fmt(s.w,0)+' W':''}</span></div><i class="ear"></i>`});
  const meta=$('.door .meta');if(meta)meta.textContent=`Vista posteriore · profondità ${rDepth(r)} mm (${ud} utili)`;
};
function roomRacks(r){return P.racks.filter(x=>r.type==='CD'?x.type==='CD':(x.type!=='CD'&&x.b===r.b&&+x.floor===+r.floor))}
function renderRoom(r){
  const list=roomRacks(r);const vh=$('#main').getBoundingClientRect().height;const maxU=Math.max(...list.map(x=>x.units));
  const uh=Math.max(8,Math.min(18,Math.floor((vh-170)/maxU)));
  const html=list.map(x=>{const L=panelLetters(x);const I=validate(x);const e=I.filter(i=>i.lvl==='err').length;const pw=power(x);
    let items='';x.items.forEach(it=>{const f=faceHtml(it,'');items+=`<div class="it ${f.cls}" style="bottom:${(it.pos-1)*uh}px;height:${it.h*uh}px" title="${esc(nm(it))} — U${it.pos}">${f.html}</div>`});
    return `<div class="sala-r ${x.id===r.id?'on':''}" data-room="${x.id}" title="Apri ${esc(rid(x))}" style="--uh:${uh}px"><div class="door"><span class="plate">${esc(rid(x))}</span></div>
    <div class="cab"><div class="cab-in" style="grid-template-columns:10px auto 10px"><div></div><div class="bay" style="height:${x.units*uh}px">${items}</div><div></div></div></div>
    <div class="sala-i">${x.units} U · ${fmt(pw.load,0)} W · ${fmt(pw.kg,0)} kg · ${e?`<span style="color:var(--err)">${e} errori</span>`:'conforme'}</div></div>`}).join('');
  $('#stage').innerHTML=`<div class="sala"><div class="sala-t">Sala apparati · ${r.type==='CD'?'armadi di campus':'edificio '+esc(r.b)+' · piano '+r.floor} · ${list.length} armadi — fai clic su un armadio per aprirlo</div><div class="sala-f">${html}</div></div>`;
}
$('#stage').addEventListener('pointerdown',e=>{if(!S.room)return;e.stopPropagation();const rk=e.target.closest('[data-room]');if(rk){S.room=false;S.rack=rk.dataset.room;S.item=null;S.port=null;render()}},true);
const _renderFloat=renderFloat;
renderFloat=function(){
  if(S.view==='campus'){$('#floatBar').innerHTML=`<button class="btn solo-sm" data-act="openLib">Edifici</button><span class="sp"></span><button class="btn piccolo" data-xa="campusReset">Disponi edifici</button>`;return}
  _renderFloat();
  if(S.view==='rack')$('#floatBar').insertAdjacentHTML('beforeend',`<button class="btn piccolo ${S.rear?'on':''}" data-xa="rear">Retro</button><button class="btn piccolo ${S.room?'on':''}" data-xa="room">Sala</button>`);
};

/* ---------------- vista campus ---------------- */
function letters(){const s=new Set(Object.keys(P.buildings||{}));P.racks.forEach(r=>{if(r.type!=='CD')s.add(r.b)});P.plans.forEach(p=>s.add(p.b));return [...s].filter(b=>/^[A-Z]$/.test(b)).sort()}
function nodes(){
  const L=letters();const list=L.map(b=>({k:b,b}));if(P.racks.some(r=>r.type==='CD'))list.push({k:'CD',b:null});
  const n=list.length;list.forEach((o,i)=>{const st=o.k==='CD'?(P.buildings.__cd||{}):(P.buildings[o.k]||{});
    if(has(st.x)){o.x=+st.x;o.y=+st.y}else if(o.k==='CD'){o.x=.5;o.y=.5}else{const a=Math.PI-i*2*Math.PI/Math.max(1,L.length);o.x=.5+.34*Math.cos(a);o.y=.5-.34*Math.sin(a)}});
  return list;
}
function bInfo(b){
  const racks=P.racks.filter(r=>r.type!=='CD'&&r.b===b);const plans=P.plans.filter(p=>p.b===b);
  const floors=[...new Set([...racks.map(r=>+r.floor),...plans.map(p=>+p.floor)])].sort((a,c)=>a-c);
  const err=racks.reduce((s,r)=>s+validate(r).filter(i=>i.lvl==='err').length,0);
  return {racks,plans,floors,err};
}
function interLinks(){
  const key=r=>r.type==='CD'?'CD':r.b;const m={};
  backbones(null).forEach(o=>{const a=key(o.a),b=key(o.b);if(a===b)return;const k=[a,b].sort().join('|');(m[k]??={a,b,n:0,fo:0});m[k].n+=o.n;if(o.kind==='fo')m[k].fo+=o.n});
  return Object.values(m);
}
function ccw(){
  const ns=nodes().filter(o=>o.k!=='CD');if(ns.length<3)return null;
  const cx=ns.reduce((s,o)=>s+o.x,0)/ns.length,cy=ns.reduce((s,o)=>s+o.y,0)/ns.length;
  const ang=o=>Math.atan2(-(o.y-cy),o.x-cx);const a0=ang(ns[0]);
  const order=[...ns].sort((p,q)=>((ang(p)-a0+4*Math.PI)%(2*Math.PI))-((ang(q)-a0+4*Math.PI)%(2*Math.PI)));
  const sorted=ns.map(o=>o.k).sort();const map={};order.forEach((o,i)=>map[o.k]=sorted[i]);
  return {map,ok:order.every((o,i)=>o.k===sorted[i])};
}
function renderCampus(){
  const c=$('#campus');const ns=nodes();const links=interLinks();
  const byK=Object.fromEntries(ns.map(o=>[o.k,o]));
  let svg=links.map(l=>{const a=byK[l.a],b=byK[l.b];if(!a||!b)return '';return `<line x1="${a.x*100}%" y1="${a.y*100}%" x2="${b.x*100}%" y2="${b.y*100}%" stroke="${l.fo?'#f28b20':'#8e44ad'}" stroke-width="3" stroke-dasharray="10 6"/><text x="${(a.x+b.x)*50}%" y="${(a.y+b.y)*50}%" dy="-6" text-anchor="middle" class="cl">${l.n} tratt${l.n>1?'e':'a'}${l.fo?' in fibra':''}</text>`}).join('');
  const card=o=>{
    if(o.k==='CD'){const rs=P.racks.filter(r=>r.type==='CD');return `<div class="bnode cd ${S.bsel==='CD'?'sel':''}" data-bn="CD" style="left:${o.x*100}%;top:${o.y*100}%"><div class="bl">CD</div><div><b>Centro stella di campus</b><small>${rs.map(r=>esc(rid(r))).join(', ')}</small></div></div>`}
    const bi=bInfo(o.k);const st=P.buildings[o.k]||{};
    return `<div class="bnode ${S.bsel===o.k?'sel':''} ${bi.err?'bad':''}" data-bn="${o.k}" style="left:${o.x*100}%;top:${o.y*100}%"><div class="bl">${o.k}</div><div><b>${esc(st.name||'Edificio '+o.k)}</b><small>${bi.floors.length} pian${bi.floors.length===1?'o':'i'} · ${bi.racks.length} armadi · ${bi.plans.length} planimetrie${bi.err?` · <span style="color:var(--err)">${bi.err} errori</span>`:''}</small></div></div>`};
  c.innerHTML=ns.length?`<div class="campus-in" id="cin"><svg class="clinks">${svg}</svg>${ns.map(card).join('')}</div><div class="campus-legenda">Trascina gli edifici per riprodurre la disposizione reale · <span style="color:#f28b20">━ fibra</span> · <span style="color:#8e44ad">━ rame</span></div>`
    :`<div class="plan-vuota"><div class="drop"><h2>Nessun edificio</h2><p>Gli edifici compaiono qui dagli identificativi degli armadi e delle planimetrie, oppure aggiungili dalla colonna a sinistra.</p><button class="btn primario" data-xa="addB">Aggiungi edificio</button></div></div>`;
}
$('#main').insertAdjacentHTML('beforeend','<div class="campus" id="campus" hidden></div>');
$('#campus').addEventListener('pointerdown',e=>{
  const n=e.target.closest('[data-bn]');if(!n||e.button>0)return;e.preventDefault();
  const k=n.dataset.bn;const box=$('#cin').getBoundingClientRect();const x0=e.clientX,y0=e.clientY;const sx=parseFloat(n.style.left)/100,sy=parseFloat(n.style.top)/100;let moved=false,nx=sx,ny=sy;
  const mv=ev=>{if(!moved&&Math.hypot(ev.clientX-x0,ev.clientY-y0)<4)return;moved=true;nx=clamp(sx+(ev.clientX-x0)/box.width,.04,.96);ny=clamp(sy+(ev.clientY-y0)/box.height,.06,.94);n.style.left=nx*100+'%';n.style.top=ny*100+'%'};
  window.addEventListener('pointermove',mv);
  window.addEventListener('pointerup',()=>{window.removeEventListener('pointermove',mv);
    if(!moved){S.bsel=k;S.right='props';render();return}
    mutate(()=>{const key=k==='CD'?'__cd':k;P.buildings[key]={...(P.buildings[key]||{}),x:+nx.toFixed(4),y:+ny.toFixed(4)};S.bsel=k})},{once:true});
});
function campusLeft(){
  const L=letters();let h='<div class="rlist">';
  if(!L.length)h+='<div class="vuoto">Nessun edificio.</div>';
  L.forEach(b=>{const bi=bInfo(b);const st=P.buildings[b]||{};const f=bi.floors.reduce((s,fl)=>{const x=freeFloor(b,fl);return {free:s.free+x.free,tot:s.tot+x.tot}},{free:0,tot:0});
    h+=`<div class="ritem ${S.bsel===b?'on':''}" data-bsel="${b}"><div class="ic BD">${b}</div><div class="grow"><div class="nm" style="font-family:inherit">${esc(st.name||'Edificio '+b)}</div><div class="sub">${bi.floors.length} pian${bi.floors.length===1?'o':'i'} · ${bi.racks.length} armadi · prese libere ${f.free}/${f.tot}</div></div>${bi.err?`<span class="badge err">${bi.err}</span>`:'<span class="badge ok">✓</span>'}</div>`});
  return h+`</div><div style="padding:0 16px 16px"><button class="btn" style="width:100%;justify-content:center" data-xa="addB">+ Nuovo edificio</button></div>`;
}
const _renderLeft=renderLeft;
renderLeft=function(){
  if(S.view!=='campus'){_renderLeft();return}
  $('#leftTabs').innerHTML=`<button class="scheda on">Edifici <span class="badge">${letters().length}</span></button><span class="sp"></span><button class="btn icona trasp solo-sm" data-act="closeLib" aria-label="Chiudi">✕</button>`;
  $('#leftBody').innerHTML=campusLeft();
};
function campusIssues(){
  const I=[];const add=(lvl,ref,msg,id)=>I.push({lvl,ref,msg,id});
  letters().forEach(b=>{const st=P.buildings[b]||{};const bi=bInfo(b);
    if(!st.name)add('info','Edifici',`L'edificio ${b} non ha un nome.`,'b:'+b);
    if(bi.racks.length&&!bi.racks.some(r=>r.type==='BD')&&letters().length>1)add('info','Topologia',`L'edificio ${b} non ha un armadio di edificio (BD).`,'b:'+b);
    if(bi.err)add('warn','Armadi',`Nell'edificio ${b} ci sono ${bi.err} errori negli armadi.`,'b:'+b)});
  const c=ccw();if(c&&!c.ok)add('info','Identificazione armadi',`Le lettere degli edifici non seguono la sequenza antioraria della loro posizione (suggerita: ${Object.entries(c.map).map(([a,b])=>a+'→'+b).join(', ')}).`);
  return I;
}
const _curIssues=curIssues;curIssues=function(){return S.view==='campus'?campusIssues():_curIssues()};
function campusRight(){
  if(S.bsel&&S.bsel!=='CD'&&letters().includes(S.bsel)){
    const b=S.bsel,st=P.buildings[b]||{},bi=bInfo(b);
    const rows=bi.floors.map(fl=>{const rs=bi.racks.filter(r=>+r.floor===fl);const pl=bi.plans.find(p=>+p.floor===fl);const f=freeFloor(b,fl);
      return `<div class="piano"><div class="kv" style="padding:0"><b style="text-align:left">Piano ${fl}</b><span>prese libere ${f.free}/${f.tot}</span></div><div class="btnrow" style="margin-top:6px">${rs.map(r=>`<button class="btn piccolo" data-xa="openRack" data-id="${r.id}">${esc(rid(r))}</button>`).join('')}${pl?`<button class="btn piccolo" data-xa="openPlan" data-id="${pl.id}">▦ ${esc(pl.name)}</button>`:''}</div></div>`}).join('');
    return `<div class="sez"><h3>Edificio<button class="btn piccolo trasp" data-xa="bdesel">← Campus</button></h3>
    <div class="idbox"><div class="big">${b}</div><div class="syn">Lettera dell'edificio negli identificativi (es. B${b}.FA1)</div></div>
    <div class="f"><label>Nome</label><input type="text" data-cb="name" value="${esc(st.name||'')}" placeholder="es. Sede centrale"></div>
    <div class="f"><label>Descrizione</label><input type="text" data-cb="desc" value="${esc(st.desc||'')}" placeholder="Indirizzo, note…"></div>
    <div class="f"><label>Cambia lettera</label>${sel('letter',b,[...Array(26)].map((_,i)=>LET(i)).filter(x=>x===b||!letters().includes(x)),'data-cb')}</div>
    <p class="piccola">Cambiando lettera si aggiornano gli identificativi di armadi, prese e tratte dell'edificio.</p></div>
    <div class="sez"><h3>Piani <span>${bi.floors.length}</span></h3>${rows||'<p class="piccola">Nessun armadio o planimetria in questo edificio.</p>'}
    <div class="btnrow" style="margin-top:10px"><button class="btn piccolo" data-xa="addRackB">+ Armadio in questo edificio</button></div></div>
    <div class="sez"><button class="btn piccolo rosso" data-xa="delB" ${bi.racks.length||bi.plans.length?'disabled title="Prima elimina o sposta armadi e planimetrie"':''}>Elimina edificio</button></div>`;
  }
  const L=letters();const c=ccw();const links=interLinks();
  return `<div class="sez"><h3>Campus</h3><div class="kv"><span>Edifici</span><b>${L.length}</b></div><div class="kv"><span>Armadi</span><b>${P.racks.length}</b></div><div class="kv"><span>Planimetrie</span><b>${P.plans.length}</b></div><div class="kv"><span>Collegamenti tra edifici</span><b>${links.reduce((s,l)=>s+l.n,0)}</b></div></div>
  <div class="sez"><h3>Ordine delle lettere</h3>${!c?'<p class="piccola">Servono almeno tre edifici per suggerire la sequenza antioraria.</p>':c.ok?'<p class="piccola">Le lettere seguono la sequenza antioraria della posizione degli edifici. ✓</p>':`<p class="piccola">Le lettere degli edifici andrebbero assegnate possibilmente in sequenza antioraria secondo la loro posizione. Disponi gli edifici come sono in realtà, poi applica il riordino.</p><div class="kv"><span>Riordino suggerito</span><b class="mono">${Object.entries(c.map).map(([a,b])=>a+'→'+b).join(' ')}</b></div><button class="btn piccolo" data-xa="applyCcw">Applica il riordino</button>`}</div>
  <div class="sez"><p class="piccola">Fai clic su un edificio per nome, descrizione e piani; trascinalo per spostarlo.</p></div>`;
}
const _renderRight=renderRight;
renderRight=function(){
  if(S.view!=='campus'){_renderRight();return}
  $$('[data-rt]').forEach(b=>b.classList.toggle('on',b.dataset.rt===S.right));
  const I=campusIssues();const e=I.filter(i=>i.lvl==='err').length,w=I.filter(i=>i.lvl==='warn').length;
  const ib=$('#issCount');ib.textContent=e+w;ib.className='badge '+(e?'err':w?'warn':'ok');
  $('#rightBody').innerHTML=S.right==='check'?checkHtml(I):campusRight();
};
const _renderFoot=renderFoot;
renderFoot=function(){
  _renderFoot();if(S.view!=='campus')return;
  const f=$('#foot');const sp=f.querySelector('.sp');while(sp&&sp.nextSibling)sp.nextSibling.remove();
  f.insertAdjacentHTML('beforeend',`<span>Campus · <b>${letters().length}</b> edifici · <b>${P.racks.length}</b> armadi</span>`);
};
const _render=render;
render=function(){
  _render();
  const c=$('#campus');c.hidden=S.view!=='campus';
  if(S.view==='campus'){$('#autoBtn').hidden=true;$('#uploadBtn').hidden=true;renderCampus()}
};
function renameLetters(map){
  P.racks.forEach(r=>{if(r.type!=='CD'&&map[r.b])r.b=map[r.b]});
  P.plans.forEach(p=>{if(map[p.b])p.b=map[p.b]});
  const nb={};Object.entries(P.buildings).forEach(([k,v])=>{nb[map[k]||k]=v});P.buildings=nb;
  if(S.bsel&&map[S.bsel])S.bsel=map[S.bsel];
}

/* ---------------- stampa ---------------- */
function permTable(r){const ps=perms(r);if(!ps.length)return '';return `<h2>Permutazioni (${ps.length})</h2><table><tr><th>Presa</th><th>Locale</th><th>Switch</th><th>Porta</th><th>Bretella</th><th>VLAN</th></tr>${ps.map(p=>`<tr><td>${esc(p.lab)}</td><td>${esc(p.panel.ports[p.n]?.note||'')}</td><td>${esc(nm(p.sw))} (U${p.sw.pos})</td><td>${swPortName(p.sw,p.swp)}</td><td>${esc(p.pc.col||'blu')}</td><td>${esc(p.pc.vlan||'')}</td></tr>`).join('')}</table>`}
function extraSheet(r){
  const pw=power(r);
  let h=`<div class="avoid"><h2>Alimentazione, peso e targhetta</h2><table><tr><th>Consumo stimato</th><th>Calore</th><th>Peso</th><th>UPS</th><th>Autonomia indicativa</th></tr><tr><td>${fmt(pw.load,0)} W</td><td>${fmt(pw.btu,0)} BTU/h</td><td>${fmt(pw.kg,0)} / ${fmt(rCap(r),0)} kg</td><td>${pw.upsN?fmt(pw.ups,0)+' W ('+Math.round(pw.load/pw.ups*100)+'%)':'nessuno'}</td><td>${pw.run?'≈ '+fmt(pw.run,0)+' min':'—'}</td></tr></table>
  <div class="targa"><div class="qr">${qrSvg(qrText(r))}</div><div><b>${esc(rid(r))}</b><br>${TYPES[r.type].it} · ${r.type==='CD'?'campus':'edificio '+esc(r.b)} · piano ${r.floor}</div></div></div>`;
  h+=permTable(r);
  if(r.log?.length)h+=`<h2>Registro modifiche</h2><table><tr><th>Data</th><th>Autore</th><th>Modifica</th></tr>${[...r.log].sort((a,b)=>b.d.localeCompare(a.d)).map(l=>`<tr><td>${esc(l.d)}</td><td>${esc(l.a||'')}</td><td>${esc(l.t)}</td></tr>`).join('')}</table>`;
  return h;
}
const _printRack=printRack;
printRack=function(){const wp=window.print;window.print=()=>{};try{_printRack()}finally{window.print=wp}$('#print').insertAdjacentHTML('beforeend',extraSheet(R()));window.print()};
function printPlate(r){$('#print').innerHTML=`<div class="targa grande"><div class="qr">${qrSvg(qrText(r))}</div><div><div class="tg-id">${esc(rid(r))}</div><div>${TYPES[r.type].it} (${r.type})</div><div>${r.type==='CD'?'Campus':'Edificio '+esc(r.b)+(P.buildings[r.b]?.name?' – '+esc(P.buildings[r.b].name):'')} · piano ${r.floor}</div><div>${r.units} U</div></div></div>`;window.print()}
function printCampus(){
  const rows=letters().map(b=>{const bi=bInfo(b);const st=P.buildings[b]||{};return bi.floors.map(fl=>{const f=freeFloor(b,fl);return `<tr><td>${b}</td><td>${esc(st.name||'')}</td><td>${fl}</td><td>${bi.racks.filter(r=>+r.floor===fl).map(r=>esc(rid(r))).join(', ')}</td><td>${bi.plans.filter(p=>+p.floor===fl).map(p=>esc(p.name)).join(', ')}</td><td>${f.free}/${f.tot}</td></tr>`}).join('')}).join('');
  $('#print').innerHTML=`<h1>Campus — ${esc(P.name)}</h1><table><tr><th>Edificio</th><th>Nome</th><th>Piano</th><th>Armadi</th><th>Planimetrie</th><th>Prese libere</th></tr>${rows}</table>`;window.print();
}
const pb=$('#printBtn').onclick;$('#printBtn').onclick=()=>S.view==='campus'?printCampus():pb();

/* ---------------- distinta materiali ---------------- */
function genericName(it){const p=it.props;switch(it.kind){
  case 'patch':return `Patch panel ${p.ports} porte ${p.cls||''}`.trim();case 'fo':return `Cassetto ottico ${p.ports} porte ${p.conn} ${p.fiber}`;
  case 'sw':return `Switch ${p.ports} porte${p.sfp?' + '+p.sfp+' SFP':''}${p.poe?' PoE':''}`;case 'blank':return `Pannello cieco ${it.h} U`;
  case 'shelf':return `Mensola ${fmt(p.real)} U`;case 'unel':return `Multipresa Unel ${p.sockets} prese`;case 'vde':return `PDU ${p.c13} C13${+p.c19?' + '+p.c19+' C19':''}`;
  default:return KINDS[it.kind].name+(p.ports?` ${p.ports} porte`:'')}}
function bom(scope){
  const racks=scope==='rack'?[R()]:P.racks;const ids=new Set(racks.map(r=>r.id));
  const m=new Map();const add=(cat,brand,model,q=1,unit='pz')=>{if(!q)return;const k=cat+'|'+brand+'|'+model;const o=m.get(k)||{cat,brand,model,q:0,unit};o.q+=q;m.set(k,o)};
  racks.forEach(r=>{add('Armadi','—',`Armadio rack 19" ${r.units} U, profondità ${rDepth(r)} mm${r.outdoor?' da esterno':''}`);
    r.items.forEach(it=>{const md=it.props.model&&MODELS[it.props.model];const cat=CAT[KINDS[it.kind].cat].label;md?add(cat,VENDORS[md.v].n,md.m):add(cat,'Generico',genericName(it))});
    perms(r).forEach(p=>add('Bretelle','—',`Bretella RJ45 ${p.pc.col||'blu'}`));
    let wall=0;r.items.filter(i=>i.kind==='patch').forEach(it=>{for(let n=1;n<=+it.props.ports;n++){const pd=it.ports[n];if(pd&&pd.t==='link')continue;if((pd&&pd.note)||devAtPort(r.id,it.id,n))wall++}});
    add('Prese a muro','—','Presa RJ45 a muro (frutto e placca)',wall)});
  let cable=0;
  P.devices.filter(d=>{const p=devPort(d);return scope==='rack'?p&&ids.has(p.r.id):true}).forEach(d=>{const md=d.model&&MODELS[d.model];add('Apparati in campo',md?VENDORS[md.v].n:'Generico',md?md.m:DEV[d.kind].name);const ci=cableInfo(d);if(ci.m)cable+=ci.m});
  if(cable){const tot=Math.ceil(cable*1.1);add('Cavo','—','Cavo in rame per le prese (stima + 10%)',tot,'m');add('Cavo','—','Matasse da 305 m',Math.ceil(tot/305))}
  return [...m.values()].sort((a,b)=>a.cat.localeCompare(b.cat)||a.brand.localeCompare(b.brand)||a.model.localeCompare(b.model));
}
function openBom(scope='project'){
  const rows=bom(scope);
  modal('Distinta materiali',`<div class="btnrow" style="margin-bottom:12px"><div class="seg" style="min-width:300px"><button data-xa="bom" data-v="project" class="${scope==='project'?'on':''}">Tutto il progetto</button><button data-xa="bom" data-v="rack" class="${scope==='rack'?'on':''}">Armadio ${esc(rid(R()))}</button></div><span class="sp" style="flex:1"></span><button class="btn piccolo" data-xa="bomCsv" data-v="${scope}">Scarica CSV</button><button class="btn piccolo" data-xa="bomPrint" data-v="${scope}">Stampa</button></div>
  <table class="tab"><tr><th>Categoria</th><th>Marca</th><th>Articolo</th><th style="text-align:right">Q.tà</th></tr>${rows.map(r=>`<tr><td>${esc(r.cat)}</td><td>${esc(r.brand)}</td><td>${esc(r.model)}</td><td style="text-align:right">${fmt(r.q,0)} ${r.unit}</td></tr>`).join('')}</table>
  <p class="piccola">Quantità ricavate dagli armadi, dalle permutazioni e dagli apparati in planimetria. Il cavo è stimato sulle distanze in pianta (serve la scala).</p>`);
}

/* ---------------- permutazioni (finestra) ---------------- */
function openPerms(){
  const r=R();const ps=perms(r);
  modal('Permutazioni · '+rid(r),`<div class="btnrow" style="margin-bottom:12px"><span class="sp" style="flex:1"></span><button class="btn piccolo" data-xa="permCsv">Scarica CSV</button></div>
  ${ps.length?`<table class="tab"><tr><th>Presa</th><th>Locale</th><th>Switch</th><th>Porta</th><th>Bretella</th><th>VLAN</th></tr>${ps.map(p=>`<tr><td class="mono">${esc(p.lab)}</td><td>${esc(p.panel.ports[p.n]?.note||'')}</td><td>${esc(nm(p.sw))} <span class="piccola">U${p.sw.pos}</span></td><td class="mono">${swPortName(p.sw,p.swp)}</td><td><i class="cdot" style="background:${COLORI[p.pc.col]||COLORI.blu}"></i>${esc(p.pc.col||'blu')}</td><td>${esc(p.pc.vlan||'')}</td></tr>`).join('')}</table>`:'<p>Nessuna permutazione in questo armadio. Seleziona una presa di un patch panel e scegli lo switch e la porta.</p>'}`);
}

/* ---------------- etichette per etichettatrice ---------------- */
function labelRows(o){
  const racks=o.scope==='rack'?[R()]:P.racks;const out=[];
  racks.forEach(r=>{const L=panelLetters(r);
    if(o.armadi)out.push([rid(r),`${TYPES[r.type].it} · piano ${r.floor}`]);
    [...r.items].filter(i=>KINDS[i.kind].term).sort((a,b)=>b.pos-a.pos).forEach(it=>{
      if(o.pannelli)out.push([L[it.id],`${rid(r)} · U${it.pos}`]);
      for(let n=1;n<=+it.props.ports;n++){const pd=it.ports[n];const used=(pd&&pd.note)||devAtPort(r.id,it.id,n);
        if(pd&&pd.t==='link'){if(o.tratte)out.push([linkLabel(r,pd),`${rid(r)} · pannello ${L[it.id]}`]);continue}
        if(it.kind!=='patch'||(o.soloUsate&&!used))continue;
        if(o.muro)out.push([wallLabel(r,it,n,L),pd?.note||'']);
        if(o.armadio)out.push([L[it.id]+n,pd?.note||''])}})});
  return out;
}
function openLabels(){
  modal('Etichette per etichettatrice',`<form id="lbForm" class="lbform">
  <div class="f"><label>Ambito</label><select name="scope"><option value="rack">Armadio ${esc(rid(R()))}</option><option value="project">Tutto il progetto</option></select></div>
  <div class="f"><label>Formato</label><select name="fmt"><option value="ptouch">Brother P-touch Editor (CSV)</option><option value="dymo">Dymo Connect (CSV)</option></select></div>
  <label class="chk"><input type="checkbox" name="muro" checked><span>Prese a muro <small>ABC.DE, es. BA.FA1.C12</small></span></label>
  <label class="chk"><input type="checkbox" name="armadio" checked><span>Prese nell'armadio <small>pannello + numero, es. C12</small></span></label>
  <label class="chk"><input type="checkbox" name="tratte" checked><span>Tratte tra armadi <small>ABC.DEF.G</small></span></label>
  <label class="chk"><input type="checkbox" name="pannelli"><span>Lettere dei pannelli</span></label>
  <label class="chk"><input type="checkbox" name="armadi"><span>Identificativi degli armadi <small>da applicare sulla porta</small></span></label>
  <label class="chk"><input type="checkbox" name="soloUsate"><span>Solo prese usate <small>con locale o posizionate in planimetria</small></span></label>
  <div class="kv" style="margin-top:6px"><span>Etichette</span><b id="lbCount">—</b></div>
  <p class="piccola">In P-touch Editor: <i>File → Database → Connetti</i> e scegli il CSV; in Dymo Connect: <i>Importa dati</i>. La prima colonna è il testo dell'etichetta, la seconda una riga facoltativa.</p>
  <div class="btnrow" style="justify-content:flex-end;margin-top:10px"><button type="button" class="btn" data-close>Chiudi</button><button class="btn primario">Scarica CSV</button></div></form>`,true);
  const f=$('#lbForm');const opts=()=>{const d=new FormData(f);return {scope:d.get('scope'),fmt:d.get('fmt'),muro:!!d.get('muro'),armadio:!!d.get('armadio'),tratte:!!d.get('tratte'),pannelli:!!d.get('pannelli'),armadi:!!d.get('armadi'),soloUsate:!!d.get('soloUsate')}};
  const upd=()=>{$('#lbCount').textContent=labelRows(opts()).length};upd();f.addEventListener('change',upd);
  f.onsubmit=e=>{e.preventDefault();const o=opts();const rows=labelRows(o);if(!rows.length){toast('Nessuna etichetta da esportare');return}
    const head=o.fmt==='dymo'?['Testo','Riga2']:['Etichetta','Riga2'];download(`${slug(P.name)}-etichette-${o.fmt}.csv`,csv([head,...rows],','),'text/csv;charset=utf-8');toast(`${rows.length} etichette esportate`)};
}

/* ---------------- esportazione per NetBox ---------------- */
const nbSlug=s=>String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100)||'x';
const ROLE={patch:['Patch panel','9e9e9e'],fo:['Cassetto ottico','ff9800'],sw:['Switch','2196f3'],fw:['Firewall','f44336'],router:['Router','673ab7'],srv:['Server','4caf50'],ups:['UPS','795548'],vde:['PDU','607d8b'],unel:['PDU','607d8b'],poe:['PDU','607d8b'],hub:['Apparato attivo','00bcd4'],mc:['Apparato attivo','00bcd4']};
function nbType(it){
  const md=it.props.model&&MODELS[it.props.model];const p=it.props;
  if(md)return {man:VENDORS[md.v].n.split(' / ')[0],model:md.m,h:md.h};
  let model=KINDS[it.kind].name;if(['patch','fo','sw','fw','router','hub','mc','poe'].includes(it.kind)&&p.ports)model+=` ${p.ports}p`;
  if(it.kind==='sw'&&+p.sfp)model+=` + ${p.sfp} SFP`;if(it.kind==='sw'&&p.poe)model+=' PoE';if(it.kind==='fo')model+=` ${p.conn} ${p.fiber}`;if(it.kind==='patch')model+=` ${p.cls||''}`;
  return {man:'Generico',model:model.trim(),h:it.h};
}
const fpType=it=>it.kind==='fo'?(it.props.conn||'lc').toLowerCase():'8p8c';
function nbDevName(r,it,L){return (L[it.id]?`${rid(r)} pannello ${L[it.id]}`:`${rid(r)} U${it.pos} ${it.name||KINDS[it.kind].name}`).slice(0,64)}
const nbItems=r=>r.items.filter(i=>ROLE[i.kind]);
function locName(r){if(r.type==='CD')return 'Campus';const st=P.buildings[r.b]||{};return `Edificio ${r.b}${st.name?' – '+st.name:''} – Piano ${r.floor}`}
function bldName(b){const st=P.buildings[b]||{};return `Edificio ${b}${st.name?' – '+st.name:''}`}
function netbox(){
  const site=(P.netbox?.site||P.name||'Sede').trim();const out={};
  const types=new Map();P.racks.forEach(r=>nbItems(r).forEach(it=>{const t=nbType(it);const k=t.man+'|'+t.model;if(!types.has(k))types.set(k,{...t,it})}));
  const mans=[...new Set([...types.values()].map(t=>t.man))];
  out['1-produttori.csv']=csv([['name','slug'],...mans.map(m=>[m,nbSlug(m)])],',');
  const roles=[...new Map(Object.values(ROLE).map(r=>[r[0],r])).values()];
  out['2-ruoli.csv']=csv([['name','slug','color'],...roles.map(r=>[r[0],nbSlug(r[0]),r[1]])],',');
  out['3-tipi-dispositivo.yaml']=[...types.values()].map(t=>{const it=t.it;let y=`manufacturer: ${JSON.stringify(t.man)}\nmodel: ${JSON.stringify(t.model)}\nslug: ${nbSlug(t.man+'-'+t.model)}\nu_height: ${t.h}\nis_full_depth: ${spec(it).dep>400}\n`;
    if(it.kind==='patch'||it.kind==='fo'){const n=+it.props.ports,ty=fpType(it);y+='rear-ports:\n'+Array.from({length:n},(_,i)=>`  - name: R${i+1}\n    type: ${ty}\n    positions: 1\n`).join('')+'front-ports:\n'+Array.from({length:n},(_,i)=>`  - name: '${i+1}'\n    type: ${ty}\n    rear_port: R${i+1}\n    rear_port_position: 1\n`).join('')}
    else if(isSwitchLike(it)){const sp=swPorts(it);y+='interfaces:\n'+Array.from({length:sp.n},(_,i)=>`  - name: '${swPortName(it,i+1)}'\n    type: ${i<sp.rj?'1000base-t':'10gbase-x-sfpp'}\n`).join('')}
    return y}).join('---\n');
  out['4-sito.csv']=csv([['name','slug','status','description'],[site,nbSlug(site),'active',P.name]],',');
  const locs=[['site','parent','name','slug','status']];const seenL=new Set();
  P.racks.forEach(r=>{if(r.type==='CD'){if(!seenL.has('CD')){seenL.add('CD');locs.push([site,'','Campus',nbSlug('campus'),'active'])}return}
    const bn=bldName(r.b);if(!seenL.has(bn)){seenL.add(bn);locs.push([site,'',bn,nbSlug(bn),'active'])}
    const ln=locName(r);if(!seenL.has(ln)){seenL.add(ln);locs.push([site,bn,ln,nbSlug(ln),'active'])}});
  out['5-location.csv']=csv(locs,',');
  out['6-armadi.csv']=csv([['site','location','name','status','width','u_height','description'],...P.racks.map(r=>[site,locName(r),rid(r),'active',19,r.units,`${TYPES[r.type].it}${r.note?' – '+r.note:''}`])],',');
  const dev=[['name','role','manufacturer','device_type','site','location','rack','position','face','status','description']];
  P.racks.forEach(r=>{const L=panelLetters(r);nbItems(r).forEach(it=>{const t=nbType(it);dev.push([nbDevName(r,it,L),ROLE[it.kind][0],t.man,t.model,site,locName(r),rid(r),it.pos,'front','active',it.kind==='patch'||it.kind==='fo'?`Pannello ${L[it.id]}`:''])})});
  out['7-dispositivi.csv']=csv(dev,',');
  const cab=[['side_a_device','side_a_type','side_a_name','side_b_device','side_b_type','side_b_name','type','status','label','color','description']];
  P.racks.forEach(r=>{const L=panelLetters(r);
    perms(r).forEach(p=>cab.push([nbDevName(r,p.panel,L),'dcim.frontport',String(p.n),nbDevName(r,p.sw,L),'dcim.interface',swPortName(p.sw,p.swp),'cat6','connected',p.lab,(COLORI[p.pc.col]||COLORI.blu).slice(1),p.pc.vlan?'VLAN '+p.pc.vlan:'']));
    r.items.filter(i=>KINDS[i.kind].term).forEach(it=>Object.entries(it.ports).forEach(([n,pd])=>{if(pd.t!=='link')return;const rem=rackById(pd.r);if(!rem||!linkFromIsThis(r,rem,pd.flip))return;const lab=linkLabel(r,pd);
      let hit=null;rem.items.filter(x=>KINDS[x.kind].term).some(x=>Object.entries(x.ports).some(([m,q])=>{if(q.t==='link'&&q.r===r.id&&linkLabel(rem,q)===lab){hit={x,m};return true}return false}));
      if(!hit)return;const LR=panelLetters(rem);const ty=it.kind==='fo'?(it.props.fiber==='OS2'?'smf':it.props.fiber==='OM3'?'mmf-om3':'mmf-om4'):'cat6';
      cab.push([nbDevName(r,it,L),'dcim.rearport','R'+n,nbDevName(rem,hit.x,LR),'dcim.rearport','R'+hit.m,ty,'connected',lab,'','Tratta tra armadi'])}))});
  out['8-cavi.csv']=csv(cab,',');
  return out;
}
function openNetbox(){
  const files=netbox();
  modal('Esporta per NetBox',`<div class="f"><label>Nome del sito</label><input type="text" data-nb="site" value="${esc(P.netbox?.site||'')}" placeholder="${esc(P.name)}"></div>
  <div class="f"><label>Indirizzo NetBox</label><input type="text" data-nb="url" value="${esc(P.netbox?.url||'')}" placeholder="https://netbox.esempio.it"></div>
  <p class="piccola">L'indirizzo serve al QR delle targhette, che così apre l'armadio direttamente in NetBox.</p>
  <table class="tab" style="margin-top:12px"><tr><th>Ordine</th><th>File</th><th>Dove importarlo in NetBox</th><th></th></tr>
  ${Object.entries(files).map(([n,c])=>{const where={'1':'Dispositivi → Produttori','2':'Dispositivi → Ruoli dei dispositivi','3':'Dispositivi → Tipi di dispositivo (YAML)','4':'Organizzazione → Siti','5':'Organizzazione → Location','6':'Organizzazione → Rack','7':'Dispositivi → Dispositivi','8':'Connessioni → Cavi'}[n[0]];const rows=n.endsWith('.csv')?c.split('\r\n').length-1:(c.match(/^manufacturer:/gm)||[]).length;
    return `<tr><td>${n[0]}</td><td class="mono">${n.slice(2)}<br><span class="piccola">${rows} righe</span></td><td>${where}</td><td><button class="btn piccolo" data-xa="nbFile" data-v="${n}">Scarica</button></td></tr>`}).join('')}</table>
  <div class="btnrow" style="justify-content:flex-end;margin-top:12px"><button class="btn primario" data-xa="nbAll">Scarica tutti</button></div>
  <p class="piccola">Importa i file nell'ordine indicato con <i>Importa</i> in ciascuna sezione di NetBox. I patch panel e i cassetti ottici hanno porte frontali e posteriori 1:1; le permutazioni diventano cavi presa → interfaccia, le tratte tra armadi cavi tra porte posteriori.</p>`);
}

/* ---------------- eventi ---------------- */
$('#rightBody').addEventListener('change',e=>{
  const t=e.target;
  if(t.dataset.px){const r=R();const it=r.items.find(i=>i.id===S.item);if(!it)return;const key=it.id+':'+S.port;
    mutate(()=>{r.perm??={};const pc=r.perm[key]||(r.perm[key]={it:'',n:1,col:'blu',vlan:''});
      if(t.dataset.px==='it'){if(!t.value){delete r.perm[key];return}const sw=r.items.find(x=>x.id===t.value);pc.it='';const u=swUse(r,sw.id);pc.it=t.value;let k=1;while(k<=swPorts(sw).n&&u[k])k++;pc.n=k>swPorts(sw).n?1:k}
      else if(t.dataset.px==='n')pc.n=+t.value;else pc[t.dataset.px]=t.value.trim()});return}
  if(t.dataset.dx){const d=mkObj(S.mk);if(d)mutate(()=>{d.w=t.value===''?'':num(t.value,0)});return}
  if(t.dataset.cb){const b=S.bsel;const v=t.value.trim();
    if(t.dataset.cb==='letter'){if(v!==b&&confirm(`Cambiare la lettera dell'edificio da ${b} a ${v}? Cambiano gli identificativi di armadi, prese e tratte.`))mutate(()=>renameLetters({[b]:v}));else render();return}
    mutate(()=>{P.buildings[b]={...(P.buildings[b]||{}),[t.dataset.cb]:v}})}
});
$('#modal').addEventListener('change',e=>{const t=e.target;if(t.dataset.nb){mutate(()=>{P.netbox[t.dataset.nb]=t.value.trim()});openNetbox()}});
$('#leftBody').addEventListener('click',e=>{const b=e.target.closest('[data-bsel]');if(b){S.bsel=b.dataset.bsel;S.right='props';render();document.body.classList.remove('lib')}});
document.addEventListener('click',e=>{
  const sp=e.target.closest('[data-swport]');
  if(sp){const n=+sp.dataset.swport;S.swsel=S.swsel&&S.swsel.it===S.item&&S.swsel.n===n?null:{it:S.item,n};renderRight();return}
  const gp=e.target.closest('[data-xa=goPort]');if(gp){const r=R();const sw=r.items.find(i=>i.id===S.item);const a=sw&&swUse(r,sw.id)[+gp.dataset.n];if(a){S.item=a[0].panel.id;S.port=a[0].n;S.swsel=null;render()}return}
  const el=e.target.closest('[data-xa]');if(!el)return;e.preventDefault();
  const a=el.dataset.xa,r=R();
  switch(a){
    case 'rear':S.rear=!S.rear;S.room=false;render();break;
    case 'room':S.room=!S.room;S.rear=false;render();break;
    case 'plate':printPlate(r);break;
    case 'addLog':{const t=$('#lgT').value.trim();if(!t){toast('Scrivi la modifica da registrare');break}const d=$('#lgD').value.trim()||today(),au=$('#lgA').value.trim();mutate(()=>{r.log.push({id:uid(),d,a:au,t});P.author=au})}break;
    case 'delLog':if(confirm('Eliminare questa voce del registro?'))mutate(()=>{r.log=r.log.filter(l=>l.id!==el.dataset.id)});break;
    case 'bom':openBom(el.dataset.v);break;
    case 'bomCsv':{const rows=bom(el.dataset.v);download(`${slug(P.name)}-distinta.csv`,csv([['Categoria','Marca','Articolo','Quantità','Unità'],...rows.map(x=>[x.cat,x.brand,x.model,x.q,x.unit])]),'text/csv;charset=utf-8')}break;
    case 'bomPrint':{const rows=bom(el.dataset.v);closeModal();$('#print').innerHTML=`<h1>Distinta materiali — ${esc(P.name)}</h1><div>${el.dataset.v==='rack'?'Armadio '+esc(rid(r)):'Tutto il progetto'} · ${new Date().toLocaleDateString('it-IT')}</div><table><tr><th>Categoria</th><th>Marca</th><th>Articolo</th><th>Q.tà</th></tr>${rows.map(x=>`<tr><td>${esc(x.cat)}</td><td>${esc(x.brand)}</td><td>${esc(x.model)}</td><td>${fmt(x.q,0)} ${x.unit}</td></tr>`).join('')}</table>`;window.print()}break;
    case 'permCsv':download(`${slug(rid(r))}-permutazioni.csv`,csv([['Presa','Locale','Switch','U','Porta','Bretella','VLAN'],...perms(r).map(p=>[p.lab,p.panel.ports[p.n]?.note||'',nm(p.sw),p.sw.pos,swPortName(p.sw,p.swp),p.pc.col||'blu',p.pc.vlan||''])]),'text/csv;charset=utf-8');break;
    case 'nbFile':{const n=el.dataset.v;download(n.slice(2),netbox()[n],n.endsWith('.yaml')?'text/yaml':'text/csv;charset=utf-8')}break;
    case 'nbAll':{const f=netbox();Object.entries(f).forEach(([n,c],i)=>setTimeout(()=>download(n.slice(2),c,n.endsWith('.yaml')?'text/yaml':'text/csv;charset=utf-8'),i*450));toast('Download dei file per NetBox avviato')}break;
    case 'addB':{const used=new Set(letters());let i=0;while(used.has(LET(i)))i++;const b=LET(i);mutate(()=>{P.buildings[b]={...(P.buildings[b]||{}),name:''};S.bsel=b;S.view='campus'})}break;
    case 'bdesel':S.bsel=null;render();break;
    case 'openRack':S.view='rack';S.rack=el.dataset.id;S.item=null;S.room=false;render();break;
    case 'openPlan':S.view='plan';S.plan=el.dataset.id;S.mk=null;render();break;
    case 'addRackB':mutate(()=>{const nr=newRack({b:S.bsel,type:'FD',floor:bInfo(S.bsel).floors[0]??0});nr.log=[];nr.perm={};P.racks.push(nr);S.rack=nr.id;S.view='rack';S.item=null});break;
    case 'delB':mutate(()=>{delete P.buildings[S.bsel];S.bsel=null});break;
    case 'applyCcw':{const c=ccw();if(c&&confirm('Rinominare le lettere degli edifici in senso antiorario? Cambiano gli identificativi di armadi, prese e tratte.'))mutate(()=>renameLetters(c.map))}break;
    case 'campusReset':mutate(()=>{Object.values(P.buildings).forEach(v=>{delete v.x;delete v.y})});break;
  }
});
$('#moreMenu .menu-lista').addEventListener('click',e=>{const m=e.target.closest('[data-m]')?.dataset.m;
  ({perms:openPerms,bom:()=>openBom('project'),labels:openLabels,netbox:openNetbox,campus:()=>{S.view='campus';render()}})[m]?.()});

/* ---------------- avvio ---------------- */
window.NDC={perms,swUse,swPorts,swPortName,isSwitchLike,spec,power,backbones,extraSheet,qrSvg,qrText,csv,letters,bInfo,COLORI,normX};
(function go(){if(!P){setTimeout(go,30);return}normX(P);render()})();
})();
