import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import AnalysisPlayerLabel from "@/components/analysis/AnalysisPlayerLabel";

afterEach(cleanup);

const players = {
  whiteName: "Garry Kasparov",
  blackName: "Veselin Topalov",
  whiteElo: "2812",
  blackElo: "2700",
};

describe("AnalysisPlayerLabel", () => {
  it("mostra il Nero sopra e il Bianco sotto con orientamento Bianco", () => {
    const view = render(
      <>
        <AnalysisPlayerLabel {...players} orientation="white" position="top" />
        <AnalysisPlayerLabel {...players} orientation="white" position="bottom" />
      </>,
    );

    const top = view.getByTestId("analysis-player-top");
    const bottom = view.getByTestId("analysis-player-bottom");

    expect(top.textContent).toBe("Veselin Topalov(2700)");
    expect(bottom.textContent).toBe("Garry Kasparov(2812)");
    expect(view.queryByText(/Elo/)).toBeNull();
  });

  it("scambia i giocatori quando la scacchiera e orientata sul Nero", () => {
    const view = render(
      <>
        <AnalysisPlayerLabel {...players} orientation="black" position="top" />
        <AnalysisPlayerLabel {...players} orientation="black" position="bottom" />
      </>,
    );

    expect(view.getByTestId("analysis-player-top").textContent).toContain(
      "Garry Kasparov",
    );
    expect(view.getByTestId("analysis-player-bottom").textContent).toContain(
      "Veselin Topalov",
    );
  });

  it("mostra la precisione accanto al giocatore corretto e la scambia ruotando", () => {
    const view = render(
      <>
        <AnalysisPlayerLabel
          {...players}
          orientation="black"
          position="top"
          whiteAccuracy={93}
          blackAccuracy={87}
        />
        <AnalysisPlayerLabel
          {...players}
          orientation="black"
          position="bottom"
          whiteAccuracy={93}
          blackAccuracy={87}
        />
      </>,
    );

    expect(view.getByTestId("analysis-player-top").textContent).toBe(
      "Garry Kasparov(2812)Precisione 93%",
    );
    expect(view.getByTestId("analysis-player-bottom").textContent).toBe(
      "Veselin Topalov(2700)Precisione 87%",
    );
  });

  it("omette valori assenti senza mostrare placeholder", () => {
    const view = render(
      <AnalysisPlayerLabel
        orientation="white"
        position="top"
        whiteName={null}
        blackName=" ? "
        whiteElo={null}
        blackElo=""
      />,
    );

    expect(view.queryByTestId("analysis-player-top")).toBeNull();
    expect(view.queryByText("?")).toBeNull();
  });

  it("mostra nome ed ELO in modo indipendente", () => {
    const view = render(
      <>
        <AnalysisPlayerLabel
          orientation="white"
          position="top"
          blackName="Solo nome"
          blackElo={null}
        />
        <AnalysisPlayerLabel
          orientation="white"
          position="bottom"
          whiteName={null}
          whiteElo="2450"
        />
      </>,
    );

    expect(view.getByTestId("analysis-player-top").textContent).toBe("Solo nome");
    expect(view.getByTestId("analysis-player-bottom").textContent).toBe("(2450)");
  });

  it("non mostra un placeholder di precisione quando il calcolo non e disponibile", () => {
    const view = render(
      <AnalysisPlayerLabel
        {...players}
        orientation="white"
        position="bottom"
        whiteAccuracy={null}
        blackAccuracy={null}
      />,
    );

    expect(view.queryByText(/Precisione/)).toBeNull();
  });
});
