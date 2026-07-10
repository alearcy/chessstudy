import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import ErrorNotice from "@/components/ErrorNotice";
import PlatformGameRow from "@/components/board/PlatformGameRow";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchLichessGames,
  type LichessGameSummary,
} from "@/services/lichessService";
import { importPgnAsLesson } from "@/services/pgnService";

interface ImportLichessDialogProps {
  open: boolean;
  username: string;
  onOpenChange: (open: boolean) => void;
  onImportedLesson: (lessonId: number, boardId: number) => void;
}

export default function ImportLichessDialog({
  open,
  username,
  onOpenChange,
  onImportedLesson,
}: ImportLichessDialogProps) {
  const [games, setGames] = useState<LichessGameSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importingGameId, setImportingGameId] = useState<string | null>(null);

  const loadGames = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setGames(await fetchLichessGames(username));
    } catch (reason) {
      setGames([]);
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    if (open) void loadGames();
  }, [loadGames, open]);

  const handleImport = async (game: LichessGameSummary) => {
    setImportingGameId(game.id);
    setError(null);
    try {
      const imported = await importPgnAsLesson(game.pgn);
      onOpenChange(false);
      onImportedLesson(imported.lessonId, imported.boardId);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Importazione della partita fallita.",
      );
    } finally {
      setImportingGameId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>Partite di {username} su Lichess</DialogTitle>
          <DialogDescription>
            Scegli una delle 30 partite piu recenti da aprire in modalita analisi.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <ErrorNotice
            message={error}
            onRetry={loadGames}
            onDismiss={() => setError(null)}
          />
        )}

        {loading ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="size-7 animate-spin" />
            <p className="text-sm">Caricamento partite da Lichess...</p>
          </div>
        ) : games.length === 0 && !error ? (
          <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
            Nessuna partita trovata.
          </div>
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {games.map((game) => (
              <PlatformGameRow
                key={game.id}
                game={game}
                importing={importingGameId === game.id}
                importDisabled={importingGameId !== null}
                onImport={() => void handleImport(game)}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
