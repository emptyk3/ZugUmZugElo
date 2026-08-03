import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { calculateProfileStats, type ProfileParticipation } from "./profile-stats.ts";

const row = (id: string, day: number, values: Partial<ProfileParticipation> = {}): ProfileParticipation => ({
  id, placement: 2, points: 80, ratingBefore: 1500, ratingChange: 5, ratingAfter: 1505,
  game: { id: `g-${id}`, playedAt: new Date(`2026-01-${String(day).padStart(2, "0")}T12:00:00Z`), createdAt: new Date(`2026-01-${String(day).padStart(2, "0")}T13:00:00Z`) }, ...values,
});

test("Karrierekennzahlen verwenden gespeicherte bestätigte Werte", () => {
  const stats = calculateProfileStats(1500, [row("a", 1, { placement: 1, points: 110, ratingChange: 12, ratingAfter: 1512 }), row("b", 2, { placement: 3, points: 90, ratingBefore: 1512, ratingChange: -8, ratingAfter: 1504 })]);
  assert.deepEqual({ highest: stats.highestRating.value, score: stats.highestScore?.value, wins: stats.wins, winRate: stats.winRate, placement: stats.averagePlacement, points: stats.averagePoints, gain: stats.largestGain?.value, loss: stats.largestLoss?.value }, { highest: 1512, score: 110, wins: 1, winRate: .5, placement: 2, points: 100, gain: 12, loss: -8 });
  assert.equal(stats.lastActivity?.toISOString(), "2026-01-02T12:00:00.000Z");
});

test("Elo-Verlauf ist stabil nach playedAt, createdAt und id sortiert", () => {
  const playedAt = new Date("2026-02-01T12:00:00Z");
  const createdAt = new Date("2026-02-02T12:00:00Z");
  const rows = [row("z", 3), row("b", 3), row("a", 3)].map((item) => ({ ...item, game: { ...item.game, playedAt, createdAt, id: item.id } }));
  assert.deepEqual(calculateProfileStats(1500, rows).timeline.map((item) => item.gameId), [null, "a", "b", "z"]);
});

test("Öffentliche Profilabfrage enthält keine privaten User-Felder und Verlauf ist auf fünf begrenzt", () => {
  const page = readFileSync("app/spieler/[id]/page.tsx", "utf8");
  for (const field of ["email: true", "firstName: true", "lastName: true", "passwordHash: true", "adminNote: true"]) assert.equal(page.includes(field), false);
  assert.match(page, /reverse\(\)\.slice\(0, 5\)/);
  assert.match(page, /status: GameStatus\.CONFIRMED, deletedAt: null/);
});
