# Network Design Center

Applicazione web per **progettare, verificare, etichettare e documentare la rete di una sede**:
armadi rack, prese, permutazioni, apparati in pianta, VLAN e indirizzi, fino al sopralluogo in cantiere
dal telefono e alla relazione finale in PDF.

- Indirizzo: https://ifeldr.github.io/network-design-center/
- Nel sito principale: menu **Progetti → Network Design Center** (https://ifeldr.github.io)
- Lingue: italiano e inglese
- Funziona su Windows, macOS e Linux (Chrome, Edge, Firefox, Safari) e sul telefono

## Indice

1. [Come funziona](#come-funziona)
2. [Primi passi](#primi-passi)
3. [Vista Armadio](#vista-armadio)
4. [Catalogo modelli](#catalogo-modelli)
5. [Vista Planimetria](#vista-planimetria)
6. [Vista Campus e Sala](#vista-campus-e-sala)
7. [Permutazioni, alimentazione e controlli](#permutazioni-alimentazione-e-controlli)
8. [Rete logica: VLAN, indirizzi IP, RouterOS](#rete-logica-vlan-indirizzi-ip-routeros)
9. [Inventario, foto e certificazioni](#inventario-foto-e-certificazioni)
10. [Videosorveglianza](#videosorveglianza)
11. [Etichette, distinta e relazione](#etichette-distinta-e-relazione)
12. [Esportazioni e integrazioni](#esportazioni-e-integrazioni)
13. [Progetti, versioni e ricerca](#progetti-versioni-e-ricerca)
14. [Sopralluogo da telefono](#sopralluogo-da-telefono)
15. [Confronto progetto ↔ realtà](#confronto-progetto--realtà)
16. [Selezione multipla, copia e incolla](#selezione-multipla-copia-e-incolla)
17. [Backup e dati](#backup-e-dati)
18. [Scorciatoie da tastiera](#scorciatoie-da-tastiera)
19. [Lingua / Language](#lingua--language)
20. [Struttura del repository](#struttura-del-repository)
21. [Test automatici](#test-automatici)
22. [Pubblicazione](#pubblicazione)

---

## Come funziona

È una **pagina statica** (HTML, CSS e JavaScript, nessun server applicativo): tutto viene elaborato nel
browser e i dati restano sul dispositivo.

- Progetti, versioni, modelli e impostazioni sono salvati nel browser (localStorage).
- Planimetrie e foto sono nel database del browser (IndexedDB).
- Escono dal browser solo i dati che decidi tu di inviare: GitHub Gist con il tuo token, file esportati,
  link condivisibili. L'unica richiesta esterna automatica è quella dei caratteri della pagina (Google Fonts).
- Si può installare come app («Installa» nel browser o «Aggiungi a schermata Home» sul telefono) e
  funziona anche senza rete; con la connessione usa sempre la versione più recente.
- Stile e colori sono quelli del sito principale (tema Chirpy, carattere Source Sans 3), con modalità
  chiara e scura.

## Primi passi

1. Apri la pagina: parte un progetto vuoto con un armadio da 24 U.
2. In **Armadi** scegli un **modello di armadio** (di piano, di edificio, locale) oppure trascina gli
   elementi dalla **Libreria** o dalla scheda **Modelli**.
3. Premi **Auto-organizza** per disporli secondo le regole; la scheda **Conformità** mostra cosa correggere.
4. Passa a **Planimetria**, carica la pianta del piano, calibra la scala e trascina armadi, prese, access
   point e telecamere: ogni elemento riceve la sua presa e la sua etichetta.
5. Usa il menu **⋯** per permutazioni, VLAN, etichette, distinta, esportazioni, relazione e backup.

Tutto si annulla con Ctrl+Z (⌘Z su Mac).

## Vista Armadio

- **Libreria** drag & drop: cassetti ottici, patch panel, passacavi, pannelli ciechi, firewall, router,
  switch, hub, adattatori, server, mensole, UPS e batterie, multiprese Unel, PDU VDE, barre PoE.
- **Validatore in tempo reale** delle regole di allestimento:
  - numerazione delle unità (EIA-310-D, 1 U = 44,45 mm);
  - ordine dall'alto: fibra → rame → apparati attivi, alimentazione dal basso;
  - un passacavi ogni due unità, ciechi per gli spazi vuoti, riserve per le espansioni;
  - batterie su ripiano, serratura nei locali tecnici, ingressi sigillati per gli armadi da esterno.
- **Auto-organizza** riordina l'armadio secondo le regole, riusando i passacavi di marca.
- **Identificativi automatici**:
  - armadi `Cxp`, `Bbxp`, `Bb.Fxp`, `Bb.Lxp` (campus, edificio, piano, locale);
  - pannelli a lettere, prese `C12`, prese a muro `BA.FA1.C12`;
  - tratte tra armadi `ABC.DEF.G`, con marcatura del lato remoto.
- **Proprietà** di ogni armadio: tipo, edificio, piano, altezza, profondità, portata, sala server,
  esterno, telai numerati, note IRM, foto, posizione in planimetria.
- **Vista posteriore** con le profondità degli apparati e **targhetta con QR** (apre l'armadio in NetBox se
  ne imposti l'indirizzo).
- **Modelli di armadio**: tre predefiniti e quelli che salvi tu, riutilizzabili in tutti i progetti.
- **Registro modifiche** per ogni armadio, riportato nel foglio di armadio.
- **Foglio di armadio** stampabile: disposizione, pannelli e prese, etichette a muro, permutazioni,
  alimentazione, inventario, certificazioni, registro e segnalazioni.

## Catalogo modelli

Scheda **Modelli**, con filtro per marca e ricerca: **1325 modelli di 31 marche**, inclusi molti modelli
meno recenti ancora installati.

| Categoria | Marche |
|---|---|
| Rete | Ubiquiti (UniFi, EdgeMAX, airMAX), MikroTik, HP/HPE e ProCurve, Aruba, Cisco (Catalyst, Small Business, Meraki, ISR, ASA, Firepower), ZTE, Ruckus, TP-Link Omada/JetStream, Netgear, Zyxel, D-Link, Juniper/Mist, Extreme Networks, Dell PowerConnect e Networking |
| Firewall | Fortinet, Sophos, WatchGuard, Palo Alto Networks, oltre a quelli delle marche di rete |
| Server e storage | Dell PowerEdge (dall'11ª generazione) e PowerVault, HPE ProLiant e MSA, Lenovo, Fujitsu, Supermicro, Cisco UCS, NAS Synology e QNAP |
| Videosorveglianza | NVR e telecamere Hikvision, Synology, UniFi Protect, Meraki; videocitofoni Hikvision |
| Alimentazione | UPS e PDU APC ed Eaton, UPS e raddrizzatori Powertronix |
| Cablaggio | patch panel, cassetti ottici e passacavi Panduit, CommScope, Legrand, Schneider Electric |

- I modelli a rack hanno altezza in U (gli apparati da 1,5 U occupano 2 U), porte RJ45 e SFP e PoE.
  Le porte combo RJ45/SFP sono contate una sola volta, come RJ45, e indicate nella descrizione.
- I modelli in campo (access point, telecamere, NAS e router da tavolo…) si posizionano in planimetria.
- **Modelli personalizzati**: «+ Nuovo modello» nella scheda Modelli (o menu ⋯ → «Modelli personalizzati…»)
  con marca (anche nuova), nome, tipo, U, porte, PoE e descrizione. Restano nel browser e vengono salvati
  anche nei progetti che li usano, così funzionano dopo un'esportazione, un link o un Gist.
- Il catalogo è negli elenchi `RACK_MODELS` e `FIELD_MODELS` di `rack-designer.js`: un modello per riga.

## Vista Planimetria

- **Carica la pianta** di un piano: PNG, JPG, WebP, SVG o PDF (si sceglie la pagina). Ogni planimetria ha
  edificio e piano e si collega agli armadi con lo stesso identificativo.
- **Scala**: calibrazione con due punti a distanza nota oppure larghezza reale della pianta.
- **Posizionamento**: armadi, prese di rete, access point, telecamere e altri apparati. Ogni elemento prende
  la prima presa libera dell'armadio più vicino (o di quello scelto) e mostra la sua etichetta `ABC.DE`;
  il locale diventa la nota della presa nel patch panel.
- **Cavi**: lunghezza stimata sul percorso ortogonale più la scorta (avviso oltre 80 m, errore oltre 90 m,
  canale permanente ISO/IEC 11801), oppure sul **percorso reale** tracciato a mano.
- **Strumenti**: muri (bloccano il campo visivo e riducono la copertura Wi-Fi), campo visivo delle
  telecamere (direzione, angolo, portata), copertura Wi-Fi indicativa degli access point, righello.
- **Dorsali** tra armadi disegnate in pianta con la lunghezza stimata.
- Esportazione in **PNG** e stampa con l'elenco degli elementi.

## Vista Campus e Sala

- **Campus**: edifici con nome, descrizione e piani, collegamenti tra edifici, prese libere per piano,
  suggerimento della sequenza antioraria delle lettere e rinomina automatica degli identificativi.
- **Sala**: gli armadi dello stesso piano affiancati.
- **Topologia**: schema stellare gerarchico CD → BD → FD → LD con le tratte marcate.

## Permutazioni, alimentazione e controlli

- **Permutazioni** presa → porta dello switch con colore della bretella e VLAN; tabella stampabile e CSV;
  segnalazione delle porte usate due volte.
- **Bilancio di alimentazione**: consumo stimato, calore in BTU/h, budget PoE degli switch rispetto agli
  apparati collegati, carico e autonomia indicativa degli UPS.
- **Peso e profondità** rispetto a portata e profondità dell'armadio. Consumi, pesi e profondità sono stime
  per tipo di apparato e si correggono nei dati tecnici di ciascuno.
- **Conformità** con punteggio per armadio e per planimetria; elenco delle segnalazioni nella scheda dedicata.

## Rete logica: VLAN, indirizzi IP, RouterOS

- **VLAN e indirizzi IP**: ID, nome, colore, subnet, gateway e VLAN di gestione; controllo di subnet
  sovrapposte, gateway fuori subnet e VLAN usate ma non definite.
- **Porte degli switch** in accesso o trunk, automatiche dalle permutazioni o configurate a mano.
- **Script RouterOS** per gli switch MikroTik (bridge con VLAN filtering, indirizzo di gestione) e tabella
  delle porte in CSV per gli altri.
- **Piano indirizzi IP** (menu ⋯): VLAN per tipo di apparato, assegnazione automatica degli IP mancanti
  (salta gateway e indirizzi usati), modifica a mano, controllo di duplicati e subnet, esportazione CSV e
  **lease DHCP statiche per RouterOS** (`/ip dhcp-server lease`).

## Inventario, foto e certificazioni

- Per ogni apparato e armadio: asset tag, numero di serie, MAC, IP e foto.
- CSV per l'importazione in **Snipe-IT**.
- Importazione delle certificazioni dei cavi esportate da **Fluke LinkWare** (CSV): esito su ogni presa,
  prese non superate evidenziate e riepilogo nel foglio di armadio.
- **Importa elenco prese** da Excel (.xlsx) o CSV: colonne di etichetta (`BA.FA1.C12` o `C12`), locale,
  note e armadio riconosciute in automatico; anteprima con l'esito di ogni riga, poi i locali vengono
  scritti sulle prese e nel registro modifiche.

## Videosorveglianza

Menu ⋯ → **Archiviazione videosorveglianza**:

- telecamere prese dalla planimetria (risoluzione dal modello) più quelle aggiunte a mano;
- impostazioni di codec (H.264, H.265, H.265+/Smart), fps, qualità, registrazione continua o su
  movimento, ore al giorno e giorni di conservazione;
- calcolo di bitrate, banda in ingresso e TB necessari (con margine del 10%);
- confronto con canali e dischi degli NVR/NAS scelti (TB per disco e RAID), con i giorni di registrazione
  effettivamente possibili.

## Etichette, distinta e relazione

- **Etichette** per Brother P-touch Editor e Dymo Connect (CSV) e **CSV per l'IRM**.
- **Distinta materiali** del progetto o dell'armadio: apparati, bretelle, prese a muro e matasse di cavo.
- **Relazione completa** (menu ⋯ → «Relazione completa (PDF)…»), da stampare o salvare in PDF:
  - copertina con committente, autore, oggetto, riepilogo, conformità degli armadi e indice;
  - planimetrie, fogli di armadio, distinta materiali, piano IP, archiviazione videosorveglianza;
  - avanzamento lavori del sopralluogo e riepilogo delle segnalazioni.

## Esportazioni e integrazioni

| Formato | Contenuto |
|---|---|
| JSON | progetto completo con planimetrie e foto (esportazione e importazione) |
| Link condivisibile | progetto compresso nell'indirizzo, senza immagini |
| GitHub Gist | salvataggio e apertura del progetto (token con il solo permesso Gists) |
| NetBox | produttori, ruoli, tipi di dispositivo (YAML), sito, location, armadi, dispositivi e cavi |
| Snipe-IT | CSV degli asset |
| RouterOS | script VLAN degli switch e lease DHCP statiche |
| CSV | etichette, permutazioni, porte, distinta, piano IP |
| PNG / PDF | planimetrie, fogli di armadio, relazione |

## Progetti, versioni e ricerca

- **I miei progetti** (icona della cartella accanto al nome, o menu ⋯): più progetti nel browser, con apri,
  duplica ed elimina. «Nuovo progetto» non cancella quello aperto; JSON importati e link condivisi
  diventano progetti a sé.
- **Versioni e differenze**: istantanee manuali (con descrizione) e automatiche (quando riapri il progetto
  dopo qualche ora); confronto tra due versioni o con lo stato attuale, con le permutazioni raggruppate per
  intervalli («Ripermutate le prese B1–B6»); ripristino annullabile; invio delle differenze al registro
  modifiche di ogni armadio.
- **Ricerca globale** (lente, Ctrl+K o /): armadi, elementi, prese e tratte per etichetta o locale, apparati
  in pianta, modelli, seriali, MAC (anche senza separatori), IP, VLAN, edifici e altri progetti. Invio porta
  direttamente all'elemento.

## Sopralluogo da telefono

1. **Porta il progetto sul telefono**, una volta: con GitHub Gist (salva dal PC, apri dal telefono) oppure
   esportando il JSON e importandolo sul telefono.
2. **Apri la modalità sopralluogo**: menu ⋯ → «Modalità sopralluogo», oppure `?campo=1` nell'indirizzo
   (il PC mostra il QR da inquadrare). Installata come app funziona anche senza rete.
   - elenco di planimetrie e armadi con la barra di avanzamento;
   - planimetria a tutto schermo con zoom a due dita, prese e apparati colorati per stato;
   - tocco su una presa: **Posata, Certificata, Attiva, Problema** (con il motivo), **Non trovata**;
     per access point e telecamere Installato, Collaudato, Attivo; nota, foto dalla fotocamera (ridotte a
     1600 px), altezza di montaggio, spostamento sulla pianta;
   - **+ In più**: segna una presa o un apparato trovato in cantiere e non previsto;
   - **QR della targhetta**: apre l'elenco prese dell'armadio.
3. **Riporta il lavoro sul PC**: dal telefono «Condividi il file del sopralluogo» o «Invia con GitHub Gist»;
   sul PC menu ⋯ → «Importa sopralluogo…». Ogni azione è una voce con data, ora e autore: si aggiungono solo
   quelle nuove (una seconda importazione non duplica nulla) e, se la stessa presa è stata cambiata anche dal
   PC, vale la modifica più recente.

Sul PC lo stato compare come anello colorato in planimetria e sulle porte del patch panel, con una sezione
«Sopralluogo» nelle proprietà (stato modificabile, nota, foto, storico).

## Confronto progetto ↔ realtà

Menu ⋯ → «Confronto progetto ↔ realtà…» (si apre anche dopo l'importazione di un sopralluogo):

- **spostati in cantiere**: tieni la posizione rilevata o ripristina quella del progetto;
- **non trovati**: lasciali o toglili dal progetto (la presa torna libera);
- **trovati in più**: aggiungili (prendono la prima presa libera dell'armadio più vicino) o ignorali;
- **problemi aperti** e **non ancora verificati**.

Le scelte si applicano insieme e si annullano con Ctrl+Z (⌘Z).

## Selezione multipla, copia e incolla

- **Selezione multipla** negli elementi dell'armadio, in planimetria e nell'elenco armadi: Ctrl/⌘ + clic,
  Maiusc + clic (intervallo di unità), Maiusc + trascina (rettangolo), Ctrl/⌘ + A (tutto). Il pannello a
  destra mostra la selezione con Elimina, Duplica, Copia, Taglia e Deseleziona.
- In planimetria la selezione si trascina in gruppo; nell'armadio si sposta con le frecce.
- **Copia e incolla** (Ctrl/⌘ + C, X, V) tra armadi, progetti, schede e finestre:
  - elementi dell'armadio: stesse U se libere, altrimenti il primo spazio libero;
  - armadi interi (selezionati nell'elenco): con permutazioni e configurazione degli switch;
  - apparati in pianta: con la loro disposizione, collegati alla prima presa libera.

## Backup e dati

Menu ⋯ → **Backup dei progetti…**

- **File di backup** con tutti i progetti, planimetrie e foto (opzionali), modelli personalizzati e modelli
  di armadio.
- **Backup automatico su GitHub Gist**: gist segreto aggiornato quando ci sono modifiche (ogni 30 minuti,
  modificabile) e alla chiusura della scheda.
- **Promemoria** quando l'ultimo backup è più vecchio dei giorni scelti (7 di default).
- **Ripristino** da file o da Gist, come copie o sostituendo i progetti esistenti.

Da sapere:

- ogni browser ha il suo archivio: PC e telefono, o Chrome e Firefox, non condividono i progetti;
- cancellando i dati del sito o usando la navigazione anonima i progetti si perdono;
- Safari (iPhone, iPad, Mac) può cancellare i dati di un sito non aperto per 7 giorni: sul telefono
  conviene installare la pagina come app e tenere attivo il backup.

## Scorciatoie da tastiera

Su Windows e Linux si usa **Ctrl**, su macOS **⌘**. La guida (menu ⋯ → «Regole e guida») mostra i tasti del
sistema in uso.

| Windows / Linux | macOS | Azione |
|---|---|---|
| Ctrl + clic | ⌘ + clic | aggiunge o toglie un elemento dalla selezione |
| Maiusc + clic | ⇧ + clic | intervallo di unità nell'armadio, aggiunta in pianta |
| Maiusc + trascina | ⇧ + trascina | selezione con un rettangolo |
| Ctrl + A | ⌘A | seleziona tutto l'armadio o tutta la pianta |
| Canc, Backspace | ⌫, ⌘⌫ | elimina la selezione (in pianta: toglie dalla pianta) |
| Ctrl + C / X / V | ⌘C / ⌘X / ⌘V | copia, taglia, incolla |
| Ctrl + D | ⌘D | duplica |
| ↑ ↓ | ↑ ↓ | sposta di 1 U nell'armadio |
| Frecce (Maiusc: ×10) | Frecce (⇧: ×10) | sposta in pianta di 1 px |
| Ctrl + K oppure / | ⌘K oppure / | ricerca globale |
| Ctrl + Z / Ctrl + Y (o Ctrl + Maiusc + Z) | ⌘Z / ⌘⇧Z | annulla / ripeti |
| Rotellina, + / − | Rotellina, + / − | zoom sulla planimetria |
| Esc | Esc | deseleziona, annulla calibrazione o posizionamento |

## Lingua / Language

Interfaccia in italiano e in inglese: pulsante **EN / IT** nella testata (sul telefono nel menu ⋯). La
scelta resta salvata nel browser; alla prima visita vale la lingua del browser. Si può forzare con
`?lang=en` o `?lang=it`. In inglese sono tradotti anche dialoghi, stampe, file esportati e commenti degli
script RouterOS.

The interface is available in Italian and English: use the **EN / IT** button in the header (in the ⋯ menu
on phones). The choice is remembered in the browser; on the first visit the browser language is used.
You can force it with `?lang=en` or `?lang=it`.

Per aggiungere o correggere una traduzione basta modificare il dizionario `D` in `i18n.js`, una voce per
riga (testo italiano → testo inglese).

## Struttura del repository

| File | Contenuto |
|---|---|
| `index.html` | pagina, testata, menu e piè di pagina |
| `assets/rack-designer/rack-designer.css` | stile (colori del tema Chirpy, modalità chiara e scura, stampa) |
| `assets/rack-designer/rack-designer.js` | nucleo: regole, validatore, identificativi, armadio, planimetrie, catalogo, archivio dei progetti |
| `assets/rack-designer/rack-designer-extra.js` | permutazioni, alimentazione, campus, sala, vista posteriore, QR, registro, distinta, etichette, NetBox |
| `assets/rack-designer/rack-designer-pro.js` | VLAN, RouterOS, coperture, muri, percorsi, inventario, foto, Snipe-IT, Fluke, modelli di armadio, Gist |
| `assets/rack-designer/rack-designer-projects.js` | più progetti, versioni e confronto, ricerca globale |
| `assets/rack-designer/rack-designer-tools.js` | modelli personalizzati, videosorveglianza, piano IP, importazione prese, relazione |
| `assets/rack-designer/rack-designer-field.js` | sopralluogo da telefono, importazione sul PC, confronto progetto ↔ realtà |
| `assets/rack-designer/rack-designer-select.js` | selezione multipla e scorciatoie da tastiera |
| `assets/rack-designer/rack-designer-clip.js` | copia e incolla, backup e ripristino |
| `assets/rack-designer/i18n.js` | traduzione in inglese |
| `assets/rack-designer/vendor/qrcode.js` | qrcode-generator (Kazuhiko Arase, MIT) per i QR |
| `assets/rack-designer/vendor/pdfjs/` | pdf.js 4.10 (Mozilla, Apache 2.0) per le planimetrie in PDF |
| `assets/rack-designer/vendor/jsQR.min.js` | jsQR 1.4 (Apache 2.0) per leggere i QR dove il browser non lo fa, caricato solo quando serve |
| `manifest.webmanifest`, `sw.js` | installazione come app e funzionamento offline |
| `tests/run_tests.py`, `.github/workflows/test.yml` | test automatici |
| `assets/favicon.svg` | icona |

Ogni modulo si aggancia al nucleo sostituendo o estendendo le sue funzioni globali, quindi l'ordine dei
`<script>` in `index.html` è importante. Il repository non contiene PDF (`.gitignore`).

## Test automatici

```bash
pip install playwright openpyxl
python -m playwright install chromium
python tests/run_tests.py
```

Lo script avvia un server locale e controlla, in italiano e in inglese:

- viste, finestre del menu, esportazioni e script RouterOS;
- progetti, versioni, ricerca;
- modelli personalizzati, archiviazione, piano IP, importazione da CSV ed Excel, relazione;
- sopralluogo simulato su telefono e importazione sul PC, confronto progetto ↔ realtà;
- selezione multipla e scorciatoie sia con i tasti di Windows/Linux sia con quelli di macOS;
- copia e incolla, backup e ripristino;
- assenza di testo italiano nella versione inglese e di errori JavaScript.

Lo stesso test gira su GitHub Actions a ogni push (scheda *Actions*); le schermate dell'ultimo test si
scaricano dall'esecuzione.

## Pubblicazione

*Settings → Pages → Deploy from a branch*, branch `main`, cartella `/ (root)`.
Nel sito principale la pagina è raggiungibile dal menu **Progetti** (`_data/progetti.yml` e
`_tabs/rack-designer.md` nel repository `ifeldr.github.io`).
