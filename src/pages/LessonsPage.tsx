import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Upload,
  Microscope,
  Cloud,
  Swords,
  Heart,
  Search,
  CalendarDays,
} from "lucide-react";
import {
  getLessonsPage,
  createLesson,
  updateLesson,
  deleteLesson,
  setLessonFavorite,
} from "@/services/lessonService";
import { ensureDefaultProfile } from "@/services/profileService";
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
  CardContent,
} from "@/components/ui/card";
import ImportPgnDialog from "@/components/board/ImportPgnDialog";
import ErrorNotice from "@/components/ErrorNotice";
import ImportLichessDialog from "@/components/board/ImportLichessDialog";
import ImportChessComDialog from "@/components/board/ImportChessComDialog";
import LessonFavoriteButton from "@/components/lesson/LessonFavoriteButton";
import { getAppSettings } from "@/services/settingsService";
import { DATABASE_BACKUP_RESTORED_EVENT } from "@/services/databaseBackupService";
import type { LessonListItem } from "@/services/lessonService";

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
  const [lessons, setLessons] = useState<LessonListItem[]>([]);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [totalLessons, setTotalLessons] = useState(0);
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
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [kindFilter, setKindFilter] = useState<
    "favorites" | "analysis" | "study" | null
  >(null);
  const [updatingFavoriteId, setUpdatingFavoriteId] = useState<number | null>(null);

  const loadLessons = useCallback(async (
    override: { profileId?: number; page?: number } = {},
  ) => {
    const targetProfileId = override.profileId ?? profileId;
    const targetPage = override.page ?? page;
    if (targetProfileId == null) return;
    try {
      setPageError(null);
      const result = await getLessonsPage({
        profileId: targetProfileId,
        query: searchQuery,
        createdOn: dateFilter || undefined,
        kind: kindFilter,
        page: targetPage,
        pageSize: 20,
      });
      setLessons(result.items);
      setTotalLessons(result.total);
      setPageCount(result.pageCount);
      if (result.page !== targetPage) setPage(result.page);
    } catch (e) {
      console.error("[lessons-load] errore", e);
      setPageError("Impossibile caricare le lezioni.");
    }
  }, [dateFilter, kindFilter, page, profileId, searchQuery]);

  useEffect(() => {
    let cancelled = false;
    ensureDefaultProfile()
      .then((profile) => {
        if (!cancelled) setProfileId(profile.id);
      })
      .catch((error: unknown) => {
        console.error("[profile-load] errore", error);
        if (!cancelled) setPageError("Impossibile inizializzare il profilo locale.");
      });
    return () => {
      cancelled = true;
    };
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

  const hasActiveFilters = Boolean(searchQuery || dateFilter || kindFilter);

  const handleBackupRestored = useCallback(async () => {
    const profile = await ensureDefaultProfile();
    setProfileId(profile.id);
    setPage(1);
    await loadLessons({ profileId: profile.id, page: 1 });
  }, [loadLessons]);

  useEffect(() => {
    const handleRestoreEvent = () => void handleBackupRestored();
    window.addEventListener(DATABASE_BACKUP_RESTORED_EVENT, handleRestoreEvent);
    return () => {
      window.removeEventListener(DATABASE_BACKUP_RESTORED_EVENT, handleRestoreEvent);
    };
  }, [handleBackupRestored]);

  return (
    <div>
      {pageError && (
        <div className="mb-4">
          <ErrorNotice
            message={pageError}
            onRetry={() => loadLessons()}
            onDismiss={() => setPageError(null)}
          />
        </div>
      )}

      {/* Azioni principali */}
      <section className="mb-8 border-b pb-6">
        <div className="flex flex-nowrap items-center gap-3">
          <Button
            type="button"
            className="h-16 flex-1 justify-start gap-3 px-4 text-left"
            onClick={() => {
              setEditingLesson(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4 shrink-0" />
            <span className="min-w-0">
              <span className="block font-medium leading-tight">Nuovo studio</span>
              <span className="block text-xs font-normal leading-snug text-primary-foreground/80">
                crea tutte le scacchiere di studio che vuoi
              </span>
            </span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-16 flex-1 justify-start gap-3 px-4 text-left"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="size-4 shrink-0" />
            <span className="min-w-0">
              <span className="block font-medium leading-tight">Importa PGN</span>
              <span className="block text-xs font-normal leading-snug text-muted-foreground">
                carica o incolla un PGN per analizzare la partita
              </span>
            </span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-16 flex-1 justify-start gap-3 px-4 text-left"
            disabled={checkingChessComSettings}
            onClick={handleOpenChessCom}
          >
            <Swords className="size-4 shrink-0" />
            <span className="min-w-0">
              <span className="block font-medium leading-tight">Chess.com</span>
              <span className="block text-xs font-normal leading-snug text-muted-foreground">
                importa partite da chess.com
              </span>
            </span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-16 flex-1 justify-start gap-3 px-4 text-left"
            disabled={checkingPlatformSettings}
            onClick={handleOpenLichess}
          >
            <Cloud className="size-4 shrink-0" />
            <span className="min-w-0">
              <span className="block font-medium leading-tight">Lichess</span>
              <span className="block text-xs font-normal leading-snug text-muted-foreground">
                importa partite da lichess
              </span>
            </span>
          </Button>
        </div>

        {platformError ? (
          <div className="mt-3">
            <ErrorNotice
              message={platformError}
              onDismiss={() => setPlatformError(null)}
              retryLabel="Apri impostazioni"
              onRetry={onOpenSettings}
            />
          </div>
        ) : null}
      </section>

      <section
        className="mb-6 grid gap-3 pt-6 md:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_auto_auto]"
        aria-label="Filtri lezioni"
      >
        <label className="relative block">
          <span className="sr-only">Cerca per titolo</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Cerca titolo, giocatore, evento o ECO"
            className="pl-9"
          />
        </label>

        <label className="relative block md:w-56">
          <span className="sr-only">Filtra per data</span>
          <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="date"
            value={dateFilter}
            onChange={(event) => {
              setDateFilter(event.target.value);
              setPage(1);
            }}
            className="pl-9"
            aria-label="Filtra per data"
          />
        </label>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          {[
            { value: "favorites", label: "Preferite" },
            { value: "analysis", label: "Solo analisi" },
            { value: "study", label: "Solo studi" },
          ].map((filter) => (
            <Button
              key={filter.value}
              type="button"
              variant={kindFilter === filter.value ? "default" : "outline"}
              size="sm"
              aria-pressed={kindFilter === filter.value}
              onClick={() =>
                {
                  setKindFilter((current) =>
                    current === filter.value
                      ? null
                      : (filter.value as "favorites" | "analysis" | "study"),
                  );
                  setPage(1);
                }
              }
            >
              {filter.value === "favorites" && (
                <Heart
                  className="size-4"
                  fill={
                    kindFilter === "favorites" ? "currentColor" : "none"
                  }
                />
              )}
              {filter.label}
            </Button>
          ))}
        </div>
      </section>

      {totalLessons === 0 && !hasActiveFilters ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="size-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg">Nessuna lezione</p>
          <p className="text-sm mt-1">
            Importa un PGN per iniziare.
          </p>
        </div>
      ) : lessons.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          {kindFilter === "favorites" ? (
            <Heart className="size-12 mx-auto mb-4 opacity-30" />
          ) : (
            <Search className="size-12 mx-auto mb-4 opacity-30" />
          )}
          <p className="text-lg">
            {kindFilter === "favorites" ? "Nessuna partita preferita" : "Nessun risultato"}
          </p>
          <p className="text-sm mt-1">
            {kindFilter === "favorites"
              ? "Usa il cuore su una partita importata per aggiungerla ai preferiti."
              : "Modifica i termini di ricerca o i filtri selezionati."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {lessons.map((lesson) => (
            <Card
              key={lesson.id}
              className="gap-0 border-border/70 py-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
              onClick={() => navigate(`/lesson/${lesson.id}`)}
            >
              <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 pb-1">
                <div className="min-w-0">
                  <CardTitle className="flex min-w-0 items-center gap-2">
                    {lesson.mode === "study" ? (
                      <BookOpen className="size-4 text-blue-500 shrink-0" />
                    ) : (
                      <Microscope className="size-4 text-orange-500 shrink-0" />
                    )}
                    <span className="truncate">{lesson.title}</span>
                  </CardTitle>
                </div>
                <div className="flex shrink-0 gap-1">
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
              </CardHeader>
              <CardContent className="flex items-center gap-2 px-4 pb-0 text-xs text-muted-foreground">
                <span>
                  {lesson.createdAt.toLocaleDateString("it-IT", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                {lesson.sourceLabel ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{lesson.sourceLabel}</span>
                  </>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Paginazione lezioni">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Precedente
          </Button>
          <span className="text-sm text-muted-foreground">
            Pagina {page} di {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
          >
            Successiva
          </Button>
        </nav>
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
