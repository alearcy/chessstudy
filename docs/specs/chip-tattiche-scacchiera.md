# UI-011: Chip interattive per le tattiche

## Obiettivo

Rendere leggibili le tattiche individuate nei commenti educativi mostrando una
chip per ciascun pattern e una sola evidenziazione colorata alla volta sulla
scacchiera di Analisi.

## Decisioni

- Le tattiche sono persistite come dati strutturati in `Move.tactics`, separati
  dalle annotazioni manuali `highlights`.
- In Analisi nessuna tattica e selezionata inizialmente. Il clic su una chip
  mostra soltanto le case di quel pattern; il clic su un'altra chip sostituisce
  l'overlay e un secondo clic sulla chip attiva lo rimuove.
- Le chip usano nomi italiani, colori distinti e `aria-pressed`. Il colore non
  e l'unico indicatore dello stato attivo.
- Ogni chip viene renderizzata nello stesso flusso inline della relativa
  spiegazione, nel formato `chip: descrizione`; il nome del pattern non viene
  ripetuto nel testo e non esiste una fila separata di chip sotto al commento.
- L'overlay tattico e temporaneo e read-only nel layer `autoShapes` di
  Chessground; non viene inviato al callback delle annotazioni.
- Le analisi precedenti, che non hanno `Move.tactics`, ricostruiscono i pattern
  da FEN, mossa ed evaluation gia persistite senza rieseguire Stockfish.
- I vecchi cerchi gialli memorizzati in `Move.highlights` non vengono mostrati
  in Analisi. Le annotazioni delle scacchiere di Studio restano invariate.

## Persistenza

- Nuova colonna `public.moves.tactics jsonb not null default '[]'`, vincolata a
  contenere un array.
- Mapper e repository validano il payload e usano `[]` per dati assenti o non
  validi.
- Le RPC che salvano o importano mosse mantengono il campo. La conversione da
  Analisi a Studio continua intenzionalmente a copiare soltanto la linea di
  mosse.
- Il backup versione 1 esporta `tactics` e continua ad accettare backup storici
  che non lo contengono.

## Palette

Ordine deterministico per mossa: sky `#0284c7`, fuchsia `#c026d3`, orange
`#ea580c`, emerald `#059669`, violet `#7c3aed`, rose `#e11d48`, amber
`#d97706`, teal `#0d9488`.

## Test e verifica

- Test componenti per selezione, sostituzione, deselezione, reset e
  accessibilita delle chip.
- Test Chessground per garantire che l'overlay usi `autoShapes` e non il layer
  persistito.
- Test del resolver legacy, dei mapper Supabase, del backup e della migrazione.
- `npm test`, `npm run lint`, `npm run build`, `git diff --check`.
- Applicazione della migrazione remota, advisor e verifica autenticata di
  lettura/scrittura.
