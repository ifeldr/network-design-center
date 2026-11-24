/* =====================================================================
   Network Design Center — scadenze, schede dei locali, PoE per classe
   ===================================================================== */
(function(){
'use strict';
const T=s=>(window.NDC_tr||(x=>x))(s);
const X=()=>window.NDC;
const loc=()=>window.NDC_lang==='en'?'en-GB':'it-IT';
const fdate=iso=>{if(!iso)return '';const d=new Date(iso+'T00:00:00');return isNaN(d)?iso:d.toLocaleDateString(loc(),{day:'2-digit',month:'2-digit',year:'numeric'})};
const daysTo=iso=>Math.round((new Date(iso+'T00:00:00')-new Date(new Date().toDateString()))/864e5);
const num=(v,d=0)=>{const n=parseFloat(String(v??'').replace(',','.'));return Number.isFinite(n)?n:d};
const iname=it=>{const m=it.props?.model&&MODELS[it.props.model];return m?mName(m):nm(it)};
const dname=d=>{const m=d.model&&MODELS[d.model];return d.name||(m?mName(m):DEV[d.kind].short)};

/* =====================================================================
   1) Scadenze
   ===================================================================== */
const DL=[['warranty','Fine garanzia'],['eos','Fine supporto'],['battery','Sostituzione batterie'],['license','Rinnovo licenza'],['maint','Manutenzione programmata']];
const DLK=Object.fromEntries(DL);
const NODL=['blank','cm','shelf','patch','fo','unel'];
const dlFor=kind=>DL.filter(([k])=>k!=='battery'||kind==='ups').filter(([k])=>k!=='license'||['fw','sw','router','srv','ap','cam','altro'].includes(kind));
const dlSec=(attr,o,kind)=>`<div class="sez"><h3>Scadenze</h3>${dlFor(kind).map(([k,l])=>{const v=o[k]||'';const d=v?daysTo(v):null;
  return `<div class="f"><label>${l}</label><div class="um"><input type="date" ${attr}="${k}" value="${esc(v)}">${d!=null?`<span class="dl-b ${d<0?'err':d<=30?'warn':d<=90?'soon':''}">${d<0?T('scaduta'):d===0?T('oggi'):`${d} gg`}</span>`:''}</div></div>`}).join('')}</div>`;
const _ih=itemHtml;itemHtml=function(r,it){const h=_ih.apply(this,arguments);if(NODL.includes(it.kind))return h;return h+dlSec('data-iv',it.props,it.kind)+poeSwSec(it)};
const _dh=devHtml;devHtml=function(d,pl){const h=_dh.apply(this,arguments);if(d.kind==='to')return h;return h+poeDevSec(d)+dlSec('data-dy',d,d.kind)};
function deadlines(all){
  const out=[];const add=(p,pid,o,name,where,kind,ref)=>{dlFor(kind).forEach(([k,l])=>{const v=o[k];if(!v)return;out.push({date:v,days:daysTo(v),type:l,k,name,where,project:p.name,pid,ref})})};
  const projs=all?projIndex().map(x=>x.id===P.pid?P:projGet(x.id)).filter(Boolean):[P];
  projs.forEach(p=>{const pid=p.pid||P.pid;(p.racks||[]).forEach(r=>{r.items.forEach(it=>{if(NODL.includes(it.kind))return;add(p,pid,it.props,iname(it),`${p===P?rid(r):(r.name||'')} · U${it.pos}`,it.kind,{t:'i',r:r.id,i:it.id})})});
    (p.devices||[]).forEach(d=>{if(d.kind==='to')return;const pl=(p.plans||[]).find(x=>x.id===d.plan);add(p,pid,d,dname(d),pl?pl.name:'',d.kind,{t:'d',d:d.id})})});
  return out.sort((a,b)=>a.date.localeCompare(b.date));
}
let DLF={scope:'proj',win:'90'};
function openDeadlines(){
  const all=deadlines(DLF.scope==='all');const lim=DLF.win==='all'?Infinity:+DLF.win;const l=all.filter(x=>x.days<=lim);
  const bad=all.filter(x=>x.days<0).length,soon=all.filter(x=>x.days>=0&&x.days<=30).length;
  modal('Scadenze',`<div class="btnrow" style="align-items:center;margin-bottom:10px">
    <select data-dlf="scope"><option value="proj" ${DLF.scope==='proj'?'selected':''}>Questo progetto</option><option value="all" ${DLF.scope==='all'?'selected':''}>Tutti i progetti</option></select>
    <select data-dlf="win"><option value="0" ${DLF.win==='0'?'selected':''}>Solo scadute</option><option value="30" ${DLF.win==='30'?'selected':''}>Entro 30 giorni</option><option value="90" ${DLF.win==='90'?'selected':''}>Entro 90 giorni</option><option value="365" ${DLF.win==='365'?'selected':''}>Entro un anno</option><option value="all" ${DLF.win==='all'?'selected':''}>Tutte</option></select>
    <span style="flex:1"></span><button class="btn" data-dlx="ics">Calendario (.ics)</button><button class="btn" data-dlx="csv">Scarica CSV</button></div>
    <div class="kv"><span>${all.length} scadenze registrate</span><b>${bad?`<span style="color:var(--err)">${bad} scadute</span>`:''}${bad&&soon?' · ':''}${soon?`<span style="color:var(--warn)">${soon} entro 30 giorni</span>`:''}${!bad&&!soon?'✓':''}</b></div>
    ${l.length?`<table class="vtab"><tr><th>Data</th><th></th><th>Scadenza</th><th>Apparato</th><th>Posizione</th>${DLF.scope==='all'?'<th>Progetto</th>':''}</tr>${l.map(x=>`<tr ${x.pid===P.pid?`class="dl-go" data-dlr='${esc(JSON.stringify(x.ref))}'`:''}><td><b>${fdate(x.date)}</b></td><td><span class="dl-b ${x.days<0?'err':x.days<=30?'warn':x.days<=90?'soon':''}">${x.days<0?T('scaduta'):x.days===0?T('oggi'):x.days+' gg'}</span></td><td>${esc(T(x.type))}</td><td>${esc(x.name)}</td><td><small>${esc(x.where)}</small></td>${DLF.scope==='all'?`<td><small>${esc(x.project)}</small></td>`:''}</tr>`).join('')}</table>`:'<p class="piccola">Nessuna scadenza in questo intervallo.</p>'}
    <p class="piccola">Le date si inseriscono nella sezione «Scadenze» delle proprietà di ogni apparato. Il file .ics si importa in Google Calendar, Outlook o Calendario di Apple, con un promemoria 30 giorni prima.</p>`);
}
function icsEsc(s){return String(s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n')}
function ics(l){const now=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+/,'');
  const ev=l.map(x=>{const d=x.date.replace(/-/g,'');const n=new Date(x.date+'T00:00:00');n.setDate(n.getDate()+1);const e=n.toISOString().slice(0,10).replace(/-/g,'');
    return ['BEGIN:VEVENT',`UID:ndc-${x.pid}-${x.k}-${(x.ref.i||x.ref.d)}@network-design-center`,`DTSTAMP:${now}`,`DTSTART;VALUE=DATE:${d}`,`DTEND;VALUE=DATE:${e}`,`SUMMARY:${icsEsc(T(x.type)+': '+x.name)}`,`DESCRIPTION:${icsEsc(x.where+' · '+x.project)}`,
      'BEGIN:VALARM','ACTION:DISPLAY','TRIGGER:-P30D',`DESCRIPTION:${icsEsc(T(x.type)+': '+x.name)}`,'END:VALARM','END:VEVENT'].join('\r\n')});
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Network Design Center//IT','CALSCALE:GREGORIAN',...ev,'END:VCALENDAR'].join('\r\n')+'\r\n'}
function dlNotice(){
  try{const last=+localStorage.getItem('ndc-scad-avviso')||0;if(Date.now()-last<864e5)return}catch(_){}
  const l=deadlines(false).filter(x=>x.days<=30);if(!l.length||$('#dlBanner'))return;const bad=l.filter(x=>x.days<0).length;
  const d=document.createElement('div');d.id='dlBanner';d.className='bk-banner dl-banner';
  d.innerHTML=`<span>${bad?`${bad} scadenze superate`:''}${bad&&l.length>bad?' e ':''}${l.length>bad?`${l.length-bad} entro 30 giorni`:''} in questo progetto.</span><button class="btn piccolo primario" data-dlx="open">Vedi</button><button class="btn piccolo" data-dlx="later">Più tardi</button>`;
  document.body.appendChild(d);
}

/* =====================================================================
   2) PoE per classe
   ===================================================================== */
const STD={af:{n:'802.3af (PoE)',w:15.4,pd:12.95,cls:3},at:{n:'802.3at (PoE+)',w:30,pd:25.5,cls:4},bt60:{n:'802.3bt tipo 3 (60 W)',w:60,pd:51,cls:6},bt90:{n:'802.3bt tipo 4 (90 W)',w:90,pd:71.3,cls:8}};
const CLSW=[0,3.84,6.49,12.95,25.5,40,51,62,71.3];
const clsOf=w=>{if(w<=0)return 0;for(let i=1;i<CLSW.length;i++)if(w<=CLSW[i])return i;return 8};
const stdFor=c=>c<=3?'af':c===4?'at':c<=6?'bt60':'bt90';
function poeEst(d){
  const m=d.model&&MODELS[d.model];const t=m?`${m.note||''} ${m.m}`:'';
  if(d.kind==='ap'){let w=/Wi-Fi 7/.test(t)?25:/6E/.test(t)?20:/Wi-Fi 6/.test(t)?13:/alta densità|SHD|XG|AC-HD/.test(t)?17:/Wi-Fi 5/.test(t)?9:/Wi-Fi 4/.test(t)?7:13;if(/esterno|Outdoor|Mesh/i.test(t))w+=2;if(/router/i.test(t))w=0;return w}
  if(d.kind==='cam'){if(/videocitofono|posto esterno/i.test(t))return 5;if(/PTZ|speed dome/i.test(t))return 25;if(/varifocal|8 MP|4K|ColorVu|fisheye|lunga portata/i.test(t))return 9;if(/Wi-Fi/i.test(t))return 0;if(/cloud/i.test(t))return 10;return 6}
  return null;
}
window.NDC_poeW=d=>{if(d.kind==='to')return null;const e=poeEst(d);return e==null?null:e};
function devPoe(d){const w=d.w!==undefined&&d.w!==''?num(d.w):(poeEst(d)||0);const c=d.pcls!==undefined&&d.pcls!==''?+d.pcls:clsOf(w);return {w,c,std:stdFor(c)}}
function swStd(it){if(it.props.poestd)return it.props.poestd;const m=it.props.model&&MODELS[it.props.model];const t=m?`${m.note||''} ${m.m}`:'';
  if(/PoE-bt|bt|PoE\+\+|UPOE|60W|90W|Hi-PoE/i.test(t))return 'bt60';if(it.kind==='poe')return 'at';return 'at'}
function poeDevSec(d){if(!['ap','cam','altro'].includes(d.kind))return '';const e=poeEst(d);const p=devPoe(d);
  return `<div class="sez"><h3>Alimentazione PoE</h3><div class="f"><label>Consumo</label><div class="um"><input type="number" min="0" step="0.5" data-dy="w" value="${esc(d.w??'')}" placeholder="${e??0}"><span>W</span></div></div>
    <div class="f"><label>Classe PoE</label><select data-dy="pcls"><option value="">automatica (${clsOf(e||0)})</option>${[0,1,2,3,4,5,6,7,8].map(c=>`<option value="${c}" ${String(d.pcls??'')===String(c)?'selected':''}>${c} · ${STD[stdFor(c)].n}</option>`).join('')}</select></div>
    <p class="piccola">${p.w?`Richiede ${STD[p.std].n}, classe ${p.c}.`:'Non alimentato in PoE.'} Il segnaposto è il consumo tipico del modello: inserisci quello della scheda tecnica per calcoli precisi.</p></div>`}
function poeSwSec(it){if(!((it.kind==='sw'&&it.props.poe)||it.kind==='poe'))return '';const s=swStd(it);
  return `<div class="sez"><h3>Standard PoE</h3><div class="f"><label>Massimo per porta</label><select data-iv="poestd"><option value="">automatico (${STD[s].n})</option>${Object.entries(STD).map(([k,v])=>`<option value="${k}" ${it.props.poestd===k?'selected':''}>${v.n}</option>`).join('')}</select></div></div>`}
const _val=validate;validate=function(r){const I=_val.apply(this,arguments);try{
  X().perms(r).forEach(p=>{const d=devAtPort(r.id,p.panel.id,p.n);if(!d||!['ap','cam','altro'].includes(d.kind))return;const dp=devPoe(d);if(!dp.w)return;
    const sw=p.sw;if(!(sw.kind==='poe'||(sw.kind==='sw'&&sw.props.poe)))return;const st=STD[swStd(sw)];
    if(dp.c>st.cls)I.push({lvl:'err',ref:'PoE',msg:`${p.lab} (${dname(d)}): richiede la classe ${dp.c} (${STD[dp.std].n}, ${fmt(dp.w,1)} W) ma ${nm(sw)} porta ${X().swPortName(sw,p.swp)} fornisce al massimo ${st.n}.`,id:sw.id})})}catch(_){}return I};

/* =====================================================================
   3) Schede dei locali
   ===================================================================== */
function rooms(){
  const R0={};const add=(name)=>(R0[name]??={name,outlets:[],devices:[]});
  P.racks.forEach(r=>{const L=panelLetters(r);const ps=X().perms(r);r.items.filter(i=>i.kind==='patch').forEach(it=>{Object.entries(it.ports).forEach(([n,pd])=>{if(!pd||pd.t==='link'||!pd.note)return;n=+n;
    const g=add(pd.note.trim());const pm=ps.find(p=>p.panel.id===it.id&&p.n===n);const dev=P.devices.filter(d=>d.rack===r.id&&d.item===it.id&&+d.port===n);
    g.outlets.push({r,it,n,lab:wallLabel(r,it,n,L),short:L[it.id]+n,pm,dev,key:`p:${r.id}:${it.id}:${n}`});dev.forEach(d=>{if(d.kind!=='to')g.devices.push(d)})})})});
  return Object.values(R0).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
}
let RQ='';
function openRooms(){
  const l=rooms();const f=RQ.toLowerCase();const v=l.filter(g=>!f||g.name.toLowerCase().includes(f));
  modal('Schede dei locali',`<p class="piccola" style="margin-top:0">Una pagina per ogni locale (aula, ufficio…) con le sue prese, gli apparati, la posizione in pianta e le foto: da stampare o lasciare in loco. I locali sono quelli scritti sulle prese dei patch panel.</p>
    <div class="btnrow" style="align-items:center;margin-bottom:8px"><input type="search" id="rmQ" value="${esc(RQ)}" placeholder="Filtra i locali…" style="flex:1;min-width:180px"><button class="btn" data-rmx="all">Seleziona tutti</button><button class="btn primario" data-rmx="print">Stampa le schede</button></div>
    ${v.length?`<div style="max-height:52vh;overflow:auto"><table class="vtab"><tr><th></th><th>Locale</th><th>Prese</th><th>Apparati</th><th>Armadi</th></tr>${v.map(g=>`<tr><td><input type="checkbox" data-rm="${esc(g.name)}" checked></td><td><b>${esc(g.name)}</b></td><td>${g.outlets.length}</td><td>${g.devices.length}</td><td><small>${[...new Set(g.outlets.map(o=>rid(o.r)))].join(', ')}</small></td></tr>`).join('')}</table></div>`
      :'<p class="piccola">Nessun locale: scrivi il locale sulle prese dei patch panel (o posiziona le prese in planimetria con il nome del locale).</p>'}`);
  const q=$('#rmQ');if(q)q.oninput=()=>{RQ=q.value;const p=q.selectionStart;openRooms();const q2=$('#rmQ');q2.focus();q2.setSelectionRange(p,p)};
}
async function crop(g){
  const pts=[];P.devices.forEach(d=>{if(g.outlets.some(o=>o.dev.includes(d)))pts.push(d)});if(!pts.length)return null;
  const byPl={};pts.forEach(d=>(byPl[d.plan]??=[]).push(d));const plId=Object.keys(byPl).sort((a,b)=>byPl[b].length-byPl[a].length)[0];const pl=planById(plId);if(!pl)return null;
  let c;try{c=await planCanvas(pl,2400)}catch(_){return null}const s=c.width/pl.w;const ds=byPl[plId];
  const xs=ds.map(d=>d.x),ys=ds.map(d=>d.y);const m=Math.max(pl.w,pl.h)*.12;
  let x0=Math.max(0,Math.min(...xs)-m),y0=Math.max(0,Math.min(...ys)-m),x1=Math.min(pl.w,Math.max(...xs)+m),y1=Math.min(pl.h,Math.max(...ys)+m);
  const minW=pl.w*.3,minH=pl.h*.3;if(x1-x0<minW){const cx=(x0+x1)/2;x0=Math.max(0,cx-minW/2);x1=Math.min(pl.w,x0+minW)}if(y1-y0<minH){const cy=(y0+y1)/2;y0=Math.max(0,cy-minH/2);y1=Math.min(pl.h,y0+minH)}
  const o=document.createElement('canvas');o.width=Math.round((x1-x0)*s);o.height=Math.round((y1-y0)*s);const ctx=o.getContext('2d');ctx.drawImage(c,x0*s,y0*s,o.width,o.height,0,0,o.width,o.height);
  ctx.strokeStyle='#dc3545';ctx.lineWidth=Math.max(3,o.width/300);ds.forEach(d=>{ctx.beginPath();ctx.arc((d.x-x0)*s,(d.y-y0)*s,Math.max(16,o.width/40),0,7);ctx.stroke()});
  return {url:o.toDataURL('image/jpeg',.85),pl};
}
async function printRooms(names){
  const l=rooms().filter(g=>names.includes(g.name));if(!l.length){toast('Seleziona almeno un locale');return}
  closeModal();toast('Preparazione delle schede…');const st=window.NDC_field?.stOf;const L2={todo:'da fare',posata:'posata',cert:'certificata',attiva:'attiva',prob:'problema',assente:'non trovata'};
  const pages=[];
  for(const g of l){const cr=await crop(g);const phs=[...new Set([...g.devices.flatMap(d=>d.photos||[]),...g.outlets.flatMap(o=>P.field?.[o.key]?.photos||[])])].slice(0,6);const urls=[];for(const id of phs){const u=await imgUrl(id);if(u)urls.push(u)}
    const blds=[...new Set(g.outlets.map(o=>o.r.type==='CD'?'campus':`${T('edificio')} ${o.r.b} · ${T('piano')} ${o.r.floor}`))].join(', ');
    pages.push(`<section class="rp-sec room"><div class="room-h"><div><div class="rp-k">Scheda del locale</div><h1>${esc(g.name)}</h1><div>${esc(P.name)} · ${esc(blds)}${cr?' · '+esc(cr.pl.name):''}</div></div><div class="room-qr">${X().qrSvg(`${g.name}\n${g.outlets.map(o=>o.lab).join(' ')}`)}</div></div>
      ${cr?`<img class="pianta room-map" src="${cr.url}" alt="">`:''}
      <h2>Prese (${g.outlets.length})</h2><table><tr><th>Etichetta</th><th>Armadio · porta</th><th>Switch · porta</th><th>VLAN</th>${st?'<th>Stato</th>':''}</tr>${g.outlets.map(o=>`<tr><td><b>${esc(o.lab)}</b></td><td>${esc(rid(o.r))} · ${esc(o.short)}</td><td>${o.pm?esc(nm(o.pm.sw))+' U'+o.pm.sw.pos+' · '+esc(X().swPortName(o.pm.sw,o.pm.swp)):'—'}</td><td>${esc(o.pm?.pc?.vlan||'')}</td>${st?`<td>${esc(T(L2[st(o.key)]||''))}</td>`:''}</tr>`).join('')}</table>
      ${g.devices.length?`<h2>Apparati (${g.devices.length})</h2><table><tr><th>Apparato</th><th>Tipo</th><th>Presa</th><th>IP</th><th>MAC</th><th>Seriale</th></tr>${g.devices.map(d=>`<tr><td><b>${esc(dname(d))}</b></td><td>${esc(DEV[d.kind].short)}</td><td>${esc(devLabel(d)||'')}</td><td>${esc(d.ip||'')}</td><td>${esc(d.mac||'')}</td><td>${esc(d.serial||'')}</td></tr>`).join('')}</table>`:''}
      ${urls.length?`<h2>Foto</h2><div class="room-ph">${urls.map(u=>`<img src="${u}" alt="">`).join('')}</div>`:''}
      <div class="room-f">${T('Per guasti o modifiche indicare l\'etichetta della presa.')} · ${new Date().toLocaleDateString(loc())}</div></section>`)}
  $('#print').innerHTML=`<div class="relazione rooms">${pages.join('')}</div>`;setTimeout(()=>window.print(),200);
}

/* ---------------- eventi ---------------- */
document.addEventListener('change',e=>{const k=e.target.dataset?.dlf;if(k){DLF[k]=e.target.value;openDeadlines()}});
document.addEventListener('click',e=>{
  const r=e.target.closest('[data-dlr]');if(r){const ref=JSON.parse(r.dataset.dlr);closeModal();if(ref.t==='i'){S.view='rack';S.rack=ref.r;S.item=ref.i;S.port=null;S.right='props'}else{const d=P.devices.find(x=>x.id===ref.d);if(d){S.view='plan';S.plan=d.plan;S.mk='mk:'+d.id;S.right='props'}}render();return}
  const b=e.target.closest('[data-dlx]');if(b){const a=b.dataset.dlx;const all=deadlines(DLF.scope==='all');const lim=DLF.win==='all'?Infinity:+DLF.win;const l=all.filter(x=>x.days<=lim);
    if(a==='ics')download(`${slug(P.name)}-scadenze.ics`,ics(l),'text/calendar');
    else if(a==='csv')X().csv&&download(`${slug(P.name)}-scadenze.csv`,X().csv([['Data','Scadenza','Apparato','Posizione','Progetto','Giorni'],...l.map(x=>[x.date,T(x.type),x.name,x.where,x.project,x.days])]),'text/csv;charset=utf-8');
    else if(a==='open'){$('#dlBanner')?.remove();openDeadlines()}else if(a==='later'){try{localStorage.setItem('ndc-scad-avviso',String(Date.now()))}catch(_){}$('#dlBanner')?.remove()}return}
  const rm=e.target.closest('[data-rmx]');if(rm){if(rm.dataset.rmx==='all')$$('[data-rm]').forEach(c=>c.checked=true);else printRooms($$('[data-rm]').filter(c=>c.checked).map(c=>c.dataset.rm))}
});
$('#moreMenu .menu-lista').addEventListener('click',e=>{const m=e.target.closest('[data-m]')?.dataset.m;({deadlines:openDeadlines,rooms:openRooms})[m]?.()});
window.NDC_life={deadlines,openDeadlines,ics,rooms,openRooms,printRooms,devPoe,swStd,poeEst,clsOf,STD,dlFor};
(function go(){if(!P){setTimeout(go,30);return}setTimeout(dlNotice,5000)})();
})();
