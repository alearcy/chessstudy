import { RotateCw, TabletSmartphone } from "lucide-react";

export default function PortraitOrientationGuard() {
  return (
    <section
      role="status"
      aria-live="polite"
      aria-labelledby="portrait-orientation-title"
      className="fixed inset-0 z-[1000] flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background p-6 text-foreground"
    >
      <div className="flex max-w-sm flex-col items-center text-center">
        <div
          className="mb-8 flex size-28 items-center justify-center rounded-3xl border bg-card shadow-sm"
          aria-hidden="true"
        >
          <div className="relative flex size-20 items-center justify-center">
            <TabletSmartphone className="cs-orientation-device size-16 text-primary motion-reduce:animate-none" />
            <RotateCw className="absolute -bottom-1 -right-1 size-7 rounded-full bg-background p-1 text-muted-foreground shadow-sm" />
          </div>
        </div>
        <h1 id="portrait-orientation-title" className="text-2xl font-semibold">
          Ruota il dispositivo
        </h1>
        <p className="mt-3 text-pretty text-sm leading-6 text-muted-foreground">
          Usa Chess Study in orizzontale per visualizzare comodamente
          scacchiera e mosse.
        </p>
      </div>
    </section>
  );
}
