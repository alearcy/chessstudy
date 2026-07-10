import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2, NotebookPen } from "lucide-react";
import { getLesson, updateLesson, deleteLesson, convertAnalysisToStudy } from "@/services/lessonService";
import {
  getBoard,
  getBoardsByLesson,
  createBoard,
  updateBoard,
  deleteBoard,
} from "@/services/boardService";
import {
  getMovesByBoard,
  createMove,
  updateMove,
  deleteMovesFromOrder,
  deleteMovesByBoard,
} from "@/services/moveService";
import type { Lesson, LessonFormData, Board, BoardArrow, Move } from "@/types";
import type { Square } from "chess.js";
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
import EvalBar from "@/components/analysis/EvalBar";
import MoveNotation from "@/components/board/MoveNotation";
import ImportPgnDialog from "@/components/board/ImportPgnDialog";
import PgnHeadersSidebar from "@/components/board/PgnHeadersSidebar";
import ErrorNotice from "@/components/ErrorNotice";
import {
  analyzePositions,
  getStockfishSettings,
  uciToArrow,
  toEvalFields,
  evalScore,
  moveClassification,
  type PositionEval,
} from "@/services/analysisService";
import { explainMoveRuleBased, formatDiagnosisHint } from "@/services/explainService";
import { diagnoseCriticalMoves, type Diagnosis } from "@/services/coachDiagnostics";
import { Chess } from "chess.js";
import MoveCommentPreview from "@/components/lesson/MoveCommentPreview";
import StudyBoardSidebar from "@/components/lesson/StudyBoardSidebar";
import {
  formatEvalForPrompt,
  getKingStatus,
  sanToSquare,
  uciToSan,
} from "@/lib/lessonDetailUtils";
import { useMoveKeyboardNavigation } from "@/hooks/useMoveKeyboardNavigation";

const SAVE_DEBOUNCE_MS = 800;

function stockfishCommentForMove(args: {
  move: Move;
  cpLoss: number;
  bestSan: string | null;
}): string {
  const cls = moveClassification(args.cpLoss);
  const classification =
    cls?.label === "??" ? "errore grave" :
    cls?.label === "?" ? "errore" :
    cls?.label === "?!" ? "imprecisione" :
    args.cpLoss <= -50 ? "buona risorsa" :
    "mossa solida";
  const swing =
    Math.abs(args.cpLoss) >= 250
      ? ", la posizione peggiora molto"
      : Math.abs(args.cpLoss) >= 120
        ? ", la posizione peggiora in modo importante"
        : Math.abs(args.cpLoss) >= 25
          ? ", la posizione peggiora leggermente"
      : ", posizione quasi invariata";
  const best =
    args.bestSan && args.bestSan !== args.move.moveNotation
      ? ` La continuazione piu precisa era ${args.bestSan}.`
      : " La mossa giocata coincide con la scelta principale o resta pienamente giocabile.";

  return `Analisi: ${args.move.moveNotation} - ${classification}.${swing}.${best}`;
}

function evalPositionLabel(cp: number | null, mate: number | null) {
  if (mate !== null) return mate > 0 ? "Bianco decisivo" : "Nero decisivo";
  if (cp === null || Math.abs(cp) < 40) return "equilibrio";
  if (cp > 0) return cp >= 180 ? "Bianco meglio" : "Bianco leggermente meglio";
  return cp <= -180 ? "Nero meglio" : "Nero leggermente meglio";
}

