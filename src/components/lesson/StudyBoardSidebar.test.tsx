import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import StudyBoardSidebar from "@/components/lesson/StudyBoardSidebar";
import type { Board } from "@/types";

function board(id: number, title: string, order: number): Board {
  return {
    id,
    lessonId: 3,
    title,
    fen: "start",
    notes: "",
    arrows: [],
    highlights: [],
    order,
    createdAt: new Date(),
  };
}

const boards = [
  board(7, "Attacco sul re", 0),
  board(8, "Finale di torre", 1),
  board(9, "Struttura Carlsbad", 2),
];

afterEach(cleanup);

function renderSidebar(
  duplicatingBoardId: number | null = null,
  reorderingBoards = false,
) {
  const onSelectBoard = vi.fn();
  const onDuplicateBoard = vi.fn();
  const onReorderBoards = vi.fn();
  const view = render(
    <StudyBoardSidebar
      boards={boards}
      selectedBoardId={7}
      duplicatingBoardId={duplicatingBoardId}
      reorderingBoards={reorderingBoards}
      onSelectBoard={onSelectBoard}
      onImportPgn={vi.fn()}
      onCreateBoard={vi.fn()}
      onEditBoard={vi.fn()}
      onDuplicateBoard={onDuplicateBoard}
      onReorderBoards={onReorderBoards}
      onDeleteBoard={vi.fn()}
    />,
  );

  return { ...view, onDuplicateBoard, onReorderBoards, onSelectBoard };
}

describe("StudyBoardSidebar duplicate action", () => {
  it("keeps board selection as a separate native button", () => {
    const view = renderSidebar();

    fireEvent.click(
      view.getByRole("button", { name: "Attacco sul re" }),
    );

    expect(view.onSelectBoard).toHaveBeenCalledWith(7);
  });

  it("duplicates from an explicit accessible action without selecting the row", () => {
    const view = renderSidebar();

    fireEvent.click(
      view.getAllByRole("button", { name: "Duplica scacchiera" })[0],
    );

    expect(view.onDuplicateBoard).toHaveBeenCalledWith(7);
    expect(view.onSelectBoard).not.toHaveBeenCalled();
  });

  it("disables the action while that board is being duplicated", () => {
    const view = renderSidebar(7);

    const duplicateButton = view.getAllByRole("button", {
      name: "Duplica scacchiera",
    })[0] as HTMLButtonElement;
    expect(duplicateButton.disabled).toBe(true);
  });
});

function mockVerticalRows() {
  return vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function getBoundingClientRect(this: HTMLElement) {
      const parent = this.parentElement;
      const index = parent ? Array.from(parent.children).indexOf(this) : 0;
      const top = index * 40;
      return {
        x: 0,
        y: top,
        top,
        left: 0,
        right: 240,
        bottom: top + 40,
        width: 240,
        height: 40,
        toJSON: () => ({}),
      };
    });
}

describe("StudyBoardSidebar reorder", () => {
  it.each(["mouse", "touch"])(
    "reorders boards by %s pointer drag from the dedicated handle",
    (pointerType) => {
      const rectSpy = mockVerticalRows();
      const view = renderSidebar();
      const handle = view.getByRole("button", {
        name: "Riordina Attacco sul re",
      });

      fireEvent.pointerDown(handle, {
        pointerId: 1,
        pointerType,
        button: 0,
        clientY: 10,
      });
      fireEvent.pointerMove(handle, {
        pointerId: 1,
        pointerType,
        clientY: 110,
      });
      fireEvent.pointerUp(handle, {
        pointerId: 1,
        pointerType,
        clientY: 110,
      });

      expect(view.onReorderBoards).toHaveBeenCalledWith([8, 9, 7]);
      expect(view.onSelectBoard).not.toHaveBeenCalled();
      rectSpy.mockRestore();
    },
  );

  it("moves the focused board with ArrowUp and ArrowDown", () => {
    const view = renderSidebar();
    const handle = view.getByRole("button", {
      name: "Riordina Finale di torre",
    });

    fireEvent.keyDown(handle, { key: "ArrowUp" });
    fireEvent.keyDown(handle, { key: "ArrowDown" });

    expect(view.onReorderBoards).toHaveBeenNthCalledWith(1, [8, 7, 9]);
    expect(view.onReorderBoards).toHaveBeenNthCalledWith(2, [7, 9, 8]);
  });

  it("disables every reorder handle while persistence is pending", () => {
    const view = renderSidebar(null, true);

    for (const handle of view.getAllByRole("button", {
      name: /^Riordina /,
    })) {
      expect(handle).toHaveProperty("disabled", true);
    }
  });
});
