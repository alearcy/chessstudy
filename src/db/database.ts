import Dexie, { type EntityTable, type Transaction } from "dexie";
import { buildLessonSearchTerms, createStableId } from "@/db/recordMetadata";
import type { Lesson, Board, Move, LocalProfile } from "@/types";

type MigrationLesson = Partial<Lesson> & { id?: number };
type MigrationBoard = Partial<Board> & { id?: number; lessonId?: number };
type MigrationMove = Partial<Move> & Record<string, unknown>;

function splitLessonTitle(lesson: MigrationLesson, board: MigrationBoard): string {
  const lessonTitle = lesson.title?.trim() || "Analisi";
  const boardTitle = board.title?.trim();
  return boardTitle && boardTitle !== lessonTitle
    ? `${lessonTitle} - ${boardTitle}`
    : lessonTitle;
}

async function splitCumulativeAnalysisLessons(tx: Transaction): Promise<void> {
  const lessons = tx.table("lessons");
  const boards = tx.table("boards");
  const analysisLessons = (await lessons
    .where("mode")
    .equals("analysis")
    .toArray()) as MigrationLesson[];

  for (const lesson of analysisLessons) {
    if (lesson.id == null) continue;

    const lessonBoards = (await boards
      .where("lessonId")
      .equals(lesson.id)
      .sortBy("order")) as MigrationBoard[];

    if (lessonBoards.length === 0) continue;

    const firstBoard = lessonBoards[0];
    if (firstBoard.id != null && firstBoard.order !== 0) {
      await boards.update(firstBoard.id, { order: 0 });
    }

    for (const board of lessonBoards.slice(1)) {
      if (board.id == null) continue;

      const nextLesson = { ...lesson };
      delete nextLesson.id;
      nextLesson.title = splitLessonTitle(lesson, board);
      nextLesson.mode = "analysis";
      nextLesson.createdAt = board.createdAt ?? lesson.createdAt ?? new Date();

      const newLessonId = (await lessons.add(nextLesson)) as number;
      await boards.update(board.id, { lessonId: newLessonId, order: 0 });
    }
  }
}

async function normalizeLinearMoveParents(tx: Transaction): Promise<void> {
  const movesTable = tx.table("moves");
  const moves = (await movesTable.toArray()) as MigrationMove[];
  const movesByBoard = new Map<number, MigrationMove[]>();

  for (const move of moves) {
    if (move.id == null || move.boardId == null) continue;
    const boardMoves = movesByBoard.get(move.boardId) ?? [];
    boardMoves.push(move);
    movesByBoard.set(move.boardId, boardMoves);
  }

  for (const boardMoves of movesByBoard.values()) {
    boardMoves.sort((left, right) =>
      (left.order ?? 0) - (right.order ?? 0) ||
      (left.id ?? 0) - (right.id ?? 0),
    );
    let parentId: number | null = null;
    for (const move of boardMoves) {
      if (move.id == null) continue;
      if (move.parentId !== parentId) {
        await movesTable.update(move.id, { parentId });
      }
      parentId = move.id;
    }
  }
}

