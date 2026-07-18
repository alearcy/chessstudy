export type LessonBoardLayoutMode = "analysis" | "study" | "compact";

const BASE_GRID_CLASS = "grid grid-cols-1 gap-4 items-start";

const MODE_GRID_CLASS: Record<LessonBoardLayoutMode, string> = {
  analysis:
    "xl:grid-cols-[12rem_minmax(32.5rem,44.5rem)_20rem] 2xl:grid-cols-[13rem_minmax(36.5rem,48.5rem)_22rem] xl:justify-center",
  study:
    "xl:grid-cols-[14rem_minmax(32.5rem,44.5rem)_24rem] 2xl:grid-cols-[14rem_minmax(36.5rem,48.5rem)_24rem] xl:justify-center",
  compact:
    "lg:grid-cols-[minmax(24rem,40rem)_24rem] lg:justify-center",
};

export function lessonBoardLayoutClass(
  mode: LessonBoardLayoutMode,
): string {
  return `${BASE_GRID_CLASS} ${MODE_GRID_CLASS[mode]}`;
}
