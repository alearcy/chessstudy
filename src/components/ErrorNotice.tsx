import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorNoticeProps {
  title?: string;
  message: string;
  onRetry?: () => void | Promise<void>;
  onDismiss?: () => void;
  retryLabel?: string;
}

export default function ErrorNotice({
  title = "Errore",
  message,
  onRetry,
  onDismiss,
  retryLabel = "Riprova",
}: ErrorNoticeProps) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-destructive/90">{message}</p>
      </div>
      {onRetry && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 px-2 text-destructive hover:text-destructive"
          onClick={onRetry}
        >
          <RefreshCw className="size-3.5" />
          {retryLabel}
        </Button>
      )}
      {onDismiss && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="shrink-0 text-destructive hover:text-destructive"
          onClick={onDismiss}
          title="Chiudi"
        >
          <X className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
