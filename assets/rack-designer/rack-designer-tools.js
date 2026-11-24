/* =====================================================================
   Network Design Center — strumenti
   • modelli personalizzati (salvati nel browser e nel progetto)
   • calcolo dell'archiviazione per la videosorveglianza (NVR)
   • piano degli indirizzi IP con assegnazione automatica e lease DHCP per RouterOS
   • importazione dell'elenco prese da Excel (.xlsx) o CSV
   • relazione completa del progetto da stampare o salvare in PDF
   ===================================================================== */
(function(){
'use strict';
const X=()=>window.NDC;
const today=()=>new Date().toLocaleDateString(window.NDC_lang==='en'?'en-GB':'it-IT');
const num=(v,d=0)=>{const n=parseFloat(String(v??'').replace(',','.'));return Number.isFinite(n)?n:d};
const sel=(name,opts,val,attr='')=>`<select ${attr}>${opts.map(([v,t])=>`<option value="${esc(v)}" ${String(v)===String(val)?'selected':''}>${esc(t)}</option>`).join('')}</select>`;
const keepScroll=fn=>{const b=$('#mBody');const t=b?b.scrollTop:0;fn();const b2=$('#mBody');if(b2)b2.scrollTop=t};
const quietSave=()=>{try{save()}catch(_){}};

/* =====================================================================
   1) Modelli personalizzati
   ===================================================================== */
const UKEY='ndc-modelli-utente';
const RACKK=['fw','router','sw','srv','ups','vde','fo','patch','cm'],FIELDK=['ap','cam','altro'];
function userModels(){try{return JSON.parse(localStorage.getItem(UKEY))||[]}catch(_){return []}}
function saveUserModels(l){try{localStorage.setItem(UKEY,JSON.stringify(l))}catch(_){toast('Impossibile salvare il modello')}}
function regModel(u){
  if(!u||!u.id)return;
  if(u.vd&&!VENDORS[u.v])VENDORS[u.v]={n:u.vd.n,logo:u.vd.n,c:u.vd.c||'#6c757d'};
  if(!VENDORS[u.v])return;
  MODELS[u.id]={id:u.id,v:u.v,m:u.m,k:u.k,h:u.h||1,rj:u.rj||0,sfp:u.sfp||0,poe:!!u.poe,note:u.note||'',rack:RACKK.includes(u.k),user:true};
}
userModels().forEach(regModel);
function usedUserModels(){
  const ids=new Set();P.racks.forEach(r=>r.items.forEach(it=>{const m=it.props?.model;if(m&&String(m).startsWith('u-'))ids.add(m)}));
  P.devices.forEach(d=>{if(d.model&&String(d.model).startsWith('u-'))ids.add(d.model)});
  const store=Object.fromEntries(userModels().map(u=>[u.id,u]));const old=Object.fromEntries((P.umodels||[]).map(u=>[u.id,u]));
  return [...ids].map(id=>store[id]||old[id]||(MODELS[id]&&{...MODELS[id],vd:VENDORS[MODELS[id].v]&&MODELS[id].v.startsWith('x-')?{n:VENDORS[MODELS[id].v].n,c:VENDORS[MODELS[id].v].c}:undefined})).filter(Boolean);
}
const _save=save;save=function(){if(P){const u=usedUserModels();if(u.length)P.umodels=u;else delete P.umodels}return _save.apply(this,arguments)};
const _norm=normalize;normalize=function(p){const q=_norm(p);(q?.umodels||[]).forEach(regModel);return q};
const _mh=modelsHtml;modelsHtml=function(rack){
  const h=_mh(rack);const n=userModels().length;
  const btn=`<div class="btnrow" style="margin:6px 12px 10px"><button class="btn piccolo primario" data-ux="mNew" data-r="${rack?1:0}">+ Nuovo modello</button><button class="btn piccolo" data-ux="mList">I tuoi modelli (${n})</button></div>`;
  return h.replace(/(<div class="chips">[\s\S]*?<\/div>)/,'$1'+btn);
};
function modelForm(id,rack=true){
  const u=id?userModels().find(x=>x.id===id):{k:rack?'sw':'ap',h:1,rj:24,sfp:2,poe:false,v:'',m:'',note:''};if(!u)return;
  const vs=Object.entries(VENDORS).map(([k,v])=>[k,v.n]).sort((a,b)=>a[1].localeCompare(b[1]));
  modal(id?'Modifica modello':'Nuovo modello',`<div class="grid2">
    <div class="f"><label>Marca</label>${sel('',[['','— scegli —'],...vs,['__new','Altra marca…']],u.v,'id="umV"')}</div>
    <div class="f" id="umVnBox" hidden><label>Nome della nuova marca</label><input type="text" id="umVn" placeholder="es. Allied Telesis"></div>
    <div class="f"><label>Nome del modello</label><input type="text" id="umM" value="${esc(u.m)}" placeholder="es. GS724TP"></div>
    <div class="f"><label>Tipo</label>${sel('',[...RACKK.map(k=>[k,KLBL[k]+' · a rack']),...FIELDK.map(k=>[k,KLBL[k]+' · in planimetria'])],u.k,'id="umK"')}</div>
    <div class="f um-r"><label>Altezza (U)</label><input type="number" id="umH" min="1" max="20" value="${u.h||1}"></div>
    <div class="f um-p"><label id="umRjL">Porte RJ45</label><input type="number" id="umRj" min="0" max="96" value="${u.rj||0}"></div>
    <div class="f um-s"><label id="umSfL">Porte SFP / SFP+</label><input type="number" id="umSf" min="0" max="64" value="${u.sfp||0}"></div>
    <label class="chk um-poe"><input type="checkbox" id="umPoe" ${u.poe?'checked':''}><span>Porte PoE</span></label>
    <div class="f" style="grid-column:1/-1"><label>Descrizione</label><input type="text" id="umN" value="${esc(u.note||'')}" placeholder="es. switch 24 porte PoE+, uplink SFP+"></div></div>
    <p class="piccola" id="umHint"></p>
    <div class="btnrow" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-close>Annulla</button><button class="btn primario" data-ux="mSave" data-id="${id||''}">Salva modello</button></div>`,true);
  const upd=()=>{const k=$('#umK').value,fld=FIELDK.includes(k);
    $('#umVnBox').hidden=$('#umV').value!=='__new';
    $$('.um-r').forEach(e=>e.hidden=fld);$$('.um-p').forEach(e=>e.hidden=fld||['ups','cm'].includes(k));$$('.um-s').forEach(e=>e.hidden=fld||['ups','cm','patch','fo','srv'].includes(k));$$('.um-poe').forEach(e=>e.hidden=fld||!['sw','fw','router'].includes(k));
    $('#umRjL').textContent=k==='vde'?'Prese C13':['patch','fo'].includes(k)?'Porte':'Porte RJ45';$('#umSfL').textContent=k==='vde'?'Prese C19':'Porte SFP / SFP+';
    $('#umHint').textContent=k==='ups'?'Per gli UPS scrivi la potenza nella descrizione (es. «UPS 1500 VA»): serve al calcolo dell\'autonomia.':k==='srv'?'Per NAS e NVR scrivi canali e dischi nella descrizione (es. «NVR 16 canali, 4 dischi»): servono al calcolo dell\'archiviazione.':''};
  $('#umV').onchange=upd;$('#umK').onchange=upd;upd();
}
function saveModelForm(id){
  let v=$('#umV').value;const m=$('#umM').value.trim();const k=$('#umK').value;
  if(!m){toast('Scrivi il nome del modello');return}
  let vd;if(v==='__new'){const n=$('#umVn').value.trim();if(!n){toast('Scrivi il nome della marca');return}v='x-'+mslug(n);vd={n,c:'#6c757d'}}
  else if(!v){toast('Scegli la marca');return}else if(v.startsWith('x-'))vd={n:VENDORS[v].n,c:VENDORS[v].c};
  const u={id:id||'u-'+uid(),v,vd,m,k,h:Math.max(1,Math.round(num($('#umH').value,1))),rj:Math.max(0,Math.round(num($('#umRj').value))),sfp:Math.max(0,Math.round(num($('#umSf').value))),poe:$('#umPoe').checked,note:$('#umN').value.trim()};
  if(FIELDK.includes(k)){u.h=0;u.rj=0;u.sfp=0;u.poe=false}
  const l=userModels();const i=l.findIndex(x=>x.id===u.id);if(i>=0)l[i]=u;else l.push(u);saveUserModels(l);regModel(u);
  closeModal();S.vend='all';render();toast(id?'Modello aggiornato':'Modello aggiunto al catalogo');
}
function modelList(){
  const l=userModels();
  modal('I tuoi modelli',`${l.length?`<table class="vtab"><tr><th>Marca</th><th>Modello</th><th>Tipo</th><th>Dati</th><th></th></tr>${l.map(u=>`<tr><td>${esc(VENDORS[u.v]?.n||u.vd?.n||u.v)}</td><td><b>${esc(u.m)}</b>${u.note?`<br><small>${esc(u.note)}</small>`:''}</td><td>${esc(KLBL[u.k]||u.k)}</td><td>${RACKK.includes(u.k)?`${u.h} U${u.rj?' · '+u.rj+' RJ45':''}${u.sfp?' · '+u.sfp+' SFP':''}${u.poe?' · PoE':''}`:'in planimetria'}</td>
    <td style="white-space:nowrap"><button class="btn piccolo" data-ux="mEdit" data-id="${u.id}">Modifica</button> <button class="btn piccolo" data-ux="mDel" data-id="${u.id}">Elimina</button></td></tr>`).join('')}</table>`:'<p class="piccola">Non hai ancora aggiunto modelli.</p>'}
    <div class="btnrow" style="margin-top:12px"><button class="btn primario" data-ux="mNew" data-r="1">+ Nuovo modello</button></div>
    <p class="piccola">I tuoi modelli compaiono nella scheda Modelli con quelli del catalogo, in tutti i progetti di questo browser. Quelli usati in un progetto vengono salvati anche nel progetto, così si vedono quando lo esporti, lo condividi o lo apri da Gist su un altro computer.</p>`);
}

/* =====================================================================
   2) Archiviazione videosorveglianza
   ===================================================================== */
const BR={1:1.5,2:3,3:4,4:5,5:6,6:7,8:10,12:14};
const brBase=mp=>BR[mp]??Math.max(1,1.2*mp+.5);
const CODEC={h264:['H.264',1],h265:['H.265',.55],smart:['H.265+ / Smart Codec',.32]};
const QUAL={bassa:['bassa',.7],media:['media',1],alta:['alta',1.4]};
const RAID={none:'nessuno (JBOD)',r1:'RAID 1',r5:'RAID 5',r6:'RAID 6',r10:'RAID 10'};
function cc(){P.cctv??={};const c=P.cctv;c.codec??='h265';c.fps??=15;c.q??='media';c.mode??='cont';c.act??=30;c.days??=30;c.hours??=24;c.extra??=[];c.ovr??={};c.nvr??={};return c}
function camMP(d){const m=d.model&&MODELS[d.model];const t=m?`${m.note||''} ${m.m}`:'';let x=t.match(/(\d+(?:[.,]\d+)?)\s*MP/i);if(x)return Math.round(num(x[1]));if(/8K/.test(t))return 32;if(/4K/i.test(t))return 8;return 4}
function camGroups(){const c=cc();const g={};P.devices.filter(d=>d.kind==='cam').forEach(d=>{const mp=camMP(d);g[mp]=(g[mp]||0)+1});
  (c.extra||[]).forEach(e=>{const mp=Math.max(1,Math.round(num(e.mp,4)));g[mp]=(g[mp]||0)+Math.max(0,Math.round(num(e.n)))});
  return Object.entries(g).map(([mp,n])=>({mp:+mp,n})).filter(x=>x.n).sort((a,b)=>a.mp-b.mp)}
function brAuto(mp){const c=cc();return brBase(mp)*CODEC[c.codec][1]*Math.pow(num(c.fps,15)/15,.85)*QUAL[c.q][1]}
function bitrate(mp){const c=cc();return c.ovr[mp]?num(c.ovr[mp]):brAuto(mp)}
function storeCands(){
  const out=[];const isRec=t=>/NVR|NAS|dischi|DVA|storage/i.test(t);
  P.racks.forEach(r=>r.items.forEach(it=>{if(it.kind!=='srv')return;const m=it.props.model&&MODELS[it.props.model];const t=m?`${m.note||''} ${m.m}`:nm(it);if(m&&!isRec(t))return;out.push({id:'i:'+it.id,name:m?mName(m):nm(it),where:`${rid(r)} · U${it.pos}`,t,nvr:/NVR|DVA/i.test(t)})}));
  P.devices.forEach(d=>{const m=d.model&&MODELS[d.model];if(!m||d.kind!=='altro')return;const t=`${m.note||''} ${m.m}`;if(!isRec(t))return;out.push({id:'d:'+d.id,name:mName(m),where:devLabel(d)||planById(d.plan)?.name||'',t,nvr:/NVR|DVA/i.test(t)})});
  const c=cc();out.forEach(o=>{const s=c.nvr[o.id]||{};const ch=o.t.match(/(\d+)\s*canali/i),dk=o.t.match(/(\d+)\s*dischi/i);
    o.use=s.use??o.nvr;o.ch=s.ch??(ch?+ch[1]:'');o.disks=s.disks??(dk?+dk[1]:1);o.tb=s.tb??8;o.raid=s.raid??(o.disks>=4?'r5':o.disks>=2?'r1':'none');
    const n=num(o.disks),tb=num(o.tb);o.cap=(o.raid==='r1'||o.raid==='r10'?n*tb/2:o.raid==='r5'?Math.max(0,n-1)*tb:o.raid==='r6'?Math.max(0,n-2)*tb:n*tb)*.91});
  return out;
}
function cctvCalc(){
  const c=cc();const act=c.mode==='cont'?1:num(c.act,30)/100;const rows=camGroups().map(g=>{const br=bitrate(g.mp);const day=br*num(c.hours,24)*3600/8/1000*act;return {...g,br,day,tot:day*g.n*num(c.days,30)}});
  const cams=rows.reduce((s,r)=>s+r.n,0),mbps=rows.reduce((s,r)=>s+r.br*r.n,0),gbDay=rows.reduce((s,r)=>s+r.day*r.n,0),need=gbDay*num(c.days,30)/1000*1.1;
  const st=storeCands();const used=st.filter(o=>o.use);const cap=used.reduce((s,o)=>s+o.cap,0);const ch=used.every(o=>o.ch!=='')?used.reduce((s,o)=>s+num(o.ch),0):null;
  const msgs=[];
  if(!cams)msgs.push(['info','Nessuna telecamera: posizionale in planimetria o aggiungile a mano qui sotto.']);
  if(cams&&!used.length)msgs.push(['warn','Nessun NVR o NAS selezionato per la registrazione.']);
  if(cams&&used.length&&ch!=null&&ch<cams)msgs.push(['err',`Canali insufficienti: ${cams} telecamere, ${ch} canali disponibili.`]);
  if(cams&&used.length&&cap<need)msgs.push(['err',`Spazio insufficiente: servono circa ${fmt(need,1)} TB, disponibili ${fmt(cap,1)} TB (conservazione possibile circa ${gbDay?fmt(cap*1000/gbDay,0):0} giorni).`]);
  else if(cams&&used.length&&cap<need*1.15)msgs.push(['warn',`Spazio al limite: servono circa ${fmt(need,1)} TB su ${fmt(cap,1)} TB disponibili.`]);
  else if(cams&&used.length)msgs.push(['ok',`Spazio sufficiente: ${fmt(need,1)} TB necessari su ${fmt(cap,1)} TB disponibili (circa ${gbDay?fmt(cap*1000/gbDay,0):0} giorni di registrazione).`]);
  return {rows,cams,mbps,gbDay,need,st,cap,ch,msgs};
}
function cctvTable(k){return `<table class="vtab"><tr><th>Risoluzione</th><th>Telecamere</th><th>Bitrate (Mbps)</th><th>GB al giorno per telecamera</th><th>Totale (GB)</th></tr>${k.rows.map(r=>`<tr><td>${r.mp} MP</td><td>${r.n}</td><td>${fmt(r.br,1)}</td><td>${fmt(r.day,1)}</td><td>${fmt(r.tot,0)}</td></tr>`).join('')}<tr><th>Totale</th><th>${k.cams}</th><th>${fmt(k.mbps,1)}</th><th>${fmt(k.gbDay,0)} GB/giorno</th><th>${fmt(k.need,2)} TB (+10%)</th></tr></table>`}
function openCctv(){
  const c=cc();const k=cctvCalc();
  modal('Archiviazione videosorveglianza',`
  <div class="grid3">
    <div class="f"><label>Compressione</label>${sel('',Object.entries(CODEC).map(([a,[t]])=>[a,t]),c.codec,'data-cc="codec"')}</div>
    <div class="f"><label>Fotogrammi al secondo</label><input type="number" min="1" max="60" data-cc="fps" value="${c.fps}"></div>
    <div class="f"><label>Qualità</label>${sel('',Object.entries(QUAL).map(([a,[t]])=>[a,t]),c.q,'data-cc="q"')}</div>
    <div class="f"><label>Registrazione</label>${sel('',[['cont','continua'],['mot','su movimento']],c.mode,'data-cc="mode"')}</div>
    <div class="f"><label>Attività (su movimento)</label><div class="um"><input type="number" min="1" max="100" data-cc="act" value="${c.act}" ${c.mode==='cont'?'disabled':''}><span>%</span></div></div>
    <div class="f"><label>Ore al giorno</label><input type="number" min="1" max="24" data-cc="hours" value="${c.hours}"></div>
    <div class="f"><label>Giorni di conservazione</label><input type="number" min="1" max="365" data-cc="days" value="${c.days}"></div>
  </div>
  <div class="sez"><h3>Telecamere</h3>
    <table class="vtab"><tr><th>Risoluzione</th><th>Telecamere</th><th>Bitrate (Mbps)</th><th>GB al giorno per telecamera</th><th>Totale (GB)</th></tr>
    ${k.rows.map(r=>`<tr><td>${r.mp} MP</td><td>${r.n}</td><td><input type="number" step="0.1" min="0.1" data-ccb="${r.mp}" value="${c.ovr[r.mp]??''}" placeholder="${fmt(brAuto(r.mp),1)}" style="width:90px"></td><td>${fmt(r.day,1)}</td><td>${fmt(r.tot,0)}</td></tr>`).join('')||'<tr><td colspan="5" class="piccola">Nessuna telecamera.</td></tr>'}
    <tr><th>Totale</th><th>${k.cams}</th><th>${fmt(k.mbps,1)} in ingresso</th><th>${fmt(k.gbDay,0)} GB/giorno</th><th>${fmt(k.need,2)} TB</th></tr></table>
    <p class="piccola">Le telecamere vengono dalla planimetria (la risoluzione dal modello; 4 MP se non è indicata). Il bitrate è una stima: per un calcolo preciso scrivi quello impostato sulle telecamere. Il totale comprende un margine del 10%.</p>
    <div class="btnrow" style="margin-top:6px">${(c.extra||[]).map((e,i)=>`<span class="cc-x"><input type="number" min="0" data-cce="${i}" data-f="n" value="${e.n}" style="width:64px"> × <input type="number" min="1" data-cce="${i}" data-f="mp" value="${e.mp}" style="width:56px"> MP <button class="btn piccolo" data-ux="ccDel" data-i="${i}" title="Togli">✕</button></span>`).join('')}
      <button class="btn piccolo" data-ux="ccAdd">+ Telecamere non in planimetria</button></div></div>
  <div class="sez"><h3>NVR e NAS di registrazione</h3>
    ${k.st.length?`<table class="vtab"><tr><th>Usa</th><th>Apparato</th><th>Canali</th><th>Dischi</th><th>TB per disco</th><th>RAID</th><th>Spazio utile</th></tr>${k.st.map(o=>`<tr><td><input type="checkbox" data-ccn="${o.id}" data-f="use" ${o.use?'checked':''}></td><td><b>${esc(o.name)}</b><br><small>${esc(o.where)}</small></td>
      <td><input type="number" min="0" data-ccn="${o.id}" data-f="ch" value="${o.ch}" style="width:64px"></td><td><input type="number" min="1" max="100" data-ccn="${o.id}" data-f="disks" value="${o.disks}" style="width:60px"></td>
      <td><input type="number" min="1" step="1" data-ccn="${o.id}" data-f="tb" value="${o.tb}" style="width:64px"></td><td>${sel('',Object.entries(RAID),o.raid,`data-ccn="${o.id}" data-f="raid"`)}</td><td>${fmt(o.cap,1)} TB</td></tr>`).join('')}</table>`
      :'<p class="piccola">Nessun NVR o NAS nel progetto: aggiungilo a un armadio (Server, NAS, NVR e storage) o posizionalo in planimetria.</p>'}
  </div>
  <div class="sez"><h3>Esito</h3>${k.msgs.map(([l,m])=>`<div class="esito ${l}">${esc(m)}</div>`).join('')}</div>`);
}
function cctvInput(e){
  const t=e.target;const c=cc();
  if(t.dataset.cc){c[t.dataset.cc]=t.type==='number'?num(t.value):t.value}
  else if(t.dataset.ccb){const v=num(t.value);if(v>0)c.ovr[t.dataset.ccb]=v;else delete c.ovr[t.dataset.ccb]}
  else if(t.dataset.cce){c.extra[+t.dataset.cce][t.dataset.f]=num(t.value)}
  else if(t.dataset.ccn){const s=(c.nvr[t.dataset.ccn]??={});const f=t.dataset.f;s[f]=t.type==='checkbox'?t.checked:f==='raid'?t.value:t.value===''?'':num(t.value)}
  else return false;
  quietSave();keepScroll(openCctv);return true;
}

/* =====================================================================
   3) Piano degli indirizzi IP
   ===================================================================== */
const ip2n=s=>{const m=String(s||'').trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);if(!m)return null;const p=m.slice(1).map(Number);if(p.some(x=>x>255))return null;return ((p[0]<<24)>>>0)+(p[1]<<16)+(p[2]<<8)+p[3]};
const n2ip=n=>[n>>>24,(n>>>16)&255,(n>>>8)&255,n&255].join('.');
function cidr(s){const m=String(s||'').trim().match(/^([\d.]+)\/(\d{1,2})$/);if(!m)return null;const ip=ip2n(m[1]);const pre=+m[2];if(ip==null||pre>32)return null;const mask=pre?((0xffffffff<<(32-pre))>>>0):0;const net=(ip&mask)>>>0;return {net,mask,pre,bcast:(net|(~mask>>>0))>>>0}}
const inNet=(n,c)=>((n&c.mask)>>>0)===c.net;
const IPK=['fw','router','sw','srv','hub','mc','ups','vde','poe'];
const CATS={infra:'Apparati di rete',srv:'Server e NAS',power:'UPS e PDU',ap:'Access point',cam:'Telecamere',altro:'Altri apparati'};
const catOf=k=>['fw','router','sw','hub','mc','poe'].includes(k)?'infra':k==='srv'?'srv':['ups','vde'].includes(k)?'power':k;
function ipp(){P.ipplan??={};const p=P.ipplan;p.map??={};p.start??=10;const mg=(P.vlans||[]).find(v=>v.mgmt)||(P.vlans||[])[0];Object.keys(CATS).forEach(c=>{if(p.map[c]==null||!(P.vlans||[]).some(v=>v.id===p.map[c]))p.map[c]=mg?.id||''});return p}
function ipRows(){
  const rows=[];
  P.racks.forEach(r=>[...r.items].sort((a,b)=>b.pos-a.pos).forEach(it=>{if(!IPK.includes(it.kind))return;const m=it.props.model&&MODELS[it.props.model];
    rows.push({key:'i:'+r.id+':'+it.id,o:it.props,name:m?mName(m):nm(it),where:`${rid(r)} · U${it.pos}`,cat:catOf(it.kind)})}));
  P.devices.forEach(d=>{if(!['ap','cam','altro'].includes(d.kind))return;const m=d.model&&MODELS[d.model];
    rows.push({key:'d:'+d.id,o:d,name:d.name||(m?mName(m):DEV[d.kind].short),where:devLabel(d)||planById(d.plan)?.name||'',cat:d.kind})});
  const p=ipp();const cnt={};
  rows.forEach(x=>{x.vid=x.o.ipVlan&&(P.vlans||[]).some(v=>v.id===x.o.ipVlan)?x.o.ipVlan:p.map[x.cat];x.vlan=(P.vlans||[]).find(v=>v.id===x.vid);x.ip=(x.o.ip||'').trim();if(x.ip)cnt[x.ip]=(cnt[x.ip]||0)+1});
  rows.forEach(x=>{if(!x.ip){x.st='';return}const n=ip2n(x.ip);if(n==null){x.st='err:IP non valido';return}
    if(cnt[x.ip]>1){x.st='err:IP duplicato';return}const c=x.vlan&&cidr(x.vlan.subnet);
    if(c){if(!inNet(n,c)){x.st='warn:fuori dalla subnet della VLAN';return}if(n===c.net||n===c.bcast){x.st='err:indirizzo di rete o broadcast';return}if(x.vlan.gw&&x.vlan.gw.trim()===x.ip){x.st='err:coincide con il gateway';return}}
    x.st='ok:'});
  return rows;
}
function autoAssign(all){
  const p=ipp();const rows=ipRows();const used=new Set(rows.filter(x=>x.ip&&!(all&&x.vlan)).map(x=>ip2n(x.ip)).filter(n=>n!=null));
  (P.vlans||[]).forEach(v=>{const g=ip2n(v.gw);if(g!=null)used.add(g)});
  let n=0,miss=0;const order=['infra','srv','power','ap','cam','altro'];
  mutate(()=>{rows.sort((a,b)=>order.indexOf(a.cat)-order.indexOf(b.cat)).forEach(x=>{
    if(x.ip&&!all&&x.st.startsWith('ok'))return;
    const c=x.vlan&&cidr(x.vlan.subnet);if(!c){if(!x.ip)miss++;return}
    let h=Math.max(1,Math.round(num(p.start,10)));
    for(;c.net+h<c.bcast;h++){const ip=c.net+h;if(!used.has(ip)){used.add(ip);x.o.ip=n2ip(ip);n++;return}}
    miss++});});
  toast(n?`${n} indirizzi assegnati${miss?`, ${miss} senza subnet o spazio libero`:''}`:miss?'Definisci le subnet delle VLAN per assegnare gli indirizzi':'Tutti gli apparati hanno già un indirizzo valido');
  keepScroll(openIp);
}
const macNorm=m=>{const h=String(m||'').replace(/[^0-9a-f]/gi,'');return h.length===12?h.toUpperCase().match(/../g).join(':'):''};
function ipCsv(){const rows=ipRows();return X().csv([['Apparato','Posizione','Categoria','VLAN','Subnet','Gateway','Indirizzo IP','MAC','Stato'],...rows.map(x=>[x.name,x.where,CATS[x.cat],x.vlan?x.vlan.vid+' '+(x.vlan.name||''):'',x.vlan?.subnet||'',x.vlan?.gw||'',x.ip,macNorm(x.o.mac)||x.o.mac||'',x.st.split(':')[1]||''])])}
function ipRsc(){
  const rows=ipRows().filter(x=>x.ip&&x.st.startsWith('ok'));const L=['# Network Design Center — lease DHCP statiche',`# Progetto «${P.name}» · generato il ${today()}`,'# Gli apparati senza MAC sono elencati come commento: aggiungi il MAC nell\'inventario per creare la lease.','','/ip dhcp-server lease'];
  rows.forEach(x=>{const m=macNorm(x.o.mac);const cm=`${x.name} · ${x.where}`.replace(/"/g,"'");if(m)L.push(`add address=${x.ip} mac-address=${m} comment="${cm}"`);else L.push(`# senza MAC: ${cm} → ${x.ip}`)});
  return L.join('\n')+'\n';
}
function openIp(){
  const p=ipp();const rows=ipRows();const V=P.vlans||[];
  const vopt=[['','— nessuna —'],...V.map(v=>[v.id,`VLAN ${v.vid} ${v.name||''}${v.subnet?' · '+v.subnet:''}`])];
  const bad=rows.filter(x=>x.st.startsWith('err')).length,warn=rows.filter(x=>x.st.startsWith('warn')).length,empty=rows.filter(x=>!x.ip).length;
  modal('Piano indirizzi IP',`${V.length?'':'<div class="esito warn">Non ci sono VLAN: definiscile con le loro subnet (menu ⋯ → VLAN e indirizzi IP) per assegnare gli indirizzi in automatico.</div>'}
  <div class="sez"><h3>VLAN per tipo di apparato</h3><div class="grid3">${Object.entries(CATS).map(([c,t])=>`<div class="f"><label>${t}</label>${sel('',vopt,p.map[c],`data-ipc="${c}"`)}</div>`).join('')}
    <div class="f"><label>Primo indirizzo da usare (host)</label><input type="number" min="1" max="250" data-ipstart value="${p.start}"></div></div>
    <div class="btnrow" style="margin-top:8px"><button class="btn primario" data-ux="ipAuto">Assegna gli indirizzi mancanti</button><button class="btn" data-ux="ipAll">Riassegna tutti</button>
      <button class="btn" data-ux="ipCsv">Scarica CSV</button><button class="btn" data-ux="ipRsc">Lease DHCP per RouterOS (.rsc)</button></div>
    <p class="piccola">L'assegnazione salta il gateway e gli indirizzi già usati. Gli indirizzi si possono anche scrivere a mano nella tabella; MAC e IP sono gli stessi dell'inventario degli apparati.</p></div>
  <div class="kv"><span>${rows.length} apparati · ${empty} senza indirizzo</span><b>${bad?`<span style="color:var(--err)">${bad} errori</span>`:''}${bad&&warn?' · ':''}${warn?`<span style="color:var(--warn)">${warn} avvisi</span>`:''}${!bad&&!warn?'✓':''}</b></div>
  ${rows.length?`<table class="vtab"><tr><th>Apparato</th><th>Posizione</th><th>VLAN</th><th>Indirizzo IP</th><th>MAC</th><th>Stato</th></tr>${rows.map(x=>{const [l,t]=x.st.split(':');
    return `<tr><td><b>${esc(x.name)}</b><br><small>${esc(CATS[x.cat])}</small></td><td><small>${esc(x.where)}</small></td><td>${sel('',[['','(come il tipo)'],...V.map(v=>[v.id,'VLAN '+v.vid])],x.o.ipVlan||'',`data-ipv="${x.key}" style="max-width:130px"`)}</td>
    <td><input type="text" data-ipk="${x.key}" value="${esc(x.ip)}" placeholder="${x.vlan?.subnet?esc(x.vlan.subnet.replace(/\/\d+$/,'')):''}" style="width:130px"></td><td><small class="mono">${esc(macNorm(x.o.mac)||x.o.mac||'')}</small></td>
    <td>${l==='ok'?'<span style="color:var(--ok)">✓</span>':l?`<span style="color:var(--${l==='err'?'err':'warn'})">${esc(t)}</span>`:''}</td></tr>`}).join('')}</table>`:'<p class="piccola">Nessun apparato a cui assegnare un indirizzo.</p>'}`);
}
function ipObj(key){const [t,a,b]=key.split(':');if(t==='d')return P.devices.find(d=>d.id===a);const r=rackById(a);return r&&r.items.find(i=>i.id===b)?.props}
function ipInput(e){
  const t=e.target;
  if(t.dataset.ipc){mutate(()=>{ipp().map[t.dataset.ipc]=t.value});keepScroll(openIp);return true}
  if(t.hasAttribute('data-ipstart')){ipp().start=Math.max(1,Math.round(num(t.value,10)));quietSave();return true}
  if(t.dataset.ipv){mutate(()=>{const o=ipObj(t.dataset.ipv);if(o){if(t.value)o.ipVlan=t.value;else delete o.ipVlan}});keepScroll(openIp);return true}
  if(t.dataset.ipk){mutate(()=>{const o=ipObj(t.dataset.ipk);if(o)o.ip=t.value.trim()});keepScroll(openIp);return true}
  return false;
}

/* =====================================================================
   4) Importazione dell'elenco prese (Excel / CSV)
   ===================================================================== */
async function unzip(buf){
  const dv=new DataView(buf);let e=buf.byteLength-22;while(e>=0&&dv.getUint32(e,true)!==0x06054b50)e--;if(e<0)throw new Error('zip');
  const n=dv.getUint16(e+10,true);let p=dv.getUint32(e+16,true);const files={};const td=new TextDecoder();
  for(let i=0;i<n;i++){if(dv.getUint32(p,true)!==0x02014b50)break;const comp=dv.getUint16(p+10,true),cs=dv.getUint32(p+20,true),nl=dv.getUint16(p+28,true),xl=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),lo=dv.getUint32(p+42,true);
    files[td.decode(new Uint8Array(buf,p+46,nl))]={comp,cs,lo};p+=46+nl+xl+cl}
  return async name=>{const f=files[name];if(!f)return null;const lnl=dv.getUint16(f.lo+26,true),lxl=dv.getUint16(f.lo+28,true);const data=new Uint8Array(buf,f.lo+30+lnl+lxl,f.cs);
    if(f.comp===0)return td.decode(data);return await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text()};
}
const xml=t=>new DOMParser().parseFromString(t,'application/xml');
const colIdx=ref=>{const m=String(ref).match(/^([A-Z]+)/);if(!m)return 0;let n=0;for(const ch of m[1])n=n*26+ch.charCodeAt(0)-64;return n-1};
async function readXlsx(buf){
  const get=await unzip(buf);let sheet='xl/worksheets/sheet1.xml';
  try{const wb=xml(await get('xl/workbook.xml'));const s1=wb.getElementsByTagName('sheet')[0];const rid=s1&&(s1.getAttribute('r:id')||s1.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id'));
    const rels=xml(await get('xl/_rels/workbook.xml.rels'));for(const r of rels.getElementsByTagName('Relationship'))if(r.getAttribute('Id')===rid){const t=r.getAttribute('Target');sheet=t.startsWith('/')?t.slice(1):'xl/'+t.replace(/^\.\//,'')}}catch(_){}
  const ss=[];const sst=await get('xl/sharedStrings.xml');if(sst)for(const si of xml(sst).getElementsByTagName('si'))ss.push([...si.getElementsByTagName('t')].map(t=>t.textContent).join(''));
  const sx=await get(sheet);if(!sx)throw new Error('sheet');const out=[];
  for(const row of xml(sx).getElementsByTagName('row')){const a=[];for(const c of row.getElementsByTagName('c')){const t=c.getAttribute('t');let v;
      if(t==='s')v=ss[+(c.getElementsByTagName('v')[0]?.textContent||0)]??'';else if(t==='inlineStr')v=[...c.getElementsByTagName('t')].map(x=>x.textContent).join('');else v=c.getElementsByTagName('v')[0]?.textContent??'';
      a[colIdx(c.getAttribute('r'))]=v}
    out.push(Array.from(a,x=>x??''))}
  return out;
}
function readCsv(t){
  t=t.replace(/^﻿/,'');const first=t.split(/\r?\n/)[0]||'';const sep=[';','\t',','].sort((a,b)=>first.split(b).length-first.split(a).length)[0];
  const rows=[];let row=[],f='',q=false;
  for(let i=0;i<t.length;i++){const ch=t[i];
    if(q){if(ch==='"'){if(t[i+1]==='"'){f+='"';i++}else q=false}else f+=ch}
    else if(ch==='"')q=true;else if(ch===sep){row.push(f);f=''}else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&t[i+1]==='\n')i++;row.push(f);rows.push(row);row=[];f=''}else f+=ch}
  if(f||row.length){row.push(f);rows.push(row)}
  return rows.filter(r=>r.some(x=>String(x).trim()));
}
let IMP=null;
function guessCols(h){const g={label:-1,room:-1,note:-1,rack:-1};h.forEach((x,i)=>{const s=String(x).toLowerCase();
  if(g.label<0&&/etichett|presa|label|punto|outlet|codice|id\b/.test(s))g.label=i;else if(g.room<0&&/locale|stanza|aula|room|ubicaz|ufficio|ambiente|destinaz/.test(s))g.room=i;
  else if(g.rack<0&&/armadio|rack|quadro/.test(s))g.rack=i;else if(g.note<0&&/note|descri|uso|utente/.test(s))g.note=i});if(g.label<0)g.label=0;return g}
function findRack(id){id=String(id||'').trim().toUpperCase();if(!id)return null;const a=P.racks.filter(r=>rid(r).toUpperCase()===id);if(a.length===1)return a[0];const b=P.racks.filter(r=>rid(r,true).toUpperCase()===id);return b.length===1?b[0]:null}
function resolveRow(row,o){
  const lab=String(row[o.label]??'').trim().toUpperCase().replace(/\s+/g,'');if(!lab)return {st:'skip'};
  const m=lab.match(/^(?:(.+)\.)?([A-Z])[-.]?(\d{1,3})$/);if(!m)return {lab,st:'err',msg:'etichetta non riconosciuta'};
  let r=m[1]?findRack(m[1]):null;if(m[1]&&!r)return {lab,st:'err',msg:`armadio ${m[1]} non trovato`};
  if(!r&&o.rack>=0&&String(row[o.rack]??'').trim()){r=findRack(row[o.rack]);if(!r)return {lab,st:'err',msg:`armadio ${row[o.rack]} non trovato`}}
  if(!r)r=rackById(o.def);if(!r)return {lab,st:'err',msg:'armadio non indicato'};
  const L=panelLetters(r);const it=r.items.find(i=>L[i.id]===m[2]);
  if(!it)return {lab,r,st:'err',msg:`pannello ${m[2]} non presente in ${rid(r)}`};if(it.kind!=='patch')return {lab,r,st:'err',msg:`${m[2]} è un cassetto ottico`};
  const n=+m[3];if(n<1||n>+it.props.ports)return {lab,r,st:'err',msg:`il pannello ${m[2]} ha ${it.props.ports} prese`};
  const pd=it.ports[n];if(pd&&pd.t==='link')return {lab,r,it,n,st:'err',msg:'la presa è una tratta tra armadi'};
  const room=[o.room>=0?String(row[o.room]??'').trim():'',o.note>=0?String(row[o.note]??'').trim():''].filter(Boolean).join(' · ');
  if(!room)return {lab,r,it,n,st:'skip',msg:'locale vuoto'};
  const same=(pd?.note||'')===room;if(pd?.note&&!same&&!o.over)return {lab,r,it,n,room,st:'keep',msg:`ha già il locale «${pd.note}»`};
  return {lab,r,it,n,room,st:same?'same':'ok',full:wallLabel(r,it,n,L)};
}
function openImport(){
  const o=IMP.o;const rows=IMP.rows.slice(o.head?1:0);const h=o.head?IMP.rows[0]:IMP.rows[0].map((_,i)=>'Colonna '+(i+1));
  const cols=[['-1','— nessuna —'],...h.map((x,i)=>[i,String(x||'Colonna '+(i+1)).slice(0,40)])];
  const res=rows.map(r=>resolveRow(r,o));IMP.res=res;const c=s=>res.filter(x=>x.st===s).length;
  modal('Importa elenco prese',`<div class="grid3">
    <div class="f"><label>Colonna etichetta della presa</label>${sel('',cols.slice(1),o.label,'data-im="label"')}</div>
    <div class="f"><label>Colonna locale</label>${sel('',cols,o.room,'data-im="room"')}</div>
    <div class="f"><label>Colonna note (aggiunte al locale)</label>${sel('',cols,o.note,'data-im="note"')}</div>
    <div class="f"><label>Colonna armadio</label>${sel('',cols,o.rack,'data-im="rack"')}</div>
    <div class="f"><label>Armadio predefinito</label>${sel('',P.racks.map(r=>[r.id,rid(r)]),o.def,'data-im="def"')}</div>
    </div><div class="btnrow" style="gap:18px;margin:6px 0"><label class="chk"><input type="checkbox" data-im="head" ${o.head?'checked':''}><span>La prima riga contiene le intestazioni</span></label><label class="chk"><input type="checkbox" data-im="over" ${o.over?'checked':''}><span>Sostituisci i locali già presenti</span></label></div>
  <p class="piccola">L'etichetta può essere completa (BA.FA1.C12) oppure solo pannello e numero (C12): in quel caso vale la colonna armadio o l'armadio predefinito. Il locale viene scritto sulla presa del patch panel.</p>
  <div class="kv"><span>${rows.length} righe · <b style="color:var(--ok)">${c('ok')} da importare</b> · ${c('same')} già uguali · ${c('keep')} con un altro locale · ${c('skip')} vuote</span><b style="color:${c('err')?'var(--err)':'inherit'}">${c('err')} errori</b></div>
  <div style="max-height:40vh;overflow:auto"><table class="vtab"><tr><th>#</th><th>Etichetta</th><th>Presa</th><th>Locale</th><th>Esito</th></tr>${res.slice(0,500).map((x,i)=>`<tr><td>${i+1+(o.head?1:0)}</td><td class="mono">${esc(x.lab||'')}</td><td class="mono">${esc(x.full||'')}</td><td>${esc(x.room||'')}</td>
    <td>${x.st==='ok'?'<span style="color:var(--ok)">da importare</span>':x.st==='same'?'già uguale':x.st==='keep'?`<span style="color:var(--warn)">${esc(x.msg)}</span>`:x.st==='err'?`<span style="color:var(--err)">${esc(x.msg)}</span>`:`<span class="piccola">${esc(x.msg||'riga vuota')}</span>`}</td></tr>`).join('')}</table></div>
  <div class="btnrow" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-close>Annulla</button><button class="btn primario" data-ux="imApply" ${c('ok')?'':'disabled'}>Importa ${c('ok')} prese</button></div>`);
}
function importInput(e){const t=e.target;if(!t.dataset.im||!IMP)return false;const k=t.dataset.im;IMP.o[k]=t.type==='checkbox'?t.checked:k==='def'?t.value:+t.value;keepScroll(openImport);return true}
function importApply(){
  const ok=IMP.res.filter(x=>x.st==='ok');let n=0;
  mutate(()=>{ok.forEach(x=>{const r=rackById(x.r.id);const it=r&&r.items.find(i=>i.id===x.it.id);if(!it)return;it.ports[x.n]={...(it.ports[x.n]||{t:'user'}),note:x.room};n++});
    const by={};ok.forEach(x=>{by[x.r.id]=(by[x.r.id]||0)+1});Object.entries(by).forEach(([id,c])=>{const r=rackById(id);r.log??=[];const T=window.NDC_tr||(s=>s);r.log.push({id:uid(),d:new Date().toISOString().slice(0,10),a:P.author||'',t:T(`Importati i locali di ${c} prese da «${IMP.file}».`)})})});
  closeModal();toast(`${n} prese aggiornate`);IMP=null;
}
async function importFile(f){
  try{let rows;if(/\.xlsx$/i.test(f.name))rows=await readXlsx(await f.arrayBuffer());else if(/\.xls$/i.test(f.name)){toast('Il vecchio formato .xls non è supportato: salva il file come .xlsx o CSV');return}else rows=readCsv(await f.text());
    if(!rows.length){toast('Il file non contiene righe');return}
    const w=Math.max(...rows.map(r=>r.length));rows=rows.map(r=>{const a=[...r];while(a.length<w)a.push('');return a});
    const g=guessCols(rows[0]);IMP={file:f.name,rows,o:{...g,def:R().id,head:true,over:false}};openImport();
  }catch(e){console.error(e);toast('Impossibile leggere il file: usa .xlsx o CSV')}
}

/* =====================================================================
   5) Relazione completa (stampa / PDF)
   ===================================================================== */
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function openReport(){
  const st=P.report||{};const has=k=>st[k]!==false;
  const hasCam=P.devices.some(d=>d.kind==='cam');
  modal('Relazione completa',`<div class="grid2">
    <div class="f"><label>Committente</label><input type="text" id="rpC" value="${esc(st.client||'')}" placeholder="es. Istituto …"></div>
    <div class="f"><label>Redatta da</label><input type="text" id="rpA" value="${esc(st.author||P.author||'')}" placeholder="Nome e cognome"></div>
    <div class="f" style="grid-column:1/-1"><label>Oggetto / note introduttive</label><textarea id="rpN" rows="3" placeholder="es. Realizzazione della rete dati del piano terra">${esc(st.notes||'')}</textarea></div></div>
  <div class="sez"><h3>Sezioni</h3><div class="grid2">${[['plans','Planimetrie con prese e apparati'],['racks','Fogli di armadio (disposizione, prese, permutazioni, alimentazione, inventario, certificazioni, registro)'],['bom','Distinta materiali'],['ip','Piano indirizzi IP'],['cctv','Archiviazione videosorveglianza'+(hasCam?'':' (nessuna telecamera)')],['issues','Riepilogo delle segnalazioni']].map(([k,t])=>`<label class="chk"><input type="checkbox" data-rp="${k}" ${has(k)?'checked':''}><span>${t}</span></label>`).join('')}</div></div>
  <p class="piccola">La relazione si apre nella finestra di stampa del browser: scegli «Salva come PDF» per ottenere il file.</p>
  <div class="btnrow" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-close>Annulla</button><button class="btn primario" data-ux="rpGo">Genera la relazione</button></div>`);
}
function wallCount(){let n=0;P.racks.forEach(r=>r.items.filter(i=>i.kind==='patch').forEach(it=>{for(let k=1;k<=+it.props.ports;k++){const pd=it.ports[k];if(pd&&pd.t==='link')continue;if(pd?.note||devAtPort(r.id,it.id,k))n++}}));return n}
async function buildReport(){
  const st=P.report={client:$('#rpC').value.trim(),author:$('#rpA').value.trim(),notes:$('#rpN').value.trim()};$$('[data-rp]').forEach(c=>st[c.dataset.rp]=c.checked);quietSave();
  closeModal();toast('Preparazione della relazione…');
  const keep={rack:S.rack,plan:S.plan,view:S.view,item:S.item,port:S.port};const wp=window.print;window.print=()=>{};const parts=[];
  const I=P.racks.map(r=>({r,I:validate(r)}));
  try{
    const toc=[];
    if(st.plans&&P.plans.length){toc.push('Planimetrie');for(const pl of P.plans){S.plan=pl.id;$('#print').innerHTML='';try{await printPlan();await sleep(250);if($('#print img.pianta'))parts.push(['pl',$('#print').innerHTML])}catch(_){}}}
    if(st.racks){toc.push('Fogli di armadio');for(const r of P.racks){S.rack=r.id;S.item=null;$('#print').innerHTML='';printRack();parts.push(['rk',$('#print').innerHTML])}}
    if(st.bom){toc.push('Distinta materiali');const rows=X().bom('project');parts.push(['bom',`<h1>Distinta materiali</h1><table><tr><th>Categoria</th><th>Marca</th><th>Articolo</th><th>Q.tà</th></tr>${rows.map(r=>`<tr><td>${esc(r.cat)}</td><td>${esc(r.brand)}</td><td>${esc(r.model)}</td><td>${r.q} ${r.unit}</td></tr>`).join('')}</table>`])}
    if(st.ip){const rows=ipRows().filter(x=>x.ip||x.o.mac);if(rows.length||(P.vlans||[]).length){toc.push('Piano indirizzi IP');
      parts.push(['ip',`<h1>Piano indirizzi IP</h1>${(P.vlans||[]).length?`<h2>VLAN</h2><table><tr><th>VLAN</th><th>Nome</th><th>Subnet</th><th>Gateway</th><th>Gestione</th></tr>${[...P.vlans].sort((a,b)=>a.vid-b.vid).map(v=>`<tr><td>${v.vid}</td><td>${esc(v.name||'')}</td><td>${esc(v.subnet||'')}</td><td>${esc(v.gw||'')}</td><td>${v.mgmt?'sì':''}</td></tr>`).join('')}</table>`:''}
        ${rows.length?`<h2>Indirizzi degli apparati</h2><table><tr><th>Apparato</th><th>Posizione</th><th>VLAN</th><th>Indirizzo IP</th><th>MAC</th></tr>${rows.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.where)}</td><td>${x.vlan?x.vlan.vid:''}</td><td>${esc(x.ip)}</td><td>${esc(macNorm(x.o.mac)||x.o.mac||'')}</td></tr>`).join('')}</table>`:''}`])}}
    if(st.cctv&&P.devices.some(d=>d.kind==='cam')){toc.push('Archiviazione videosorveglianza');const k=cctvCalc();const c=cc();
      parts.push(['cc',`<h1>Archiviazione videosorveglianza</h1><div>${CODEC[c.codec][0]} · ${c.fps} fps · qualità ${QUAL[c.q][0]} · registrazione ${c.mode==='cont'?'continua':'su movimento ('+c.act+'%)'} · ${c.hours} ore al giorno · conservazione ${c.days} giorni</div>${cctvTable(k)}
        ${k.st.filter(o=>o.use).length?`<h2>NVR e NAS</h2><table><tr><th>Apparato</th><th>Posizione</th><th>Canali</th><th>Dischi</th><th>RAID</th><th>Spazio utile</th></tr>${k.st.filter(o=>o.use).map(o=>`<tr><td>${esc(o.name)}</td><td>${esc(o.where)}</td><td>${o.ch}</td><td>${o.disks} × ${o.tb} TB</td><td>${RAID[o.raid]}</td><td>${fmt(o.cap,1)} TB</td></tr>`).join('')}</table>`:''}
        <h2>Esito</h2>${k.msgs.map(([,m])=>`<div>${esc(m)}</div>`).join('')}`])}
    if(st.issues){const all=I.flatMap(x=>x.I.map(i=>[rid(x.r),i]));const pi=P.plans.flatMap(pl=>validatePlan(pl).map(i=>[pl.name,i]));toc.push('Riepilogo delle segnalazioni');
      parts.push(['is',`<h1>Riepilogo delle segnalazioni</h1>${all.length+pi.length?`<table><tr><th>Dove</th><th>Livello</th><th>Elemento</th><th>Segnalazione</th></tr>${[...all,...pi].map(([w,i])=>`<tr><td>${esc(w)}</td><td>${{err:'Errore',warn:'Avviso',info:'Nota'}[i.lvl]}</td><td>${esc(i.ref)}</td><td>${esc(i.msg)}</td></tr>`).join('')}</table>`:'<div>Nessuna segnalazione.</div>'}`])}
    // copertina
    const dk={};P.devices.forEach(d=>dk[d.kind]=(dk[d.kind]||0)+1);
    const bl=new Set([...P.racks.filter(r=>r.type!=='CD').map(r=>r.b),...P.plans.map(p=>p.b)].filter(Boolean));
    const cover=`<div class="rp-cover"><div class="rp-k">Relazione di progetto</div><h1 class="rp-t">${esc(P.name)}</h1>${st.client?`<div class="rp-c">${esc(st.client)}</div>`:''}
      ${st.notes?`<p class="rp-n">${esc(st.notes).replace(/\n/g,'<br>')}</p>`:''}
      <table class="rp-meta"><tr><td>Data</td><td>${today()}</td></tr>${st.author?`<tr><td>Redatta da</td><td>${esc(st.author)}</td></tr>`:''}<tr><td>Strumento</td><td>Network Design Center</td></tr></table>
      <h2>Riepilogo</h2><table><tr><th>Edifici</th><th>Armadi</th><th>Prese utente</th><th>Access point</th><th>Telecamere</th><th>Altri apparati</th><th>Planimetrie</th></tr>
      <tr><td>${bl.size||'—'}</td><td>${P.racks.length}</td><td>${wallCount()}</td><td>${dk.ap||0}</td><td>${dk.cam||0}</td><td>${dk.altro||0}</td><td>${P.plans.length}</td></tr></table>
      <h2>Armadi</h2><table><tr><th>Armadio</th><th>Tipo</th><th>Unità</th><th>Occupazione</th><th>Conformità</th></tr>${I.map(({r,I})=>{const used=r.items.reduce((s,i)=>s+(i.kind==='blank'?0:i.h),0);return `<tr><td>${esc(rid(r))}</td><td>${TYPES[r.type].it}</td><td>${r.units} U</td><td>${used}/${r.units} U</td><td>${score(I)}% · ${I.filter(i=>i.lvl==='err').length} errori, ${I.filter(i=>i.lvl==='warn').length} avvisi</td></tr>`}).join('')}</table>
      ${toc.length?`<h2>Contenuto</h2><ol class="rp-toc">${toc.map(t=>`<li>${t}</li>`).join('')}</ol>`:''}</div>`;
    window.print=wp;
    $('#print').innerHTML=`<div class="relazione">${cover}${parts.map(([k,h])=>`<section class="rp-sec rp-${k}">${h}</section>`).join('')}</div>`;
  }finally{window.print=wp;Object.assign(S,keep);render()}
  await sleep(200);window.print();
}

/* =====================================================================
   eventi e menu
   ===================================================================== */
document.addEventListener('click',e=>{const b=e.target.closest('[data-ux]');if(!b)return;const a=b.dataset.ux;
  ({mNew:()=>modelForm(null,b.dataset.r!=='0'),mList:modelList,mEdit:()=>modelForm(b.dataset.id),mSave:()=>saveModelForm(b.dataset.id),
    mDel:()=>{const u=userModels().find(x=>x.id===b.dataset.id);if(!u||!confirm(`Eliminare il modello «${u.m}»? Gli apparati già inseriti nei progetti restano.`))return;saveUserModels(userModels().filter(x=>x.id!==u.id));if(!usedUserModels().some(x=>x.id===u.id))delete MODELS[u.id];render();modelList()},
    ccAdd:()=>{cc().extra.push({n:4,mp:4});quietSave();keepScroll(openCctv)},ccDel:()=>{cc().extra.splice(+b.dataset.i,1);quietSave();keepScroll(openCctv)},
    ipAuto:()=>autoAssign(false),ipAll:()=>{if(confirm('Riassegnare tutti gli indirizzi secondo le VLAN scelte? Gli indirizzi attuali vengono sostituiti (puoi tornare indietro con Ctrl+Z).'))autoAssign(true)},
    ipCsv:()=>download(slug(P.name)+'-indirizzi-ip.csv',ipCsv(),'text/csv;charset=utf-8'),ipRsc:()=>download(slug(P.name)+'-lease-dhcp.rsc',ipRsc(),'text/plain'),
    imApply:importApply,rpGo:buildReport})[a]?.();
});
document.addEventListener('change',e=>{if(!$('#modal').classList.contains('open'))return;cctvInput(e)||ipInput(e)||importInput(e)});
const fin=document.createElement('input');fin.type='file';fin.accept='.xlsx,.csv,.txt,.xls';fin.hidden=true;document.body.appendChild(fin);
fin.onchange=()=>{const f=fin.files[0];fin.value='';if(f)importFile(f)};
$('#moreMenu .menu-lista').addEventListener('click',e=>{const m=e.target.closest('[data-m]')?.dataset.m;
  ({umodels:modelList,cctv:openCctv,ipplan:openIp,importOut:()=>fin.click(),report:openReport})[m]?.()});
window.NDC_tools={userModels,regModel,cctvCalc,ipRows,autoAssign,ipRsc,readCsv,readXlsx,resolveRow,importFile,buildReport};

(function go(){if(!P){setTimeout(go,30);return}(P.umodels||[]).forEach(regModel);render()})();
})();
