import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LessonFavoriteButton from "@/components/lesson/LessonFavoriteButton";

afterEach(cleanup);

describe("LessonFavoriteButton", () => {
  it("renders the accessible heart state and requests a toggle", () => {
    const onToggle = vi.fn();
    const view = render(
      <LessonFavoriteButton
        lessonTitle="Partita importata"
        isFavorite={false}
        onToggle={onToggle}
      />,
    );

    const addButton = view.getByRole("button", {
      name: "Aggiungi ai preferiti: Partita importata",
    });
    const emptyHeart = addButton.querySelector("svg");
    expect(emptyHeart?.getAttribute("fill")).toBe("none");
    expect(emptyHeart?.classList.contains("size-4")).toBe(true);

    fireEvent.click(addButton);
    expect(onToggle).toHaveBeenCalledOnce();

    view.rerender(
      <LessonFavoriteButton
        lessonTitle="Partita importata"
        isFavorite
        onToggle={onToggle}
      />,
    );

    const removeButton = view.getByRole("button", {
      name: "Rimuovi dai preferiti: Partita importata",
    });
    expect(removeButton.querySelector("svg")?.getAttribute("fill")).toBe(
      "currentColor",
    );
  });
});
