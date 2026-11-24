"""Test automatici di Network Design Center (Playwright, Chromium headless).

Uso:  pip install playwright && python -m playwright install chromium
      python tests/run_tests.py
Avvia un server locale sulla cartella del repository, apre la pagina e verifica
le funzioni principali in italiano e in inglese. Esce con codice 1 se un test fallisce.
"""
import asyncio, functools, http.server, json, os, re, socketserver, sys, threading, traceback
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tests', 'out')
os.makedirs(OUT, exist_ok=True)


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    handler = functools.partial(Quiet, directory=ROOT)
    srv = socketserver.TCPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f'http://127.0.0.1:{srv.server_address[1]}/'


RESULTS = []


def check(name, ok, info=''):
    RESULTS.append((name, bool(ok), info))
    print(('  ✓ ' if ok else '  ✗ ') + name + (f'  ({info})' if info and not ok else ''))


class Ctx:
    def __init__(self, page, base):
        self.pg, self.base, self.errors, self.dialogs = page, base, [], []

    async def open(self, lang):
        pg = self.pg
        await pg.goto(self.base + f'?lang={lang}')
        await pg.evaluate("localStorage.clear(); indexedDB.deleteDatabase('rack-designer')")
        await pg.evaluate(f"localStorage.setItem('ndc-lang','{lang}')")
        await pg.goto(self.base)
        await pg.wait_for_function('typeof P!=="undefined" && P && P.racks')
        await pg.wait_for_timeout(300)

    async def menu(self, m):
        await self.pg.keyboard.press('Escape')
        await self.pg.click('#moreBtn')
        await self.pg.click(f'[data-m="{m}"]')
        await self.pg.wait_for_timeout(250)

    async def download(self, m):
        await self.pg.keyboard.press('Escape')
        await self.pg.click('#moreBtn')
        async with self.pg.expect_download() as d:
            await self.pg.click(f'[data-m="{m}"]')
        dl = await d.value
        return dl.suggested_filename, open(await dl.path(), encoding='utf-8-sig', errors='replace').read()


BUILD = """()=>{const r=R();const pp=r.items.find(i=>i.kind==='patch');const sw=r.items.find(i=>i.kind==='sw');
for(let i=1;i<=8;i++){pp.ports[i]={t:'user',note:'Aula '+i};r.perm[pp.id+':'+i]={it:sw.id,n:i,col:'blu',vlan:'10'}}
sw.props.serial='SN-TEST-0042';sw.props.mac='AA:BB:CC:00:11:22';sw.props.ip='10.10.99.11';
P.vlans=[{id:'v1',vid:10,name:'Uffici',color:'#0d6efd',subnet:'10.10.10.0/24',gw:'10.10.10.1',mgmt:false},{id:'v2',vid:99,name:'Gestione',color:'#6c757d',subnet:'10.10.99.0/24',gw:'10.10.99.1',mgmt:true}];
P.plans.push({id:'plT',name:'PT',b:'A',floor:1,w:2000,h:1000,scale:0.02,opacity:1,walls:[[1000,0,1000,1000]]});
DB.put('plT',new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="1000"><rect width="2000" height="1000" fill="#fff"/></svg>'],{type:'image/svg+xml'}));
r.loc={plan:'plT',x:150,y:150};
P.devices.push({id:'dAP',kind:'ap',plan:'plT',x:700,y:300,name:'AP-Atrio',rack:r.id,item:pp.id,port:1});
P.devices.push({id:'dCam',kind:'cam',plan:'plT',x:800,y:500,dir:90,name:'Cam-Ingresso',rack:r.id,item:pp.id,port:2});
save();render()}"""


