import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import AnalysisSidebarTabs from "@/components/analysis/AnalysisSidebarTabs";

afterEach(cleanup);

describe("AnalysisSidebarTabs", () => {
  it("keeps moves as the default tab and exposes openings on demand", () => {
    const view = render(
      <AnalysisSidebarTabs
        openingAvailable
        movesContent={<div>Notazione partita</div>}
        openingsContent={<div>Apertura suggerita</div>}
      />,
    );

    expect(view.getByRole("tab", { name: "Mosse" }).getAttribute("aria-selected")).toBe("true");
    expect(view.getByText("Notazione partita")).toBeTruthy();
    expect(view.queryByText("Apertura suggerita")).toBeNull();
    expect(view.getByLabelText("Aperture disponibili")).toBeTruthy();

    fireEvent.click(view.getByRole("tab", { name: "Aperture" }));

    expect(view.getByRole("tab", { name: "Aperture" }).getAttribute("aria-selected")).toBe("true");
    expect(view.getByText("Apertura suggerita")).toBeTruthy();
    expect(view.queryByText("Notazione partita")).toBeNull();
  });
});
