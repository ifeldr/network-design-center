# Network Design Center

Pagina per progettare, verificare ed etichettare gli armadi di rete e per posizionare armadi,
prese e apparati sulla planimetria dei piani.
È collegata al sito principale https://ifeldr.github.io ma vive in questo repository separato,
all'indirizzo https://ifeldr.github.io/network-design-center/.

Pagina statica (HTML, CSS e JavaScript, nessun backend): stile e colori sono quelli del sito
(tema Chirpy, carattere Source Sans 3, modalità scura automatica).

## Pubblicazione

*Settings → Pages → Deploy from a branch*, branch `main`, cartella `/ (root)`.
Nel sito principale la pagina è raggiungibile dal menu **Progetti → Network Design Center**
(`_tabs/rack-designer.md` nel repository `ifeldr.github.io`).

## File

| File | Contenuto |
|---|---|
| `index.html` | pagina, testata e piè di pagina |
| `assets/rack-designer/rack-designer.css` | stile (colori del tema Chirpy, modalità chiara e scura) |
| `assets/rack-designer/rack-designer.js` | logica: regole, validatore, etichette, planimetrie, catalogo |
| `assets/rack-designer/rack-designer-extra.js` | permutazioni, alimentazione, campus, sala, NetBox, etichette, distinta |
| `assets/rack-designer/rack-designer-pro.js` | VLAN, RouterOS, coperture, muri, percorsi, inventario, Snipe-IT, Fluke, modelli, Gist |
| `assets/rack-designer/rack-designer-projects.js` | più progetti nel browser, versioni con confronto, ricerca globale |
| `assets/rack-designer/rack-designer-tools.js` | modelli personalizzati, archiviazione videosorveglianza, piano IP, importazione prese da Excel/CSV, relazione completa |
| `assets/rack-designer/rack-designer-field.js` | modalità sopralluogo da telefono, importazione del sopralluogo sul PC |
| `assets/rack-designer/vendor/jsQR.min.js` | jsQR 1.4 (Apache 2.0) per leggere i QR sugli iPhone, caricato solo quando serve |
| `assets/rack-designer/rack-designer-select.js` | selezione multipla e scorciatoie da tastiera (Ctrl su Windows e Linux, ⌘ su macOS) |
| `assets/rack-designer/rack-designer-clip.js` | copia e incolla, backup automatico e ripristino |
| `tests/run_tests.py`, `.github/workflows/test.yml` | test automatici (Playwright) eseguiti da GitHub Actions a ogni push |
| `assets/rack-designer/i18n.js` | traduzione in inglese (dizionario e traduzione dell'interfaccia, dei dialoghi, delle stampe e dei file esportati) |
| `manifest.webmanifest`, `sw.js` | installazione come app e funzionamento offline |
| `assets/rack-designer/vendor/qrcode.js` | qrcode-generator (Kazuhiko Arase, MIT) per i QR delle targhette |
| `assets/rack-designer/vendor/pdfjs/` | pdf.js 4.10 (Mozilla, Apache 2.0) per leggere le planimetrie in PDF |
| `assets/favicon.svg` | icona |

## Progetti, versioni e ricerca

- **I miei progetti** (icona della cartella accanto al nome, o menu ⋯): più progetti salvati nel browser,
  con apri, duplica ed elimina. «Nuovo progetto» crea un progetto nuovo senza cancellare quello aperto;
  importazioni JSON e link condivisi diventano progetti a sé.
- **Versioni e differenze**: istantanee del progetto (manuali con una descrizione, automatiche quando
  lo riapri dopo qualche ora), confronto tra due versioni o con lo stato attuale (armadi, elementi,
  permutazioni raggruppate per intervalli come «B1–B12», locali, tratte, apparati, planimetrie, VLAN),
  ripristino annullabile e invio delle differenze al registro modifiche di ogni armadio.
- **Ricerca globale** (lente nella testata, Ctrl+K o /): trova armadi, elementi, prese e tratte per
  etichetta o locale, apparati in pianta, planimetrie, VLAN, edifici e altri progetti; il MAC si può
  scrivere anche senza separatori. Invio porta direttamente all'elemento.

## Test

`python tests/run_tests.py` (serve `pip install playwright` e `python -m playwright install chromium`)
avvia un server locale e controlla le funzioni principali in italiano e in inglese: viste, finestre
del menu, esportazioni, script RouterOS, progetti, versioni, ricerca e assenza di testo italiano
nella versione inglese. Lo stesso test gira su GitHub Actions a ogni push (scheda *Actions*).

## Strumenti

- **Modelli personalizzati** (scheda Modelli → «+ Nuovo modello», o menu ⋯): marca (anche nuova), nome,
  tipo, U, porte RJ45/SFP, PoE e descrizione. Restano nel browser e vengono salvati anche nei progetti
  che li usano, così funzionano dopo un'esportazione, un link condiviso o un Gist.
- **Archiviazione videosorveglianza**: dalle telecamere in pianta (risoluzione dal modello) e dalle
  impostazioni (codec, fps, qualità, registrazione continua o su movimento, ore, giorni) calcola bitrate,
  banda in ingresso e TB necessari; li confronta con canali e dischi degli NVR/NAS scelti (TB per disco, RAID).
- **Piano indirizzi IP**: VLAN per tipo di apparato, assegnazione automatica degli IP mancanti (salta
  gateway e indirizzi usati), controllo di duplicati e subnet, CSV e lease DHCP statiche per RouterOS.
- **Importa elenco prese (Excel/CSV)**: file .xlsx o CSV con etichetta (BA.FA1.C12 o C12) e locale;
  anteprima con l'esito di ogni riga, poi i locali vengono scritti sulle prese e nel registro modifiche.
- **Relazione completa**: copertina con riepilogo e indice, planimetrie, fogli di armadio, distinta
  materiali, piano IP, archiviazione e segnalazioni, da stampare o salvare in PDF.

## Sopralluogo da telefono

1. **Porta il progetto sul telefono**, una volta: con GitHub Gist (salva dal PC, apri dal telefono) oppure
   esportando il JSON con le planimetrie e importandolo sul telefono.
2. **Apri la modalità sopralluogo**: menu ⋯ → «Modalità sopralluogo», oppure `?campo=1` nell'indirizzo (il PC
   mostra il QR da inquadrare). Installata come app funziona anche senza rete.
   - elenco di planimetrie e armadi con l'avanzamento;
   - planimetria a tutto schermo con zoom a due dita, prese e apparati colorati per stato;
   - tocco su una presa: **Posata, Certificata, Attiva, Problema** (con il motivo), nota, foto dalla fotocamera
     (ridotte a 1600 px), altezza di montaggio per access point e telecamere, spostamento sulla pianta;
   - QR della targhetta per aprire l'elenco prese dell'armadio.