async def test_core(c):
    pg = c.pg
    print('— funzioni principali (italiano)')
    await c.open('it')
    check('pagina caricata senza errori', not c.errors, '; '.join(c.errors))
    check('interfaccia in italiano', await pg.evaluate("document.documentElement.lang") == 'it' and 'Armadio' in await pg.inner_text('.viste'))
    await pg.click('[data-lt=racks]')
    await pg.select_option('#tplPick', 'b-fd24')
    await pg.wait_for_timeout(300)
    n = await pg.evaluate('R().items.length')
    check('armadio creato da modello', n >= 8, f'{n} elementi')
    await pg.evaluate(BUILD)
    await pg.wait_for_timeout(300)
    # validazione e auto-organizza
    await pg.evaluate("R().items.find(i=>i.kind==='sw').pos=10;save();render()")
    await pg.click('#autoBtn')
    await pg.wait_for_timeout(200)
    check('auto-organizza', await pg.evaluate("R().items.find(i=>i.kind==='sw').pos") != 10)
    await pg.click('[data-rt=check]')
    check('scheda conformità', len(await pg.inner_text('#rightBody')) > 20)
    await pg.click('[data-rt=props]')
    # annulla / ripeti
    before = await pg.evaluate('R().items.length')
    await pg.evaluate("mutate(()=>{R().items.pop()})")
    await pg.keyboard.press('Control+z')
    await pg.wait_for_timeout(100)
    check('annulla (Ctrl+Z)', await pg.evaluate('R().items.length') == before)
    # viste
    for v in ['plan', 'campus', 'rack']:
        await pg.click(f'[data-view={v}]')
        await pg.wait_for_timeout(300)
    check('viste armadio / planimetria / campus', not c.errors, '; '.join(c.errors))
    await pg.evaluate("S.rear=true;render()"); await pg.evaluate("S.rear=false;S.room=true;render()"); await pg.evaluate("S.room=false;render()")
    check('vista posteriore e sala', not c.errors, '; '.join(c.errors))
    # finestre del menu
    for m in ['topo', 'perms', 'bom', 'labels', 'netbox', 'vlans', 'swcfg', 'help', 'gist', 'projects', 'versions']:
        await c.menu(m)
        ok = await pg.evaluate("document.getElementById('modal').classList.contains('open')") and not c.errors
        check(f'finestra «{m}»', ok, '; '.join(c.errors))
    await pg.keyboard.press('Escape')
    # esportazioni
    name, txt = await c.download('csv')
    check('export etichette CSV', name.endswith('.csv') and 'BA.' in txt, name)
    name, txt = await c.download('snipe')
    check('export Snipe-IT', 'SN-TEST-0042' in txt and 'AA:BB:CC:00:11:22' in txt, name)
    name, txt = await c.download('json')
    j = json.loads(txt)
    check('export progetto JSON con planimetrie', len(j.get('racks', [])) >= 2 and 'plT' in j.get('images', {}))
    await c.menu('swcfg')
    ros = await pg.input_value('#rosTxt')
    check('script RouterOS', 'vlan-filtering=yes' in ros and 'vlan-ids=10' in ros)
    await pg.keyboard.press('Escape')
    await pg.screenshot(path=os.path.join(OUT, 'it-rack.png'))


