export type PlatformPlayerColor = "white" | "black" | null;

export interface PlatformGameSummary {
  id: string;
  pgn: string;
  whiteName: string;
  blackName: string;
  whiteRating: number | null;
  blackRating: number | null;
  result: string;
  userColor: PlatformPlayerColor;
  speed: string;
  timeControl: string | null;
  opening: string | null;
  createdAt: Date;
  url: string;
}