function uciToChessMove(uci: string) {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return null;
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci[4],
  };
}

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
  const [resetOpen, setResetOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [movePersistencePending, setMovePersistencePending] = useState(false);
  const [movePersistenceError, setMovePersistenceError] = useState<string | null>(null);
  const [mateLinePreviewFen, setMateLinePreviewFen] = useState<string | null>(null);
  const [mateLineStatus, setMateLineStatus] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [stockfishDepth, setStockfishDepth] = useState<number | null>(null);
  const analysisSignalRef = useRef<{ cancelled: boolean } | null>(null);
  const [noteTab, setNoteTab] = useState<"board" | "move">("board");
  const [moveCommentDraft, setMoveCommentDraft] = useState("");

  const chess = useChessBoard();
  useMoveKeyboardNavigation({ undo: chess.undo, redo: chess.redo });
  const initializedRef = useRef<number | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");
  const moveCommentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mateLineTimerRef = useRef<number | null>(null);
  const lastSavedCommentRef = useRef<string>("");
  const commentMoveIdRef = useRef<number | null>(null);
  const persistedMoveIdsByOrderRef = useRef<Map<number, number>>(new Map());
  const movePersistenceQueueRef = useRef<Promise<void>>(Promise.resolve());
  const movePersistencePendingRef = useRef(false);
  const selectedBoardIdRef = useRef<number | null>(selectedBoardId);
  selectedBoardIdRef.current = selectedBoardId;

const selectedBoard = useMemo(
    () => boards.find((b) => b.id === selectedBoardId) ?? null,
    [boards, selectedBoardId]
  );

  // Inizializza l'hook scacchiera quando viene selezionata una nuova board:
  // carica il FEN di partenza, le mosse persistite e le annotazioni di partenza.
  useEffect(() => {
    if (!selectedBoard) return;
    // Forza il reload se initializedRef.current è null (ad esempio dopo PGN import)
    if (initializedRef.current === null || initializedRef.current !== selectedBoard.id) {
      initializedRef.current = selectedBoard.id ?? null;
      getMovesByBoard(selectedBoard.id!)
        .then((loadedMoves) => {
          persistedMoveIdsByOrderRef.current = new Map(
            loadedMoves.flatMap((m) => (m.id == null ? [] : [[m.order, m.id]]))
          );
          chess.loadSequence(
            selectedBoard.fen,
            loadedMoves,
            selectedBoard.arrows,
            selectedBoard.highlights
          );
        })
        .catch((e) => {
          console.error("[moves-load] errore", e);
          setActionError("Impossibile caricare le mosse della scacchiera.");
        });
    }
  }, [selectedBoard, chess.loadSequence]);

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
    setMovePersistenceError(null);
    if (moveCommentTimerRef.current) {
      clearTimeout(moveCommentTimerRef.current);
      moveCommentTimerRef.current = null;
    }
    const board = boards.find((b) => b.id === selectedBoardId);
    const notes = board?.notes ?? "";
    setNotesDraft(notes);
    lastSavedRef.current = notes;
    setNoteTab("board");
  }, [selectedBoardId, boards]);

  // Sincronizza il draft del commento mossa quando cambia la mossa corrente.
  // Dipende solo da historyIndex e dall'id della mossa (NON dal commento),
  // altrimenti l'editing resetterebbe lastSavedCommentRef e bloccherebbe il salvataggio.
  useEffect(() => {
    // Flush del commento pendente della mossa precedente.
    if (moveCommentTimerRef.current) {
      clearTimeout(moveCommentTimerRef.current);
      moveCommentTimerRef.current = null;
      if (commentMoveIdRef.current != null) {
        void saveMoveComment(commentMoveIdRef.current, moveCommentDraft);
      }
    }
    const cm = chess.currentMove;
    const comment = cm?.comment ?? "";
    setMoveCommentDraft(comment);
    lastSavedCommentRef.current = comment;
    commentMoveIdRef.current = cm?.id ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chess.historyIndex, chess.currentMove?.id]);

  // Se non c'è una mossa corrente (posizione di partenza), torna al tab "board".
  useEffect(() => {
    if (chess.historyIndex === 0 && noteTab === "move") {
      setNoteTab("board");
    }
  }, [chess.historyIndex, noteTab]);

  const loadData = useCallback(async () => {
    setPageError(null);
    try {
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
      // Mantiene la selezione se valida, altrimenti seleziona la prima.
      setSelectedBoardId((prev) => {
        if (prev != null && loadedBoards.some((b) => b.id === prev)) return prev;
        return loadedBoards[0]?.id ?? null;
      });
    } catch (e) {
      console.error("[lesson-load] errore", e);
      setPageError("Impossibile caricare la lezione.");
    } finally {
      setLoading(false);
    }
  }, [lessonId, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const loadStockfishDepth = () => {
      void getStockfishSettings().then((settings) => {
        setStockfishDepth(settings.stockfish_depth);
      });
    };
    loadStockfishDepth();
    window.addEventListener("stockfish-settings-changed", loadStockfishDepth);
    return () =>
      window.removeEventListener("stockfish-settings-changed", loadStockfishDepth);
  }, []);

  // Auto-analisi Stockfish in modalità Analysis all'ingresso.
  // Salta se tutte le posizioni hanno già eval persistito.
  const autoAnalysisDoneRef = useRef(false);
  useEffect(() => {
    if (
      lesson?.mode === "analysis" &&
      selectedBoard &&
      chess.moves.length > 0 &&
      !autoAnalysisDoneRef.current &&
      !analyzing
    ) {
      // Controlla se l'analisi è già stata fatta (eval presente su board e mosse).
      const boardHasEval =
        selectedBoard.evalCp != null || selectedBoard.evalMate != null;
      const allMovesHaveEval = chess.moves.every(
        (m) => m.evalCp != null || m.evalMate != null
      );
      if (!boardHasEval || !allMovesHaveEval) {
        autoAnalysisDoneRef.current = true;
        handleAnalyze();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.mode, selectedBoard?.id, chess.moves.length]);

  // Salvataggio note: blur immediato + debounce su digitazione.
  const saveNotes = useCallback(
    async (next: string) => {
      if (!selectedBoardId || next === lastSavedRef.current) return;
      try {
        await updateBoard(selectedBoardId, { notes: next });
        lastSavedRef.current = next;
        setActionError(null);
      } catch (e) {
        console.error("[board-notes-save] errore", e);
        setActionError("Salvataggio note scacchiera fallito.");
      }
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

  // Salvataggio commento mossa: blur immediato + debounce su digitazione.
  const saveMoveComment = useCallback(
    async (moveId: number | null, next: string) => {
      if (moveId == null || next === lastSavedCommentRef.current) return;
      try {
        await updateMove(moveId, { comment: next });
        lastSavedCommentRef.current = next;
        setActionError(null);
      } catch (e) {
        console.error("[move-comment-save] errore", e);
        setActionError("Salvataggio commento mossa fallito.");
      }
    },
    []
  );

  const scheduleDebouncedMoveComment = useCallback(
    (moveId: number | null, next: string) => {
      if (moveCommentTimerRef.current)
        clearTimeout(moveCommentTimerRef.current);
      moveCommentTimerRef.current = setTimeout(() => {
        saveMoveComment(moveId, next);
      }, SAVE_DEBOUNCE_MS);
    },
    [saveMoveComment]
  );

  const handleMoveCommentChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const next = e.target.value;
    setMoveCommentDraft(next);
    // Aggiorna lo stato in memoria per mostrare subito l'indicatore commento.
    const idx = chess.historyIndex - 1;
    if (idx >= 0) chess.setMoveComment(idx, next);
    scheduleDebouncedMoveComment(commentMoveIdRef.current, next);
  };

  const handleMoveCommentBlur = () => {
    if (moveCommentTimerRef.current)
      clearTimeout(moveCommentTimerRef.current);
    saveMoveComment(commentMoveIdRef.current, moveCommentDraft);
  };

  // --- Persistenza frecce / evidenziazioni (per posizione corrente) ---
  // Le annotazioni della posizione di partenza sono persistite su Board,
  // quelle di ogni mossa su Move. La persistenza è immediata ( eventi
  // discreti: un tracciato = una freccia, un click = un toggle).
  const pendingAnnotationsRef = useRef<{
    arrows: BoardArrow[];
    highlights: string[];
  } | null>(null);
  // Refs aggiornate ogni render per leggere i valori correnti nei handler.
  const currentArrowsRef = useRef(chess.currentArrows);
  currentArrowsRef.current = chess.currentArrows;
  const currentHighlightsRef = useRef(chess.currentHighlights);
  currentHighlightsRef.current = chess.currentHighlights;

  const persistAnnotations = (
    arrows: BoardArrow[],
    highlights: string[]
  ) => {
    if (!selectedBoardId) return;
    if (chess.historyIndex === 0) {
      void updateBoard(selectedBoardId, { arrows, highlights }).catch((e) => {
        console.error("[board-annotations-save] errore", e);
        setActionError("Salvataggio annotazioni fallito.");
      });
      // Mantiene lo stato boards allineato (per il caricamento successivo).
      syncBoardInList(selectedBoardId, { arrows, highlights });
    } else {
      const moveId = chess.currentMove?.id;
      if (moveId == null) {
        // La mossa è ancora un placeholder non persistita: ritenta quando
        // arriva l'id (vedi effect sotto).
        pendingAnnotationsRef.current = { arrows, highlights };
        return;
      }
      void updateMove(moveId, { arrows, highlights }).catch((e) => {
        console.error("[move-annotations-save] errore", e);
        setActionError("Salvataggio annotazioni fallito.");
      });
    }
  };

  // Flush delle annotazioni pendenti quando la mossa corrente ottiene un id.
  useEffect(() => {
    const moveId = chess.currentMove?.id;
    if (moveId != null && pendingAnnotationsRef.current) {
      const { arrows, highlights } = pendingAnnotationsRef.current;
      pendingAnnotationsRef.current = null;
      void updateMove(moveId, { arrows, highlights }).catch((e) => {
        console.error("[pending-annotations-save] errore", e);
        setActionError("Salvataggio annotazioni fallito.");
      });
    }
  }, [chess.currentMove?.id]);

  const handleArrowsChange = (next: BoardArrow[]) => {
    // Chessground reporta la lista completa delle frecce disegnate: accettare
    // anche lista vuota abilita la cancellazione singola/totale dal layer draw.
    const seen = new Set<string>();
    const merged = next.filter((a) => {
      const key = `${a[0]}-${a[1]}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    chess.setArrows(merged);
    persistAnnotations(merged, currentHighlightsRef.current);
  };

  const handleHighlightsChange = (next: string[]) => {
    chess.setHighlights(next);
    persistAnnotations(currentArrowsRef.current, next);
  };

  const handleClearArrows = () => {
    chess.setArrows([]);
    persistAnnotations([], currentHighlightsRef.current);
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

  const reloadBoardFromDb = useCallback(
    async (boardId: number) => {
      const [freshBoard, freshMoves] = await Promise.all([
        getBoard(boardId),
        getMovesByBoard(boardId),
      ]);
      if (!freshBoard) return;
      persistedMoveIdsByOrderRef.current = new Map(
        freshMoves.flatMap((m) => (m.id == null ? [] : [[m.order, m.id]]))
      );
      syncBoardInList(boardId, freshBoard);
      chess.loadSequence(
        freshBoard.fen,
        freshMoves,
        freshBoard.arrows ?? [],
        freshBoard.highlights ?? []
      );
    },
    [chess.loadSequence, syncBoardInList]
  );

  const handleMove = useCallback(
    (from: Square, to: Square): boolean => {
      if (movePersistencePendingRef.current) return false;
      const result = chess.makeMove(from, to);
      if (!result || !selectedBoardId) return !!result;
      const boardId = selectedBoardId;
      const moveIdsByOrder = new Map(persistedMoveIdsByOrderRef.current);
      for (const order of moveIdsByOrder.keys()) {
        if (order >= result.newMoveIndex) {
          moveIdsByOrder.delete(order);
        }
      }
      const parentId =
        result.newMoveIndex > 0
          ? (moveIdsByOrder.get(result.newMoveIndex - 1) ?? null)
          : null;
      movePersistencePendingRef.current = true;
      setMovePersistencePending(true);
      setMovePersistenceError(null);

      movePersistenceQueueRef.current = movePersistenceQueueRef.current.then(async () => {
        // Tronca eventuali mosse future (UI lineare).
        await deleteMovesFromOrder(boardId, result.newMoveIndex);
        const id = await createMove({
          boardId,
          parentId,
          order: result.newMoveIndex,
          moveNotation: result.san,
          fen: result.fen,
          comment: "",
          arrows: [],
          highlights: [],
        });
        moveIdsByOrder.set(result.newMoveIndex, id);
        const persistedMove: Move = {
          id,
          boardId,
          parentId,
          order: result.newMoveIndex,
          moveNotation: result.san,
          fen: result.fen,
          comment: "",
          arrows: [],
          highlights: [],
          createdAt: new Date(),
        };
        if (selectedBoardIdRef.current === boardId) {
          persistedMoveIdsByOrderRef.current = moveIdsByOrder;
          chess.replaceMove(result.newMoveIndex, persistedMove);
        }
      }).catch((e) => {
        console.error("[move-persistence] errore", e);
        setMovePersistenceError(
          "Salvataggio mossa fallito. La scacchiera e stata ricaricata dai dati salvati."
        );
        if (selectedBoardIdRef.current === boardId) {
          void reloadBoardFromDb(boardId);
        }
      }).finally(() => {
        movePersistencePendingRef.current = false;
        setMovePersistencePending(false);
      });
      return true;
    },
    [chess, reloadBoardFromDb, selectedBoardId]
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
    setActionError(null);
    try {
      await updateLesson(lessonId, form);
      await loadData();
      setEditOpen(false);
    } catch (e) {
      console.error("[lesson-save] errore", e);
      setActionError("Salvataggio lezione fallito.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteLesson(lessonId);
      navigate("/", { replace: true });
    } catch (e) {
      console.error("[lesson-delete] errore", e);
      setActionError("Eliminazione lezione fallita.");
    }
  };

  const handleCreateBoard = async () => {
    try {
      const boardId = await createBoard(lessonId);
      await loadData();
      setSelectedBoardId(boardId);
    } catch (e) {
      console.error("[board-create] errore", e);
      setActionError("Creazione scacchiera fallita.");
    }
  };

  const handleImportPgn = async (boardId: number) => {
    try {
      await loadData();
      // Forza il ricaricamento della sequenza anche se la board era già selezionata.
      initializedRef.current = null;
      setSelectedBoardId(boardId);

      // Reset auto-analysis flag to ensure it runs after import
      autoAnalysisDoneRef.current = false;
    } catch (e) {
      console.error("[pgn-import-refresh] errore", e);
      setActionError("Import completato, ma aggiornamento lezione fallito.");
    }
  };

  // --- Helper: genera spunti educativi separati per tutte le mosse ---
  // Usa gli eval freschi e persiste in `analysisComment`, senza modificare
  // il commento utente/PGN o il commento Stockfish.
  const persistEducationalComments = useCallback(
    async (
      startFen: string,
      moveList: Move[],
      evals: PositionEval[],
      board: Board,
      diagnosticsByIndex: Map<number, Diagnosis>
    ) => {
      for (let i = 0; i < moveList.length; i++) {
        const move = moveList[i];
        if (move.id == null) continue;
        const playedBy: "w" | "b" = i % 2 === 0 ? "w" : "b";
        const beforeFen = i === 0 ? startFen : moveList[i - 1]?.fen ?? startFen;
        const beforeEval = {
          cp: evals[i].scoreCp,
          mate: evals[i].scoreMate,
          depth: evals[i].depth,
          bestMoveUci: evals[i].bestMoveUci,
        };
        const afterEval = {
          cp: evals[i + 1].scoreCp,
          mate: evals[i + 1].scoreMate,
          depth: evals[i + 1].depth,
        };

        try {
          const exp = explainMoveRuleBased({
            beforeFen,
            afterFen: move.fen,
            playedMoveSan: move.moveNotation,
            playedBy,
            whiteName: board.whiteName ?? null,
            blackName: board.blackName ?? null,
            beforeEval,
            afterEval,
          });
          const hasEducationalValue =
            exp.severity === "inaccuracy" ||
            exp.severity === "mistake" ||
            exp.severity === "blunder" ||
            exp.tactics.length > 0;
          const explanationText = hasEducationalValue
            ? exp.details.join("\n")
            : null;
          const diagnosis = diagnosticsByIndex.get(i);
          const diagnosisHint = diagnosis
            ? formatDiagnosisHint(diagnosis, explanationText ?? "")
            : null;
          const commentText = [explanationText, diagnosisHint]
            .filter((text): text is string => Boolean(text?.trim()))
            .join("\n") || null;
          const tacticalHighlights = Array.from(
            new Set(hasEducationalValue ? exp.tactics.flatMap((tactic) => tactic.squares) : [])
          );
          await updateMove(move.id, {
            analysisComment: commentText,
            highlights: tacticalHighlights,
          });
          chess.setMoveAnalysisComment(i, commentText);
          chess.setMoveHighlights(i, tacticalHighlights);
        } catch {
          // non critico
        }
      }
    },
    []
  );

  // --- Analisi Stockfish ---
  // Posizioni da analizzare: posizione di partenza (Board.fen) + dopo ogni mossa.
  const handleAnalyze = async () => {
    if (!selectedBoard || analyzing) return;
    const boardId = selectedBoard.id;
    if (boardId == null) return;
    const startFen = selectedBoard.fen;
    const moveList = chess.moves;
    const fens = [startFen, ...moveList.map((m) => m.fen)];
    const signal = { cancelled: false };
    analysisSignalRef.current = signal;
    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysisProgress({ done: 0, total: fens.length });
    try {
      const evals: PositionEval[] = await analyzePositions(fens, {
        signal,
        onProgress: (done, total) => setAnalysisProgress({ done, total }),
      });
      if (signal.cancelled) return;

      // Persistenza SOLO su DB. Non toccare chess.moves qui: l'array
      // catturato nella closure è stale e i replaceMove sovrascriverebbero
      // gli eval con valori vecchi. Ricarichiamo tutto dal DB alla fine.
      await updateBoard(boardId, toEvalFields(evals[0]));
      const diagnosticMoves = moveList.map((m, moveIndex) => {
        const isWhite = moveIndex % 2 === 0;
        const beforeEval = evals[moveIndex];
        const afterEval = evals[moveIndex + 1];
        const beforeCp = beforeEval.scoreCp;
        const beforeMate = beforeEval.scoreMate;
        const afterCp = afterEval.scoreCp;
        const afterMate = afterEval.scoreMate;
        const beforeScore = evalScore(beforeCp, beforeMate);
        const afterScore = evalScore(afterCp, afterMate);
        const cpLoss = isWhite ? beforeScore - afterScore : afterScore - beforeScore;
        const cls = moveClassification(cpLoss);
        const beforeFen = moveIndex === 0 ? startFen : moveList[moveIndex - 1]?.fen ?? startFen;
        const bestSan = beforeEval.bestMoveUci ? uciToSan(beforeFen, beforeEval.bestMoveUci) : null;

        return {
          moveNumber: Math.floor(moveIndex / 2) + 1,
          index: moveIndex,
          fenBefore: beforeFen,
          fenAfter: m.fen,
          san: m.moveNotation,
          player: isWhite ? selectedBoard.whiteName ?? "Bianco" : selectedBoard.blackName ?? "Nero",
          evalBefore: formatEvalForPrompt(beforeCp, beforeMate),
          evalAfter: formatEvalForPrompt(afterCp, afterMate),
          evalBeforeCp: beforeCp,
          evalAfterCp: afterCp,
          classification:
            cls?.label === "??" ? "ERRORE GRAVE" :
            cls?.label === "?" ? "ERRORE" :
            cls?.label === "?!" ? "IMPRECISIONE" :
            "OK",
          bestSan,
          bestMoveLan: beforeEval.bestMoveUci ?? null,
          stockfishComment: null,
        };
      });
      const diagnosticsByIndex = new Map(
        diagnoseCriticalMoves(diagnosticMoves).map((move) => [move.index, move.diagnosis])
      );

      for (let i = 1; i < evals.length; i++) {
        const move = moveList[i - 1];
        if (move.id == null) continue;
        const beforeEval = evals[i - 1];
        const afterEval = evals[i];
        const isWhite = (i - 1) % 2 === 0;
        const beforeScore = evalScore(beforeEval.scoreCp, beforeEval.scoreMate);
        const afterScore = evalScore(afterEval.scoreCp, afterEval.scoreMate);
        const cpLoss = isWhite ? beforeScore - afterScore : afterScore - beforeScore;
        const beforeFen = i === 1 ? startFen : moveList[i - 2]?.fen;
        const bestSan = beforeEval.bestMoveUci && beforeFen
          ? uciToSan(beforeFen, beforeEval.bestMoveUci)
          : null;

        await updateMove(move.id, {
          ...toEvalFields(afterEval),
          analysisComment: null,
          stockfishComment: stockfishCommentForMove({
            move,
            cpLoss,
            bestSan,
          }),
        });
      }

      // Genera commenti rule-based usando evals freschi (non chess.moves).
      if (!signal.cancelled) {
        await persistEducationalComments(startFen, moveList, evals, {
          ...selectedBoard,
          ...toEvalFields(evals[0]),
        }, diagnosticsByIndex);
      }

      // Ricarica board + mosse dal DB in un colpo solo: questo è l'esatto
      // path che funziona quando esci/rientri nella pagina.
      if (!signal.cancelled) {
        const [freshBoard, freshMoves] = await Promise.all([
          getBoard(boardId),
          getMovesByBoard(boardId),
        ]);
        if (freshBoard) {
          syncBoardInList(boardId, {
            evalCp: freshBoard.evalCp,
            evalMate: freshBoard.evalMate,
            evalDepth: freshBoard.evalDepth,
            evalBestMoveUci: freshBoard.evalBestMoveUci,
          });
          chess.loadSequence(
            freshBoard.fen,
            freshMoves,
            freshBoard.arrows ?? [],
            freshBoard.highlights ?? []
          );
        }
      }
    } catch (e) {
      console.error("[analyze] errore", e);
      setAnalysisError("Analisi Stockfish fallita. Controlla il motore e riprova.");
    } finally {
      setAnalyzing(false);
      setAnalysisProgress(null);
      analysisSignalRef.current = null;
    }
  };

  const handleCancelAnalysis = () => {
    if (analysisSignalRef.current) analysisSignalRef.current.cancelled = true;
  };

  // Eval della posizione corrente + freccia miglior mossa (overlay).
  const currentEvalCp =
    chess.historyIndex === 0
      ? (selectedBoard?.evalCp ?? null)
      : (chess.currentMove?.evalCp ?? null);
  const currentEvalMate =
    chess.historyIndex === 0
      ? (selectedBoard?.evalMate ?? null)
      : (chess.currentMove?.evalMate ?? null);
  const currentEvalDepth =
    chess.historyIndex === 0
      ? (selectedBoard?.evalDepth ?? 0)
      : (chess.currentMove?.evalDepth ?? 0);
  const currentBestMoveUci =
    chess.historyIndex === 0
      ? (selectedBoard?.evalBestMoveUci ?? null)
      : (chess.currentMove?.evalBestMoveUci ?? null);
  const analysisArrow: BoardArrow[] = (() => {
    // In modalità Analisi (historyIndex > 0): mostra la best move della
    // posizione PRECEDENTE — cosa Stockfish suggeriva al giocatore che ha mosso.
    // In modalità Studio o posizione iniziale: mostra la best move corrente.
    if (lesson?.mode === "analysis" && chess.historyIndex > 0) {
      const prevIdx = chess.historyIndex - 1;
      const prevBest =
        prevIdx === 0
          ? (selectedBoard?.evalBestMoveUci ?? null)
          : (chess.moves[prevIdx - 1]?.evalBestMoveUci ?? null);
      if (!prevBest) return [];
      const a = uciToArrow(prevBest);
      return a ? [[a[0], a[1], "rgb(59,130,246)"]] : [];
    }

    if (!currentBestMoveUci) return [];
    const a = uciToArrow(currentBestMoveUci);
    return a ? [[a[0], a[1], "rgb(59,130,246)"]] : [];
  })();

  // Casa di destinazione + badge classificazione (??, ?, ?!) per il pezzo mosso.
  const lastMoveSquare = useMemo((): Square | null => {
    if (chess.historyIndex === 0) return null;
    const move = chess.currentMove;
    if (!move) return null;
    // La mossa corrente è stata fatta da chi TOCCA ORA (chess.turn),
    // quindi il giocatore che ha mosso è l'avversario del turno corrente.
    const isBlackMove = chess.turn === "b";
    const sq = sanToSquare(move.moveNotation, isBlackMove);

    return sq as Square | null;
  }, [chess.historyIndex, chess.currentMove]);

  // Casa di partenza (origin) dell'ultima mossa, per evidenziarla.
  // Replay SAN sulla posizione precedente alla mossa corrente per ottenere `.from`.
  const lastMoveFromSquare = useMemo((): Square | null => {
    if (chess.historyIndex === 0) return null;
    const move = chess.currentMove;
    if (!move) return null;
    const prevFen = chess.history[chess.historyIndex - 1];
    if (!prevFen) return null;
    try {
      const replay = new Chess(prevFen);
      const played = replay.move(move.moveNotation);
      return (played?.from as Square | undefined) ?? null;
    } catch {
      return null;
    }
  }, [chess.historyIndex, chess.currentMove, chess.history]);

  const kingStatus = useMemo(
    () => getKingStatus(chess.fen),
    [chess.fen]
  );

  const moveBadge = useMemo(() => {
    const i = chess.historyIndex - 1;
    if (i < 0) { return null; }
    const move = chess.currentMove;
    if (!move) { return null; }

    // Eval prima della mossa
    let beforeCp: number | null;
    let beforeMate: number | null;
    if (i === 0) {
      beforeCp = selectedBoard?.evalCp ?? null;
      beforeMate = selectedBoard?.evalMate ?? null;
    } else {
      beforeCp = chess.moves[i - 1]?.evalCp ?? null;
      beforeMate = chess.moves[i - 1]?.evalMate ?? null;
    }

    // Eval dopo la mossa
    const afterCp = move.evalCp ?? null;
    const afterMate = move.evalMate ?? null;

    // Se manca uno dei due eval, non possiamo calcolare il cpLoss
    if (
      (beforeCp == null && beforeMate == null) ||
      (afterCp == null && afterMate == null)
    ) {
      return null;
    }

    const beforeScore = evalScore(beforeCp, beforeMate); // POV Bianco
    const afterScore = evalScore(afterCp, afterMate); // POV Bianco

    // cpLoss POV del giocatore che ha mosso.
    // Dopo una mossa nera, il turno è del bianco → chi ha mosso è il nero.
    const moverIsBlack = chess.turn === "w";
    const cpLoss = moverIsBlack ? afterScore - beforeScore : beforeScore - afterScore;

    // isBestMove
    let isBestMove = false;
    const bestUciBefore = i === 0
      ? selectedBoard?.evalBestMoveUci ?? null
      : chess.moves[i - 1]?.evalBestMoveUci ?? null;
    const fenBefore = i === 0 ? selectedBoard?.fen : chess.moves[i - 1]?.fen;
    if (bestUciBefore && fenBefore) {
      try {
        const c = new Chess(fenBefore);
        const result = c.move(bestUciBefore);
        const cleanSan = (s: string) => s.replace(/[+#]$/, "");
        isBestMove = cleanSan(result.san) === cleanSan(move.moveNotation);
      } catch {
        isBestMove = false;
      }
    }

    const cls = moveClassification(cpLoss, isBestMove);

    return cls;
  }, [chess.historyIndex, chess.currentMove, chess.moves, selectedBoard]);

  const handleEditBoardClick = (board: Board, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditBoardId(board.id ?? null);
    setEditBoardTitle(board.title);
    setEditBoardOpen(true);
  };

  const handleSaveBoardTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBoardId || !editBoardTitle.trim()) return;
    try {
      await updateBoard(editBoardId, { title: editBoardTitle.trim() });
      syncBoardInList(editBoardId, { title: editBoardTitle.trim() });
      setEditBoardOpen(false);
      setActionError(null);
    } catch (e) {
      console.error("[board-title-save] errore", e);
      setActionError("Rinomina scacchiera fallita.");
    }
  };

  const [converting, setConverting] = useState(false);
  const [flipped, setFlipped] = useState(false);

  const handleFlip = useCallback(() => setFlipped((f) => !f), []);

  const handleConvertToStudy = useCallback(async () => {
    if (!lesson || !selectedBoard?.id) return;
    setConverting(true);
    try {
      const moves = await getMovesByBoard(selectedBoard.id);
      const newLessonId = await convertAnalysisToStudy(lesson, selectedBoard, moves);
      navigate(`/lesson/${newLessonId}`);
      setActionError(null);
    } catch (e) {
      console.error("[analysis-convert] errore", e);
      setActionError("Conversione in lezione studio fallita.");
    } finally {
      setConverting(false);
    }
  }, [lesson, selectedBoard, navigate]);

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
    try {
      await deleteBoard(boardId);
      // Ricarica e ricalcola la selezione.
      const updatedBoards = await getBoardsByLesson(lessonId);
      setBoards(updatedBoards);
      if (selectedBoardId === boardId) {
        setSelectedBoardId(updatedBoards[0]?.id ?? null);
        initializedRef.current = null;
      }
      setActionError(null);
    } catch (e) {
      console.error("[board-delete] errore", e);
      setActionError("Eliminazione scacchiera fallita.");
    }
  };

  const handleUndo = () => {
    chess.undo();
  };

  const handleRedo = () => {
    chess.redo();
  };

  const handleReset = () => {
    if (lesson?.mode === "analysis") {
      chess.goToMove(0);
      return;
    }
    setResetOpen(true);
  };

  const confirmReset = async () => {
    if (!selectedBoard || !selectedBoardId) return;
    try {
      await deleteMovesByBoard(selectedBoardId);
      persistedMoveIdsByOrderRef.current = new Map();
      chess.reset(selectedBoard.fen);
      setResetOpen(false);
      setActionError(null);
    } catch (e) {
      console.error("[board-reset] errore", e);
      setActionError("Ripristino scacchiera fallito.");
    }
  };

  const clearMateLinePreview = useCallback(() => {
    if (mateLineTimerRef.current !== null) {
      window.clearTimeout(mateLineTimerRef.current);
      mateLineTimerRef.current = null;
    }
    setMateLinePreviewFen(null);
    setMateLineStatus(null);
  }, []);

  useEffect(() => clearMateLinePreview, [clearMateLinePreview]);

  const handleMateLineClick = useCallback(
    async (mateIn: number) => {
      const startFen = chess.currentMove?.fen;
      if (!startFen) return;

      if (mateLineTimerRef.current !== null) {
        window.clearTimeout(mateLineTimerRef.current);
        mateLineTimerRef.current = null;
      }

      setMateLinePreviewFen(startFen);
      setMateLineStatus("Calcolo la linea di matto...");

      try {
        const game = new Chess(startFen);
        const fens = [startFen];
        const maxPlies = Math.max(1, mateIn * 2 - 1);

        for (let ply = 0; ply < maxPlies && !game.isGameOver(); ply += 1) {
          const [ev] = await analyzePositions([game.fen()], { depth: Math.max(currentEvalDepth, 12) });
          const move = ev.bestMoveUci ? uciToChessMove(ev.bestMoveUci) : null;
          if (!move) break;

          const played = game.move(move);
          if (!played) break;
          fens.push(game.fen());
          if (game.isCheckmate()) break;
        }

        if (fens.length <= 1) {
          setMateLineStatus("Linea di matto non disponibile.");
          return;
        }

        setMateLineStatus(`Linea di matto: 1/${fens.length - 1}`);
        fens.slice(1).forEach((fen, index) => {
          mateLineTimerRef.current = window.setTimeout(() => {
            setMateLinePreviewFen(fen);
            setMateLineStatus(`Linea di matto: ${index + 1}/${fens.length - 1}`);
          }, (index + 1) * 700);
        });
      } catch (error) {
        console.error("[mate-line-preview] errore", error);
        setMateLineStatus("Impossibile calcolare la linea di matto.");
      }
    },
    [chess.currentMove?.fen, currentEvalDepth]
  );


  if (loading) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        Caricamento...
      </div>
    );
  }

  if (!lesson) {
    return pageError ? (
      <div className="w-full">
        <Button
          variant="ghost"
          size="sm"
          className="mb-3"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="size-4" />
          <span className="ml-1">Lezioni</span>
        </Button>
        <ErrorNotice
          message={pageError}
          onRetry={loadData}
          onDismiss={() => setPageError(null)}
        />
      </div>
    ) : null;
  }

  return (
    <div
      className={
        lesson.mode === "analysis"
          ? "w-full xl:flex xl:h-[calc(100dvh-6rem)] xl:min-h-0 xl:flex-col xl:overflow-hidden"
          : "w-full"
      }
    >
      <Button
        variant="ghost"
        size="sm"
        className="mb-3 self-start"
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
          {lesson.description && lesson.mode !== "analysis" && (
            <p className="text-muted-foreground mt-1 text-sm">
              {lesson.description}
            </p>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2">
        {pageError && (
          <ErrorNotice
            message={pageError}
            onRetry={loadData}
            onDismiss={() => setPageError(null)}
          />
        )}
        {actionError && (
          <ErrorNotice
            message={actionError}
            onDismiss={() => setActionError(null)}
          />
        )}
        {analysisError && (
          <ErrorNotice
            title="Stockfish"
            message={analysisError}
            onRetry={handleAnalyze}
            onDismiss={() => setAnalysisError(null)}
          />
        )}
      </div>

      {(movePersistencePending || movePersistenceError) && (
        <div
          className={`mb-4 rounded-md border px-3 py-2 text-sm ${
            movePersistenceError
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-input bg-muted/50 text-muted-foreground"
          }`}
        >
          {movePersistenceError ?? "Salvataggio mossa..."}
        </div>
      )}

      {lesson.mode === "analysis" && selectedBoard ? (
        <div className="grid grid-cols-1 gap-4 items-start xl:min-h-0 xl:flex-1 xl:overflow-hidden xl:grid-cols-[12rem_minmax(32.5rem,44.5rem)_20rem] 2xl:grid-cols-[13rem_minmax(36.5rem,48.5rem)_22rem] xl:justify-center">
          <div><PgnHeadersSidebar headers={selectedBoard.headers ?? {}} /></div>

          <section className="flex min-w-0 flex-col gap-4 items-center">
            <div className="w-full">
              <div className="grid w-full grid-cols-[2.5rem_minmax(0,1fr)] items-stretch gap-2">
                <div className="pointer-events-none flex">
                  <EvalBar cp={currentEvalCp} mate={currentEvalMate} />
                </div>
                <ChessBoardView
                fen={mateLinePreviewFen ?? chess.fen}
                arrows={chess.currentArrows}
                highlights={chess.currentHighlights}
                extraArrows={analysisArrow}
                lastMoveSquare={lastMoveSquare}
                lastMoveFromSquare={lastMoveFromSquare}
                moveBadge={moveBadge}
                kingStatus={kingStatus}
                onArrowsChange={handleArrowsChange}
                onHighlightsChange={handleHighlightsChange}
                onClearArrows={handleClearArrows}
                canUndo={chess.canUndo}
                canRedo={chess.canRedo}
                onMove={handleMove}
                onUndo={handleUndo}
                onRedo={handleRedo}
                onReset={handleReset}
                onAnalyze={handleAnalyze}
                analyzing={analyzing}
                analysisProgress={analysisProgress}
                analysisDepth={stockfishDepth ?? undefined}
                canAnalyze={chess.moves.length > 0 || !!selectedBoard}
                onCancelAnalysis={handleCancelAnalysis}
                lessonMode={lesson.mode}
                autoAnalysis={lesson?.mode === "analysis" && autoAnalysisDoneRef.current}
                onConvertToStudy={lesson?.mode === "analysis" ? handleConvertToStudy : undefined}
                converting={converting}
                boardOrientation={flipped ? "black" : "white"}
                onFlip={handleFlip}
              />
              </div>
            </div>
            {(currentEvalCp != null || currentEvalMate != null) && (
              <div className="w-full flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-mono tabular-nums">
                  Valutazione: <span className="text-foreground font-semibold">{evalPositionLabel(currentEvalCp, currentEvalMate)}</span>
                </span>
                <span className="text-xs">(profondità {currentEvalDepth})</span>
              </div>
            )}
          </section>

          <aside className="flex min-h-0 min-w-0 flex-col gap-3 xl:h-full">
            <MoveCommentPreview
              currentMove={chess.currentMove}
              historyIndex={chess.historyIndex}
              text={chess.currentMove?.stockfishComment ?? ""}
              stockfishLabel
              onMateLineClick={handleMateLineClick}
            />
            {chess.currentMove?.analysisComment?.trim() ? (
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Spunto didattico
                </p>
                <MoveCommentPreview
                  currentMove={chess.currentMove}
                  historyIndex={chess.historyIndex}
                  text={chess.currentMove.analysisComment}
                  onMateLineClick={handleMateLineClick}
                />
              </div>
            ) : null}
            {mateLineStatus ? (
              <div className="flex items-center justify-between gap-2 border-b bg-blue-50 px-3 py-2 text-sm text-blue-900">
                <span>{mateLineStatus}</span>
                <button
                  type="button"
                  className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800"
                  onClick={clearMateLinePreview}
                >
                  Chiudi
                </button>
              </div>
            ) : null}
            <MoveNotation
              moves={chess.moves}
              currentMoveIndex={chess.historyIndex}
              onGoToMove={chess.goToMove}
              startEvalCp={selectedBoard?.evalCp ?? null}
              startEvalMate={selectedBoard?.evalMate ?? null}
              startFen={selectedBoard.fen}
              startEvalBestMoveUci={selectedBoard?.evalBestMoveUci ?? null}
              fullHeight
            />
          </aside>
        </div>
      ) : (
        <div
          className={
            lesson.mode === "study"
              ? "grid grid-cols-1 gap-4 items-start lg:grid-cols-[14rem_minmax(24rem,38rem)_22rem] xl:grid-cols-[14rem_minmax(26rem,40rem)_24rem] lg:justify-center"
              : "grid grid-cols-1 gap-4 items-start lg:grid-cols-[minmax(24rem,40rem)_24rem] lg:justify-center"
          }
        >
          {lesson.mode === "study" && (
            <StudyBoardSidebar
              boards={boards}
              selectedBoardId={selectedBoardId}
              onSelectBoard={setSelectedBoardId}
              onImportPgn={() => setImportOpen(true)}
              onCreateBoard={handleCreateBoard}
              onEditBoard={handleEditBoardClick}
              onDeleteBoard={handleDeleteBoardClick}
            />
          )}

          <section className="min-w-0 flex flex-col gap-4 items-center">
            {selectedBoard ? (
              <>
                <div className="w-full">
                  <div className="grid w-full grid-cols-[2.5rem_minmax(0,1fr)] items-stretch gap-2">
                <div className="pointer-events-none flex">
                  <EvalBar cp={currentEvalCp} mate={currentEvalMate} />
                </div>
                <ChessBoardView
                    fen={mateLinePreviewFen ?? chess.fen}
                    arrows={chess.currentArrows}
                    highlights={chess.currentHighlights}
                    extraArrows={analysisArrow}
                    lastMoveSquare={lastMoveSquare}
                    lastMoveFromSquare={lastMoveFromSquare}
                    moveBadge={moveBadge}
                    kingStatus={kingStatus}
                    onArrowsChange={handleArrowsChange}
                    onHighlightsChange={handleHighlightsChange}
                    onClearArrows={handleClearArrows}
                    canUndo={chess.canUndo}
                    canRedo={chess.canRedo}
                    onMove={handleMove}
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    onReset={handleReset}
                    onAnalyze={handleAnalyze}
                    analyzing={analyzing}
                    analysisProgress={analysisProgress}
                    analysisDepth={stockfishDepth ?? undefined}
                    canAnalyze={chess.moves.length > 0 || !!selectedBoard}
                    onCancelAnalysis={handleCancelAnalysis}
                    lessonMode={lesson.mode}
                    autoAnalysis={lesson?.mode === "analysis" && autoAnalysisDoneRef.current}
                    onConvertToStudy={lesson?.mode === "analysis" ? handleConvertToStudy : undefined}
                    converting={converting}
                    boardOrientation={flipped ? "black" : "white"}
                    onFlip={handleFlip}
                  />
              </div>
                </div>
                {(currentEvalCp != null || currentEvalMate != null) && (
                  <div className="w-full flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-mono tabular-nums">
                      Valutazione: <span className="text-foreground font-semibold">{evalPositionLabel(currentEvalCp, currentEvalMate)}</span>
                    </span>
                    <span className="text-xs">(profondità {currentEvalDepth})</span>
                  </div>
                )}
                <div className="w-full flex flex-col gap-3">
                  {lesson.mode === "analysis" ? (
                    <>
                      <MoveCommentPreview
                        currentMove={chess.currentMove}
                        historyIndex={chess.historyIndex}
                        text={chess.currentMove?.stockfishComment ?? moveCommentDraft}
                      />
                      {chess.currentMove?.analysisComment?.trim() ? (
                        <div className="space-y-1">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Spunto didattico
                          </p>
                          <MoveCommentPreview
                            currentMove={chess.currentMove}
                            historyIndex={chess.historyIndex}
                            text={chess.currentMove.analysisComment}
                            onMateLineClick={handleMateLineClick}
                          />
                        </div>
                      ) : null}
                              </>
                  ) : (
                    <>
                      <div className="flex gap-1 p-1 bg-muted rounded-lg" role="tablist">
                        <button
                          type="button"
                          role="tab"
                          aria-selected={noteTab === "board"}
                          onClick={() => setNoteTab("board")}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            noteTab === "board"
                              ? "bg-background shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <NotebookPen className="size-4" />
                          Note scacchiera
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={noteTab === "move"}
                          disabled={!chess.currentMove}
                          onClick={() => setNoteTab("move")}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            noteTab === "move"
                              ? "bg-background shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          } ${!chess.currentMove ? "opacity-40 cursor-not-allowed" : ""}`}
                          title={
                            chess.currentMove
                              ? "Spiegazione della mossa corrente"
                              : "Seleziona una mossa per aggiungere una spiegazione"
                          }
                        >
                          <NotebookPen className="size-4" />
                          {chess.currentMove
                            ? `Nota mossa ${chess.historyIndex}. ${chess.currentMove.moveNotation}`
                            : "Nota mossa"}
                        </button>
                      </div>

                      {noteTab === "board" ? (
                        <Textarea
                          id="board-notes"
                          value={notesDraft}
                          onChange={handleNotesChange}
                          onBlur={handleNotesBlur}
                          placeholder="Note libere per questa scacchiera..."
                          rows={6}
                          className="resize-y"
                        />
                      ) : (
                        <Textarea
                          value={moveCommentDraft}
                          onChange={handleMoveCommentChange}
                          onBlur={handleMoveCommentBlur}
                          placeholder={`Spiegazione della mossa ${chess.historyIndex}. ${chess.currentMove?.moveNotation ?? ""}...`}
                          rows={6}
                          className="resize-y"
                        />
                      )}
                    </>
                  )}
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

          <aside className="w-full min-w-0">
            {selectedBoard ? (
              <MoveNotation
                moves={chess.moves}
                currentMoveIndex={chess.historyIndex}
                onGoToMove={chess.goToMove}
                startEvalCp={selectedBoard?.evalCp ?? null}
                startEvalMate={selectedBoard?.evalMate ?? null}
                startFen={selectedBoard.fen}
                startEvalBestMoveUci={selectedBoard?.evalBestMoveUci ?? null}
              />
            ) : (
              <div className="text-sm text-muted-foreground">
                -
              </div>
            )}
          </aside>
        </div>
      )}

      {/* Dialog conferma reset scacchiera */}

      {/* Dialog import PGN */}
      <ImportPgnDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        lessonId={lessonId}
        onImported={handleImportPgn}
      />

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ripristina posizione iniziale</DialogTitle>
            <DialogDescription>
              Verranno cancellate tutte le mosse e le relative spiegazioni di
              questa scacchiera. L&apos;operazione non è reversibile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Annulla
            </Button>
            <Button variant="destructive" onClick={confirmReset}>
              Ripristina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
