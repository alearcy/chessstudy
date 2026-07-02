# Eval bar e commenti didattici

## Obiettivo

Rendere i commenti di analisi piu didattici e meno tecnici:

- non mostrare riferimenti a centipawn o punteggi tipo `+1.5`, `-1`;
- non usare formule come "secondo Stockfish" o "per Stockfish";
- mantenere classificazione della mossa, migliore alternativa e pattern tattici;
- rappresentare il vantaggio con una barra verticale animata stile siti di scacchi.

## Ambito

Il lavoro riguarda la pipeline che produce e visualizza i commenti AI/diagnostici delle mosse in modalita analisi.
Non cambia il motore Stockfish, la profondita di analisi, la persistenza delle mosse o il formato storico delle lezioni.

## Implementazione

- Ripulire prompt, fallback deterministici e rendering UI da riferimenti tecnici a centipawn o valutazioni numeriche.
- Aggiungere un modello dati derivato dalla valutazione interna che esponga solo un vantaggio visuale per il frontend.
- Inserire una barra verticale accanto alla scacchiera/commento di analisi, con animazione CSS quando cambia il vantaggio.
- Usare etichette in italiano comprensibili a principianti, evitando gergo da engine.

## Verifica

- `npm run build`
- Se vengono toccati moduli Rust/Tauri: `cargo check` in `src-tauri/`
