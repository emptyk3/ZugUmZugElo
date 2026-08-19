import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculateRankingRating, compareRankingPlayers } from "./ranking-rating.ts";

const now = new Date("2026-08-19T12:00:00.000Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

test("Inaktivitätsmalus greift exakt ab dem 31. vollen 24-Stunden-Tag", () => {
  for (const days of [0, 1, 29, 30]) {
    assert.deepEqual(calculateRankingRating(1550, daysAgo(days), now), { currentRating: 1550, rankingRating: 1550, inactiveDays: days, inactivityPenalty: 0 });
  }
  for (const days of [31, 32, 45, 90]) {
    assert.deepEqual(calculateRankingRating(1550, daysAgo(days), now), { currentRating: 1550, rankingRating: 1550 - days, inactiveDays: days, inactivityPenalty: days });
  }
});

test("nur volle 24-Stunden-Zeiträume zählen und Spieler ohne Partie erhalten keinen Malus", () => {
  assert.equal(calculateRankingRating(1500, new Date(daysAgo(31).getTime() + 1), now).inactiveDays, 30);
  assert.deepEqual(calculateRankingRating(1500, null, now), { currentRating: 1500, rankingRating: 1500, inactiveDays: null, inactivityPenalty: 0 });
});

test("Rangliste sortiert nach temporärer Ranglisten-Elo, ohne echte Elo zu verändern", () => {
  const playerA = { id: "a", alias: "A", confirmedGames: 10, ...calculateRankingRating(1550, daysAgo(45), now) };
  const playerB = { id: "b", alias: "B", confirmedGames: 5, ...calculateRankingRating(1520, daysAgo(0), now) };
  const currentBefore = playerA.currentRating;
  assert.deepEqual([playerA, playerB].sort(compareRankingPlayers).map((player) => player.id), ["b", "a"]);
  assert.equal(playerA.rankingRating, 1505);
  assert.equal(playerA.currentRating, currentBefore);
});

test("Tiebreak verwendet echte Elo, Partien, Alias und ID in stabiler Reihenfolge", () => {
  const base = { rankingRating: 1500, inactivityPenalty: 0, inactiveDays: 0 };
  const players = [
    { ...base, id: "z", alias: "Alex", currentRating: 1500, confirmedGames: 4 },
    { ...base, id: "b", alias: "Berta", currentRating: 1510, confirmedGames: 2 },
    { ...base, id: "a", alias: "Alex", currentRating: 1500, confirmedGames: 4 },
    { ...base, id: "c", alias: "Clara", currentRating: 1500, confirmedGames: 5 },
  ];
  assert.deepEqual(players.sort(compareRankingPlayers).map((player) => player.id), ["b", "c", "a", "z"]);
});

test("Ranglistenabfrage berücksichtigt nur letzte bestätigte, nicht gelöschte playedAt-Aktivität ohne N+1", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  assert.match(page, /where: \{ game: \{ status: GameStatus\.CONFIRMED, deletedAt: null \} \}/);
  assert.match(page, /orderBy: \[\{ game: \{ playedAt: "desc" \} \}/);
  assert.match(page, /take: 1/);
  assert.match(page, /playedAt: true/);
  assert.equal((page.match(/prisma\.player\.findMany/g) ?? []).length, 1);
  assert.doesNotMatch(page, /player\.(update|updateMany)|\$transaction/);
});

test("UI erklärt nur angewandten Malus und andere Bereiche verwenden weiterhin currentRating", () => {
  const leaderboard = readFileSync("app/page.tsx", "utf8");
  assert.match(leaderboard, /player\.inactivityPenalty > 0/);
  assert.match(leaderboard, /Echte Elo:/);
  assert.match(leaderboard, /player\.rankingRating/);
  const profile = readFileSync("app/spieler/[id]/page.tsx", "utf8");
  const statisticsPage = readFileSync("app/statistik/page.tsx", "utf8");
  const statistics = readFileSync("lib/statistics/player-statistics.ts", "utf8");
  const gameEntry = readFileSync("app/partie-eintragen/actions.ts", "utf8");
  assert.match(profile, /formatElo\(player\.currentRating\)/);
  assert.match(statisticsPage, /currentRating: player\.currentRating/);
  assert.match(statistics, /b\.currentRating - a\.currentRating/);
  assert.match(gameEntry, /player\.currentRating/);
  for (const source of [profile, statisticsPage, statistics, gameEntry]) assert.doesNotMatch(source, /rankingRating|inactivityPenalty/);
});
