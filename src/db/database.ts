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

db.version(2).stores({
  lessons: "++id, title, createdAt",
  boards: "++id, lessonId, createdAt",
  moves: "++id, boardId, parentId, order, createdAt",
});

// v3: aggiunta campi eval (evalCp/evalMate/evalDepth/evalBestMoveUci) su Board e
// Move. Sono campi NON indicizzati → gli store restano identici, ma si bumpa
// la versione per documentare l'evoluzione dello schema (FEAT-004).
db.version(3).stores({
  lessons: "++id, title, createdAt",
  boards: "++id, lessonId, createdAt",
  moves: "++id, boardId, parentId, order, createdAt",
});

export default db;
