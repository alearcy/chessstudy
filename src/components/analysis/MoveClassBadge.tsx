import { CircleCheck, Star } from "lucide-react";

const BADGE_TITLES: Record<string, string> = {
  "!!": "Migliore",
  "!": "Buona",
  "?!": "Imprecisa",
  "?": "Errore",
  "??": "Errore grave",
};

interface MoveClassBadgeProps {
  label: string;
  color: string;
  title?: string;
}

export default function MoveClassBadge({
  label,
  color,
  title = BADGE_TITLES[label] ?? `Valutazione: ${label}`,
}: MoveClassBadgeProps) {
  if (label === "!!") {
    return (
      <span title={title}>
        <Star className="size-3.5 fill-blue-500 text-blue-500" />
      </span>
    );
  }
  if (label === "!") {
    return (
      <span title={title}>
        <CircleCheck className="size-3.5 text-green-500" />
      </span>
    );
  }

  return (
    <span
      className="rounded px-1 text-white"
      style={{ backgroundColor: color, color: "white" }}
      title={title}
    >
      {label}
    </span>
  );
}
