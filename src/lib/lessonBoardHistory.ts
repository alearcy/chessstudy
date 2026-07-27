import type { Lesson } from "@/types";

export function initialHistoryIndexForLessonMode(
  mode: Lesson["mode"] | null | undefined,
  moveCount: number,
): number {
  return mode === "study" ? Math.max(0, moveCount) : 0;
}
