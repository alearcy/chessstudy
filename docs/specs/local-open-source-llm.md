# LLM locale open source

## Obiettivo
Sostituire OpenRouter con un backend LLM locale configurabile per generare commenti didattici e analisi partita senza API key cloud.

## Decisione
- Usare un server locale compatibile Ollama su `http://localhost:11434`.
- Modello default: `gemma3:4b`.
- Mantenere lo stesso orchestratore `commentary.rs`: prompt, parsing e mapping UI restano invariati.
- Mantenere fallback frontend rule-based quando il server locale non risponde.
- Non reintrodurre `llama-cpp` embedded in questa fase, per evitare modello multi-GB nel repo e complessita build GPU/CPU.

## Backend
- `settings.json` conserva:
  - `llm_base_url`
  - `llm_model`
  - impostazioni Stockfish esistenti
- `llm.rs` invia richieste a:
  - `POST /api/chat` con `stream: false`
  - `GET /api/tags` per lo stato
- `llm_status()` restituisce:
  - `ready`
  - `model_available`
  - `base_url`
  - `model`

## Frontend
- `SettingsDialog` mostra:
  - URL server locale
  - modello
  - stato server locale
  - pulsanti Salva AI e Verifica
- Rimossi campi API key OpenRouter.
- Il toggle AI continua a usare `llm_status()`: se il server locale non e raggiungibile, la generazione AI resta disabilitata o ricade sul commento rule-based.

## Note modello
Gemma e una scelta adatta per commenti scacchistici brevi se riceve valutazioni e mosse gia calcolate da Stockfish. Il modello non deve trovare la tattica da zero: deve trasformare evidenze Stockfish in spiegazione italiana.

## Definition of done
- `npm run build` passa.
- Nessun segreto o API key richiesti.
- Commenti mossa e analisi partita usano LLM locale quando disponibile.
- Fallback rule-based resta operativo.
