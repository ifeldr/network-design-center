/* =====================================================================
   Network Design Center — protezione dei dati e guida introduttiva
   • archivio persistente (il browser non cancella i dati quando lo spazio scarseggia)
   • spazio usato e disponibile
   • avviso per Safari (iPhone, iPad, Mac), che può cancellare i dati dopo 7 giorni di inutilizzo
   • guida introduttiva al primo avvio, richiamabile dal menu
   ===================================================================== */
(function(){
'use strict';
const T=s=>(window.NDC_tr||(x=>x))(s);
const UA=navigator.userAgent||'';
const IOS=/iPad|iPhone|iPod/.test(UA)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const SAFARI_MAC=/Macintosh/.test(UA)&&/Safari/.test(UA)&&!/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/.test(UA);
const APPLE=IOS||SAFARI_MAC;
const FIREFOX=/Firefox|FxiOS/.test(UA);
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const bset=()=>{try{return JSON.parse(localStorage.getItem('ndc-backup')||'{}')}catch(_){return {}}};
const hasWork=()=>projIndex().some(x=>x.racks>1||x.plans>0||x.devices>0)||P.racks.some(r=>r.items.length);
const LC=()=>window.NDC_lang==='en'?'en-GB':'it-IT';const mb=n=>{const f=(v,d)=>v.toLocaleString(LC(),{maximumFractionDigits:d});return n>=1e9?f(n/1e9,1)+' GB':n>=1e6?f(n/1e6,1)+' MB':f(Math.max(1,n/1e3),0)+' kB'};

/* ---------------- archivio persistente ---------------- */
async function persisted(){try{return !!(await navigator.storage?.persisted?.())}catch(_){return false}}
async function askPersist(user){
  if(!navigator.storage?.persist)return false;
  if(await persisted())return true;
  if(FIREFOX&&!user)return false; // Firefox mostra una richiesta: solo su azione dell'utente
  try{const ok=await navigator.storage.persist();if(user)toast(ok?'Dati protetti: il browser non li cancellerà per liberare spazio':'Il browser non ha concesso la protezione: tieni attivo il backup');return ok}catch(_){return false}
}
async function storeHtml(){
  let est={};try{est=await navigator.storage?.estimate?.()||{}}catch(_){}
  let ls=0;try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);ls+=(k.length+(localStorage.getItem(k)||'').length)*2}}catch(_){}
  const per=await persisted();const used=est.usage||0,quota=est.quota||0;const pct=quota?Math.min(100,used/quota*100):0;
  const lsMax=5*1024*1024;const lsPct=Math.min(100,ls/lsMax*100);
  return `<div class="sez"><h3>Spazio nel browser</h3>
    ${quota?`<div class="kv"><span>Planimetrie, foto e versioni</span><b>${mb(used)} di ${mb(quota)} disponibili</b></div><div class="fc-bar st-bar"><i style="width:${Math.max(.5,pct)}%"></i></div>`:''}
    <div class="kv"><span>Progetti e impostazioni</span><b>${mb(ls)} di circa 5 MB</b></div><div class="fc-bar st-bar ${lsPct>80?'hot':''}"><i style="width:${Math.max(.5,lsPct)}%"></i></div>
    ${lsPct>80?'<div class="esito warn">Lo spazio per i progetti è quasi pieno: elimina i progetti che non usi o esportali e toglili dal browser.</div>':''}
    <div class="kv"><span>Protezione dei dati</span><b style="color:var(--${per?'ok':'warn'})">${per?'attiva: il browser non li cancella per liberare spazio':'non attiva'}</b></div>
    ${!per&&navigator.storage?.persist?`<div class="btnrow" style="margin-top:6px"><button class="btn piccolo" data-care="persist">Proteggi i dati di questo browser</button></div>`:''}
    ${APPLE&&!standalone()?`<div class="esito warn">Safari può cancellare i dati di un sito che non apri per 7 giorni. <a href="#" data-care="apple">Come evitarlo</a></div>`:''}</div>`;
}
async function fillStore(){const el=$('#bkStore');if(el)el.innerHTML=await storeHtml()}
window.NDC_care={fillStore,askPersist,startTour:()=>startTour(0)};

