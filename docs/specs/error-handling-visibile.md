# Error handling visibile per operazioni critiche

## Obiettivo

Mostrare errori recuperabili in UI per operazioni critiche che oggi falliscono
solo in console o lasciano l'utente senza feedback.

## Ambito

- Caricamento, creazione, modifica ed eliminazione lezioni.
- Caricamento e modifica scacchiere.
- Salvataggio note scacchiera e commenti mossa.
- Persistenza mosse e annotazioni.
- Analisi Stockfish.
- Analisi AI partita.

## Comportamento

- Gli errori sono visualizzati con un banner contestuale.
- Dove l'azione e ripetibile senza ambiguita, il banner mostra `Riprova`.
- Gli errori non bloccanti rimangono locali al contesto interessato.
- Le azioni gia gestite, come import PGN, continuano a usare il loro messaggio
  esistente.

## Implementazione

- Nuovo componente riusabile `ErrorNotice`.
- `LessonsPage` mantiene un errore pagina e passa errori dei dialog al form.
- `LessonDetailPage` mantiene errori per caricamento pagina, salvataggi,
  annotazioni, analisi Stockfish e AI.
- I catch continuano a loggare dettagli tecnici in console, ma mostrano un
  messaggio italiano sintetico all'utente.

## Verifica

- `npm run build` deve passare.
- Non viene introdotto un framework test: il task dedicato ai test minimi e
  ancora pendente.
