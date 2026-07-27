import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import ViewportSidebar from "@/components/layout/ViewportSidebar";

afterEach(cleanup);

describe("ViewportSidebar", () => {
  it("condivide il vincolo al viewport e lo scroll interno da tablet landscape", () => {
    const view = render(
      <ViewportSidebar aria-label="Mosse dello studio">
        <div>Notazione</div>
      </ViewportSidebar>,
    );

    const sidebar = view.getByRole("complementary", {
      name: "Mosse dello studio",
    });

    expect(sidebar.className).toContain(
      "tablet-landscape:h-[calc(100dvh-13rem)]",
    );
    expect(sidebar.className).toContain("tablet-landscape:overflow-hidden");
    expect(sidebar.className).toContain("xl:h-[calc(100dvh-13rem)]");
    expect(sidebar.className).toContain("min-h-0");
  });
});
