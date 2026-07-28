import { Chess } from "chess.js";
import type {
  TacticalAlternative,
  TacticalPattern,
  TacticalPatternGeometry,
  TacticalReviewState,
} from "@/types";
import type { Square } from "chess.js";

const TACTICAL_TYPES = new Set<TacticalPattern["type"]>([
  "fork",
  "pin_absolute",
  "pin_relative",
  "skewer",
  "discovered_attack",
  "double_check",
  "mate_threat",
  "hanging_piece",
  "trapped_piece",
]);

const TACTICAL_STATES = new Set<TacticalReviewState>([
  "missed",
  "conceded",
  "found",
]);

const TACTICAL_LABELS: Record<TacticalPattern["type"], string> = {
  fork: "Forchetta",
  pin_absolute: "Inchiodatura assoluta",
  pin_relative: "Inchiodatura relativa",
  skewer: "Infilata",
  discovered_attack: "Attacco di scoperta",
  double_check: "Scacco doppio",
  mate_threat: "Minaccia di matto",
  hanging_piece: "Pezzo indifeso",
  trapped_piece: "Pezzo intrappolato",
};

const TACTICAL_STATE_LABELS: Record<TacticalReviewState, string> = {
  missed: "Mancata",
  conceded: "Concessa",
  found: "Trovata",
};

const TACTICAL_COLORS: Record<TacticalPattern["type"], string> = {
  fork: "#0284c7",
  pin_absolute: "#c026d3",
  pin_relative: "#c026d3",
  skewer: "#ea580c",
  discovered_attack: "#059669",
  double_check: "#7c3aed",
  mate_threat: "#e11d48",
  hanging_piece: "#d97706",
  trapped_piece: "#0d9488",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSquare(value: unknown): value is string {
  return typeof value === "string" && /^[a-h][1-8]$/.test(value);
}

function isFen(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    new Chess(value);
    return true;
  } catch {
    return false;
  }
}

function isTacticalPattern(value: unknown): value is TacticalPattern {
  if (!isRecord(value) || !TACTICAL_TYPES.has(value.type as TacticalPattern["type"])) {
    return false;
  }
  const state = value.state as TacticalReviewState;
  if (!TACTICAL_STATES.has(state)) return false;
  const hasValidAlternative =
    isRecord(value.alternative) &&
    typeof value.alternative.moveSan === "string" &&
    value.alternative.moveSan.trim().length > 0 &&
    isFen(value.alternative.fen);
  if (state === "missed" ? !hasValidAlternative : value.alternative !== undefined) {
    return false;
  }
  return (
    typeof value.actor === "string" &&
    Array.isArray(value.victims) &&
    value.victims.every((victim) => typeof victim === "string") &&
    Array.isArray(value.squares) &&
    value.squares.length > 0 &&
    value.squares.every(isSquare) &&
    typeof value.description === "string"
  );
}

export function tacticalPatternsFromJson(value: unknown): TacticalPattern[] {
  return Array.isArray(value) ? value.filter(isTacticalPattern) : [];
}

export function tacticalPatternGeometryKey(
  pattern: TacticalPatternGeometry,
): string {
  return `${pattern.type}:${[...pattern.squares].sort().join(",")}`;
}

export function tacticalPatternKey(pattern: TacticalPattern): string {
  return `${pattern.state}:${tacticalPatternGeometryKey(pattern)}`;
}

export function tacticalPatternLabel(type: TacticalPattern["type"]): string {
  return TACTICAL_LABELS[type];
}

export function tacticalReviewStateLabel(
  state: TacticalReviewState,
): string {
  return TACTICAL_STATE_LABELS[state];
}

export function tacticalPatternColor(
  type: TacticalPattern["type"],
): string {
  return TACTICAL_COLORS[type];
}

export function tacticalAlternativeForSelection(
  patterns: TacticalPattern[],
  selectedKey: string | null,
): TacticalPattern["alternative"] | null {
  if (!selectedKey) return null;
  const selected = patterns.find(
    (pattern) => tacticalPatternKey(pattern) === selectedKey,
  );
  return selected?.state === "missed"
    ? selected.alternative ?? null
    : null;
}

export function tacticalAlternativeMoveSquares(
  beforeFen: string,
  alternative: TacticalAlternative,
): { from: Square; to: Square } | null {
  try {
    const position = new Chess(beforeFen);
    const move = position.move(alternative.moveSan);
    return move
      ? { from: move.from as Square, to: move.to as Square }
      : null;
  } catch {
    return null;
  }
}
