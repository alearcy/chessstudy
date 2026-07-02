# ADR-0004: Switch da OpenRouter a GGUF embedded via Rust

## Stato: Accettato

## Contesto
ADR-0003 ha scelto OpenRouter per ridurre complessita rispetto a `llama-cpp` embedded. Il requisito corrente richiede invece un modello open source locale servito direttamente dall'app, senza API key cloud e senza un servizio esterno come Ollama.

## Decisione
- Sostituire il client OpenRouter con un engine locale basato su `llama-cpp-2`.
- Conservare il modello GGUF nel progetto in `src-tauri/models/`.
- Caricare il GGUF all'avvio del backend Rust/Tauri.
- Includere il modello nelle risorse Tauri.
- Usare `commentary.rs` invariato per prompt, parsing e contratti frontend.
- Esporre `llm_status()` come stato del modello caricato.

## Alternative considerate
- Server locale Ollama-compatible: rifiutato, perche richiede un processo separato fuori dall'app.
- Mantenere OpenRouter opzionale: rifiutato, perche mantiene dipendenza cloud e API key.
- WebLLM/WebGPU: rifiutato, perche sposta carico e instabilita nel webview.

## Conseguenze
- Positiva: inferenza locale in-process, privacy locale, nessuna API key.
- Positiva: packaging Tauri contiene il modello richiesto.
- Negativa: bundle molto piu grande per via del GGUF.
- Negativa: build Rust piu pesante e dipendente da toolchain native llama.cpp.
- Neutrale: Stockfish resta la fonte tattica; il LLM produce la spiegazione didattica.
