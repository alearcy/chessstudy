import { useState } from "react";
import { ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { TacticalReview } from "@/lib/tacticalReview";

interface TacticalReviewPanelProps {
  review: TacticalReview;
  onSelectMoment: (moveIndex: number, tacticKey: string) => void;
}

function tacticCount(count: number): string {
  return `${count} ${count === 1 ? "tattica" : "tattiche"}`;
}

export default function TacticalReviewPanel({
  review,
  onSelectMoment,
}: TacticalReviewPanelProps) {
  const [currentIndex, setCurrentIndex] = useState(-1);

  if (review.moments.length === 0) return null;

  const handleNext = () => {
    const nextIndex = (currentIndex + 1) % review.moments.length;
    const nextMoment = review.moments[nextIndex];
    setCurrentIndex(nextIndex);
    onSelectMoment(nextMoment.moveIndex, nextMoment.tacticKey);
  };

  return (
    <section
      aria-label="Revisione tattica"
      className="space-y-3 rounded-lg border bg-card/50 p-3"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Revisione tattica
        </p>
        <span
          className="text-xs text-muted-foreground"
          aria-live="polite"
        >
          {currentIndex < 0
            ? `${review.moments.length} ${
                review.moments.length === 1 ? "momento" : "momenti"
              }`
            : `${currentIndex + 1} di ${review.moments.length}`}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md border bg-background/40 px-2.5 py-2">
          <dt className="text-muted-foreground">Da allenare</dt>
          <dd className="mt-1 font-medium text-foreground">
            {tacticCount(review.summary.training)}
          </dd>
        </div>
        <div className="rounded-md border bg-background/40 px-2.5 py-2">
          <dt className="text-muted-foreground">Cose fatte bene</dt>
          <dd className="mt-1 font-medium text-foreground">
            {tacticCount(review.summary.positives)}
          </dd>
        </div>
      </dl>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full justify-between"
        onClick={handleNext}
      >
        Prossimo momento importante
        <ChevronRight aria-hidden="true" className="size-4" />
      </Button>
    </section>
  );
}
