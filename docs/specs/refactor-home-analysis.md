# Refactor: Home page + Modalità Analisi vs Studio

## Obiettivo
Trasformare la home page per offrire due percorsi distinti:
- **Importa PGN** → crea lezione con scacchiera popolata → entra in **modalità Analisi**
- **Nuova lezione** → crea lezione vuota → entra in **modalità Studio**

In modalità Analisi: Stockfish auto-analizza all'ingresso, LLM è un toggle on/off
con loader full-page, frecce best-move mostrano la mossa suggerita al giocatore
che ha mosso (non la risposta dell'avversario).

## Subtask A — Modello dati: campo `mode` su Lesson

```ts
export interface Lesson {
  // ... campi esistenti ...
  mode: "study" | "analysis";
}
```

- Dexie: `version(2).stores()` — aggiungi `mode` con default `"study"`
- `createLesson` accetta `mode` opzionale (default `"study"`)
- `pgnService.importPgnToLesson` già crea una lesson e poi board; va modificato
  per accettare e passare `mode: "analysis"`

## Subtask B — Home page (`LessonsPage`): due entry point

### UI
- Card centrale con due grandi pulsanti:
  - **"Importa un PGN"** — icona `Upload`, apre direttamente `ImportPgnDialog`
  - **"Nuova lezione"** — icona `Plus`, apre il dialog titolo/descrizione esistente
- La lista lezioni esistenti rimane sotto, come ora
- Il dialog di creazione lezione aggiunge un `mode: "study"`

### `ImportPgnDialog` modificato
- Aggiungere prop `mode?: "study" | "analysis"` (default `"analysis"`)
- Passare `mode` a `importPgnToLesson` che lo propaga alla Lesson creata
- Il dialog è riutilizzato sia dalla home (modalità analisi) sia dalla sidebar
  della lezione (dove resterà `"study"` o potrà diventare parametrizzabile)

## Subtask C — `LessonDetailPage`: modalità Analysis

### Auto-analisi Stockfish all'ingresso
```ts
useEffect(() => {
  if (lesson?.mode === "analysis" && selectedBoard && chess.moves.length > 0) {
    handleAnalyze(); // già esistente
  }
}, [lesson?.mode, selectedBoard?.id]);
```
- L'analisi parte automaticamente al mount, senza cliccare l'icona Brain
- La progress bar esistente mostra l'avanzamento

### AI Toggle (LLM on/off)
- Nuovo stato `aiEnabled: boolean` (default `false` in modalità analysis)
- Nuovo bottone nella toolbar della scacchiera: icona `Sparkles`, toggle on/off
- Visibile solo se `mode === "analysis"` e `llmAvailable === true`
- Quando attivato, dopo l'analisi Stockfish, genera commenti LLM per ogni mossa

### Loader full-page AI
- Quando AI è attiva e i commenti LLM sono in generazione:
  - Overlay full-page (posizione fissa, z-50, sfondo semi-trasparente)
  - Spinner + testo "L'AI sta analizzando la partita..."
  - Blocca l'interazione con la pagina
- L'overlay si chiude quando tutti i commenti sono stati generati
- Gestione stato: `aiLoading: boolean`

### Frecce best-move invertite (Analisi)
In modalità Analisi, quando si visualizza la mossa N (historyIndex > 0):
- La freccia blu deve mostrare la best move dalla posizione **PRIMA** della mossa
  corrente (cioè cosa suggeriva Stockfish al giocatore che ha mosso)
- Non la best move per il lato al tratto nella posizione corrente

Esempio: `1. e4 e5 2. Nf3` — quando visualizzo `Nf3`, la freccia mostra la
best move dalla posizione dopo `e5` (cosa avrebbe dovuto giocare il Bianco).
Attualmente mostra la best move dalla posizione dopo `Nf3` (cosa dovrebbe
giocare il Nero in risposta).

Implementazione:
```ts
const analysisArrow: BoardArrow[] = (() => {
  if (lesson?.mode === "analysis" && chess.historyIndex > 0) {
    // In analisi: best move della posizione PRECEDENTE
    const prevIdx = chess.historyIndex - 1;
    const prevMove = prevIdx === 0 ? null : chess.moves[prevIdx - 1];
    const prevEval = prevIdx === 0
      ? selectedBoard
      : prevMove;
    const uci = prevEval?.evalBestMoveUci ?? null;
    // ...
  } else {
    // Studio (o posizione iniziale): best move della posizione corrente
    const uci = currentBestMoveUci;
    // ...
  }
})();
```

## Subtask D — `ChessBoard`: UI toggle AI + loader

### Nuove props
```ts
interface ChessBoardViewProps {
  // ... esistenti ...
  /** Modalità lezione (per decidere quali controlli mostrare). */
  lessonMode?: "study" | "analysis";
  /** Toggle AI (LLM) — solo in modalità analysis. */
  aiEnabled?: boolean;
  onAiToggle?: () => void;
  aiLoading?: boolean;
  llmAvailable?: boolean;
}
```

### Toolbar modifiche
- In modalità "analysis": aggiungere bottone Sparkles per toggle AI
- Quando `aiLoading`: disabilitare il bottone, mostrare animazione pulse

### Loader full-page
```tsx
{aiLoading && (
  <div className="fixed inset-0 z-50 bg-background/80 flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="size-8 animate-spin text-primary" />
      <p className="text-lg font-medium">L'AI sta analizzando la partita...</p>
      <p className="text-sm text-muted-foreground">
        Generazione commenti didattici in corso
      </p>
    </div>
  </div>
)}
```

## Subtask E — Studio Mode: Stockfish toggle

In modalità Studio:
- L'icona Brain funziona come ora (analisi manuale)
- Nessun toggle AI visibile
- Le frecce best-move mostrano il comportamento attuale (risposta)
- Nessuna auto-analisi

Opzionale (futuro): toggle Stockfish per attivare/disattivare i suggerimenti in
tempo reale durante lo studio libero. Per ora basta il comportamento attuale.

## File

| File | Azione |
|------|--------|
| `src/types/index.ts` | Aggiungere `mode` a `Lesson` |
| `src/db/database.ts` | Dexie v2 upgrade, aggiungere `mode` |
| `src/services/lessonService.ts` | `createLesson` accetta `mode` |
| `src/services/pgnService.ts` | `importPgnToLesson` propaga `mode` |
| `src/pages/LessonsPage.tsx` | Refactor: due entry point, integra `ImportPgnDialog` |
| `src/pages/LessonDetailPage.tsx` | Auto-analisi, AI toggle, frecce invertite, loader |
| `src/components/board/ChessBoard.tsx` | Nuove props: `lessonMode`, `aiEnabled`, `onAiToggle`, `aiLoading` |
| `src/components/board/ImportPgnDialog.tsx` | Accetta prop `mode` |

### File NON modificati
- `src/services/analysisService.ts`
- `src/services/explainService.ts`
- `src/services/moveService.ts`
- `src/services/boardService.ts`
- `src/hooks/useChessBoard.ts`

## Definition of done
- `npm run build` passa
- Home page mostra i due pulsanti "Importa PGN" e "Nuova lezione"
- Import PGN da home → crea lezione in modalità Analysis → auto-analisi all'ingresso
- Nuova lezione da home → crea lezione in modalità Studio → comportamento attuale
- In modalità Analysis: toggle AI visibile, loader full-page durante generazione LLM
- In modalità Analysis: frecce best-move mostrano il suggerimento al giocatore che ha mosso
- In modalità Studio: nessun toggle AI, comportamento attuale invariato
