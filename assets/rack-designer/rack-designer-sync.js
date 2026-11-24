/* =====================================================================
   Network Design Center — sincronizzazione diretta con NetBox e Snipe-IT (API REST)
   Le chiamate partono dal browser verso i tuoi server: servono HTTPS e CORS abilitato
   per l'indirizzo di questa pagina. Token e indirizzi restano solo in questo browser.
   ===================================================================== */
(function(){
'use strict';
const T=s=>(window.NDC_tr||(x=>x))(s);
const X=()=>window.NDC;
const AK='ndc-api';
const cfg=()=>{try{return {nb:{},si:{},...JSON.parse(localStorage.getItem(AK)||'{}')}}catch(_){return {nb:{},si:{}}}};
const saveCfg=c=>{try{localStorage.setItem(AK,JSON.stringify(c))}catch(_){}};
const base=u=>String(u||'').trim().replace(/\/+$/,'').replace(/\/api$/,'');
const slugify=s=>String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100)||'x';
const iname=it=>{const m=it.props?.model&&MODELS[it.props.model];return m?m.m:nm(it)};
const vend=m=>m?VENDORS[m.v].n.split(' / ')[0]:'Generico';
let LOG=[];let RUN=false;
function log(t,cls=''){LOG.push([t,cls]);const el=$('#syLog');if(el){el.insertAdjacentHTML('beforeend',`<div class="${cls}">${esc(t)}</div>`);el.scrollTop=el.scrollHeight}}
async function req(sys,method,path,body){
  const c=cfg()[sys];const url=base(c.url)+path;
  const auth=sys==='nb'?(/^nbt_/.test(c.token||'')?'Bearer ':'Token ')+c.token:'Bearer '+c.token;
  let r;try{r=await fetch(url,{method,headers:{'Authorization':auth,'Accept':'application/json','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined})}
  catch(e){throw new Error(T('Connessione non riuscita: controlla indirizzo, HTTPS e CORS')+` (${base(c.url)})`)}
  const txt=await r.text();let j=null;try{j=txt?JSON.parse(txt):null}catch(_){}
  if(!r.ok)throw new Error(`${r.status} ${method} ${path}: ${(j&&(j.detail||j.messages&&JSON.stringify(j.messages)||JSON.stringify(j))||txt).slice(0,200)}`);
  if(sys==='si'&&j&&j.status==='error')throw new Error(`${method} ${path}: ${typeof j.messages==='string'?j.messages:JSON.stringify(j.messages)}`.slice(0,240));
  return j;
}

/* =====================================================================
   NetBox
   ===================================================================== */
const ROLE={patch:['Patch panel','9e9e9e'],fo:['Cassetto ottico','ff9800'],sw:['Switch','2196f3'],fw:['Firewall','f44336'],router:['Router','673ab7'],srv:['Server','4caf50'],ups:['UPS','795548'],vde:['PDU','607d8b'],unel:['PDU','607d8b'],poe:['PDU','607d8b'],hub:['Apparato attivo','00bcd4'],mc:['Apparato attivo','00bcd4']};
let NBV=4;
async function nbGetOne(path,q){const j=await req('nb','GET',`${path}?${q}&limit=2`);return j?.results?.[0]||null}
async function nbEnsure(path,q,payload,dry,what,patch){
  const ex=await nbGetOne(path,q);
  if(ex){if(patch){const diff={};Object.entries(patch).forEach(([k,v])=>{const cur=ex[k]&&typeof ex[k]==='object'?(ex[k].id??ex[k].value):ex[k];if(v!==undefined&&v!==null&&String(cur??'')!==String(v))diff[k]=v});
      if(Object.keys(diff).length){if(dry){log(`${what}: ${T('da aggiornare')} (${Object.keys(diff).join(', ')})`,'upd');return ex}await req('nb','PATCH',`${path}${ex.id}/`,diff);log(`${what}: ${T('aggiornato')}`,'upd');return ex}}
    log(`${what}: ${T('già presente')}`,'same');return ex}
  if(dry){log(`${what}: ${T('da creare')}`,'new');return {id:null,_new:true}}
  const o=await req('nb','POST',path,payload);log(`${what}: ${T('creato')}`,'new');return o;
}
function nbType(it){const m=it.props.model&&MODELS[it.props.model];const p=it.props;
  if(m)return {man:vend(m),model:m.m,h:m.h||it.h};
  let model=KINDS[it.kind].name;if(p.ports&&['patch','fo','sw','fw','router','hub','mc','poe'].includes(it.kind))model+=` ${p.ports}p`;if(it.kind==='sw'&&+p.sfp)model+=` + ${p.sfp} SFP`;if(it.kind==='sw'&&p.poe)model+=' PoE';
  return {man:'Generico',model:model.trim(),h:it.h}}
const devName=(r,it,L)=>(L[it.id]?`${rid(r)} pannello ${L[it.id]}`:`${rid(r)} U${it.pos} ${it.name||KINDS[it.kind].name}`).slice(0,64);
const locName=r=>{if(r.type==='CD')return 'Campus';const st=P.buildings?.[r.b]||{};return `Edificio ${r.b}${st.name?' – '+st.name:''} – Piano ${r.floor}`};
const bldName=b=>{const st=P.buildings?.[b]||{};return `Edificio ${b}${st.name?' – '+st.name:''}`};
async function nbSync(dry){
  const c=cfg().nb;const st=await req('nb','GET','/api/status/');NBV=parseInt(String(st?.['netbox-version']||'4'),10)||4;log(`NetBox ${st?.['netbox-version']||''} · ${dry?T('anteprima: nessuna modifica'):T('sincronizzazione')}`,'h');
  const siteName=(c.site||P.netbox?.site||P.name||'Sede').trim();
  const site=await nbEnsure('/api/dcim/sites/',`slug=${slugify(siteName)}`,{name:siteName,slug:slugify(siteName),status:'active',description:P.name},dry,`${T('Sito')} «${siteName}»`);
  const sid=site.id;
  // location
  const locs={};
  for(const r of P.racks){const ln=locName(r);if(locs[ln])continue;
    if(r.type==='CD'){locs[ln]=sid?await nbEnsure('/api/dcim/locations/',`site_id=${sid}&slug=campus`,{name:'Campus',slug:'campus',site:sid,status:'active'},dry,'Location «Campus»'):{id:null};continue}
    const bn=bldName(r.b);if(!locs[bn])locs[bn]=sid?await nbEnsure('/api/dcim/locations/',`site_id=${sid}&slug=${slugify(bn)}`,{name:bn,slug:slugify(bn),site:sid,status:'active'},dry,`Location «${bn}»`):(log(`Location «${bn}»: ${T('da creare')}`,'new'),{id:null});
    locs[ln]=sid&&locs[bn].id?await nbEnsure('/api/dcim/locations/',`site_id=${sid}&slug=${slugify(ln)}`,{name:ln,slug:slugify(ln),site:sid,parent:locs[bn].id,status:'active'},dry,`Location «${ln}»`):(log(`Location «${ln}»: ${T('da creare')}`,'new'),{id:null})}
  // produttori, ruoli, tipi
  const mans={},roles={},types={};
  const items=P.racks.flatMap(r=>r.items.filter(i=>ROLE[i.kind]).map(it=>({r,it})));
  for(const {it} of items){const t=nbType(it);
    if(!mans[t.man])mans[t.man]=await nbEnsure('/api/dcim/manufacturers/',`slug=${slugify(t.man)}`,{name:t.man,slug:slugify(t.man)},dry,`${T('Produttore')} «${t.man}»`);
    const [rn,col]=ROLE[it.kind];if(!roles[rn])roles[rn]=await nbEnsure('/api/dcim/device-roles/',`slug=${slugify(rn)}`,{name:rn,slug:slugify(rn),color:col},dry,`${T('Ruolo')} «${rn}»`);
    const tk=t.man+'|'+t.model;if(types[tk])continue;const ts=slugify(t.man+'-'+t.model);
    const ex=await nbGetOne('/api/dcim/device-types/',`slug=${ts}`);
    if(ex){types[tk]=ex;log(`${T('Tipo di dispositivo')} «${t.model}»: ${T('già presente')}`,'same');continue}
    if(dry||!mans[t.man].id){types[tk]={id:null};log(`${T('Tipo di dispositivo')} «${t.model}»: ${T('da creare')}`,'new');continue}
    const dt=await req('nb','POST','/api/dcim/device-types/',{manufacturer:mans[t.man].id,model:t.model,slug:ts,u_height:t.h,is_full_depth:(X().spec(it).dep||0)>400});types[tk]=dt;log(`${T('Tipo di dispositivo')} «${t.model}»: ${T('creato')}`,'new');
    if(it.kind==='patch'||it.kind==='fo'){const n=+it.props.ports||0;const ty=it.kind==='fo'?(it.props.conn||'lc').toLowerCase():'8p8c';
      const rps=await req('nb','POST','/api/dcim/rear-port-templates/',Array.from({length:n},(_,i)=>({device_type:dt.id,name:'R'+(i+1),type:ty,positions:1})));
      const rid2=Object.fromEntries((rps||[]).map(x=>[x.name,x.id]));
      await req('nb','POST','/api/dcim/front-port-templates/',Array.from({length:n},(_,i)=>({device_type:dt.id,name:String(i+1),type:ty,rear_port:rid2['R'+(i+1)],rear_port_position:1})))}
    else if(X().isSwitchLike(it)){const sp=X().swPorts(it);if(sp.n)await req('nb','POST','/api/dcim/interface-templates/',Array.from({length:sp.n},(_,i)=>({device_type:dt.id,name:X().swPortName(it,i+1),type:i<sp.rj?'1000base-t':'10gbase-x-sfpp'})))}}
  // armadi e dispositivi
  const racks={},devs={};
  for(const r of P.racks){const loc=locs[locName(r)];
    racks[r.id]=sid?await nbEnsure('/api/dcim/racks/',`site_id=${sid}&name=${encodeURIComponent(rid(r))}`,{name:rid(r),site:sid,location:loc?.id||undefined,status:'active',u_height:r.units,width:19,description:TYPES[r.type].it},dry,`${T('Armadio')} ${rid(r)}`,{u_height:r.units}):(log(`${T('Armadio')} ${rid(r)}: ${T('da creare')}`,'new'),{id:null});
    const L=panelLetters(r);
    for(const it of r.items.filter(i=>ROLE[i.kind])){const t=nbType(it);const ty=types[t.man+'|'+t.model];const name=devName(r,it,L);
      if(!sid||!racks[r.id].id||!ty?.id){log(`${T('Dispositivo')} «${name}»: ${T('da creare')}`,'new');devs[it.id]={id:null};continue}
      const body={name,device_type:ty.id,site:sid,location:loc?.id||undefined,rack:racks[r.id].id,position:it.pos,face:'front',status:'active',serial:it.props.serial||'',asset_tag:it.props.tag||null};body[NBV>=4?'role':'device_role']=roles[ROLE[it.kind][0]].id;
      devs[it.id]=await nbEnsure('/api/dcim/devices/',`site_id=${sid}&name=${encodeURIComponent(name)}`,body,dry,`${T('Dispositivo')} «${name}»`,{rack:racks[r.id].id,position:it.pos,serial:it.props.serial||undefined,asset_tag:it.props.tag||undefined})}}
  // cavi delle permutazioni
  let nc=0,skip=0;
  for(const r of P.racks){for(const p of X().perms(r)){const a=devs[p.panel.id],b=devs[p.sw.id];if(!a?.id||!b?.id){if(dry)nc++;continue}
      const fp=await nbGetOne('/api/dcim/front-ports/',`device_id=${a.id}&name=${encodeURIComponent(String(p.n))}`);const ifc=await nbGetOne('/api/dcim/interfaces/',`device_id=${b.id}&name=${encodeURIComponent(X().swPortName(p.sw,p.swp))}`);
      if(!fp||!ifc){skip++;continue}if(fp.cable||ifc.cable){skip++;continue}
      if(dry){nc++;continue}
      await req('nb','POST','/api/dcim/cables/',{a_terminations:[{object_type:'dcim.frontport',object_id:fp.id}],b_terminations:[{object_type:'dcim.interface',object_id:ifc.id}],status:'connected',label:p.lab,color:(X().COLORI[p.pc.col]||'#1f6feb').slice(1),description:p.pc.vlan?'VLAN '+p.pc.vlan:''});nc++}}
  log(`${T('Cavi delle permutazioni')}: ${nc} ${dry?T('da creare'):T('creati')}${skip?`, ${skip} ${T('già collegati o senza porte')}`:''}`,nc?'new':'same');
}
async function nbImport(siteId){
  const st=await req('nb','GET','/api/status/');NBV=parseInt(String(st?.['netbox-version']||'4'),10)||4;
  const site=await req('nb','GET',`/api/dcim/sites/${siteId}/`);const racks=(await req('nb','GET',`/api/dcim/racks/?site_id=${siteId}&limit=1000`)).results;
  const devs=(await req('nb','GET',`/api/dcim/devices/?site_id=${siteId}&limit=1000`)).results.filter(d=>d.rack&&d.position);
  const fps=(await req('nb','GET',`/api/dcim/front-ports/?site_id=${siteId}&limit=5000`)).results;const fpn={};fps.forEach(f=>{fpn[f.device.id]=(fpn[f.device.id]||0)+1});
  const ifs=(await req('nb','GET',`/api/dcim/interfaces/?site_id=${siteId}&limit=5000`)).results;const ifn={};ifs.forEach(f=>{ifn[f.device.id]=(ifn[f.device.id]||0)+1});
  const kindOf=d=>{const r=((d.role||d.device_role)?.slug||'')+' '+((d.role||d.device_role)?.name||'')+' '+(d.device_type?.model||'');
    if(/patch|presa|panel/i.test(r))return 'patch';if(/fibr|ottic|fiber|cassett/i.test(r))return 'fo';if(/firewall/i.test(r))return 'fw';if(/router/i.test(r))return 'router';if(/switch/i.test(r))return 'sw';
    if(/ups/i.test(r))return 'ups';if(/pdu|power/i.test(r))return 'vde';if(/server|nas|storage|nvr/i.test(r))return 'srv';return 'hub'};
  const p={name:site.name,simplify:true,fill:true,slack:6,cables:true,racks:[],plans:[],devices:[],netbox:{url:base(cfg().nb.url),site:site.name}};
  const LETS={};
  racks.forEach(rk=>{const r=newRack({units:rk.u_height||42,note:`NetBox: ${rk.name}${rk.location?' · '+rk.location.name:''}`});r.items=[];r.log=[];r.perm={};
    devs.filter(d=>d.rack.id===rk.id).forEach(d=>{const k=kindOf(d);const h=Math.max(1,Math.ceil(d.device_type?.u_height||1));const pos=Math.floor(d.position);
      const it=mkItem(k,pos,{},{name:d.name||''});it.h=h;if(k==='patch'||k==='fo')it.props.ports=fpn[d.id]||24;else if(['sw','fw','router','hub'].includes(k))it.props.ports=ifn[d.id]||it.props.ports;
      if(['srv','ups'].includes(k))it.props.size=h;if(d.serial)it.props.serial=d.serial;if(d.asset_tag)it.props.tag=d.asset_tag;r.items.push(it)});
    p.racks.push(r)});
  if(!p.racks.length)p.racks.push(newRack({units:24}));
  return {p,n:{racks:racks.length,devs:devs.length}};
}

/* =====================================================================
   Snipe-IT
   ===================================================================== */
const CAT={sw:'Apparati di rete',fw:'Apparati di rete',router:'Apparati di rete',hub:'Apparati di rete',mc:'Apparati di rete',poe:'Apparati di rete',srv:'Server e storage',ups:'Alimentazione',vde:'Alimentazione',ap:'Access point',cam:'Videosorveglianza',altro:'Altri apparati'};
async function siFind(path,name,match=x=>x.name===name){const j=await req('si','GET',`${path}?search=${encodeURIComponent(name)}&limit=50`);return (j?.rows||[]).find(match)||null}
async function siEnsure(path,name,payload,dry,what){const ex=await siFind(path,name);if(ex)return ex;if(dry){log(`${what}: ${T('da creare')}`,'new');return {id:null}}const o=await req('si','POST',path,payload);log(`${what}: ${T('creato')}`,'new');return o.payload||o}
function siAssets(){const out=[];
  P.racks.forEach(r=>r.items.forEach(it=>{if(!CAT[it.kind])return;const p=it.props;if(!p.serial&&!p.tag)return;const m=p.model&&MODELS[p.model];out.push({name:`${m?m.m:nm(it)} · ${rid(r)} U${it.pos}`,model:m?m.m:nm(it),man:vend(m),cat:CAT[it.kind],serial:p.serial||'',tag:p.tag||'',loc:rid(r),notes:[p.mac?'MAC '+p.mac:'',p.ip?'IP '+p.ip:''].filter(Boolean).join(' · ')})}));
  P.devices.forEach(d=>{if(!CAT[d.kind]||(!d.serial&&!d.tag))return;const m=d.model&&MODELS[d.model];const pl=planById(d.plan);out.push({name:d.name||(m?m.m:DEV[d.kind].short),model:m?m.m:DEV[d.kind].name,man:vend(m),cat:CAT[d.kind],serial:d.serial||'',tag:d.tag||'',loc:pl?pl.name:'',notes:[devLabel(d)||'',d.mac?'MAC '+d.mac:'',d.ip?'IP '+d.ip:''].filter(Boolean).join(' · ')})});
  return out}
async function siSync(dry){
  const c=cfg().si;const st=await req('si','GET','/api/v1/statuslabels?limit=100');const labels=st?.rows||[];
  const status=labels.find(x=>String(x.id)===String(c.status))||labels.find(x=>x.type==='deployable')||labels[0];if(!status)throw new Error(T('Nessuno stato degli asset in Snipe-IT'));
  log(`Snipe-IT · ${dry?T('anteprima: nessuna modifica'):T('sincronizzazione')} · ${T('stato')} «${status.name}»`,'h');
  const list=siAssets();if(!list.length){log(T('Nessun apparato con numero di serie o asset tag'),'same');return}
  const mans={},cats={},models={},locs={};
  for(const a of list){
    mans[a.man]??=await siEnsure('/api/v1/manufacturers',a.man,{name:a.man},dry,`${T('Produttore')} «${a.man}»`);
    cats[a.cat]??=await siEnsure('/api/v1/categories',a.cat,{name:a.cat,category_type:'asset'},dry,`${T('Categoria')} «${a.cat}»`);
    const mk=a.man+'|'+a.model;models[mk]??=await (async()=>{const ex=await siFind('/api/v1/models',a.model,x=>x.name===a.model&&(!x.manufacturer||x.manufacturer.name===a.man));if(ex)return ex;if(dry||!mans[a.man].id||!cats[a.cat].id){log(`${T('Modello')} «${a.model}»: ${T('da creare')}`,'new');return {id:null}}
      const o=await req('si','POST','/api/v1/models',{name:a.model,manufacturer_id:mans[a.man].id,category_id:cats[a.cat].id});log(`${T('Modello')} «${a.model}»: ${T('creato')}`,'new');return o.payload||o})();
    if(c.locs!==false&&a.loc)locs[a.loc]??=await siEnsure('/api/v1/locations',a.loc,{name:a.loc},dry,`Location «${a.loc}»`);
    let ex=null;
    if(a.serial){const j=await req('si','GET',`/api/v1/hardware/byserial/${encodeURIComponent(a.serial)}`).catch(()=>null);ex=j?.rows?.[0]||null}
    if(!ex&&a.tag){const j=await req('si','GET',`/api/v1/hardware/bytag/${encodeURIComponent(a.tag)}`).catch(()=>null);ex=j&&j.id?j:null}
    const body={name:a.name,serial:a.serial||undefined,asset_tag:a.tag||undefined,model_id:models[mk].id||undefined,location_id:locs[a.loc]?.id||undefined,rtd_location_id:locs[a.loc]?.id||undefined,notes:a.notes||undefined};
    if(ex){if(dry){log(`Asset «${a.name}»: ${T('da aggiornare')}`,'upd');continue}await req('si','PATCH',`/api/v1/hardware/${ex.id}`,{...body,model_id:undefined});log(`Asset «${a.name}»: ${T('aggiornato')}`,'upd');continue}
    if(dry||!models[mk].id){log(`Asset «${a.name}»: ${T('da creare')}`,'new');continue}
    await req('si','POST','/api/v1/hardware',{...body,status_id:status.id});log(`Asset «${a.name}»: ${T('creato')}`,'new');
  }
}

/* =====================================================================
   finestra
   ===================================================================== */
function openSync(tab){
  const c=cfg();const t=tab||c.tab||'nb';
  const nb=c.nb||{},si=c.si||{};
  modal('Sincronizza con NetBox e Snipe-IT',`<div class="seg" style="max-width:360px;margin-bottom:12px"><button class="${t==='nb'?'on':''}" data-sy="tab" data-v="nb">NetBox</button><button class="${t==='si'?'on':''}" data-sy="tab" data-v="si">Snipe-IT</button></div>
  ${t==='nb'?`<div class="grid2"><div class="f"><label>Indirizzo NetBox</label><input type="url" data-syc="nb.url" value="${esc(nb.url||P.netbox?.url||'')}" placeholder="https://netbox.esempio.it"></div>
    <div class="f"><label>Token API</label><input type="password" data-syc="nb.token" value="${esc(nb.token||'')}" autocomplete="off" placeholder="token con permessi di scrittura"></div>
    <div class="f"><label>Sito</label><input type="text" data-syc="nb.site" value="${esc(nb.site||P.netbox?.site||'')}" placeholder="${esc(P.name)}"></div></div>
    <p class="piccola">Crea o aggiorna sito, location (edifici e piani), produttori, ruoli, tipi di dispositivo con le porte, armadi, dispositivi (posizione, seriale, asset tag) e i cavi delle permutazioni. Gli oggetti esistenti vengono riconosciuti per nome o slug e non vengono duplicati.</p>
    <div class="btnrow"><button class="btn" data-sy="test" data-v="nb">Prova la connessione</button><button class="btn" data-sy="dry" data-v="nb">Anteprima</button><button class="btn primario" data-sy="go" data-v="nb">Sincronizza</button><span style="flex:1"></span><button class="btn" data-sy="imp">Importa un sito da NetBox…</button></div>`
  :`<div class="grid2"><div class="f"><label>Indirizzo Snipe-IT</label><input type="url" data-syc="si.url" value="${esc(si.url||'')}" placeholder="https://snipeit.esempio.it"></div>
    <div class="f"><label>Token API</label><input type="password" data-syc="si.token" value="${esc(si.token||'')}" autocomplete="off" placeholder="personal access token"></div>
    <div class="f"><label>Stato dei nuovi asset (ID)</label><input type="text" data-syc="si.status" value="${esc(si.status||'')}" placeholder="automatico: il primo «deployable»"></div>
    <label class="chk" style="align-self:end"><input type="checkbox" data-syc="si.locs" ${si.locs!==false?'checked':''}><span>Crea le location (armadi e planimetrie)</span></label></div>
    <p class="piccola">Sincronizza gli apparati che hanno numero di serie o asset tag: crea produttori, categorie, modelli e location mancanti, aggiorna gli asset già presenti (cercati per seriale o asset tag) e crea quelli nuovi. MAC e IP finiscono nelle note.</p>
    <div class="btnrow"><button class="btn" data-sy="test" data-v="si">Prova la connessione</button><button class="btn" data-sy="dry" data-v="si">Anteprima</button><button class="btn primario" data-sy="go" data-v="si">Sincronizza</button></div>`}
  <div class="sy-log" id="syLog"></div>
  <details class="piccola" style="margin-top:10px"><summary>Requisiti del server (HTTPS e CORS)</summary><p>La pagina chiama le API direttamente dal browser: il server deve essere in HTTPS e accettare richieste da <code>${esc(location.origin)}</code>.</p>
    <ul><li>NetBox: in <code>configuration.py</code> <code>CORS_ORIGIN_WHITELIST = ['${esc(location.origin)}']</code> (oppure <code>CORS_ORIGIN_REGEX_WHITELIST</code>).</li><li>Snipe-IT: nel file <code>.env</code> <code>CORS_ALLOWED_ORIGINS="${esc(location.origin)}"</code>, poi <code>php artisan config:clear</code>.</li>
    <li>Token: NetBox con permessi di scrittura su DCIM; Snipe-IT con un utente che può creare asset, modelli e location.</li><li>Token e indirizzi restano solo in questo browser e non vengono salvati nel progetto.</li></ul></details>`);
}
async function run(sys,mode){
  if(RUN)return;const c=cfg()[sys];if(!c.url||!c.token){toast('Inserisci indirizzo e token');return}
  if(location.protocol==='https:'&&/^http:/.test(c.url)){toast('Il browser blocca le chiamate da una pagina HTTPS a un server HTTP: usa HTTPS');return}
  RUN=true;LOG=[];const el=$('#syLog');if(el)el.innerHTML='';
  try{if(mode==='test'){if(sys==='nb'){const s=await req('nb','GET','/api/status/');log(`NetBox ${s?.['netbox-version']||''}: ${T('connessione riuscita')}`,'new');const u=await req('nb','GET','/api/dcim/sites/?limit=1');log(`${u?.count??0} ${T('siti')}`,'same')}
      else{const s=await req('si','GET','/api/v1/statuslabels?limit=100');log(`Snipe-IT: ${T('connessione riuscita')}`,'new');(s?.rows||[]).forEach(x=>log(`${T('Stato')} ${x.id}: ${x.name} (${x.type})`,'same'))}}
    else{if(mode==='go'&&!confirm(T(sys==='nb'?'Sincronizzare il progetto con NetBox? Gli oggetti mancanti vengono creati e quelli esistenti aggiornati.':'Sincronizzare gli apparati con Snipe-IT? Gli asset mancanti vengono creati e quelli esistenti aggiornati.'))){RUN=false;return}
      await (sys==='nb'?nbSync(mode==='dry'):siSync(mode==='dry'));log(mode==='dry'?T('Anteprima completata: nessuna modifica eseguita.'):T('Sincronizzazione completata.'),'h');if(mode==='go')toast(sys==='nb'?'Sincronizzazione con NetBox completata':'Sincronizzazione con Snipe-IT completata')}}
  catch(e){log(e.message,'err')}finally{RUN=false}
}
async function importNB(){
  const c=cfg().nb;if(!c.url||!c.token){toast('Inserisci indirizzo e token');return}LOG=[];$('#syLog').innerHTML='';
  try{const j=await req('nb','GET','/api/dcim/sites/?limit=500');const l=j?.results||[];if(!l.length){log(T('Nessun sito in NetBox'),'same');return}
    $('#syLog').innerHTML=`<div class="h">${T('Scegli il sito da importare come nuovo progetto')}:</div>${l.map(s=>`<div class="pj"><div class="grow"><div class="pj-n">${esc(s.name)}</div><div class="sub">${esc(s.slug)}</div></div><button class="btn piccolo primario" data-sy="impSite" data-v="${s.id}">Importa</button></div>`).join('')}`}
  catch(e){log(e.message,'err')}
}
async function importSite(id){
  try{const {p,n}=await importNB2(id);toast(`${n.racks} armadi e ${n.devs} dispositivi importati da NetBox`)}catch(e){log(e.message,'err')}}
async function importNB2(id){const res=await nbImport(id);closeModal();P=normalize({...res.p,pid:uid()});try{assignLetters()}catch(_){}S.rack=P.racks[0].id;S.plan=P.plans[0]?.id||null;S.item=null;S.port=null;S.mk=null;S.hist=[];S.fut=[];save();render();return res}
document.addEventListener('click',e=>{const b=e.target.closest('[data-sy]');if(!b)return;const a=b.dataset.sy,v=b.dataset.v;
  if(a==='tab'){const c=cfg();c.tab=v;saveCfg(c);openSync(v)}else if(a==='imp')importNB();else if(a==='impSite')importSite(v);else run(v,a)});
document.addEventListener('change',e=>{const k=e.target.dataset?.syc;if(!k)return;const [s,f]=k.split('.');const c=cfg();c[s]??={};c[s][f]=e.target.type==='checkbox'?e.target.checked:e.target.value.trim();saveCfg(c);
  if(k==='nb.url'&&!P.netbox?.url){P.netbox??={};P.netbox.url=base(e.target.value);save()}});
$('#moreMenu .menu-lista').addEventListener('click',e=>{const m=e.target.closest('[data-m]')?.dataset.m;if(m==='sync')openSync()});
window.NDC_sync={openSync,nbSync,siSync,nbImport,siAssets,cfg,saveCfg,run};
})();
