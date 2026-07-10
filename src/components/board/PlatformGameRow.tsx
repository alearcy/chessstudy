import { CalendarDays, Clock3, ExternalLink, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PlatformGameSummary } from "@/types/platformGame";

export default function PlatformGameRow({
  game,
  importing,
  importDisabled,
  onImport,
}: {
  game: PlatformGameSummary;
  importing: boolean;
  importDisabled: boolean;
  onImport: () => void;
}) {
  const whiteLabel = formatPlayer(game.whiteName, game.whiteRating);
  const blackLabel = formatPlayer(game.blackName, game.blackRating);

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
            <span className={game.userColor === "white" ? "text-primary" : undefined}>
              {game.whiteName}
            </span>
            <span className="text-xs text-muted-foreground">contro</span>
            <span className={game.userColor === "black" ? "text-primary" : undefined}>
              {game.blackName}
            </span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{game.result}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {whiteLabel} · {blackLabel}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="size-3" />
              {formatGameDate(game.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              <Clock3 className="size-3" />
              {formatSpeed(game.speed)}{game.timeControl ? ` · ${game.timeControl}` : ""}
            </span>
            {game.opening && <span className="truncate">{game.opening}</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon-xs" asChild title="Apri la partita originale">
            <a href={game.url} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3" />
            </a>
          </Button>
          <Button
            size="sm"
            onClick={onImport}
            disabled={importDisabled}
            aria-label={`Importa ${game.whiteName} contro ${game.blackName}`}
          >
            {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Importa
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatPlayer(name: string, rating: number | null) {
  return rating === null ? name : `${name} (${rating})`;
}

function formatGameDate(date: Date) {
  if (Number.isNaN(date.getTime()) || date.getTime() === 0) return "Data sconosciuta";
  return date.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatSpeed(speed: string) {
  const labels: Record<string, string> = {
    ultraBullet: "UltraBullet",
    bullet: "Bullet",
    blitz: "Blitz",
    rapid: "Rapid",
    classical: "Classica",
    daily: "Giornaliera",
    correspondence: "Corrispondenza",
  };
  return labels[speed] ?? speed;
}
