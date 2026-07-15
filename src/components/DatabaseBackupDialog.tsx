import { useEffect, useState } from "react";
import { CheckCircle2, DatabaseBackup, Download, Loader2, Upload } from "lucide-react";

import ErrorNotice from "@/components/ErrorNotice";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createDatabaseBackupJson,
  inspectDatabaseBackupJson,
  restoreDatabaseBackupJson,
  type DatabaseBackupSummary,
} from "@/services/databaseBackupService";
import {
  saveDatabaseBackupFile,
  selectDatabaseBackupFile,
} from "@/services/databaseBackupFileService";

interface PendingBackup {
  name: string;
  contents: string;
  summary: DatabaseBackupSummary;
}

type Operation = "export" | "select" | "restore";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatSummary(summary: DatabaseBackupSummary): string {
  return `${summary.profiles} profili, ${summary.lessons} lezioni, ${summary.boards} scacchiere e ${summary.moves} mosse`;
}

export default function DatabaseBackupDialog({
  open,
  onOpenChange,
  onRestored,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestored: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState<Operation | null>(null);
  const [pending, setPending] = useState<PendingBackup | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryOperation, setRetryOperation] = useState<Operation | null>(null);

  useEffect(() => {
    if (!open) {
      setPending(null);
      setSuccess(null);
      setError(null);
      setRetryOperation(null);
    }
  }, [open]);

  const start = (operation: Operation) => {
    setBusy(operation);
    setError(null);
    setSuccess(null);
    setRetryOperation(null);
  };

  const handleExport = async () => {
    start("export");
    try {
      const json = await createDatabaseBackupJson();
      const filename = await saveDatabaseBackupFile(json);
      if (filename) setSuccess(`Backup salvato: ${filename}`);
    } catch (cause) {
      setError(errorMessage(cause, "Esportazione del backup non riuscita."));
      setRetryOperation("export");
    } finally {
      setBusy(null);
    }
  };

  const handleSelect = async () => {
    start("select");
    setPending(null);
    try {
      const selected = await selectDatabaseBackupFile();
      if (!selected) return;
      const summary = inspectDatabaseBackupJson(selected.contents);
      setPending({ ...selected, summary });
    } catch (cause) {
      setError(errorMessage(cause, "Il backup selezionato non è valido."));
      setRetryOperation("select");
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async () => {
    if (!pending) return;
    start("restore");
    try {
      await restoreDatabaseBackupJson(pending.contents);
      await onRestored();
      setPending(null);
      setSuccess("Backup ripristinato correttamente.");
    } catch (cause) {
      setError(errorMessage(cause, "Ripristino del backup non riuscito."));
      setRetryOperation("restore");
    } finally {
      setBusy(null);
    }
  };

  const retry = () => {
    if (retryOperation === "export") void handleExport();
    if (retryOperation === "select") void handleSelect();
    if (retryOperation === "restore") void handleRestore();
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !busy && onOpenChange(nextOpen)}>
      <DialogContent showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DatabaseBackup className="size-5" />
            Backup locale
          </DialogTitle>
          <DialogDescription>
            Esporta tutti i profili e i contenuti oppure ripristina un backup precedente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button variant="outline" onClick={() => void handleExport()} disabled={busy !== null}>
            {busy === "export" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Esporta backup
          </Button>
          <Button variant="outline" onClick={() => void handleSelect()} disabled={busy !== null}>
            {busy === "select" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Scegli backup da importare
          </Button>
        </div>

        {success && (
          <div className="flex items-start gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {error && (
          <ErrorNotice
            message={error}
            onRetry={retryOperation ? retry : undefined}
            onDismiss={() => setError(null)}
          />
        )}

        {pending && (
          <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <div>
              <p className="font-medium">{pending.name}</p>
              <p className="text-sm text-muted-foreground">{formatSummary(pending.summary)}</p>
            </div>
            <p className="text-sm text-destructive">
              Il ripristino sostituirà tutti i dati presenti nell'applicazione. Questa operazione non è annullabile.
            </p>
            <Button
              variant="destructive"
              onClick={() => void handleRestore()}
              disabled={busy !== null}
            >
              {busy === "restore" && <Loader2 className="size-4 animate-spin" />}
              Ripristina e sostituisci i dati
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy !== null}>
            Chiudi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
