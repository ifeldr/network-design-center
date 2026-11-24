/* =====================================================================
   Network Design Center — modalità sopralluogo (telefono)
   Vista semplificata per il cantiere: planimetria a tutto schermo, stato di prese e apparati
   (posata / certificata / attiva / problema), foto, note, QR degli armadi.
   Il telefono registra ogni azione come voce (data, ora, autore); il pacchetto del sopralluogo
   si riporta sul PC con un file o con GitHub Gist e viene unito al progetto senza sovrascriverlo.
   ===================================================================== */
(function(){
'use strict';
const ST={todo:'Da fare',posata:'Posata',cert:'Certificata',attiva:'Attiva',prob:'Problema'};
const STDEV={todo:'Da fare',posata:'Installato',cert:'Collaudato',attiva:'Attivo',prob:'Problema'};
const PROB=['Cavo corto','Canalina piena','Presa danneggiata','Manca il frutto o la placca','Accesso non possibile','Etichetta mancante','Altro'];
const AKEY='ndc-campo-autore',TOK='ndc-gh-token',GH='https://api.github.com';
const DONE=['posata','cert','attiva'];
const loc=()=>window.NDC_lang==='en'?'en-GB':'it-IT';
const dt=t=>new Date(t).toLocaleString(loc(),{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
const author=()=>{try{return localStorage.getItem(AKEY)||P.author||''}catch(_){return P.author||''}};
const T=s=>(window.NDC_tr||(x=>x))(s);

/* ---------------- dati ---------------- */
function keyOfDev(d){const p=devPort(d);return p?`p:${p.r.id}:${p.it.id}:${p.n}`:'d:'+d.id}
const stOf=k=>P.field?.[k]?.st||'todo';
function info(k){
  if(!k)return null;
  if(k.startsWith('p:')){const [,rId,iId,n]=k.split(':');const r=rackById(rId);const it=r&&r.items.find(i=>i.id===iId);if(!it)return null;
    const L=panelLetters(r);const lab=wallLabel(r,it,+n,L);const dev=P.devices.find(d=>d.rack===rId&&d.item===iId&&+d.port===+n);const room=it.ports[n]?.note||'';
    if(dev&&dev.kind!=='to')return {k,kind:dev.kind,title:dev.name||DEV[dev.kind].short,sub:[lab,room].filter(Boolean).join(' · '),dev,r,it,n:+n};
    return {k,kind:'to',title:lab,sub:room||(dev?.name||''),dev,r,it,n:+n}}
  const d=P.devices.find(x=>x.id===k.slice(2));if(!d)return null;
  return {k,kind:d.kind,title:d.name||DEV[d.kind].short,sub:'non collegato a una presa',dev:d};
}
const stLabel=(k,s)=>{const i=info(k);return (i&&i.kind!=='to'?STDEV:ST)[s]};
function applyEntry(e){
  P.field??={};const f=(P.field[e.k]??={});
  if(e.st&&(!f.t||e.t>=f.t)){f.st=e.st;f.t=e.t;f.a=e.a;f.prob=e.st==='prob'?(e.prob||f.prob||''):undefined;if(f.prob===undefined)delete f.prob}
  else if(e.prob!=null&&!e.st&&(!f.pt||e.t>=f.pt)){f.prob=e.prob;f.pt=e.t}
  if(e.note!=null&&(!f.nt||e.t>=f.nt)){f.note=e.note;f.nt=e.t}
  if(e.h!=null&&(!f.ht||e.t>=f.ht)){f.h=e.h;f.ht=e.t}
  if(e.ph){(f.photos??=[]);if(!f.photos.includes(e.ph))f.photos.push(e.ph)}
  if(e.mv&&(!f.mt||e.t>=f.mt)){const d=P.devices.find(x=>x.id===e.mv.d);if(d){d.x=Math.round(e.mv.x);d.y=Math.round(e.mv.y);f.mt=e.t}}
  f.last=Math.max(f.last||0,e.t);
}
function addEntry(k,ch,quiet){
  mutate(()=>{P.fieldlog??=[];const e={id:uid(),t:Date.now(),a:author(),k,...ch};P.fieldlog.push(e);applyEntry(e)});
  if(!quiet&&FS.open)drawField();
}
function planTargets(pl){const seen=new Set();const out=[];P.devices.filter(d=>d.plan===pl.id).forEach(d=>{const k=keyOfDev(d);if(seen.has(k))return;seen.add(k);out.push({k,d})});return out}
function rackTargets(r){const out=[];const L=panelLetters(r);[...r.items].filter(i=>i.kind==='patch').sort((a,b)=>b.pos-a.pos).forEach(it=>{for(let n=1;n<=+it.props.ports;n++){const pd=it.ports[n];if(pd&&pd.t==='link')continue;const k=`p:${r.id}:${it.id}:${n}`;
  if(pd?.note||devAtPort(r.id,it.id,n)||P.field?.[k])out.push({k,lab:L[it.id]+n,it,n})}});return out}
function counts(keys){const c={todo:0,posata:0,cert:0,attiva:0,prob:0};keys.forEach(k=>c[stOf(k)]++);c.tot=keys.length;c.done=c.posata+c.cert+c.attiva;return c}
const bar=c=>`<div class="fc-bar">${['attiva','cert','posata','prob'].map(s=>c[s]?`<i class="s-${s}" style="width:${c[s]/c.tot*100}%"></i>`:'').join('')}</div>`;
const cTxt=c=>`${c.done}/${c.tot} fatte${c.cert?` · ${c.cert} certificate`:''}${c.prob?` · <b class="t-prob">${c.prob} problemi</b>`:''}`;

/* ---------------- foto ---------------- */
async function shrink(file,max=1600,q=.8){
  const url=URL.createObjectURL(file);try{const im=await imgEl(url);const k=Math.min(1,max/Math.max(im.naturalWidth,im.naturalHeight));
    const c=document.createElement('canvas');c.width=Math.round(im.naturalWidth*k);c.height=Math.round(im.naturalHeight*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);
    return await new Promise(r=>c.toBlob(r,'image/jpeg',q))}finally{URL.revokeObjectURL(url)}
}
async function addPhotos(k,files){
  let n=0;for(const f of files){try{const b=await shrink(f);const id='ph:'+uid();await DB.put(id,b);IMG[id]=URL.createObjectURL(b);addEntry(k,{ph:id},true);n++}catch(e){toast('Impossibile leggere una delle foto')}}
  if(n)toast(`${n} foto aggiunte`);if(FS.open)drawField();else render();
}
function thumbs(ids){return ids?.length?`<div class="fc-th">${ids.map(id=>`<img data-ph="${id}" data-fph="${id}" alt="Foto">`).join('')}</div>`:''}
function fillThumbs(root=document){root.querySelectorAll('img[data-ph]').forEach(im=>{if(im.src)return;imgUrl(im.dataset.ph).then(u=>{if(u)im.src=u})})}

/* =====================================================================
   vista telefono
   ===================================================================== */
const FS={open:false,scr:'home',plan:null,rack:null,sel:null,moving:null,z:{}};
function ensureEl(){let el=$('#campo');if(!el){el=document.createElement('div');el.id='campo';el.className='campo';document.body.appendChild(el);bindField(el)}return el}
function openField(){FS.open=true;FS.scr='home';FS.sel=null;FS.moving=null;ensureEl().hidden=false;document.body.classList.add('in-campo');drawField()}
function closeField(){FS.open=false;const el=$('#campo');if(el)el.hidden=true;document.body.classList.remove('in-campo');render()}
const ICB='<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>';
function drawField(){
  const el=ensureEl();const since=P.fieldExp||0;const pend=(P.fieldlog||[]).filter(e=>e.t>since).length;
  let body='';
  if(FS.scr==='home'){
    const pls=[...P.plans].sort((a,b)=>String(a.b).localeCompare(String(b.b))||(+a.floor)-(+b.floor));
    body=`<div class="fc-top"><b>Sopralluogo</b><span class="grow fc-pn">${esc(P.name)}</span><button class="fc-x" data-fc="close">Esci</button></div>
    <div class="fc-body">
      <label class="fc-f"><span>Il tuo nome</span><input id="fcAut" value="${esc(author())}" placeholder="Nome e cognome" autocomplete="name"></label>
      <button class="fc-big" data-fc="scan"><svg viewBox="0 0 24 24"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/></svg>Scansiona il QR di un armadio</button>
      <h3>Planimetrie</h3>${pls.length?pls.map(pl=>{const c=counts(planTargets(pl).map(x=>x.k));return `<button class="fc-row" data-fc="plan" data-id="${pl.id}"><span class="grow"><b>${esc(pl.name)}</b><small>Edificio ${esc(pl.b??'—')} · piano ${esc(pl.floor??'—')} · ${cTxt(c)}</small>${bar(c)}</span>›</button>`}).join(''):'<p class="fc-p">Nessuna planimetria nel progetto.</p>'}
      <h3>Armadi</h3>${P.racks.map(r=>{const c=counts(rackTargets(r).map(x=>x.k));return `<button class="fc-row" data-fc="rack" data-id="${r.id}"><span class="grow"><b class="mono">${esc(rid(r))}</b><small>${TYPES[r.type].it} · ${cTxt(c)}</small>${bar(c)}</span>›</button>`}).join('')}
      <h3>Riporta sul PC</h3>
      <p class="fc-p">${pend?`<b>${pend} aggiornamenti</b> non ancora inviati.`:'Nessun aggiornamento da inviare.'} Il PC unisce il sopralluogo al progetto da menu ⋯ → «Importa sopralluogo…».</p>
      <div class="fc-btns"><button class="fc-btn pri" data-fc="pack">${navigator.canShare?'Condividi il file del sopralluogo':'Scarica il file del sopralluogo'}</button><button class="fc-btn" data-fc="gist">Invia con GitHub Gist</button></div>
    </div>`;
  }else if(FS.scr==='plan'){
    const pl=planById(FS.plan);if(!pl){FS.scr='home';return drawField()}
    body=`<div class="fc-top"><button class="fc-back" data-fc="home">${ICB}</button><b class="grow">${esc(pl.name)}</b>${FS.moving?'<span class="fc-mv">Tocca la nuova posizione</span><button class="fc-x" data-fc="mvEnd">Annulla</button>':''}</div>
    <div class="fc-vp" id="fcVp"><div class="fc-in" id="fcIn" style="width:${pl.w}px;height:${pl.h}px"><img id="fcImg" alt="" draggable="false">
      ${P.racks.filter(r=>r.loc&&r.loc.plan===pl.id).map(r=>`<div class="fc-mk fc-rk" data-fr="${r.id}" style="left:${r.loc.x}px;top:${r.loc.y}px">${esc(rid(r,true))}</div>`).join('')}
      ${planTargets(pl).map(({k,d})=>{const i=info(k);const lb=devLabel(d);return `<div class="fc-mk fc-d k-${d.kind} s-${stOf(k)} ${FS.sel===k?'sel':''}" data-fk="${k}" style="left:${d.x}px;top:${d.y}px"><i></i>${lb||d.name?`<span>${esc(d.kind==='to'?(lb?lb.split('.').pop():d.name):(d.name||lb.split('.').pop()))}</span>`:''}</div>`}).join('')}
    </div></div>
    <div class="fc-leg">${Object.keys(ST).map(s=>`<span><i class="s-${s}"></i>${ST[s]}</span>`).join('')}</div>`;
  }else if(FS.scr==='rack'){
    const r=rackById(FS.rack);if(!r){FS.scr='home';return drawField()}
    const t=rackTargets(r);const groups={};t.forEach(x=>(groups[x.it.id]??=[]).push(x));const L=panelLetters(r);
    body=`<div class="fc-top"><button class="fc-back" data-fc="home">${ICB}</button><b class="grow mono">${esc(rid(r))}</b>${r.loc?`<button class="fc-x" data-fc="plan" data-id="${r.loc.plan}">Pianta</button>`:''}</div>
    <div class="fc-body">${Object.keys(groups).length?Object.entries(groups).map(([id,l])=>{const it=r.items.find(i=>i.id===id);return `<h3>Pannello ${L[id]} · U${it.pos}</h3><div class="fc-grid">${l.map(x=>`<button class="fc-pt s-${stOf(x.k)} ${FS.sel===x.k?'sel':''}" data-fk="${x.k}"><b>${x.lab}</b><small>${esc(it.ports[x.n]?.note||'')}</small></button>`).join('')}</div>`}).join('')
      :'<p class="fc-p">Nessuna presa con un locale o un apparato collegato in questo armadio.</p>'}</div>`;
  }
  el.innerHTML=body+sheetHtml();
  const a=$('#fcAut');if(a)a.onchange=()=>{try{localStorage.setItem(AKEY,a.value.trim())}catch(_){}if(!P.author){P.author=a.value.trim();save()}};
  if(FS.scr==='plan')setupPlan();fillThumbs(el);
}
function sheetHtml(){
  const k=FS.sel;const i=info(k);if(!i)return '';const f=P.field?.[k]||{};const st=f.st||'todo';const L=i.kind!=='to'?STDEV:ST;
  const hist=(P.fieldlog||[]).filter(e=>e.k===k).slice(-6).reverse();
  return `<div class="fc-sheet" id="fcSheet"><div class="fc-sh-h"><span class="grow"><b>${esc(i.title)}</b><small>${esc(i.sub||'')}</small></span><button class="fc-x" data-fc="shClose">✕</button></div>
    <div class="fc-st">${Object.keys(L).filter(s=>s!=='todo').map(s=>`<button class="s-${s} ${st===s?'on':''}" data-fst="${s}">${L[s]}</button>`).join('')}${st!=='todo'?'<button class="s-todo" data-fst="todo">Da fare</button>':''}</div>
    ${st==='prob'?`<div class="fc-chips">${PROB.map(p=>`<button class="${f.prob===p?'on':''}" data-fpr="${esc(p)}">${p}</button>`).join('')}</div>`:''}
    <label class="fc-f"><span>Nota</span><textarea id="fcNote" rows="2" placeholder="es. presa dietro l'armadio, cavo lasciato a 3 m">${esc(f.note||'')}</textarea></label>
    ${['ap','cam'].includes(i.kind)?`<label class="fc-f fc-inl"><span>Altezza di montaggio</span><input type="number" step="0.1" min="0" id="fcH" value="${f.h??''}" placeholder="m"></label>`:''}
    <div class="fc-btns"><label class="fc-btn pri"><input type="file" accept="image/*" capture="environment" multiple hidden id="fcPh">Scatta foto</label>${i.dev&&i.dev.plan&&FS.scr==='plan'?'<button class="fc-btn" data-fc="mv">Sposta sulla pianta</button>':''}</div>
    ${thumbs(f.photos)}
    ${hist.length?`<div class="fc-hist">${hist.map(e=>`<div><span>${dt(e.t)}${e.a?' · '+esc(e.a):''}</span> ${e.st?esc(stLabel(k,e.st)):e.ph?'foto':e.note!=null?'nota':e.mv?'spostato':e.h!=null?'altezza '+esc(e.h)+' m':e.prob?esc(e.prob):''}</div>`).join('')}</div>`:''}
  </div>`;
}
/* --- planimetria con zoom a due dita --- */
function setupPlan(){
  const pl=planById(FS.plan);const vp=$('#fcVp'),inn=$('#fcIn');if(!vp||!pl)return;
  imgUrl(pl.id).then(u=>{if(u)$('#fcImg').src=u;else $('#fcImg').alt=T('Immagine della planimetria non disponibile')});
  const r=vp.getBoundingClientRect();let z=FS.z[pl.id];
  if(!z){const k=Math.min(r.width/pl.w,r.height/pl.h)||.3;z=FS.z[pl.id]={k,x:(r.width-pl.w*k)/2,y:(r.height-pl.h*k)/2}}
  const apply=()=>{inn.style.transform=`translate(${z.x}px,${z.y}px) scale(${z.k})`;inn.style.setProperty('--ik',1/z.k)};apply();
  const P0=new Map();let g=null;
  const snap=()=>{const pts=[...P0.values()];g={z:{...z},pts:pts.map(p=>({...p})),moved:false}};
  vp.onpointerdown=e=>{P0.set(e.pointerId,{x:e.clientX,y:e.clientY});snap();g.t=e.target;try{vp.setPointerCapture(e.pointerId)}catch(_){}};
  vp.onpointermove=e=>{if(!P0.has(e.pointerId)||!g)return;P0.set(e.pointerId,{x:e.clientX,y:e.clientY});const pts=[...P0.values()];
    if(pts.length===1){const dx=pts[0].x-g.pts[0].x,dy=pts[0].y-g.pts[0].y;if(Math.hypot(dx,dy)>6)g.moved=true;if(g.moved){z.x=g.z.x+dx;z.y=g.z.y+dy;apply()}}
    else if(pts.length>=2&&g.pts.length>=2){g.moved=true;const d0=Math.hypot(g.pts[0].x-g.pts[1].x,g.pts[0].y-g.pts[1].y)||1,d1=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
      const m0={x:(g.pts[0].x+g.pts[1].x)/2-r.left,y:(g.pts[0].y+g.pts[1].y)/2-r.top},m1={x:(pts[0].x+pts[1].x)/2-r.left,y:(pts[0].y+pts[1].y)/2-r.top};
      const k=Math.max(.05,Math.min(8,g.z.k*d1/d0));const ix=(m0.x-g.z.x)/g.z.k,iy=(m0.y-g.z.y)/g.z.k;z.k=k;z.x=m1.x-ix*k;z.y=m1.y-iy*k;apply()}};
  const up=e=>{if(!P0.has(e.pointerId))return;P0.delete(e.pointerId);const was=g;if(P0.size){snap();g.moved=true;return}g=null;if(!was||was.moved)return;
    const mk=was.t.closest&&was.t.closest('[data-fk],[data-fr]');
    if(FS.moving){const rr=vp.getBoundingClientRect();const x=(e.clientX-rr.left-z.x)/z.k,y=(e.clientY-rr.top-z.y)/z.k;if(x>=0&&y>=0&&x<=pl.w&&y<=pl.h){const mv=FS.moving;FS.moving=null;addEntry(mv.k,{mv:{d:mv.d,x,y}});toast('Posizione aggiornata')}return}
    if(mk?.dataset.fk){FS.sel=mk.dataset.fk;drawField()}else if(mk?.dataset.fr){FS.scr='rack';FS.rack=mk.dataset.fr;FS.sel=null;drawField()}else if(FS.sel){FS.sel=null;drawField()}};
  vp.onpointerup=up;vp.onpointercancel=up;
  vp.onwheel=e=>{e.preventDefault();const rr=vp.getBoundingClientRect();const mx=e.clientX-rr.left,my=e.clientY-rr.top;const k=Math.max(.05,Math.min(8,z.k*(e.deltaY<0?1.15:1/1.15)));const ix=(mx-z.x)/z.k,iy=(my-z.y)/z.k;z.k=k;z.x=mx-ix*k;z.y=my-iy*k;apply()};
}
/* --- QR --- */
let SCAN=null;
async function scanQR(){
  if(!navigator.mediaDevices?.getUserMedia){toast('La fotocamera non è disponibile in questo browser');return}
  const ov=document.createElement('div');ov.className='fc-scan';ov.innerHTML=`<video playsinline muted></video><div class="fc-scan-f"></div><p>Inquadra il QR della targhetta dell'armadio</p><button class="fc-btn" data-fc="scanEnd">Annulla</button>`;
  ensureEl().appendChild(ov);const v=ov.querySelector('video');
  let stream;try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}})}catch(e){ov.remove();toast('Accesso alla fotocamera negato');return}
  v.srcObject=stream;await v.play().catch(()=>{});
  let det=null;if('BarcodeDetector' in window){try{const f=await BarcodeDetector.getSupportedFormats();if(f.includes('qr_code'))det=new BarcodeDetector({formats:['qr_code']})}catch(_){}}
  if(!det&&!window.jsQR)await new Promise(res=>{const s=document.createElement('script');s.src='assets/rack-designer/vendor/jsQR.min.js';s.onload=res;s.onerror=res;document.head.appendChild(s)});
  const c=document.createElement('canvas');const cx=c.getContext('2d',{willReadFrequently:true});
  SCAN={stop:()=>{SCAN=null;stream.getTracks().forEach(t=>t.stop());ov.remove()}};
  const tick=async()=>{if(!SCAN)return;let txt=null;
    try{if(det){const r=await det.detect(v);if(r[0])txt=r[0].rawValue}else if(window.jsQR&&v.videoWidth){c.width=v.videoWidth;c.height=v.videoHeight;cx.drawImage(v,0,0);const q=jsQR(cx.getImageData(0,0,c.width,c.height).data,c.width,c.height);if(q)txt=q.data}}catch(_){}
    if(txt){let t=txt;try{t=decodeURIComponent(txt)}catch(_){}const r=[...P.racks].sort((a,b)=>rid(b).length-rid(a).length).find(x=>t.includes(rid(x)));
      if(r){SCAN.stop();FS.scr='rack';FS.rack=r.id;FS.sel=null;drawField();return}toast('QR letto, ma l\'armadio non è in questo progetto')}
    setTimeout(tick,250)};tick();
}
/* --- pacchetto --- */
async function pack(){
  const ents=P.fieldlog||[];const photos={};for(const e of ents)if(e.ph&&!photos[e.ph]){const b=await DB.get(e.ph);if(b)photos[e.ph]=await blobToData(b)}
  return {kind:'ndc-sopralluogo',v:1,pid:P.pid,name:P.name,t:Date.now(),a:author(),entries:ents,photos};
}
const packName=()=>`${slug(P.name)}-sopralluogo-${new Date().toISOString().slice(0,16).replace(/[:T]/g,'-')}.json`;
async function sendFile(){
  if(!(P.fieldlog||[]).length){toast('Nessun aggiornamento da inviare');return}
  const data=JSON.stringify(await pack());const f=new File([data],packName(),{type:'application/json'});
  if(navigator.canShare&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f],title:T('Sopralluogo')+' · '+P.name});markSent();return}catch(e){if(e.name==='AbortError')return}}
  download(f.name,data,'application/json');markSent();
}
function markSent(){P.fieldExp=Date.now();save();if(FS.open)drawField();toast('File del sopralluogo pronto')}
async function gh(path,opt={}){const t=localStorage.getItem(TOK)||'';if(!t)throw new Error(T('Inserisci prima il token GitHub'));const r=await fetch(GH+path,{...opt,headers:{'Accept':'application/vnd.github+json','Authorization':'Bearer '+t,...(opt.headers||{})}});if(!r.ok)throw new Error(r.status+' '+(await r.text()).slice(0,120));return r.json()}
async function sendGist(){
  if(!(P.fieldlog||[]).length){toast('Nessun aggiornamento da inviare');return}
  if(!localStorage.getItem(TOK)){const t=prompt(T('Token GitHub (permesso «Gists» in lettura e scrittura). Resta salvato solo in questo browser:'));if(!t)return;localStorage.setItem(TOK,t.trim())}
  toast('Invio in corso…');
  try{const p=await pack();await gh('/gists',{method:'POST',body:JSON.stringify({description:`NDC sopralluogo · ${P.name} · ${new Date().toLocaleString('it-IT')} · ${p.a||''}`,public:false,files:{[packName()]:{content:JSON.stringify(p)}}})});markSent();toast('Sopralluogo inviato con Gist')}
  catch(e){toast(T('Invio non riuscito: ')+e.message)}
}
function bindField(el){
  el.addEventListener('click',e=>{
    const b=e.target.closest('[data-fc]');const st=e.target.closest('[data-fst]');const pr=e.target.closest('[data-fpr]');const fp=e.target.closest('[data-fk]');const ph=e.target.closest('[data-fph]');
    if(st&&FS.sel){const s=st.dataset.fst;addEntry(FS.sel,{st:s});return}
    if(pr&&FS.sel){addEntry(FS.sel,{prob:pr.dataset.fpr});return}
    if(ph){imgUrl(ph.dataset.fph).then(u=>{if(u)window.open(u,'_blank')});return}
    if(fp&&FS.scr==='rack'){FS.sel=fp.dataset.fk;drawField();return}
    if(!b)return;const a=b.dataset.fc;
    ({close:closeField,home:()=>{FS.scr='home';FS.sel=null;FS.moving=null;drawField()},plan:()=>{FS.scr='plan';FS.plan=b.dataset.id;FS.sel=null;drawField()},rack:()=>{FS.scr='rack';FS.rack=b.dataset.id;FS.sel=null;drawField()},
      shClose:()=>{FS.sel=null;drawField()},mv:()=>{const i=info(FS.sel);if(!i?.dev)return;FS.moving={k:FS.sel,d:i.dev.id};FS.sel=null;drawField()},mvEnd:()=>{FS.moving=null;drawField()},
      scan:scanQR,scanEnd:()=>SCAN&&SCAN.stop(),pack:sendFile,gist:sendGist})[a]?.();
  });
  el.addEventListener('change',e=>{
    if(e.target.id==='fcNote'&&FS.sel){const v=e.target.value.trim();if(v!==(P.field?.[FS.sel]?.note||''))addEntry(FS.sel,{note:v})}
    if(e.target.id==='fcH'&&FS.sel){addEntry(FS.sel,{h:e.target.value===''?'':+e.target.value})}
    if(e.target.id==='fcPh'&&FS.sel){const fs=[...e.target.files];e.target.value='';addPhotos(FS.sel,fs)}
  });
}

