import { supabase } from "@/lib/supabase/client";
import {
  createLesson,
  deleteLesson,
  getAllLessons,
  getLesson,
  getLessonsPage,
  setLessonFavorite,
  updateLesson,
  type CreateLessonOptions,
  type LessonListItem,
  type LessonPage,
  type LessonPageQuery,
} from "@/repositories/lessonRepository";
import { requireData } from "@/repositories/repositoryError";
import type { Board, Lesson, Move } from "@/types";

export {
  createLesson,
  deleteLesson,
  getAllLessons,
  getLesson,
  getLessonsPage,
  setLessonFavorite,
  updateLesson,
};
export type {
  CreateLessonOptions,
  LessonListItem,
  LessonPage,
  LessonPageQuery,
};

export async function convertAnalysisToStudy(
  sourceLesson: Lesson,
  sourceBoard: Board,
  _sourceMoves: Move[],
): Promise<number> {
  if (sourceLesson.id == null || sourceBoard.id == null) {
    throw new Error("Analisi non disponibile.");
  }
  const response = await supabase.rpc("convert_analysis_to_study", {
    p_source_lesson_id: sourceLesson.id,
    p_source_board_id: sourceBoard.id,
  });
  return requireData(
    response.data as number | null,
    response.error,
    "Conversione in studio fallita.",
  );
}
