import { cn } from "@/lib/utils";

interface AnalysisPlayerLabelProps {
  orientation: "white" | "black";
  position: "top" | "bottom";
  whiteName?: string | null;
  blackName?: string | null;
  whiteElo?: string | null;
  blackElo?: string | null;
  whiteAccuracy?: number | null;
  blackAccuracy?: number | null;
  className?: string;
}

function clean(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return !trimmed || trimmed === "?" ? null : trimmed;
}

export default function AnalysisPlayerLabel({
  orientation,
  position,
  whiteName,
  blackName,
  whiteElo,
  blackElo,
  whiteAccuracy,
  blackAccuracy,
  className,
}: AnalysisPlayerLabelProps) {
  const color =
    position === "bottom"
      ? orientation
      : orientation === "white"
        ? "black"
        : "white";
  const name = clean(color === "white" ? whiteName : blackName);
  const elo = clean(color === "white" ? whiteElo : blackElo);
  const accuracy = color === "white" ? whiteAccuracy : blackAccuracy;

  if (!name && !elo && accuracy == null) return null;

  return (
    <div
      className={cn(
        "flex min-w-0 items-baseline gap-2 text-sm",
        className,
      )}
      data-testid={`analysis-player-${position}`}
    >
      {name || elo ? (
        <span className="flex min-w-0 items-baseline gap-2">
          {name ? (
            <span className="truncate font-semibold text-foreground" title={name}>
              {name}
            </span>
          ) : null}
          {elo ? (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              ({elo})
            </span>
          ) : null}
        </span>
      ) : null}
      {accuracy != null ? (
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          Precisione{" "}
          <span className="tabular-nums text-foreground">{accuracy}%</span>
        </span>
      ) : null}
    </div>
  );
}
