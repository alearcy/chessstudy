import { useEffect, useState } from "react";

export const PRIVATE_PORTRAIT_MEDIA_QUERY =
  "(orientation: portrait) and (max-width: 1279px)";

function portraitQueryMatches(): boolean {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(PRIVATE_PORTRAIT_MEDIA_QUERY).matches;
}

export function usePrivatePortraitGuard(): boolean {
  const [active, setActive] = useState(portraitQueryMatches);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;

    // tech-debt: docs/tech-debt/responsive-smartphone-layout.md
    // Il guard viene rimosso quando la shell avra un layout smartphone completo.
    const mediaQuery = window.matchMedia(PRIVATE_PORTRAIT_MEDIA_QUERY);
    const handleChange = (event: MediaQueryListEvent) => setActive(event.matches);

    setActive(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return active;
}
