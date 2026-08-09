import { createStableId, normalizeSearchTerms } from "@/lib/dataUtils";
import { supabase } from "@/lib/supabase/client";
import {
  lessonFromRow,
  lessonPayload,
  type LessonRow,
} from "@/repositories/supabaseMappers";
import { requireData, throwIfError } from "@/repositories/repositoryError";
import type { Lesson, LessonFormData } from "@/types";

export interface LessonPageQuery {
  query?: string;
  kind?: "favorites" | "analysis" | "study" | null;
  createdOn?: string;
  page: number;
  pageSize: number;
}

export interface LessonListItem extends Lesson {
  sourceLabel?: string | null;
}

export interface LessonPage {
  items: LessonListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface CreateLessonOptions {
  createdAt?: Date;
  isFavorite?: boolean;
}

type LessonWithBoardsRow = LessonRow & {
  boards?: Array<{ headers: Record<string, string | null> | null }>;
};

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
      return raw;
    }
  }
  return raw;
}

function lessonSource(row: LessonWithBoardsRow): string | null {
  for (const board of row.boards ?? []) {
    const label = sourceLabel(board.headers?.Site) ?? sourceLabel(board.headers?.Link);
    if (label) return label;
  }
  return null;
}

function buildPageQuery(options: LessonPageQuery) {
  let query = supabase
    .from("lessons")
    .select("*, boards(headers)", { count: "exact" });
  const mode = options.kind === "favorites" ? "analysis" : options.kind;
  if (mode === "analysis" || mode === "study") query = query.eq("mode", mode);
  if (options.kind === "favorites") query = query.eq("is_favorite", true);
  if (options.createdOn) {
    const start = new Date(`${options.createdOn}T00:00:00`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    query = query.gte("created_at", start.toISOString()).lt("created_at", end.toISOString());
  }
  const terms = normalizeSearchTerms([options.query ?? ""]);
  if (terms.length > 0) {
    const prefixQuery = terms.map((term) => `${term}:*`).join(" & ");
    query = query.textSearch("search_text", prefixQuery, {
      config: "simple",
    });
  }
  return query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
}

export async function getAllLessons(): Promise<Lesson[]> {
  const rows: Lesson[] = [];
  const pageSize = 1000;
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase
      .from("lessons")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(start, start + pageSize - 1);
    throwIfError(error);
    const page = ((data ?? []) as LessonRow[]).map(lessonFromRow);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export async function getLessonsPage(options: LessonPageQuery): Promise<LessonPage> {
  const pageSize = Math.min(100, Math.max(1, Math.trunc(options.pageSize)));
  const requestedPage = Math.max(1, Math.trunc(options.page));
  const firstStart = (requestedPage - 1) * pageSize;
  let response = await buildPageQuery(options).range(firstStart, firstStart + pageSize - 1);
  throwIfError(response.error);

  const total = response.count ?? 0;
  const pageCount = total === 0 ? 0 : Math.ceil(total / pageSize);
  const page = pageCount === 0 ? 1 : Math.min(requestedPage, pageCount);
  if (page !== requestedPage) {
    const start = (page - 1) * pageSize;
    response = await buildPageQuery(options).range(start, start + pageSize - 1);
    throwIfError(response.error);
  }

  const items = ((response.data ?? []) as LessonWithBoardsRow[]).map((row) => ({
    ...lessonFromRow(row),
    sourceLabel: lessonSource(row),
  }));
  return { items, total, page, pageSize, pageCount };
}

export async function getLesson(id: number): Promise<Lesson | undefined> {
  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwIfError(error);
  return data ? lessonFromRow(data as LessonRow) : undefined;
}

export async function createLesson(
  data: LessonFormData,
  mode: Lesson["mode"] = "study",
  options: CreateLessonOptions = {},
): Promise<number> {
  const now = options.createdAt ?? new Date();
  const response = await supabase
    .from("lessons")
    .insert(lessonPayload({
      uid: createStableId(),
      title: data.title,
      description: data.description,
      mode,
      isFavorite: options.isFavorite ?? false,
      createdAt: now,
      updatedAt: now,
    }))
    .select("id")
    .single();
  const row = requireData(
    response.data as { id: number } | null,
    response.error,
    "Creazione lezione fallita.",
  );
  return row.id;
}

export async function updateLesson(id: number, data: LessonFormData): Promise<void> {
  const { error } = await supabase
    .from("lessons")
    .update({
      title: data.title,
      description: data.description,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  throwIfError(error);
}

export async function setLessonFavorite(id: number, isFavorite: boolean): Promise<void> {
  const { error } = await supabase
    .from("lessons")
    .update({ is_favorite: isFavorite, updated_at: new Date().toISOString() })
    .eq("id", id);
  throwIfError(error);
}

export async function deleteLesson(id: number): Promise<void> {
  const { error } = await supabase.from("lessons").delete().eq("id", id);
  throwIfError(error);
}
