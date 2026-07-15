import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { OpeningReference, OpeningReport } from "@/types";

interface OpeningInsightsPanelProps {
  report: OpeningReport | undefined;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelect: (opening: OpeningReference) => void;
}

interface OpeningRowProps {
  label: string;
  opening: OpeningReference | null;
  onSelect: (opening: OpeningReference) => void;
}

function OpeningRow({ label, opening, onSelect }: OpeningRowProps) {
  return (
    <li className="rounded-md bg-muted/40 px-2.5 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      {opening ? (
        <button
          type="button"
          className="mt-0.5 w-full text-left text-xs font-medium text-primary hover:underline"
          aria-label={`Crea materiale di studio per ${opening.name}`}
          onClick={() => onSelect(opening)}
        >
          <span className="mr-1 text-muted-foreground">{opening.eco}</span>
          {opening.name}
        </button>
      ) : (
        <p className="mt-0.5 text-xs text-muted-foreground">Non disponibile</p>
      )}
    </li>
  );
}

export default function OpeningInsightsPanel({
  report,
  loading,
  error,
  onRetry,
  onSelect,
}: OpeningInsightsPanelProps) {
  return (
    <aside className="w-full" aria-label="Aperture della partita">
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Riconoscimento in corso...
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5">
          <p className="text-xs text-destructive">{error}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 h-7 px-2"
            onClick={onRetry}
          >
            <RefreshCw className="size-3.5" />
            Riprova
          </Button>
        </div>
      ) : report ? (
        <>
          <ul className="flex flex-col gap-2">
            <OpeningRow label="Giocata dal Bianco" opening={report.whitePlayed} onSelect={onSelect} />
            <OpeningRow label="Giocata dal Nero" opening={report.blackPlayed} onSelect={onSelect} />
            <OpeningRow label="Suggerita al Bianco" opening={report.whiteSuggested} onSelect={onSelect} />
            <OpeningRow label="Suggerita al Nero" opening={report.blackSuggested} onSelect={onSelect} />
          </ul>
          {!report.whiteSuggested && !report.blackSuggested ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Nessun suggerimento disponibile
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Le aperture saranno mostrate al termine dell'analisi.
        </p>
      )}
    </aside>
  );
}