/* =====================================================================
   PC: importazione del sopralluogo, stato in planimetria e nei pannelli
   ===================================================================== */
let PK=null;
function analyze(p){
  const have=new Set((P.fieldlog||[]).map(e=>e.id));const nw=(p.entries||[]).filter(e=>e&&e.id&&e.k&&!have.has(e.id));
  const ok=nw.filter(e=>info(e.k));const unk=nw.length-ok.length;const keys=new Set(ok.map(e=>e.k));
  const conf=[];ok.filter(e=>e.st).forEach(e=>{const f=P.field?.[e.k];if(f?.t&&f.t>e.t&&f.st!==e.st)conf.push(e)});
  return {nw,ok,unk,keys,conf,st:ok.filter(e=>e.st).length,ph:ok.filter(e=>e.ph).length,notes:ok.filter(e=>e.note!=null).length,mv:ok.filter(e=>e.mv).length};
}
function openImportField(){
  const has=!!localStorage.getItem(TOK);
  modal('Importa sopralluogo',`<p>Scegli il file del sopralluogo inviato dal telefono oppure, se l'hai inviato con GitHub Gist, prendilo da qui.</p>
    <div class="btnrow"><button class="btn primario" data-fi="file">Scegli il file…</button>${has?'<button class="btn" data-fi="gistList">Cerca su Gist</button>':''}</div><div id="fiOut" style="margin-top:12px"></div>
    <p class="piccola">Il sopralluogo non sostituisce il progetto: vengono aggiunte solo le voci nuove (stato, note, foto, spostamenti). Se una presa è stata aggiornata anche dal PC dopo il sopralluogo, vale la modifica più recente.</p>`);
}
async function loadPack(p){
  if(!p||p.kind!=='ndc-sopralluogo'){toast('Questo file non è un sopralluogo di Network Design Center');return}
  PK=p;const a=analyze(p);
  $('#fiOut').innerHTML=`${p.pid&&p.pid!==P.pid?`<div class="esito warn">Il sopralluogo è stato fatto sul progetto «${esc(p.name)}»: verranno applicate solo le voci che corrispondono a prese e apparati di questo progetto.</div>`:''}
    <div class="esito ${a.ok.length?'ok':'warn'}">${a.ok.length?`${a.ok.length} aggiornamenti nuovi su ${a.keys.size} prese e apparati: ${a.st} cambi di stato, ${a.notes} note, ${a.ph} foto, ${a.mv} spostamenti.`:'Nessun aggiornamento nuovo: questo sopralluogo è già stato importato.'}
    ${p.a?`<br><small>Autore: ${esc(p.a)} · inviato il ${esc(new Date(p.t).toLocaleString(loc()))}</small>`:''}</div>
    ${a.unk?`<div class="esito warn">${a.unk} voci riguardano prese o apparati che non esistono più e verranno ignorate.</div>`:''}
    ${a.conf.length?`<div class="esito warn">${a.conf.length} prese hanno sul PC uno stato più recente di quello del sopralluogo: resta quello del PC.<br><small>${a.conf.slice(0,8).map(e=>esc(info(e.k)?.title||'')).join(', ')}${a.conf.length>8?'…':''}</small></div>`:''}
    ${a.ok.length?'<div class="btnrow" style="justify-content:flex-end"><button class="btn primario" data-fi="apply">Applica al progetto</button></div>':''}`;
}
async function applyPack(){
  const p=PK;if(!p)return;const a=analyze(p);
  for(const e of a.ok)if(e.ph&&p.photos?.[e.ph]&&!(await DB.get(e.ph))){const b=await dataToBlob(p.photos[e.ph]);await DB.put(e.ph,b)}
  mutate(()=>{P.fieldlog??=[];[...a.ok].sort((x,y)=>x.t-y.t).forEach(e=>{P.fieldlog.push(e);applyEntry(e)})});
  closeModal();toast(`${a.ok.length} aggiornamenti del sopralluogo applicati`);PK=null;
}
async function gistList(){
  $('#fiOut').innerHTML='<p class="piccola">Caricamento…</p>';
  try{const l=(await gh('/gists?per_page=100')).filter(g=>/^NDC sopralluogo/.test(g.description||''));
    $('#fiOut').innerHTML=l.length?l.map(g=>`<div class="pj"><div class="grow"><div class="pj-n">${esc(g.description.replace(/^NDC sopralluogo · /,''))}</div><div class="sub">${esc(new Date(g.updated_at).toLocaleString(loc()))}</div></div><button class="btn piccolo primario" data-fi="gist" data-id="${g.id}">Apri</button></div>`).join(''):'<p class="piccola">Nessun sopralluogo su Gist.</p>'}
  catch(e){$('#fiOut').innerHTML=`<div class="esito err">${esc(e.message)}</div>`}
}
async function gistOpen(id){try{const g=await gh('/gists/'+id);const f=Object.values(g.files)[0];let t=f.content;if(f.truncated)t=await (await fetch(f.raw_url)).text();loadPack(JSON.parse(t))}catch(e){toast(T('Apertura non riuscita:')+' '+e.message)}}
const fin=document.createElement('input');fin.type='file';fin.accept='.json,application/json';fin.hidden=true;document.body.appendChild(fin);
fin.onchange=async()=>{const f=fin.files[0];fin.value='';if(!f)return;try{loadPack(JSON.parse(await f.text()))}catch(_){toast('File non valido')}};
document.addEventListener('click',e=>{const b=e.target.closest('[data-fi]');if(!b)return;({file:()=>fin.click(),gistList,gist:()=>gistOpen(b.dataset.id),apply:applyPack})[b.dataset.fi]?.()});