async def test_projects(c):
    pg = c.pg
    print('— più progetti, versioni, ricerca')
    await c.open('it')
    await pg.click('[data-lt=racks]'); await pg.select_option('#tplPick', 'b-fd24'); await pg.wait_for_timeout(300)
    await pg.evaluate(BUILD)
    await pg.evaluate("P.name='Sede A';save();render()")
    first = await pg.evaluate('P.pid')
    # versione e confronto
    await c.menu('versions')
    await pg.fill('#vLbl', 'Base')
    await pg.click('[data-vr=save]')
    await pg.wait_for_timeout(300)
    await pg.keyboard.press('Escape')
    await pg.evaluate("""()=>{const r=R();const pp=r.items.find(i=>i.kind==='patch');for(let i=1;i<=4;i++)r.perm[pp.id+':'+i].n=i+20;pp.ports[5].note='Lab';P.devices=P.devices.filter(d=>d.id!=='dCam');save();render()}""")
    await c.menu('versions')
    await pg.click('[data-vr=cmp]')
    await pg.wait_for_timeout(400)
    out = await pg.inner_text('#vOut')
    check('confronto tra versioni', re.search(r'Ripermutate le prese \w1–\w4', out) and 'Rimosso' in out and 'Locali delle prese modificati' in out, out[:300])
    await pg.click('[data-vr=log]')
    await pg.wait_for_timeout(200)
    check('differenze nel registro modifiche', 'Rispetto alla versione' in await pg.evaluate("R().log.map(l=>l.t).join(' ')"))
    await pg.screenshot(path=os.path.join(OUT, 'versioni.png'))
    await pg.keyboard.press('Escape')
    # ricerca
    async def find(q):
        await pg.keyboard.press('Control+k')
        await pg.wait_for_timeout(100)
        await pg.fill('#sq', q)
        await pg.wait_for_timeout(150)
        el = await pg.query_selector('#sr .srch-it')
        txt = await el.inner_text() if el else ''
        if el:
            await pg.keyboard.press('Enter')
        else:
            await pg.keyboard.press('Escape')
        await pg.wait_for_timeout(250)
        return txt
    t = await find('SN-TEST-0042')
    check('ricerca per seriale', 'Switch' in t and await pg.evaluate("R().items.find(i=>i.id===S.item)?.kind") == 'sw', t)
    t = await find('aabbcc001122')
    check('ricerca per MAC senza separatori', 'Switch' in t, t)
    t = await find('Aula 3')
    check('ricerca per locale della presa', await pg.evaluate('S.port') == 3, t)
    t = await find('AP-Atrio')
    check('ricerca apparato in planimetria', await pg.evaluate("S.view") == 'plan' and await pg.evaluate('S.mk') == 'mk:dAP', t)
    target = await pg.evaluate('rid(P.racks[0])')
    t = await find(target)
    check('ricerca identificativo armadio', await pg.evaluate("S.view") == 'rack' and await pg.evaluate('rid(R())') == target, t)
    # progetti
    await c.menu('new')
    second = await pg.evaluate('P.pid')
    check('nuovo progetto senza perdere il precedente', second != first and len(await pg.evaluate('projIndex()')) == 2)
    await pg.click('#projBtn')
    await pg.click(f'[data-pj=open][data-id="{first}"]')
    await pg.wait_for_timeout(300)
    check('riapertura progetto', await pg.evaluate('P.name') == 'Sede A' and await pg.evaluate('P.racks.length') >= 2)
    await pg.click('#projBtn')
    await pg.click(f'[data-pj=dup][data-id="{first}"]')
    await pg.wait_for_timeout(300)
    copies = await pg.evaluate("projIndex().filter(x=>x.name.includes('Sede A')).length")
    check('duplica progetto', copies == 2)
    copy = await pg.evaluate("projIndex().find(x=>x.name!=='Sede A'&&x.name.includes('Sede A')).id")
    await pg.click(f'[data-pj=del][data-id="{copy}"]')
    await pg.wait_for_timeout(500)
    check('eliminazione copia, planimetria condivisa conservata', await pg.evaluate("DB.get('plT').then(b=>!!b)"))
    await pg.reload()
    await pg.wait_for_function('typeof P!=="undefined" && P && P.racks')
    check('progetto corrente ricordato dopo il ricaricamento', await pg.evaluate('P.name') == 'Sede A' and len(await pg.evaluate('projIndex()')) == 2)
    check('nessun errore', not c.errors, '; '.join(c.errors))


ITALIAN = re.compile(r"(?<![\w])(armadi[oi]|prese?|planimetri[ae]|pannell[oi]|permutazion[ei]|etichett[ae]|alimentazione|progett[oi]|nessun[oa]?|elimina|aggiungi|carica|scarica|esporta|importa|della|delle|degli|sono|questo|questa|versione|ricerca|modificat[oaie])(?![\w])", re.I)
SWEEP = """()=>{const out=[];const w=document.createTreeWalker(document.body,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);let n;
const vis=e=>{for(;e&&e.nodeType===1;e=e.parentElement){if(e.hidden||getComputedStyle(e).display==='none')return false}return true};
while((n=w.nextNode())){if(n.nodeType===3){const p=n.parentElement;if(!p||['SCRIPT','STYLE','TEXTAREA'].includes(p.nodeName))continue;const t=n.data.trim();if(t&&vis(p)&&!p.closest('[data-noi18n]'))out.push(t)}
else for(const a of ['title','placeholder','aria-label'])if(n.getAttribute(a)&&vis(n)&&!n.closest('[data-noi18n]'))out.push(n.getAttribute(a))}return out}"""


