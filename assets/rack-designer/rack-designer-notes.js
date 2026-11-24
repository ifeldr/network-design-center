/* =====================================================================
   Network Design Center — note sulla planimetria
   Testi, frecce e aree evidenziate («passaggio a soffitto», «zona da non forare»…), in coordinate
   della pianta: si vedono a schermo, sul telefono, nel PNG, nella stampa e nella relazione.
   ===================================================================== */
(function(){
'use strict';
const T=s=>(window.NDC_tr||(x=>x))(s);
const COL={rosso:'#dc3545',arancione:'#fd7e14',giallo:'#e0a800',verde:'#198754',blu:'#0d6efd',viola:'#6f42c1',nero:'#212529'};
const SIZE={piccolo:.7,medio:1,grande:1.5};
const base=pl=>Math.max(12,Math.round(Math.max(pl.w,pl.h)/90));
const notes=pl=>(pl.notes??=[]);
const findN=id=>{for(const pl of P.plans){const n=(pl.notes||[]).find(x=>x.id===id);if(n)return {pl,n}}return null};
let A={tool:null,col:'rosso',sz:'medio',sel:null,draft:null};
try{const s=JSON.parse(localStorage.getItem('ndc-note-stile')||'{}');if(COL[s.col])A.col=s.col;if(SIZE[s.sz])A.sz=s.sz}catch(_){}
const keepStyle=()=>{try{localStorage.setItem('ndc-note-stile',JSON.stringify({col:A.col,sz:A.sz}))}catch(_){}};

/* ---------------- disegno (SVG) ---------------- */
const esc2=s=>esc(s||'');
function shape(n,pl,{sel=false,ro=false}={}){
  const c=COL[n.c]||n.c||COL.rosso;const fs=base(pl)*(SIZE[n.s]||1);const sw=Math.max(2,fs/6);const da=ro?'':`data-ann="${n.id}"`;
  const lbl=(x,y,t,anchor='start')=>t?`<text x="${x}" y="${y}" font-size="${fs}" fill="${c}" text-anchor="${anchor}" class="an-t">${esc2(t)}</text>`:'';
  let h='';
  if(n.t==='text')h=`<g ${da} class="an ${sel?'on':''}"><text x="${n.x}" y="${n.y}" font-size="${fs*1.15}" fill="${c}" class="an-t an-hit">${esc2(n.text||'…')}</text></g>`;
  else if(n.t==='arrow'){const a=Math.atan2(n.y2-n.y,n.x2-n.x),L=fs*.9;const p1=[n.x2-L*Math.cos(a-.4),n.y2-L*Math.sin(a-.4)],p2=[n.x2-L*Math.cos(a+.4),n.y2-L*Math.sin(a+.4)];
    h=`<g ${da} class="an ${sel?'on':''}"><line x1="${n.x}" y1="${n.y}" x2="${n.x2}" y2="${n.y2}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round"/><line x1="${n.x}" y1="${n.y}" x2="${n.x2}" y2="${n.y2}" stroke="transparent" stroke-width="${sw*6}" class="an-hit"/>
      <polygon points="${n.x2},${n.y2} ${p1.join(',')} ${p2.join(',')}" fill="${c}"/>${lbl(n.x,n.y-fs*.4,n.text,n.x2<n.x?'start':'end')}
      ${sel&&!ro?`<circle cx="${n.x}" cy="${n.y}" r="${fs*.45}" class="an-h" data-annh="p1"/><circle cx="${n.x2}" cy="${n.y2}" r="${fs*.45}" class="an-h" data-annh="p2"/>`:''}</g>`}
  else if(n.t==='area'){const x=Math.min(n.x,n.x+n.w),y=Math.min(n.y,n.y+n.h),w=Math.abs(n.w),hh=Math.abs(n.h);
    h=`<g ${da} class="an ${sel?'on':''}"><rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="${c}" fill-opacity=".14" stroke="${c}" stroke-width="${sw}" stroke-dasharray="${sw*3} ${sw*2}" class="an-hit"/>${lbl(x+fs*.3,y+fs*1.1,n.text)}
      ${sel&&!ro?`<circle cx="${x+w}" cy="${y+hh}" r="${fs*.45}" class="an-h" data-annh="br"/>`:''}</g>`}
  return h;
}
function svgFor(pl,ro){const ns=pl.notes||[];if(!ns.length&&!A.draft)return '';
  return `<svg class="anns${ro?' ro':''}" data-noi18n viewBox="0 0 ${pl.w} ${pl.h}" preserveAspectRatio="none">${ns.map(n=>shape(n,pl,{sel:!ro&&A.sel===n.id,ro})).join('')}${!ro&&A.draft?shape(A.draft,pl,{ro:true}):''}</svg>`}
window.NDC_notes={svgFor,shape};
const _rp=renderPlan;renderPlan=function(){const x=_rp.apply(this,arguments);try{paintNotes()}catch(_){}return x};
function paintNotes(){const pl=PL();const pw=$('#pw');if(!pl||!pw)return;pw.querySelector('svg.anns')?.remove();const h=svgFor(pl,false);if(h)pw.insertAdjacentHTML('beforeend',h);hint()}
function hint(){$('#annHint')?.remove();if(!A.tool||S.view!=='plan')return;const pv=$('#pv');if(!pv)return;
  const msg={text:'Clicca dove scrivere la nota',arrow:'Trascina dalla coda alla punta della freccia',area:'Trascina per disegnare l\'area'}[A.tool];
  pv.insertAdjacentHTML('afterbegin',`<div class="suggerimento" id="annHint"><b>Note</b>: ${['text','arrow','area'].map(t=>`<button class="btn piccolo ${A.tool===t?'on':''}" data-annt="${t}">${{text:'Testo',arrow:'Freccia',area:'Area'}[t]}</button>`).join('')}
    <span class="an-sw">${Object.entries(COL).map(([k,v])=>`<i data-annc="${k}" title="${k}" style="background:${v}" class="${A.col===k?'on':''}"></i>`).join('')}</span>
    <select data-anns>${Object.keys(SIZE).map(k=>`<option value="${k}" ${A.sz===k?'selected':''}>${k}</option>`).join('')}</select> · ${msg} · <button class="btn piccolo" data-annt="end">Fine</button></div>`)}

/* ---------------- barra degli strumenti e pannello ---------------- */
const _rf=renderFloat;renderFloat=function(){const x=_rf.apply(this,arguments);try{if(S.view==='plan'&&PL()){const fb=$('#floatBar');if(fb&&!fb.querySelector('[data-annt]')){const r=fb.querySelector('[data-xa="ruler"]');const b=`<button class="btn piccolo ${A.tool?'on':''}" data-annt="${A.tool?'end':'text'}">Note</button>`;r?r.insertAdjacentHTML('afterend',b):fb.insertAdjacentHTML('beforeend',b)}}}catch(_){}return x};
const _render=render;render=function(){const x=_render.apply(this,arguments);try{panel()}catch(_){}return x};
function panel(){if(S.view!=='plan'||!A.sel)return;const f=findN(A.sel);if(!f||f.pl.id!==PL()?.id){A.sel=null;return}const n=f.n;const rb=$('#rightBody');if(!rb)return;
  rb.innerHTML=`<div class="sez"><h3>Nota in planimetria</h3><div class="idbox"><div class="titolo">${{text:'Testo',arrow:'Freccia',area:'Area evidenziata'}[n.t]}</div><div class="syn">${esc(f.pl.name)}</div></div>
    <div class="f"><label>Testo</label><input type="text" data-anf="text" value="${esc(n.text||'')}" placeholder="${n.t==='text'?'es. Passaggio a soffitto':'facoltativo'}"></div>
    <div class="f"><label>Colore</label><span class="an-sw">${Object.entries(COL).map(([k,v])=>`<i data-anf-c="${k}" title="${k}" style="background:${v}" class="${(n.c||'rosso')===k?'on':''}"></i>`).join('')}</span></div>
    <div class="f"><label>Dimensione</label><select data-anf="s">${Object.keys(SIZE).map(k=>`<option value="${k}" ${(n.s||'medio')===k?'selected':''}>${k}</option>`).join('')}</select></div>
    <div class="btnrow" style="margin-top:8px"><button class="btn piccolo" data-annx="dup">Duplica</button><button class="btn piccolo rosso" data-annx="del">Elimina</button><button class="btn piccolo" data-annx="none">Chiudi</button></div>
    <p class="piccola">Trascina la nota per spostarla${n.t!=='text'?'; trascina i punti bianchi per cambiarne la forma':''}. ${window.NDC_keys?.MAC?'⌫':'Canc'} la elimina.</p></div>`;
}
function setTool(t){if(t==='end'){A.tool=null;A.draft=null}else{A.tool=t;A.sel=null;S.mk=null;if(S.tool)S.tool=null}render()}
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-annt]');if(t){setTool(t.dataset.annt);return}
  const c=e.target.closest('[data-annc]');if(c){A.col=c.dataset.annc;keepStyle();hint();return}
  const fc=e.target.closest('[data-anf-c]');if(fc&&A.sel){const f=findN(A.sel);if(f)mutate(()=>{f.n.c=fc.dataset.anfC});A.col=fc.dataset.anfC;keepStyle();return}
  const x=e.target.closest('[data-annx]');if(x&&A.sel){const f=findN(A.sel);if(!f)return;
    if(x.dataset.annx==='del'){delSel()}else if(x.dataset.annx==='dup'){const c2=JSON.parse(JSON.stringify(f.n));c2.id=uid();const d=base(f.pl)*2;c2.x+=d;c2.y+=d;if(c2.x2!=null){c2.x2+=d;c2.y2+=d}mutate(()=>{f.pl.notes.push(c2)});A.sel=c2.id;render()}
    else{A.sel=null;render()}}
});
document.addEventListener('change',e=>{
  if(e.target.matches('[data-anns]')){A.sz=e.target.value;keepStyle();return}
  const k=e.target.dataset?.anf;if(!k||!A.sel)return;const f=findN(A.sel);if(f)mutate(()=>{f.n[k]=e.target.value})});
