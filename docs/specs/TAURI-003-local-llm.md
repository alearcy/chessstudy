# TAURI-003: Integrare LLM locale per commenti didattici

## Obiettivo
Sostituire il servizio di commento rule-based (`explainService.ts`) con un LLM
locale (Qwen3 4B, Q4_K_M ~2.4 GB) eseguito via `llama-cpp-2` nel
backend Rust di Tauri. Il modello genera commenti didattici in italiano a partire
dall'analisi Stockfish della posizione. Fallback automatico a `explainService.ts`
se il modello non è disponibile.

## Architettura

```
Frontend (React)                         Backend (Rust/Tauri)
┌───────────────────────┐               ┌──────────────────────────────┐
│ explainService.ts     │──invoke()────▶│ commands::generate_          │
│                       │               │   commentary                 │
│  if Tauri + LLM ready │               │       ↓                     │
│    → invoke native    │               │ commentary::generate()       │
│  else                 │               │       ↓                     │
│    → rule-based (TS)  │               │ llm::Inference::prompt()     │
│                       │               │   (llama-cpp-2)              │
│  batchExplain()       │──invoke()────▶│       ↓                     │
│    → invoke native    │               │ Qwen3 4B Q4_K_M.gguf    │
│    multi-move batch   │               │   (~2.4 GB, resource_dir)    │
└───────────────────────┘               └──────────────────────────────┘
```

## Subtask A — `llm.rs`: LLM Inference Engine

### Modello
- **Nome**: `Qwen3-4B-Q4_K_M.gguf`
- **Origine locale**: `src-tauri/models/Qwen3-4B-Q4_K_M.gguf`
- **Dimensione**: ~2.4 GB
- **Posizione**: `resource_dir()/models/Qwen3-4B-Q4_K_M.gguf`
- **Distribuzione**: incluso nelle risorse Tauri.

### Struct `LlmEngine`
```rust
pub struct LlmEngine {
    // llama-cpp-2 model, context, backend — dettagli incapsulati
}

impl LlmEngine {
    pub fn new(model_path: &str) -> Result<Self>;
    pub fn prompt(&self, system: &str, user: &str, max_tokens: u32) -> Result<String>;
}
```

### Configurazione inferenza
- Context size: 4096 token (sufficiente per prompt + risposta)
- Max token generated: 256
- Temperature: 0.7
- GPU: Metal su macOS (feature `metal`), CUDA su NVIDIA (feature `cuda`)

## Subtask B — `commentary.rs`: Orchestratore

### Prompt template
```
<|system|>Sei un istruttore di scacchi esperto. Analizzi posizioni e spieghi le
mosse in italiano, in modo chiaro e didattico. Massimo 3 frasi. Usa notazione
algebrica.</|system|>

<|user|>Posizione: {fen}
Valutazione Stockfish: {eval_score}
Mossa giocata: {played_san}
Mossa migliore suggerita: {best_san}

Spiega perché la mossa {played_san} è buona o cattiva.</|user|>
```

### Funzione `generate_commentary`
Input:
- `fen`: posizione prima della mossa
- `played_san`: mossa giocata
- `played_by`: "w" | "b"
- `eval_cp`, `eval_mate`, `eval_depth`: valutazione Stockfish
- `best_move_uci`: miglior mossa UCI (convertita in SAN)

Output: `CommentaryResult` con campi:
```rust
pub struct CommentaryResult {
    pub summary: String,     // 1-2 frasi riassuntive
    pub details: String,     // spiegazione completa
    pub severity: String,    // "best" | "good" | "inaccuracy" | "mistake" | "blunder"
}
```

### Multi-move batch
- `generate_batch_commentary(moves: Vec<BatchInput>) → Vec<CommentaryResult>`: chiama l'LLM in loop seriale per ogni mossa.

## Subtask C — Comandi Tauri

```rust
#[tauri::command]
async fn generate_commentary(
    state: State<'_, AppState>,
    fen: String,
    played_san: String,
    played_by: String,
    eval_cp: Option<i32>,
    eval_mate: Option<i32>,
    eval_depth: u32,
    best_move_uci: Option<String>,
) -> Result<CommentaryResult, String>;
```

```rust
#[tauri::command]
async fn generate_batch_commentary(
    state: State<'_, AppState>,
    moves: Vec<BatchMoveInput>,
) -> Result<Vec<CommentaryResult>, String>;
```

## Subtask D — Download modello on-demand ❌ Rimosso

Il modello Qwen3 4B è distribuito con licenza Apache-2.0. Il file `.gguf`
(Q4_K_M, ~2.4 GB) è incluso nel repository via Git LFS (`models/*.gguf`).

## Subtask E — Frontend: `explainService.ts`

### Branching
```ts
export async function explainMove(input: MoveExplanationInput): Promise<MoveExplanation> {
  if (isTauri() && await isLlmReady()) {
    return explainMoveNative(input);
  }
  return explainMoveRuleBased(input);
}
```

- `isLlmReady()`: chiama un comando Tauri `llm_status` che restituisce
  `{ ready: boolean, model_available: boolean, downloading: boolean }`.
- `explainMoveNative()`: chiama `invoke("generate_commentary", ...)` e converte
  `CommentaryResult` in `MoveExplanation`.
- `explainMoveRuleBased()`: codice esistente, invariato.

### Conversione `CommentaryResult` → `MoveExplanation`
- `summary` → `MoveExplanation.summary`
- `details` → `MoveExplanation.details` (split per newline o singolo elemento)
- `severity` → mappato da stringa a `Severity`
- `tactics` → array vuoto (l'LLM non rileva pattern strutturati)
- `stockfishExplains` → `null` (l'LLM include già la spiegazione nel details)

## File

| File | Azione |
|------|--------|
| `src-tauri/src/llm.rs` | **Nuovo** — LLM wrapper (llama-cpp-2) |
| `src-tauri/src/commentary.rs` | **Nuovo** — orchestratore prompt |
| `src-tauri/src/commands.rs` | **Modifica** — aggiungi comandi LLM |
| `src-tauri/src/lib.rs` | **Modifica** — init LLM + download modello |
| `src-tauri/Cargo.toml` | **Modifica** — llama-cpp-2, reqwest |
| `src/services/explainService.ts` | **Modifica** — branch nativo/rule-based |

### File NON modificati
- `src/types/index.ts` — `MoveExplanation` invariato
- `src/pages/LessonDetailPage.tsx` — invariato
- `src/services/analysisService.ts` — invariato
- `public/stockfish/*` — invariato

## Definition of done
- `cargo build` in `src-tauri/` passa senza errori
- `npm run build` (`tsc -b && vite build`) passa
- Modello `.gguf` incluso nel repo via Git LFS (download on-demand rimosso: richiede auth)
- Comando `generate_commentary` produce commenti in italiano
- Fallback a `explainService.ts` se modello non disponibile
- Interfaccia `MoveExplanation` invariata
