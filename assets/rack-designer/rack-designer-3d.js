/* =====================================================================
   Network Design Center — vista 3D dell'armadio (CSS 3D, nessuna libreria)
   Gli apparati sono parallelepipedi con la loro altezza in U e la profondità stimata
   (o inserita nei dati tecnici): si vede subito cosa sporge o tocca il fondo.
   ===================================================================== */
(function(){
'use strict';
const X=()=>window.NDC;
const V={on:false,rx:-14,ry:-32,z:1,fit:1};
const cam=()=>`scale(${V.z*V.fit}) rotateX(${V.rx}deg) rotateY(${V.ry}deg)`;
const UH=30;                        // pixel per U nella scena
const MM=UH/44.45;                  // pixel per millimetro
const FW=UH*10.9+28;                // larghezza del frontale 19" (con le orecchie)
const num=(v,d=0)=>{const n=parseFloat(String(v??'').replace(',','.'));return Number.isFinite(n)?n:d};
const rDepthMM=r=>num(r.depth,r.units<=15?450:800);
const face=(cls,st,inner='')=>`<div class="r3-f ${cls}" style="${st}">${inner}</div>`;
function box(w,h,d,front,cls=''){ // origine: angolo in alto a sinistra del frontale, profondità verso il fondo
  return face('fr '+cls,`width:${w}px;height:${h}px`,front)+face('bk '+cls,`width:${w}px;height:${h}px;transform:translateZ(${-d}px)`)
   +face('tp '+cls,`width:${w}px;height:${d}px;transform-origin:top;transform:rotateX(-90deg)`)+face('bt '+cls,`width:${w}px;height:${d}px;top:${h}px;transform-origin:top;transform:rotateX(-90deg)`)
   +face('lf '+cls,`width:${d}px;height:${h}px;transform-origin:left;transform:rotateY(90deg)`)+face('rt '+cls,`width:${d}px;height:${h}px;left:${w}px;transform-origin:left;transform:rotateY(90deg)`);
}
function scene(r){
  const L=panelLetters(r);const H=r.units*UH;const D=rDepthMM(r)*MM;const OW=FW+70,OH=H+60;
  const items=[...r.items].sort((a,b)=>b.pos-a.pos).map(it=>{
    const f=faceHtml(it,L[it.id]);const h=it.h*UH;const y=(r.units-(it.pos+it.h-1))*UH;
    let dep=num(X()?.spec?.(it)?.dep,300);if(it.kind==='blank'||it.kind==='cm')dep=it.kind==='cm'?80:15;const d=Math.max(6,dep*MM);const over=dep>rDepthMM(r)-60;
    const tint=it.kind==='blank'?'blank':['patch','fo'].includes(it.kind)?'pas':'att';
    return `<div class="r3-it ${S.item===it.id?'sel':''} ${over?'over':''}" data-r3="${it.id}" style="transform:translate3d(${(OW-FW)/2}px,${30+y}px,-14px)" title="${esc(nm(it))} · U${it.pos} · ${Math.round(dep)} mm">${box(FW,h,d,`<div class="it ${f.cls}" style="position:absolute;inset:0;left:0;right:0;cursor:pointer">${f.html}</div>`,tint)}</div>`}).join('');
  const posts=[0,OW-18].map(x=>`<div class="r3-it" style="transform:translate3d(${x}px,0,0)">${box(18,OH,D,'','post')}</div>`).join('');
  return `<div class="r3-rack" style="width:${OW}px;height:${OH}px;transform:translate(-50%,-50%) translateZ(${D/2}px)">
    <div class="r3-it" style="transform:translate3d(0,0,0)">${face('tp frame',`width:${OW}px;height:${D}px;transform-origin:top;transform:rotateX(-90deg)`)+face('bt frame',`width:${OW}px;height:${D}px;top:${OH}px;transform-origin:top;transform:rotateX(-90deg)`)
      +face('lf side',`width:${D}px;height:${OH}px;transform-origin:left;transform:rotateY(90deg)`)+face('rt side',`width:${D}px;height:${OH}px;left:${OW}px;transform-origin:left;transform:rotateY(90deg)`)+face('bk frame back',`width:${OW}px;height:${OH}px;transform:translateZ(${-D}px)`)}</div>
    ${posts}${items}
    <div class="r3-lbl" style="transform:translate3d(0,${-34}px,0)">${esc(rid(r))} · ${r.units} U · ${Math.round(rDepthMM(r))} mm</div></div>`;
}
function draw(){
  const st=$('#stage');if(!st)return;const r=R();{const H=r.units*UH+60,D=rDepthMM(r)*MM,W=FW+70;const b=st.getBoundingClientRect();V.fit=Math.max(.2,Math.min(1.2,(b.height-150)/(H+D*.35),(b.width-60)/(W+D*.7)))}
  st.innerHTML=`<div class="r3" id="r3"><div class="r3-cam" style="--uh:${UH}px;transform:${cam()}">${scene(r)}</div>
    <div class="r3-ctl"><button class="btn piccolo" data-r3v="front">Frontale</button><button class="btn piccolo" data-r3v="side">Laterale</button><button class="btn piccolo" data-r3v="iso">Prospettiva</button><button class="btn piccolo" data-r3v="back">Retro</button>
      <span class="piccola">Trascina per ruotare · rotellina per lo zoom · in rosso gli apparati che arrivano al fondo</span></div></div>`;
}
const _rr=renderRack;renderRack=function(r){if(V.on&&!S.room){$('#stage').classList.remove('room');draw();return}return _rr.apply(this,arguments)};
const _rf=renderFloat;renderFloat=function(){const x=_rf.apply(this,arguments);try{if(S.view==='rack'){const fb=$('#floatBar');if(fb&&!fb.querySelector('[data-r3t]'))fb.insertAdjacentHTML('beforeend',`<button class="btn piccolo ${V.on?'on':''}" data-r3t title="Vista 3D dell'armadio">3D</button>`)}}catch(_){}return x};
const views={front:[0,0],side:[-8,-88],iso:[-14,-32],back:[0,180]};
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-r3t]');if(t){V.on=!V.on;if(V.on){S.rear=false;S.room=false}render();return}
  const v=e.target.closest('[data-r3v]');if(v){[V.rx,V.ry]=views[v.dataset.r3v];const c=$('.r3-cam');if(c){c.style.transition='transform .45s';c.style.transform=cam();setTimeout(()=>c.style.transition='',500)}return}
});
$('#stage').addEventListener('pointerdown',e=>{
  if(!V.on||S.view!=='rack'||e.button>0)return;const w=e.target.closest('#r3');if(!w)return;if(e.target.closest('.r3-ctl')){e.stopImmediatePropagation();return}
  e.preventDefault();e.stopImmediatePropagation();const x0=e.clientX,y0=e.clientY,rx=V.rx,ry=V.ry;let moved=false;const cm=$('.r3-cam');
  const mv=ev=>{const dx=ev.clientX-x0,dy=ev.clientY-y0;if(!moved&&Math.hypot(dx,dy)<4)return;moved=true;V.ry=ry+dx*.4;V.rx=Math.max(-80,Math.min(80,rx-dy*.3));cm.style.transform=cam()};
  window.addEventListener('pointermove',mv);
  window.addEventListener('pointerup',()=>{window.removeEventListener('pointermove',mv);if(!moved){const it=e.target.closest('[data-r3]');if(it){S.item=it.dataset.r3;S.port=null;S.right='props';render()}}},{once:true});
},true);
$('#stage').addEventListener('wheel',e=>{if(!V.on||S.view!=='rack'||!e.target.closest('#r3'))return;e.preventDefault();V.z=Math.max(.3,Math.min(2.5,V.z*(e.deltaY<0?1.1:1/1.1)));const c=$('.r3-cam');if(c)c.style.transform=cam()},{passive:false});
try{if(typeof P!=="undefined"&&P)renderFloat()}catch(_){}
window.NDC_3d={V,draw};
})();
