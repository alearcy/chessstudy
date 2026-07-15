import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import OpeningStudyDialog from "@/components/analysis/OpeningStudyDialog";
import type { OpeningReference } from "@/types";

const {
  addOpeningToStudyMock,
  createOpeningStudyMock,
  getOpeningStudyDestinationsMock,
} = vi.hoisted(() => ({
  addOpeningToStudyMock: vi.fn(),
  createOpeningStudyMock: vi.fn(),
  getOpeningStudyDestinationsMock: vi.fn(),
}));

vi.mock("@/services/openingStudyService", () => ({
  OpeningDestinationConflict: class OpeningDestinationConflict extends Error {},
  addOpeningToStudy: addOpeningToStudyMock,
  createOpeningStudy: createOpeningStudyMock,
  getOpeningStudyDestinations: getOpeningStudyDestinationsMock,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const dragon: OpeningReference = {
  eco: "B70",
  name: "Sicilian Defense: Dragon Variation",
  family: "Sicilian Defense",
  pgn: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6",
};

describe("OpeningStudyDialog", () => {
  it("adds a variant board to a selected related study without renaming it", async () => {
    getOpeningStudyDestinationsMock.mockResolvedValue([
      { lessonId: 7, title: "Siciliana", related: true },
      { lessonId: 9, title: "Repertorio misto", related: false },
    ]);
    addOpeningToStudyMock.mockResolvedValue({ lessonId: 7, boardId: 11 });
    const onCreated = vi.fn();

    const view = render(
      <OpeningStudyDialog
        opening={dragon}
        open
        onOpenChange={vi.fn()}
        onCreated={onCreated}
      />,
    );

    await waitFor(() => {
      expect(getOpeningStudyDestinationsMock).toHaveBeenCalledWith(dragon);
    });
    fireEvent.click(view.getByRole("radio", {
      name: "Aggiungi a uno studio esistente",
    }));
    await waitFor(() => {
      expect(view.getByText("Siciliana")).toBeTruthy();
    });
    fireEvent.click(view.getByRole("radio", {
      name: "Siciliana Stessa famiglia",
    }));
    fireEvent.click(view.getByRole("button", { name: "Aggiungi allo studio" }));

    await waitFor(() => {
      expect(addOpeningToStudyMock).toHaveBeenCalledWith(dragon, {
        lessonId: 7,
        boardTitle: dragon.name,
        conflict: "error",
      });
      expect(onCreated).toHaveBeenCalledWith(7, 11);
    });
    expect(createOpeningStudyMock).not.toHaveBeenCalled();
  });
});