/* --- finestra «Sopralluogo da telefono» sul PC --- */
async function openFieldInfo(){
  const base=location.origin+location.pathname;const url=base+'?campo=1';
  modal('Sopralluogo da telefono',`<div class="grid2"><div>
    <h3 style="margin-top:0">1 · Porta il progetto sul telefono</h3>
    <p>Il telefono ha un archivio suo: il progetto, con planimetrie e foto, va copiato una volta.</p>
    <ul class="fc-ul"><li><b>GitHub Gist</b>: qui menu ⋯ → «Salva o apri da GitHub Gist» → salva; sul telefono apri la stessa voce con lo stesso token e scegli il progetto.</li>
      <li><b>File</b>: «Esporta progetto (JSON)», invialo al telefono (mail, Drive, WhatsApp) e aprilo con «Importa progetto (JSON)…».</li></ul>
    <h3>2 · Apri la modalità sopralluogo</h3><p>Inquadra il QR qui accanto oppure, sul telefono, menu ⋯ → «Modalità sopralluogo». Puoi anche installare la pagina come app (Aggiungi a schermata Home): funziona anche senza rete.</p>
    <h3>3 · Riporta il lavoro sul PC</h3><p>Dal telefono «Condividi il file del sopralluogo» o «Invia con GitHub Gist»; qui menu ⋯ → «Importa sopralluogo…».</p></div>
    <div style="text-align:center"><div class="fc-qr">${X().qrSvg(url)}</div><div class="piccola mono" style="word-break:break-all">${esc(url)}</div>
      <div class="btnrow" style="justify-content:center;margin-top:14px"><button class="btn primario" data-fi2="here">Apri qui la modalità sopralluogo</button><button class="btn" data-fi2="imp">Importa sopralluogo…</button></div></div></div>`);
}
const X=()=>window.NDC;
document.addEventListener('click',e=>{const b=e.target.closest('[data-fi2]');if(!b)return;closeModal();if(b.dataset.fi2==='here')openField();else openImportField()});

