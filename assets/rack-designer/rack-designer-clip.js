/* =====================================================================
   Network Design Center — copia e incolla, backup automatico
   • Ctrl/⌘+C, Ctrl/⌘+X, Ctrl/⌘+V su elementi dell'armadio, armadi interi e apparati in pianta.
     Gli appunti passano dagli eventi copy/paste del browser (funzionano tra schede, finestre
     e progetti) con una copia di riserva nel browser.
   • Backup di tutti i progetti: file da scaricare o GitHub Gist aggiornato in automatico,
     promemoria se l'ultimo backup è vecchio, ripristino.
   ===================================================================== */
(function(){
'use strict';
const KEYS=()=>window.NDC_keys||{MAC:false,K:{mod:'Ctrl'}};
const mod=e=>KEYS().MAC?e.metaKey:e.ctrlKey;
const typing=()=>{const a=document.activeElement;return a&&(/INPUT|TEXTAREA|SELECT/.test(a.tagName)||a.isContentEditable)};
const busy=()=>$('#modal')?.classList.contains('open')||($('#campo')&&!$('#campo').hidden)||!!$('#srch:not([hidden])');
const SELx=()=>window.NDC_select;
const CLIPK='ndc-appunti';
const T=s=>(window.NDC_tr||(x=>x))(s);
const umFor=ids=>{const um=window.NDC_tools?.userModels?.()||[];const all=[...um,...(P.umodels||[])];return [...new Set(ids)].filter(id=>String(id).startsWith('u-')).map(id=>all.find(u=>u.id===id)).filter(Boolean)};

/* =====================================================================
   copia e incolla
   ===================================================================== */
function buildClip(){
  const s=SELx();if(!s)return null;
  if(S.view==='rack'){
    const rs=s.racksSel();
    if(rs.size>1||(!s.itemsSel().size&&rs.size)){const racks=P.racks.filter(r=>rs.has(r.id)).map(r=>JSON.parse(JSON.stringify(r)));
      return {ndc:'clip',v:1,kind:'racks',racks,models:umFor(racks.flatMap(r=>r.items.map(i=>i.props?.model))),from:P.pid,n:racks.length}}
    const ids=s.itemsSel();if(!ids.size)return null;const r=R();
    const items=r.items.filter(i=>ids.has(i.id)).map(i=>JSON.parse(JSON.stringify(i)));
    return {ndc:'clip',v:1,kind:'items',items,units:r.units,models:umFor(items.map(i=>i.props?.model)),from:P.pid,rack:r.id,n:items.length}}
  if(S.view==='plan'){
    const ks=[...s.mksSel()].filter(k=>k.startsWith('mk:'));if(!ks.length)return null;
    const devs=ks.map(k=>JSON.parse(JSON.stringify(mkObj(k))));
    return {ndc:'clip',v:1,kind:'devices',devices:devs,plan:PL()?.id,models:umFor(devs.map(d=>d.model)),from:P.pid,n:devs.length}}
  return null;
}
const what=c=>c.kind==='racks'?(c.n===1?'1 armadio':c.n+' armadi'):c.kind==='items'?(c.n===1?'1 elemento':c.n+' elementi'):(c.n===1?'1 apparato':c.n+' apparati');
function remember(c){try{localStorage.setItem(CLIPK,JSON.stringify(c))}catch(_){}}
function recall(){try{const c=JSON.parse(localStorage.getItem(CLIPK));return c?.ndc==='clip'?c:null}catch(_){return null}}
function regModels(c){(c.models||[]).forEach(u=>window.NDC_tools?.regModel?.(u))}

function pasteClip(c){
  if(!c)return;regModels(c);
  if(c.kind==='items'){
    if(S.view!=='rack'){toast('Gli elementi dell\'armadio si incollano nella vista Armadio');return}
    const r=R();const same=c.rack===r.id&&c.from===P.pid;let ok=0,miss=0;const nw=[];
    mutate(()=>{[...c.items].sort((a,b)=>b.pos-a.pos).forEach(src=>{const it=JSON.parse(JSON.stringify(src));it.id=uid();it.ports={};it.photos=[];
      let p=!same&&fits(r,it.pos,it.h)?it.pos:null;if(p==null)p=freeSlot(r,it.h,true);if(!p){miss++;return}it.pos=p;r.items.push(it);nw.push(it.id);ok++})});
    if(SELx()){SELx().SEL.items=new Set(nw);SELx().SEL.rackOf=r.id}S.item=nw[0]||null;S.port=null;render();
    toast(`${ok===1?'1 elemento incollato':ok+' elementi incollati'} in ${rid(r)}${miss?` · ${miss} senza spazio libero`:''}`);return}
  if(c.kind==='racks'){
    const map={};c.racks.forEach(r=>map[r.id]=uid());const nw=[];
    mutate(()=>{c.racks.forEach(src=>{const r=JSON.parse(JSON.stringify(src));const im={};r.id=map[src.id];r.loc=null;r.auto=true;r.log=[];r.photos=[];
      r.items.forEach(i=>{const n=uid();im[i.id]=n;i.id=n;i.photos=[];Object.values(i.ports||{}).forEach(pd=>{delete pd.cert})});
      r.items.forEach(i=>Object.keys(i.ports||{}).forEach(k=>{const pd=i.ports[k];if(pd.t==='link'){if(map[pd.r])pd.r=map[pd.r];else delete i.ports[k]}}));
      const perm={};Object.entries(r.perm||{}).forEach(([k,v])=>{const [pid,n]=k.split(':');if(im[pid]&&im[v.it])perm[im[pid]+':'+n]={...v,it:im[v.it]}});r.perm=perm;
      if(r.swcfg){const sc={};Object.entries(r.swcfg).forEach(([k,v])=>{if(im[k])sc[im[k]]=v});r.swcfg=sc}
      P.racks.push(r);nw.push(r.id)});assignLetters();S.rack=nw[0];S.item=null});
    if(SELx()){SELx().SEL.racks=new Set(nw.length>1?nw:[])}render();toast(`${nw.length===1?'1 armadio incollato':nw.length+' armadi incollati'}: ${nw.map(id=>rid(rackById(id))).join(', ')}`);return}
  if(c.kind==='devices'){
    if(S.view!=='plan'||!PL()){toast('Gli apparati si incollano nella vista Planimetria');return}
    const pl=PL();const same=c.plan===pl.id&&c.from===P.pid;
    const xs=c.devices.map(d=>d.x),ys=c.devices.map(d=>d.y);const cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
    let tx,ty;if(same){tx=cx+30;ty=cy+30}else{try{const v=vpCenter();tx=v.x;ty=v.y}catch(_){tx=pl.w/2;ty=pl.h/2}}
    const nw=[];let unl=0;
    mutate(()=>{c.devices.forEach(src=>{const d=JSON.parse(JSON.stringify(src));d.id=uid();d.plan=pl.id;d.x=Math.round(clamp(d.x-cx+tx,0,pl.w));d.y=Math.round(clamp(d.y-cy+ty,0,pl.h));d.photos=[];delete d.route;d.rack=null;d.item=null;d.port=null;
      const r=S.serve!=='auto'?rackById(S.serve):nearestRack(pl,d.x,d.y);const f=r&&freePorts(r)[0];
      P.devices.push(d);if(f){d.rack=r.id;d.item=f.it.id;d.port=f.n;if(d.kind==='to')d.name=f.note||''}else unl++;nw.push('mk:'+d.id)})});
    if(SELx())SELx().SEL.mks=new Set(nw);S.mk=nw[0]||null;render();
    toast(`${nw.length===1?'1 apparato incollato':nw.length+' apparati incollati'}${unl?` · ${unl} senza presa libera`:''}`);return}
}
/* eventi copy / cut / paste del browser: funzionano con Ctrl su Windows e Linux e con ⌘ su macOS */
document.addEventListener('copy',e=>{if(typing()||busy())return;const c=buildClip();if(!c)return;e.preventDefault();const t=JSON.stringify(c);try{e.clipboardData.setData('text/plain',t);e.clipboardData.setData('application/x-ndc+json',t)}catch(_){}remember(c);toast(`${what(c)} ${c.n===1?'copiato':'copiati'}`)});
document.addEventListener('cut',e=>{if(typing()||busy())return;const c=buildClip();if(!c)return;e.preventDefault();const t=JSON.stringify(c);try{e.clipboardData.setData('text/plain',t)}catch(_){}remember(c);
  const s=SELx();if(c.kind==='racks'){if(!s.delRacks()&&rackById(S.rack)){/* un solo armadio: eliminazione con conferma */$('[data-act="delRack"]')?.click()}}else if(c.kind==='items')s.delItems();else s.delMks();});
document.addEventListener('paste',e=>{if(typing()||busy())return;let c=null;
  try{const t=e.clipboardData?.getData('application/x-ndc+json')||e.clipboardData?.getData('text/plain');if(t&&t.includes('"ndc":"clip"'))c=JSON.parse(t)}catch(_){}
  if(!c)c=recall();if(!c)return;e.preventDefault();pasteClip(c)});
/* riserva: se il browser non genera l'evento (es. focus su un elemento non modificabile), si usa la copia nel browser */
window.addEventListener('keydown',e=>{if(!mod(e)||e.altKey||typing()||busy())return;const k=e.key.toLowerCase();
  if(k==='c'||k==='x'||k==='v'){/* lasciamo agire gli eventi del browser; nessuna azione qui */}},true);
/* pulsanti nel pannello di selezione multipla */
document.addEventListener('click',e=>{const b=e.target.closest('[data-cx]');if(!b)return;const a=b.dataset.cx;
  if(a==='paste'){pasteClip(recall());return}const c=buildClip();if(!c)return;remember(c);
  navigator.clipboard?.writeText(JSON.stringify(c)).catch(()=>{});
  if(a==='copy')toast(`${what(c)} ${c.n===1?'copiato':'copiati'}`);else document.dispatchEvent(new ClipboardEvent('cut'))});
const _render=render;render=function(){const x=_render.apply(this,arguments);try{addClipButtons()}catch(_){}return x};
function addClipButtons(){const row=$('#rightBody [data-sx="dup"]')?.parentElement;if(!row||row.querySelector('[data-cx]'))return;
  const {K}=KEYS();row.insertAdjacentHTML('beforeend',`<button class="btn piccolo" data-cx="copy" title="${K.mod}${K.sep||''}C">Copia</button><button class="btn piccolo" data-cx="cut" title="${K.mod}${K.sep||''}X">Taglia</button>`)}

/* =====================================================================
   backup automatico
   ===================================================================== */
const BK='ndc-backup',TOK='ndc-gh-token',GH='https://api.github.com';
const bset=()=>{try{return {mode:'off',every:30,remind:7,images:true,...JSON.parse(localStorage.getItem(BK)||'{}')}}catch(_){return {mode:'off',every:30,remind:7,images:true}}};
const bsave=s=>{try{localStorage.setItem(BK,JSON.stringify(s))}catch(_){}};
const loc=()=>window.NDC_lang==='en'?'en-GB':'it-IT';
const when=t=>t?new Date(t).toLocaleString(loc(),{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'mai';
const lastChange=()=>Math.max(0,...projIndex().map(x=>x.upd||0));
async function gh(path,opt={}){const t=localStorage.getItem(TOK)||'';if(!t)throw new Error(T('Inserisci prima il token GitHub'));const r=await fetch(GH+path,{...opt,headers:{'Accept':'application/vnd.github+json','Authorization':'Bearer '+t,...(opt.headers||{})}});if(!r.ok)throw new Error(r.status+' '+(await r.text()).slice(0,120));return r.json()}
async function buildBackup(images){
  save();const projects=[];const imgs={};
  for(const x of projIndex()){const p=x.id===P.pid?JSON.parse(JSON.stringify(P)):projGet(x.id);if(!p)continue;p.pid=x.id;projects.push(p);
    if(images)for(const k of imgRefs(p))if(!imgs[k]){const b=await DB.get(k);if(b)imgs[k]=await blobToData(b)}}
  let tpl=[];try{tpl=JSON.parse(localStorage.getItem('ndc-modelli-armadio'))||[]}catch(_){}
  return {kind:'ndc-backup',v:1,t:Date.now(),projects,images:imgs,userModels:window.NDC_tools?.userModels?.()||[],rackTemplates:tpl};
}
const bname=()=>`network-design-center-backup-${new Date().toISOString().slice(0,10)}.json`;
async function backupFile(){const s=bset();toast('Preparazione del backup…');const b=await buildBackup(s.images);download(bname(),JSON.stringify(b),'application/json');s.last=Date.now();s.lastKind='file';s.err='';bsave(s);toast(`Backup scaricato: ${b.projects.length} progetti`);hideBanner()}
let running=false;
async function backupGist(quiet){
  if(running)return;const s=bset();if(!localStorage.getItem(TOK)){if(!quiet)toast('Inserisci prima il token GitHub');return}
  running=true;try{const b=await buildBackup(s.images);const body={description:'Network Design Center · backup automatico',files:{'network-design-center-backup.json':{content:JSON.stringify(b)}}};
    let g;if(s.gistId){try{g=await gh('/gists/'+s.gistId,{method:'PATCH',body:JSON.stringify(body)})}catch(e){if(/^404/.test(e.message))s.gistId=null;else throw e}}
    if(!s.gistId){body.public=false;g=await gh('/gists',{method:'POST',body:JSON.stringify(body)});s.gistId=g.id}
    s.last=Date.now();s.lastKind='gist';s.err='';bsave(s);if(!quiet)toast(`Backup salvato su Gist: ${b.projects.length} progetti`);hideBanner()}
  catch(e){s.err=e.message;bsave(s);if(!quiet)toast(T('Backup non riuscito: ')+e.message)}finally{running=false}
}
setInterval(()=>{const s=bset();if(s.mode!=='gist'||!navigator.onLine)return;if(lastChange()>(s.last||0)&&Date.now()-(s.last||0)>=s.every*60e3)backupGist(true)},60e3);
document.addEventListener('visibilitychange',()=>{const s=bset();if(document.visibilityState==='hidden'&&s.mode==='gist'&&lastChange()>(s.last||0)&&Date.now()-(s.last||0)>5*60e3)backupGist(true)});
function openBackup(){
  const s=bset();const has=!!localStorage.getItem(TOK);const n=projIndex().length;const old=s.last&&Date.now()-s.last>s.remind*864e5;
  modal('Backup dei progetti',`<p>I progetti restano solo in questo browser: un backup li protegge se cancelli i dati del sito o cambi computer. Il backup contiene tutti i progetti (${n}), i tuoi modelli e i modelli di armadio.</p>
  <div class="esito ${!s.last?'warn':old?'warn':'ok'}">Ultimo backup: <b>${when(s.last)}</b>${s.lastKind?` (${s.lastKind==='gist'?'GitHub Gist':'file'})`:''}${s.err?`<br><small style="color:var(--err)">Ultimo tentativo non riuscito: ${esc(s.err)}</small>`:''}</div>
  <div class="btnrow" style="margin:10px 0"><button class="btn primario" data-bk="file">Scarica il backup ora</button>${has?'<button class="btn" data-bk="gist">Salva ora su Gist</button>':''}<button class="btn" data-bk="restore">Ripristina da un backup…</button></div>
  <div class="sez"><h3>Automatico</h3><div class="grid3">
    <div class="f"><label>Backup automatico</label><select data-bks="mode"><option value="off" ${s.mode==='off'?'selected':''}>solo promemoria</option><option value="gist" ${s.mode==='gist'?'selected':''} ${has?'':'disabled'}>su GitHub Gist${has?'':' (serve il token)'}</option></select></div>
    <div class="f"><label>Ogni (minuti, se ci sono modifiche)</label><input type="number" min="5" max="1440" data-bks="every" value="${s.every}"></div>
    <div class="f"><label>Promemoria dopo (giorni)</label><input type="number" min="1" max="90" data-bks="remind" value="${s.remind}"></div></div>
    <label class="chk"><input type="checkbox" data-bks="images" ${s.images?'checked':''}><span>Includi planimetrie e foto (backup più grande)</span></label>
    <p class="piccola">Con GitHub Gist il backup viene aggiornato in un gist segreto${s.gistId?` (<a href="https://gist.github.com/${esc(s.gistId)}" target="_blank" rel="noopener">apri</a>)`:''} quando ci sono modifiche, anche quando chiudi la scheda. ${has?'':'Per usarlo inserisci il token in menu ⋯ → «Salva o apri da GitHub Gist».'} Senza Gist ricevi un promemoria quando l'ultimo backup è più vecchio dei giorni indicati.</p></div><div id="bkStore"></div>`);window.NDC_care?.fillStore();
}
document.addEventListener('change',e=>{const k=e.target.dataset?.bks;if(!k)return;const s=bset();s[k]=e.target.type==='checkbox'?e.target.checked:e.target.type==='number'?Math.max(1,+e.target.value||1):e.target.value;bsave(s);if(k==='mode'&&s.mode==='gist')backupGist(false)});
/* ripristino */
let RB=null;
const rin=document.createElement('input');rin.type='file';rin.accept='.json,application/json';rin.hidden=true;document.body.appendChild(rin);
rin.onchange=async()=>{const f=rin.files[0];rin.value='';if(!f)return;try{const b=JSON.parse(await f.text());if(b.kind!=='ndc-backup')throw 0;showRestore(b)}catch(_){toast('Questo file non è un backup di Network Design Center')}};
function showRestore(b){
  RB=b;const ex=new Set(projIndex().map(x=>x.id));
  modal('Ripristina da un backup',`<div class="esito ok">Backup del ${esc(when(b.t))}: ${b.projects.length} progetti${Object.keys(b.images||{}).length?`, ${Object.keys(b.images).length} immagini`:''}.</div>
  <table class="vtab"><tr><th></th><th>Progetto</th><th>Armadi</th><th>In questo browser</th></tr>${b.projects.map((p,i)=>`<tr><td><input type="checkbox" data-rbi="${i}" checked></td><td><b>${esc(p.name||'—')}</b></td><td>${(p.racks||[]).length}</td><td>${ex.has(p.pid)?'già presente':'no'}</td></tr>`).join('')}</table>
  <div class="f" style="margin-top:10px"><label>Progetti già presenti</label><select id="rbMode"><option value="copy">aggiungi come copia</option><option value="replace">sostituisci</option></select></div>
  <label class="chk"><input type="checkbox" id="rbModels" checked><span>Ripristina anche i tuoi modelli e i modelli di armadio</span></label>
  <div class="btnrow" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-close>Annulla</button><button class="btn primario" data-bk="doRestore">Ripristina</button></div>`);
}
async function doRestore(){
  const b=RB;if(!b)return;const pick=$$('[data-rbi]').filter(c=>c.checked).map(c=>b.projects[+c.dataset.rbi]);const mode=$('#rbMode').value;const ex=new Set(projIndex().map(x=>x.id));
  for(const [k,v] of Object.entries(b.images||{}))if(!(await DB.get(k)))await DB.put(k,await dataToBlob(v));
  let n=0;const l=projIndex();
  for(const src of pick){const p=JSON.parse(JSON.stringify(src));if(ex.has(p.pid)&&mode==='copy'){p.pid=uid();p.name=(p.name||'')+' ('+T('ripristinato')+')';delete p.gistId}
    if(p.pid===P.pid){P=normalize(p);fixSel();save()}else{try{localStorage.setItem(PKEY(p.pid),JSON.stringify(p))}catch(e){toast('Salvataggio nel browser non riuscito (spazio esaurito?)');break}const i=l.findIndex(x=>x.id===p.pid);const m=projMeta(p);if(i>=0)l[i]=m;else l.push(m)}n++}
  projSetIndex(l);save();
  if($('#rbModels')?.checked){const um=window.NDC_tools?.userModels?.()||[];const ids=new Set(um.map(u=>u.id));const add=(b.userModels||[]).filter(u=>!ids.has(u.id));
    try{localStorage.setItem('ndc-modelli-utente',JSON.stringify([...um,...add]));add.forEach(u=>window.NDC_tools?.regModel?.(u))}catch(_){}
    let tp=[];try{tp=JSON.parse(localStorage.getItem('ndc-modelli-armadio'))||[]}catch(_){}const tids=new Set(tp.map(t=>t.id));try{localStorage.setItem('ndc-modelli-armadio',JSON.stringify([...tp,...(b.rackTemplates||[]).filter(t=>!tids.has(t.id))]))}catch(_){}}
  closeModal();render();toast(`${n} progetti ripristinati: li trovi in «I miei progetti»`);RB=null;
}
async function restoreGist(){const s=bset();if(!s.gistId){toast('Nessun backup su Gist da questo browser: scegli un file');rin.click();return}
  try{const g=await gh('/gists/'+s.gistId);const f=Object.values(g.files)[0];let t=f.content;if(f.truncated)t=await (await fetch(f.raw_url)).text();showRestore(JSON.parse(t))}catch(e){toast(T('Apertura non riuscita:')+' '+e.message)}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-bk]');if(!b)return;const a=b.dataset.bk;
  if(a==='file')backupFile();else if(a==='gist')backupGist(false);else if(a==='restore'){const s=bset();if(s.gistId&&localStorage.getItem(TOK)&&confirm(T('Ripristinare dal backup su GitHub Gist? Annulla per scegliere un file.')))restoreGist();else rin.click()}
  else if(a==='doRestore')doRestore();else if(a==='later'){const s=bset();s.snooze=Date.now();bsave(s);hideBanner()}else if(a==='open'){hideBanner();openBackup()}});
/* promemoria */
function hideBanner(){$('#bkBanner')?.remove()}
function checkReminder(){
  const s=bset();if(s.mode==='gist'&&!s.err)return;const days=s.remind||7;const lc=lastChange();if(!lc)return;
  const hasWork=projIndex().some(x=>x.racks>1||x.plans>0||x.devices>0)||P.racks.some(r=>r.items.length);if(!hasWork)return;
  if(s.last&&Date.now()-s.last<days*864e5&&!s.err)return;if(s.snooze&&Date.now()-s.snooze<864e5)return;if(s.last&&lc<=s.last)return;
  if($('#bkBanner'))return;const d=document.createElement('div');d.id='bkBanner';d.className='bk-banner';
  d.innerHTML=`<span>${s.err?'Il backup automatico non è riuscito.':s.last?`Ultimo backup dei progetti: ${when(s.last)}.`:'Non hai ancora fatto un backup dei progetti.'}</span><button class="btn piccolo primario" data-bk="file">Scarica backup</button><button class="btn piccolo" data-bk="open">Impostazioni</button><button class="btn piccolo" data-bk="later">Più tardi</button>`;
  document.body.appendChild(d);
}
setTimeout(checkReminder,4000);setInterval(checkReminder,30*60e3);
$('#moreMenu .menu-lista').addEventListener('click',e=>{const m=e.target.closest('[data-m]')?.dataset.m;({backup:openBackup,paste:()=>pasteClip(recall())})[m]?.()});
window.NDC_clip={buildClip,pasteClip,recall,buildBackup,backupFile,backupGist,openBackup,showRestore,checkReminder};
})();
