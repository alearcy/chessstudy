import Dexie from "dexie";
import db from "@/db/database";
import { buildLessonSearchTerms, createStableId, normalizeSearchTerms } from "@/db/recordMetadata";
import { refreshLessonSearchIndex } from "@/services/lessonSearchService";
import { ensureDefaultProfile } from "@/services/profileService";
import type { Lesson, LessonFormData, Board, Move } from "@/types";

export interface LessonPageQuery {
  profileId: number;
  query?: string;
  kind?: "favorites" | "analysis" | "study" | null;
  createdOn?: string;
  page: number;
  pageSize: number;
}

export interface LessonPage {
  items: LessonListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface LessonListItem extends Lesson {
  sourceLabel?: string | null;
}

export interface CreateLessonOptions {
  profileId?: number;
  createdAt?: Date;
  isFavorite?: boolean;
}

function intersectIds(left: Set<number>, right: Set<number>): Set<number> {
  return new Set(Array.from(left).filter((id) => right.has(id)));
}

function sourceLabel(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw || raw === "?") return null;

  const normalized = raw.toLowerCase();
  if (normalized.includes("lichess.org")) return "Lichess";
  if (normalized.includes("chess.com")) return "Chess.com";

  if (/^(?:https?:\/\/)?(?:www\.)?[^\s/]+\.[^\s/]+/i.test(raw)) {
    try {
      const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      return url.hostname.replace(/^www\./i, "");
    } catch {
      // Conserva il valore PGN originale se non è una URL valida.
    }
  }

  return raw;
}

async function withLessonSources(items: Lesson[]): Promise<LessonListItem[]> {
  const lessonIds = items.flatMap((lesson) => lesson.id == null ? [] : [lesson.id]);
  if (lessonIds.length === 0) return items;

  const boards = await db.boards.where("lessonId").anyOf(lessonIds).toArray();
  const sources = new Map<number, string>();
  for (const board of boards) {
    if (sources.has(board.lessonId)) continue;
    const label = sourceLabel(board.headers?.Site) ?? sourceLabel(board.headers?.Link);
    if (label) sources.set(board.lessonId, label);
  }

  return items.map((lesson) => ({
    ...lesson,
    sourceLabel: lesson.id == null ? null : sources.get(lesson.id) ?? null,
  }));
}

export async function getAllLessons(): Promise<Lesson[]> {
  const profile = await ensureDefaultProfile();
  return db.lessons
    .where("[profileId+createdAt]")
    .between([profile.id, Dexie.minKey], [profile.id, Dexie.maxKey])
    .reverse()
    .toArray();
}

export async function getLessonsPage(options: LessonPageQuery): Promise<LessonPage> {
  const pageSize = Math.min(100, Math.max(1, Math.trunc(options.pageSize)));
  const requestedPage = Math.max(1, Math.trunc(options.page));
  const start = options.createdOn
    ? new Date(`${options.createdOn}T00:00:00`)
    : null;
  const end = start ? new Date(start.getTime() + 24 * 60 * 60 * 1000) : null;
  const mode = options.kind === "favorites" ? "analysis" : options.kind;

  const collection = mode === "analysis" || mode === "study"
    ? db.lessons
        .where("[profileId+mode+createdAt]")
        .between(
          [options.profileId, mode, start ?? Dexie.minKey],
          [options.profileId, mode, end ?? Dexie.maxKey],
          true,
          end == null,
        )
        .reverse()
    : db.lessons
        .where("[profileId+createdAt]")
        .between(
          [options.profileId, start ?? Dexie.minKey],
          [options.profileId, end ?? Dexie.maxKey],
          true,
          end == null,
        )
        .reverse();

  let matchingIds: Set<number> | null = null;
  for (const term of normalizeSearchTerms([options.query ?? ""])) {
    const ids = await db.lessons.where("searchTerms").startsWith(term).primaryKeys();
    const current = new Set(ids.map(Number));
    matchingIds = matchingIds == null
      ? current
      : intersectIds(matchingIds, current);
  }

  const filtered = collection.and((lesson) =>
    (options.kind !== "favorites" || Boolean(lesson.isFavorite)) &&
    (matchingIds == null || (lesson.id != null && matchingIds.has(lesson.id))),
  );
  const total = await filtered.count();
  const pageCount = total === 0 ? 0 : Math.ceil(total / pageSize);
  const page = pageCount === 0 ? 1 : Math.min(requestedPage, pageCount);
  const pageItems = await filtered.offset((page - 1) * pageSize).limit(pageSize).toArray();
  const items = await withLessonSources(pageItems);

  return { items, total, page, pageSize, pageCount };
}

