# OpenRouter LLM (sostituzione llama.cpp/Gemma)

## Obiettivo
Sostituire LLM locale (llama-cpp-2 + Gemma 4) con chiamate OpenAI-compatible verso OpenRouter, gestite da Tauri backend. Aggiungere finestra settings per API key, inibire toggle AI se key non configurata.

## Architettura

### Backend (Rust)
- **HTTP client**: `reqwest` 0.12 con rustls-tls
- **Endpoint**: `POST https://openrouter.ai/api/v1/chat/completions`
  - Header: `Authorization: Bearer <api_key>`, `Content-Type: application/json`
  - Body: `{ model, messages: [{role: "system", content}, {role: "user", content}], max_tokens, temperature }`
- **Modello default**: `openai/gpt-4o-mini` (configurabile nei settings)
- **Settings storage**: file JSON `settings.json` in `app_data_dir()` — letto a startup, salvato a ogni modifica
  - `api_key: Option<String>`, `model: Option<String>`
- **Comandi Tauri**:
  - `set_settings(args: {api_key, model})` → salva e restituisce stato
  - `get_settings() -> { api_key_configured: bool, model: String }`
  - `clear_api_key()` → rimuove solo la key
  - `llm_status() -> { ready: bool, model_available: bool }` → ready = key presente
  - `generate_commentary(args)` → invocazione OpenRouter, restituisce `CommentaryResult`
  - `generate_batch_commentary(args)` → loop per-mossa

### Frontend
- **SettingsDialog**: dialog modale con input password API key, input model, stato visivo "Configurato/Non configurato", pulsanti Salva/Cancella
- **Toggle AI**: inibito (`disabled`) quando API key non configurata, tooltip "Configura API key nelle Impostazioni"
- **Header App**: icona ingranaggio per aprire SettingsDialog

### Rimozioni
- `llama-cpp-2`, features `cuda`/`metal`
- `LlmEngine`, `resolve_model_path`
- `models/` directory references
- `LLM_MODEL_PATH` env var

### Flusso
1. Utente apre Impostazioni (icona ingranaggio in header)
2. Inserisce API key OpenRouter + modello opzionale (default `openai/gpt-4o-mini`)
3. Salva → Tauri persiste, `llm_status.ready = true`
4. Toggle AI diventa attivo → utente può attivare commenti AI
5. `explainService.explainMove()` chiama `generate_commentary` via invoke Tauri → OpenRouter → risposta → `CommentaryResult`

### Dipendenze da task futuri
- Task "Riassunto AI" (50 parole): userà stesso endpoint OpenRouter, dipende da settings configurati.