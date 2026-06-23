import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, NotebookPen, Upload, Loader2 } from "lucide-react";
import { getLesson, updateLesson, deleteLesson } from "@/services/lessonService";
import {
  getBoardsByLesson,
  createBoard,
  updateBoard,
  deleteBoard,
} from "@/services/boardService";
import {
  getMovesByBoard,
  createMove,
  updateMove,
  updateMoveEval,
  deleteMovesFromOrder,
  deleteMovesByBoard,
} from "@/services/moveService";
import type { Lesson, LessonFormData, Board, BoardArrow } from "@/types";
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
import ImportPgnDialog from "@/components/board/ImportPgnDialog";
import {
  analyzePositions,
  uciToArrow,
  toEvalFields,
  formatEval,
  evalScore,
  moveClassification,
  type PositionEval,
} from "@/services/analysisService";
import { explainMove } from "@/services/explainService";

/** Estrae la casa di destinazione dal SAN (e.g. "Nf3" → "f3", "O-O" → "g1" o "g8"). */
function sanToSquare(san: string, byBlack: boolean): string | null {
  if (san === "O-O") return byBlack ? "g8" : "g1";
  if (san === "O-O-O") return byBlack ? "c8" : "c1";
  // Rimuove scacco/scacco matto e promozione, prende ultimi 2 caratteri.
  const clean = san.replace(/[+#]$/, "");
  const dest = clean.split("=")[0]; // exd8=Q → exd8
  return dest.slice(-2);
}

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
  const [resetOpen, setResetOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [llmAvailable, setLlmAvailable] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const analysisSignalRef = useRef<{ cancelled: boolean } | null>(null);
  const [noteTab, setNoteTab] = useState<"board" | "move">("board");
  const [moveCommentDraft, setMoveCommentDraft] = useState("");

  const chess = useChessBoard();
  const initializedRef = useRef<number | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");
  const moveCommentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedCommentRef = useRef<string>("");
  const commentMoveIdRef = useRef<number | null>(null);

  const selectedBoard = useMemo(
    () => boards.find((b) => b.id === selectedBoardId) ?? null,
    [boards, selectedBoardId]
  );

  // Inizializza l'hook scacchiera quando viene selezionata una nuova board:
  // carica il FEN di partenza, le mosse persistite e le annotazioni di partenza.
  useEffect(() => {
    if (!selectedBoard || initializedRef.current === selectedBoard.id) return;
    initializedRef.current = selectedBoard.id ?? null;
    getMovesByBoard(selectedBoard.id!).then((loadedMoves) => {
      chess.loadSequence(
        selectedBoard.fen,
        loadedMoves,
        selectedBoard.arrows,
        selectedBoard.highlights
      );
    });
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
  // altrimenti l'editing resettrebbe lastSavedCommentRef e bloccherebbe il salvataggio.
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

  // Verifica se l'LLM nativo è disponibile via Tauri.
  useEffect(() => {
    async function check() {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const status = await invoke<{ ready: boolean }>("llm_status");
        setLlmAvailable(status.ready);
      } catch {
        setLlmAvailable(false);
      }
    }
    check();
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

  // Salvataggio commento mossa: blur immediato + debounce su digitazione.
  const saveMoveComment = useCallback(
    async (moveId: number | null, next: string) => {
      if (moveId == null || next === lastSavedCommentRef.current) return;
      lastSavedCommentRef.current = next;
      await updateMove(moveId, { comment: next });
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
    // Aggiorna lo stato in memoria (indicatore 💬 immediato).
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
      void updateBoard(selectedBoardId, { arrows, highlights });
      // Mantiene lo stato boards allineato (per il caricamento successivo).
      syncBoardInList(selectedBoardId, { arrows, highlights });
    } else {
      const moveId = chess.currentMove?.id;
      if (moveId == null) {
        // La mossa è ancora un placeholder non persistito: ritenta quando
        // arriva l'id (vedi effect sotto).
        pendingAnnotationsRef.current = { arrows, highlights };
        return;
      }
      void updateMove(moveId, { arrows, highlights });
    }
  };

  // Flush delle annotazioni pendenti quando la mossa corrente ottiene un id.
  useEffect(() => {
    const moveId = chess.currentMove?.id;
    if (moveId != null && pendingAnnotationsRef.current) {
      const { arrows, highlights } = pendingAnnotationsRef.current;
      pendingAnnotationsRef.current = null;
      void updateMove(moveId, { arrows, highlights });
    }
  }, [chess.currentMove?.id]);

  const handleArrowsChange = (next: BoardArrow[]) => {
    // react-chessboard v4: onArrowsChange reporta solo le frecce disegnate
    // dall'utente in questo gesto; le azzerà internamente a ogni cambio di
    // customArrows/posizione. Ignora gli svuotamenti interni (next vuoto) per
    // non loopare e non cancellare le frecce persistite.
    if (next.length === 0) return;
    // Merge + dedupe per from/to (la libreria previene i duplicati, ma ci
    // proteggiamo dai doppi tracciamenti veloci).
    const seen = new Set(chess.currentArrows.map((a) => `${a[0]}-${a[1]}`));
    const merged = [
      ...chess.currentArrows,
      ...next.filter((a) => {
        const key = `${a[0]}-${a[1]}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    ];
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

  const handleMove = useCallback(
    (from: Square, to: Square): boolean => {
      const result = chess.makeMove(from, to);
      if (!result || !selectedBoardId) return !!result;
      const boardId = selectedBoardId;
      const parentId =
        result.newMoveIndex > 0
          ? (chess.moves[result.newMoveIndex - 1]?.id ?? null)
          : null;
      // Persistenza async (fire-and-forget): lo stato in memoria è già aggiornato.
      void (async () => {
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
        chess.replaceMove(result.newMoveIndex, {
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
        });
      })();
      return true;
    },
    [chess, selectedBoardId]
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

  const handleImportPgn = async (boardId: number) => {
    await loadData();
    // Forza il ricaricamento della sequenza anche se la board era già selezionata.
    initializedRef.current = null;
    setSelectedBoardId(boardId);
  };

  // --- Analisi Stockfish ---
  // Posizioni da analizzare: posizione di partenza (Board.fen) + dopo ogni mossa.
  const handleAnalyze = async () => {
    if (!selectedBoard || analyzing) return;
    const startFen = selectedBoard.fen;
    const moveList = chess.moves;
    const fens = [startFen, ...moveList.map((m) => m.fen)];
    const signal = { cancelled: false };
    analysisSignalRef.current = signal;
    setAnalyzing(true);
    setAnalysisProgress({ done: 0, total: fens.length });
    try {
      const evals: PositionEval[] = await analyzePositions(fens, {
        depth: 15,
        signal,
        onProgress: (done, total) => setAnalysisProgress({ done, total }),
      });
      if (signal.cancelled) return;
      // Persistenza + aggiornamento stato in memoria.
      // evals[0] → Board (posizione di partenza); evals[i] → Move[i-1].
      if (selectedBoard.id) {
        await updateBoard(selectedBoard.id, toEvalFields(evals[0]));
        syncBoardInList(selectedBoard.id, toEvalFields(evals[0]));
      }
      for (let i = 1; i < evals.length; i++) {
        const move = moveList[i - 1];
        if (move.id == null) continue;
        const fields = toEvalFields(evals[i]);
        await updateMoveEval(move.id, fields);
        chess.replaceMove(i - 1, { ...move, ...fields });
      }
    } catch (e) {
      console.error("[analyze] errore", e);
    } finally {
      setAnalyzing(false);
      setAnalysisProgress(null);
      analysisSignalRef.current = null;
    }
  };

  /** Attiva/disattiva l'AI: quando attivata, genera commenti per tutte le mosse. */
  const handleAiToggle = async () => {
    if (!selectedBoard || aiLoading) return;
    if (aiEnabled) {
      setAiEnabled(false);
      return;
    }
    setAiEnabled(true);
    setAiLoading(true);
    try {
      const startFen = selectedBoard.fen;
      const moveList = chess.moves;

      // Costruisce evals dagli eval già persistiti su board/mosse.
      const evals: { scoreCp: number | null; scoreMate: number | null; depth: number; bestMoveUci: string | null }[] = [
        {
          scoreCp: selectedBoard.evalCp ?? null,
          scoreMate: selectedBoard.evalMate ?? null,
          depth: selectedBoard.evalDepth ?? 0,
          bestMoveUci: selectedBoard.evalBestMoveUci ?? null,
        },
        ...moveList.map((m) => ({
          scoreCp: m.evalCp ?? null,
          scoreMate: m.evalMate ?? null,
          depth: m.evalDepth ?? 0,
          bestMoveUci: m.evalBestMoveUci ?? null,
        })),
      ];

      for (let i = 0; i < moveList.length; i++) {
        const move = moveList[i];
        if (move.id == null) continue;
        // Salta se già ha un commento (non vuoto e non generato dal rule-based).
        if (move.comment?.trim()) continue;

        const playedBy: "w" | "b" = i % 2 === 0 ? "w" : "b";
        const beforeFen = i === 0 ? startFen : moveList[i - 1]?.fen ?? startFen;
        const beforeIdx = i;
        const beforeEval = beforeIdx === 0
          ? { cp: evals[0].scoreCp, mate: evals[0].scoreMate, depth: evals[0].depth, bestMoveUci: evals[0].bestMoveUci }
          : { cp: evals[beforeIdx]?.scoreCp ?? null, mate: evals[beforeIdx]?.scoreMate ?? null, depth: evals[beforeIdx]?.depth ?? 0, bestMoveUci: evals[beforeIdx]?.bestMoveUci ?? null };
        const afterEval = { cp: evals[i + 1].scoreCp, mate: evals[i + 1].scoreMate, depth: evals[i + 1].depth };

        try {
          const exp = await explainMove({
            beforeFen,
            afterFen: move.fen,
            playedMoveSan: move.moveNotation,
            playedBy,
            whiteName: selectedBoard?.whiteName ?? null,
            blackName: selectedBoard?.blackName ?? null,
            beforeEval: {
              cp: beforeEval.cp,
              mate: beforeEval.mate,
              depth: beforeEval.depth,
              bestMoveUci: beforeEval.bestMoveUci,
            },
            afterEval,
          });
          const commentText = [exp.summary, ...exp.details].join("\n");
          await updateMove(move.id, { comment: commentText });
          chess.replaceMove(i, { ...move, comment: commentText });
        } catch {
          // spiegazione non critica: ignora errori
        }
      }
    } catch (e) {
      console.error("[ai] errore", e);
    } finally {
      setAiLoading(false);
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
    // Dopo una mossa, il turno è del giocatore opposto:
    // se ora tocca al Bianco, l'ultima mossa è del Nero.
    const isBlackMove = chess.turn === "w";
    const sq = sanToSquare(move.moveNotation, isBlackMove);

    return sq as Square | null;
  }, [chess.historyIndex, chess.currentMove]);

  const moveBadge = useMemo(() => {
    const i = chess.historyIndex - 1;
    if (i < 0) { return null; }
    const move = chess.currentMove;
    if (!move) { return null; }

    // Dopo una mossa il turno passa: se tocca al Bianco, l'ultima mossa è del Nero.
    const isBlackMove = chess.turn === "w";

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

    // cpLoss POV del giocatore che ha mosso
    const cpLoss = isBlackMove
      ? afterScore - beforeScore
      : beforeScore - afterScore;

    const cls = moveClassification(cpLoss);

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

  const handleUndo = () => {
    chess.undo();
  };

  const handleRedo = () => {
    chess.redo();
  };

  const handleReset = () => {
    setResetOpen(true);
  };

  const confirmReset = async () => {
    if (!selectedBoard || !selectedBoardId) return;
    await deleteMovesByBoard(selectedBoardId);
    chess.reset(selectedBoard.fen);
    setResetOpen(false);
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
            <div className="flex items-center gap-0.5">
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => setImportOpen(true)}
                title="Importa PGN"
              >
                <Upload className="size-4" />
              </Button>
              <Button
                size="icon-xs"
                onClick={handleCreateBoard}
                title="Nuova scacchiera"
              >
                <Plus className="size-4" />
              </Button>
            </div>
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
              { }
              <div className="w-full">
                <ChessBoardView
                  fen={chess.fen}
                  boardWidth={BOARD_WIDTH}
                  arrows={chess.currentArrows}
                  highlights={chess.currentHighlights}
                  extraArrows={analysisArrow}
                  lastMoveSquare={lastMoveSquare}
                  moveBadge={moveBadge}
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
                  canAnalyze={chess.moves.length > 0 || !!selectedBoard}
                  onCancelAnalysis={handleCancelAnalysis}
                  lessonMode={lesson.mode}
                  aiEnabled={aiEnabled}
                  onAiToggle={handleAiToggle}
                  aiLoading={aiLoading}
                  llmAvailable={llmAvailable}
                  isTauri={typeof window !== "undefined" && "__TAURI__" in window}
                />
              </div>
              {(currentEvalCp != null || currentEvalMate != null) && (
                <div className="w-full max-w-[480px] flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-mono tabular-nums">
                    Valutazione: <span className="text-foreground font-semibold">{formatEval(currentEvalCp, currentEvalMate)}</span>
                  </span>
                  <span className="text-xs">(profondità {currentEvalDepth})</span>
                </div>
              )}
              <div className="w-full max-w-[480px] flex flex-col gap-1.5">
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
        <aside className="w-full lg:w-80 shrink-0">
          {selectedBoard ? (
            <MoveNotation
              moves={chess.moves}
              currentMoveIndex={chess.historyIndex}
              onGoToMove={chess.goToMove}
              startEvalCp={selectedBoard?.evalCp ?? null}
              startEvalMate={selectedBoard?.evalMate ?? null}
            />
          ) : (
            <div className="text-sm text-muted-foreground">
              -
            </div>
          )}
        </aside>
      </div>

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

      {/* Loader AI full-page */}
      {aiLoading && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 p-8 rounded-lg bg-card shadow-lg border">
            <Loader2 className="size-10 animate-spin text-primary" />
            <p className="text-lg font-medium">L&apos;AI sta analizzando la partita...</p>
            <p className="text-sm text-muted-foreground">
              Generazione commenti didattici in corso
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
