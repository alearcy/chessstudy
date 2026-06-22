import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, NotebookPen } from "lucide-react";
import { getLesson, updateLesson, deleteLesson } from "@/services/lessonService";
import {
  getBoardsByLesson,
  createBoard,
  updateBoard,
  deleteBoard,
} from "@/services/boardService";
import type { Lesson, LessonFormData, Board } from "@/types";
import type { Square } from "react-chessboard/dist/chessboard/types";
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
import { useChessBoard } from "@/hooks/useChessBoard";
import ChessBoardView from "@/components/board/ChessBoard";
import MoveNotation from "@/components/board/MoveNotation";

const BOARD_WIDTH = 480;
const SAVE_DEBOUNCE_MS = 800;

export default function LessonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const lessonId = Number(id);

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState<LessonFormData>({ title: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [editBoardOpen, setEditBoardOpen] = useState(false);
  const [editBoardId, setEditBoardId] = useState<number | null>(null);
  const [editBoardTitle, setEditBoardTitle] = useState("");
  const [deleteBoardOpen, setDeleteBoardOpen] = useState(false);
  const [deleteBoardId, setDeleteBoardId] = useState<number | null>(null);

  const chess = useChessBoard();
  const initializedRef = useRef<number | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");

  const selectedBoard = useMemo(
    () => boards.find((b) => b.id === selectedBoardId) ?? null,
    [boards, selectedBoardId]
  );

  // Inizializza l'hook scacchiera quando viene selezionata una nuova board.
  useEffect(() => {
    if (selectedBoard && initializedRef.current !== selectedBoard.id) {
      chess.setPosition(selectedBoard.fen);
      initializedRef.current = selectedBoard.id ?? null;
    }
  }, [selectedBoard, chess.setPosition]);

  // Sincronizza il draft delle note SOLO quando cambia la board selezionata
  // (non ad ogni mutazione di FEN/titolo della stessa board, che altrimenti
  // sovrascriverebbe le modifiche non ancora salvate).
  const prevBoardIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (selectedBoardId === prevBoardIdRef.current) return;
    prevBoardIdRef.current = selectedBoardId;
    // Flush di un eventuale salvataggio debounce pendente della board precedente.
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const board = boards.find((b) => b.id === selectedBoardId);
    const notes = board?.notes ?? "";
    setNotesDraft(notes);
    lastSavedRef.current = notes;
  }, [selectedBoardId, boards]);

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
    // Mantiene la selezione se valida, altrimenti seleziona la prima.
    setSelectedBoardId((prev) => {
      if (prev != null && loadedBoards.some((b) => b.id === prev)) return prev;
      return loadedBoards[0]?.id ?? null;
    });
  }, [lessonId, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Salvataggio note: blur immediato + debounce su digitazione.
  const saveNotes = useCallback(
    async (next: string) => {
      if (!selectedBoardId || next === lastSavedRef.current) return;
      lastSavedRef.current = next;
      await updateBoard(selectedBoardId, { notes: next });
    },
    [selectedBoardId]
  );

  const scheduleDebouncedSave = useCallback(
    (next: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveNotes(next);
      }, SAVE_DEBOUNCE_MS);
    },
    [saveNotes]
  );

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setNotesDraft(next);
    scheduleDebouncedSave(next);
  };

  const handleNotesBlur = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveNotes(notesDraft);
  };

  // Persistenza FEN/notes dopo una mossa o una modifica note: aggiorna stato boards.
  const syncBoardInList = useCallback(
    (boardId: number, patch: Partial<Board>) => {
      setBoards((prev) =>
        prev.map((b) => (b.id === boardId ? { ...b, ...patch } : b))
      );
    },
    []
  );

  const handleMove = useCallback(
    (from: Square, to: Square): boolean => {
      const newFen = chess.makeMove(from, to);
      if (newFen && selectedBoardId) {
        syncBoardInList(selectedBoardId, { fen: newFen });
        // Persiste il FEN aggiornato. La storia mosse SAN non è ancora
        // tracciata lato DB — vedi docs/tech-debt/move-history-not-persisted.md.
        void updateBoard(selectedBoardId, { fen: newFen });
      }
      return !!newFen;
    },
    [chess, selectedBoardId, syncBoardInList]
  );

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
    setSelectedBoardId(boardId);
  };

  const handleEditBoardClick = (board: Board, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditBoardId(board.id ?? null);
    setEditBoardTitle(board.title);
    setEditBoardOpen(true);
  };

  const handleSaveBoardTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBoardId || !editBoardTitle.trim()) return;
    await updateBoard(editBoardId, { title: editBoardTitle.trim() });
    syncBoardInList(editBoardId, { title: editBoardTitle.trim() });
    setEditBoardOpen(false);
  };

  const handleDeleteBoardClick = (boardId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteBoardId(boardId);
    setDeleteBoardOpen(true);
  };

  const confirmDeleteBoard = async () => {
    if (!deleteBoardId) return;
    const boardId = deleteBoardId;
    setDeleteBoardOpen(false);
    setDeleteBoardId(null);
    await deleteBoard(boardId);
    // Ricarica e ricalcola la selezione.
    const updatedBoards = await getBoardsByLesson(lessonId);
    setBoards(updatedBoards);
    if (selectedBoardId === boardId) {
      setSelectedBoardId(updatedBoards[0]?.id ?? null);
      initializedRef.current = null;
    }
  };

  const handleUndo = async () => {
    chess.undo();
    if (selectedBoardId) {
      const newFen = chess.fen;
      syncBoardInList(selectedBoardId, { fen: newFen });
      await updateBoard(selectedBoardId, { fen: newFen });
    }
  };

  const handleRedo = async () => {
    chess.redo();
    if (selectedBoardId) {
      const newFen = chess.fen;
      syncBoardInList(selectedBoardId, { fen: newFen });
      await updateBoard(selectedBoardId, { fen: newFen });
    }
  };

  const handleReset = async () => {
    chess.reset();
    if (selectedBoardId) {
      const newFen = chess.fen;
      syncBoardInList(selectedBoardId, { fen: newFen });
      await updateBoard(selectedBoardId, { fen: newFen });
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto text-center py-16 text-muted-foreground">
        Caricamento...
      </div>
    );
  }

  if (!lesson) return null;

  return (
    <div className="max-w-6xl mx-auto">
      <Button
        variant="ghost"
        size="sm"
        className="mb-3"
        onClick={() => navigate("/")}
      >
        <ArrowLeft className="size-4" />
        <span className="ml-1">Lezioni</span>
      </Button>

      <div className="flex items-center gap-2 mb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <h1 className="text-2xl font-bold truncate">{lesson.title}</h1>
            <Button
              variant="ghost"
              size="icon-xs"
              className="hover:bg-accent shrink-0"
              onClick={handleEdit}
              title="Modifica lezione"
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-destructive hover:text-destructive shrink-0"
              onClick={() => setDeleteOpen(true)}
              title="Elimina lezione"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          {lesson.description && (
            <p className="text-muted-foreground mt-1 text-sm">
              {lesson.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-stretch">
        {/* Colonna sinistra: sidebar scacchiere */}
        <aside className="w-full lg:w-56 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Scacchiere</h2>
            <Button
              size="icon-xs"
              onClick={handleCreateBoard}
              title="Nuova scacchiera"
            >
              <Plus className="size-4" />
            </Button>
          </div>
          {boards.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nessuna scacchiera. Creane una con il pulsante +.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {boards.map((board) => {
                const active = board.id === selectedBoardId;
                return (
                  <li key={board.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedBoardId(board.id!)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedBoardId(board.id!);
                        }
                      }}
                      className={`flex items-center justify-between gap-1 rounded-md px-2 py-1.5 cursor-pointer text-sm transition-colors ${
                        active
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent/50"
                      }`}
                    >
                      <span className="truncate">{board.title}</span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="hover:bg-accent"
                          onClick={(e) => handleEditBoardClick(board, e)}
                          title="Rinomina scacchiera"
                        >
                          <Pencil className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-destructive hover:text-destructive"
                          onClick={(e) => handleDeleteBoardClick(board.id!, e)}
                          title="Elimina scacchiera"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Centro: scacchiera + note */}
        <section className="flex-1 min-w-0 flex flex-col gap-4 items-center">
          {selectedBoard ? (
            <>
              <div className="w-full">
                <ChessBoardView
                  fen={chess.fen}
                  boardWidth={BOARD_WIDTH}
                  canUndo={chess.canUndo}
                  canRedo={chess.canRedo}
                  onMove={handleMove}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  onReset={handleReset}
                />
              </div>
              <div className="w-full max-w-[480px] flex flex-col gap-1.5">
                <label
                  htmlFor="board-notes"
                  className="text-sm font-medium flex items-center gap-1.5"
                >
                  <NotebookPen className="size-4" />
                  Note
                </label>
                <Textarea
                  id="board-notes"
                  value={notesDraft}
                  onChange={handleNotesChange}
                  onBlur={handleNotesBlur}
                  placeholder="Note libere per questa scacchiera..."
                  rows={6}
                  className="resize-y"
                />
              </div>
            </>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <p>
                Seleziona o crea una scacchiera dalla sidebar per iniziare.
              </p>
            </div>
          )}
        </section>

        {/* Destra: mosse */}
        <aside className="w-full lg:w-64 shrink-0">
          {selectedBoard ? (
            <MoveNotation
              moves={chess.moveHistory}
              currentMoveIndex={chess.historyIndex}
              onGoToMove={chess.goToMove}
            />
          ) : (
            <div className="text-sm text-muted-foreground">
              -
            </div>
          )}
        </aside>
      </div>

      {/* Dialog modifica lezione */}
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
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
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

      {/* Dialog elimina lezione */}
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

      {/* Dialog rinomina scacchiera */}
      <Dialog open={editBoardOpen} onOpenChange={setEditBoardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rinomina scacchiera</DialogTitle>
            <DialogDescription>
              Modifica il titolo della scacchiera.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveBoardTitle} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="edit-board-title" className="text-sm font-medium">
                Titolo
              </label>
              <Input
                id="edit-board-title"
                value={editBoardTitle}
                onChange={(e) => setEditBoardTitle(e.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!editBoardTitle.trim()}>
                Salva
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog conferma eliminazione scacchiera */}
      <Dialog open={deleteBoardOpen} onOpenChange={setDeleteBoardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina scacchiera</DialogTitle>
            <DialogDescription>
              {deleteBoardId != null &&
              boards.some((b) => b.id === deleteBoardId) ? (
                <>
                  Eliminare &ldquo;
                  {boards.find((b) => b.id === deleteBoardId)?.title}
                  &rdquo;? L&apos;operazione non è reversibile.
                </>
              ) : (
                "Eliminare questa scacchiera? L&apos;operazione non è reversibile."
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteBoardOpen(false);
                setDeleteBoardId(null);
              }}
            >
              Annulla
            </Button>
            <Button variant="destructive" onClick={confirmDeleteBoard}>
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