/* ---------------- avviso per Safari ---------------- */
function appleHelp(){
  modal('Dati al sicuro su Safari',`<p>Su iPhone, iPad e Mac, Safari (e ogni browser su iPhone e iPad) può cancellare i dati dei siti che non apri per 7 giorni. Per non perdere i progetti:</p>
  <ol class="fc-ul"><li><b>Installa la pagina come app</b>: le app installate non sono soggette a questa pulizia.<br><small>iPhone e iPad: pulsante <b>Condividi</b> → <b>Aggiungi alla schermata Home</b>. Mac: menu <b>File</b> → <b>Aggiungi al Dock</b> (Safari 17 o successivo).</small></li>
  <li><b>Attiva il backup automatico su GitHub Gist</b> (menu ⋯ → «Backup dei progetti…») oppure scarica un backup prima di una pausa lunga.</li></ol>
  <div class="btnrow" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-care="appleLater">Ho capito</button><button class="btn primario" data-care="backup">Apri il backup</button></div>`);
}
function checkApple(){
  if(!APPLE||standalone()||bset().mode==='gist'||!hasWork())return;
  let sn=0;try{sn=+localStorage.getItem('ndc-safari-avviso')||0}catch(_){}if(Date.now()-sn<3*864e5)return;
  if($('#saBanner'))return;const d=document.createElement('div');d.id='saBanner';d.className='bk-banner sa-banner';
  d.innerHTML=`<span>Su Safari i dati di un sito non usato per 7 giorni possono essere cancellati.</span><button class="btn piccolo primario" data-care="apple">Come evitarlo</button><button class="btn piccolo" data-care="saLater">Più tardi</button>`;
  document.body.appendChild(d);
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-care]');if(!b)return;e.preventDefault();const a=b.dataset.care;
  if(a==='persist')askPersist(true).then(fillStore);
  else if(a==='apple'){$('#saBanner')?.remove();appleHelp()}
  else if(a==='saLater'||a==='appleLater'){try{localStorage.setItem('ndc-safari-avviso',String(Date.now()))}catch(_){}$('#saBanner')?.remove();if(a==='appleLater')closeModal()}
  else if(a==='backup'){closeModal();window.NDC_clip?.openBackup()}
});

