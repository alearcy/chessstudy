# TAURI-002: Stockfish 18 nativo via UCI da Tauri

## Obiettivo
Sostituire Stockfish 18 WASM (lite single-threaded, ~7MB) con un binario nativo
spawnato dal backend Rust di Tauri via protocollo UCI, sfruttando multi-threading
e big NNUE net. Il frontend React mantiene la stessa interfaccia
(`analysisService.ts`), con fallback automatico al WASM se il contesto Tauri
non è disponibile (es. `npm run dev` nel browser).

## Architettura

```
Frontend (React)                        Backend (Rust/Tauri)
┌──────────────────────┐               ┌──────────────────────────────┐
│ analysisService.ts   │──invoke()────▶│ commands::analyze_position    │
│                      │               │   fen: String, depth: u32    │
│  if window.__TAURI__ │               │       ↓                      │
│    → invoke("analyze │               │ stockfish::Engine            │
│      _position",...) │               │   stdin/stdout UCI           │
│  else                │               │       ↓                      │
│    → Stockfish WASM  │               │ stockfish binary             │
│      (fallback)      │               │   (macOS arm64/x86_64)       │
└──────────────────────┘               └──────────────────────────────┘
```

## Subtask A — Backend Rust: `stockfish.rs`

### Struct `StockfishEngine`
- **Spawn**: `std::process::Command::new(binary_path)` con `stdin(Stdio::piped())`,
  `stdout(Stdio::piped())`.
- **Init UCI**: invia `uci`, attende `uciok`, invia `isready`, attende `readyok`.
In origine impostava `setoption name MultiPV value 3`. Da FEAT-008 il valore e
configurato per singola ricerca e l'analisi della partita usa `MultiPV 1` per
ridurre il carico.
- **Analisi**: `analyze(fen: &str, depth: u32) -> Result<AnalysisResult>`:
  - Invia `position fen <fen>` + `go depth <depth>`.
  - Legge stdout riga per riga. Parsa `info depth <d> score cp <n>` / `score mate <n>`.
  - Tiene traccia dell'ultimo `info` prima di `bestmove`.
  - Al `bestmove <uci>`, restituisce `AnalysisResult`.
  - **Normalizzazione POV Bianco**: rileva `side to move` dal FEN (campo 1:
    `w` o `b`). Se il Nero è al tratto, nega cp/mate prima di restituire.
- **Shutdown**: `Drop` → invia `quit`, attende chiusura child.

### `AnalysisResult` (serde)
```rust
#[derive(Serialize)]
pub struct AnalysisResult {
    pub fen: String,
    pub depth: u32,
    pub score_cp: Option<i32>,   // centesimi pedone, POV Bianco (null se mate)
    pub score_mate: Option<i32>, // mosse a mate, POV Bianco
    pub best_move_uci: Option<String>,
}
```

### Gestione errori
- Binario non trovato → `Err("stockfish binary not found at ...")`.
- Timeout analisi (30s) → terminazione child + spawn di un nuovo processo.
- Engine crash → respawn automatico alla prossima richiesta.

### Dipendenze Rust
```toml
tokio = { version = "1", features = ["process", "io-util", "sync", "time"] }
anyhow = "1"
```

## Subtask B — Comando Tauri: `commands.rs`

```rust
use tauri::State;
use std::sync::Mutex;

pub struct AppState {
    pub engine: Mutex<stockfish::Engine>,
}

#[tauri::command]
async fn analyze_position(
    state: State<'_, AppState>,
    fen: String,
    depth: u32,
) -> Result<AnalysisResult, String> {
    let mut engine = state.engine.lock().map_err(|e| e.to_string())?;
    engine.analyze(&fen, depth).map_err(|e| e.to_string())
}
```

- L'engine viene spawnato una volta in `setup()` e condiviso via `Mutex`.
- Le analisi sono sequenziali (una alla volta) — coerente con il comportamento
  attuale di `analysisService.ts` che già processa le posizioni in serie.