export async function getLesson(id: number): Promise<Lesson | undefined> {
  return db.lessons.get(id);
}

export async function createLesson(
  data: LessonFormData,
  mode: Lesson["mode"] = "study",
  options: CreateLessonOptions = {},
): Promise<number> {
  const profileId = options.profileId ?? (await ensureDefaultProfile()).id;
  const now = options.createdAt ?? new Date();
  const id = await db.lessons.add({
    ...data,
    uid: createStableId(),
    profileId,
    mode,
    isFavorite: options.isFavorite ?? false,
    searchTerms: buildLessonSearchTerms(data),
    createdAt: now,
    updatedAt: now,
  } as Lesson);
  return id as number;
}

export async function updateLesson(
  id: number,
  data: LessonFormData
): Promise<void> {
  await db.lessons.update(id, { ...data, updatedAt: new Date() });
  await refreshLessonSearchIndex(id);
}

export async function setLessonFavorite(
  id: number,
  isFavorite: boolean,
): Promise<void> {
  await db.lessons.update(id, { isFavorite, updatedAt: new Date() });
}

export async function deleteLesson(id: number): Promise<void> {
  const boards = await db.boards.where("lessonId").equals(id).toArray();
  for (const board of boards) {
    await db.moves.where("boardId").equals(board.id!).delete();
  }
  await db.boards.where("lessonId").equals(id).delete();
  await db.lessons.delete(id);
}

/**
 * Converte una scacchiera di analisi in una nuova lezione di studio.
 * Crea un nuovo Lesson (mode "study"), una Board che copia i dati della
 * scacchiera sorgente (FEN, frecce, evidenziazioni, eval, giocatori) e tutte
 * le mosse relative (con commenti, annotazioni, eval). La sorgente non viene
 * modificata. Ritorna l'id della nuova lezione.
 */
export async function convertAnalysisToStudy(
  sourceLesson: Lesson,
  sourceBoard: Board,
  sourceMoves: Move[]
): Promise<number> {
  const profileId = sourceLesson.profileId ?? (await ensureDefaultProfile()).id;
  const lessonId = await db.transaction("rw", db.lessons, db.boards, db.moves, async () => {
    const now = new Date();
    const lessonId = (await db.lessons.add({
      uid: createStableId(),
      profileId,
      title: `${sourceLesson.title} (Studio)`,
      description: sourceLesson.description,
      mode: "study",
      isFavorite: false,
      searchTerms: buildLessonSearchTerms({
        title: `${sourceLesson.title} (Studio)`,
        description: sourceLesson.description,
      }),
      createdAt: now,
      updatedAt: now,
    } as Lesson)) as number;

    const boardId = (await db.boards.add({
      uid: createStableId(),
      lessonId,
      title: sourceBoard.title,
      fen: sourceBoard.fen,
      notes: sourceBoard.notes,
      arrows: sourceBoard.arrows ?? [],
      highlights: sourceBoard.highlights ?? [],
      order: 0,
      createdAt: now,
      updatedAt: now,
      evalCp: sourceBoard.evalCp ?? null,
      evalMate: sourceBoard.evalMate ?? null,
      evalDepth: sourceBoard.evalDepth ?? 0,
      evalBestMoveUci: sourceBoard.evalBestMoveUci ?? null,
      whiteName: sourceBoard.whiteName ?? null,
      blackName: sourceBoard.blackName ?? null,
      headers: sourceBoard.headers ?? {},
    } as Board)) as number;

    let parentId: number | null = null;
    for (const m of [...sourceMoves].sort((left, right) => left.order - right.order)) {
      const moveId = (await db.moves.add({
        uid: createStableId(),
        boardId,
        moveNotation: m.moveNotation,
        fen: m.fen,
        parentId,
        order: m.order,
        comment: m.comment ?? "",
        stockfishComment: m.stockfishComment ?? null,
        arrows: m.arrows ?? [],
        highlights: m.highlights ?? [],
        createdAt: now,
        updatedAt: now,
        evalCp: m.evalCp ?? null,
        evalMate: m.evalMate ?? null,
        evalDepth: m.evalDepth ?? 0,
        evalBestMoveUci: m.evalBestMoveUci ?? null,
      } as Move)) as number;
      parentId = moveId;
    }

    return lessonId;
  });
  await refreshLessonSearchIndex(lessonId);
  return lessonId;
}
