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

// v4: aggiunta campi whiteName/blackName su Board (nomi giocatori da header PGN).
// Campi NON indicizzati → store invariato; bump di versione a documentazione.
db.version(4).stores({
  lessons: "++id, title, createdAt",
  boards: "++id, lessonId, createdAt",
  moves: "++id, boardId, parentId, order, createdAt",
});

// v5: aggiunto campo mode su Lesson ("study" | "analysis").
// Lezioni esistenti → "study" di default.
db.version(5).stores({
  lessons: "++id, title, mode, createdAt",
  boards: "++id, lessonId, createdAt",
  moves: "++id, boardId, parentId, order, createdAt",
}).upgrade((tx) => {
  return tx.table("lessons").toCollection().modify((lesson) => {
    if (!lesson.mode) lesson.mode = "study";
  });
});

// v6: cambio semantica — ogni PGN importato è una lezione analysis autonoma
// (nessun contenitore cumulativo). Le vecchie lezioni analysis (che
// accumulavano più board) vengono eliminate con le relative board.
// Demo-only: dati analysis precedenti non portati avanti.
db.version(6).stores({
  lessons: "++id, title, mode, createdAt",
  boards: "++id, lessonId, createdAt",
  moves: "++id, boardId, parentId, order, createdAt",
}).upgrade(async (tx) => {
  const analysisLessonIds = await tx.table("lessons")
    .where("mode").equals("analysis")
    .primaryKeys();
  if (analysisLessonIds.length === 0) return;
  const boardIds = await tx.table("boards")
    .where("lessonId").anyOf(analysisLessonIds)
    .primaryKeys();
  if (boardIds.length > 0) {
    await tx.table("moves").where("boardId").anyOf(boardIds).delete();
    await tx.table("boards").bulkDelete(boardIds);
  }
  await tx.table("lessons").bulkDelete(analysisLessonIds);
});

// v7: aggiunto campo `headers` su Board (header PGN strutturati come JSON).
// Campo NON indicizzato → store invariato; bump di versione a documentazione.
db.version(7).stores({
  lessons: "++id, title, mode, createdAt",
  boards: "++id, lessonId, createdAt",
  moves: "++id, boardId, parentId, order, createdAt",
});

// v8: aggiunto campo gameAnalysis su Board (analisi partita AI).
// Campo NON indicizzato → store invariato; bump di versione a documentazione.
db.version(8).stores({
  lessons: "++id, title, mode, createdAt",
  boards: "++id, lessonId, createdAt",
  moves: "++id, boardId, parentId, order, createdAt",
});

// v9: aggiunto campo aiComment su Move (commento AI momento chiave).
// Campo NON indicizzato → store invariato; bump di versione a documentazione.
db.version(9).stores({
  lessons: "++id, title, mode, createdAt",
  boards: "++id, lessonId, createdAt",
  moves: "++id, boardId, parentId, order, createdAt",
});

export default db;
