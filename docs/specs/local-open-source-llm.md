# LLM locale open source embedded

## Obiettivo
Sostituire OpenRouter con un modello GGUF eseguito direttamente dal backend Rust/Tauri, senza API key cloud e senza servizi separati come Ollama.

## Decisione
- Usare `llama-cpp-2` nel backend Rust.
- Caricare il modello da `src-tauri/models/Qwen3-4B-Q4_K_M.gguf`.
- Includere il GGUF nelle risorse Tauri tramite `tauri.conf.json`.
- Mantenere `commentary.rs` come orchestratore di prompt, parsing e mapping.
- Mantenere il fallback frontend rule-based se `llm_status()` indica modello non disponibile.

## Backend
- `AppState` contiene un `LocalLlmClient` condiviso protetto da `Mutex`.
- `LocalLlmClient` inizializza llama.cpp e carica il GGUF una volta all'avvio.
- Ogni generazione crea un context temporaneo, tokenizza il prompt chat, decodifica il prompt e genera token in-process.
- `LLM_MODEL_PATH` puo sovrascrivere il percorso in sviluppo/debug.
- `settings.json` conserva solo `llm_model_path` per compatibilita e override controllato.
- In debug il resolver preferisce `src-tauri/models/` prima di `resource_dir()` per evitare path fuorvianti sotto `target/debug`.
- In produzione il GGUF viene letto dalle risorse bundle Tauri, cioe da `resource_dir()/models/Qwen3-4B-Q4_K_M.gguf`.

## Frontend
- `SettingsDialog` mostra lo stato del modello GGUF caricato.
- Rimossi URL server, nome modello remoto e pulsante Salva AI.
- Restano configurabili solo profondita e CPU Stockfish.

## Note modello
Qwen3 e adatto per commenti didattici brevi quando riceve dati Stockfish gia calcolati. Il modello non sostituisce Stockfish: trasforma valutazioni, mosse giocate e suggerimenti in spiegazioni italiane.

## Definition of done
- `npm run build` passa.
- `cargo check` passa.
- Nessuna traccia di OpenRouter, API key, Ollama o URL server nel frontend.
- Commenti mossa e analisi partita usano il GGUF embedded quando disponibile.