3. **Riporta il lavoro sul PC**: dal telefono «Condividi/Scarica il file del sopralluogo» o «Invia con GitHub
   Gist»; sul PC menu ⋯ → «Importa sopralluogo…». Ogni azione è una voce con data, ora e autore: vengono aggiunte
   solo quelle nuove (una seconda importazione non duplica nulla) e, se la stessa presa è stata cambiata anche
   dal PC, vale la modifica più recente.

Sul PC lo stato compare come anello colorato sugli elementi in pianta e sulle porte del patch panel, con una
sezione «Sopralluogo» nelle proprietà; la relazione completa ha la sezione «Avanzamento lavori» e le versioni
registrano i cambi di stato.

## Copia e incolla, backup, confronto con la realtà

- **Copia e incolla**: Ctrl+C / Ctrl+X / Ctrl+V (⌘ su Mac) su elementi dell'armadio, armadi interi (selezionati
  nell'elenco con Ctrl/⌘+clic) e apparati in pianta. Funziona tra armadi, progetti, schede e finestre: gli
  elementi incollati restano nelle stesse U se libere, gli apparati prendono la prima presa libera dell'armadio
  più vicino, gli armadi interi mantengono permutazioni e configurazioni degli switch.
- **Backup dei progetti** (menu ⋯): un file con tutti i progetti, i tuoi modelli e i modelli di armadio, oppure
  un gist segreto aggiornato da solo quando ci sono modifiche (anche alla chiusura della scheda). Promemoria se
  l'ultimo backup è vecchio; ripristino come copie o sostituendo i progetti esistenti.
