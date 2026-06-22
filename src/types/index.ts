export interface Lesson {
  id?: number;
  title: string;
  description: string;
  createdAt: Date;
}

/** Freccia disegnata sulla scacchiera: [da, a, colore?]. */
export type BoardArrow = [string, string, string?];

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
  lessonId: number;
  title: string;
  fen: string;
  notes: string;
  /** Frecce della posizione di partenza. */
  arrows: BoardArrow[];
  /** Evidenziazioni della posizione di partenza. */
  highlights: string[];
  order: number;
  createdAt: Date;
  /** Valutazione Stockfish della posizione di partenza (null se non analizzata). */
  evalCp?: number | null;
  evalMate?: number | null;
  evalDepth?: number;
  evalBestMoveUci?: string | null;
}

export interface Move {
  id?: number;
  boardId: number;
  moveNotation: string;
  fen: string;
  parentId: number | null;
  order: number;
  comment: string;
  /** Frecce disegnate su questa posizione. */
  arrows: BoardArrow[];
  /** Case evidenziate su questa posizione. */
  highlights: string[];
  createdAt: Date;
  /** Valutazione Stockfish della posizione DOPO questa mossa (POV Bianco). */
  evalCp?: number | null;
  evalMate?: number | null;
  evalDepth?: number;
  evalBestMoveUci?: string | null;
}

export type LessonFormData = Pick<Lesson, "title" | "description">;
