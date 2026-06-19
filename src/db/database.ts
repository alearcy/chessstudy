import Dexie, { type EntityTable } from "dexie";
import type { Lesson, Board, Move } from "@/types";

const db = new Dexie("ChessStudyDB") as Dexie & {
  lessons: EntityTable<Lesson, "id">;
  boards: EntityTable<Board, "id">;
  moves: EntityTable<Move, "id">;
};

db.version(1).stores({
  lessons: "++id, title, createdAt",
  boards: "++id, lessonId, createdAt",
  moves: "++id, boardId, parentId, order, createdAt",
});

export default db;
