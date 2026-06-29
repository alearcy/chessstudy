import { parseBadgePrefix } from "@/services/analysisService";
import type { Move } from "@/types";
import { CircleCheck, Star } from "lucide-react";

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
      {parsed.rest}
    </span>
  );
}