- **Confronto progetto ↔ realtà** (menu ⋯, si apre anche dopo l'importazione di un sopralluogo): apparati
  spostati in cantiere (tieni la nuova posizione o ripristina quella del progetto), prese e apparati non trovati
  (stato «Non trovata» dal telefono: lascia o togli), elementi trovati in più (pulsante «+ In più» sul telefono:
  aggiungi o ignora), problemi aperti e ciò che non è ancora stato verificato.

## Lingua / Language

Interfaccia in italiano e in inglese: pulsante **EN / IT** nella testata. La scelta resta salvata
nel browser; alla prima visita vale la lingua del browser. Si può forzare con `?lang=en` o `?lang=it`.

The interface is available in Italian and English: use the **EN / IT** button in the header.
The choice is remembered in the browser; on the first visit the browser language is used.
You can force it with `?lang=en` or `?lang=it`.

Per aggiungere o correggere una traduzione basta modificare il dizionario `D` in `i18n.js`, una voce per riga
(testo italiano → testo inglese).

## Funzioni

**Vista Armadio**
- Libreria drag & drop: cassetti ottici, patch panel, passacavi, pannelli ciechi, firewall, router,
  switch, hub, adattatori, server, mensole, UPS, multiprese Unel, PDU VDE, barre PoE.
- Validatore in tempo reale delle regole di allestimento ed etichettatura e pulsante **Auto-organizza**.
- Identificativi automatici: armadi (`Cxp`, `Bbxp`, `Bb.Fxp`, `Bb.Lxp`), pannelli, prese (`C12`),
  prese a muro (`BA.FA1.C12`), tratte tra armadi (`ABC.DEF.G`) con marcatura del lato remoto.
- Foglio di armadio stampabile, topologia CD → BD → FD → LD.

**Catalogo modelli** (scheda *Modelli*, filtro per marca e ricerca) — 610 modelli di 31 marche
- Rete: Ubiquiti, MikroTik, HP/HPE, Aruba, Cisco, ZTE, Ruckus, TP-Link Omada, Netgear, Zyxel, D-Link,
  Juniper/Mist, Extreme Networks.
- Firewall: Fortinet, Sophos, WatchGuard, Palo Alto Networks (oltre a quelli delle marche di rete).
- Server e storage: Dell PowerEdge/PowerVault, HPE ProLiant, Lenovo ThinkSystem, Fujitsu PRIMERGY,
  Supermicro, Cisco UCS; NAS Synology e QNAP; NVR Hikvision.
- Alimentazione: UPS e PDU APC ed Eaton, UPS rack/tower Powertronix (Antares Pro, Vector RI).
- Cablaggio: patch panel, cassetti ottici e passacavi Panduit, CommScope, Legrand, Schneider Electric.
- In campo (planimetria): access point, telecamere Hikvision/Synology/UniFi/Meraki, NAS e NVR da tavolo, ONT.
- Ogni modello a rack ha altezza in U (gli apparati da 1,5 U occupano 2 U), porte RJ45/SFP e PoE dove
  pubblicati; i passacavi di marca vengono riusati dall'auto-organizzazione.
- Il catalogo è negli elenchi `RACK_MODELS` / `FIELD_MODELS` di `rack-designer.js`: un modello = una riga.

**Documentazione e controlli**
- Permutazioni presa → porta dello switch con colore della bretella e VLAN; tabella stampabile e CSV;
  segnalazione delle porte switch usate due volte.
- Bilancio di alimentazione: consumo stimato, calore in BTU/h, budget PoE degli switch rispetto agli
  access point e alle telecamere collegati, carico e autonomia indicativa degli UPS.
- Peso rispetto alla portata dell'armadio, profondità degli apparati rispetto all'armadio, vista posteriore.
  Consumi, pesi e profondità sono stime per tipo di apparato e si correggono nei dati tecnici di ciascuno.
- Vista Sala: gli armadi dello stesso piano affiancati.
- Vista Campus: edifici con nome, descrizione e piani, collegamenti tra edifici, prese libere per piano,
  suggerimento della sequenza antioraria delle lettere e rinomina automatica degli identificativi.
- Dorsali tra armadi disegnate in planimetria con la lunghezza stimata (rame oltre 90 m = errore).
- QR sulla targhetta dell'armadio (apre l'armadio in NetBox se ne imposti l'indirizzo) e registro modifiche,
  entrambi anche nel foglio di armadio.
- Distinta materiali (progetto o armadio) con apparati, bretelle, prese a muro e matasse di cavo.
- Etichette per Brother P-touch Editor e Dymo Connect (CSV).
- Esportazione per NetBox: produttori, ruoli, tipi di dispositivo (YAML), sito, location, armadi,
  dispositivi e cavi (permutazioni e tratte tra armadi), da importare nell'ordine indicato.

**Rete logica, inventario e collaudo**
- VLAN e indirizzi IP: elenco con ID, nome, colore, subnet, gateway e VLAN di gestione; controllo di subnet
  sovrapposte, gateway fuori subnet e VLAN usate ma non definite.
- Porte degli switch in accesso o trunk (automatiche dalle permutazioni o configurate a mano),
  IP di gestione e script RouterOS generato per gli switch MikroTik; tabella porte in CSV per gli altri.
- Inventario per ogni apparato e armadio: asset tag, numero di serie, MAC, IP e foto (salvate nel browser,
  incluse nell'esportazione JSON); CSV per l'importazione in Snipe-IT.
- Importazione delle certificazioni dei cavi esportate da Fluke LinkWare (CSV): esito su ogni presa,
  segnalazione delle prese non superate e riepilogo nel foglio di armadio.
- Modelli di armadio: tre predefiniti e i tuoi, salvati nel browser e riutilizzabili in ogni progetto.
- Salvataggio e apertura del progetto su GitHub Gist (token con il solo permesso Gists).
- Installabile come app e utilizzabile offline; con la connessione si usa sempre la versione più recente.

**Strumenti in planimetria**
- Campo visivo delle telecamere (direzione, angolo, portata) e copertura Wi-Fi indicativa degli access point.
- Muri disegnabili: bloccano il campo visivo e riducono la copertura Wi-Fi.
- Percorsi reali dei cavi: la lunghezza si misura sul percorso tracciato invece che ad angolo retto.
- Righello per misurare le distanze.

**Vista Planimetria**
- Carica la pianta di un piano: PNG, JPG, WebP, SVG o PDF (si sceglie la pagina).
  Ogni planimetria ha edificio e piano, così si collega agli armadi con lo stesso identificativo.
- Scala: calibrazione con due punti a distanza nota oppure larghezza reale della pianta.
- Trascina armadi, prese di rete, access point, telecamere e altri apparati.
  Ogni elemento prende la prima presa libera dell'armadio più vicino (o di quello scelto) e
  mostra l'etichetta `ABC.DE`; il locale diventa la nota della presa nel patch panel.
- Lunghezza dei cavi stimata (percorso ortogonale + scorta): avviso oltre 80 m, errore oltre 90 m
  (canale permanente ISO/IEC 11801).
- Esporta la planimetria in PNG o stampala con l'elenco degli elementi.

**Dati**
- Salvataggio automatico nel browser: progetto in localStorage, immagini delle planimetrie in IndexedDB.
- Esporta e importa il progetto in JSON (con le planimetrie incluse) e il CSV delle etichette per l'IRM.
- Link condivisibile con il progetto compresso nell'indirizzo (senza le immagini).

## Scorciatoie

| Tasto | Azione |
|---|---|
| ↑ / ↓ | sposta l'elemento selezionato nell'armadio |
| Canc | elimina l'elemento selezionato |
| Rotellina, + / − | zoom sulla planimetria |
| Ctrl/⌘ + clic | aggiunge o toglie un elemento dalla selezione (armadio, pianta, elenco armadi) |
| Maiusc/⇧ + clic | intervallo di unità nell'armadio, aggiunta in pianta |
| Maiusc/⇧ + trascina | selezione con un rettangolo |
| Ctrl/⌘ + A | seleziona tutto l'armadio o tutta la pianta |
| Canc, Backspace (⌫, ⌘⌫ su Mac) | elimina la selezione (in pianta: toglie dalla pianta) |
| Ctrl/⌘ + C, X, V | copia, taglia e incolla (anche tra progetti, schede e finestre) |
| Ctrl/⌘ + D | duplica la selezione |
| Frecce | sposta la selezione: 1 U nell'armadio, 1 px in pianta (Maiusc/⇧: 10 px) |
| Ctrl+K oppure / | ricerca globale (identificativi, prese, locali, modelli, seriali, MAC, IP) |
| Ctrl+Z / Ctrl+Y (⌘Z / ⌘⇧Z su Mac) | annulla / ripeti |
| Esc | annulla calibrazione o posizionamento, deseleziona |
