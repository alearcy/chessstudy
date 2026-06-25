import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, NotebookPen, Upload, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
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
  updateMoveEval,
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
import MoveNotation from "@/components/board/MoveNotation";
import ImportPgnDialog from "@/components/board/ImportPgnDialog";
import PgnHeadersSidebar from "@/components/board/PgnHeadersSidebar";
import {
  analyzePositions,
  uciToArrow,
  toEvalFields,
  formatEval,
  evalScore,
  moveClassification,
  parseBadgePrefix,
  type PositionEval,
} from "@/services/analysisService";
import { explainMoveRuleBased } from "@/services/explainService";
import { analyzeGame } from "@/services/explainService";
import { Chess, PieceSymbol, Square as ChessSquare } from "chess.js";

/** Estrae la casa di destinazione dal SAN (e.g. "Nf3" → "f3", "O-O" → "g1" o "g8"). */
function sanToSquare(san: string, byBlack: boolean): string | null {
  if (san === "O-O") return byBlack ? "g8" : "g1";
  if (san === "O-O-O") return byBlack ? "c8" : "c1";
  // Rimuove scacco/scacco matto e promozione, prende ultimi 2 caratteri.
  const clean = san.replace(/[+#]$/, "");
  const dest = clean.split("=")[0]; // exd8=Q → exd8
  return dest.slice(-2);
}

const BOARD_WIDTH = 600;
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
  const [gameAnalysisLoading, setGameAnalysisLoading] = useState(false);
  const [gameAnalysisText, setGameAnalysisText] = useState("");
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
    if (!selectedBoard) return;
    // Forza il reload se initializedRef.current è null (ad esempio dopo PGN import)
    if (initializedRef.current === null || initializedRef.current !== selectedBoard.id) {
      initializedRef.current = selectedBoard.id ?? null;
      getMovesByBoard(selectedBoard.id!).then((loadedMoves) => {
        chess.loadSequence(
          selectedBoard.fen,
          loadedMoves,
          selectedBoard.arrows,
          selectedBoard.highlights
        );
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
    if (moveCommentTimerRef.current) {
      clearTimeout(moveCommentTimerRef.current);
      moveCommentTimerRef.current = null;
    }
    const board = boards.find((b) => b.id === selectedBoardId);
    const notes = board?.notes ?? "";
    setNotesDraft(notes);
    lastSavedRef.current = notes;
    setNoteTab("board");
    setGameAnalysisText(cleanGameAnalysisText(board?.gameAnalysis ?? ""));
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
        // La mossa è ancora un placeholder non persistita: ritenta quando
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
    
    // Reset auto-analysis flag to ensure it runs after import
    autoAnalysisDoneRef.current = false;
  };

  // --- Helper: genera commenti rule-based per tutte le mosse ---
  // Lavora solo sul DB: legge eval dall'array `evals` (non da chess.moves,
  // che in questo momento è stale). Persiste i commenti senza toccare lo stato.
  const persistRuleBasedComments = useCallback(
    async (
      startFen: string,
      moveList: Move[],
      evals: PositionEval[],
      board: Board
    ) => {
      for (let i = 0; i < moveList.length; i++) {
        const move = moveList[i];
        if (move.id == null) continue;
        // Salta se ha già un commento PGN (proveniente dall'import).
        if (move.comment?.trim()) continue;

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
          const commentText = [exp.summary, ...exp.details].join("\n");
          await updateMove(move.id, { comment: commentText });
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
    setAnalysisProgress({ done: 0, total: fens.length });
    try {
      const evals: PositionEval[] = await analyzePositions(fens, {
        depth: 15,
        signal,
        onProgress: (done, total) => setAnalysisProgress({ done, total }),
      });
      if (signal.cancelled) return;

      // Persistenza SOLO su DB. Non toccare chess.moves qui: l'array
      // catturato nella closure è stale e i replaceMove sovrascriverebbero
      // gli eval con valori vecchi. Ricarichiamo tutto dal DB alla fine.
      await updateBoard(boardId, toEvalFields(evals[0]));
      for (let i = 1; i < evals.length; i++) {
        const move = moveList[i - 1];
        if (move.id == null) continue;
await updateMoveEval(move.id, toEvalFields(evals[i]));
      }

      // Genera commenti rule-based usando evals freschi (non chess.moves).
      if (!signal.cancelled) {
        await persistRuleBasedComments(startFen, moveList, evals, {
          ...selectedBoard,
          ...toEvalFields(evals[0]),
        });
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
    } finally {
      setAnalyzing(false);
      setAnalysisProgress(null);
      analysisSignalRef.current = null;
    }
  };

  const handleGameAnalysis = async () => {
    if (!selectedBoard || gameAnalysisLoading) return;
    const boardId = selectedBoard.id;
    if (!boardId) return;

    const startFen = selectedBoard.fen;
    setGameAnalysisLoading(true);

    // Yield to event loop so React renders the loading overlay before
    // the synchronous prep work and the async LLM call.
    await new Promise((r) => setTimeout(r, 0));

    try {
      const moveList = chess.moves;
      const startCp = selectedBoard.evalCp ?? null;
      const startMate = selectedBoard.evalMate ?? null;

      const moves = moveList.map((m, i) => {
        const isWhite = i % 2 === 0;
        const beforeCp = i === 0 ? startCp : (moveList[i - 1]?.evalCp ?? null);
        const beforeMate = i === 0 ? startMate : (moveList[i - 1]?.evalMate ?? null);
        const afterCp = m.evalCp ?? null;
        const afterMate = m.evalMate ?? null;

        const beforeScore = evalScore(beforeCp, beforeMate);
        const afterScore = evalScore(afterCp, afterMate);
        const cpLoss = beforeScore - afterScore;
        const cls = moveClassification(cpLoss);

        const classLabel =
          cls?.label === "??" ? "ERRORE GRAVE" :
          cls?.label === "?" ? "ERRORE" :
          cls?.label === "?!" ? "IMPRECISIONE" :
          isWhite ? "OTTIMA" : "BUONA";

        const beforeFen = i === 0 ? startFen : moveList[i - 1].fen;
        const bestUci = i === 0
          ? (selectedBoard.evalBestMoveUci ?? null)
          : (moveList[i - 1]?.evalBestMoveUci ?? null);
        const bestSan = bestUci ? uciToSan(beforeFen, bestUci) : null;

        return {
          moveNumber: Math.floor(i / 2) + 1,
          index: i,
          san: m.moveNotation,
          player: isWhite ? "Bianco" : "Nero",
          evalBefore: formatEvalForPrompt(beforeCp, beforeMate),
          evalAfter: formatEvalForPrompt(afterCp, afterMate),
          classification: classLabel,
          bestSan,
        };
      });

      const keySwings = computeKeySwings(
        moveList,
        startCp,
        startMate,
        selectedBoard.whiteName ?? "Bianco",
        selectedBoard.blackName ?? "Nero"
      );

      const text = await analyzeGame({
        whiteName: selectedBoard?.whiteName ?? null,
        blackName: selectedBoard?.blackName ?? null,
        result: selectedBoard?.headers?.["Result"] ?? null,
        moves,
        keySwings,
      });

      setGameAnalysisText(text);
      const cleaned = cleanGameAnalysisText(text);
      await updateBoard(boardId, { gameAnalysis: cleaned });
      syncBoardInList(boardId, { gameAnalysis: cleaned });
    } catch (e) {
      console.error("[game-analysis] errore", e);
    } finally {
      setGameAnalysisLoading(false);
    }
  };

  /** Formatta eval per il prompt LLM: "+0.3", "-2.1", "M5", "M-3". */
  function formatEvalForPrompt(cp: number | null, mate: number | null): string {
    if (mate != null) return mate > 0 ? `M${mate}` : `M${mate}`;
    if (cp != null) {
      const pawns = cp / 100;
      return pawns >= 0 ? `+${pawns.toFixed(1)}` : `${pawns.toFixed(1)}`;
    }
    return "?";
  }

  /** Post-process LLM markdown: extract commentary from inside move links so only the move is underlined. */
  function cleanGameAnalysisText(text: string): string {
    return text.replace(/\[([^\]]*?)\]\(#move-(\d+)\)/g, (_full, content, idx) => {
      const trimmed = content.trim();
      const words = trimmed.split(/\s+/);
      if (words.length <= 1) return _full;
      const move = words[0];
      const rest = words.slice(1).join(" ");
      return `[${move}](#move-${idx}) ${rest}`;
    });
  }

  /** Converte UCI ("e2e4") in SAN ("e4") usando la posizione FEN. */
  function uciToSan(fen: string, uci: string): string | null {
    try {
      const game = new Chess(fen);
      const from = uci.slice(0, 2) as ChessSquare;
      const to = uci.slice(2, 4) as ChessSquare;
      const promotion = uci.length > 4 ? (uci[4] as PieceSymbol) : undefined;
      const move = game.move({ from, to, promotion });
      return move?.san ?? null;
    } catch {
      return null;
    }
  }

  /** Calcola i 5 swing di valutazione più grandi e li restituisce come stringhe descrittive. */
  function computeKeySwings(
    moveList: Move[],
    startCp: number | null,
    startMate: number | null,
    whiteName: string,
    blackName: string,
  ): string[] {
    const swings: Array<{ desc: string; absLoss: number }> = [];
    for (let i = 0; i < moveList.length; i++) {
      const m = moveList[i];
      const beforeCp = i === 0 ? startCp : (moveList[i - 1]?.evalCp ?? null);
      const beforeMate = i === 0 ? startMate : (moveList[i - 1]?.evalMate ?? null);
      const afterCp = m.evalCp ?? null;
      const afterMate = m.evalMate ?? null;
      const beforeScore = evalScore(beforeCp, beforeMate);
      const afterScore = evalScore(afterCp, afterMate);
      const cpLoss = beforeScore - afterScore;

      const cls = moveClassification(cpLoss);
      if (cls?.label === "✓" || !cls) continue;
      const playerName = i % 2 === 0 ? whiteName : blackName;
      const lossPawn = cpLoss / 100;
      const clsLabel =
        cls.label === "??" ? "ERRORE GRAVE" :
        cls.label === "?" ? "ERRORE" :
        cls.label === "?!" ? "IMPRECISIONE" : "BUONA";
      swings.push({
        desc: `Mossa ${Math.floor(i / 2) + 1}. ${m.moveNotation} di ${playerName} (${clsLabel}, ${lossPawn >= 0 ? "-" : "+"}${Math.abs(lossPawn).toFixed(1)} pedoni)`,
        absLoss: Math.abs(cpLoss),
      });
    }
    swings.sort((a, b) => b.absLoss - a.absLoss);
    return swings.slice(0, 5).map((s) => s.desc);
  }

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
    await updateBoard(editBoardId, { title: editBoardTitle.trim() });
    syncBoardInList(editBoardId, { title: editBoardTitle.trim() });
    setEditBoardOpen(false);
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
    if (lesson?.mode === "analysis") {
      chess.goToMove(0);
      return;
    }
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
      <div className="text-center py-16 text-muted-foreground">
        Caricamento...
      </div>
    );
  }

  if (!lesson) return null;

  return (
    <div className="w-full">
      {gameAnalysisLoading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
          <Loader2 className="size-10 animate-spin text-primary mb-4" />
          <span className="text-lg font-semibold text-foreground">L&apos;AI sta analizzando la partita...</span>
          <span className="text-sm text-muted-foreground mt-1">Potrebbe richiedere qualche secondo</span>
        </div>
      )}
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
          {lesson.description && lesson.mode !== "analysis" && (
            <p className="text-muted-foreground mt-1 text-sm">
              {lesson.description}
            </p>
          )}
        </div>
      </div>

      {lesson.mode === "analysis" && selectedBoard ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <div className="lg:col-span-2"><PgnHeadersSidebar headers={selectedBoard.headers ?? {}} /></div>

          <section className="lg:col-span-4 flex flex-col gap-4 items-center">
            <div className="w-full">
              <ChessBoardView
                fen={chess.fen}
                boardWidth={BOARD_WIDTH}
                arrows={chess.currentArrows}
                highlights={chess.currentHighlights}
                extraArrows={analysisArrow}
                lastMoveSquare={lastMoveSquare}
                lastMoveFromSquare={lastMoveFromSquare}
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
                onGameAnalysis={handleGameAnalysis}
                gameAnalysisLoading={gameAnalysisLoading}
                autoAnalysis={lesson?.mode === "analysis" && autoAnalysisDoneRef.current}
                onConvertToStudy={lesson?.mode === "analysis" ? handleConvertToStudy : undefined}
                converting={converting}
                boardOrientation={flipped ? "black" : "white"}
                onFlip={handleFlip}
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
          </section>

          <section className="lg:col-span-3 flex flex-col gap-3">
            {gameAnalysisText ? (
              <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-3 text-sm leading-relaxed game-analysis-content">
                <ReactMarkdown
                  components={{
                    a: ({ href, children }) => {
                      if (href?.startsWith("#move-")) {
                        const idx = parseInt(href.slice(6), 10);
                        if (Number.isNaN(idx)) return <span>{children}</span>;
                        return (
                          <button
                            type="button"
                            className="text-primary underline decoration-primary/50 hover:decoration-primary font-medium cursor-pointer transition-colors"
                            onClick={() => {
                              chess.goToMove(idx + 1);
                            }}
                          >
                            {children}
                          </button>
                        );
                      }
                      return (
                        <a href={href} target="_blank" rel="noopener noreferrer">
                          {children}
                        </a>
                      );
                    },
                    p: ({ children }) => (
                      <p className="mb-2 last:mb-0">{children}</p>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold">{children}</strong>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc pl-4 my-1">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal pl-4 my-1">{children}</ol>
                    ),
                    li: ({ children }) => (
                      <li className="mb-0.5">{children}</li>
                    ),
                    em: ({ children }) => (
                      <em>{children}</em>
                    ),
                  }}
                >
                  {cleanGameAnalysisText(gameAnalysisText)}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Nessuna analisi AI. Usa il pulsante ✨ per generarla.
              </p>
            )}
          </section>

          <aside className="lg:col-span-3 flex flex-col gap-3">
            <MoveNotation
              moves={chess.moves}
              currentMoveIndex={chess.historyIndex}
              onGoToMove={chess.goToMove}
              startEvalCp={selectedBoard?.evalCp ?? null}
              startEvalMate={selectedBoard?.evalMate ?? null}
              startFen={selectedBoard.fen}
              startEvalBestMoveUci={selectedBoard?.evalBestMoveUci ?? null}
            />
            <div className="w-full min-h-[64px] rounded-md border border-input bg-muted/40 px-3 py-2 text-sm whitespace-pre-wrap">
              {chess.currentMove ? (
                moveCommentDraft.trim() ? (
                  (() => {
                    const text = moveCommentDraft;
                    const parsed = parseBadgePrefix(text);
                    if (!parsed) {
                      return <span className="whitespace-pre-wrap">{text}</span>;
                    }
                    const isEmoji = parsed.label === "⭐" || parsed.label === "✅";
                    return (
                      <span className="whitespace-pre-wrap">
                        <span
                          className={isEmoji ? "" : "inline-block px-1.5 rounded text-white font-bold mr-1 align-middle"}
                          style={isEmoji ? undefined : { backgroundColor: parsed.color }}
                        >
                          {parsed.label}
                        </span>
                        {parsed.rest}
                      </span>
                    );
                  })()
                ) : (
                  <span className="text-muted-foreground italic">
                    Nessun commento per la mossa {chess.historyIndex}. {chess.currentMove.moveNotation}.
                  </span>
                )
              ) : (
                <span className="text-muted-foreground italic">
                  Seleziona una mossa per leggere il commento Stockfish.
                </span>
              )}
            </div>
          </aside>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-4 items-stretch">
          {lesson.mode === "study" && (
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
          )}

          <section className="flex-1 min-w-0 flex flex-col gap-4 items-center">
            {selectedBoard ? (
              <>
                <div className="w-full">
                  <ChessBoardView
                    fen={chess.fen}
                    boardWidth={BOARD_WIDTH}
                    arrows={chess.currentArrows}
                    highlights={chess.currentHighlights}
                    extraArrows={analysisArrow}
                    lastMoveSquare={lastMoveSquare}
                    lastMoveFromSquare={lastMoveFromSquare}
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
                    onGameAnalysis={handleGameAnalysis}
                    gameAnalysisLoading={gameAnalysisLoading}
                    autoAnalysis={lesson?.mode === "analysis" && autoAnalysisDoneRef.current}
                    onConvertToStudy={lesson?.mode === "analysis" ? handleConvertToStudy : undefined}
                    converting={converting}
                    boardOrientation={flipped ? "black" : "white"}
                    onFlip={handleFlip}
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
                <div className="w-full max-w-[480px] flex flex-col gap-3">
                  {lesson.mode === "analysis" ? (
                    <>
                      {gameAnalysisText && (
                        <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-3 text-sm leading-relaxed game-analysis-content">
                          <ReactMarkdown
                            components={{
                              a: ({ href, children }) => {
                                if (href?.startsWith("#move-")) {
                                  const idx = parseInt(href.slice(6), 10);
                                  if (Number.isNaN(idx)) return <span>{children}</span>;
                                  return (
                                    <button
                                      type="button"
                                      className="text-primary underline decoration-primary/50 hover:decoration-primary font-medium cursor-pointer transition-colors"
                                      onClick={() => {
                                        chess.goToMove(idx + 1);
                                      }}
                                    >
                                      {children}
                                    </button>
                                  );
                                }
                                return (
                                  <a href={href} target="_blank" rel="noopener noreferrer">
                                    {children}
                                  </a>
                                );
                              },
                              p: ({ children }) => (
                                <p className="mb-2 last:mb-0">{children}</p>
                              ),
                              strong: ({ children }) => (
                                <strong className="font-semibold">{children}</strong>
                              ),
                              ul: ({ children }) => (
                                <ul className="list-disc pl-4 my-1">{children}</ul>
                              ),
                              ol: ({ children }) => (
                                <ol className="list-decimal pl-4 my-1">{children}</ol>
                              ),
                              li: ({ children }) => (
                                <li className="mb-0.5">{children}</li>
                              ),
                              em: ({ children }) => (
                                <em>{children}</em>
                              ),
                            }}
                          >
                            {cleanGameAnalysisText(gameAnalysisText)}
                          </ReactMarkdown>
                        </div>
                      )}
                      <div
                        className="w-full min-h-[64px] rounded-md border border-input bg-muted/40 px-3 py-2 text-sm whitespace-pre-wrap"
                      >
                        {chess.currentMove ? (
                          moveCommentDraft.trim() ? (
                            (() => {
                              const text = moveCommentDraft;
                              const parsed = parseBadgePrefix(text);
                              if (!parsed) {
                                return <span className="whitespace-pre-wrap">{text}</span>;
                              }
                              const isEmoji = parsed.label === "⭐" || parsed.label === "✅";
                              return (
                                <span className="whitespace-pre-wrap">
                                  <span
                                    className={isEmoji ? "" : "inline-block px-1.5 rounded text-white font-bold mr-1 align-middle"}
                                    style={isEmoji ? undefined : { backgroundColor: parsed.color }}
                                  >
                                    {parsed.label}
                                  </span>
                                  {parsed.rest}
                                </span>
                              );
                            })()
                          ) : (
                            <span className="text-muted-foreground italic">
                              Nessun commento per la mossa {chess.historyIndex}. {chess.currentMove.moveNotation}.
                            </span>
                          )
                        ) : (
                          <span className="text-muted-foreground italic">
                            Seleziona una mossa per leggere il commento.
                          </span>
                        )}
                      </div>
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

          <aside className="w-full lg:w-96 shrink-0">
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