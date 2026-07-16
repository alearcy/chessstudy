import MoveClassBadge from "@/components/analysis/MoveClassBadge";
import { evalToWhiteShare } from "@/services/analysisService";
import {
  classifyMoveAtIndex,
  type EvaluatedMove,
  type EvaluationPosition,
} from "@/services/moveAnnotationService";

interface GameEvaluationChartProps {
  start: EvaluationPosition;
  moves: readonly EvaluatedMove[];
  currentMoveIndex: number;
  onGoToMove: (index: number) => void;
}

interface PlotPoint {
  index: number;
  x: number;
  y: number;
}

const WIDTH = 1000;
const HEIGHT = 160;
const PADDING_X = 16;
const PADDING_Y = 16;

function xForIndex(index: number, moveCount: number): number {
  const ratio = moveCount === 0 ? 0 : index / moveCount;
  return PADDING_X + ratio * (WIDTH - PADDING_X * 2);
}

function plotPoint(
  position: EvaluationPosition,
  index: number,
  moveCount: number,
): PlotPoint | null {
  if (position.evalCp == null && position.evalMate == null) return null;
  const whiteShare = evalToWhiteShare(
    position.evalCp ?? null,
    position.evalMate ?? null,
  );
  return {
    index,
    x: xForIndex(index, moveCount),
    y: PADDING_Y + ((100 - whiteShare) / 100) * (HEIGHT - PADDING_Y * 2),
  };
}

function contiguousSegments(
  points: readonly (PlotPoint | null)[],
): PlotPoint[][] {
  const segments: PlotPoint[][] = [];
  let current: PlotPoint[] = [];
  for (const point of points) {
    if (point) {
      current.push(point);
    } else if (current.length > 0) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length > 0) segments.push(current);
  return segments;
}

function svgPoints(points: readonly PlotPoint[]): string {
  return points.map(({ x, y }) => `${x},${y}`).join(" ");
}

export default function GameEvaluationChart({
  start,
  moves,
  currentMoveIndex,
  onGoToMove,
}: GameEvaluationChartProps) {
  const positions: EvaluationPosition[] = [start, ...moves];
  const points = positions.map((position, index) =>
    plotPoint(position, index, moves.length),
  );
  const knownPoints = points.filter((point): point is PlotPoint => point != null);
  if (knownPoints.length === 0) return null;

  const segments = contiguousSegments(points);
  const safeIndex = Math.min(moves.length, Math.max(0, currentMoveIndex));
  const cursorX = xForIndex(safeIndex, moves.length);
  const markers = moves.flatMap((move, moveIndex) => {
    const annotation = classifyMoveAtIndex(start, moves, moveIndex);
    const badge = annotation?.badge;
    const point = points[moveIndex + 1];
    return point && badge && (badge.label === "!!" || badge.label === "??")
      ? [{ move, point, badge }]
      : [];
  });
  const activeLabel =
    safeIndex === 0
      ? "Posizione iniziale"
      : `Dopo ${moves[safeIndex - 1]?.moveNotation ?? `la mossa ${safeIndex}`}`;

  return (
    <div
      className="relative w-full overflow-hidden rounded-md border border-white/10 bg-neutral-900/80 text-white shadow-inner focus-within:ring-2 focus-within:ring-ring"
      data-testid="evaluation-chart"
    >
      <svg
        aria-hidden="true"
        className="block h-32 w-full"
        preserveAspectRatio="none"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        <line
          x1={PADDING_X}
          x2={WIDTH - PADDING_X}
          y1={HEIGHT / 2}
          y2={HEIGHT / 2}
          stroke="currentColor"
          strokeOpacity="0.16"
          strokeWidth="1"
        />
        {segments
          .filter((segment) => segment.length >= 2)
          .map((segment) => {
            const first = segment[0];
            const last = segment[segment.length - 1];
            const linePoints = svgPoints(segment);
            return (
              <g key={`${first.index}-${last.index}`}>
                <polygon
                  fill="currentColor"
                  opacity="0.07"
                  points={`${linePoints} ${last.x},${HEIGHT - PADDING_Y} ${first.x},${HEIGHT - PADDING_Y}`}
                />
                <polyline
                  data-testid="evaluation-line"
                  fill="none"
                  points={linePoints}
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity="0.82"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}
        {knownPoints.map((point) => (
          <circle
            key={point.index}
            data-testid="evaluation-point"
            cx={point.x}
            cy={point.y}
            fill="currentColor"
            opacity="0.75"
            r="2"
          />
        ))}
        <line
          x1={cursorX}
          x2={cursorX}
          y1={PADDING_Y / 2}
          y2={HEIGHT - PADDING_Y / 2}
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth="10"
          vectorEffect="non-scaling-stroke"
        />
        <line
          data-index={safeIndex}
          data-testid="evaluation-cursor"
          x1={cursorX}
          x2={cursorX}
          y1={PADDING_Y / 2}
          y2={HEIGHT - PADDING_Y / 2}
          stroke="currentColor"
          strokeOpacity="0.65"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {markers.map(({ move, point, badge }) => (
          <div
            key={`${point.index}-${move.moveNotation}`}
            className="absolute -translate-x-1/2 -translate-y-[calc(100%+0.25rem)] text-xs font-bold"
            style={{
              left: `${(point.x / WIDTH) * 100}%`,
              top: `${(point.y / HEIGHT) * 100}%`,
            }}
          >
            <MoveClassBadge label={badge.label} color={badge.color} />
          </div>
        ))}
      </div>

      <input
        aria-label="Naviga andamento partita"
        aria-valuetext={activeLabel}
        className="absolute inset-0 z-10 m-0 h-full w-full cursor-ew-resize opacity-0"
        max={moves.length}
        min={0}
        onChange={(event) => onGoToMove(Number(event.target.value))}
        step={1}
        type="range"
        value={safeIndex}
      />
    </div>
  );
}
