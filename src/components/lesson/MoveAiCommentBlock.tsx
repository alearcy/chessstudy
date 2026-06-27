import AnalysisMarkdown from "@/components/lesson/AnalysisMarkdown";

interface MoveAiCommentBlockProps {
  text: string;
}

export default function MoveAiCommentBlock({ text }: MoveAiCommentBlockProps) {
  return (
    <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm leading-relaxed game-analysis-content">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-primary/70 mb-1">AI</div>
      <AnalysisMarkdown text={text} variant="move" />
    </div>
  );
}
