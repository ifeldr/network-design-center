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
| `manifest.webmanifest`, `sw.js` | installazione come app e funzionamento offline |
| `assets/rack-designer/vendor/qrcode.js` | qrcode-generator (Kazuhiko Arase, MIT) per i QR delle targhette |
| `assets/rack-designer/vendor/pdfjs/` | pdf.js 4.10 (Mozilla, Apache 2.0) per leggere le planimetrie in PDF |
| `assets/favicon.svg` | icona |

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
| Ctrl+Z / Ctrl+Y | annulla / ripeti |
| Esc | annulla calibrazione o posizionamento, deseleziona |
