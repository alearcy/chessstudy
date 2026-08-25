# Chessstudy App - Piano di Sviluppo

## Panoramica
App locale per studiare gli scacchi. Permette di creare lezioni, ognuna con più scacchiere. Ogni scacchiera ha una serie di mosse con varianti e commenti. Export PGN e backup/import JSON.

## Tech Stack

| Layer | Scelta | Motivazione |
|-------|--------|-------------|
| **Frontend** | React + TypeScript + Vite | Veloce, moderno, ottimo DX |
| **Chess Logic** | `chess.js` | Gestisce regole, FEN, validazione mosse, PGN |
| **Board UI** | `react-chessboard` | Board interattiva, drag & drop + click-to-move |
| **Database** | `dexie.js` (wrapper IndexedDB) | Zero server, tutto nel browser, perfetto per futuro Tauri/Electron |
| **Routing** | React Router v6 | Navigazione tra lezioni/board |
| **Styling** | Tailwind CSS + Shadcn/ui | Componenti pronti, belli, accessibili |

## Modello Dati

```
Lesson
  ├── id: string (auto)
  ├── title: string
  ├── description: string
  └── createdAt: Date

Board
  ├── id: string (auto)
  ├── lessonId: string (FK → Lesson)
  ├── title: string
  ├── fen: string (posizione iniziale, default startpos)
  ├── order: number
  └── createdAt: Date

Move (struttura ad albero per varianti)
  ├── id: string (auto)
  ├── boardId: string (FK → Board)
  ├── moveNotation: string (es. "e4")
  ├── fen: string (posizione dopo la mossa)
  ├── parentId: string | null (null = root, altrimenti FK → Move)
  ├── order: number
  ├── comment: string
  └── createdAt: Date
```

Le varianti sono gestite con `parentId`: una mossa con più figli = bivio (variante).

## Struttura Cartelle

```
src/
├── db/
│   └── database.ts          # Schema e operazioni Dexie
├── services/
│   ├── lessonService.ts     # CRUD lezioni
│   ├── boardService.ts      # CRUD board
│   ├── moveService.ts       # CRUD mosse + gestione albero
│   ├── pgnService.ts        # Export PGN con varianti
│   └── backupService.ts     # Export/import JSON
├── components/
│   ├── ui/                  # Componenti Shadcn/ui
│   ├── layout/
│   │   ├── AppLayout.tsx    # Layout principale
│   │   └── Sidebar.tsx      # Lista lezioni + CRUD
│   ├── lesson/
│   │   ├── LessonDetail.tsx
│   │   ├── LessonForm.tsx   # Dialog creazione/modifica
│   │   └── BoardList.tsx    # Lista board nella lezione
│   ├── board/
│   │   ├── BoardEditor.tsx  # Container principale board
│   │   ├── ChessBoard.tsx   # Wrapper react-chessboard
│   │   ├── MoveTree.tsx     # Albero mosse + varianti
│   │   ├── MoveNode.tsx     # Singolo nodo mossa
│   │   └── MoveComment.tsx  # Editor commento
│   └── toolbar/
│       └── Toolbar.tsx      # Pulsanti backup/import/export PGN
├── hooks/
│   ├── useDatabase.ts
│   └── useChessBoard.ts
├── types/
│   └── index.ts             # TypeScript interfaces
├── pages/
│   ├── LessonsPage.tsx
│   ├── LessonDetailPage.tsx
│   └── BoardPage.tsx
├── App.tsx
└── main.tsx
```

## Routing

| Path | Componente | Descrizione |
|------|-----------|-------------|
| `/` | `LessonsPage` | Lista lezioni |
| `/lesson/:id` | `LessonDetailPage` | Dettaglio lezione + board |
| `/lesson/:id/board/:boardId` | `BoardPage` | Editor scacchiera |

## Funzionalità

### Scacchiera
- Drag & drop e click-to-move (entrambi supportati da react-chessboard)
- Navigazione avanti/indietro tra mosse (← → tasti o pulsanti)
- Posizione iniziale personalizzabile (FEN)

### Varianti
- Ogni mossa può avere varianti (rami alternativi)
- Visualizzazione ad albero con varianti collassabili/espandibili
- Navigazione tra rami (click su variante per seguirla)

### Commenti
- Commento testuale associato a ogni mossa
- Editor inline (textarea o input)

### Export/Import
- **Export PGN**: singola board o intera lezione (con varianti in notazione PGN)
- **Backup JSON**: esporta tutto il database in un file JSON
- **Import JSON**: ripristina il database da un backup

## Seed Iniziale
1 lezione demo + 1 board + alcune mosse per testare il funzionamento.

## Dipendenze

```json
{
  "dependencies": {
    "react": "^18.x",
    "react-dom": "^18.x",
    "react-router-dom": "^6.x",
    "chess.js": "^1.x",
    "react-chessboard": "^4.x",
    "dexie": "^4.x",
    "react-hot-toast": "^2.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "vite": "^5.x",
    "@vitejs/plugin-react": "^4.x",
    "tailwindcss": "^3.x",
    "postcss": "^8.x",
    "autoprefixer": "^10.x",
    "@types/react": "^18.x",
    "@types/react-dom": "^18.x",
    "tailwindcss-animate": "^1.x",
    "class-variance-authority": "^0.7.x",
    "clsx": "^2.x",
    "lucide-react": "^0.x",
    "tailwind-merge": "^2.x"
  }
}
```

## Note
- Shadcn/ui richiede configurazione manuale (`components.json`, `utils/cn.ts`, variabili CSS)
- Per il futuro multi-piattaforma: wrappare con Tauri (desktop) o Capacitor (mobile)
- IndexedDB persiste automaticamente nel browser
