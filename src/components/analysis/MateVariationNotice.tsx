import { Loader2, Route, TriangleAlert, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MateLineNoticeState =
  | { phase: "loading" }
  | { phase: "ready"; current: number; total: number }
  | { phase: "unavailable" }
  | { phase: "error" };

interface MateVariationNoticeProps {
  mateIn: number;
  state: MateLineNoticeState;
  onClose: () => void;
}

export default function MateVariationNotice({
  mateIn,
  state,
  onClose,
}: MateVariationNoticeProps) {
  const failed = state.phase === "unavailable" || state.phase === "error";
  const detail =
    state.phase === "loading"
      ? "Calcolo la sequenza…"
      : state.phase === "ready"
        ? `Mossa ${state.current} di ${state.total}`
        : state.phase === "unavailable"
          ? "Sequenza non disponibile"
          : "Calcolo non riuscito";
  const Icon =
    state.phase === "loading" ? Loader2 : failed ? TriangleAlert : Route;

  return (
    <div
      data-testid="mate-variation-notice"
      data-mate-line-state={state.phase}
      className={cn(
        "flex h-8 min-w-0 items-center justify-between gap-2 rounded-md border px-2",
        failed
          ? "border-destructive/40 bg-destructive/10"
          : "border-emerald-500/35 bg-emerald-500/10",
      )}
    >
      <div
        className={cn(
          "flex min-w-0 items-center gap-1.5 text-xs",
          failed ? "text-red-50" : "text-emerald-50",
        )}
        aria-live="polite"
        title={`Sequenza di matto: matto in ${mateIn}, ${detail}`}
      >
        <Icon
          aria-hidden="true"
          className={cn(
            "size-3.5 shrink-0",
            state.phase === "loading" &&
              "animate-spin motion-reduce:animate-none",
            failed ? "text-red-300" : "text-emerald-300",
          )}
        />
        <span className="sr-only">Sequenza di matto</span>
        <p className="truncate">
          <span
            className={cn(
              "font-medium",
              failed ? "text-red-200" : "text-emerald-200",
            )}
          >
            Matto in {mateIn}
          </span>
          <span aria-hidden="true"> · </span>
          <span>{detail}</span>
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        aria-label="Torna alla partita"
        title="Torna alla partita"
        className={cn(
          "shrink-0",
          failed
            ? "text-red-100 hover:bg-destructive/15 hover:text-red-50"
            : "text-emerald-100 hover:bg-emerald-500/15 hover:text-emerald-50",
        )}
        onClick={onClose}
      >
        <Undo2 aria-hidden="true" className="size-3" />
        Torna
      </Button>
    </div>
  );
}
