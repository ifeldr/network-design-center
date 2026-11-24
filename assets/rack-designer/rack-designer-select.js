/* =====================================================================
   Network Design Center — selezione multipla e scorciatoie da tastiera
   Armadio: elementi dell'armadio · Planimetria: armadi e apparati in pianta · Elenco armadi.
   Windows e Linux usano Ctrl, macOS usa ⌘ (Cmd). Ctrl+clic su Mac apre il menu contestuale,
   quindi lì la selezione aggiuntiva si fa con ⌘+clic.
   ===================================================================== */
(function(){
'use strict';
const MAC=/Mac|iPhone|iPad|iPod/i.test(navigator.userAgentData?.platform||navigator.platform||navigator.userAgent);
const mod=e=>MAC?e.metaKey:e.ctrlKey;
const K=MAC?{mod:'⌘',shift:'⇧',del:'⌫',alt:'⌥',sep:''}:{mod:'Ctrl',shift:'Maiusc',del:'Canc',alt:'Alt',sep:'+'};
const kb=(...k)=>k.map(x=>`<kbd>${x}</kbd>`).join(K.sep?'<span class="kb-s">+</span>':'');
window.NDC_keys={MAC,K,kb};
const typing=()=>{const a=document.activeElement;return a&&(/INPUT|TEXTAREA|SELECT/.test(a.tagName)||a.isContentEditable)};
const modalOpen=()=>$('#modal')?.classList.contains('open')||!$('#campo')?.hidden&&!!$('#campo')||!!$('#srch:not([hidden])');

/* ---------------- stato della selezione ---------------- */
const SEL={items:new Set(),mks:new Set(),racks:new Set(),anchor:null,rackOf:null};
const itemsSel=()=>{const r=R();if(SEL.rackOf!==r?.id){SEL.items.clear();SEL.rackOf=r?.id}const s=new Set([...SEL.items].filter(id=>r.items.some(i=>i.id===id)));if(S.item&&r.items.some(i=>i.id===S.item))s.add(S.item);return s};
const mksSel=()=>{const s=new Set([...SEL.mks].filter(k=>mkObj(k)&&onPlan(k)));if(S.mk&&mkObj(S.mk))s.add(S.mk);return s};
const onPlan=k=>{const o=mkObj(k);const pl=PL();if(!o||!pl)return false;return k.startsWith('rk:')?o.loc?.plan===pl.id:o.plan===pl.id};
const racksSel=()=>new Set([...SEL.racks].filter(id=>rackById(id)));
function clearSel(){SEL.items.clear();SEL.mks.clear();SEL.racks.clear();SEL.anchor=null}
function count(){return S.view==='rack'?Math.max(itemsSel().size,racksSel().size>1?racksSel().size:0):S.view==='plan'?mksSel().size:0}

/* ---------------- clic con Ctrl/⌘ e Maiusc ---------------- */
function toggleItem(id,range){
  const r=R();const cur=itemsSel();
  if(range&&(SEL.anchor||S.item)){const a=r.items.find(i=>i.id===(SEL.anchor||S.item));const b=r.items.find(i=>i.id===id);if(a&&b){const lo=Math.min(a.pos,b.pos),hi=Math.max(a.pos+a.h-1,b.pos+b.h-1);
      r.items.forEach(i=>{if(i.pos+i.h-1>=lo&&i.pos<=hi)cur.add(i.id)})}}
  else{if(cur.has(id)&&cur.size>1){cur.delete(id);if(S.item===id)S.item=[...cur][0]}else{cur.add(id);SEL.anchor=id}}
  SEL.items=cur;SEL.rackOf=r.id;if(!S.item||!cur.has(S.item))S.item=[...cur].pop()||null;S.port=null;S.right='props';render();
}
function toggleMk(k){const cur=mksSel();if(cur.has(k)){cur.delete(k);if(S.mk===k)S.mk=[...cur].pop()||null}else{cur.add(k);S.mk=k}SEL.mks=cur;S.right='props';render()}
function toggleRack(id,range){
  const cur=racksSel();if(!cur.size&&S.rack)cur.add(S.rack);
  if(range){const ids=[...$$('#leftBody [data-rack]')].map(e=>e.dataset.rack);const a=ids.indexOf(SEL.anchor||S.rack),b=ids.indexOf(id);if(a>=0&&b>=0)ids.slice(Math.min(a,b),Math.max(a,b)+1).forEach(x=>cur.add(x))}
  else{if(cur.has(id)&&cur.size>1)cur.delete(id);else{cur.add(id);SEL.anchor=id}}
  SEL.racks=cur;if(!cur.has(S.rack))S.rack=[...cur][0];S.item=null;SEL.items.clear();render();
}
/* fase di cattura: i clic con i tasti modificatori non avviano il trascinamento */
$('#stage').addEventListener('pointerdown',e=>{
  if(S.view!=='rack'||e.button>0)return;const el=e.target.closest('.it[data-id]');
  if((mod(e)||e.shiftKey)&&(el||e.target.closest('#bay'))){e.preventDefault();e.stopImmediatePropagation();const id=el?.dataset.id,rg=e.shiftKey&&!mod(e);marquee(e,'rack',id?()=>toggleItem(id,rg):null);return}
  SEL.items.clear();SEL.racks.clear();
},true);
$('#pv').addEventListener('pointerdown',e=>{
  if(e.button>0||!$('#pw')||S.calib||S.placing||S.tool)return;const mk=e.target.closest('.mk[data-mk]');
  if(mod(e)||e.shiftKey){e.preventDefault();e.stopImmediatePropagation();const k=mk?.dataset.mk;marquee(e,'plan',k?()=>toggleMk(k):null);return}
  if(mk&&mksSel().size>1&&mksSel().has(mk.dataset.mk)){e.preventDefault();e.stopImmediatePropagation();groupDrag(e,mk.dataset.mk);return}
  SEL.mks.clear();
},true);
$('#leftBody').addEventListener('click',e=>{
  const ri=e.target.closest('[data-rack]');if(!ri||S.view!=='rack')return;
  if(mod(e)||e.shiftKey){e.preventDefault();e.stopImmediatePropagation();toggleRack(ri.dataset.rack,e.shiftKey&&!mod(e));return}
  SEL.racks.clear();SEL.anchor=ri.dataset.rack;
},true);

/* ---------------- rettangolo di selezione ---------------- */
function marquee(e,where,onClick){
  const x0=e.clientX,y0=e.clientY;const box=document.createElement('div');box.className='marquee';let moved=false;
  const base=where==='rack'?itemsSel():mksSel();let hit=new Set();
  const els=where==='rack'?$$('#bay .it[data-id]'):$$('#pw .mk[data-mk]');
  const mv=ev=>{if(!moved){if(Math.hypot(ev.clientX-x0,ev.clientY-y0)<5)return;moved=true;document.body.appendChild(box)}const l=Math.min(x0,ev.clientX),t=Math.min(y0,ev.clientY),w=Math.abs(ev.clientX-x0),h=Math.abs(ev.clientY-y0);Object.assign(box.style,{left:l+'px',top:t+'px',width:w+'px',height:h+'px'});
    hit=new Set();els.forEach(el=>{const b=(where==='plan'?el.querySelector('.sym')||el:el).getBoundingClientRect();const on=b.right>=l&&b.left<=l+w&&b.bottom>=t&&b.top<=t+h;el.classList.toggle('msel',on||base.has(el.dataset.id||el.dataset.mk));if(on)hit.add(el.dataset.id||el.dataset.mk)})};
  window.addEventListener('pointermove',mv);
  window.addEventListener('pointerup',()=>{window.removeEventListener('pointermove',mv);box.remove();
    if(!moved){if(onClick)onClick();return}
    const all=new Set([...base,...hit]);
    if(where==='rack'){SEL.items=all;SEL.rackOf=R().id;S.item=[...all].pop()||null;S.port=null}else{SEL.mks=all;S.mk=[...all].pop()||null}
    S.right='props';render()},{once:true});
}
/* ---------------- spostamento di gruppo in pianta ---------------- */
function groupDrag(e,key){
  const pl=PL();const k=pz(pl).k;const keys=[...mksSel()];const x0=e.clientX,y0=e.clientY;let moved=false;
  const start=keys.map(q=>{const o=mkObj(q);const isR=q.startsWith('rk:');return {q,o,isR,x:isR?o.loc.x:o.x,y:isR?o.loc.y:o.y,el:$(`.mk[data-mk="${q}"]`)}});
  const mv=ev=>{if(!moved&&Math.hypot(ev.clientX-x0,ev.clientY-y0)<4)return;moved=true;const dx=(ev.clientX-x0)/k,dy=(ev.clientY-y0)/k;
    start.forEach(s=>{if(s.el){s.el.style.left=clamp(s.x+dx,0,pl.w)+'px';s.el.style.top=clamp(s.y+dy,0,pl.h)+'px'}})};
  window.addEventListener('pointermove',mv);
  window.addEventListener('pointerup',ev=>{window.removeEventListener('pointermove',mv);
    if(!moved){SEL.mks.clear();S.mk=key;S.right='props';render();return}
    const dx=(ev.clientX-x0)/k,dy=(ev.clientY-y0)/k;
    mutate(()=>start.forEach(s=>{const nx=Math.round(clamp(s.x+dx,0,pl.w)),ny=Math.round(clamp(s.y+dy,0,pl.h));if(s.isR){s.o.loc.x=nx;s.o.loc.y=ny}else{s.o.x=nx;s.o.y=ny}}))},{once:true});
}

/* ---------------- azioni sulla selezione ---------------- */
const undoHint=()=>MAC?'⌘Z':'Ctrl+Z';
function delItems(){const r=R();const ids=itemsSel();if(!ids.size)return;const n=ids.size;
  mutate(()=>{r.items=r.items.filter(i=>!ids.has(i.id));Object.keys(r.perm||{}).forEach(k=>{const [pid]=k.split(':');const p=r.perm[k];if(ids.has(pid)||ids.has(p?.it))delete r.perm[k]});
    P.devices.forEach(d=>{if(d.rack===r.id&&ids.has(d.item)){d.item=null;d.port=null}});S.item=null;S.port=null});
  clearSel();toast(`${n===1?'1 elemento eliminato':n+' elementi eliminati'} · ${undoHint()} per annullare`)}
function delMks(){const ks=mksSel();if(!ks.size)return;const n=ks.size;
  mutate(()=>{ks.forEach(k=>{if(k.startsWith('rk:')){const r=rackById(k.slice(3));if(r)r.loc=null}});P.devices=P.devices.filter(d=>!ks.has('mk:'+d.id));S.mk=null});
  clearSel();toast(`${n===1?'1 elemento tolto dalla pianta':n+' elementi tolti dalla pianta'} · ${undoHint()} per annullare`)}
function delRacks(){const ids=racksSel();if(ids.size<2)return false;
  if(ids.size>=P.racks.length){toast('Il progetto deve contenere almeno un armadio');return true}
  if(!confirm(`Eliminare ${ids.size} armadi (${[...ids].map(id=>rid(rackById(id))).join(', ')})?`))return true;
  mutate(()=>{P.racks=P.racks.filter(r=>!ids.has(r.id));P.racks.forEach(x=>x.items.forEach(i=>Object.keys(i.ports).forEach(k=>{if(ids.has(i.ports[k].r))delete i.ports[k]})));
    P.devices.forEach(d=>{if(ids.has(d.rack)){d.rack=null;d.item=null;d.port=null}});S.rack=P.racks[0].id;S.item=null});
  clearSel();toast(`Armadi eliminati · ${undoHint()} per annullare`);return true}
function selectAll(){
  if(S.view==='rack'){const r=R();SEL.items=new Set(r.items.map(i=>i.id));SEL.rackOf=r.id;S.item=r.items.length?[...r.items].sort((a,b)=>b.pos-a.pos)[0].id:null;S.port=null}
  else if(S.view==='plan'){const pl=PL();if(!pl)return;const ks=[...P.devices.filter(d=>d.plan===pl.id).map(d=>'mk:'+d.id),...P.racks.filter(r=>r.loc?.plan===pl.id).map(r=>'rk:'+r.id)];SEL.mks=new Set(ks);S.mk=ks[0]||null}
  S.right='props';render();const n=count();if(n)toast(`${n} elementi selezionati`);
}
function moveItems(dir){const r=R();const ids=itemsSel();const its=r.items.filter(i=>ids.has(i.id));if(!its.length)return;
  const others=r.items.filter(i=>!ids.has(i.id));const ok=its.every(i=>{const p=i.pos+dir;if(p<1||p+i.h-1>r.units)return false;return !others.some(o=>o.pos<=p+i.h-1&&o.pos+o.h-1>=p)});
  if(!ok){toast('Nessuno spazio libero in quella direzione');return}mutate(()=>its.forEach(i=>i.pos+=dir))}
function nudge(dx,dy){const pl=PL();const ks=mksSel();if(!ks.size||!pl)return;mutate(()=>ks.forEach(k=>{const o=mkObj(k);if(k.startsWith('rk:')){o.loc.x=clamp(o.loc.x+dx,0,pl.w);o.loc.y=clamp(o.loc.y+dy,0,pl.h)}else{o.x=clamp(o.x+dx,0,pl.w);o.y=clamp(o.y+dy,0,pl.h)}}))}
function dupSel(){
  if(S.view==='rack'){const r=R();const ids=itemsSel();if(ids.size<2)return false;let n=0,miss=0;const nw=[];
    mutate(()=>{r.items.filter(i=>ids.has(i.id)).sort((a,b)=>b.pos-a.pos).forEach(i=>{const p=freeSlot(r,i.h,true);if(!p){miss++;return}const c=JSON.parse(JSON.stringify(i));c.id=uid();c.pos=p;c.ports={};c.photos=[];r.items.push(c);nw.push(c.id);n++})});
    SEL.items=new Set(nw);S.item=nw[0]||null;render();toast(`${n} elementi duplicati${miss?`, ${miss} senza spazio libero`:''}`);return true}
  if(S.view==='plan'){const ks=[...mksSel()].filter(k=>k.startsWith('mk:'));if(!ks.length)return false;const nw=[];
    mutate(()=>ks.forEach(k=>{const d=mkObj(k);const c=JSON.parse(JSON.stringify(d));c.id=uid();c.x+=24;c.y+=24;c.item=null;c.port=null;c.photos=[];delete c.route;P.devices.push(c);nw.push('mk:'+c.id)}));
    SEL.mks=new Set(nw);S.mk=nw[0];render();toast(`${nw.length} apparati duplicati (da ricollegare alle prese)`);return true}
  return false;
}

/* ---------------- tastiera ---------------- */
window.addEventListener('keydown',e=>{
  if(typing()||modalOpen())return;
  const k=e.key,lk=k.length===1?k.toLowerCase():k;
  if(mod(e)&&!e.altKey&&lk==='a'&&(S.view==='rack'||S.view==='plan')){e.preventDefault();e.stopImmediatePropagation();selectAll();return}
  if(k==='Escape'&&(count()>1||racksSel().size>1)){clearSel();/* Esc prosegue: il gestore principale deseleziona */return}
  const del=k==='Delete'||k==='Backspace';
  if(del){
    if(S.view==='rack'&&racksSel().size>1&&!itemsSel().size){e.preventDefault();e.stopImmediatePropagation();delRacks();return}
    if(S.view==='rack'&&itemsSel().size>1){e.preventDefault();e.stopImmediatePropagation();delItems();return}
    if(S.view==='plan'&&mksSel().size>1){e.preventDefault();e.stopImmediatePropagation();delMks();return}
    return}
  if(mod(e)&&lk==='d'&&count()>1){e.preventDefault();e.stopImmediatePropagation();dupSel();return}
  if(S.view==='rack'&&itemsSel().size>1&&(k==='ArrowUp'||k==='ArrowDown')){e.preventDefault();e.stopImmediatePropagation();moveItems(k==='ArrowUp'?1:-1);return}
  if(S.view==='plan'&&mksSel().size&&k.startsWith('Arrow')){e.preventDefault();e.stopImmediatePropagation();const s=e.shiftKey?10:1;nudge(k==='ArrowLeft'?-s:k==='ArrowRight'?s:0,k==='ArrowUp'?-s:k==='ArrowDown'?s:0);return}
},true);
/* su macOS anche ⌘+Z / ⌘+⇧+Z (già gestiti) e ⌘+⌫ per eliminare, come nel Finder */

/* ---------------- aspetto: evidenzia la selezione e pannello di riepilogo ---------------- */
const _render=render;render=function(){const x=_render.apply(this,arguments);try{paintSel()}catch(_){}return x};
function paintSel(){
  if(S.view==='rack'){const s=itemsSel();$$('#bay .it[data-id]').forEach(el=>el.classList.toggle('msel',s.size>1&&s.has(el.dataset.id)));
    const rs=racksSel();$$('#leftBody [data-rack]').forEach(el=>el.classList.toggle('msel',rs.size>1&&rs.has(el.dataset.rack)))}
  if(S.view==='plan'){const s=mksSel();$$('#pw .mk[data-mk]').forEach(el=>el.classList.toggle('msel',s.size>1&&s.has(el.dataset.mk)))}
  const n=S.view==='rack'?itemsSel().size:S.view==='plan'?mksSel().size:0;const rb=$('#rightBody');
  if(rb&&n>1)rb.innerHTML=multiHtml(n);
  else if(rb&&S.view==='rack'&&racksSel().size>1&&!S.item)rb.innerHTML=multiRacksHtml();
}
function multiHtml(n){
  let list='';
  if(S.view==='rack'){const r=R();list=r.items.filter(i=>itemsSel().has(i.id)).sort((a,b)=>b.pos-a.pos).map(i=>`<div class="kv"><span>U${i.pos}${i.h>1?'–U'+(i.pos+i.h-1):''}</span><b>${esc(nm(i))}</b></div>`).join('')}
  else{list=[...mksSel()].map(k=>{const o=mkObj(k);const isR=k.startsWith('rk:');return `<div class="kv"><span>${isR?'Armadio':esc(DEV[o.kind].short)}</span><b>${esc(isR?rid(o):(devLabel(o)||o.name||'—'))}</b></div>`}).join('')}
  return `<div class="sez"><h3>Selezione multipla <span>${n}</span></h3><div class="idbox"><div class="titolo">${n} elementi selezionati</div><div class="syn">${S.view==='rack'?'nell\'armadio '+esc(rid(R())):'nella planimetria '+esc(PL()?.name||'')}</div></div>
    <div class="btnrow" style="margin:10px 0"><button class="btn piccolo rosso" data-sx="del">${S.view==='rack'?'Elimina':'Togli dalla pianta'} (${n})</button><button class="btn piccolo" data-sx="dup">Duplica</button><button class="btn piccolo" data-sx="none">Deseleziona</button></div>
    <div class="mlist">${list}</div></div>${keysHtml()}`;
}
function multiRacksHtml(){const ids=[...racksSel()];return `<div class="sez"><h3>Armadi selezionati <span>${ids.length}</span></h3>${ids.map(id=>`<div class="kv"><span>${TYPES[rackById(id).type].it}</span><b>${esc(rid(rackById(id)))}</b></div>`).join('')}
  <div class="btnrow" style="margin-top:10px"><button class="btn piccolo rosso" data-sx="delR">Elimina armadi (${ids.length})</button><button class="btn piccolo" data-sx="none">Deseleziona</button></div></div>${keysHtml()}`}
function keysHtml(){
  const rows=S.view==='plan'?[[kb(K.mod)+' + clic','aggiunge o toglie un elemento'],[kb(K.shift)+' + clic','aggiunge o toglie un elemento'],[kb(K.shift)+' + trascina','seleziona con un rettangolo'],[kb(K.mod,'A'),'seleziona tutto nella pianta'],[kb(K.del)+(MAC?'':' / '+kb('Backspace')),'toglie dalla pianta'],[kb('←')+kb('→')+kb('↑')+kb('↓'),'sposta di 1 px ('+kb(K.shift)+': 10 px)'],[kb(K.mod,'D'),'duplica'],[kb('Esc'),'deseleziona']]
    :[[kb(K.mod)+' + clic','aggiunge o toglie un elemento'],[kb(K.shift)+' + clic','seleziona un intervallo di unità'],[kb(K.shift)+' + trascina','seleziona con un rettangolo'],[kb(K.mod,'A'),'seleziona tutto l\'armadio'],[kb(K.del)+(MAC?'':' / '+kb('Backspace')),'elimina'],[kb('↑')+kb('↓'),'sposta di 1 U'],[kb(K.mod,'D'),'duplica'],[kb('Esc'),'deseleziona']];
  return `<div class="sez"><h3>Tastiera</h3><table class="ktab">${rows.map(([a,b])=>`<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table></div>`;
}
$('#rightBody').addEventListener('click',e=>{const b=e.target.closest('[data-sx]');if(!b)return;const a=b.dataset.sx;
  if(a==='del'){S.view==='rack'?delItems():delMks()}else if(a==='delR')delRacks();else if(a==='dup')dupSel();else if(a==='none'){clearSel();S.item=null;S.mk=null;render()}});

/* ---------------- guida: scorciatoie della piattaforma ---------------- */
if(typeof openHelp==='function'){const _h=openHelp;openHelp=function(){_h.apply(this,arguments);const b=$('#mBody');if(!b)return;
  const rows=[[kb(K.mod,'Z'),'annulla'],[MAC?kb(K.mod,K.shift,'Z'):kb(K.mod,'Y')+' / '+kb(K.mod,K.shift,'Z'),'ripeti'],[kb(K.mod,'K')+' / '+kb('/'),'cerca'],[kb(K.mod)+' + clic',' selezione multipla'],[kb(K.shift)+' + clic','intervallo (armadio) o aggiunta (pianta)'],[kb(K.shift)+' + trascina','selezione con rettangolo'],[kb(K.mod,'A'),'seleziona tutto'],[kb(K.del)+(MAC?' / '+kb(K.mod,K.del):' / '+kb('Backspace')),'elimina la selezione'],[kb(K.mod,'D'),'duplica'],[kb('↑')+kb('↓'),'sposta nell\'armadio (1 U) o in pianta (1 px, '+kb(K.shift)+' 10 px)'],[kb('Esc'),'deseleziona, annulla calibrazione o posizionamento']];
  b.insertAdjacentHTML('beforeend',`<h3>Scorciatoie da tastiera (${MAC?'macOS':'Windows e Linux'})</h3><table class="ktab">${rows.map(([a,c])=>`<tr><td>${a}</td><td>${c}</td></tr>`).join('')}</table>`)}}

window.NDC_select={SEL,itemsSel,mksSel,racksSel,selectAll,delItems,delMks,delRacks,clearSel,toggleItem,toggleMk,toggleRack,dupSel};
})();