/* --- stato nel PC: pannello proprietà, planimetria, porte --- */
function pcSection(k){
  if(!k)return '';const f=P.field?.[k];const i=info(k);if(!i)return '';const st=f?.st||'todo';const L=i.kind!=='to'?STDEV:ST;
  const hist=(P.fieldlog||[]).filter(e=>e.k===k).slice(-4).reverse();
  return `<div class="sez fc-pc"><h3>Sopralluogo</h3><div class="f"><label>Stato</label><select data-fsk="${k}">${Object.keys(L).map(s=>`<option value="${s}" ${s===st?'selected':''}>${L[s]}</option>`).join('')}</select></div>
    ${f?.prob&&st==='prob'?`<div class="kv"><span>Problema</span><b style="color:var(--err)">${esc(f.prob)}</b></div>`:''}${f?.note?`<div class="kv"><span>Nota</span><b>${esc(f.note)}</b></div>`:''}${f?.h!=null&&f.h!==''?`<div class="kv"><span>Altezza di montaggio</span><b>${esc(f.h)} m</b></div>`:''}
    ${f?.t?`<div class="kv"><span>Aggiornato</span><b>${dt(f.t)}${f.a?' · '+esc(f.a):''}</b></div>`:''}${thumbs(f?.photos)}
    ${hist.length?`<div class="piccola">${hist.map(e=>`${dt(e.t)}${e.a?' · '+esc(e.a):''}: ${e.st?esc(stLabel(k,e.st)):e.ph?'foto':e.note!=null?'nota':e.mv?'spostato':e.prob?esc(e.prob):''}`).join('<br>')}</div>`:''}</div>`;
}
const _dev=devHtml;devHtml=function(d,pl){return _dev.apply(this,arguments)+pcSection(keyOfDev(d))};
const _pe=portEditor;portEditor=function(r,it,n,L){const h=_pe.apply(this,arguments);if(it.kind!=='patch'||it.ports[n]?.t==='link')return h;return h+pcSection(`p:${r.id}:${it.id}:${n}`)};
const _render=render;render=function(){const x=_render.apply(this,arguments);try{paint()}catch(_){}return x};
function paint(){
  if(!P.field)return;
  $$('#pw .mk[data-mk^="mk:"]').forEach(m=>{const d=P.devices.find(x=>x.id===m.dataset.mk.slice(3));if(!d)return;const s=stOf(keyOfDev(d));if(s==='todo')delete m.dataset.fs;else m.dataset.fs=s});
  $$('#rightBody [data-port]').forEach(p=>{const it=R().items.find(i=>i.id===S.item);if(!it||it.kind!=='patch')return;const s=stOf(`p:${R().id}:${it.id}:${p.dataset.port}`);if(s==='todo')delete p.dataset.fs;else p.dataset.fs=s});
  fillThumbs($('#rightBody')||document);
}
document.addEventListener('change',e=>{const k=e.target.dataset?.fsk;if(!k)return;addEntry(k,{st:e.target.value})});
document.addEventListener('click',e=>{const ph=e.target.closest('.fc-pc [data-fph]');if(ph)imgUrl(ph.dataset.fph).then(u=>{if(u)modal('Foto',`<img src="${u}" style="max-width:100%;max-height:70vh;display:block;margin:0 auto;border-radius:8px" alt="Foto">`)})});

