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
  fetchChessComArchives,
  fetchChessComGames,
  type ChessComArchive,
  type ChessComGameSummary,
} from "@/services/chessComService";
import { importPgnAsLesson } from "@/services/pgnService";

interface ImportChessComDialogProps {
  open: boolean;
  username: string;
  onOpenChange: (open: boolean) => void;
  onImportedLesson: (lessonId: number, boardId: number) => void;
}

export default function ImportChessComDialog({
  open,
  username,
  onOpenChange,
  onImportedLesson,
}: ImportChessComDialogProps) {
  const [archives, setArchives] = useState<ChessComArchive[]>([]);
  const [selectedArchiveUrl, setSelectedArchiveUrl] = useState("");
  const [games, setGames] = useState<ChessComGameSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importingGameId, setImportingGameId] = useState<string | null>(null);

  const loadGames = useCallback(async (archiveUrl: string) => {
    setLoading(true);
    setError(null);
    try {
      setGames(await fetchChessComGames(archiveUrl, username));
    } catch (reason) {
      setGames([]);
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }, [username]);

  const loadArchives = useCallback(async () => {
    setLoading(true);
    setError(null);
    setGames([]);
    try {
      const availableArchives = await fetchChessComArchives(username);
      setArchives(availableArchives);
      const latestUrl = availableArchives[0]?.url ?? "";
      setSelectedArchiveUrl(latestUrl);
      if (latestUrl) await loadGames(latestUrl);
    } catch (reason) {
      setArchives([]);
      setSelectedArchiveUrl("");
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }, [loadGames, username]);

  useEffect(() => {
    if (open) void loadArchives();
  }, [loadArchives, open]);

  const handleArchiveChange = (archiveUrl: string) => {
    setSelectedArchiveUrl(archiveUrl);
    void loadGames(archiveUrl);
  };

  const handleImport = async (game: ChessComGameSummary) => {
    setImportingGameId(game.id);
    setError(null);
    try {
      const imported = await importPgnAsLesson(game.pgn);
      onOpenChange(false);
      onImportedLesson(imported.lessonId, imported.boardId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Importazione fallita.");
    } finally {
      setImportingGameId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>Partite di {username} su Chess.com</DialogTitle>
          <DialogDescription>
            Scegli il mese e importa una partita in modalita analisi.
          </DialogDescription>
        </DialogHeader>

        {archives.length > 0 && (
          <div className="space-y-2">
            <label htmlFor="chesscom-archive" className="text-sm font-medium">Mese</label>
            <select
              id="chesscom-archive"
              value={selectedArchiveUrl}
              onChange={(event) => handleArchiveChange(event.target.value)}
              disabled={loading}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
            >
              {archives.map((archive) => (
                <option key={archive.url} value={archive.url}>{archive.label}</option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <ErrorNotice
            message={error}
            onRetry={selectedArchiveUrl ? () => loadGames(selectedArchiveUrl) : loadArchives}
            onDismiss={() => setError(null)}
          />
        )}

        {loading ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="size-7 animate-spin" />
            <p className="text-sm">Caricamento partite da Chess.com...</p>
          </div>
        ) : archives.length === 0 && !error ? (
          <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
            Nessun archivio trovato.
          </div>
        ) : games.length === 0 && !error ? (
          <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
            Nessuna partita standard trovata in questo mese.
          </div>
        ) : (
          <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
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
