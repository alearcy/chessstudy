import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Plus, Pencil, Trash2, Upload, Microscope, Settings, Swords, Heart } from "lucide-react";
import {
  getAllLessons,
  createLesson,
  updateLesson,
  deleteLesson,
  setLessonFavorite,
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
import ErrorNotice from "@/components/ErrorNotice";
import ImportLichessDialog from "@/components/board/ImportLichessDialog";
import ImportChessComDialog from "@/components/board/ImportChessComDialog";
import LessonFavoriteButton from "@/components/lesson/LessonFavoriteButton";
import { getAppSettings } from "@/services/settingsService";

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
  const [error, setError] = useState<string | null>(null);
  const isEditing = (initial as Lesson & { id?: number }).id !== undefined;

  useEffect(() => {
    setForm(initial);
    setError(null);
  }, [initial, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
      onOpenChange(false);
    } catch (e) {
      console.error("[lesson-form] errore", e);
      setError("Salvataggio lezione fallito. Riprova.");
    } finally {
      setSaving(false);
    }
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
          {error && (
            <ErrorNotice
              message={error}
              onDismiss={() => setError(null)}
            />
          )}
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
  const [error, setError] = useState<string | null>(null);

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
        {error && (
          <ErrorNotice
            message={error}
            onDismiss={() => setError(null)}
          />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            variant="destructive"
            disabled={deleting}
            onClick={async () => {
              setDeleting(true);
              setError(null);
              try {
                await onConfirm();
                onOpenChange(false);
              } catch (e) {
                console.error("[lesson-delete] errore", e);
                setError("Eliminazione lezione fallita. Riprova.");
              } finally {
                setDeleting(false);
              }
            }}
          >
            {deleting ? "Eliminazione..." : "Elimina"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function LessonsPage({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [deletingLesson, setDeletingLesson] = useState<Lesson | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [lichessImportOpen, setLichessImportOpen] = useState(false);
  const [lichessUsername, setLichessUsername] = useState("");
  const [platformError, setPlatformError] = useState<string | null>(null);
  const [checkingPlatformSettings, setCheckingPlatformSettings] = useState(false);
  const [chessComImportOpen, setChessComImportOpen] = useState(false);
  const [chessComUsername, setChessComUsername] = useState("");
  const [checkingChessComSettings, setCheckingChessComSettings] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [updatingFavoriteId, setUpdatingFavoriteId] = useState<number | null>(null);

  const loadLessons = useCallback(async () => {
    try {
      setPageError(null);
      setLessons(await getAllLessons());
    } catch (e) {
      console.error("[lessons-load] errore", e);
      setPageError("Impossibile caricare le lezioni.");
    }
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

  const handleToggleFavorite = async (lesson: Lesson) => {
    if (lesson.id == null || lesson.mode !== "analysis") return;
    setUpdatingFavoriteId(lesson.id);
    setPageError(null);
    try {
      await setLessonFavorite(lesson.id, !lesson.isFavorite);
      await loadLessons();
    } catch (e) {
      console.error("[lesson-favorite] errore", e);
      setPageError("Impossibile aggiornare i preferiti. Riprova.");
    } finally {
      setUpdatingFavoriteId(null);
    }
  };

  const handlePgnImported = (lessonId: number, _boardId: number) => {
    // Ogni PGN è ora una lezione analysis autonoma: naviga direttamente.
    navigate(`/lesson/${lessonId}`);
  };

  const handleOpenLichess = async () => {
    setCheckingPlatformSettings(true);
    setPlatformError(null);
    try {
      const settings = await getAppSettings();
      const username = settings.lichess_username.trim();
      if (!username) {
        setPlatformError("Configura lo username Lichess nelle impostazioni prima di importare.");
        return;
      }
      setLichessUsername(username);
      setLichessImportOpen(true);
    } catch {
      setPlatformError("Le impostazioni degli account sono disponibili nell'app desktop.");
    } finally {
      setCheckingPlatformSettings(false);
    }
  };

  const handleOpenChessCom = async () => {
    setCheckingChessComSettings(true);
    setPlatformError(null);
    try {
      const settings = await getAppSettings();
      const username = settings.chesscom_username.trim();
      if (!username) {
        setPlatformError("Configura lo username Chess.com nelle impostazioni prima di importare.");
        return;
      }
      setChessComUsername(username);
      setChessComImportOpen(true);
    } catch {
      setPlatformError("Le impostazioni degli account sono disponibili nell'app desktop.");
    } finally {
      setCheckingChessComSettings(false);
    }
  };

  const visibleLessons = showFavoritesOnly
    ? lessons.filter((lesson) => lesson.mode === "analysis" && lesson.isFavorite)
    : lessons;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Lezioni</h1>
        <Button
          variant={showFavoritesOnly ? "default" : "outline"}
          size="sm"
          aria-pressed={showFavoritesOnly}
          onClick={() => setShowFavoritesOnly((current) => !current)}
        >
          <Heart
            className="size-4"
            fill={showFavoritesOnly ? "currentColor" : "none"}
          />
          Solo preferite
        </Button>
      </div>

      {pageError && (
        <div className="mb-4">
          <ErrorNotice
            message={pageError}
            onRetry={loadLessons}
            onDismiss={() => setPageError(null)}
          />
        </div>
      )}

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

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Swords className="size-4" />
            Importa da piattaforma
          </CardTitle>
          <CardDescription>
            Scegli una partita recente usando gli username salvati nelle impostazioni.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {platformError && (
            <div className="space-y-2">
              <ErrorNotice
                message={platformError}
                onDismiss={() => setPlatformError(null)}
              />
              {onOpenSettings && (
                <Button variant="outline" size="sm" onClick={onOpenSettings}>
                  <Settings className="size-4" />
                  Apri impostazioni
                </Button>
              )}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
              className="h-auto justify-start gap-3 px-4 py-4"
              onClick={() => void handleOpenLichess()}
              disabled={checkingPlatformSettings}
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-[#b3b3b3] font-bold text-black">
                Li
              </span>
              <span className="text-left">
                <span className="block font-semibold">Lichess.org</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {checkingPlatformSettings ? "Lettura impostazioni..." : "Scegli tra le ultime 30 partite"}
                </span>
              </span>
            </Button>
            <Button
              variant="outline"
              className="h-auto justify-start gap-3 px-4 py-4"
              onClick={() => void handleOpenChessCom()}
              disabled={checkingChessComSettings}
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-emerald-700 font-bold text-white">
                C
              </span>
              <span className="text-left">
                <span className="block font-semibold">Chess.com</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {checkingChessComSettings ? "Lettura impostazioni..." : "Scegli mese e partita"}
                </span>
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {lessons.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="size-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg">Nessuna lezione</p>
          <p className="text-sm mt-1">
            Importa un PGN per iniziare.
          </p>
        </div>
      ) : visibleLessons.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Heart className="size-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg">Nessuna partita preferita</p>
          <p className="text-sm mt-1">
            Usa il cuore su una partita importata per aggiungerla ai preferiti.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleLessons.map((lesson) => (
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
                  {lesson.mode === "analysis" && (
                    <LessonFavoriteButton
                      lessonTitle={lesson.title}
                      isFavorite={Boolean(lesson.isFavorite)}
                      onToggle={() => void handleToggleFavorite(lesson)}
                      disabled={updatingFavoriteId === lesson.id}
                    />
                  )}
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

      <ImportLichessDialog
        open={lichessImportOpen}
        username={lichessUsername}
        onOpenChange={setLichessImportOpen}
        onImportedLesson={handlePgnImported}
      />

      <ImportChessComDialog
        open={chessComImportOpen}
        username={chessComUsername}
        onOpenChange={setChessComImportOpen}
        onImportedLesson={handlePgnImported}
      />
    </div>
  );
}
