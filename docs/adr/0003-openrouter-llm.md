# ADR-0003: Switch da LLM locale a OpenRouter via Tauri

## Stato: Accettato

## Contesto
TAURI-003 ha integrato llama-cpp-2 con modello Gemma 4 locale (GGUF). L'LLM locale richiede:
- ~2-4 GB di modello GGUF scaricato e posizionato dall'utente
- RAM significativa a runtime
- Build complesso con feature `metal`/`cuda`
- Qualità commenti variabile con modello quantizzato Q4_K_S

Si vuole passare a un approccio più leggero e configurabile: chiamate API verso OpenRouter (proxy OpenAI-compatible).

## Decisione
- **Rimuovere** llama-cpp-2 e tutto il runtime locale LLM
- **Aggiungere** `reqwest` per chiamate HTTP a OpenRouter
- **Persistere** API key e modello in `settings.json` via `app_data_dir()`
- **Mantenere** `commentary.rs` invariato (system prompt, parsing) — cambia solo il transport
- **Modello default**: `openai/gpt-4o-mini` (costo ~$0.15/1M token, qualità buona)

## Alternative considerate
- **Mantenere LLM locale + aggiungere OpenRouter come opzione**: complessità doppia, due path di build, due fonti di bug. Rifiutato.
- **Tauri plugin per HTTP (tauri-plugin-http)**: astrazione più pesante, permessi capability complessi. `reqwest` nel backend Rust è più semplice e già community standard.
- **Electron/Node.js**: non compatibile con stack Tauri esistente. Rifiutato.

## Conseguenze
- **Positiva**: app più leggera (nessun modello da scaricare), build semplificato, qualità commenti migliore
- **Negativa**: dipendenza da rete e API key utente, costo per-request (tipicamente <$0.01 per partita media)
- **Neutrale**: settings UI necessaria (nuova componente, ma semplice)