/* ---------------- guida introduttiva ---------------- */
const MOD=()=>window.NDC_keys?.MAC?'⌘K':'Ctrl+K';
const STEPS=()=>[
  {sel:'.viste',t:'Tre viste',d:'<b>Armadio</b> per allestire gli armadi, <b>Planimetria</b> per posizionare prese e apparati sulla pianta, <b>Campus</b> per edifici e collegamenti.'},
  {sel:'#leftTabs',t:'Libreria e modelli',d:'Trascina un elemento nell\'armadio o fai clic per inserirlo. In <b>Modelli</b> ci sono oltre 1300 apparati di marca e puoi aggiungere i tuoi; in <b>Armadi</b> crei gli armadi, anche da un modello pronto.'},
  {sel:'#autoBtn',t:'Auto-organizza',d:'Dispone l\'armadio secondo le regole di allestimento: fibra in alto, poi rame e apparati attivi, alimentazione in basso, passacavi e ciechi.'},
  {sel:'#right .schede',t:'Proprietà e conformità',d:'A destra modifichi l\'elemento selezionato; in <b>Conformità</b> trovi le segnalazioni da correggere e il punteggio dell\'armadio.'},
  {sel:'[data-view=plan]',t:'Planimetria',d:'Carica la pianta (anche PDF), calibra la scala e trascina armadi, prese, access point e telecamere: ognuno riceve la sua presa e la sua etichetta. Puoi anche disegnare muri e aggiungere note.'},
  {sel:'#projBtn',t:'I miei progetti',d:'Più progetti nel browser, con versioni salvate e confronto tra le versioni.'},
  {sel:'#searchBtn',t:'Ricerca',d:()=>`Trova armadi, prese, locali, modelli, seriali, MAC e IP. Scorciatoia: <kbd>${MOD()}</kbd>.`},
  {sel:'#moreBtn',t:'Tutto il resto è qui',d:'VLAN e piano IP, permutazioni, etichette, distinta, NetBox e Snipe-IT, relazione in PDF, sopralluogo dal telefono, backup e la guida completa con le scorciatoie.'},
  {sel:null,t:'Pronto',d:'I progetti restano nel tuo browser: ricordati il backup (menu ⋯ → «Backup dei progetti…»). Puoi rivedere questa guida da menu ⋯ → «Guida introduttiva».'}
];
let TI=0;
const visible=el=>{if(!el)return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden'};
function target(s){if(!s.sel)return null;for(const q of s.sel.split(',')){const el=$(q.trim());if(visible(el))return el}return null}
function startTour(i=0){closeModal();$('#moreMenu')?.classList.remove('open');if(S.view!=='rack'){S.view='rack';render()}TI=i;showStep()}
function endTour(){$('#tour')?.remove();try{localStorage.setItem('ndc-guida','1')}catch(_){}}
function showStep(){
  const all=STEPS();while(TI<all.length-1&&all[TI].sel&&!target(all[TI]))TI++;
  const s=all[TI];const el=target(s);let o=$('#tour');if(!o){o=document.createElement('div');o.id='tour';o.className='tour';document.body.appendChild(o)}
  const n=all.length;const d=typeof s.d==='function'?s.d():s.d;
  o.innerHTML=`<div class="tour-hole" ${el?'':'hidden'}></div><div class="tour-box" role="dialog" aria-label="Guida introduttiva"><div class="tour-n">${TI+1} / ${n}</div><h3>${s.t}</h3><p>${d}</p>
    <div class="btnrow"><button class="btn piccolo" data-tour="skip">${TI===n-1?'Chiudi':'Salta la guida'}</button><span style="flex:1"></span>${TI>0?'<button class="btn piccolo" data-tour="prev">Indietro</button>':''}<button class="btn piccolo primario" data-tour="next">${TI===n-1?'Inizia':'Avanti'}</button></div></div>`;
  const box=o.querySelector('.tour-box');const hole=o.querySelector('.tour-hole');
  if(el){const r=el.getBoundingClientRect();const pad=6;Object.assign(hole.style,{left:r.left-pad+'px',top:r.top-pad+'px',width:r.width+pad*2+'px',height:r.height+pad*2+'px'});
    const bw=Math.min(340,innerWidth-24);box.style.width=bw+'px';const bh=box.offsetHeight;
    let top=r.bottom+14,left=r.left+r.width/2-bw/2;if(top+bh>innerHeight-12)top=r.top-bh-14;if(top<12)top=Math.min(innerHeight-bh-12,r.bottom+14);
    left=Math.max(12,Math.min(innerWidth-bw-12,left));Object.assign(box.style,{left:left+'px',top:top+'px'})}
  else{box.style.width=Math.min(380,innerWidth-24)+'px';Object.assign(box.style,{left:'50%',top:'50%',transform:'translate(-50%,-50%)'})}
  o.querySelector('[data-tour=next]').focus();
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-tour]');if(!b)return;const a=b.dataset.tour;const n=STEPS().length;
  if(a==='next'){if(TI>=n-1)endTour();else{TI++;showStep()}}else if(a==='prev'){TI=Math.max(0,TI-1);let t=TI;while(t>0&&STEPS()[t].sel&&!target(STEPS()[t]))t--;TI=t;showStep()}else endTour()});
window.addEventListener('keydown',e=>{if(!$('#tour'))return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();endTour()}else if(e.key==='ArrowRight'||e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();$('[data-tour=next]')?.click()}else if(e.key==='ArrowLeft'){e.preventDefault();e.stopImmediatePropagation();$('[data-tour=prev]')?.click()}},true);
window.addEventListener('resize',()=>{if($('#tour'))showStep()});

/* ---------------- avvio e menu ---------------- */
$('#moreMenu .menu-lista').addEventListener('click',e=>{const m=e.target.closest('[data-m]')?.dataset.m;if(m==='tour')startTour(0)});
(function go(){if(!P){setTimeout(go,30);return}
  setTimeout(async()=>{
    if(hasWork())askPersist(false);
    let seen=false;try{seen=!!localStorage.getItem('ndc-guida')}catch(_){}
    const field=new URLSearchParams(location.search).has('campo')||($('#campo')&&!$('#campo').hidden);
    if(!seen&&!field&&innerWidth>=900&&!hasWork()&&!navigator.webdriver)startTour(0);
    setTimeout(checkApple,6000);
  },900);
})();
})();
