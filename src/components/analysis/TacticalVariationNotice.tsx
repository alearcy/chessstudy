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
    <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-amber-500/40 bg-amber-500/10 px-3 py-2">
      <div className="min-w-0" aria-live="polite">
        <span className="text-xs font-medium text-amber-200">
          Posizione alternativa
        </span>
        <p className="mt-0.5 text-sm text-amber-50">
          <CircleDashed
            aria-hidden="true"
            className="mr-1.5 inline size-3.5 align-[-2px] text-amber-300"
          />
          <span>Se avessi giocato</span>{" "}
          <strong className="font-mono font-semibold">{moveSan}</strong>…
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0 text-amber-100 hover:bg-amber-500/15 hover:text-amber-50"
        onClick={onClose}
      >
        <Undo2 aria-hidden="true" className="size-3.5" />
        Torna alla partita
      </Button>
    </div>
  );
}
