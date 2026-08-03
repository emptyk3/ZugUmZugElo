import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { calculateMultiplayerElo, ELO_K_FACTOR, type EloParticipant } from "./index.ts";

function player(id: string, points: number, rating = 1500, tiebreakRank?: number): EloParticipant {
  return { id, points, rating, tiebreakRank };
}

function changesFor(participants: EloParticipant[]) {
  return calculateMultiplayerElo(participants).map(({ ratingChange }) => ratingChange);
}

describe("calculateMultiplayerElo", () => {
  test("berechnet vier gleich starke Spieler als sechs paarweise Duelle", () => {
    const results = calculateMultiplayerElo([
      player("A", 120), player("B", 100), player("C", 80), player("D", 60),
    ]);
    assert.equal(ELO_K_FACTOR, 20);
    assert.deepEqual(results.map(({ placement }) => placement), [1, 2, 3, 4]);
    assert.deepEqual(results.map(({ ratingChange }) => ratingChange), [30, 10, -10, -30]);
    assert.equal(results.reduce((sum, result) => sum + result.ratingChange, 0), 0);
  });

  test("berechnet fünf gleich starke Spieler als zehn paarweise Duelle", () => {
    const results = calculateMultiplayerElo([
      player("A", 140), player("B", 120), player("C", 100), player("D", 80), player("E", 60),
    ]);
    assert.deepEqual(results.map(({ ratingChange }) => ratingChange), [40, 20, 0, -20, -40]);
    assert.equal(results.reduce((sum, result) => sum + result.ratingChange, 0), 0);
  });

  test("verwendet bei unterschiedlichen Elo-Werten für jedes Duell die Ausgangswerte", () => {
    const participants = [
      player("A", 120, 1800), player("B", 100, 1600),
      player("C", 80, 1400), player("D", 60, 1200),
    ];
    const results = calculateMultiplayerElo(participants);
    const expectedWinnerChange = participants.slice(1).reduce(
      (sum, opponent) => sum + 20 * (1 - 1 / (1 + 10 ** ((opponent.rating - 1800) / 400))), 0,
    );
    assert.ok(Math.abs(results[0].ratingChange - expectedWinnerChange) < 1e-12);
    assert.equal(results.reduce((sum, result) => sum + result.ratingChange, 0), 0);
  });

  test("belohnt einen erfolgreichen Anfänger gegen Fortgeschrittene deutlich", () => {
    const results = calculateMultiplayerElo([
      player("Anfänger", 130, 1000), player("Profi 1", 110, 1600),
      player("Profi 2", 90, 1600), player("Profi 3", 70, 1600),
    ]);
    assert.ok(results[0].ratingChange > 58);
    assert.ok(results[0].ratingChange > Math.max(...results.slice(1).map(({ ratingChange }) => ratingChange)));
    assert.ok(results.at(-1)!.ratingChange < 0);
    assert.equal(results.reduce((sum, result) => sum + result.ratingChange, 0), 0);
  });

  test("entscheidet Punktegleichstände über die Tiebreak-Reihenfolge", () => {
    const results = calculateMultiplayerElo([
      player("A", 100, 1500, 2), player("B", 100, 1500, 1),
      player("C", 80), player("D", 60),
    ]);
    assert.deepEqual(results.map(({ id }) => id), ["B", "A", "C", "D"]);
    assert.deepEqual(results.map(({ placement }) => placement), [1, 2, 3, 4]);
  });

  test("sortiert auch negative Punktzahlen korrekt", () => {
    const results = calculateMultiplayerElo([
      player("A", -20), player("B", -5), player("C", -100), player("D", -40),
    ]);
    assert.deepEqual(results.map(({ id }) => id), ["B", "A", "D", "C"]);
    assert.deepEqual(results.map(({ ratingChange }) => ratingChange), [30, 10, -10, -30]);
  });

  test("lehnt Dezimalpunkte mit einer klaren Fehlermeldung ab", () => {
    assert.throws(
      () => changesFor([
        player("A", 82.5), player("B", 70), player("C", 60), player("D", 50),
      ]),
      /muss eine ganze Zahl sein; negative ganze Zahlen sind erlaubt/,
    );
  });

  test("akzeptiert negative ganze Punktzahlen", () => {
    assert.doesNotThrow(() => changesFor([
      player("A", -1), player("B", -2), player("C", -3), player("D", -4),
    ]));
  });

  test("normalisiert führende und nachgestellte Leerzeichen in Spieler-IDs", () => {
    const results = calculateMultiplayerElo([
      player("  spieler-1  ", 100), player("spieler-2 ", 90),
      player(" spieler-3", 80), player("spieler-4", 70),
    ]);

    assert.deepEqual(results.map(({ id }) => id), [
      "spieler-1", "spieler-2", "spieler-3", "spieler-4",
    ]);
  });

  test("lehnt doppelte normalisierte Spieler-IDs ab", () => {
    assert.throws(
      () => changesFor([
        player("spieler-1", 100), player(" spieler-1 ", 90),
        player("spieler-2", 80), player("spieler-3", 70),
      ]),
      /Spieler-ID spieler-1 kommt mehrfach vor/,
    );
  });

  test("lehnt eine Spieler-ID ab, die nur aus Leerzeichen besteht", () => {
    assert.throws(
      () => changesFor([
        player("   ", 100), player("B", 90), player("C", 80), player("D", 70),
      ]),
      /Jeder Spieler benötigt eine ID/,
    );
  });

  test("weist ungültige Teilnehmerzahlen zurück", () => {
    assert.throws(
      () => changesFor([player("A", 3), player("B", 2), player("C", 1)]),
      /genau 4 oder 5 Spieler/,
    );
    assert.throws(
      () => changesFor([
        player("A", 6), player("B", 5), player("C", 4),
        player("D", 3), player("E", 2), player("F", 1),
      ]),
      /genau 4 oder 5 Spieler/,
    );
  });

  test("verlangt bei Punktegleichstand eindeutige Tiebreak-Ränge", () => {
    assert.throws(
      () => changesFor([
        player("A", 100), player("B", 100), player("C", 80), player("D", 60),
      ]),
      /benötigt jeder Spieler einen Tiebreak-Rang/,
    );
  });

  test("lehnt lückenhafte Tiebreak-Ränge ab", () => {
    assert.throws(
      () => changesFor([
        player("A", 100, 1500, 1), player("B", 100, 1500, 3),
        player("C", 100, 1500, 4), player("D", 80),
      ]),
      /lückenlos von 1 bis 3 reichen/,
    );
  });

  test("lehnt nicht positive und nicht ganzzahlige Tiebreak-Ränge ab", () => {
    assert.throws(
      () => changesFor([
        player("A", 100, 1500, 0), player("B", 100, 1500, 1),
        player("C", 80), player("D", 70),
      ]),
      /positive ganze Zahl/,
    );
    assert.throws(
      () => changesFor([
        player("A", 100, 1500, 1.5), player("B", 100, 1500, 1),
        player("C", 80), player("D", 70),
      ]),
      /positive ganze Zahl/,
    );
  });

  test("akzeptiert für eine Gleichstandsgruppe die Tiebreak-Ränge 1 bis n", () => {
    const results = calculateMultiplayerElo([
      player("A", 100, 1500, 3), player("B", 100, 1500, 1),
      player("C", 100, 1500, 2), player("D", 80),
    ]);

    assert.deepEqual(results.map(({ id }) => id), ["B", "C", "A", "D"]);
    assert.deepEqual(results.map(({ placement }) => placement), [1, 2, 3, 4]);
  });

  test("behält Elo-Werte und Änderungen ungerundet", () => {
    const results = calculateMultiplayerElo([
      player("A", 120, 1517.25), player("B", 100, 1482.75),
      player("C", 80, 1399.5), player("D", 60, 1620.125),
    ]);

    assert.ok(results.some(({ ratingChange }) => !Number.isInteger(ratingChange)));
    for (const result of results) {
      assert.equal(result.ratingAfter, result.rating + result.ratingChange);
    }
    assert.equal(results.reduce((sum, result) => sum + result.ratingChange, 0), 0);
  });
});
