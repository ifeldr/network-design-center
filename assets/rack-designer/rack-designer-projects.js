/* =====================================================================
   Network Design Center — più progetti nel browser, versioni con confronto, ricerca globale
   ===================================================================== */
(function(){
'use strict';
const loc=()=>window.NDC_lang==='en'?'en-GB':'it-IT';
const dt=t=>new Date(t).toLocaleString(loc(),{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
const day=t=>new Date(t).toLocaleDateString(loc(),{day:'2-digit',month:'2-digit',year:'numeric'});
const todayIso=()=>new Date().toISOString().slice(0,10);
const pl=(n,a,b)=>n+' '+(n===1?a:b);
const iname=it=>{const m=it.props?.model&&MODELS[it.props.model];return m?`${VENDORS[m.v]?.n||''} ${m.m}`.trim():nm(it)};
const ICO_DIR='<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>';

/* =====================================================================
   1) I miei progetti
   ===================================================================== */
function kb(){let n=0;try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);n+=k.length+(localStorage.getItem(k)||'').length}}catch(_){}return Math.round(n*2/1024)}
function projectsHtml(){
  const l=projIndex();const cur=P.pid;
  const rows=l.map(x=>{const on=x.id===cur;
    return `<div class="pj ${on?'on':''}">
      <div class="pj-ic"><svg viewBox="0 0 24 24">${ICO_DIR}</svg></div>
      <div class="grow"><div class="pj-n">${esc(x.name||'—')}${on?' <span class="badge ok">aperto</span>':''}</div>
        <div class="sub">${pl(x.racks,'armadio','armadi')} · ${pl(x.plans,'planimetria','planimetrie')} · ${pl(x.devices||0,'apparato','apparati')} in pianta · modificato il ${dt(x.upd)}</div></div>
      <div class="btnrow">${on?'':`<button class="btn piccolo primario" data-pj="open" data-id="${x.id}">Apri</button>`}
        <button class="btn piccolo" data-pj="dup" data-id="${x.id}">Duplica</button>
        <button class="btn piccolo" data-pj="del" data-id="${x.id}" title="Elimina il progetto">Elimina</button></div></div>`}).join('');
  return `<div class="btnrow" style="margin-bottom:12px"><button class="btn primario" data-pj="new">+ Nuovo progetto</button>
    ${l.length>6?`<input type="search" id="pjQ" placeholder="Filtra per nome…" style="flex:1;min-width:160px">`:''}</div>
    <div id="pjList">${rows||'<p class="piccola">Nessun progetto salvato.</p>'}</div>
    <p class="piccola">I progetti restano in questo browser (${kb()} kB usati). Per portarli su un altro computer usa «Esporta progetto (JSON)» o GitHub Gist. Le planimetrie e le foto sono nell'archivio del browser e vengono condivise tra le copie duplicate.</p>`;
}
function openProjects(){modal('I miei progetti',projectsHtml());
  const q=$('#pjQ');if(q)q.oninput=()=>{const v=q.value.toLowerCase();$$('#pjList .pj').forEach(e=>e.hidden=!e.querySelector('.pj-n').textContent.toLowerCase().includes(v))}}
async function deleteProject(id){
  const x=projIndex().find(p=>p.id===id);if(!x)return;
  if(!confirm(`Eliminare il progetto «${x.name}»? Planimetrie, foto e versioni del progetto vengono cancellate da questo browser.`))return;
  const data=id===P.pid?JSON.parse(JSON.stringify(P)):projGet(id)||{};
  projSetIndex(projIndex().filter(p=>p.id!==id));try{localStorage.removeItem(PKEY(id))}catch(_){}
  if(id===P.pid){const nx=projIndex()[0];if(nx)openProject(nx.id);else newProject()}
  const keep=new Set(imgRefs(P));projIndex().forEach(p=>imgRefs(projGet(p.id)||{}).forEach(k=>keep.add(k)));
  for(const k of imgRefs(data))if(!keep.has(k)){await DB.purge(k);if(IMG[k]){URL.revokeObjectURL(IMG[k]);delete IMG[k]}}
  await DB.purge('ver:'+id);
  toast('Progetto eliminato');openProjects();
}
function dupProject(id){
  const j=id===P.pid?JSON.parse(JSON.stringify(P)):projGet(id);if(!j)return;
  j.pid=uid();j.name=(j.name||'')+' (copia)';delete j.gistId;
  try{localStorage.setItem(PKEY(j.pid),JSON.stringify(j));const l=projIndex();const i=l.findIndex(p=>p.id===id);l.splice(i+1,0,projMeta(j));projSetIndex(l)}catch(_){toast('Salvataggio nel browser non riuscito (spazio esaurito?)');return}
  DB.get('ver:'+id).then(v=>{if(v)DB.put('ver:'+j.pid,v)});
  toast('Progetto duplicato');openProjects();
}

/* =====================================================================
   2) Versioni e confronto
   ===================================================================== */
const VMAX=60,VAUTO=20;
async function verList(pid=P.pid){const v=await DB.get('ver:'+pid);return Array.isArray(v)?v:[]}
async function verPut(l,pid=P.pid){
  const auto=l.filter(v=>v.auto);if(auto.length>VAUTO){const drop=new Set(auto.slice(VAUTO).map(v=>v.id));l=l.filter(v=>!drop.has(v.id))}
  await DB.put('ver:'+pid,l.slice(0,VMAX))}
const snapJson=()=>{const j=JSON.parse(JSON.stringify(P));delete j.pid;return JSON.stringify(j)};
async function verAdd(label,auto=false){
  const l=await verList();const data=snapJson();
  if(auto&&l[0]&&l[0].data===data)return false;
  l.unshift({id:uid(),t:Date.now(),label:label||'',auto,data});await verPut(l);return true}
async function autoVersion(){
  if(!P||!P.racks.some(r=>r.items.length)&&!P.plans.length)return;
  const l=await verList();const last=l[0];
  if(!last||(Date.now()-last.t>6*3600e3&&last.data!==snapJson()))await verAdd('',true);
}
const vName=v=>v.label||(v.auto?'Automatica (apertura del progetto)':'Senza nome');

/* --- confronto --- */
function ranges(list){ // [{L,n}] → "A1–A6, C3"
  const g={};list.forEach(({L,n})=>(g[L]??=new Set()).add(+n));
  return Object.keys(g).sort().map(L=>{const a=[...g[L]].sort((x,y)=>x-y);const out=[];let s=a[0],p=a[0];
    for(let i=1;i<=a.length;i++){if(a[i]===p+1){p=a[i];continue}out.push(s===p?L+s:`${L}${s}–${L}${p}`);s=p=a[i]}return out.join(', ')}).join(', ')}
const same=(x,y)=>JSON.stringify(x??null)===JSON.stringify(y??null);
function diffProjects(A,B){
  const G=[];const grp=(key,title,rackId)=>{let g=G.find(x=>x.key===key);if(!g){g={key,title,rackId,lines:[]};G.push(g)}return g};
  const add=(g,t,s)=>g.lines.push({t,s});
  if((A.name||'')!==(B.name||''))add(grp('p','Progetto'),'~',`Nome: «${A.name||''}» → «${B.name||''}»`);
  if(!same(A.buildings,B.buildings))add(grp('p','Progetto'),'~','Edifici modificati (nomi, piani o posizione)');
  const ra=Object.fromEntries((A.racks||[]).map(r=>[r.id,r])),rb=Object.fromEntries((B.racks||[]).map(r=>[r.id,r]));
  for(const r of B.racks||[]){const o=ra[r.id];const g=grp('r:'+r.id,`Armadio ${rid(r)}`,r.id);
    if(!o){add(g,'+',`Armadio aggiunto (${TYPES[r.type].it}, ${r.units} U, ${pl(r.items.length,'elemento','elementi')})`);continue}
    if(rid(o)!==rid(r))add(g,'~',`Identificativo ${rid(o)} → ${rid(r)}`);
    if(o.units!==r.units)add(g,'~',`Altezza ${o.units} U → ${r.units} U`);
    if((o.note||'')!==(r.note||''))add(g,'~','Note modificate');
    if(!same(o.loc,r.loc))add(g,'~',!o.loc?'Posizionato in planimetria':!r.loc?'Tolto dalla planimetria':'Spostato in planimetria');
    const ia=Object.fromEntries(o.items.map(i=>[i.id,i]));const La=panelLetters(o),Lb=panelLetters(r);
    for(const it of r.items){const p=ia[it.id];
      if(!p){add(g,'+',`${iname(it)} in U${it.pos}${it.h>1?'–U'+(it.pos+it.h-1):''}`);continue}
      if(iname(p)!==iname(it))add(g,'~',`U${it.pos}: ${iname(p)} → ${iname(it)}`);
      if(p.pos!==it.pos)add(g,'~',`${iname(it)}: da U${p.pos} a U${it.pos}`);
      if(p.h!==it.h)add(g,'~',`${iname(it)}: altezza ${p.h} U → ${it.h} U`);
      const inv=['tag','serial','mac','ip'].filter(k=>(p.props?.[k]||'')!==(it.props?.[k]||''));
      if(inv.length)add(g,'~',`${iname(it)}: inventario aggiornato (${inv.map(k=>({tag:'asset tag',serial:'seriale',mac:'MAC',ip:'IP'}[k])).join(', ')})`);
      if(KINDS[it.kind].term){const nn=new Set([...Object.keys(p.ports||{}),...Object.keys(it.ports||{})]);const loc=[],lnk=[],cert=[];
        nn.forEach(n=>{const x=p.ports?.[n]||{},y=it.ports?.[n]||{};const e={L:Lb[it.id]||La[it.id]||'?',n};
          if((x.note||'')!==(y.note||''))loc.push(e);
          if(x.t!==y.t||(y.t==='link'&&(x.r!==y.r||x.g!==y.g||x.flip!==y.flip)))lnk.push(e);
          if(!same(x.cert,y.cert))cert.push(e)});
        if(loc.length)add(g,'~',`Locali delle prese modificati: ${ranges(loc)}`);
        if(lnk.length)add(g,'~',`Tratte tra armadi modificate: ${ranges(lnk)}`);
        if(cert.length)add(g,'~',`Certificazioni aggiornate: ${ranges(cert)}`)}
    }
    for(const p of o.items)if(!r.items.some(i=>i.id===p.id))add(g,'-',`Rimosso: ${iname(p)} (U${p.pos})`);
    const pa=o.perm||{},pb=r.perm||{};const L=k=>{const[id,n]=k.split(':');return {L:Lb[id]||La[id]||'?',n}};
    const pAdd=[],pDel=[],pMod=[];
    new Set([...Object.keys(pa),...Object.keys(pb)]).forEach(k=>{const x=pa[k],y=pb[k];const ex=v=>v&&v.it;
      if(ex(y)&&!ex(x))pAdd.push(L(k));else if(ex(x)&&!ex(y))pDel.push(L(k));else if(ex(x)&&!same(x,y))pMod.push(L(k))});
    if(pAdd.length)add(g,'+',`Permutate le prese ${ranges(pAdd)}`);
    if(pMod.length)add(g,'~',`Ripermutate le prese ${ranges(pMod)}`);
    if(pDel.length)add(g,'-',`Tolte le permutazioni delle prese ${ranges(pDel)}`);
    if(!same(o.swcfg,r.swcfg))add(g,'~','Configurazione delle porte degli switch modificata');
    if(!same(o.photos,r.photos))add(g,'~','Foto dell\'armadio modificate');
  }
  for(const o of A.racks||[])if(!rb[o.id])add(grp('r:'+o.id,`Armadio ${rid(o)}`,null),'-','Armadio eliminato');
  const pa=Object.fromEntries((A.plans||[]).map(p=>[p.id,p]));const gp=()=>grp('pl','Planimetrie');
  for(const p of B.plans||[]){const o=pa[p.id];if(!o){add(gp(),'+',`Planimetria «${p.name}» aggiunta`);continue}
    if(o.name!==p.name)add(gp(),'~',`Planimetria «${o.name}» rinominata in «${p.name}»`);
    if(o.scale!==p.scale)add(gp(),'~',`«${p.name}»: scala modificata`);
    if(!same(o.walls,p.walls))add(gp(),'~',`«${p.name}»: muri modificati`)}
  for(const o of A.plans||[])if(!(B.plans||[]).some(p=>p.id===o.id))add(gp(),'-',`Planimetria «${o.name}» eliminata`);
  const da=Object.fromEntries((A.devices||[]).map(d=>[d.id,d]));const gd=()=>grp('dv','Apparati in planimetria');
  const dn=d=>`${DEV[d.kind]?.short||'Apparato'}${d.name?' «'+d.name+'»':''}`;
  const moved=[];
  for(const d of B.devices||[]){const o=da[d.id];if(!o){add(gd(),'+',`Aggiunto: ${dn(d)}`);continue}
    if(o.plan!==d.plan||Math.hypot(o.x-d.x,o.y-d.y)>3)moved.push(dn(d));
    if(o.rack!==d.rack||o.item!==d.item||o.port!==d.port)add(gd(),'~',`Collegato a un'altra presa: ${dn(d)}`);
    if(!same(o.route,d.route))add(gd(),'~',`Percorso del cavo modificato: ${dn(d)}`);
    if((o.name||'')!==(d.name||'')&&o.name)add(gd(),'~',`«${o.name}» rinominato in «${d.name||''}»`)}
  if(moved.length)add(gd(),'~',`Spostati: ${moved.length>6?pl(moved.length,'apparato','apparati'):moved.join(', ')}`);
  for(const o of A.devices||[])if(!(B.devices||[]).some(d=>d.id===o.id))add(gd(),'-',`Rimosso: ${dn(o)}`);
  const va=Object.fromEntries((A.vlans||[]).map(v=>[v.id,v]));const gv=()=>grp('vl','VLAN');
  for(const v of B.vlans||[]){const o=va[v.id];if(!o)add(gv(),'+',`VLAN ${v.vid} «${v.name||''}» aggiunta`);else if(!same(o,v))add(gv(),'~',`VLAN ${v.vid} «${v.name||''}» modificata`)}
  for(const o of A.vlans||[])if(!(B.vlans||[]).some(v=>v.id===o.id))add(gv(),'-',`VLAN ${o.vid} «${o.name||''}» eliminata`);
  {const fa=A.field||{},fb=B.field||{};const ch={};let ph=0;Object.keys(fb).forEach(k=>{const x=fa[k]||{},y=fb[k];if((x.st||'todo')!==(y.st||'todo'))ch[y.st||'todo']=(ch[y.st||'todo']||0)+1;ph+=Math.max(0,(y.photos||[]).length-(x.photos||[]).length)});
    const lab={todo:'da fare',posata:'posate / installate',cert:'certificate / collaudate',attiva:'attive',prob:'con problemi'};const tot=Object.values(ch).reduce((s,n)=>s+n,0);
    if(tot)add(grp('fl','Sopralluogo'),'~',`Stato aggiornato per ${tot} prese e apparati: ${Object.entries(ch).map(([s,n])=>n+' '+lab[s]).join(', ')}`);
    if(ph)add(grp('fl','Sopralluogo'),'+',`Foto del sopralluogo: ${ph}`)}
  const out=G.filter(g=>g.lines.length);
  return {groups:out,n:out.reduce((s,g)=>s+g.lines.length,0)};
}
function diffHtml(d){
  if(!d.n)return '<p class="piccola">Nessuna differenza. ✓</p>';
  const ic={'+':'<span class="df add">+</span>','-':'<span class="df del">−</span>','~':'<span class="df mod">~</span>'};
  return d.groups.map(g=>`<div class="dfg"><h4>${esc(g.title)}</h4><ul>${g.lines.map(l=>`<li>${ic[l.t]}${esc(l.s)}</li>`).join('')}</ul></div>`).join('');
}
let VCMP=null; // ultimo confronto {a,b,label,date,diff}
async function openVersions(sel){
  const l=await verList();
  const opt=(id)=>`<option value="cur" ${id==='cur'?'selected':''}>Progetto attuale</option>`+l.map(v=>`<option value="${v.id}" ${id===v.id?'selected':''}>${esc(dt(v.t))} · ${esc(vName(v))}</option>`).join('');
  const a=sel?.a||l[0]?.id||'cur',b=sel?.b||'cur';
  modal('Versioni e differenze',`
    <div class="btnrow" style="margin-bottom:6px"><input type="text" id="vLbl" placeholder="Descrizione della versione (es. prima della ripermutazione del piano 1)" style="flex:1;min-width:220px"><button class="btn primario" data-vr="save">Salva versione</button></div>
    <p class="piccola" style="margin:0 0 14px">Una versione è un'istantanea dell'intero progetto. Ne viene salvata una automatica quando apri il progetto dopo qualche ora; puoi tornare a una versione con «Ripristina» (annullabile con Ctrl+Z).</p>
    ${l.length?`<div class="vlist">${l.map(v=>`<div class="pj"><div class="grow"><div class="pj-n">${esc(vName(v))}</div><div class="sub">${esc(dt(v.t))}${v.auto?' · automatica':''}</div></div>
      <div class="btnrow"><button class="btn piccolo" data-vr="cmp" data-id="${v.id}">Confronta con l'attuale</button><button class="btn piccolo" data-vr="restore" data-id="${v.id}">Ripristina</button><button class="btn piccolo" data-vr="del" data-id="${v.id}" title="Elimina la versione">Elimina</button></div></div>`).join('')}</div>`:'<p class="piccola">Nessuna versione salvata per questo progetto.</p>'}
    ${l.length?`<div class="sez" style="margin-top:16px"><h3>Confronto</h3><div class="btnrow"><select id="vA">${opt(a)}</select><span>→</span><select id="vB">${opt(b)}</select><button class="btn" data-vr="go">Confronta</button></div>
      <div id="vOut" style="margin-top:12px"></div></div>`:''}`);
  if(l.length)showCmp(a,b);
}
async function showCmp(a,b){
  const l=await verList();const get=id=>id==='cur'?{data:P,t:Date.now(),label:'Progetto attuale'}:(()=>{const v=l.find(x=>x.id===id);return v&&{data:JSON.parse(v.data),t:v.t,label:vName(v)}})();
  const A=get(a),B=get(b);const out=$('#vOut');if(!out||!A||!B)return;
  const d=diffProjects(A.data,B.data);VCMP={a,b,A,B,diff:d};
  out.innerHTML=`<div class="kv"><span>${esc(A.label)} (${esc(dt(A.t))}) → ${esc(B.label)}</span><b>${pl(d.n,'differenza','differenze')}</b></div>${diffHtml(d)}
    ${d.n&&b==='cur'&&a!=='cur'?`<div class="btnrow" style="margin-top:10px"><button class="btn" data-vr="log">Aggiungi al registro modifiche</button><span class="piccola" style="margin:0">una voce per ogni armadio modificato</span></div>`:''}`;
}
async function restoreVersion(id){
  const l=await verList();const v=l.find(x=>x.id===id);if(!v)return;
  if(!confirm(`Ripristinare la versione «${vName(v)}» del ${dt(v.t)}? Lo stato attuale viene salvato prima come versione.`))return;
  await verAdd('Prima del ripristino');
  const j=JSON.parse(v.data);j.pid=P.pid;if(P.gistId)j.gistId=P.gistId;
  mutate(()=>{P=normalize(j);fixSel()});closeModal();toast('Versione ripristinata');
}
function logDiff(){
  if(!VCMP)return;const {A,diff}=VCMP;let n=0;
  const when=day(A.t);
  mutate(()=>{diff.groups.forEach(g=>{const r=g.rackId&&rackById(g.rackId);if(!r)return;r.log??=[];
    const T=window.NDC_tr||(x=>x);r.log.push({id:uid(),d:todayIso(),a:P.author||'',t:T(`Rispetto alla versione «${A.label}» del ${when}: `)+g.lines.map(l=>T(l.s)).join('; ')+'.'});n++})});
  toast(n?`${pl(n,'voce aggiunta','voci aggiunte')} al registro modifiche`:'Nessun armadio da registrare');
}
document.addEventListener('click',async e=>{
  const pj=e.target.closest('[data-pj]');
  if(pj){const id=pj.dataset.id;switch(pj.dataset.pj){
    case 'open':closeModal();openProject(id);autoVersion();toast(`Aperto «${P.name}»`);break;
    case 'new':closeModal();newProject();toast('Nuovo progetto creato');break;
    case 'dup':dupProject(id);break;
    case 'del':deleteProject(id);break}return}
  const vr=e.target.closest('[data-vr]');if(!vr)return;const id=vr.dataset.id;
  switch(vr.dataset.vr){
    case 'save':{await verAdd($('#vLbl').value.trim());toast('Versione salvata');openVersions();break}
    case 'cmp':openVersions({a:id,b:'cur'});break;
    case 'go':showCmp($('#vA').value,$('#vB').value);break;
    case 'restore':restoreVersion(id);break;
    case 'del':{if(!confirm('Eliminare questa versione?'))break;await verPut((await verList()).filter(v=>v.id!==id));openVersions();break}
    case 'log':logDiff();break;
  }
});
document.addEventListener('change',e=>{if(e.target.id==='vA'||e.target.id==='vB')showCmp($('#vA').value,$('#vB').value)});

/* =====================================================================
   3) Ricerca globale
   ===================================================================== */
const norm=s=>String(s??'').toLowerCase();
const flat=s=>norm(s).replace(/[\s:.\-_]/g,'');
function buildIndex(){
  const E=[];const push=(t,main,sub,keys,go)=>E.push({t,main,sub,keys:keys.filter(Boolean).map(String),go});
  const inv=o=>[o?.tag,o?.serial,o?.mac,o?.ip];
  for(const r of P.racks){const L=panelLetters(r);
    push('Armadio',rid(r),`${TYPES[r.type].it} · ${r.units} U${r.note?' · '+r.note:''}`,[rid(r),rid(r,true),r.note],()=>goRack(r));
    for(const it of r.items){
      if(!['blank','cm'].includes(it.kind))push('Elemento',iname(it),`${rid(r)} · U${it.pos}${it.props?.ip?' · '+it.props.ip:''}`,[iname(it),nm(it),it.props?.name,...inv(it.props)],()=>goItem(r,it));
      if(KINDS[it.kind].term){const N=+it.props.ports||0;
        for(let n=1;n<=N;n++){const pd=it.ports[n]||{};const perm=r.perm?.[it.id+':'+n];
          const lab=pd.t==='link'?portLabel(r,it,n,L):it.kind==='patch'?wallLabel(r,it,n,L):`${rid(r)}.${L[it.id]}${n}`;
          const sw=perm?.it&&r.items.find(i=>i.id===perm.it);
          const sub=[`${rid(r)} · ${it.kind==='patch'?'presa':'porta'} ${L[it.id]}${n}`,pd.note,sw?`${iname(sw)} U${sw.pos} porta ${perm.n}`:'',perm?.vlan?'VLAN '+perm.vlan:''].filter(Boolean).join(' · ');
          push(pd.t==='link'?'Tratta':it.kind==='patch'?'Presa':'Fibra',lab,sub,[lab,pd.note],()=>goPort(r,it,n))}}
    }}
  for(const d of P.devices){const p=planById(d.plan);const lab=devLabel(d);const m=d.model&&MODELS[d.model];
    push(DEV[d.kind]?.short||'Apparato',d.name||lab||DEV[d.kind]?.short,[lab,p?p.name:'',m?m.m:''].filter(Boolean).join(' · '),[d.name,lab,m?.m,...inv(d)],()=>goDev(d))}
  for(const p of P.plans)push('Planimetria',p.name,`edificio ${p.b??'—'} · piano ${p.floor??'—'}`,[p.name],()=>goPlan(p));
  for(const v of P.vlans||[])push('VLAN',`VLAN ${v.vid} ${v.name||''}`,v.subnet||'',[String(v.vid),v.name,v.subnet,'vlan '+v.vid],()=>{$('[data-m=vlans]').click()});
  for(const [b,x] of Object.entries(P.buildings||{}))if(x?.name)push('Edificio',`${b} · ${x.name}`,x.desc||'',[x.name,'edificio '+b],()=>{S.view='campus';S.bsel=b;render()});
  for(const x of projIndex())if(x.id!==P.pid)push('Progetto',x.name,'apri il progetto',[x.name],()=>{openProject(x.id);autoVersion()});
  return E;
}
function search(E,q){
  const t=norm(q).trim();if(!t)return [];const toks=t.split(/\s+/);const ft=flat(t);
  const res=[];for(const e of E){const hay=norm(e.keys.join(' ')+' '+e.main+' '+e.sub);const hf=flat(e.keys.join(' '));
    if(!(toks.every(k=>hay.includes(k))||(ft.length>=4&&hf.includes(ft))))continue;
    const m=norm(e.main);let s=m===t?0:e.keys.some(k=>norm(k)===t)?1:m.startsWith(t)?2:e.keys.some(k=>norm(k).startsWith(t))?3:4;
    if(e.t==='Progetto')s+=1;res.push([s,e])}
  return res.sort((a,b)=>a[0]-b[0]).slice(0,40).map(x=>x[1]);
}
function flash(sel){setTimeout(()=>{const el=$(sel);if(!el)return;el.scrollIntoView({block:'center',behavior:'smooth'});el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash')},80)}
function goRack(r){S.view='rack';S.rack=r.id;S.item=null;S.port=null;S.right='props';render();flash('#bay')}
function goItem(r,it){S.view='rack';S.rack=r.id;S.item=it.id;S.port=null;S.right='props';render();flash(`.it[data-id="${it.id}"]`)}
function goPort(r,it,n){S.view='rack';S.rack=r.id;S.item=it.id;S.port=n;S.right='props';render();flash(`.it[data-id="${it.id}"]`)}
function goDev(d){S.view='plan';S.plan=d.plan;S.mk='mk:'+d.id;S.right='props';render();setTimeout(()=>{try{centerOn(d.x,d.y)}catch(_){}flash(`[data-mk="mk:${d.id}"]`)},120)}
function goPlan(p){S.view='plan';S.plan=p.id;S.mk=null;render()}
let SE=null,SR=[],SI=0;
function openSearch(){
  let o=$('#srch');
  if(!o){document.body.insertAdjacentHTML('beforeend',`<div id="srch" class="srch" hidden><div class="srch-box" role="dialog" aria-label="Ricerca">
    <div class="srch-in"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="sq" type="search" autocomplete="off" spellcheck="false" placeholder="Cerca etichetta, presa, apparato, seriale, MAC, IP…"></div>
    <div id="sr" class="srch-res"></div><div class="srch-foot">↑ ↓ per scegliere · Invio per aprire · Esc per chiudere</div></div></div>`);
    o=$('#srch');
    o.addEventListener('mousedown',e=>{if(e.target===o)closeSearch()});
    $('#sq').addEventListener('input',()=>{SI=0;drawRes()});
    $('#sq').addEventListener('keydown',e=>{
      if(e.key==='ArrowDown'){e.preventDefault();SI=Math.min(SI+1,SR.length-1);drawRes(true)}
      else if(e.key==='ArrowUp'){e.preventDefault();SI=Math.max(SI-1,0);drawRes(true)}
      else if(e.key==='Enter'){e.preventDefault();pick(SI)}
      else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeSearch()}});
    $('#sr').addEventListener('click',e=>{const x=e.target.closest('[data-si]');if(x)pick(+x.dataset.si)});
  }
  SE=buildIndex();o.hidden=false;const q=$('#sq');q.select();q.focus();drawRes();
}
function closeSearch(){const o=$('#srch');if(o)o.hidden=true}
function drawRes(keep){
  const q=$('#sq').value;SR=search(SE,q);const el=$('#sr');
  if(!q.trim()){el.innerHTML=`<div class="srch-empty">Scrivi un identificativo (BA.FA1, BA.FA1.C12), il locale di una presa, un modello, un seriale, un MAC o un IP.</div>`;return}
  if(!SR.length){el.innerHTML=`<div class="srch-empty">Nessun risultato per «${esc(q)}».</div>`;return}
  el.innerHTML=SR.map((e,i)=>`<div class="srch-it ${i===SI?'on':''}" data-si="${i}"><span class="srch-t">${esc(e.t)}</span><span class="grow"><b>${esc(e.main)}</b><small>${esc(e.sub)}</small></span></div>`).join('');
  if(keep)el.querySelector('.on')?.scrollIntoView({block:'nearest'});
}
function pick(i){const e=SR[i];if(!e)return;closeSearch();closeModal();e.go()}
document.addEventListener('keydown',e=>{
  const typing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openSearch();return}
  if(e.key==='/'&&!typing&&!$('#modal').classList.contains('open')){e.preventDefault();openSearch()}
},true);

/* ---------------- testata e menu ---------------- */
$('#searchBtn')?.addEventListener('click',openSearch);
$('#projBtn')?.addEventListener('click',openProjects);
$('#moreMenu .menu-lista').addEventListener('click',e=>{const m=e.target.closest('[data-m]')?.dataset.m;
  ({projects:openProjects,versions:()=>openVersions(),search:openSearch})[m]?.()});
window.NDC_projects={openProjects,openVersions,openSearch,diffProjects,verList,verAdd,buildIndex,search};

/* ---------------- avvio ---------------- */
(function go(){if(!P){setTimeout(go,30);return}autoVersion()})();
})();
