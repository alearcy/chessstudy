import { parseBadgePrefix } from "@/services/analysisService";
import type { Move } from "@/types";

interface MoveCommentPreviewProps {
  currentMove: Move | null;
  historyIndex: number;
  text: string;
  stockfishLabel?: boolean;
}

export default function MoveCommentPreview({
  currentMove,
  historyIndex,
  text,
  stockfishLabel = false,
}: MoveCommentPreviewProps) {
  return (
    <div className="w-full min-h-[64px] rounded-md border border-input bg-muted/40 px-3 py-2 text-sm whitespace-pre-wrap shrink-0">
      {currentMove ? (
        text.trim() ? (
          <FormattedMoveComment text={text} />
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

function FormattedMoveComment({ text }: { text: string }) {
  const parsed = parseBadgePrefix(text);
  if (!parsed) {
    return <span className="whitespace-pre-wrap">{text}</span>;
  }

  const isEmoji = parsed.label === "⭐" || parsed.label === "✅";
  return (
    <span className="whitespace-pre-wrap">
      <span
        className={isEmoji ? "" : "inline-block px-1.5 rounded text-white font-bold mr-1 align-middle"}
        style={isEmoji ? undefined : { backgroundColor: parsed.color }}
      >
        {parsed.label}
      </span>
      {parsed.rest}
    </span>
  );
}
