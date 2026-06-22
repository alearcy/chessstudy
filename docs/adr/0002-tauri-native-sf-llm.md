# ADR-0002: Conversione a Tauri con Stockfish 18 nativo e Gemma 4 E2B locale

- **Data:** 2026-06-22
- **Stato:** Accepted

## Contesto

Il progetto è attualmente una web app React/Vite local-first con IndexedDB (Dexie), chess.js, react-chessboard e Stockfish 18 WASM in-browser (ADR-0001). L'architettura browser-only funziona ma ha limiti:

- Stockfish WASM lite single-threaded (~7MB, NNUE small net) è più debole del binario nativo e vincolato a un solo thread
- Non c'è accesso al filesystem nativo (dialog di salvataggio, cartelle utente)
- I commenti sulle mosse sono generati da template rule-based (FEAT-005); aggiungere un LLM richiederebbe API cloud o WASM, entrambi subottimali

L'obiettivo è migrare l'app in Tauri 2 per ottenere un runtime nativo che consenta: Stockfish 18 nativo multi-threaded, inferenza LLM locale (Gemma 4 E2B via llama-cpp-rs), e API di sistema (filesystem, dialog). Target: solo desktop (macOS, Windows, Linux).

## Considered options

| Opzione | Sommario |
|---|---|
| **A: Tauri + SF nativo + LLM locale** | Massima potenza e autonomia, ma introduce dipendenze Rust e bundle size significativo (~2.3 GB modello + 110 MB SF) |
| B: Rimanere browser-only, aggiungere WebLLM/WebGPU per LLM | Nessuna conversione architetturale, ma LLM via WebGPU è immaturo, lento, e consuma RAM del browser. SF resta WASM lite |
| C: Electron invece di Tauri | Ecosistema Node.js familiare, ma bundle enorme (Chromium ~150MB), RAM più alta, meno performante del Rust nativo |

## Decision

**Opzione A: Tauri 2 + Stockfish 18 nativo + Gemma 4 E2B locale.**

L'implementazione è in due fasi:

**Fase 1 (questo task):** Conversione Tauri — wrappare il frontend React esistente in Tauri 2, senza toccare la logica applicativa. L'app continua a usare Stockfish WASM e explainService rule-based, ma gira in una finestra nativa con accesso al filesystem.

**Fase 2 (task futuri):** Sostituire Stockfish WASM con binario nativo spawnato dal backend Rust via UCI. Aggiungere inferenza LLM locale con llama-cpp-2 + Gemma 4 E2B Q4_K_S (~2.1 GB, scaricato on-demand) per generare commenti didattici in italiano a partire dall'analisi di Stockfish. Supporto accelerazione GPU (CUDA/Metal) per l'LLM.

L'architettura backend Rust sarà:

```
src-tauri/src/
├── main.rs           # Tauri entry point
├── lib.rs            # Setup plugin, stati condivisi
├── commands.rs       # Comandi Tauri esposti (analyze_position, etc.)
├── stockfish.rs      # UCI engine manager (Fase 2)
├── llm.rs            # llama-cpp-2 inference (Fase 2)
└── commentary.rs     # Orchestratore SF → LLM (Fase 2)
```

Dipendenze Rust previste (Fase 2):
```toml
tauri = "2"
tokio = { version = "1", features = ["full"] }
llama-cpp-2 = "=0.1.90"  # pinnato, non segue semver
serde = { version = "1", features = ["derive"] }
anyhow = "1"
```

Modello: `gemma-4-e2b-it-Q4_K_S.gguf` (~2.1 GB, dense 5B params, 128K ctx) da HuggingFace, scaricato on-demand al primo avvio in `app_data_dir`.

## Conseguenze

### Positive
- **Fase 1 è a basso rischio**: il frontend React rimane identico, Tauri wrappa il webview senza toccare la logica
- **Stockfish nativo** (Fase 2): massima forza (big NNUE net, multi-threaded, hash table ampia), profondità d'analisi superiore
- **LLM locale** (Fase 2): commenti didattici in italiano generati on-device, zero latenza di rete, privacy totale
- **Accesso filesystem nativo**: dialog di salvataggio/apertura, backup in cartelle utente arbitrarie
- **Gemma 4 E2B**: 5B params dense, ~2.1 GB quantizzato, pensato per mobile/edge, 128K context, 140+ lingue incluso italiano
- **Separazione netta**: SF per analisi tattica, LLM per narrativa — entrambi sostituibili indipendentemente
- **Accelerazione GPU**: CUDA (NVIDIA) e Metal (Apple Silicon) supportati per inferenza LLM più veloce

### Negative
- **Bundle size aumentato**: +110 MB per il binario Stockfish, +~2.1 GB per il modello GGUF (on-demand). Con Tauri l'app base resta ~5-10 MB
- **Dipendenze Rust**: il team deve familiarizzare con Rust e Cargo
- **llama-cpp-2 non segue semver**: ogni aggiornamento può rompere l'API, versione da pinnare e testare
- **Build matrix più complessa**: Tauri compila per macOS, Windows, Linux; ogni piattaforma ha il suo binario Stockfish e potenziali differenze di compilazione di llama.cpp
- **ADR-0001 parzialmente superato**: Stockfish WASM resta in Fase 1 ma verrà rimpiazzato in Fase 2 (non rimosso — potrebbe servire come fallback)
- **Download primo avvio**: ~2.3 GB totali (modello + eventuale binario SF) da scaricare con progress bar
- **Licenza GPLv3**: Stockfish è GPLv3; bundlandolo, l'intera applicazione distribuita deve essere compatibile GPLv3

## Related specs / tasks
- ADR-0001 (Stockfish WASM): resta valido per la Fase 1, verrà aggiornato/superseduto nella Fase 2
- FEAT-005 (explainService rule-based): funziona ancora in Fase 1; in Fase 2 verrà affiancato/sostituito dall'LLM
- TASKS.md: da aggiornare con i nuovi task di conversione Tauri e implementazione SF/LLM nativi

## Open questions
1. ~~Strategia di fallback: se il modello LLM non è disponibile, l'app deve funzionare comunque con explainService rule-based?~~ **Risolto: sì, fallback automatico.**
2. ~~Target mobile: Tauri 2 supporta Android/iOS (alpha/beta). Lo consideriamo un target?~~ **Risolto: solo desktop.**
3. ~~Licenza GPLv3 di Stockfish: il binario nativo è GPLv3. Bundle-ando SF, l'intera app diventa GPLv3?~~ **Risolto: ok, app GPLv3.**
4. ~~CUDA/Metal: vogliamo supportare accelerazione GPU per l'LLM?~~ **Risolto: sì, con feature flag.**