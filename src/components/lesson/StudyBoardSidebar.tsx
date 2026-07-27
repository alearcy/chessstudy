import {
  Copy,
  GripVertical,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { moveStudyBoard, studyBoardIds } from "@/lib/studyBoardOrder";
import type { Board } from "@/types";

interface StudyBoardSidebarProps {
  boards: Board[];
  selectedBoardId: number | null;
  duplicatingBoardId: number | null;
  reorderingBoards: boolean;
  onSelectBoard: (boardId: number) => void;
  onImportPgn: () => void;
  onCreateBoard: () => void;
  onEditBoard: (board: Board, event: React.MouseEvent) => void;
  onDuplicateBoard: (boardId: number) => void;
  onReorderBoards: (boardIds: number[]) => void;
  onDeleteBoard: (boardId: number, event: React.MouseEvent) => void;
}

export default function StudyBoardSidebar({
  boards,
  selectedBoardId,
  duplicatingBoardId,
  reorderingBoards,
  onSelectBoard,
  onImportPgn,
  onCreateBoard,
  onEditBoard,
  onDuplicateBoard,
  onReorderBoards,
  onDeleteBoard,
}: StudyBoardSidebarProps) {
  const [previewBoards, setPreviewBoards] = useState<Board[] | null>(null);
  const [draggingBoardId, setDraggingBoardId] = useState<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const sourceIdsRef = useRef<number[]>([]);
  const previewBoardsRef = useRef<Board[] | null>(null);
  const displayedBoards = previewBoards ?? boards;

  const resetDrag = (target: HTMLButtonElement, pointerId: number) => {
    try {
      if (target.hasPointerCapture?.(pointerId)) {
        target.releasePointerCapture(pointerId);
      }
    } catch {
      // Il browser può aver già rilasciato la cattura del puntatore.
    }
    pointerIdRef.current = null;
    previewBoardsRef.current = null;
    setPreviewBoards(null);
    setDraggingBoardId(null);
  };

  const handlePointerDown = (
    boardId: number,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (
      reorderingBoards ||
      boards.length < 2 ||
      (event.pointerType === "mouse" && event.button !== 0)
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointerIdRef.current = event.pointerId;
    sourceIdsRef.current = studyBoardIds(boards);
    previewBoardsRef.current = boards;
    setPreviewBoards(boards);
    setDraggingBoardId(boardId);
  };

  const handlePointerMove = (
    boardId: number,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (
      pointerIdRef.current !== event.pointerId ||
      draggingBoardId !== boardId
    ) {
      return;
    }

    event.preventDefault();
    const rows = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>("[data-board-id]") ?? [],
    );
    if (rows.length < 2) return;

    let targetIndex = rows.findIndex((row) => {
      const rect = row.getBoundingClientRect();
      return event.clientY < rect.top + rect.height / 2;
    });
    if (targetIndex < 0) targetIndex = rows.length - 1;

    const currentBoards = previewBoardsRef.current ?? boards;
    const reordered = moveStudyBoard(currentBoards, boardId, targetIndex);
    previewBoardsRef.current = reordered;
    setPreviewBoards(reordered);
  };

  const handlePointerUp = (
    boardId: number,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (
      pointerIdRef.current !== event.pointerId ||
      draggingBoardId !== boardId
    ) {
      return;
    }

    event.preventDefault();
    const finalIds = studyBoardIds(previewBoardsRef.current ?? boards);
    if (finalIds.some((id, index) => id !== sourceIdsRef.current[index])) {
      onReorderBoards(finalIds);
    }
    resetDrag(event.currentTarget, event.pointerId);
  };

  const handlePointerCancel = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (pointerIdRef.current !== event.pointerId) return;
    resetDrag(event.currentTarget, event.pointerId);
  };

  const handleReorderKeyDown = (
    boardId: number,
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (
      reorderingBoards ||
      (event.key !== "ArrowUp" && event.key !== "ArrowDown")
    ) {
      return;
    }

    const sourceIndex = boards.findIndex((board) => board.id === boardId);
    const targetIndex =
      event.key === "ArrowUp" ? sourceIndex - 1 : sourceIndex + 1;
    if (
      sourceIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= boards.length
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onReorderBoards(
      studyBoardIds(moveStudyBoard(boards, boardId, targetIndex)),
    );
  };

  return (
    <aside className="w-full">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold">Scacchiere</h2>
        <div className="flex items-center gap-0.5">
          <Button size="icon-xs" variant="ghost" onClick={onImportPgn} title="Importa PGN">
            <Upload className="size-4" />
          </Button>
          <Button size="icon-xs" onClick={onCreateBoard} title="Nuova scacchiera">
            <Plus className="size-4" />
          </Button>
        </div>
      </div>
      {boards.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nessuna scacchiera. Creane una con il pulsante +.
        </p>
      ) : (
        <ul ref={listRef} className="flex flex-col gap-1">
          {displayedBoards.map((board) => {
            const boardId = board.id;
            if (boardId == null) return null;
            const active = boardId === selectedBoardId;
            const dragging = boardId === draggingBoardId;
            return (
              <li key={boardId} data-board-id={boardId}>
                <div
                  className={`flex items-center justify-between gap-1 rounded-md px-2 py-1.5 text-sm transition-colors ${
                    active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                  } ${dragging ? "opacity-70 ring-1 ring-ring" : ""}`}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="shrink-0 cursor-grab touch-none active:cursor-grabbing"
                    disabled={reorderingBoards || boards.length < 2}
                    aria-label={`Riordina ${board.title}`}
                    title="Trascina per riordinare"
                    onPointerDown={(event) =>
                      handlePointerDown(boardId, event)
                    }
                    onPointerMove={(event) =>
                      handlePointerMove(boardId, event)
                    }
                    onPointerUp={(event) => handlePointerUp(boardId, event)}
                    onPointerCancel={handlePointerCancel}
                    onKeyDown={(event) =>
                      handleReorderKeyDown(boardId, event)
                    }
                  >
                    <GripVertical className="size-4" />
                  </Button>
                  <button
                    type="button"
                    className="min-w-0 flex-1 cursor-pointer truncate text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => onSelectBoard(boardId)}
                  >
                    {board.title}
                  </button>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="hover:bg-accent"
                      onClick={(event) => onEditBoard(board, event)}
                      title="Rinomina scacchiera"
                    >
                      <Pencil className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="hover:bg-accent"
                      disabled={duplicatingBoardId != null}
                      aria-label="Duplica scacchiera"
                      title="Duplica scacchiera"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDuplicateBoard(boardId);
                      }}
                    >
                      {duplicatingBoardId === boardId ? (
                        <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
                      ) : (
                        <Copy className="size-3" aria-hidden="true" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-destructive hover:text-destructive"
                      onClick={(event) => onDeleteBoard(boardId, event)}
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
  );
}
