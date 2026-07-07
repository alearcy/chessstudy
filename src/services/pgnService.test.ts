import { describe, expect, it } from "vitest";

import { parsePgn } from "@/services/pgnService";

describe("parsePgn", () => {
  it("parses headers, moves, comments and starts from the initial position", () => {
    const parsed = parsePgn(`
[White "Bianco"]
[Black "Nero"]
[Result "1-0"]

1. e4 {Occupa il centro} e5 2. Nf3 Nc6 1-0
`);

    expect(parsed.title).toBe("Bianco vs Nero 1-0");
    expect(parsed.whiteName).toBe("Bianco");
    expect(parsed.blackName).toBe("Nero");
    expect(parsed.moves).toHaveLength(4);
    expect(parsed.moves[0]).toMatchObject({
      san: "e4",
      comment: "Occupa il centro",
    });
  });
});
