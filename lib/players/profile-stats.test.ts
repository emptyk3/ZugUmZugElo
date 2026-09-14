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
  assert.deepEqual({ highest: stats.highestRating.value, wins: stats.wins, winRate: stats.winRate, placement: stats.averagePlacement, placementSigma: stats.placementStandardDeviation, points: stats.averagePoints, median: stats.medianPoints, quartiles: stats.pointQuartiles, pointsSigma: stats.pointsStandardDeviation, gain: stats.largestGain?.value, loss: stats.largestLoss?.value }, { highest: 1512, wins: 1, winRate: .5, placement: 2, placementSigma: 1, points: 100, median: 100, quartiles: { q1: 90, q3: 110 }, pointsSigma: 10, gain: 12, loss: -8 });
  assert.equal(stats.lastActivity?.toISOString(), "2026-01-02T12:00:00.000Z");
});

test("Populations-Standardabweichungen bleiben für Einzel- und Leerdaten gültig", () => {
  const single = calculateProfileStats(1500, [row("single", 1, { placement: 4, points: 73 })]);
  assert.equal(single.placementStandardDeviation, 0);
  assert.equal(single.pointsStandardDeviation, 0);
  const empty = calculateProfileStats(1500, []);
  assert.equal(empty.placementStandardDeviation, null);
  assert.equal(empty.pointsStandardDeviation, null);
  assert.doesNotMatch(JSON.stringify({ single, empty }), /NaN|Infinity/);
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
  assert.doesNotMatch(page, /GameStatus\.PENDING|GameStatus\.REJECTED/);
});

test("Profilstruktur priorisiert Elo und trennt Karrierewerte von Datumsangaben", () => {
  const page = readFileSync("app/spieler/[id]/page.tsx", "utf8");
  const css = readFileSync("app/spieler/[id]/page.module.css", "utf8");
  assert.ok(page.includes("profileFacts"));
  assert.ok(page.includes("primaryElo"));
  assert.ok(page.includes("bestätigte Partien"));
  assert.ok(css.includes(".primaryElo strong"));
  assert.ok(css.includes("font-size:clamp(38px"));
  assert.match(page, /<dd[^>]*><span>.*<\/span>\{item\.date && <small>\{item\.date\}<\/small>\}<\/dd>/);
});

test("Karriere zeigt zwölf Karten einschließlich Medianpaar in exakter Paarreihenfolge", () => {
  const page = readFileSync("app/spieler/[id]/page.tsx", "utf8");
  const css = readFileSync("app/spieler/[id]/page.module.css", "utf8");
  const careerArray = page.slice(page.indexOf("const career = ["), page.indexOf("];", page.indexOf("const career = [")));
  assert.deepEqual([...careerArray.matchAll(/label: "([^"]+)"/g)].map((match) => match[1]), [
    "Aktuelle Elo", "Höchste Elo", "Siege", "Winrate", "Ø Platzierung", "σ Platzierung", "Ø Punktzahl", "σ Punktzahl", "Median Punktzahl", "Mittlere 50 %", "Größtes Plus", "Größtes Minus",
  ]);
  assert.doesNotMatch(careerArray, /Höchste Punktzahl|Letzte Aktivität|highestScore/);
  assert.match(page, /className=\{styles\.careerHeader\}.*Letzte Aktivität:/);
  assert.match(page, /label: "σ Platzierung", value: profile\.placementStandardDeviation === null \? "Keine Daten" : `± \$\{fixedNumber\(profile\.placementStandardDeviation, 2\)\}`/);
  assert.match(page, /label: "σ Punktzahl", value: profile\.pointsStandardDeviation === null \? "Keine Daten" : `± \$\{fixedNumber\(profile\.pointsStandardDeviation, 1\)\}`/);
  assert.doesNotMatch(careerArray, /Σ Platzierung|Σ Punktzahl/);
  assert.match(page, /item\.label === "σ Platzierung" \|\| item\.label === "σ Punktzahl" \? styles\.sigmaLabel/);
  assert.match(css, /\.career dt\.sigmaLabel\{text-transform:none\}/);
  assert.match(css, /\.career dl\{display:grid;grid-template-columns:1fr 1fr/);
  assert.match(page, /profile\.pointQuartiles \? `\$\{pointsNumber\(profile\.pointQuartiles\.q1\)\}–\$\{pointsNumber\(profile\.pointQuartiles\.q3\)\}` : "—"/);
  assert.doesNotMatch(careerArray, /pointQuartiles[^\n]*Punkte/);
  assert.match(css, /grid-template-columns:minmax\(190px,\.8fr\) minmax\(460px,2fr\) minmax\(320px,1\.05fr\)/);
  assert.match(css, /\.career dd\{display:flex;align-items:baseline;flex-wrap:wrap/);
  assert.match(css, /\.career dd>small\{[^}]*font-size:9px[^}]*white-space:nowrap/);
  assert.match(css, /@media\(max-width:760px\).*\.career dl\{grid-template-columns:1fr\}/);
});

test("Elo-Diagramm und Profil verwenden den zentralen Ganzzahl-Formatter", () => {
  const page = readFileSync("app/spieler/[id]/page.tsx", "utf8");
  const chart = readFileSync("app/spieler/[id]/EloChart.tsx", "utf8");
  assert.ok(page.includes("formatElo(player.currentRating)"));
  assert.ok(page.includes("formatEloChange(row.ratingChange)"));
  assert.ok(chart.includes("tickFormatter={formatElo}"));
  assert.ok(chart.includes("allowDecimals={false}"));
  assert.ok(chart.includes("formatElo(point.ratingBefore)"));
  assert.ok(chart.includes("formatEloChange(point.ratingChange)"));
});

test("Missionsbereich enthält nur fachlich begründete Highlights und zeigt den Ohne-Mission-Anteil", () => {
  const page = readFileSync("app/spieler/[id]/page.tsx", "utf8");
  assert.equal(page.includes("Lieblingsmission"), false);
  assert.ok(page.includes('label="Beste Mission"'));
  assert.ok(page.includes('label="Schlechteste Mission"'));
  assert.ok(page.includes('<td>{percent(row.keptRate)}</td>'));
  assert.equal(page.includes("missions.rankings.keptRate"), false);
});

test("Partieverlauf lädt alle Teilnehmerdaten, sortiert sie und hebt den Profilspieler hervor", () => {
  const page = readFileSync("app/spieler/[id]/page.tsx", "utf8");
  const css = readFileSync("app/spieler/[id]/page.module.css", "utf8");
  assert.ok(page.includes('orderBy: [{ placement: "asc" }, { id: "asc" }]'));
  for (const field of ["placement: true", "points: true", "missionKept: true", "mission: { select: { name: true } }"]) assert.ok(page.includes(field));
  assert.ok(page.includes("participant.player.id === player.id ? styles.profileParticipant"));
  assert.ok(page.includes("<PlayerAliasLink playerId={participant.player.id}"));
  assert.ok(page.includes("participant.mission.name"));
  assert.ok(page.includes("Mission nicht behalten"));
  assert.equal(page.includes("mit {row.game.participants"), false);
  assert.ok(css.includes(".profileParticipant"));
  assert.ok(css.includes("border-left:4px solid var(--green)"));
});
