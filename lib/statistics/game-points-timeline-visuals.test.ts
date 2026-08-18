import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { addCompressedTimelinePositions, compressTimelineGap, timelineSeriesStyles } from "./game-points-timeline-visuals.ts";

const chart = readFileSync(new URL("../../app/statistik/GamePointsTimelineChart.tsx", import.meta.url), "utf8");

const hue = (color: string) => color.match(/^hsl\((\d+)/)?.[1];

test("zusammengehörende Ist- und Durchschnittslinien verwenden denselben Grundfarbton", () => {
  assert.equal(hue(timelineSeriesStyles.winnerPoints.stroke), hue(timelineSeriesStyles.cumulativeWinnerAverage.stroke));
  assert.equal(hue(timelineSeriesStyles.gameAveragePoints.stroke), hue(timelineSeriesStyles.cumulativePlayerAverage.stroke));
  assert.ok(timelineSeriesStyles.cumulativeWinnerAverage.strokeWidth > timelineSeriesStyles.winnerPoints.strokeWidth);
  assert.ok(timelineSeriesStyles.cumulativePlayerAverage.strokeWidth > timelineSeriesStyles.gameAveragePoints.strokeWidth);
});

test("Zeitabstände werden logarithmisch komprimiert und besitzen einen Mindest- und Maximalabstand", () => {
  const hour = compressTimelineGap(60 * 60 * 1000);
  const week = compressTimelineGap(7 * 24 * 60 * 60 * 1000);
  const threeWeeks = compressTimelineGap(21 * 24 * 60 * 60 * 1000);
  const year = compressTimelineGap(365 * 24 * 60 * 60 * 1000);
  assert.ok(hour >= 1);
  assert.ok(week > hour);
  assert.ok(threeWeeks > week);
  assert.ok(threeWeeks - week < week - hour);
  assert.equal(year, 8);
});

test("komprimierte Positionen behalten Reihenfolge und echte Zeitstempel für Beschriftung und Tooltip", () => {
  const entries = [
    { gameId: "first", playedAt: "2026-05-18T10:00:00.000Z" },
    { gameId: "second", playedAt: "2026-05-18T10:05:00.000Z" },
    { gameId: "third", playedAt: "2026-08-18T10:05:00.000Z" },
  ];
  const result = addCompressedTimelinePositions(entries);
  assert.deepEqual(result.map((point) => point.gameId), ["first", "second", "third"]);
  assert.ok(result[0].visualPosition < result[1].visualPosition && result[1].visualPosition < result[2].visualPosition);
  assert.deepEqual(result.map((point) => point.timestamp), entries.map((entry) => new Date(entry.playedAt).getTime()));
});

test("Diagramm verwendet die komprimierte Position, beschriftet sie aber mit dem echten Datum", () => {
  assert.match(chart, /dataKey="visualPosition"/);
  assert.doesNotMatch(chart, /dataKey="timestamp"[^>]*scale="time"/);
  assert.match(chart, /shortDate\(timestampsByPosition\.get\(position\)/);
  assert.match(chart, /fullDate\(point\.timestamp\)/);
});
