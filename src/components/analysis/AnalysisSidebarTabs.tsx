import { useId, useState, type ReactNode } from "react";
import { BookOpen, ListOrdered } from "lucide-react";

interface AnalysisSidebarTabsProps {
  openingAvailable: boolean;
  movesContent: ReactNode;
  openingsContent: ReactNode;
}

type AnalysisSidebarTab = "moves" | "openings";

export default function AnalysisSidebarTabs({
  openingAvailable,
  movesContent,
  openingsContent,
}: AnalysisSidebarTabsProps) {
  const [activeTab, setActiveTab] = useState<AnalysisSidebarTab>("moves");
  const tabsId = useId();
  const movesTabId = `${tabsId}-moves-tab`;
  const openingsTabId = `${tabsId}-openings-tab`;
  const panelId = `${tabsId}-panel`;

  return (
    <aside className="flex min-h-0 min-w-0 flex-col gap-3 xl:h-full">
      <div
        role="tablist"
        aria-label="Contenuti dell'analisi"
        className="grid shrink-0 grid-cols-2 gap-1 rounded-lg bg-muted p-1"
      >
        <button
          id={movesTabId}
          type="button"
          role="tab"
          aria-selected={activeTab === "moves"}
          aria-controls={panelId}
          aria-label="Mosse"
          className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === "moves"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("moves")}
        >
          <ListOrdered className="size-4" aria-hidden="true" />
          Mosse
        </button>
        <button
          id={openingsTabId}
          type="button"
          role="tab"
          aria-selected={activeTab === "openings"}
          aria-controls={panelId}
          aria-label="Aperture"
          className={`relative flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === "openings"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("openings")}
        >
          <BookOpen className="size-4" aria-hidden="true" />
          Aperture
          {openingAvailable ? (
            <span
              role="status"
              aria-label="Aperture disponibili"
              className="absolute right-2 top-1.5 size-1.5 rounded-full bg-primary"
            />
          ) : null}
        </button>
      </div>

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={activeTab === "moves" ? movesTabId : openingsTabId}
        className={
          activeTab === "moves"
            ? "flex min-h-0 flex-1 flex-col gap-3"
            : "min-h-0 flex-1 overflow-y-auto pr-1"
        }
      >
        {activeTab === "moves" ? movesContent : openingsContent}
      </div>
    </aside>
  );
}
