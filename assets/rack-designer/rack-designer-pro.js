/* =====================================================================
   Network Design Center — strumenti professionali
   • piano VLAN e indirizzi IP, modalità delle porte switch, script RouterOS
   • planimetria: campo visivo delle telecamere, copertura Wi-Fi, muri,
     percorsi reali dei cavi, righello
   • inventario: seriale, MAC, asset tag, IP, foto; CSV per Snipe-IT
   • certificazioni dei cavi (Fluke LinkWare)
   • modelli di armadio, salvataggio su GitHub Gist
   Si aggancia a rack-designer.js e rack-designer-extra.js (window.NDC).
   ===================================================================== */
(function(){
'use strict';
const X=window.NDC;
const num=(v,d)=>{const n=parseFloat(String(v??'').replace(',','.'));return isFinite(n)?n:d};
const has=v=>v!==undefined&&v!==null&&v!=='';
const today=()=>new Date().toISOString().slice(0,10);

/* ---------------- dati ---------------- */
function normP(p){if(!p)return p;p.vlans??=[];p.templates??=[];(p.racks||[]).forEach(r=>{r.swcfg??={};r.photos??=[]});(p.plans||[]).forEach(pl=>{pl.walls??=[]});return p}
const _normalize=normalize;normalize=function(p){return normP(_normalize(p))};
const _blank=blankProject;blankProject=function(){_blank();normP(P)};

/* ---------------- indirizzi IP ---------------- */
function ip2n(s){const m=String(s||'').trim().match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);if(!m)return null;const a=m.slice(1).map(Number);if(a.some(x=>x>255))return null;return ((a[0]<<24)>>>0)+(a[1]<<16)+(a[2]<<8)+a[3]}
function cidr(s){const m=String(s||'').trim().match(/^([\d.]+)\/(\d{1,2})$/);if(!m)return null;const ip=ip2n(m[1]);const pre=+m[2];if(ip==null||pre>32)return null;const mask=pre?((0xffffffff<<(32-pre))>>>0):0;return {net:(ip&mask)>>>0,mask,pre,bcast:((ip&mask)|(~mask>>>0))>>>0}}
const inNet=(ip,c)=>c&&ip!=null&&((ip&c.mask)>>>0)===c.net;
const vlanBy=vid=>P.vlans.find(v=>+v.vid===+vid);
const mgmtVlan=()=>P.vlans.find(v=>v.mgmt);
function vlanIssues(){
  const I=[];const add=(lvl,msg)=>I.push({lvl,ref:'VLAN e indirizzi',msg});
  const seen={};P.vlans.forEach(v=>{if(!(+v.vid>=1&&+v.vid<=4094))add('err',`VLAN «${v.name||v.vid}»: l'ID deve essere tra 1 e 4094.`);if(seen[v.vid])add('err',`VLAN ${v.vid} definita due volte.`);seen[v.vid]=1;
    const c=cidr(v.subnet);if(v.subnet&&!c)add('warn',`VLAN ${v.vid}: la subnet «${v.subnet}» non è nel formato 192.168.10.0/24.`);
    if(c&&v.gw){const g=ip2n(v.gw);if(g==null)add('warn',`VLAN ${v.vid}: gateway «${v.gw}» non valido.`);else if(!inNet(g,c)||g===c.net||g===c.bcast)add('err',`VLAN ${v.vid}: il gateway ${v.gw} non è un indirizzo utilizzabile della subnet ${v.subnet}.`)}});
  for(let i=0;i<P.vlans.length;i++)for(let j=i+1;j<P.vlans.length;j++){const a=cidr(P.vlans[i].subnet),b=cidr(P.vlans[j].subnet);if(a&&b&&(inNet(a.net,b)||inNet(b.net,a)))add('err',`Le subnet delle VLAN ${P.vlans[i].vid} (${P.vlans[i].subnet}) e ${P.vlans[j].vid} (${P.vlans[j].subnet}) si sovrappongono.`)}
  return I;
}

/* ---------------- porte switch ---------------- */
function swCfg(r,sw,n){
  const c=r.swcfg?.[sw.id]?.[n];if(c)return {mode:c.mode||'access',pvid:+c.pvid||1,tagged:(c.tagged||[]).map(Number),explicit:true};
  const sp=X.swPorts(sw);const u=X.swUse(r,sw.id)[n];
  if(u&&has(u[0].pc.vlan))return {mode:'access',pvid:+u[0].pc.vlan||1,tagged:[]};
  if(n>sp.rj)return {mode:'trunk',pvid:1,tagged:P.vlans.map(v=>+v.vid).filter(v=>v!==1)};
  return {mode:'access',pvid:1,tagged:[]};
}
function vlanOpts(val,withNone){const list=[...P.vlans].sort((a,b)=>a.vid-b.vid);let o=withNone?`<option value="">— nessuna —</option>`:'';if(!withNone&&!vlanBy(1))o+=`<option value="1" ${+val===1?'selected':''}>1 · predefinita</option>`;
  o+=list.map(v=>`<option value="${v.vid}" ${String(v.vid)===String(val)?'selected':''}>${v.vid} · ${esc(v.name||'')}</option>`).join('');
  if(has(val)&&!list.some(v=>String(v.vid)===String(val))&&!(+val===1&&!withNone))o+=`<option value="${esc(val)}" selected>${esc(val)} (non definita)</option>`;return o}
window.NDC_vlanInput=val=>P.vlans.length?`<select data-px="vlan">${vlanOpts(val,true)}</select>`:`<input type="text" data-px="vlan" value="${esc(val||'')}" placeholder="es. 10">`;
window.NDC_swEditor=(r,sw,n)=>{
  const c=swCfg(r,sw,n);const u=X.swUse(r,sw.id)[n];
  return `<div class="pedit"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b>Porta ${X.swPortName(sw,n)} · ${esc(ifName(sw,n))}</b>${u?`<button class="btn piccolo" data-xa="goPort" data-n="${n}">Presa ${esc(u[0].lab)}</button>`:''}</div>
  <div class="seg" data-swm="${n}" style="margin-bottom:10px"><button data-v="access" class="${c.mode==='access'?'on':''}">Accesso</button><button data-v="trunk" class="${c.mode==='trunk'?'on':''}">Trunk</button></div>
  <div class="f"><label>${c.mode==='trunk'?'VLAN nativa':'VLAN'}</label>${P.vlans.length?`<select data-swp="${n}">${vlanOpts(c.pvid,false)}</select>`:`<input type="number" min="1" max="4094" data-swp="${n}" value="${c.pvid}">`}</div>
  ${c.mode==='trunk'?(P.vlans.length?`<div class="vchk">${[...P.vlans].sort((a,b)=>a.vid-b.vid).filter(v=>+v.vid!==c.pvid).map(v=>`<label class="chk"><input type="checkbox" data-swt="${n}" value="${v.vid}" ${c.tagged.includes(+v.vid)?'checked':''}><span><i class="cdot" style="background:${esc(v.color||'#888')}"></i>${v.vid} ${esc(v.name||'')}</span></label>`).join('')}</div>`:'<p class="piccola">Definisci le VLAN (menu ⋯ → VLAN e indirizzi) per scegliere quelle tagged.</p>'):''}
  ${c.explicit?`<button class="btn piccolo trasp" data-xa="swReset" data-n="${n}">Torna alla configurazione automatica</button>`:'<p class="piccola">Configurazione automatica: VLAN della presa permutata; le porte SFP sono trunk con tutte le VLAN.</p>'}</div>`;
};
function setSw(r,sw,n,fn){r.swcfg??={};const cur=swCfg(r,sw,n);const c=(r.swcfg[sw.id]??={})[n]={mode:cur.mode,pvid:cur.pvid,tagged:[...cur.tagged]};fn(c)}
function ifName(sw,n){const sp=X.swPorts(sw);if(n<=sp.rj)return 'ether'+n;const m=sw.props.model&&MODELS[sw.props.model];const k=n-sp.rj;const t=m?m.m:'';
  if(/XQ|2Q\+/.test(t)){const q=/XQ/.test(t)?2:2;if(k>sp.sfp-q)return (/XQ/.test(t)?'qsfp28-':'qsfpplus')+(k-(sp.sfp-q))+'-1'}
  if(/XS/.test(t))return 'sfp28-'+k;return 'sfp-sfpplus'+k}
function routeros(r,sw){
  const sp=X.swPorts(sw);const L=[];const vids=new Set();const cfg={};
  for(let n=1;n<=sp.n;n++){cfg[n]=swCfg(r,sw,n);vids.add(cfg[n].pvid);cfg[n].tagged.forEach(v=>vids.add(v))}
  const perms=X.perms(r).filter(p=>p.sw.id===sw.id);const com=n=>{const p=perms.find(q=>q.swp===n);return p?`${p.lab}${p.panel.ports[p.n]?.note?' '+p.panel.ports[p.n].note:''}`:''};
  L.push(`# Network Design Center — configurazione VLAN`,`# Switch: ${nm(sw)} · armadio ${rid(r)} U${sw.pos}`,`# Generata il ${new Date().toLocaleString('it-IT')} dal progetto «${P.name}»`,`# Verifica i nomi delle interfacce e applica da console: la configurazione attiva il VLAN filtering.`,'');
  L.push('/interface bridge','add name=bridge1 vlan-filtering=no comment="NDC"','','/interface bridge port');
  for(let n=1;n<=sp.n;n++){const c=cfg[n];const cm=com(n);L.push(`add bridge=bridge1 interface=${ifName(sw,n)} pvid=${c.pvid} frame-types=${c.mode==='access'?'admit-only-untagged-and-priority-tagged':c.tagged.length?'admit-all':'admit-only-untagged-and-priority-tagged'}${cm?` comment="${cm.replace(/"/g,"'")}"`:''}`)}
  L.push('','/interface bridge vlan');
  const mg=mgmtVlan();
  [...vids].sort((a,b)=>a-b).forEach(v=>{const un=[],tg=['bridge1'];for(let n=1;n<=sp.n;n++){const c=cfg[n];if(c.pvid===v)un.push(ifName(sw,n));else if(c.mode==='trunk'&&c.tagged.includes(v))tg.push(ifName(sw,n))}
    if(v===1&&!vlanBy(1)&&un.length===0&&tg.length===1)return;
    const vv=vlanBy(v);L.push(`add bridge=bridge1 vlan-ids=${v} tagged=${tg.join(',')}${un.length?' untagged='+un.join(','):''}${vv?.name?` comment="${vv.name.replace(/"/g,"'")}"`:''}`)});
  if(mg&&sw.props.ip){const c=cidr(mg.subnet);L.push('','# Gestione',`/interface vlan add interface=bridge1 name=vlan${mg.vid}-gestione vlan-id=${mg.vid}`,`/ip address add address=${sw.props.ip}/${c?c.pre:24} interface=vlan${mg.vid}-gestione`);if(mg.gw)L.push(`/ip route add gateway=${mg.gw}`)}
  else if(mg)L.push('',`# Imposta l'IP di gestione dello switch nei suoi dati di inventario per aggiungere l'indirizzo sulla VLAN ${mg.vid}.`);
  L.push('','/interface bridge set bridge1 vlan-filtering=yes');
  return L.join('\n');
}
function portTable(r,sw){const sp=X.swPorts(sw);const perms=X.perms(r).filter(p=>p.sw.id===sw.id);const rows=[];for(let n=1;n<=sp.n;n++){const c=swCfg(r,sw,n);const p=perms.find(q=>q.swp===n);rows.push([X.swPortName(sw,n),c.mode==='access'?'accesso':'trunk',c.pvid,c.mode==='trunk'?c.tagged.join(' '):'',p?p.lab:'',p?.panel.ports[p.n]?.note||''])}return rows}
function allSwitches(){const out=[];P.racks.forEach(r=>[...r.items].filter(X.isSwitchLike).sort((a,b)=>b.pos-a.pos).forEach(it=>out.push({r,it})));return out}
function openSwConfig(key){
  const list=allSwitches();if(!list.length){toast('Nessuno switch nel progetto');return}
  const sel0=list.find(x=>x.it.id===key)||list.find(x=>x.r.id===S.rack)||list[0];
  const isMk=sel0.it.props.model&&MODELS[sel0.it.props.model]?.v==='mikrotik';
  const rows=portTable(sel0.r,sel0.it);
  modal('Configurazione switch',`<div class="f"><label>Switch</label><select id="swPick">${list.map(x=>`<option value="${x.it.id}" ${x===sel0?'selected':''}>${esc(rid(x.r))} · U${x.it.pos} · ${esc(nm(x.it))}</option>`).join('')}</select></div>
  <h4 style="margin:14px 0 6px">Porte</h4><table class="tab"><tr><th>Porta</th><th>Modalità</th><th>VLAN</th><th>Tagged</th><th>Presa</th><th>Locale</th></tr>${rows.map(r=>`<tr>${r.map((c,i)=>`<td class="${i===0||i===4?'mono':''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</table>
  <div class="btnrow" style="margin:10px 0 16px"><button class="btn piccolo" data-xa="swCsv" data-id="${sel0.it.id}">Scarica tabella CSV</button></div>
  <h4 style="margin:14px 0 6px">Script RouterOS ${isMk?'':'<span class="piccola">(per switch MikroTik; per gli altri usa la tabella)</span>'}</h4>
  <textarea id="rosTxt" class="mono" style="height:260px;font-size:12.5px" readonly>${esc(routeros(sel0.r,sel0.it))}</textarea>
  <div class="btnrow" style="margin-top:8px"><button class="btn piccolo" data-xa="rosCopy">Copia</button><button class="btn piccolo" data-xa="rosDl" data-id="${sel0.it.id}">Scarica .rsc</button></div>
  <p class="piccola">Lo script crea un bridge con VLAN filtering: porte in accesso dalla VLAN della presa, porte SFP in trunk, indirizzo di gestione sulla VLAN segnata come gestione. Provalo prima su uno switch di test e tieni un accesso di emergenza (porta di gestione o MAC-telnet).</p>`);
  $('#swPick').onchange=e=>openSwConfig(e.target.value);
}
function openVlans(){
  const I=vlanIssues();const list=[...P.vlans].sort((a,b)=>a.vid-b.vid);
  modal('VLAN e indirizzi',`<table class="tab vtab"><tr><th>ID</th><th>Nome</th><th>Colore</th><th>Subnet</th><th>Gateway</th><th title="VLAN di gestione degli apparati">Gestione</th><th></th></tr>
  ${list.map(v=>`<tr><td><input type="number" min="1" max="4094" data-vl="vid" data-id="${v.id}" value="${esc(v.vid)}" style="width:72px"></td><td><input type="text" data-vl="name" data-id="${v.id}" value="${esc(v.name||'')}" placeholder="es. Didattica"></td><td><input type="color" data-vl="color" data-id="${v.id}" value="${esc(v.color||'#1f6feb')}"></td><td><input type="text" data-vl="subnet" data-id="${v.id}" value="${esc(v.subnet||'')}" placeholder="10.10.10.0/24"></td><td><input type="text" data-vl="gw" data-id="${v.id}" value="${esc(v.gw||'')}" placeholder="10.10.10.1"></td><td style="text-align:center"><input type="radio" name="mgmt" data-vl="mgmt" data-id="${v.id}" ${v.mgmt?'checked':''}></td><td><button class="btn piccolo trasp rosso" data-xa="vlDel" data-id="${v.id}" aria-label="Elimina">✕</button></td></tr>`).join('')}</table>
  <div class="btnrow" style="margin-top:10px"><button class="btn piccolo" data-xa="vlAdd">+ Aggiungi VLAN</button><button class="btn piccolo" data-xa="swCfg">Configurazione switch…</button></div>
  ${I.length?`<div style="margin-top:14px">${I.map(i=>`<div style="display:flex;gap:8px;margin-bottom:6px"><i class="dot ${i.lvl}"></i><span>${esc(i.msg)}</span></div>`).join('')}</div>`:list.length?'<p class="piccola" style="margin-top:12px">Nessun problema nelle VLAN. ✓</p>':''}
  <p class="piccola">Le VLAN si assegnano alle prese nella permutazione; le porte degli switch le ricevono in automatico o si configurano a mano selezionando la porta dello switch.</p>`);
}

/* ---------------- validazioni ---------------- */
const _validate=validate;
validate=function(r){
  const I=_validate(r);if(!r.items.length)return I;const add=(lvl,ref,msg,id)=>I.push({lvl,ref,msg,id});
  if(P.vlans.length){const bad=X.perms(r).filter(p=>has(p.pc.vlan)&&!vlanBy(p.pc.vlan));if(bad.length)add('warn','VLAN',`Prese permutate su VLAN non definite: ${bad.map(p=>p.lab+' (VLAN '+p.pc.vlan+')').join(', ')}.`)}
  const mg=mgmtVlan();const mc=mg&&cidr(mg.subnet);
  r.items.forEach(it=>{const ip=it.props.ip;if(!has(ip))return;const n=ip2n(ip);
    if(n==null){add('warn','Indirizzi IP',`${nm(it)}: indirizzo di gestione «${ip}» non valido.`,it.id);return}
    if(mc&&!inNet(n,mc))add('warn','Indirizzi IP',`${nm(it)}: l'IP ${ip} è fuori dalla subnet di gestione ${mg.subnet}.`,it.id);
    const dup=[];P.racks.forEach(x=>x.items.forEach(y=>{if(y!==it&&String(y.props.ip||'').trim()===String(ip).trim())dup.push(rid(x)+' U'+y.pos)}));P.devices.forEach(d=>{if(String(d.ip||'').trim()===String(ip).trim())dup.push(d.name||DEV[d.kind].short)});
    if(dup.length)add('err','Indirizzi IP',`${nm(it)}: l'IP ${ip} è usato anche da ${dup.join(', ')}.`,it.id)});
  const ko=[];r.items.filter(i=>i.kind==='patch').forEach(it=>{const L=panelLetters(r);Object.entries(it.ports).forEach(([n,pd])=>{if(pd.cert&&!pd.cert.ok)ko.push(L[it.id]+n)})});
  if(ko.length)add('warn','Certificazione',`Prese con certificazione non superata: ${ko.join(', ')}.`);
  return I;
};
const _curIssues=curIssues;curIssues=function(){const I=_curIssues();return S.view==='campus'?[...I,...vlanIssues()]:I};

/* ---------------- inventario e foto ---------------- */
const _del=DB.del.bind(DB);
const photoIds=()=>{const s=new Set();P.racks.forEach(r=>{(r.photos||[]).forEach(x=>s.add(x));r.items.forEach(i=>(i.photos||[]).forEach(x=>s.add(x)))});P.devices.forEach(d=>(d.photos||[]).forEach(x=>s.add(x)));return s};
DB.del=k=>String(k).startsWith('ph:')&&photoIds().has(k)?Promise.resolve():_del(k);
let photoTarget=null;
const fin=document.createElement('input');fin.type='file';fin.accept='image/*';fin.multiple=true;fin.hidden=true;document.body.appendChild(fin);
fin.onchange=async()=>{const files=[...fin.files];fin.value='';if(!photoTarget||!files.length)return;const ids=[];
  for(const f of files){try{const url=URL.createObjectURL(f);const im=await imgEl(url);const s=Math.min(1,1600/Math.max(im.naturalWidth,im.naturalHeight));const c=document.createElement('canvas');c.width=Math.round(im.naturalWidth*s);c.height=Math.round(im.naturalHeight*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(url);
    const b=await new Promise(r=>c.toBlob(r,'image/jpeg',.85));const id='ph:'+uid();await DB.put(id,b);IMG[id]=URL.createObjectURL(b);ids.push(id)}catch(e){toast('Impossibile leggere una delle foto')}}
  const t=photoTarget;mutate(()=>{const o=targetObj(t);if(o)(o.photos??=[]).push(...ids)});toast(`${ids.length} foto aggiunte`)};
function targetObj(t){if(t.type==='rack')return rackById(t.id);if(t.type==='dev')return P.devices.find(d=>d.id===t.id);const r=rackById(t.rack);return r&&r.items.find(i=>i.id===t.id)}
function photoSection(type,o,rack){const ph=o.photos||[];return `<div class="sez"><h3>Foto <span>${ph.length}</span></h3>${ph.length?`<div class="thumbs">${ph.map(id=>`<img data-ph="${id}" data-xa="phView" data-id="${id}" data-t="${type}" data-o="${o.id}" data-r="${rack||''}" alt="Foto">`).join('')}</div>`:''}<button class="btn piccolo" data-xa="phAdd" data-t="${type}" data-o="${o.id}" data-r="${rack||''}">Aggiungi foto</button><p class="piccola">Le foto restano nel browser e vengono incluse nell'esportazione JSON del progetto.</p></div>`}
function fillThumbs(){$$('img[data-ph]').forEach(im=>{if(im.src)return;imgUrl(im.dataset.ph).then(u=>{if(u)im.src=u})})}
const inv=(attr,o,list)=>`<div class="sez"><h3>Inventario</h3>${list.map(([f,l,ph])=>`<div class="f"><label>${l}</label><input type="text" ${attr}="${f}" value="${esc(o[f]??'')}" placeholder="${ph}"></div>`).join('')}</div>`;
const _itemHtml=itemHtml;
itemHtml=function(r,it){
  let h=_itemHtml(r,it);
  if(it.kind==='patch')h=h.replace(/data-port="(\d+)"/g,(m0,n)=>{const c=it.ports[n]?.cert;return c?`${m0} data-cert="${c.ok?'ok':'ko'}"`:m0});
  if(['blank','cm','shelf'].includes(it.kind))return h;
  const fields=[['tag','Asset tag','es. INV-00123'],['serial','Numero di serie','']];
  if(['sw','fw','router','srv','hub','mc','ups','vde','poe'].includes(it.kind))fields.push(['mac','MAC','aa:bb:cc:dd:ee:ff'],['ip','IP di gestione','10.10.99.11']);
  return h+inv('data-iv',it.props,fields)+photoSection('item',it,r.id);
};
const _portEditor=portEditor;
portEditor=function(r,it,n,L){let h=_portEditor(r,it,n,L);const c=it.ports[n]?.cert;if(!c)return h;
  const x=`<div class="kv"><span>Certificazione</span><b style="color:${c.ok?'var(--ok)':'var(--err)'}">${c.ok?'superata':'non superata'}${c.date?' · '+esc(c.date):''}${c.len?' · '+esc(c.len)+' m':''}</b></div>`;
  const k=h.indexOf('<div class="perm">');return k>0?h.slice(0,k)+x+h.slice(k):h};
const _rackHtml=rackHtml;
rackHtml=function(r){const h=_rackHtml(r);const x=photoSection('rack',r,'')+`<div class="sez"><h3>Modelli di armadio</h3><button class="btn piccolo" data-xa="tplSave">Salva questo armadio come modello</button><p class="piccola">I modelli salvati compaiono nella scheda Armadi, in «Nuovo armadio da modello», in tutti i progetti di questo browser.</p></div>`;
  const k=h.indexOf('<div class="sez"><h3>Azioni');return k>0?h.slice(0,k)+x+h.slice(k):h+x};
const _devHtml=devHtml;
devHtml=function(d,pl){
  let h=_devHtml(d,pl);let x='';
  if(d.kind==='cam'){const df=camDef(d);x+=`<div class="sez"><h3>Campo visivo</h3>
    <div class="f"><label>Direzione</label><div class="um"><input type="range" min="0" max="359" step="1" data-dy="dir" value="${num(d.dir,0)}" style="accent-color:var(--accento)"><span class="mono">${num(d.dir,0)}°</span></div></div>
    <div class="f"><label>Angolo</label><div class="um"><input type="number" min="10" max="360" data-dy="fov" value="${esc(d.fov??'')}" placeholder="${df.fov}"><span>°</span></div></div>
    <div class="f"><label>Portata</label><div class="um"><input type="number" min="1" data-dy="range" value="${esc(d.range??'')}" placeholder="${df.range}"><span>m</span></div></div>
    <p class="piccola">I muri disegnati in pianta interrompono il campo visivo.</p></div>`}
  if(d.kind==='ap'){const df=apDef(d);x+=`<div class="sez"><h3>Copertura Wi-Fi</h3><div class="f"><label>Raggio indicativo</label><div class="um"><input type="number" min="1" data-dy="radius" value="${esc(d.radius??'')}" placeholder="${df}"><span>m</span></div></div><p class="piccola">Stima in campo libero; ogni muro disegnato attraversato riduce la portata residua di circa il 45%.</p></div>`}
  x+=`<div class="sez"><h3>Percorso del cavo</h3><p class="piccola" style="margin-top:0">${d.route?.length?`Percorso tracciato con ${d.route.length} punti intermedi: la lunghezza si misura su questo.`:'Senza percorso la lunghezza è stimata ad angolo retto dall\'armadio.'}</p><div class="btnrow"><button class="btn piccolo ${S.tool==='route'?'on':''}" data-xa="routeStart">${d.route?.length?'Ritraccia':'Traccia percorso'}</button>${d.route?.length?'<button class="btn piccolo trasp rosso" data-xa="routeDel">Cancella percorso</button>':''}</div></div>`;
  x+=inv('data-dy',d,[['tag','Asset tag','es. INV-00123'],['serial','Numero di serie',''],['mac','MAC','aa:bb:cc:dd:ee:ff'],['ip','Indirizzo IP','']])+photoSection('dev',d,'');
  const k=h.lastIndexOf('<div class="sez"><div class="btnrow">');return k>0?h.slice(0,k)+x+h.slice(k):h+x;
};
const _renderRight=renderRight;renderRight=function(){_renderRight();fillThumbs()};

/* ---------------- planimetria: coperture, muri, percorsi, righello ---------------- */
function camDef(d){const m=d.model&&MODELS[d.model];const t=m?(m.note||'')+' '+m.m:'';
  if(/360|fisheye|MV32/i.test(t))return {fov:360,range:10};if(/PTZ|speed dome/i.test(t))return {fov:360,range:50};
  if(/varifocal|varifocale|IZS|BC800Z/i.test(t))return {fov:60,range:40};if(/bullet|BC500|T46|MV63|MV72/i.test(t))return {fov:95,range:30};
  if(/turret|TC500/i.test(t))return {fov:105,range:25};if(/dome|Dome/i.test(t))return {fov:105,range:20};return {fov:90,range:20}}
function apDef(d){const m=d.model&&MODELS[d.model];const t=m?(m.note||'')+' '+m.m:'';if(/esterno|Outdoor|Mesh/i.test(t))return 40;if(/Long-Range|LR\b/i.test(t))return 25;if(/Wi-Fi 7|6E/.test(t))return 15;if(/Wi-Fi 5/.test(t))return 20;return 18}
const pxm=pl=>pl.scale?1/pl.scale:pl.w/40;
function segHit(ox,oy,dx,dy,x1,y1,x2,y2){const sx=x2-x1,sy=y2-y1;const den=dx*sy-dy*sx;if(Math.abs(den)<1e-9)return null;const t=((x1-ox)*sy-(y1-oy)*sx)/den;const u=((x1-ox)*dy-(y1-oy)*dx)/den;return t>1e-6&&u>=0&&u<=1?t:null}
function rayPoly(pl,cx,cy,R,a0,a1,opaque){
  const pts=[];const span=a1-a0;const n=Math.max(24,Math.round(Math.abs(span)/3));
  for(let i=0;i<=n;i++){const b=(a0+span*i/n)*Math.PI/180;const dx=Math.sin(b),dy=-Math.cos(b);
    const hits=(pl.walls||[]).map(w=>segHit(cx,cy,dx,dy,w[0],w[1],w[2],w[3])).filter(t=>t!=null).sort((a,b)=>a-b);
    let reach=R;if(opaque){if(hits.length&&hits[0]<R)reach=hits[0]}else{for(const t of hits){if(t>=reach)break;reach=t+(reach-t)*.55}}
    pts.push([cx+dx*reach,cy+dy*reach])}
  return pts;
}
const _cableInfo=cableInfo;
cableInfo=function(d){
  if(!d.route?.length)return _cableInfo(d);
  const p=devPort(d);if(!p)return _cableInfo(d);const r=p.r;if(!r.loc||r.loc.plan!==d.plan)return _cableInfo(d);const pl=planById(d.plan);if(!pl.scale)return _cableInfo(d);
  const pts=[[r.loc.x,r.loc.y],...d.route,[d.x,d.y]];let px=0;for(let i=1;i<pts.length;i++)px+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);
  const m=px*pl.scale+(+P.slack||0);return {st:m>90?'err':m>80?'warn':'ok',m,txt:`≈ ${fmt(m)} m (percorso)`};
};
const _renderPlan=renderPlan;
renderPlan=function(){
  _renderPlan();const pl=PL();const svg=$('#pw svg.cavi');if(!pl||!svg)return;
  const k=pxm(pl);const sw=Math.max(pl.w,pl.h)/400;let s='';
  if(S.cov!==false)P.devices.filter(d=>d.plan===pl.id).forEach(d=>{
    if(d.kind==='cam'){const df=camDef(d);const fov=num(d.fov,df.fov),R=num(d.range,df.range)*k,dir=num(d.dir,0);
      const pts=fov>=360?rayPoly(pl,d.x,d.y,R,0,360,true):[[d.x,d.y],...rayPoly(pl,d.x,d.y,R,dir-fov/2,dir+fov/2,true)];
      s+=`<polygon points="${pts.map(p=>p.map(v=>v.toFixed(1)).join(',')).join(' ')}" fill="#6f42c1" fill-opacity=".16" stroke="#6f42c1" stroke-opacity=".55" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`}
    if(d.kind==='ap'){const R=num(d.radius,apDef(d))*k;const pts=rayPoly(pl,d.x,d.y,R,0,360,false);
      s+=`<polygon points="${pts.map(p=>p.map(v=>v.toFixed(1)).join(',')).join(' ')}" fill="#198754" fill-opacity=".12" stroke="#198754" stroke-opacity=".45" stroke-width="1.5" stroke-dasharray="6 4" vector-effect="non-scaling-stroke"/>`}});
  (pl.walls||[]).forEach(w=>s+=`<line x1="${w[0]}" y1="${w[1]}" x2="${w[2]}" y2="${w[3]}" stroke="#c2185b" stroke-width="5" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity=".85"/>`);
  if(P.cables)P.devices.filter(d=>d.plan===pl.id&&d.route?.length).forEach(d=>{const p=devPort(d);if(!p||!p.r.loc||p.r.loc.plan!==pl.id)return;const ci=cableInfo(d);const col=ci.st==='err'?'#dc3545':ci.st==='warn'?'#e8a200':TCOL[p.r.type];
    const pts=[[p.r.loc.x,p.r.loc.y],...d.route,[d.x,d.y]];s+=`<polyline points="${pts.map(q=>q.join(',')).join(' ')}" fill="none" stroke="${col}" stroke-width="2.5" vector-effect="non-scaling-stroke" opacity=".9"/>`});
  if(S.tool&&S.draft?.length){const pts=S.tool==='route'&&S.routeDev?(()=>{const d=P.devices.find(x=>x.id===S.routeDev);const p=d&&devPort(d);return p&&p.r.loc?[[p.r.loc.x,p.r.loc.y],...S.draft]:S.draft})():S.draft;
    s+=`<polyline points="${pts.map(q=>q.join(',')).join(' ')}" fill="none" stroke="${S.tool==='walls'?'#c2185b':'#0d6efd'}" stroke-width="3" stroke-dasharray="8 5" vector-effect="non-scaling-stroke"/>`+S.draft.map(q=>`<circle cx="${q[0]}" cy="${q[1]}" r="${sw*1.6}" fill="#fff" stroke="#0d6efd" stroke-width="2" vector-effect="non-scaling-stroke"/>`).join('')}
  if(S.ruler?.length){const [a,b]=S.ruler;s+=`<circle cx="${a[0]}" cy="${a[1]}" r="${sw*1.6}" fill="#e8a200"/>`;if(b){const m=Math.hypot(b[0]-a[0],b[1]-a[1])/k;s+=`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#e8a200" stroke-width="3" vector-effect="non-scaling-stroke"/><circle cx="${b[0]}" cy="${b[1]}" r="${sw*1.6}" fill="#e8a200"/><text x="${(a[0]+b[0])/2}" y="${(a[1]+b[1])/2}" dy="-8" text-anchor="middle" font-size="${Math.max(pl.w,pl.h)/70}" font-weight="700" fill="#b37400" stroke="#fff" stroke-width="${sw}" paint-order="stroke">${fmt(m)} m${pl.scale?'':' (scala stimata)'}</text>`}}
  svg.insertAdjacentHTML('afterbegin',s);
  if(S.tool){const msg={walls:'Muri: clicca i punti del muro · Invio o «Fine» per chiudere · Esc per annullare',route:'Percorso: clicca i punti dall\'armadio verso l\'apparato · Invio o «Fine» per salvare',ruler:'Righello: clicca due punti per misurare la distanza · Esc per uscire'}[S.tool];
    $('#pv').insertAdjacentHTML('afterbegin',`<div class="suggerimento">${msg}${S.tool!=='ruler'?' <button class="btn piccolo" data-xa="toolEnd" style="margin-left:8px">Fine</button>':''}</div>`);$('#pv').classList.add('calib')}
};
const _renderFloat=renderFloat;
renderFloat=function(){_renderFloat();if(S.view==='plan'&&PL()){const fb=$('#floatBar');const sp=fb.querySelector('.sp');const html=`<button class="btn piccolo ${S.cov!==false?'on':''}" data-xa="cov">Coperture</button><button class="btn piccolo ${S.tool==='walls'?'on':''}" data-xa="walls">Muri</button><button class="btn piccolo ${S.tool==='ruler'?'on':''}" data-xa="ruler">Righello</button>`;sp?sp.insertAdjacentHTML('afterend',html):fb.insertAdjacentHTML('beforeend',html)}};
function startTool(t,extra){S.tool=t;S.draft=[];S.ruler=null;S.calib=null;S.placing=null;Object.assign(S,extra||{});render()}
function endTool(save){const t=S.tool;const pl=PL();
  if(save&&t==='walls'&&S.draft.length>=2){const segs=[];for(let i=1;i<S.draft.length;i++)segs.push([...S.draft[i-1],...S.draft[i]].map(v=>Math.round(v)));S.tool=null;S.draft=[];mutate(()=>{pl.walls.push(...segs)});return}
  if(save&&t==='route'){const d=P.devices.find(x=>x.id===S.routeDev);const pts=S.draft.map(q=>q.map(Math.round));S.tool=null;S.draft=[];if(d)mutate(()=>{d.route=pts});return}
  S.tool=null;S.draft=[];S.ruler=null;render()}
$('#pv').addEventListener('pointerdown',e=>{
  if(!S.tool||e.button>0||!$('#pw'))return;if(e.target.closest('.suggerimento'))return;
  e.stopPropagation();e.preventDefault();const p=toImg(e.clientX,e.clientY);const pl=PL();if(p.x<0||p.y<0||p.x>pl.w||p.y>pl.h)return;
  if(S.tool==='ruler'){S.ruler=!S.ruler||S.ruler.length===2?[[p.x,p.y]]:[S.ruler[0],[p.x,p.y]];renderPlan();return}
  S.draft.push([p.x,p.y]);renderPlan();
},true);
$('#pv').addEventListener('wheel',()=>{if(S.tool)setTimeout(()=>{},0)},{passive:true});
document.addEventListener('keydown',e=>{if(!S.tool||/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName))return;
  if(e.key==='Escape'){e.stopImmediatePropagation();endTool(false)}else if(e.key==='Enter'){e.preventDefault();endTool(true)}else if(e.key==='Backspace'&&S.draft?.length){e.preventDefault();e.stopImmediatePropagation();S.draft.pop();renderPlan()}},true);
const _planHtml=planHtml;
planHtml=function(pl){const h=_planHtml(pl);const x=`<div class="sez"><h3>Muri <span>${pl.walls.length} tratti</span></h3><p class="piccola" style="margin-top:0">Disegna i muri principali: bloccano il campo visivo delle telecamere e riducono la copertura Wi-Fi.</p><div class="btnrow"><button class="btn piccolo ${S.tool==='walls'?'on':''}" data-xa="walls">Disegna muri</button>${pl.walls.length?'<button class="btn piccolo" data-xa="wallUndo">Togli l\'ultimo</button><button class="btn piccolo trasp rosso" data-xa="wallClear">Cancella tutti</button>':''}</div></div>`;
  const k=h.indexOf('<div class="sez"><h3>Contenuto');return k>0?h.slice(0,k)+x+h.slice(k):h+x};

/* ---------------- Snipe-IT ---------------- */
const SNCAT={sw:'Switch',fw:'Firewall',router:'Router',srv:'Server',hub:'Apparati di rete',mc:'Apparati di rete',ups:'UPS',vde:'PDU',unel:'PDU',poe:'PDU',patch:'Patch panel',fo:'Cassetti ottici',ap:'Access point',cam:'Telecamere',altro:'Apparati di rete'};
function snipeRows(){
  const rows=[['Asset Tag','Item Name','Category','Model name','Model Number','Manufacturer','Serial Number','Location','Status','Notes','MAC Address']];
  P.racks.forEach(r=>{const L=panelLetters(r);r.items.filter(i=>SNCAT[i.kind]).forEach(it=>{const md=it.props.model&&MODELS[it.props.model];const p=it.props;
    rows.push([p.tag||'',nm(it),SNCAT[it.kind],md?md.m:nm(it),md?md.m:'',md?VENDORS[md.v].n.split(' / ')[0]:'Generico',p.serial||'',`${rid(r)} U${it.pos}`,'Ready to Deploy',[L[it.id]?'Pannello '+L[it.id]:'',p.ip?'IP '+p.ip:''].filter(Boolean).join(' · '),p.mac||''])})});
  P.devices.forEach(d=>{const md=d.model&&MODELS[d.model];const pl=planById(d.plan);const lab=devLabel(d);
    rows.push([d.tag||'',d.name?`${DEV[d.kind].short} ${d.name}`:DEV[d.kind].short,SNCAT[d.kind],md?md.m:DEV[d.kind].name,md?md.m:'',md?VENDORS[md.v].n.split(' / ')[0]:'Generico',d.serial||'',pl?pl.name+(d.name?' – '+d.name:''):'','Ready to Deploy',[lab?'Presa '+lab:'',d.ip?'IP '+d.ip:''].filter(Boolean).join(' · '),d.mac||''])});
  return rows;
}

/* ---------------- certificazioni Fluke LinkWare ---------------- */
const fluke=document.createElement('input');fluke.type='file';fluke.accept='.csv,.txt,text/csv';fluke.hidden=true;document.body.appendChild(fluke);
function parseCsv(t){t=t.replace(/^﻿/,'');const first=t.split(/\r?\n/)[0];const sep=[';','\t',','].sort((a,b)=>first.split(b).length-first.split(a).length)[0];
  const rows=[];let row=[],cell='',q=false;for(let i=0;i<t.length;i++){const ch=t[i];if(q){if(ch==='"'){if(t[i+1]==='"'){cell+='"';i++}else q=false}else cell+=ch}else if(ch==='"')q=true;else if(ch===sep){row.push(cell);cell=''}else if(ch==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell=''}else cell+=ch}
  if(cell||row.length){row.push(cell);rows.push(row)}return rows.filter(r=>r.some(c=>c.trim()))}
fluke.onchange=async()=>{const f=fluke.files[0];fluke.value='';if(!f)return;
  const rows=parseCsv(await f.text());let hi=rows.findIndex(r=>r.some(c=>/cable\s*id|id\s*cavo|identificativo|etichetta|label/i.test(c)));if(hi<0){toast('Colonna «Cable ID» non trovata nel file');return}
  const H=rows[hi].map(c=>c.trim().toLowerCase());const ci=H.findIndex(c=>/cable\s*id|id\s*cavo|identificativo|etichetta|label/.test(c));const ri=H.findIndex(c=>/result|summary|esito|risultato|status|stato/.test(c));const di=H.findIndex(c=>/date|data/.test(c));const li=H.findIndex(c=>/length|lunghezza/.test(c));
  if(ri<0){toast('Colonna dell\'esito (Result/Summary) non trovata');return}
  const norm=s=>String(s||'').toUpperCase().replace(/\s+/g,'');
  const map={};P.racks.forEach(r=>{const L=panelLetters(r);r.items.filter(i=>i.kind==='patch').forEach(it=>{for(let n=1;n<=+it.props.ports;n++){map[norm(wallLabel(r,it,n,L))]={r,it,n};if(r.id===S.rack)map[norm(L[it.id]+n)]??={r,it,n}}})});
  let ok=0,ko=0,miss=0;
  mutate(()=>{rows.slice(hi+1).forEach(row=>{const id=norm(row[ci]);if(!id)return;const hit=map[id];if(!hit){miss++;return}const res=String(row[ri]||'').trim();const pass=/pass|ok|superat|\bp\b/i.test(res)&&!/fail|ko|non/i.test(res);
    const pd=hit.it.ports[hit.n]??={t:'user'};pd.cert={ok:pass,res,date:di>=0?String(row[di]||'').trim():'',len:li>=0?String(row[li]||'').trim():''};pass?ok++:ko++})});
  toast(`Certificazioni importate: ${ok} superate, ${ko} non superate${miss?`, ${miss} etichette non trovate`:''}`)};

/* ---------------- modelli di armadio ---------------- */
const TPL_KEY='ndc-modelli-armadio';
const userTpl=()=>{try{return JSON.parse(localStorage.getItem(TPL_KEY))||[]}catch(e){return []}};
const saveTpl=l=>{try{localStorage.setItem(TPL_KEY,JSON.stringify(l))}catch(e){toast('Impossibile salvare il modello')}};
const BUILTIN=[
  {id:'b-fd24',name:'Armadio di piano 24 U (fibra, 2 patch, switch PoE 48, UPS)',type:'FD',units:24,mk:()=>[mkItem('fo',1,{use:'dorsale',dir:'arrivo',ports:12}),mkItem('patch'),mkItem('patch'),mkItem('sw',1,{ports:48,poe:true,sfp:4}),mkItem('unel'),mkItem('ups',1,{size:2})]},
  {id:'b-ld12',name:'Armadio locale 12 U a muro (fibra, patch, switch PoE 24)',type:'LD',units:12,mk:()=>[mkItem('fo',1,{use:'distribuzione',dir:'arrivo',ports:12,fiber:'OM4'}),mkItem('patch'),mkItem('sw',1,{ports:24,poe:true,sfp:2}),mkItem('unel')]},
  {id:'b-bd42',name:'Armadio di edificio 42 U sala server (firewall, core, server, UPS)',type:'BD',units:42,server:true,mk:()=>[mkItem('fo',1,{use:'dorsale',dir:'partenza'}),mkItem('fo',1,{use:'distribuzione',dir:'partenza',ports:12,fiber:'OM4'}),mkItem('patch'),mkItem('patch'),mkItem('fw'),mkItem('sw',1,{ports:48,poe:false,sfp:4}),mkItem('sw',1,{ports:48,poe:true,sfp:4}),mkItem('srv',1,{size:2}),mkItem('srv',1,{size:2}),mkItem('ups',1,{size:3}),mkItem('vde'),mkItem('vde')]}
];
function fromTemplate(id){
  const b=BUILTIN.find(t=>t.id===id);const u=userTpl().find(t=>t.id===id);if(!b&&!u)return;const cur=R();
  mutate(()=>{const r=newRack({type:(b||u).type,units:(b||u).units,b:cur.b,floor:cur.floor,server:!!(b||u).server});r.log=[];r.perm={};r.swcfg={};r.photos=[];
    if(b){r.items=b.mk();quiet=true;autoArrange(r);quiet=false}else r.items=u.items.map(it=>({...JSON.parse(JSON.stringify(it)),id:uid(),ports:{},photos:[]}));
    P.racks.push(r);S.rack=r.id;S.item=null;S.view='rack'});
  toast('Armadio creato dal modello');
}
const _racksHtml=racksHtml;
racksHtml=function(){const h=_racksHtml();const ut=userTpl();
  return h+`<div style="padding:0 16px 16px"><div class="f" style="grid-template-columns:1fr;gap:4px"><label>Nuovo armadio da modello</label><select id="tplPick"><option value="">Scegli un modello…</option><optgroup label="Predefiniti">${BUILTIN.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</optgroup>${ut.length?`<optgroup label="I tuoi modelli">${ut.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</optgroup>`:''}</select></div>
  ${ut.length?`<details class="tpl"><summary>Gestisci i tuoi modelli (${ut.length})</summary>${ut.map(t=>`<div class="kv"><span>${esc(t.name)}</span><button class="btn piccolo trasp rosso" data-xa="tplDel" data-id="${t.id}">✕</button></div>`).join('')}</details>`:''}</div>`};
$('#leftBody').addEventListener('change',e=>{if(e.target.id==='tplPick'&&e.target.value)fromTemplate(e.target.value)});

/* ---------------- GitHub Gist ---------------- */
const GH='https://api.github.com';const TOK='ndc-gh-token';
const tok=()=>{try{return localStorage.getItem(TOK)||''}catch(e){return ''}};
async function gh(path,opt={}){const r=await fetch(GH+path,{...opt,headers:{'Accept':'application/vnd.github+json','Authorization':'Bearer '+tok(),...(opt.headers||{})}});if(!r.ok)throw new Error(r.status+' '+(await r.text()).slice(0,140));return r.status===204?null:r.json()}
async function projectWithImages(){const out=JSON.parse(JSON.stringify(P));out.images={};for(const pl of P.plans){const b=await DB.get(pl.id);if(b)out.images[pl.id]=await blobToData(b)}for(const id of photoIds()){const b=await DB.get(id);if(b)out.images[id]=await blobToData(b)}return out}
async function loadProject(j){const imgs=j.images||{};delete j.images;for(const [id,data] of Object.entries(imgs)){const b=await dataToBlob(data);await DB.put(id,b);if(IMG[id])URL.revokeObjectURL(IMG[id]);IMG[id]=URL.createObjectURL(b)}
  const old=JSON.stringify(P);P=normalize(j);S.hist.push(old);S.rack=P.racks[0]?.id;S.plan=P.plans[0]?.id||null;S.item=null;S.mk=null;S.pz={};save();render()}
async function openGist(){
  const t=tok();let list='';
  if(t){try{const gs=await gh('/gists?per_page=100');const mine=gs.filter(g=>Object.keys(g.files).some(f=>f.endsWith('.ndc.json')));list=mine.length?`<table class="tab">${mine.map(g=>`<tr><td>${esc(g.description||Object.keys(g.files)[0])}<br><span class="piccola">${new Date(g.updated_at).toLocaleString('it-IT')}${g.id===P.gistId?' · progetto corrente':''}</span></td><td style="text-align:right"><button class="btn piccolo" data-xa="gistOpen" data-id="${g.id}">Apri</button></td></tr>`).join('')}</table>`:'<p class="piccola">Nessun progetto salvato su Gist.</p>'}catch(e){list=`<p class="piccola" style="color:var(--err)">Accesso a GitHub non riuscito (${esc(e.message)}). Controlla il token.</p>`}}
  modal('Salva o apri da GitHub Gist',`<div class="f"><label>Token GitHub</label><input type="password" id="ghTok" value="${esc(t)}" placeholder="github_pat_…" autocomplete="off"></div>
  <p class="piccola">Serve un token con il solo permesso <b>Gists</b> (lettura e scrittura). Resta salvato solo in questo browser. I gist vengono creati segreti.</p>
  <div class="btnrow" style="margin:10px 0 16px"><button class="btn primario" data-xa="gistSave">${P.gistId?'Aggiorna il gist del progetto':'Salva il progetto su un nuovo gist'}</button>${P.gistId?'<button class="btn" data-xa="gistNew">Salva come nuovo gist</button>':''}</div>
  <h4 style="margin:0 0 6px">I tuoi progetti su Gist</h4>${t?list:'<p class="piccola">Inserisci il token per vedere i progetti salvati.</p>'}
  <p class="piccola">Google Drive richiederebbe di registrare l'applicazione presso Google; il gist è il modo più semplice per avere lo stesso progetto su più computer.</p>`);
  $('#ghTok').onchange=e=>{try{localStorage.setItem(TOK,e.target.value.trim())}catch(_){}openGist()};
}
async function gistSave(asNew){
  if(!tok()){toast('Inserisci prima il token GitHub');return}
  toast('Salvataggio su Gist in corso…');
  try{const data=await projectWithImages();const fn=slug(P.name)+'.ndc.json';const body={description:`Network Design Center · ${P.name}`,files:{[fn]:{content:JSON.stringify(data)}}};
    let g;if(P.gistId&&!asNew){g=await gh('/gists/'+P.gistId,{method:'PATCH',body:JSON.stringify(body)})}else{body.public=false;g=await gh('/gists',{method:'POST',body:JSON.stringify(body)})}
    P.gistId=g.id;save();toast('Progetto salvato su Gist');openGist()}catch(e){toast('Salvataggio non riuscito: '+e.message)}
}
async function gistOpen(id){
  if(!confirm('Aprire il progetto da Gist? Il progetto corrente viene sostituito (puoi tornare indietro con Ctrl+Z).'))return;
  try{const g=await gh('/gists/'+id);const f=Object.values(g.files).find(x=>x.filename.endsWith('.ndc.json'));let txt=f.content;if(f.truncated)txt=await (await fetch(f.raw_url)).text();
    const j=JSON.parse(txt);j.gistId=id;await loadProject(j);closeModal();toast('Progetto aperto da Gist')}catch(e){toast('Apertura non riuscita: '+e.message)}
}
exportJson=async function(){const out=await projectWithImages();download(slug(P.name)+'.json',JSON.stringify(out),'application/json');toast('Progetto esportato con planimetrie e foto')};

/* ---------------- stampa ---------------- */
const _printRack=printRack;
printRack=function(){const wp=window.print;window.print=()=>{};try{_printRack()}finally{window.print=wp}
  const r=R();const L=panelLetters(r);let h='';
  const inv=r.items.filter(i=>i.props.serial||i.props.mac||i.props.ip||i.props.tag);
  if(inv.length)h+=`<h2>Inventario</h2><table><tr><th>U</th><th>Apparato</th><th>Asset tag</th><th>Seriale</th><th>MAC</th><th>IP</th></tr>${inv.sort((a,b)=>b.pos-a.pos).map(i=>`<tr><td>U${i.pos}</td><td>${esc(nm(i))}</td><td>${esc(i.props.tag||'')}</td><td>${esc(i.props.serial||'')}</td><td>${esc(i.props.mac||'')}</td><td>${esc(i.props.ip||'')}</td></tr>`).join('')}</table>`;
  const certs=[];r.items.filter(i=>i.kind==='patch').forEach(it=>Object.entries(it.ports).forEach(([n,pd])=>{if(pd.cert)certs.push([L[it.id]+n,pd.cert])}));
  if(certs.length){const ko=certs.filter(c=>!c[1].ok);h+=`<h2>Certificazioni</h2><div>${certs.length-ko.length} prese superate, ${ko.length} non superate</div>${ko.length?`<table><tr><th>Presa</th><th>Esito</th><th>Data</th><th>Lunghezza</th></tr>${ko.map(([l,c])=>`<tr><td>${esc(l)}</td><td>${esc(c.res)}</td><td>${esc(c.date)}</td><td>${esc(c.len)}</td></tr>`).join('')}</table>`:''}`}
  $('#print').insertAdjacentHTML('beforeend',h);window.print()};

/* ---------------- eventi ---------------- */
$('#rightBody').addEventListener('change',e=>{const t=e.target;const r=R();
  if(t.dataset.swp){const sw=r.items.find(i=>i.id===S.item);mutate(()=>setSw(r,sw,+t.dataset.swp,c=>{c.pvid=+t.value||1;c.tagged=c.tagged.filter(v=>v!==c.pvid)}));return}
  if(t.dataset.swt){const sw=r.items.find(i=>i.id===S.item);const v=+t.value;mutate(()=>setSw(r,sw,+t.dataset.swt,c=>{c.tagged=t.checked?[...new Set([...c.tagged,v])]:c.tagged.filter(x=>x!==v)}));return}
  if(t.dataset.iv){const it=r.items.find(i=>i.id===S.item);if(!it)return;mutate(()=>{it.props[t.dataset.iv]=t.value.trim()});return}
  if(t.dataset.dy){const d=mkObj(S.mk);if(!d)return;const f=t.dataset.dy;mutate(()=>{d[f]=['fov','range','radius','dir'].includes(f)?(t.value===''?'':num(t.value,0)):t.value.trim()});return}
});
$('#rightBody').addEventListener('input',e=>{const t=e.target;if(t.dataset.dy==='dir'){const d=mkObj(S.mk);if(!d)return;d.dir=+t.value;t.nextElementSibling.textContent=t.value+'°';renderPlan();clearTimeout(t._t);t._t=setTimeout(()=>mutate(()=>{}),400)}});
$('#rightBody').addEventListener('click',e=>{const b=e.target.closest('[data-swm] button');if(!b)return;const r=R();const sw=r.items.find(i=>i.id===S.item);const n=+b.parentElement.dataset.swm;
  mutate(()=>setSw(r,sw,n,c=>{c.mode=b.dataset.v;if(c.mode==='trunk'&&!c.tagged.length)c.tagged=P.vlans.map(v=>+v.vid).filter(v=>v!==c.pvid)}))});
$('#modal').addEventListener('change',e=>{const t=e.target;if(!t.dataset.vl)return;const v=P.vlans.find(x=>x.id===t.dataset.id);if(!v)return;const f=t.dataset.vl;
  mutate(()=>{if(f==='mgmt'){P.vlans.forEach(x=>x.mgmt=false);v.mgmt=t.checked}else if(f==='vid')v.vid=parseInt(t.value)||1;else v[f]=t.value.trim()});openVlans()});
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-xa]');if(!el)return;const a=el.dataset.xa;const r=R();
  const H={
    swReset:()=>{const sw=r.items.find(i=>i.id===S.item);mutate(()=>{if(r.swcfg?.[sw.id])delete r.swcfg[sw.id][el.dataset.n]})},
    vlAdd:()=>{const used=new Set(P.vlans.map(v=>+v.vid));let vid=10;while(used.has(vid))vid+=10;const cols=Object.values(X.COLORI);mutate(()=>P.vlans.push({id:uid(),vid,name:'',color:cols[P.vlans.length%cols.length],subnet:'',gw:'',mgmt:false}));openVlans()},
    vlDel:()=>{mutate(()=>{P.vlans=P.vlans.filter(v=>v.id!==el.dataset.id)});openVlans()},
    swCfg:()=>openSwConfig(S.item),
    swCsv:()=>{const x=allSwitches().find(q=>q.it.id===el.dataset.id);download(`${slug(rid(x.r))}-u${x.it.pos}-porte.csv`,X.csv([['Porta','Modalità','VLAN','Tagged','Presa','Locale'],...portTable(x.r,x.it)]),'text/csv;charset=utf-8')},
    rosCopy:()=>{navigator.clipboard.writeText($('#rosTxt').value).then(()=>toast('Script copiato'),()=>toast('Copia non riuscita'))},
    rosDl:()=>{const x=allSwitches().find(q=>q.it.id===el.dataset.id);download(`${slug(rid(x.r))}-u${x.it.pos}.rsc`,routeros(x.r,x.it),'text/plain')},
    cov:()=>{S.cov=S.cov===false;render()},
    walls:()=>S.tool==='walls'?endTool(true):startTool('walls'),
    ruler:()=>S.tool==='ruler'?endTool(false):startTool('ruler'),
    toolEnd:()=>endTool(true),
    routeStart:()=>{const d=mkObj(S.mk);if(!d)return;const p=devPort(d);if(!p||!p.r.loc||p.r.loc.plan!==d.plan){toast('Collega l\'apparato a un armadio posizionato su questa planimetria');return}startTool('route',{routeDev:d.id})},
    routeDel:()=>{const d=mkObj(S.mk);if(d)mutate(()=>{delete d.route})},
    wallUndo:()=>mutate(()=>{PL().walls.pop()}),
    wallClear:()=>{if(confirm('Cancellare tutti i muri di questa planimetria?'))mutate(()=>{PL().walls=[]})},
    phAdd:()=>{photoTarget={type:el.dataset.t,id:el.dataset.o,rack:el.dataset.r};fin.click()},
    phView:()=>{const id=el.dataset.id;imgUrl(id).then(u=>{modal('Foto',`<img src="${u}" style="max-width:100%;max-height:70vh;display:block;margin:0 auto;border-radius:8px" alt="Foto"><div class="btnrow" style="justify-content:flex-end;margin-top:12px"><a class="btn" href="${u}" download="foto.jpg">Scarica</a><button class="btn rosso" data-xa="phDel" data-id="${id}" data-t="${el.dataset.t}" data-o="${el.dataset.o}" data-r="${el.dataset.r}">Elimina foto</button></div>`)})},
    phDel:()=>{if(!confirm('Eliminare questa foto?'))return;const t={type:el.dataset.t,id:el.dataset.o,rack:el.dataset.r};mutate(()=>{const o=targetObj(t);if(o)o.photos=(o.photos||[]).filter(x=>x!==el.dataset.id)});closeModal()},
    tplSave:()=>{const name=prompt('Nome del modello di armadio:',`${TYPES[r.type].it} ${r.units} U`);if(!name)return;const l=userTpl();l.push({id:'u-'+uid(),name,type:r.type,units:r.units,server:r.server,items:r.items.map(it=>({...JSON.parse(JSON.stringify(it)),ports:{},photos:[]}))});saveTpl(l);toast('Modello salvato');renderLeft()},
    tplDel:()=>{if(confirm('Eliminare questo modello?')){saveTpl(userTpl().filter(t=>t.id!==el.dataset.id));renderLeft()}},
    gistSave:()=>gistSave(false),gistNew:()=>gistSave(true),gistOpen:()=>gistOpen(el.dataset.id)
  };
  if(H[a]){e.preventDefault();H[a]()}
});
$('#moreMenu .menu-lista').addEventListener('click',e=>{const m=e.target.closest('[data-m]')?.dataset.m;
  ({vlans:openVlans,swcfg:()=>openSwConfig(S.item),snipe:()=>{const rows=snipeRows();if(rows.length<2){toast('Nessun apparato da esportare');return}download(`${slug(P.name)}-snipe-it.csv`,X.csv(rows,','),'text/csv;charset=utf-8');toast(`${rows.length-1} apparati esportati per Snipe-IT`)},fluke:()=>fluke.click(),gist:openGist})[m]?.()});

/* ---------------- app installabile ---------------- */
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});

/* ---------------- avvio ---------------- */
(function go(){if(!P){setTimeout(go,30);return}normP(P);render()})();
})();
