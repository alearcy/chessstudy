import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Plus, Pencil, Trash2, Upload, Microscope } from "lucide-react";
import {
  getAllLessons,
  createLesson,
  updateLesson,
  deleteLesson,
} from "@/services/lessonService";
import type { Lesson, LessonFormData } from "@/types";
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
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import ImportPgnDialog from "@/components/board/ImportPgnDialog";

const emptyForm: LessonFormData = { title: "", description: "" };

function LessonFormDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: LessonFormData;
  onSave: (data: LessonFormData) => Promise<void>;
}) {
  const [form, setForm] = useState<LessonFormData>(initial);
  const [saving, setSaving] = useState(false);
  const isEditing = (initial as Lesson & { id?: number }).id !== undefined;

  useEffect(() => {
    setForm(initial);
  }, [initial, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Modifica lezione" : "Nuova lezione"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modifica i dettagli della lezione."
              : "Crea una nuova lezione per studiare gli scacchi."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="title" className="text-sm font-medium">
              Titolo
            </label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Es. Apertura Italiana"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="description" className="text-sm font-medium">
              Descrizione
            </label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Descrivi la lezione..."
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
  );
}

function DeleteConfirmDialog({
  open,
  onOpenChange,
  lessonTitle,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lessonTitle: string;
  onConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Elimina lezione</DialogTitle>
          <DialogDescription>
            Eliminare &ldquo;{lessonTitle}&rdquo;? Tutte le scacchiere
            associate verranno rimosse. L&apos;operazione non è reversibile.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            variant="destructive"
            disabled={deleting}
            onClick={async () => {
              setDeleting(true);
              await onConfirm();
              setDeleting(false);
              onOpenChange(false);
            }}
          >
            {deleting ? "Eliminazione..." : "Elimina"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function LessonsPage() {
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [deletingLesson, setDeletingLesson] = useState<Lesson | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const loadLessons = useCallback(async () => {
    setLessons(await getAllLessons());
  }, []);

  useEffect(() => {
    loadLessons();
  }, [loadLessons]);

  const handleCreate = async (data: LessonFormData) => {
    const id = await createLesson(data, "study");
    await loadLessons();
    navigate(`/lesson/${id}`);
  };

  const handleUpdate = async (data: LessonFormData) => {
    if (!editingLesson?.id) return;
    await updateLesson(editingLesson.id, data);
    await loadLessons();
    setEditingLesson(null);
  };

  const handleDelete = async () => {
    if (!deletingLesson?.id) return;
    await deleteLesson(deletingLesson.id);
    await loadLessons();
    setDeletingLesson(null);
  };

  const handlePgnImported = (lessonId: number, _boardId: number) => {
    // Ogni PGN è ora una lezione analysis autonoma: naviga direttamente.
    navigate(`/lesson/${lessonId}`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Lezioni</h1>
      </div>

      {/* Azioni principali */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors border-2 border-dashed"
          onClick={() => setImportOpen(true)}
        >
          <CardContent className="flex flex-col items-center gap-3 py-8">
            <Upload className="size-10 text-primary" />
            <div className="text-center">
              <p className="font-semibold">Importa un PGN</p>
              <p className="text-sm text-muted-foreground mt-1">
                Carica una partita e analizzala
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors border-2 border-dashed"
          onClick={() => {
            setEditingLesson(null);
            setDialogOpen(true);
          }}
        >
          <CardContent className="flex flex-col items-center gap-3 py-8">
            <Plus className="size-10 text-primary" />
            <div className="text-center">
              <p className="font-semibold">Nuova lezione</p>
              <p className="text-sm text-muted-foreground mt-1">
                Crea una lezione vuota per studiare
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {lessons.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="size-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg">Nessuna lezione</p>
          <p className="text-sm mt-1">
            Importa un PGN per iniziare.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {lessons.map((lesson) => (
            <Card
              key={lesson.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => navigate(`/lesson/${lesson.id}`)}
            >
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {lesson.mode === "study" ? (
                      <BookOpen className="size-4 text-blue-500 shrink-0" />
                    ) : (
                      <Microscope className="size-4 text-orange-500 shrink-0" />
                    )}
                    {lesson.title}
                  </CardTitle>
                  {lesson.description && (
                    <CardDescription className="mt-1 line-clamp-2">
                      {lesson.description}
                    </CardDescription>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex items-center gap-1 text-xs text-muted-foreground pb-4">
                <span>
                  {lesson.createdAt.toLocaleDateString("it-IT", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <div className="ml-auto flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingLesson(lesson);
                      setDialogOpen(true);
                    }}
                    title="Modifica"
                  >
                    <Pencil className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingLesson(lesson);
                    }}
                    title="Elimina"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <LessonFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingLesson(null);
        }}
        initial={
          editingLesson
            ? { title: editingLesson.title, description: editingLesson.description }
            : emptyForm
        }
        onSave={editingLesson ? handleUpdate : handleCreate}
      />

      <DeleteConfirmDialog
        open={deletingLesson !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingLesson(null);
        }}
        lessonTitle={deletingLesson?.title ?? ""}
        onConfirm={handleDelete}
      />

      <ImportPgnDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImportedLesson={handlePgnImported}
      />
    </div>
  );
}