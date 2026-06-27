import ReactMarkdown from "react-markdown";
import { cleanGameAnalysisText } from "@/lib/lessonDetailUtils";

interface AnalysisMarkdownProps {
  text: string;
  variant?: "summary" | "move";
}

export default function AnalysisMarkdown({
  text,
  variant = "summary",
}: AnalysisMarkdownProps) {
  const cleaned = cleanGameAnalysisText(text);
  const paragraphClass = variant === "move" ? "mb-1 last:mb-0" : "mb-2 last:mb-0";

  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p className={paragraphClass}>{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        ul: ({ children }) => <ul className="list-disc pl-4 my-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-4 my-1">{children}</ol>,
        li: ({ children }) => <li className="mb-0.5">{children}</li>,
        em: ({ children }) => <em>{children}</em>,
      }}
    >
      {cleaned}
    </ReactMarkdown>
  );
}
