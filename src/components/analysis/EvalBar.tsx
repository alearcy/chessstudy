interface EvalBarProps {
  cp: number | null;
  mate: number | null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function whiteShare(cp: number | null, mate: number | null) {
  if (mate !== null) return mate > 0 ? 100 : 0;
  if (cp === null) return 50;
  return clamp(50 + clamp(cp, -600, 600) / 12, 0, 100);
}

function evalLabel(cp: number | null, mate: number | null) {
  if (mate !== null) return mate > 0 ? "Bianco decisivo" : "Nero decisivo";
  if (cp === null || Math.abs(cp) < 40) return "Equilibrio";
  if (cp > 0) return cp >= 180 ? "Bianco meglio" : "Bianco comodo";
  return cp <= -180 ? "Nero meglio" : "Nero comodo";
}

export default function EvalBar({ cp, mate }: EvalBarProps) {
  const white = whiteShare(cp, mate);
  const black = 100 - white;
  const label = evalLabel(cp, mate);

  return (
    <div
      className="flex h-full min-h-[18rem] w-8 shrink-0 flex-col items-center"
      aria-label={`Valutazione posizione: ${label}`}
      title={label}
    >
      <div className="relative h-full min-h-[16rem] w-5 overflow-hidden rounded border border-border bg-background shadow-sm">
        <div
          className="absolute left-0 top-0 w-full bg-neutral-950 transition-[height] duration-500 ease-out"
          style={{ height: `${black}%` }}
        />
        <div
          className="absolute bottom-0 left-0 w-full bg-neutral-100 transition-[height] duration-500 ease-out"
          style={{ height: `${white}%` }}
        />
        <div className="absolute left-0 right-0 top-1/2 h-px bg-border/80" />
      </div>
    </div>
  );
}
