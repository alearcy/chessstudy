import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Pencil } from "lucide-react";
import { getLesson } from "@/services/lessonService";
import { getBoard, updateBoard } from "@/services/boardService";
import type { Lesson, Board } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ChessBoardView from "@/components/board/ChessBoard";

export default function BoardPage() {
  const { id: lessonIdParam, boardId: boardIdParam } = useParams<{
    id: string;
    boardId: string;
  }>();
  const navigate = useNavigate();
  const lessonId = Number(lessonIdParam);
  const boardId = Number(boardIdParam);

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState("");

  const loadData = useCallback(async () => {
    const [loadedLesson, loadedBoard] = await Promise.all([
      getLesson(lessonId),
      getBoard(boardId),
    ]);
    if (!loadedLesson || !loadedBoard) {
      navigate("/", { replace: true });
      return;
    }
    setLesson(loadedLesson);
    setBoard(loadedBoard);
    setTitle(loadedBoard.title);
    setLoading(false);
  }, [lessonId, boardId, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveTitle = async () => {
    if (!title.trim() || !board) return;
    await updateBoard(boardId, { title: title.trim() });
    setBoard({ ...board, title: title.trim() });
    setEditingTitle(false);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16 text-muted-foreground">
        Caricamento...
      </div>
    );
  }

  if (!lesson || !board) return null;

  return (
    <div className="max-w-4xl mx-auto">
      <Button
        variant="ghost"
        size="sm"
        className="mb-2"
        onClick={() => navigate(`/lesson/${lessonId}`)}
      >
        <ArrowLeft className="size-4" />
        <span className="ml-1">{lesson.title}</span>
      </Button>

      <div className="flex items-center gap-2 mb-4">
        {editingTitle ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveTitle();
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xl font-bold h-9 w-auto"
              autoFocus
              onBlur={handleSaveTitle}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setTitle(board.title);
                  setEditingTitle(false);
                }
              }}
            />
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{board.title}</h1>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setEditingTitle(true)}
              title="Rinomina"
            >
              <Pencil className="size-3" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex justify-center w-full">
        <ChessBoardView fen={board.fen} />
      </div>
    </div>
  );
}
