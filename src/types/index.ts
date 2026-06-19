export interface Lesson {
  id?: number;
  title: string;
  description: string;
  createdAt: Date;
}

export interface Board {
  id?: number;
  lessonId: number;
  title: string;
  fen: string;
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
  createdAt: Date;
}

export type LessonFormData = Pick<Lesson, "title" | "description">;