function delSel(){const f=findN(A.sel);if(!f)return;A.sel=null;mutate(()=>{f.pl.notes=f.pl.notes.filter(x=>x!==f.n)});toast(`Nota eliminata · ${window.NDC_keys?.MAC?'⌘Z':'Ctrl+Z'} per annullare`)}

/* ---------------- interazione sulla pianta ---------------- */
$('#pv').addEventListener('pointerdown',e=>{
  if(e.button>0||!$('#pw')||S.calib||S.placing||S.tool)return;const pl=PL();if(!pl)return;
  const p0=toImg(e.clientX,e.clientY);const k=pz(pl).k;
  if(A.tool){if(e.target.closest('.suggerimento'))return;e.preventDefault();e.stopImmediatePropagation();if(p0.x<0||p0.y<0||p0.x>pl.w||p0.y>pl.h)return;
    if(A.tool==='text'){const t=prompt(T('Testo della nota:'),'');if(t&&t.trim()){const n={id:uid(),t:'text',x:Math.round(p0.x),y:Math.round(p0.y),text:t.trim(),c:A.col,s:A.sz};mutate(()=>notes(pl).push(n))}return}
    A.draft=A.tool==='arrow'?{id:'d',t:'arrow',x:p0.x,y:p0.y,x2:p0.x,y2:p0.y,c:A.col,s:A.sz}:{id:'d',t:'area',x:p0.x,y:p0.y,w:0,h:0,c:A.col,s:A.sz};
    const mv=ev=>{const p=toImg(ev.clientX,ev.clientY);const x=clamp(p.x,0,pl.w),y=clamp(p.y,0,pl.h);if(A.draft.t==='arrow'){A.draft.x2=x;A.draft.y2=y}else{A.draft.w=x-A.draft.x;A.draft.h=y-A.draft.y}paintNotes()};
    window.addEventListener('pointermove',mv);
    window.addEventListener('pointerup',()=>{window.removeEventListener('pointermove',mv);const d=A.draft;A.draft=null;
      const big=d.t==='arrow'?Math.hypot(d.x2-d.x,d.y2-d.y)>base(pl):Math.abs(d.w)>base(pl)&&Math.abs(d.h)>base(pl);if(!big){paintNotes();return}
      let text='';if(d.t==='area'){text=(prompt(T('Testo dell\'area (facoltativo):'),'')||'').trim()}
      const n=d.t==='arrow'?{id:uid(),t:'arrow',x:Math.round(d.x),y:Math.round(d.y),x2:Math.round(d.x2),y2:Math.round(d.y2),c:d.c,s:d.s,text:''}:{id:uid(),t:'area',x:Math.round(Math.min(d.x,d.x+d.w)),y:Math.round(Math.min(d.y,d.y+d.h)),w:Math.round(Math.abs(d.w)),h:Math.round(Math.abs(d.h)),c:d.c,s:d.s,text};
      mutate(()=>notes(pl).push(n));A.sel=d.t==='arrow'?n.id:A.sel;render()},{once:true});return}
  const g=e.target.closest('[data-ann]');
  if(!g){if(A.sel){A.sel=null;setTimeout(render,0)}return}
  e.preventDefault();e.stopImmediatePropagation();const f=findN(g.dataset.ann);if(!f)return;const n=f.n;const h=e.target.closest('[data-annh]')?.dataset.annh;
  const st=JSON.parse(JSON.stringify(n));let moved=false;S.mk=null;
  const mv=ev=>{const dx=(ev.clientX-e.clientX)/k,dy=(ev.clientY-e.clientY)/k;if(!moved&&Math.hypot(ev.clientX-e.clientX,ev.clientY-e.clientY)<4)return;moved=true;
    if(h==='p1'){n.x=clamp(st.x+dx,0,pl.w);n.y=clamp(st.y+dy,0,pl.h)}else if(h==='p2'){n.x2=clamp(st.x2+dx,0,pl.w);n.y2=clamp(st.y2+dy,0,pl.h)}
    else if(h==='br'){n.w=Math.max(4,st.w+dx);n.h=Math.max(4,st.h+dy)}
    else{n.x=st.x+dx;n.y=st.y+dy;if(st.x2!=null){n.x2=st.x2+dx;n.y2=st.y2+dy}}paintNotes()};
  window.addEventListener('pointermove',mv);
  window.addEventListener('pointerup',()=>{window.removeEventListener('pointermove',mv);
    if(!moved){A.sel=n.id;render();return}const fin=JSON.parse(JSON.stringify(n));Object.assign(n,st);
    mutate(()=>{Object.assign(n,{...fin,x:Math.round(fin.x),y:Math.round(fin.y)});if(fin.x2!=null){n.x2=Math.round(fin.x2);n.y2=Math.round(fin.y2)}if(fin.w!=null){n.w=Math.round(fin.w);n.h=Math.round(fin.h)}});A.sel=n.id;render()},{once:true});
},true);
window.addEventListener('keydown',e=>{if(S.view!=='plan')return;const a=document.activeElement;if(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName))return;if($('#modal')?.classList.contains('open'))return;
  if(e.key==='Escape'&&(A.tool||A.sel)){e.stopImmediatePropagation();A.tool=null;A.draft=null;A.sel=null;render();return}
  if((e.key==='Delete'||e.key==='Backspace')&&A.sel){e.preventDefault();e.stopImmediatePropagation();delSel();return}
  if(A.sel&&e.key.startsWith('Arrow')){const f=findN(A.sel);if(!f)return;e.preventDefault();e.stopImmediatePropagation();const s=e.shiftKey?10:1;const dx=e.key==='ArrowLeft'?-s:e.key==='ArrowRight'?s:0,dy=e.key==='ArrowUp'?-s:e.key==='ArrowDown'?s:0;
    mutate(()=>{f.n.x+=dx;f.n.y+=dy;if(f.n.x2!=null){f.n.x2+=dx;f.n.y2+=dy}})}
},true);
/* cambiando planimetria o vista si chiude lo strumento */
const _rl=renderLeft;renderLeft=function(){if(S.view!=='plan'){A.tool=null;A.sel=null}return _rl.apply(this,arguments)};

