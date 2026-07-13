import { Heart } from "lucide-react";

import { Button } from "@/components/ui/button";

interface LessonFavoriteButtonProps {
  lessonTitle: string;
  isFavorite: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export default function LessonFavoriteButton({
  lessonTitle,
  isFavorite,
  onToggle,
  disabled = false,
}: LessonFavoriteButtonProps) {
  const action = isFavorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti";
  const label = `${action}: ${lessonTitle}`;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={isFavorite}
      className={isFavorite ? "text-rose-500 hover:text-rose-500" : undefined}
    >
      <Heart
        className="size-4"
        fill={isFavorite ? "currentColor" : "none"}
      />
    </Button>
  );
}
