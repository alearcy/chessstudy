export interface Lesson {
  id?: number;
  title: string;
  description: string;
  createdAt: Date;
}

/** Freccia disegnata sulla scacchiera: [da, a, colore?]. */
export type BoardArrow = [string, string, string?];

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
}

export type LessonFormData = Pick<Lesson, "title" | "description">;
