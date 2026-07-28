import { parseBadgePrefix } from "@/services/analysisService";
import { TacticalPatternChip } from "@/components/analysis/TacticalPatternChips";
import { tacticalPatternLabel } from "@/lib/tacticalPatterns";
import type { Move, TacticalPattern } from "@/types";
import { CircleCheck, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface MoveCommentPreviewProps {
  currentMove: Move | null;
  historyIndex: number;
  text: string;
  stockfishLabel?: boolean;
  onMateLineClick?: (mateIn: number) => void;
  tactics?: TacticalPattern[];
  selectedTacticKey?: string | null;
  onSelectedTacticKeyChange?: (key: string | null) => void;
}

export default function MoveCommentPreview({
  currentMove,
  historyIndex,
  text,
  stockfishLabel = false,
  onMateLineClick,
  tactics = [],
  selectedTacticKey = null,
  onSelectedTacticKeyChange,
}: MoveCommentPreviewProps) {
  return (
    <div className="w-full min-h-[64px] rounded-md border border-input bg-muted/40 px-3 py-2 text-sm whitespace-pre-wrap shrink-0">
      {currentMove ? (
        text.trim() ? (
          tactics.length > 0 && onSelectedTacticKeyChange ? (
            <TacticalMoveCommentText
              text={text}
              tactics={tactics}
              selectedTacticKey={selectedTacticKey}
              onSelectedTacticKeyChange={onSelectedTacticKeyChange}
              onMateLineClick={onMateLineClick}
            />
          ) : (
            <FormattedMoveComment text={text} onMateLineClick={onMateLineClick} />
          )
        ) : (
          <span className="text-muted-foreground italic">
            Nessun commento per la mossa {historyIndex}. {currentMove.moveNotation}.
          </span>
        )
      ) : (
        <span className="text-muted-foreground italic">
          Seleziona una mossa per leggere il commento{stockfishLabel ? " Stockfish" : ""}.
        </span>
      )}
    </div>
  );
}

function TacticalMoveCommentText({
  text,
  tactics,
  selectedTacticKey,
  onSelectedTacticKeyChange,
  onMateLineClick,
}: {
  text: string;
  tactics: TacticalPattern[];
  selectedTacticKey: string | null;
  onSelectedTacticKeyChange: (key: string | null) => void;
  onMateLineClick?: (mateIn: number) => void;
}) {
  const lines = text.split("\n");
  const lineClasses: Record<TacticalPattern["state"], string> = {
    missed: "border-dashed border-amber-500/35 bg-amber-500/5",
    conceded: "border-destructive/35 bg-destructive/10",
    found: "border-emerald-500/25 bg-emerald-500/5",
  };

  return (
    <span className="whitespace-pre-wrap">
      {lines.map((line, lineIndex) => {
        const description = line.replace(/^\s*•\s*/, "").trim();
        const patternIndex = tactics.findIndex(
          (pattern) => pattern.description.trim() === description,
        );
        const newline = lineIndex < lines.length - 1 ? "\n" : null;

        if (patternIndex < 0) {
          return (
            <span key={`line-${lineIndex}`}>
              <MateLineText text={line} onMateLineClick={onMateLineClick} />
              {newline}
            </span>
          );
        }

        const pattern = tactics[patternIndex];
        const explanation = tacticalExplanation(pattern);
        return (
          <span key={`tactic-${pattern.type}-${lineIndex}`}>
            <span
              data-tactical-comment
              data-tactical-state={pattern.state}
              className={cn(
                "my-1 block rounded-md border px-2 py-1.5",
                lineClasses[pattern.state],
              )}
            >
              <TacticalPatternChip
                pattern={pattern}
                patternIndex={patternIndex}
                patterns={tactics}
                selectedKey={selectedTacticKey}
                onSelectedKeyChange={onSelectedTacticKeyChange}
              />
              {": "}
              <MateLineText
                text={explanation}
                onMateLineClick={onMateLineClick}
              />
            </span>
            {newline}
          </span>
        );
      })}
    </span>
  );
}

function tacticalExplanation(pattern: TacticalPattern): string {
  const description = pattern.description.trim();
  const separatorIndex = description.indexOf(":");
  if (separatorIndex < 0) return description;

  const storedLabel = description.slice(0, separatorIndex).trim();
  const chipLabel = tacticalPatternLabel(pattern.type);
  return storedLabel.localeCompare(chipLabel, "it", { sensitivity: "base" }) === 0
    ? description.slice(separatorIndex + 1).trimStart()
    : description;
}

function FormattedMoveComment({
  text,
  onMateLineClick,
}: {
  text: string;
  onMateLineClick?: (mateIn: number) => void;
}) {
  const parsed = parseBadgePrefix(text);
  if (!parsed) {
    return <MateLineText text={text} onMateLineClick={onMateLineClick} />;
  }

  const icon =
    parsed.label === "!!" ? (
      <Star className="mr-1 inline size-3.5 align-[-2px] text-blue-500 fill-blue-500" />
    ) : parsed.label === "!" ? (
      <CircleCheck className="mr-1 inline size-3.5 align-[-2px] text-green-500" />
    ) : null;

  return (
    <span className="whitespace-pre-wrap">
      {icon ?? (
        <span
          className="inline-block px-1.5 rounded text-white font-bold mr-1 align-middle"
          style={{ backgroundColor: parsed.color }}
        >
          {parsed.label}
        </span>
      )}
      <MateLineText text={parsed.rest} onMateLineClick={onMateLineClick} />
    </span>
  );
}

function MateLineText({
  text,
  onMateLineClick,
}: {
  text: string;
  onMateLineClick?: (mateIn: number) => void;
}) {
  if (!onMateLineClick) {
    return <span className="whitespace-pre-wrap">{text}</span>;
  }

  const parts = text.split(/(matto in \d+)/gi);

  return (
    <span className="whitespace-pre-wrap">
      {parts.map((part, index) => {
        const match = part.match(/^matto in (\d+)$/i);
        if (!match) return <span key={`plain-${index}`}>{part}</span>;

        const mateIn = Number(match[1]);
        return (
          <button
            key={`mate-${index}`}
            type="button"
            className="font-medium text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onMateLineClick(mateIn)}
          >
            {part}
          </button>
        );
      })}
    </span>
  );
}
