import { CircleDashed, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";

interface TacticalVariationNoticeProps {
  moveSan: string;
  onClose: () => void;
}

export default function TacticalVariationNotice({
  moveSan,
  onClose,
}: TacticalVariationNoticeProps) {
  return (
    <div className="flex h-8 min-w-0 items-center justify-between gap-2 rounded-md border border-dashed border-amber-500/40 bg-amber-500/10 px-2">
      <div
        className="flex min-w-0 items-center gap-1.5 text-xs text-amber-50"
        aria-live="polite"
        title={`Posizione alternativa: se avessi giocato ${moveSan}`}
      >
        <CircleDashed
          aria-hidden="true"
          className="size-3.5 shrink-0 text-amber-300"
        />
        <span className="sr-only">Posizione alternativa</span>
        <p className="truncate">
          <span className="font-medium text-amber-200">Alternativa · </span>
          <span>Se avessi giocato</span>{" "}
          <strong className="font-mono font-semibold">{moveSan}</strong>…
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        aria-label="Torna alla partita"
        title="Torna alla partita"
        className="shrink-0 text-amber-100 hover:bg-amber-500/15 hover:text-amber-50"
        onClick={onClose}
      >
        <Undo2 aria-hidden="true" className="size-3" />
        Torna
      </Button>
    </div>
  );
}
