import {
  Calendar,
  Globe,
  Flag,
  ExternalLink,
  Hash,
  Clock,
  Tag,
  BookOpen,
  User,
  Link as LinkIcon,
  type LucideIcon,
} from "lucide-react";

interface PgnHeadersSidebarProps {
  headers: Record<string, string | null>;
}

interface HeaderMeta {
  label: string;
  icon: LucideIcon;
  /** Se true, il valore è un URL cliccabile. */
  asLink?: boolean;
}

/** Mappatura header PGN → metadati display. */
const HEADER_META: Record<string, HeaderMeta> = {
  Event: { label: "Evento", icon: Tag },
  Site: { label: "Sito", icon: Globe, asLink: true },
  Date: { label: "Data", icon: Calendar },
  Round: { label: "Turno", icon: Hash },
  Termination: { label: "Terminazione", icon: Flag },
  Link: { label: "Link", icon: ExternalLink, asLink: true },
  TimeControl: { label: "Tempo", icon: Clock },
  Variant: { label: "Variante", icon: Tag },
  Annotator: { label: "Annotatore", icon: User },
  ECO: { label: "ECO", icon: BookOpen },
  SourceDate: { label: "Data fonte", icon: Calendar },
};

/** Header già mostrati nel titolo (nomi + risultato) — saltati nella sidebar. */
const SKIP_HEADERS = new Set([
  "White",
  "Black",
  "WhiteElo",
  "BlackElo",
  "Result",
  "SetUp",
  "FEN",
]);

function clean(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  if (!t || t === "?") return null;
  return t;
}

function isUrl(v: string): boolean {
  return /^https?:\/\//i.test(v);
}

export default function PgnHeadersSidebar({ headers }: PgnHeadersSidebarProps) {
  const entries = Object.entries(headers)
    .filter(([key, value]) => !SKIP_HEADERS.has(key) && clean(value))
    .map(([key, value]) => {
      const meta = HEADER_META[key];
      const raw = clean(value)!;
      return {
        key,
        label: meta?.label ?? key,
        icon: meta?.icon ?? LinkIcon,
        asLink: meta?.asLink ?? isUrl(raw),
        value: raw,
      };
    });

  return (
    <aside className="w-full">
      <h2 className="text-sm font-semibold mb-2">Dettagli partita</h2>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nessun dato di testata disponibile.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map(({ key, label, icon: Icon, asLink, value }) => (
            <li
              key={key}
              className="flex items-start gap-2 rounded-md bg-muted/40 px-2.5 py-2"
            >
              <Icon className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                  {label}
                </div>
                {asLink && isUrl(value) ? (
                  <a
                    href={value}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline break-all"
                  >
                    {value}
                  </a>
                ) : (
                  <div className="text-xs text-foreground break-words">
                    {value}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
