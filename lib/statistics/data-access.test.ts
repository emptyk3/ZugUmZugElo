import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../../app/statistik/page.tsx", import.meta.url), "utf8");

test("Statistikseite und Zeitreihen laden weder Pending-, Rejected- noch gelöschte Partien", () => {
  assert.match(page, /status:\s*GameStatus\.CONFIRMED/);
  assert.match(page, /deletedAt:\s*null/);
  assert.doesNotMatch(page, /GameStatus\.(PENDING|REJECTED|DELETED)/);
});

test("öffentliche Statistikabfrage selektiert keine privaten User-Felder", () => {
  for (const privateField of ["email", "firstName", "lastName", "passwordHash", "AuditLog"]) {
    assert.doesNotMatch(page, new RegExp(`${privateField}\\s*:`));
  }
  assert.match(page, /user:\s*\{\s*select:\s*\{\s*profileImageUrl:\s*true/);
});

test("stabile Chronologie verwendet playedAt, createdAt und id", () => {
  assert.match(page, /orderBy:\s*\[\{ playedAt: "asc" \}, \{ createdAt: "asc" \}, \{ id: "asc" \}\]/);
});