/* --- relazione: avanzamento lavori --- */
function reportHtml(){
  const rows=[];const all=new Set();
  P.plans.forEach(pl=>{const ks=planTargets(pl).map(x=>x.k);ks.forEach(k=>all.add(k));rows.push([pl.name,counts(ks)])});
  P.racks.forEach(r=>rackTargets(r).forEach(x=>all.add(x.k)));
  const tot=counts([...all]);
  const probs=[...all].filter(k=>stOf(k)==='prob').map(k=>[info(k),P.field[k]]);
  return `<h1>Avanzamento lavori</h1><div>${tot.tot} prese e apparati · ${tot.posata} posati · ${tot.cert} certificati · ${tot.attiva} attivi · ${tot.prob} con problemi · ${tot.todo} da fare</div>
    <h2>Per planimetria</h2><table><tr><th>Planimetria</th><th>Totale</th><th>Posate / installate</th><th>Certificate / collaudate</th><th>Attive</th><th>Problemi</th><th>Da fare</th></tr>${rows.map(([n,c])=>`<tr><td>${esc(n)}</td><td>${c.tot}</td><td>${c.posata}</td><td>${c.cert}</td><td>${c.attiva}</td><td>${c.prob}</td><td>${c.todo}</td></tr>`).join('')}</table>
    ${probs.length?`<h2>Problemi aperti</h2><table><tr><th>Presa / apparato</th><th>Problema</th><th>Nota</th><th>Segnalato</th></tr>${probs.map(([i,f])=>`<tr><td>${esc(i?.title||'')}${i?.sub?`<br><small>${esc(i.sub)}</small>`:''}</td><td>${esc(f.prob||'')}</td><td>${esc(f.note||'')}</td><td>${f.t?dt(f.t):''}${f.a?' · '+esc(f.a):''}</td></tr>`).join('')}</table>`:''}
    ${(P.fieldlog||[]).length?`<h2>Ultimi aggiornamenti</h2><table><tr><th>Quando</th><th>Chi</th><th>Presa / apparato</th><th>Aggiornamento</th></tr>${[...P.fieldlog].sort((a,b)=>b.t-a.t).slice(0,60).map(e=>`<tr><td>${dt(e.t)}</td><td>${esc(e.a||'')}</td><td>${esc(info(e.k)?.title||'')}</td><td>${e.st?esc(stLabel(e.k,e.st)):e.ph?'foto':e.note!=null?'nota: '+esc(e.note):e.mv?'spostato':e.h!=null?'altezza '+esc(e.h)+' m':e.prob?esc(e.prob):''}</td></tr>`).join('')}</table>`:''}`;
}

/* ---------------- menu e avvio ---------------- */
$('#moreMenu .menu-lista').addEventListener('click',e=>{const m=e.target.closest('[data-m]')?.dataset.m;({campo:()=>innerWidth<820?openField():openFieldInfo(),campoImp:openImportField})[m]?.()});
window.NDC_field={openField,closeField,openFieldInfo,openImportField,addEntry,applyEntry,info,keyOfDev,counts,planTargets,rackTargets,pack,loadPack,applyPack,reportHtml,stOf};
(function go(){if(!P){setTimeout(go,30);return}
  if(new URLSearchParams(location.search).get('campo')==='1'){openField();try{history.replaceState(null,'',location.pathname+location.hash)}catch(_){}}})();
})();
