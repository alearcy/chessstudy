# Stockfish cross-platform e impostazioni analisi

## Obiettivo
Rendere il backend Stockfish meno legato al solo binario macOS generico e
aggiungere impostazioni modificabili dal frontend per profondita analisi e
numero di CPU/thread usati dal motore.

## Scope
- Backend Tauri: risoluzione del binario Stockfish per target macOS/Windows.
- Backend Tauri: comando `analyze_position` esteso con `threads`.
- Frontend: impostazioni Stockfish salvate nel file settings esistente.
- Frontend: `analysisService` usa profondita/thread configurati quando non
  arrivano opzioni esplicite dal chiamante.
- UI: sezione Stockfish nel dialog impostazioni.

## Design

### Binari
`resolve_stockfish_path` cerca, in ordine:
- `STOCKFISH_PATH`, se impostata;
- `src-tauri/binaries/stockfish-<target>` in sviluppo;
- `src-tauri/binaries/stockfish.exe` su Windows;
- `src-tauri/binaries/stockfish` come compatibilita con il binario attuale;
- `stockfish` nel PATH.

Target attesi:
- macOS Apple Silicon: `stockfish-aarch64-apple-darwin`;
- macOS Intel: `stockfish-x86_64-apple-darwin`;
- Windows x64: `stockfish-x86_64-pc-windows-msvc.exe`.

Il checkout contiene:
- macOS arm64: `src-tauri/binaries/stockfish`;
- Windows x64 generico: `src-tauri/binaries/stockfish-x86_64-pc-windows-msvc.exe`.

### Opzioni UCI
Il comando Tauri diventa:

```rust
analyze_position(fen: String, depth: u32, threads: Option<u32>)
```

`Engine::analyze` applica `setoption name Threads value N` prima di ogni
analisi se `threads` e presente. Valori ammessi lato Rust:
- `depth`: clamp 1..=30;
- `threads`: clamp 1..=32.

### Settings
Il file settings esistente viene esteso:

```json
{
  "api_key": null,
  "model": "openai/gpt-4o-mini",
  "stockfish_depth": 15,
  "stockfish_threads": 1
}
```

I campi mancanti restano retrocompatibili e usano default 15/1.

### Frontend
`SettingsDialog` mostra controlli guidati:
- profondita: menu con profili `Veloce` (d10), `Bilanciata` (d15),
  `Profonda` (d20), `Molto profonda` (d25);
- avviso visibile per profondita alte, per chiarire che aumentano i tempi;
- CPU/thread: menu con profili `Leggera`, `Bilanciata`, `Rapida`.

`navigator.hardwareConcurrency` viene usato solo per costruire profili sensati
quando disponibile. Se non e disponibile, la UI usa valori conservativi e non
richiede all'utente di conoscere il numero di core.
Valori legacy fuori profilo vengono normalizzati al default invece di diventare
opzioni modificabili libere.

Il pulsante Stockfish sulla scacchiera mostra un badge `dN` con la profondita
attiva, cosi l'utente capisce subito con quale impostazione partira l'analisi.

`analysisService` carica le impostazioni una volta per sessione in Tauri e le
usa come default. Il fallback WASM usa solo la profondita; i thread non sono
supportati dal worker lite single-threaded.

## File
- `src-tauri/src/lib.rs`
- `src-tauri/src/stockfish.rs`
- `src-tauri/src/commands.rs`
- `src-tauri/src/settings.rs`
- `src/services/analysisService.ts`
- `src/components/SettingsDialog.tsx`
- `TASKS.md`

## Definition of done
- `npm run build` passa.
- `cargo test` in `src-tauri` passa.
- In Tauri, analisi usa profondita e thread configurati.
- In browser dev, fallback WASM resta funzionante con profondita configurabile
  solo se passata dal chiamante.
