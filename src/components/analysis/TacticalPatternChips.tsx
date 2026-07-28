import {
  tacticalPatternColor,
  tacticalPatternKey,
  tacticalPatternLabel,
  tacticalReviewStateLabel,
} from "@/lib/tacticalPatterns";
import type { TacticalPattern } from "@/types";
import { Check, CircleDashed, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface TacticalPatternChipsProps {
  patterns: TacticalPattern[];
  selectedKey: string | null;
  onSelectedKeyChange: (key: string | null) => void;
}

interface TacticalPatternChipProps extends TacticalPatternChipsProps {
  pattern: TacticalPattern;
  patternIndex: number;
}

function displayLabel(
  pattern: TacticalPattern,
  patternIndex: number,
  patterns: TacticalPattern[],
): string {
  const baseLabel = tacticalPatternLabel(pattern.type);
  const sameType = patterns.filter((item) => item.type === pattern.type);
  if (sameType.length <= 1) return baseLabel;
  const occurrence = patterns
    .slice(0, patternIndex + 1)
    .filter((item) => item.type === pattern.type).length;
  return `${baseLabel} ${occurrence}`;
}

const stateClasses: Record<TacticalPattern["state"], string> = {
  missed:
    "border-dashed bg-amber-500/10 text-amber-200 hover:bg-amber-500/20",
  conceded:
    "bg-destructive/10 text-red-200 hover:bg-destructive/20",
  found:
    "bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20",
};

const stateIcons = {
  missed: CircleDashed,
  conceded: TriangleAlert,
  found: Check,
} satisfies Record<TacticalPattern["state"], typeof Check>;

export function TacticalPatternChip({
  pattern,
  patternIndex,
  patterns,
  selectedKey,
  onSelectedKeyChange,
}: TacticalPatternChipProps) {
  const key = tacticalPatternKey(pattern);
  const color = tacticalPatternColor(pattern.type);
  const label = displayLabel(pattern, patternIndex, patterns);
  const stateLabel = tacticalReviewStateLabel(pattern.state);
  const StateIcon = stateIcons[pattern.state];
  const active = selectedKey === key;

  return (
    <button
      type="button"
      aria-label={`${stateLabel} · ${label}`}
      aria-pressed={active}
      data-tactical-state={pattern.state}
      title={pattern.description}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-[background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        stateClasses[pattern.state],
      )}
      style={{
        borderColor: color,
        boxShadow: active
          ? `0 1px 2px rgb(0 0 0 / 25%), 0 0 0 2px ${color}66`
          : undefined,
      }}
      onClick={() => onSelectedKeyChange(active ? null : key)}
    >
      <StateIcon
        aria-hidden="true"
        className="mr-1 inline size-3 align-[-2px]"
      />
      <span>{stateLabel} · </span>
      <span style={{ color }}>{label}</span>
    </button>
  );
}

export default function TacticalPatternChips({
  patterns,
  selectedKey,
  onSelectedKeyChange,
}: TacticalPatternChipsProps) {
  return (
    <div className="flex flex-wrap gap-1.5 pt-2" aria-label="Tattiche della mossa">
      {patterns.map((pattern, index) => {
        const key = tacticalPatternKey(pattern);
        return (
          <TacticalPatternChip
            key={key}
            pattern={pattern}
            patternIndex={index}
            patterns={patterns}
            selectedKey={selectedKey}
            onSelectedKeyChange={onSelectedKeyChange}
          />
        );
      })}
    </div>
  );
}
