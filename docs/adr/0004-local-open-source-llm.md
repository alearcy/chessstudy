# ADR-0004: Switch da OpenRouter a LLM locale open source

## Stato: Accettato

## Contesto
ADR-0003 ha scelto OpenRouter per ridurre complessita rispetto a `llama-cpp` embedded. Il nuovo requisito chiede un modello open source che giri in locale, senza dipendenza cloud e senza API key.

## Decisione
- Sostituire il client OpenRouter con un client LLM locale.
- Usare di default un server locale Ollama-compatible su `http://localhost:11434`.
- Usare `gemma3:4b` come modello default configurabile.
- Salvare `llm_base_url` e `llm_model` in `settings.json`.
- Mantenere `commentary.rs` invariato per prompt, parsing e output.
- Mantenere fallback rule-based se il server locale non e raggiungibile.

## Alternative considerate
- Reintrodurre `llama-cpp` embedded: piu autonomo, ma riapre problemi di build, accelerazione GPU, modello multi-GB e packaging cross-platform.
- Mantenere OpenRouter come opzione: maggiore flessibilita, ma mantiene dipendenza cloud e API key.
- WebLLM/WebGPU: evita backend esterno, ma aumenta rischio browser/webview e prestazioni variabili.

## Conseguenze
- Positiva: zero API key cloud, privacy locale, build Rust semplice.
- Positiva: modello facilmente sostituibile via settings.
- Negativa: l'utente deve avere un server locale LLM avviato e il modello installato.
- Neutrale: Gemma non calcola la parte scacchistica; Stockfish resta fonte tattica, il LLM produce spiegazione didattica.