/* ---------------- PNG, stampa e relazione ---------------- */
const _pc=planCanvas;planCanvas=async function(pl,maxDim){const c=await _pc.apply(this,arguments);try{drawCanvas(c,pl)}catch(_){}return c};
function drawCanvas(c,pl){const ns=pl.notes||[];if(!ns.length)return;const ctx=c.getContext('2d');const s=c.width/pl.w;ctx.save();ctx.setTransform(s,0,0,s,0,0);ctx.setLineDash([]);
  ns.forEach(n=>{const col=COL[n.c]||COL.rosso;const fs=base(pl)*(SIZE[n.s]||1);const sw=Math.max(2,fs/6);
    const text=(t,x,y,size,align='left')=>{if(!t)return;ctx.font=`600 ${size}px "Source Sans 3",sans-serif`;ctx.textAlign=align;ctx.lineJoin='round';ctx.lineWidth=size/4;ctx.strokeStyle='rgba(255,255,255,.92)';ctx.strokeText(t,x,y);ctx.fillStyle=col;ctx.fillText(t,x,y)};
    if(n.t==='text')text(n.text,n.x,n.y,fs*1.15);
    else if(n.t==='arrow'){ctx.strokeStyle=col;ctx.fillStyle=col;ctx.lineWidth=sw;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(n.x,n.y);ctx.lineTo(n.x2,n.y2);ctx.stroke();
      const a=Math.atan2(n.y2-n.y,n.x2-n.x),L=fs*.9;ctx.beginPath();ctx.moveTo(n.x2,n.y2);ctx.lineTo(n.x2-L*Math.cos(a-.4),n.y2-L*Math.sin(a-.4));ctx.lineTo(n.x2-L*Math.cos(a+.4),n.y2-L*Math.sin(a+.4));ctx.closePath();ctx.fill();
      text(n.text,n.x,n.y-fs*.4,fs,n.x2<n.x?'left':'right')}
    else if(n.t==='area'){ctx.fillStyle=col;ctx.globalAlpha=.14;ctx.fillRect(n.x,n.y,n.w,n.h);ctx.globalAlpha=1;ctx.strokeStyle=col;ctx.lineWidth=sw;ctx.setLineDash([sw*3,sw*2]);ctx.strokeRect(n.x,n.y,n.w,n.h);ctx.setLineDash([]);text(n.text,n.x+fs*.3,n.y+fs*1.1,fs)}});
  ctx.restore()}
/* elenco delle note nella stampa della planimetria */
const _pp=printPlan;printPlan=async function(){const r=await _pp.apply(this,arguments);const pl=PL();const ns=(pl?.notes||[]).filter(n=>n.text);
  if(ns.length&&$('#print img.pianta'))$('#print').insertAdjacentHTML('beforeend',`<h2>Note (${ns.length})</h2><table><tr><th>Tipo</th><th>Testo</th></tr>${ns.map(n=>`<tr><td>${{text:'Testo',arrow:'Freccia',area:'Area'}[n.t]}</td><td>${esc(n.text)}</td></tr>`).join('')}</table>`);return r};
})();
