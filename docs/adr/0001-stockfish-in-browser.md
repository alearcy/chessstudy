# ADR-0001: Stockfish 18 in browser (lite single-threaded WASM)

**Data:** 2026-06-22
**Stato:** Accettato

## Contesto
FEAT-004 richiede analisi automatica delle mosse di una partita con "l'ultimo
modello Stockfish" (SF18), interamente lato browser (app locale, nessun backend).

## Decisione
Usare **`stockfish.js` di nmrugg** (https://github.com/nmrugg/stockfish.js),
flavor **`stockfish-18-lite-single`** (Stockfish 18, NNUE small net, ~7MB,
**single-threaded**), eseguito in un WebWorker.

File serviti come static assets da `public/stockfish/`:
- `stockfish-18-lite-single.js` (glue emscripten, è già uno worker classic)
- `stockfish-18-lite-single.wasm` (il glue deriva il nome del wasm dal proprio
  script: `location.pathname.replace(/\.js$/i,".wasm")` → **non** rinominare in
  `stockfish.wasm`: il nome deve combaciare con lo `.js`)

Caricamento: `new Worker(BASE_URL + "stockfish/stockfish-18-lite-single.js")`,
comunicazione UCI via `postMessage`/`onmessage` (`uci`→`uciok`, `isready`→
`readyok`, `position fen <fen>`, `go depth N` → stream `info ... score cp|mate
...` + `bestmove <uci>`).

## Alternative considerate

| Opzione | Pro | Contro |
|---|---|---|
| **lite single-threaded** (scelta) | ~7MB, niente SharedArrayBuffer → **nessun header COOP/COEP**, setup zero, funziona ovunque | 1 thread (più lento), NNUE small net (più debole del big net) |
| lite multi-threaded | multi-thread (più veloce), sempre ~7MB | richiede SharedArrayBuffer → COOP/COEP su dev/prod (cross-origin isolation, possibili side-effect su risorse esterne) |
| large (big NNUE) | massima forza | >100MB download, load lento, poor UX in app locale |
| `@lichess-org/stockfish-web` (sf_18) | build lichess SF18 | "not straight-forward to load and use", ottimizzato per lichess (più varianti/build) |

## Razionale
- L'autore di stockfish.js raccomanda esplicitamente il lite single-threaded per
  la maggior parte dei progetti: "fast, does not require any complicated setup,
  still far stronger than any human".
- L'app analizza un'intera partita in batch con progress bar (non real-time):
  la velocità dei thread non è critica.
- Niente COOP/COEP = zero attrito sul dev server e nessun rischio di rompere il
  caricamento di altre risorse. L'app è local-first senza dipendenze esterne.
- È comunque **Stockfish 18 con NNUE** (small net): soddisfa il requisito
  "ultimo modello Stockfish".

## Normalizzazione valutazioni
L'engine UCI riporta lo score dal POV del lato al tratto. Il servizio
`analysisService` normalizza tutto al **POV del Bianco** (se al tratto è il
Nero, nega cp/mate) per renderlo confrontabile tra posizioni e mosse.

## Come passare a multi-threaded (futuro)
1. Scaricare `stockfish-18-lite.js` + `.wasm` (nome derivato: `stockfish-18-lite.wasm`)
   in `public/stockfish/`.
2. Aggiungere header `Cross-Origin-Opener-Policy: same-origin` e
   `Cross-Origin-Embedder-Policy: require-corp` in `vite.config.ts`
   (`server.headers` e `preview.headers`).
3. Cambiare `ENGINE_URL` in `analysisService.ts`.
4. Opzionalmente `setoption name Threads value N` dopo `readyok`.

## Conseguenze
- Dipendenza da un asset binario (~7MB) in `public/stockfish/` (non in npm).
- Licenza Stockfish.js: GPLv3 (compatibile con app locale; documentare se l'app
  verrà distribuita).
- NNUE small net: leggermente più debole del big net, ma irrilevante per studio
  umano.
