import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import AnalysisSidebarTabs from "@/components/analysis/AnalysisSidebarTabs";

afterEach(cleanup);

describe("AnalysisSidebarTabs", () => {
  it("keeps moves as the default tab and exposes openings on demand", () => {
    const view = render(
      <AnalysisSidebarTabs
        movesContent={<div>Notazione partita</div>}
        openingsContent={<div>Apertura suggerita</div>}
      />,
    );

    expect(view.getByRole("tab", { name: "Mosse" }).getAttribute("aria-selected")).toBe("true");
    expect(view.getByText("Notazione partita")).toBeTruthy();
    expect(view.queryByText("Apertura suggerita")).toBeNull();
    expect(view.queryByLabelText("Aperture disponibili")).toBeNull();

    fireEvent.click(view.getByRole("tab", { name: "Aperture" }));

    expect(view.getByRole("tab", { name: "Aperture" }).getAttribute("aria-selected")).toBe("true");
    expect(view.getByText("Apertura suggerita")).toBeTruthy();
    expect(view.queryByText("Notazione partita")).toBeNull();
  });

  it("keeps the sidebar viewport-bound and internally scrollable after switching tabs", () => {
    const view = render(
      <AnalysisSidebarTabs
        movesContent={<div>Notazione partita</div>}
        openingsContent={<div>Apertura suggerita</div>}
      />,
    );

    fireEvent.click(view.getByRole("tab", { name: "Aperture" }));
    fireEvent.click(view.getByRole("tab", { name: "Mosse" }));

    const sidebar = view.getByRole("complementary");
    expect(sidebar.className).toContain("xl:h-[calc(100dvh-13rem)]");
    expect(sidebar.className).toContain("xl:overflow-hidden");
    expect(sidebar.className).not.toContain("xl:max-h-[520px]");
    expect(sidebar.className).not.toContain("xl:h-full");
    expect(sidebar.className).not.toContain("xl:self-stretch");
  });
});
