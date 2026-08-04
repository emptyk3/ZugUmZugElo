export type StatisticsPlayer = {
  id: string;
  alias: string;
  imageUrl: string | null;
  currentRating: number;
};

export type StatisticsParticipation = {
  id: string;
  playerId: string;
  alias: string;
  imageUrl: string | null;
  points: number;
  placement: number;
  ratingBefore: number;
  ratingChange: number;
  ratingAfter: number;
  missionId: string;
  missionKept: boolean;
};

export type StatisticsGame = {
  id: string;
  playedAt: Date;
  createdAt: Date;
  participants: StatisticsParticipation[];
};

export type MissionCatalogItem = { id: string; name: string; sortOrder: number };

export const compareGames = (a: Pick<StatisticsGame, "id" | "playedAt" | "createdAt">, b: Pick<StatisticsGame, "id" | "playedAt" | "createdAt">) =>
  a.playedAt.getTime() - b.playedAt.getTime() ||
  a.createdAt.getTime() - b.createdAt.getTime() ||
  a.id.localeCompare(b.id);

export const equalNumber = (a: number, b: number) => Object.is(a, b) || Math.abs(a - b) < 1e-12;

