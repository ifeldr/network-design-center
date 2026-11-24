/* =====================================================================
   Network Design Center — accessibilità
   Elementi attivabili da tastiera (Tab, Invio, Spazio), ruoli e nomi ARIA per i lettori
   di schermo, finestre modali con focus intrappolato, annunci delle notifiche.
   ===================================================================== */
(function(){
'use strict';
const T=s=>(window.NDC_tr||(x=>x))(s);
/* elementi che la tastiera deve poter raggiungere: selettore → come descriverli */
const txt=el=>(el.getAttribute('title')||el.textContent||'').replace(/\s+/g,' ').trim().slice(0,140);
const RULES=[
  ['#leftBody .card',el=>txt(el)],
  ['#leftBody .ritem',el=>txt(el)],
  ['#leftBody .chip',el=>txt(el)],
  ['#stage .it[data-id]',el=>{const it=R()?.items.find(i=>i.id===el.dataset.id);return it?`${nm(it)}, U${it.pos}${it.h>1?'–'+(it.pos+it.h-1):''}`:txt(el)}],
  ['#pv .mk[data-mk]',el=>{try{const k=el.dataset.mk;const o=mkObj(k);if(k.startsWith('rk:'))return `${T('Armadio')} ${rid(o)}`;return `${DEV[o.kind]?.name||''} ${devLabel(o)||o.name||''}`.trim()}catch(_){return txt(el)}}],
  ['.bnode[data-bn],.sala-r[data-room],.tnode[data-goto],.issue[data-item],.fc-mk[data-fk],.fc-mk[data-fr]',el=>txt(el)],
];
function sel(el){return el.classList.contains('sel')||el.classList.contains('on')}
function decorate(root=document){
  for(const [q,lab] of RULES)root.querySelectorAll(q).forEach(el=>{
    if(!el.hasAttribute('tabindex'))el.tabIndex=0;el.setAttribute('role',el.getAttribute('role')||'button');
    const l=lab(el);if(l)el.setAttribute('aria-label',l);el.setAttribute('aria-pressed',sel(el)?'true':'false')});
  root.querySelectorAll('.pt[data-port]').forEach(el=>{if(!el.getAttribute('aria-label'))el.setAttribute('aria-label',`${T('Porta')} ${el.dataset.port}${el.title?' · '+el.title:''}`)});
  root.querySelectorAll('button.icona:not([aria-label])').forEach(el=>{const t=el.getAttribute('title');if(t)el.setAttribute('aria-label',t)});
  root.querySelectorAll('.seg button,.seg [data-seg]').forEach(el=>el.setAttribute('aria-pressed',el.classList.contains('on')?'true':'false'));
}
/* attivazione: simula un clic del puntatore (le librerie, gli apparati e i segnaposto usano pointerdown/up) */
function activate(el){
  const r=el.getBoundingClientRect();const o={bubbles:true,cancelable:true,composed:true,clientX:r.left+Math.min(r.width/2,20),clientY:r.top+r.height/2,button:0,buttons:1,pointerId:1,pointerType:'mouse',isPrimary:true};
  const usesPointer=el.matches('#leftBody .card,#stage .it[data-id],#pv .mk[data-mk],.fc-mk');
  if(usesPointer){el.dispatchEvent(new PointerEvent('pointerdown',o));window.dispatchEvent(new PointerEvent('pointerup',{...o,buttons:0}));el.dispatchEvent(new PointerEvent('pointerup',{...o,buttons:0}))}
  else el.click();
}
let refocus=null;
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter'&&e.key!==' ')return;const el=e.target;if(!(el instanceof Element)||el.matches('input,textarea,select,button,a,[contenteditable]'))return;
  if(!el.matches(RULES.map(r=>r[0]).join(',')))return;e.preventDefault();e.stopPropagation();
  refocus=keyOf(el);activate(el);
},true);
/* dopo il ridisegno l'elemento è nuovo: ripristina il fuoco su quello equivalente */
function keyOf(el){for(const a of ['id','mk','kind','rack','plan','vend','bn','room','fk','fr','rmodel','fmodel','dev','prack','tport','item','goto'])if(el.dataset[a]!=null)return `[data-${a.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}="${CSS.escape(el.dataset[a])}"]`;return null}
function restore(){if(!refocus)return;const q=refocus;refocus=null;if(document.activeElement&&document.activeElement!==document.body&&document.contains(document.activeElement))return;const el=document.querySelector(q);if(el)el.focus({preventScroll:true})}
const _r=render;render=function(){const x=_r.apply(this,arguments);try{decorate();restore()}catch(_){}return x};
const _rl=renderLeft;renderLeft=function(){const x=_rl.apply(this,arguments);try{decorate($('#left'))}catch(_){}return x};

