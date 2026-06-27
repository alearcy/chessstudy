import { Pencil, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Board } from "@/types";

interface StudyBoardSidebarProps {
  boards: Board[];
  selectedBoardId: number | null;
  onSelectBoard: (boardId: number) => void;
  onImportPgn: () => void;
  onCreateBoard: () => void;
  onEditBoard: (board: Board, event: React.MouseEvent) => void;
  onDeleteBoard: (boardId: number, event: React.MouseEvent) => void;
}

export default function StudyBoardSidebar({
  boards,
  selectedBoardId,
  onSelectBoard,
  onImportPgn,
  onCreateBoard,
  onEditBoard,
  onDeleteBoard,
}: StudyBoardSidebarProps) {
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
        <ul className="flex flex-col gap-1">
          {boards.map((board) => {
            const boardId = board.id;
            if (boardId == null) return null;
            const active = boardId === selectedBoardId;
            return (
              <li key={boardId}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectBoard(boardId)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectBoard(boardId);
                    }
                  }}
                  className={`flex items-center justify-between gap-1 rounded-md px-2 py-1.5 cursor-pointer text-sm transition-colors ${
                    active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                  }`}
                >
                  <span className="truncate">{board.title}</span>
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