async def test_english(c):
    pg = c.pg
    print('— versione inglese')
    await c.open('en')
    check('interfaccia in inglese', await pg.evaluate("document.documentElement.lang") == 'en' and 'Rack' in await pg.inner_text('.viste'))
    await pg.click('[data-lt=racks]'); await pg.select_option('#tplPick', 'b-fd24'); await pg.wait_for_timeout(300)
    await pg.evaluate(BUILD)
    left = set()

    async def sweep(where):
        for t in await pg.evaluate(SWEEP):
            if ITALIAN.search(t) and 'Aula' not in t:
                left.add(f'{where}: {t[:120]}')
    await sweep('armadio')
    for rt in await pg.eval_on_selector_all('[data-rt]', 'e=>e.map(x=>x.dataset.rt)'):
        await pg.click(f'[data-rt="{rt}"]'); await pg.wait_for_timeout(100); await sweep('scheda ' + rt)
    await pg.click('[data-rt=props]')
    for i in range(await pg.evaluate("document.querySelectorAll('#bay .it').length")):
        await pg.evaluate(f"document.querySelectorAll('#bay .it')[{i}].dispatchEvent(new MouseEvent('click',{{bubbles:true}}))")
        await pg.wait_for_timeout(60); await sweep(f'elemento {i}')
    for m in ['topo', 'perms', 'bom', 'labels', 'netbox', 'vlans', 'swcfg', 'help', 'projects', 'versions']:
        await c.menu(m); await sweep('menu ' + m)
    await pg.keyboard.press('Escape')
    for v in ['plan', 'campus']:
        await pg.click(f'[data-view={v}]'); await pg.wait_for_timeout(300); await sweep('vista ' + v)
        for t in await pg.eval_on_selector_all('[data-lt]', 'e=>e.map(x=>x.dataset.lt)'):
            await pg.click(f'[data-lt="{t}"]'); await pg.wait_for_timeout(100); await sweep(f'{v} {t}')
    await pg.keyboard.press('Control+k'); await pg.fill('#sq', 'Aula'); await pg.wait_for_timeout(150); await sweep('ricerca')
    await pg.keyboard.press('Escape')
    await pg.click('[data-view=rack]')
    name, txt = await c.download('csv')
    check('nomi e intestazioni dei file in inglese', name.endswith('-labels.csv') and 'Label in rack' in txt, name)
    await pg.screenshot(path=os.path.join(OUT, 'en-rack.png'))
    check('nessun testo italiano rimasto', not left, ' | '.join(sorted(left)[:15]))
    check('nessun errore', not c.errors, '; '.join(c.errors))


async def main():
    srv, base = serve()
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for fn in (test_core, test_projects, test_english):
            pg = await b.new_page(viewport={'width': 1500, 'height': 920}, accept_downloads=True)
            c = Ctx(pg, base)
            pg.on('pageerror', lambda e, c=c: c.errors.append(str(e)))
            pg.on('dialog', lambda d, c=c: (c.dialogs.append(d.message), asyncio.ensure_future(d.accept())))
            await pg.route(re.compile(r'^https?://(?!127\.0\.0\.1)'), lambda r: r.abort())
            try:
                await fn(c)
            except Exception as e:
                check(f'{fn.__name__}: eccezione', False, repr(e))
                traceback.print_exc()
                await pg.screenshot(path=os.path.join(OUT, f'errore-{fn.__name__}.png'))
            await pg.close()
        await b.close()
    srv.shutdown()
    bad = [r for r in RESULTS if not r[1]]
    print(f'\n{len(RESULTS) - len(bad)}/{len(RESULTS)} controlli superati')
    for n, _, info in bad:
        print(f'  FALLITO: {n}  {info}')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    asyncio.run(main())
