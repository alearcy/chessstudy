import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { getLesson, updateLesson, deleteLesson } from "@/services/lessonService";
import { getBoardsByLesson, createBoard, deleteBoard } from "@/services/boardService";
import type { Lesson, LessonFormData, Board } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";

export default function LessonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const lessonId = Number(id);

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState<LessonFormData>({ title: "", description: "" });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    const [loadedLesson, loadedBoards] = await Promise.all([
      getLesson(lessonId),
      getBoardsByLesson(lessonId),
    ]);
    if (!loadedLesson) {
      navigate("/", { replace: true });
      return;
    }
    setLesson(loadedLesson);
    setBoards(loadedBoards);
    setLoading(false);
  }, [lessonId, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEdit = () => {
    if (!lesson) return;
    setForm({ title: lesson.title, description: lesson.description });
    setEditOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    await updateLesson(lessonId, form);
    await loadData();
    setSaving(false);
    setEditOpen(false);
  };

  const handleDelete = async () => {
    await deleteLesson(lessonId);
    navigate("/", { replace: true });
  };

  const handleCreateBoard = async () => {
    const boardId = await createBoard(lessonId);
    await loadData();
    navigate(`/lesson/${lessonId}/board/${boardId}`);
  };

  const handleDeleteBoard = async (boardId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteBoard(boardId);
    await loadData();
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 text-muted-foreground">
        Caricamento...
      </div>
    );
  }

  if (!lesson) return null;

  return (
    <div className="max-w-2xl mx-auto">
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate("/")}>
        <ArrowLeft className="size-4" />
        <span className="ml-1">Lezioni</span>
      </Button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{lesson.title}</h1>
          {lesson.description && (
            <p className="text-muted-foreground mt-1">{lesson.description}</p>
          )}
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={handleEdit}>
            <Pencil className="size-4" />
            <span className="ml-1 hidden sm:inline">Modifica</span>
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-4" />
            <span className="ml-1 hidden sm:inline">Elimina</span>
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Scacchiere</h2>
        <Button size="sm" onClick={handleCreateBoard}>
          <Plus className="size-4" />
          <span className="ml-1">Nuova scacchiera</span>
        </Button>
      </div>

      {boards.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>Nessuna scacchiera. Creane una per iniziare.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {boards.map((board) => (
            <Card
              key={board.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => navigate(`/lesson/${lessonId}/board/${board.id}`)}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">{board.title}</CardTitle>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-destructive hover:text-destructive"
                  onClick={(e) => handleDeleteBoard(board.id!, e)}
                  title="Elimina scacchiera"
                >
                  <Trash2 className="size-3" />
                </Button>
              </CardHeader>
              <CardContent className="pb-4">
                <p className="text-xs text-muted-foreground font-mono truncate">
                  {board.fen}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica lezione</DialogTitle>
            <DialogDescription>
              Modifica i dettagli della lezione.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="edit-title" className="text-sm font-medium">
                Titolo
              </label>
              <Input
                id="edit-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="edit-description" className="text-sm font-medium">
                Descrizione
              </label>
              <Textarea
                id="edit-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving || !form.title.trim()}>
                {saving ? "Salvataggio..." : "Salva"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina lezione</DialogTitle>
            <DialogDescription>
              Eliminare &ldquo;{lesson.title}&rdquo;? Tutte le scacchiere
              associate verranno rimosse. L&apos;operazione non è reversibile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Annulla
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
