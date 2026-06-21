# FEAT-003: Layout lezione a 3 colonne

## Obiettivo
Unificare la vista lezione (`LessonDetailPage`) e la vista scacchiera (`BoardPage`)
in un'unica pagina con layout a 3 colonne: lista scacchiere a sinistra, scacchiera
selezionata (con sezione note) al centro, mosse della scacchiera selezionata a destra.

## Modello dati

Aggiunta del campo note a livello di `Board`:

```ts
interface Board {
  id?: number;
  lessonId: number;
  title: string;
  fen: string;
  notes: string;   // NUOVO — note libere per scacchiera (default "")
  order: number;
  createdAt: Date;
}
```

- Bump versione Dexie: `db.version(2)` (campo opzionale, Dexie non richiede migrazione
  esplicita; le righe esistenti leggono `notes` come `undefined`, gestito con `?? ""`).
- `updateBoard` esteso per accettare `notes` in `Partial<Pick<Board, "title" | "fen" | "notes">>`.
- `createBoard` inizializza `notes: ""`.

## Layout (LessonDetailPage, unificata)

```
┌─────────────────────────────────────────────────────────────┐
│ [← Lezioni]  Titolo lezione              [Modifica][Elimina] │
├──────────┬───────────────────────────────┬───────────────────┤
│ Sidebar  │ Scacchiera selezionata        │ Mosse             │
│ board    │ (560px)                       │ (MoveNotation)    │
│ list +   │                               │                   │
│ "Nuova"  ├───────────────────────────────┤                   │
│          │ Note (Textarea, autosave)     │                   │
└──────────┴───────────────────────────────┴───────────────────┘
```

- Larghezze: sidebar ~220px, colonna mosse ~256px, centro fluido.
- Responsive: su mobile (< lg) le colonne si impilano
  (scacchiere → scacchiera → note → mosse).

## Comportamento

- Stato locale `selectedBoardId`. Al caricamento, se ci sono board, viene selezionata
  la prima. "Nuova scacchiera" la crea e la seleziona.
- `useChessBoard` sollevato in `LessonDetailPage`. Al cambio board selezionata,
  `setPosition(board.fen)` inizializza l'hook (stesso pattern dell'attuale `BoardPage`
  con `initializedRef`).
- Selezionare un'altra board senza aver salvato: le note sono autosave (blur + debounce),
  quindi la selezione non perde dati.
- Eliminazione board inline (icona nella sidebar); se la board eliminata era selezionata,
  viene selezionata la prima disponibile (o nessuna).

## Note autosave
- `<Textarea controlled>` con stato locale `notesDraft`.
- Sync su selezione board; salvataggio DB su `onBlur` e tramite debounce 800ms.
- Salvataggio con `updateBoard(boardId, { notes })`.

## Routing
- Route `/lesson/:id` → `LessonDetailPage` (unificata).
- Route `/lesson/:id/board/:boardId` **rimossa**. `BoardPage.tsx` eliminato.
  (Nessun link esterno noto; è un'app locale.)

## File modificati

| File | Azione |
|------|--------|
| `src/types/index.ts` | Modifica — aggiunto `notes` a `Board` |
| `src/db/database.ts` | Modifica — `db.version(2)` |
| `src/services/boardService.ts` | Modifica — `createBoard`/`updateBoard` gestiscono `notes` |
| `src/pages/LessonDetailPage.tsx` | Modifica — layout 3 colonne, sidebar, note, mosse |
| `src/pages/BoardPage.tsx` | Eliminato |
| `src/App.tsx` | Modifica — rimossa route board |

## Out of scope (tech debt da tracciare)
- FEN non persistito dopo le mosse; mosse non salvate nella tabella `moves`.
  Sarà tracciato in `docs/tech-debt/`.
- Nessun test (nessun framework configurato — vedi AGENTS.md).
