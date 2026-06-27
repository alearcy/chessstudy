import { useEffect } from "react";
import { isTextEditingTarget } from "@/lib/lessonDetailUtils";

interface UseMoveKeyboardNavigationParams {
  undo: () => void;
  redo: () => void;
}

export function useMoveKeyboardNavigation({
  undo,
  redo,
}: UseMoveKeyboardNavigationParams) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTextEditingTarget(event.target)) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        undo();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);
}