/* finestra modale: ruolo, fuoco iniziale, Tab intrappolato, ritorno del fuoco */
const M=$('#modal'),D=M.querySelector('.dialogo');
D.setAttribute('role','dialog');D.setAttribute('aria-modal','true');D.setAttribute('aria-labelledby','mTitle');
let opener=null;
const FOC='a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const vis=el=>el.offsetParent!==null||el.getClientRects().length>0;
new MutationObserver(()=>{const open=M.classList.contains('open');
  if(open&&!M._open){M._open=true;opener=document.activeElement;['#left','#main','#right','header.testata'].forEach(q=>$(q)?.setAttribute('aria-hidden','true'));
    setTimeout(()=>{if(!M.classList.contains('open'))return;const f=[...D.querySelectorAll('#mBody '+FOC.split(',').join(',#mBody '))].find(vis)||D.querySelector('[data-close]');f?.focus({preventScroll:true})},30)}
  else if(!open&&M._open){M._open=false;['#left','#main','#right','header.testata'].forEach(q=>$(q)?.removeAttribute('aria-hidden'));if(opener&&document.contains(opener))opener.focus({preventScroll:true});opener=null}
  if(open)decorate(D)}).observe(M,{attributes:true,attributeFilter:['class']});
new MutationObserver(()=>{if(M.classList.contains('open'))decorate(D)}).observe($('#mBody'),{childList:true});
document.addEventListener('keydown',e=>{
  if(!M.classList.contains('open'))return;
  if(e.key==='Escape'&&e.target.matches?.('input,textarea,select')){e.preventDefault();e.target.blur();closeModal();return}
  if(e.key!=='Tab')return;const l=[...D.querySelectorAll(FOC)].filter(vis);if(!l.length)return;const a=l[0],z=l[l.length-1];
  if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}
  else if(!D.contains(document.activeElement)){e.preventDefault();a.focus()}
});

/* notifiche lette dai lettori di schermo, menu con stato espanso */
const t=$('#toast');t.setAttribute('aria-live','polite');t.setAttribute('aria-atomic','true');
const mb=document.querySelector('[data-act="more"],#moreBtn,.testata [aria-controls="moreMenu"]');
if(mb){mb.setAttribute('aria-haspopup','menu');mb.setAttribute('aria-controls','moreMenu');new MutationObserver(()=>mb.setAttribute('aria-expanded',$('#moreMenu').classList.contains('open')?'true':'false')).observe($('#moreMenu'),{attributes:true,attributeFilter:['class']})}
$('#moreMenu .menu-lista')?.setAttribute('role','menu');$$('#moreMenu .menu-lista button').forEach(b=>b.setAttribute('role','menuitem'));
document.addEventListener('keydown',e=>{if(!$('#moreMenu').classList.contains('open'))return;const l=$$('#moreMenu .menu-lista button').filter(vis);const i=l.indexOf(document.activeElement);
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const n=i<0?0:(i+(e.key==='ArrowDown'?1:-1)+l.length)%l.length;l[n]?.focus()}
  else if(e.key==='Escape'){$('#moreMenu').classList.remove('open');mb?.focus()}});

/* collegamento per saltare al contenuto e regione principale */
if(!$('#skipLink')){document.body.insertAdjacentHTML('afterbegin',`<a href="#main" id="skipLink" class="skip">${esc(T('Salta al contenuto'))}</a>`);
  $('#skipLink').addEventListener('click',e=>{e.preventDefault();const m=$('#stage .it[data-id],#pv .mk[data-mk]')||$('#main');if(m===$('#main'))m.tabIndex=-1;m.focus()})}
$('#stage')?.setAttribute('aria-label',T('Area di lavoro'));
decorate();
window.NDC_a11y={decorate,activate};
})();
