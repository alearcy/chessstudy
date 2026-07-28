import { afterEach, describe, expect, it, vi } from "vitest";

import { clearMateLineTimers } from "@/lib/mateLinePreview";

afterEach(() => {
  vi.useRealTimers();
});

describe("clearMateLineTimers", () => {
  it("cancels every pending step so the mate sequence cannot restart", () => {
    vi.useFakeTimers();
    const onStep = vi.fn();
    const timers = [
      window.setTimeout(onStep, 100),
      window.setTimeout(onStep, 200),
      window.setTimeout(onStep, 300),
    ];

    clearMateLineTimers(timers);
    vi.runAllTimers();

    expect(onStep).not.toHaveBeenCalled();
    expect(timers).toEqual([]);
  });
});
