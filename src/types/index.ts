export interface LocalProfile {
  id?: number;
  uid: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Lesson {
  id?: number;
  uid?: string;
  profileId?: number;
  title: string;
  description: string;
  mode: "study" | "analysis";
  isFavorite?: boolean;
  searchTerms?: string[];
  createdAt: Date;
  updatedAt?: Date;
}

export interface OpeningReference {
  eco: string;
  name: string;
  family: string;
  pgn: string;
}

export interface OpeningReport {
  whitePlayed: OpeningReference | null;
  blackPlayed: OpeningReference | null;
  whiteSuggested: OpeningReference | null;
  blackSuggested: OpeningReference | null;
}

/** Freccia disegnata sulla scacchiera: [da, a, colore?]. */
export type BoardArrow = [string, string, string?];

/**
 * Casa evidenziata. Le stringhe sono il formato storico (colore giallo),
 * mentre la tupla conserva il colore scelto con i modificatori.
 */
export type BoardHighlight = string | [string, string?];

/** Valutazione Stockfish di una posizione (POV Bianco). */
export interface EvalFields {
  /** Centesimi di pedone, POV Bianco (null se mate o non disponibile). */
  evalCp: number | null;
  /** Mosse a mate, POV Bianco (+ il Bianco matta, - il Bianco viene mattato). */
  evalMate: number | null;
  /** Profondità raggiunta. */
  evalDepth: number;
  /** Miglior mossa UCI (es. "e2e4"), null se posizione terminale. */
  evalBestMoveUci: string | null;
}

export interface Board {
  id?: number;
  uid?: string;
  lessonId: number;
  title: string;
  fen: string;
  notes: string;
  /** Frecce della posizione di partenza. */
  arrows: BoardArrow[];
  /** Evidenziazioni della posizione di partenza. */
  highlights: BoardHighlight[];
  order: number;
  createdAt: Date;
  updatedAt?: Date;
  /** Valutazione Stockfish della posizione di partenza (null se non analizzata). */
  evalCp?: number | null;
  evalMate?: number | null;
  evalDepth?: number;
  evalBestMoveUci?: string | null;
  /** Nome del giocatore Bianco (da header PGN [White]); null se assente. */
  whiteName?: string | null;
  /** Nome del giocatore Nero (da header PGN [Black]); null se assente. */
  blackName?: string | null;
  /** Header PGN completi (per visualizzazione strutturata in analisi). */
  headers?: Record<string, string | null>;
  /** Analisi testuale dell'intera partita. */
  gameAnalysis?: string;
  /** Aperture riconosciute durante l'analisi della partita. */
  openingReport?: OpeningReport;
  /** Metadati presenti sulle scacchiere create dal libro aperture. */
  openingEco?: string;
  openingName?: string;
  openingFamily?: string;
}

export interface Move {
  id?: number;
  uid?: string;
  boardId: number;
  moveNotation: string;
  fen: string;
  parentId: number | null;
  order: number;
  comment: string;
  /** Commento educativo deterministico, separato da Stockfish e dalle note utente. */
  analysisComment?: string | null;
  /** Commento deterministico generato dai dati Stockfish della mossa. */
  stockfishComment?: string | null;
  /** Frecce disegnate su questa posizione. */
  arrows: BoardArrow[];
  /** Case evidenziate su questa posizione. */
  highlights: BoardHighlight[];
  createdAt: Date;
  updatedAt?: Date;
  /** Valutazione Stockfish della posizione DOPO questa mossa (POV Bianco). */
  evalCp?: number | null;
  evalMate?: number | null;
  evalDepth?: number;
  evalBestMoveUci?: string | null;
}

export type LessonFormData = Pick<Lesson, "title" | "description">;

// ============================================================================
// explainService types (FEAT-005)
// ============================================================================

export interface TacticalPattern {
  type:
    | "fork"
    | "pin_absolute"
    | "pin_relative"
    | "skewer"
    | "discovered_attack"
    | "double_check"
    | "mate_threat"
    | "hanging_piece"
    | "trapped_piece";
  /** Pezzo che esegue il pattern (es. "♞") */
  actor: string;
  /** Pezzo(i) che subiscono il pattern */
  victims: string[];
  /** Case coinvolte */
  squares: string[];
  /** Descrizione breve in italiano */
  description: string;
}

export type Severity = "best" | "good" | "inaccuracy" | "mistake" | "blunder";

export interface MoveExplanationInput {
  /** FEN della posizione PRIMA della mossa (dove valuta Stockfish). */
  beforeFen: string;
  /** FEN della posizione DOPO la mossa. */
  afterFen: string;
  /** Mossa giocata in notazione SAN (es. "Nf6"). */
  playedMoveSan: string;
  /** Chi ha giocato la mossa. */
  playedBy: "w" | "b";
  /** Nome del giocatore Bianco (da PGN), o null se sconosciuto. */
  whiteName?: string | null;
  /** Nome del giocatore Nero (da PGN), o null se sconosciuto. */
  blackName?: string | null;
  /** Eval della posizione PRIMA della mossa (POV Bianco). */
  beforeEval: {
    cp: number | null;
    mate: number | null;
    depth: number;
    bestMoveUci: string | null;
  };
  /** Eval della posizione DOPO la mossa (POV Bianco). */
  afterEval: {
    cp: number | null;
    mate: number | null;
    depth: number;
  };
}

export interface MoveExplanation {
  /** Frase riassuntiva (1-2 righe). */
  summary: string;
  /** Dettagli a punti elenco. */
  details: string[];
  /** Severità della mossa. */
  severity: Severity;
  /** Pattern tattici rilevati nella posizione DOPO la mossa. */
  tactics: TacticalPattern[];
  /** Perché Stockfish preferisce la best move (null se è la stessa mossa). */
  stockfishExplains: string | null;
}
