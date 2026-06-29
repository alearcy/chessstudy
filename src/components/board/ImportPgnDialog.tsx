import { useMemo, useRef, useState } from "react";
import { CircleCheck, TriangleAlert, Upload } from "lucide-react";
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
import { parsePgn, importPgnToLesson, importPgnAsLesson } from "@/services/pgnService";

interface ImportPgnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** ID lezione esistente (sidebar scacchiera). */
  lessonId?: number;
  /** Callback dopo import con lessonId (sidebar). */
  onImported?: (boardId: number) => void;
  /** Callback dopo import da home page: crea lezione + board. */
  onImportedLesson?: (lessonId: number, boardId: number) => void;
}

export default function ImportPgnDialog({
  open,
  onOpenChange,
  lessonId,
  onImported,
  onImportedLesson,
}: ImportPgnDialogProps) {
  const [pgnText, setPgnText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Anteprima parse (validazione live). Non lancia: cattura l'errore.
  const preview = useMemo(() => {
    if (!pgnText.trim()) return null;
    try {
      const parsed = parsePgn(pgnText);
      return { ok: true as const, title: parsed.title, count: parsed.moves.length };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [pgnText]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPgnText(String(reader.result ?? ""));
      setImportError(null);
    };
    reader.onerror = () => setImportError("Impossibile leggere il file.");
    reader.readAsText(file);
    // Reset value per permettere di riselezionare lo stesso file.
    e.target.value = "";
  };

  const handleImport = async () => {
    if (!preview?.ok) return;
    setImporting(true);
    setImportError(null);
    try {
      if (lessonId != null) {
        // Flusso sidebar: importa in lezione esistente.
        const boardId = await importPgnToLesson(lessonId, pgnText);
        onImported?.(boardId);
      } else {
        // Flusso home page: ogni PGN diventa una lezione analysis autonoma.
        const { lessonId: newLessonId, boardId } = await importPgnAsLesson(pgnText);
        onImportedLesson?.(newLessonId, boardId);
      }
      setPgnText("");
      setImporting(false);
      onOpenChange(false);
    } catch (e) {
      setImporting(false);
      setImportError((e as Error).message || "Errore durante l'import.");
    }
  };

  const handleClose = (next: boolean) => {
    if (importing) return;
    setImportError(null);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importa PGN</DialogTitle>
          <DialogDescription>
            Incolla il testo di una partita in formato PGN o carica un file
            <code className="px-1">.pgn</code>. Verrà creata una nuova
            scacchiera con la storia delle mosse. Le varianti{" "}
            <code className="px-1">( )</code> non sono supportate (solo linea
            principale).
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Input
              ref={fileInputRef}
              type="file"
              accept=".pgn,application/x-chess-pgn,text/plain"
              onChange={handleFile}
              className="text-xs"
            />
          </div>

          <Textarea
            value={pgnText}
            onChange={(e) => {
              setPgnText(e.target.value);
              setImportError(null);
            }}
            placeholder={'[Event "Partita amichevole"]\n[White "Bianco"]\n[Black "Nero"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *'}
            rows={10}
            className="resize-y font-mono text-xs"
          />

          {/* Anteprima / errore parse */}
          {preview === null ? null : preview.ok ? (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CircleCheck className="size-4 shrink-0 text-green-600" />
              <strong>{preview.title}</strong> — {preview.count}{" "}
              {preview.count === 1 ? "mossa" : "mosse"} rilevate.
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <TriangleAlert className="size-4 shrink-0" />
              PGN non valido: {preview.error}
            </p>
          )}

          {importError && (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <TriangleAlert className="size-4 shrink-0" />
              {importError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={importing}
          >
            Annulla
          </Button>
          <Button
            onClick={handleImport}
            disabled={!preview?.ok || importing}
          >
            <Upload className="size-4" />
            {importing ? "Importazione..." : "Importa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
