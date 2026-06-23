# PGN Import → una lezione per partita

## Obiettivo
Cambiare la semantica dell'import PGN dalla home page: ogni PGN importato
diventa una lezione `analysis` autonoma con una singola scacchiera, invece di
essere accumulato come board aggiuntiva in un contenitore "analisi" cumulativo.

Le lezioni `study` esistenti mantengono il comportamento corrente: è possibile
creare più scacchiere manualmente e importare PGN come board aggiuntive nella
stessa lezione.

## Decisioni
- **Titolo lezione analysis**: derivato dagli header PGN (`White vs Black` +
  eventuale Elo e risultato) tramite la funzione `deriveTitle` esistente in
  `pgnService.ts`. Fallback `"Partita importata"`.
- **Niente riuso contenitore**: rimosso il branch che cercava una lezione
  `mode === "analysis"` esistente in `ImportPgnDialog` e `LessonsPage`.
- **Sidebar analysis**: in `LessonDetailPage` l'intera sidebar scacchiere
  (colonna sinistra `<aside>`) è nascosta quando `lesson.mode === "analysis"`,
  non solo i bottoni "Importa PGN" e "Nuova scacchiera". La lezione analysis
  contiene una sola scacchiera → nessuna necessità di elenco/scelta.
- **Migrazione DB v6**: le lezioni `analysis` esistenti (contenitori cumulativi
  con più board) vengono eliminate insieme alle relative board e move.
  Demo-only: i dati analysis precedenti non sono portati avanti. Le lezioni
  `study` esistenti sono preservate.

## Modifiche
| File | Azione |
|------|--------|
| `src/services/pgnService.ts` | `importPgnAsLesson` usa `parsed.title` invece di hardcoded `"analisi"` |
| `src/components/board/ImportPgnDialog.tsx` | Rimosso branch riuso analysis lesson + prop `mode` inutile + import `getAllLessons` |
| `src/pages/LessonsPage.tsx` | `handlePgnImported` naviga direttamente al nuovo `lessonId`; rimosso `mode="analysis"` prop |
| `src/pages/LessonDetailPage.tsx` | Sidebar scacchiere (colonna sinistra) nascosta interamente in `analysis` mode |
| `src/db/database.ts` | `db.version(6)` con migrazione che elimina analysis lessons + boards + moves correlate |

## Out of scope
- Rinomina manuale del titolo lezione analysis (l'utente può usare il flusso
  "Modifica" esistente su qualsiasi lezione).
- Conversione/split di analysis lessons esistenti in lezioni separate (scelto:
  eliminazione, dato contesto demo).

## Definition of done
- `npm run build` verde.
- Import PGN da home page crea una nuova lezione analysis autonoma per ogni
  import; il titolo è derivato dagli header PGN.
- Sidebar scacchiere non visibile in una lezione analysis (una sola board,
  selezione non necessaria).
- Al primo avvio con DB v5, la migrazione v6 elimina le vecchie analysis
  lessons e relative board/move.
