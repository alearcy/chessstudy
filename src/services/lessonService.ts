import db from "@/db/database";
import type { Lesson, LessonFormData } from "@/types";

export async function getAllLessons(): Promise<Lesson[]> {
  return db.lessons.orderBy("createdAt").reverse().toArray();
}

export async function getLesson(id: number): Promise<Lesson | undefined> {
  return db.lessons.get(id);
}

export async function createLesson(data: LessonFormData): Promise<number> {
  const id = await db.lessons.add({
    ...data,
    createdAt: new Date(),
  } as Lesson);
  return id as number;
}

export async function updateLesson(
  id: number,
  data: LessonFormData
): Promise<void> {
  await db.lessons.update(id, data);
}

export async function deleteLesson(id: number): Promise<void> {
  const boards = await db.boards.where("lessonId").equals(id).toArray();
  for (const board of boards) {
    await db.moves.where("boardId").equals(board.id!).delete();
  }
  await db.boards.where("lessonId").equals(id).delete();
  await db.lessons.delete(id);
}
