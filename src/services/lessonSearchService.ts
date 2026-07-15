import db from "@/db/database";
import { buildLessonSearchTerms } from "@/db/recordMetadata";

export async function refreshLessonSearchIndex(lessonId: number): Promise<void> {
  const [lesson, boards] = await Promise.all([
    db.lessons.get(lessonId),
    db.boards.where("lessonId").equals(lessonId).toArray(),
  ]);
  if (!lesson) return;

  await db.lessons.update(lessonId, {
    searchTerms: buildLessonSearchTerms(lesson, boards),
    updatedAt: new Date(),
  });
}
