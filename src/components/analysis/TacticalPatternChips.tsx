import {
  tacticalPatternColor,
  tacticalPatternKey,
  tacticalPatternLabel,
} from "@/lib/tacticalPatterns";
import type { TacticalPattern } from "@/types";

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

export function TacticalPatternChip({
  pattern,
  patternIndex,
  patterns,
  selectedKey,
  onSelectedKeyChange,
}: TacticalPatternChipProps) {
  const key = tacticalPatternKey(pattern);
  const color = tacticalPatternColor(patternIndex);
  const label = displayLabel(pattern, patternIndex, patterns);
  const active = selectedKey === key;

  return (
    <button
      type="button"
      aria-pressed={active}
      title={pattern.description}
      className="rounded-full border px-2.5 py-1 text-xs font-medium transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      style={{
        borderColor: color,
        backgroundColor: active ? color : `${color}1a`,
        color: active ? "white" : color,
        boxShadow: active ? `0 0 0 2px ${color}55` : undefined,
      }}
      onClick={() => onSelectedKeyChange(active ? null : key)}
    >
      {label}
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