const db = new Dexie("ChessStudyDB") as Dexie & {
  lessons: EntityTable<Lesson, "id">;
  boards: EntityTable<Board, "id">;
  moves: EntityTable<Move, "id">;
  profiles: EntityTable<LocalProfile, "id">;
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
// (nessun contenitore cumulativo). Migrazione conservativa: eventuali vecchie
// lezioni analysis con più board vengono divise in lezioni analysis separate,
// preservando board e mosse.
db.version(6).stores({
  lessons: "++id, title, mode, createdAt",
  boards: "++id, lessonId, createdAt",
  moves: "++id, boardId, parentId, order, createdAt",
}).upgrade(splitCumulativeAnalysisLessons);

// v7: aggiunto campo `headers` su Board (header PGN strutturati come JSON).
// Campo NON indicizzato → store invariato; bump di versione a documentazione.
db.version(7).stores({
  lessons: "++id, title, mode, createdAt",
  boards: "++id, lessonId, createdAt",
  moves: "++id, boardId, parentId, order, createdAt",
});

// v8: aggiunto campo gameAnalysis su Board (analisi partita).
// Campo NON indicizzato → store invariato; bump di versione a documentazione.
db.version(8).stores({
  lessons: "++id, title, mode, createdAt",
  boards: "++id, lessonId, createdAt",
  moves: "++id, boardId, parentId, order, createdAt",
});

// v9: aggiunto campo analysisComment su Move (commento momento chiave).
// Campo NON indicizzato → store invariato; bump di versione a documentazione.
db.version(9).stores({
  lessons: "++id, title, mode, createdAt",
  boards: "++id, lessonId, createdAt",
  moves: "++id, boardId, parentId, order, createdAt",
});

// v10: safety migration non distruttiva per database già arrivati oltre v6.
// Re-applica l'invariante analysis=single-board senza cancellare dati.
db.version(10).stores({
  lessons: "++id, title, mode, createdAt",
  boards: "++id, lessonId, createdAt",
  moves: "++id, boardId, parentId, order, createdAt",
}).upgrade(splitCumulativeAnalysisLessons);

// v11: rinomina il vecchio campo commento generato in analysisComment.
// Campo NON indicizzato -> store invariato; migrazione conservativa dei dati.
db.version(11).stores({
  lessons: "++id, title, mode, createdAt",
  boards: "++id, lessonId, createdAt",
  moves: "++id, boardId, parentId, order, createdAt",
}).upgrade((tx) => {
  const legacyCommentKey = "ai" + "Comment";
  return tx.table("moves").toCollection().modify((move: MigrationMove) => {
    const legacyComment = move[legacyCommentKey];
    if (move.analysisComment == null && typeof legacyComment === "string") {
      move.analysisComment = legacyComment;
    }
    delete move[legacyCommentKey];
  });
});

// v12: aggiunto campo non indicizzato `isFavorite` su Lesson.
// Le lezioni esistenti vengono normalizzate senza modificare board o mosse.
db.version(12).stores({
  lessons: "++id, title, mode, createdAt",
  boards: "++id, lessonId, createdAt",
  moves: "++id, boardId, parentId, order, createdAt",
}).upgrade((tx) => {
  return tx.table("lessons").toCollection().modify((lesson) => {
    if (lesson.isFavorite == null) lesson.isFavorite = false;
  });
});

// v13: profili locali, identificatori portabili e indici per query paginate.
// La migrazione è additiva: assegna tutti i dati esistenti al profilo
// predefinito senza ricreare o cancellare record.
db.version(13).stores({
  profiles: "++id, &uid, &name, createdAt",
  lessons: "++id, &uid, profileId, title, mode, createdAt, [profileId+createdAt], [profileId+mode+createdAt], *searchTerms",
  boards: "++id, &uid, lessonId, createdAt",
  moves: "++id, &uid, boardId, parentId, order, createdAt, [boardId+order]",
}).upgrade(async (tx) => {
  const profiles = tx.table("profiles");
  const lessons = tx.table("lessons");
  const boards = tx.table("boards");
  const moves = tx.table("moves");
  const now = new Date();

  let profile = await profiles.orderBy("createdAt").first();
  if (!profile) {
    const profileId = (await profiles.add({
      uid: createStableId(),
      name: "Principale",
      createdAt: now,
      updatedAt: now,
    })) as number;
    profile = await profiles.get(profileId);
  }
  if (!profile?.id) {
    throw new Error("Impossibile creare il profilo predefinito durante la migrazione.");
  }

  const existingLessons = (await lessons.toArray()) as Lesson[];
  for (const lesson of existingLessons) {
    if (lesson.id == null) continue;
    const lessonBoards = (await boards
      .where("lessonId")
      .equals(lesson.id)
      .toArray()) as Board[];
    await lessons.update(lesson.id, {
      uid: lesson.uid ?? createStableId(),
      profileId: lesson.profileId ?? profile.id,
      searchTerms: buildLessonSearchTerms(lesson, lessonBoards),
      updatedAt: lesson.updatedAt ?? lesson.createdAt ?? now,
    });
  }

  await boards.toCollection().modify((board: Board) => {
    board.uid ??= createStableId();
    board.updatedAt ??= board.createdAt ?? now;
  });
  await moves.toCollection().modify((move: Move) => {
    move.uid ??= createStableId();
    move.updatedAt ??= move.createdAt ?? now;
  });
});

// v14: ripara riferimenti parentId storici copiati tra scacchiere. La UI
// supporta una storia lineare, quindi la catena è ricostruita da `order`
// all'interno di ogni board senza modificare o cancellare mosse.
db.version(14).stores({
  profiles: "++id, &uid, &name, createdAt",
  lessons: "++id, &uid, profileId, title, mode, createdAt, [profileId+createdAt], [profileId+mode+createdAt], *searchTerms",
  boards: "++id, &uid, lessonId, createdAt",
  moves: "++id, &uid, boardId, parentId, order, createdAt, [boardId+order]",
}).upgrade(normalizeLinearMoveParents);

export default db;
