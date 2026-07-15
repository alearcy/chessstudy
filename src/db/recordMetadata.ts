import type { Board, Lesson } from "@/types";

export function createStableId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function normalizeSearchTerms(values: Array<unknown>): string[] {
  const terms = values
    .filter((value): value is string => typeof value === "string")
    .flatMap((value) =>
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("it")
        .split(/[^a-z0-9]+/)
        .filter(Boolean),
    );

  return [...new Set(terms)];
}

export function buildLessonSearchTerms(
  lesson: Pick<Lesson, "title" | "description">,
  boards: Array<Pick<Board, "title" | "whiteName" | "blackName" | "headers">> = [],
): string[] {
  return normalizeSearchTerms([
    lesson.title,
    lesson.description,
    ...boards.flatMap((board) => [
      board.title,
      board.whiteName,
      board.blackName,
      ...Object.values(board.headers ?? {}),
    ]),
  ]);
}
