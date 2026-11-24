# Rack Designer

Pagina per progettare, verificare ed etichettare gli armadi di rete e per posizionare armadi,
prese e apparati sulla planimetria dei piani.
È collegata al sito principale https://ifeldr.github.io ma vive in questo repository separato,
all'indirizzo https://ifeldr.github.io/Rack-Designer/.

Pagina statica (HTML, CSS e JavaScript, nessun backend): stile e colori sono quelli del sito
(tema Chirpy, carattere Source Sans 3, modalità scura automatica).

## Pubblicazione

*Settings → Pages → Deploy from a branch*, branch `main`, cartella `/ (root)`.
Nel sito principale la pagina è raggiungibile dal menu **Progetti → Rack Designer**
(`_tabs/rack-designer.md` nel repository `ifeldr.github.io`).

## File

| File | Contenuto |
|---|---|
| `index.html` | pagina, testata e piè di pagina |
| `assets/rack-designer/rack-designer.css` | stile (colori del tema Chirpy, modalità chiara e scura) |
| `assets/rack-designer/rack-designer.js` | logica: regole, validatore, etichette, planimetrie |
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

**Catalogo modelli** (scheda *Modelli*, filtro per marca e ricerca)
- 154 apparati a rack di Ubiquiti, MikroTik, HP/HPE, Aruba, Cisco, ZTE e Ruckus: gateway e firewall,
  router e OLT, switch, server, NVR e storage, con altezza in U, porte RJ45/SFP e PoE dalle schede tecniche
  e frontale nei colori della marca.
- 98 apparati in campo per la planimetria: access point, telecamere, switch da scrivania e ONT.
- Il modello di un elemento si può cambiare dalla colonna delle proprietà; per i modelli in planimetria
  il controllo segnala access point e telecamere collegati ad armadi senza switch PoE.
- Il catalogo è nell'elenco `RACK_MODELS` / `FIELD_MODELS` di `rack-designer.js`: per aggiungere un
  modello basta una riga.

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