### Registrazione in `lib.rs`
```rust
use std::sync::Mutex;

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let engine = stockfish::Engine::new(binary_path)?;
            app.manage(AppState { engine: Mutex::new(engine) });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![commands::analyze_position])
        .run(tauri::generate_context!())
        .expect("error");
}
```

## Subtask C — Stockfish 18 binario nativo

### Acquisizione
- macOS arm64: scaricare da https://github.com/official-stockfish/Stockfish/releases
  (SF 18, `stockfish-macos-arm64` o compilato localmente).
- Windows/Linux: binari specifici per piattaforma.
- Posizione: `src-tauri/binaries/stockfish-<target>`.

### Bundle con Tauri
- In `tauri.conf.json`:
  ```json
  "bundle": {
    "resources": {
      "binaries/stockfish-*": "binaries/"
    }
  }
  ```
- A runtime, risolvere il path con `app.path().resource_dir()` o
  `std::env::current_exe()` relativo.

### Binary path resolution
```rust
fn resolve_binary_path(app_handle: &tauri::AppHandle) -> PathBuf {
    // In sviluppo: cerca in src-tauri/binaries/
    // In produzione: cerca nella resource_dir
    let resource_dir = app_handle.path().resource_dir()
        .unwrap_or_else(|_| std::env::current_dir().unwrap());
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or(resource_dir.clone());
    
    let candidates = [
        resource_dir.join("binaries/stockfish"),
        exe_dir.join("binaries/stockfish"),
        // Percorsi specifici per OS
    ];
    
    for path in &candidates {
        if path.exists() {
            return path.clone();
        }
    }
    panic!("stockfish binary not found");
}
```

## Subtask D — Frontend: `analysisService.ts`

### Rilevazione Tauri
```ts
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}
```

### Nuovo path di analisi
```ts
// Quando in Tauri:
import { invoke } from "@tauri-apps/api/core";

async function analyzeNative(fen: string, depth: number): Promise<PositionEval> {
  const result = await invoke<{
    fen: string;
    depth: number;
    score_cp: number | null;
    score_mate: number | null;
    best_move_uci: string | null;
  }>("analyze_position", { fen, depth });
  
  return {
    fen: result.fen,
    depth: result.depth,
    scoreCp: result.score_cp,
    scoreMate: result.score_mate,
    bestMoveUci: result.best_move_uci,
  };
}
```

### `analyzePositions` — branching
```ts
export async function analyzePositions(
  fens: string[],
  options: AnalyzeOptions = {}
): Promise<PositionEval[]> {
  if (isTauri()) {
    return analyzePositionsNative(fens, options);
  }
  return analyzePositionsWasm(fens, options);
}
```

- `analyzePositionsNative`: chiama `invoke("analyze_position")` in loop (seriale).
  L'engine Rust gestisce la coda internamente.
- `analyzePositionsWasm`: codice esistente, invariato.

### File modificati
| File | Azione |
|------|--------|
| `src-tauri/src/stockfish.rs` | **Nuovo** — UCI engine manager |
| `src-tauri/src/commands.rs` | **Nuovo** — Tauri command |
| `src-tauri/src/lib.rs` | **Modifica** — registra comando + stato |
| `src-tauri/Cargo.toml` | **Modifica** — aggiungi `tokio`, `anyhow` |
| `src-tauri/tauri.conf.json` | **Modifica** — `bundle.resources` |
| `src/services/analysisService.ts` | **Modifica** — branch Tauri vs WASM |

### File NON modificati
- `src/types/index.ts` — `PositionEval`, `EvalFields` invariati
- `src/components/board/MoveNotation.tsx` — invariato
- `src/pages/LessonDetailPage.tsx` — invariato
- `public/stockfish/*` — resta come fallback
- `src/services/explainService.ts` — invariato
- `src/services/moveService.ts` — invariato

## Definition of done
- `cargo build` in `src-tauri/` passa senza errori
- `npm run build` (`tsc -b && vite build`) passa
- Comando `analyze_position` analizza una posizione e restituisce eval corretto
- Stockfish WASM continua a funzionare come fallback in dev mode browser
- Interfaccia `PositionEval` invariata
- Nessun file non correlato modificato
- Workaround tracciati in `docs/tech-debt/` se necessario
