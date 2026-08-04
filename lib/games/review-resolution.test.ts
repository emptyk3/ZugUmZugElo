import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { resolveOpenGameReviews } from "./review-resolution.ts";

function transaction(counts = { flags: 2, reports: 3 }) {
  const calls: Array<{ operation: string; args: unknown }> = [];
  const tx = {
    gameReviewFlag: { updateMany: async (args: unknown) => { calls.push({ operation: "flags", args }); return { count: counts.flags }; } },
    gameReport: { updateMany: async (args: unknown) => { calls.push({ operation: "reports", args }); return { count: counts.reports }; } },
    auditLog: { create: async (args: unknown) => { calls.push({ operation: "audit", args }); return {}; } },
  } as unknown as Prisma.TransactionClient;
  return { tx, calls };
}

test("mehrere offene Meldungen werden gemeinsam geschlossen und auditiert", async () => {
  const { tx, calls } = transaction();
  const now = new Date("2026-08-04T07:42:00.000Z");
  const result = await resolveOpenGameReviews(tx, "game-1", "admin-1", now);
  assert.deepEqual(result, { closedCount: 2, closedReportCount: 3 });
  assert.deepEqual(calls.map((call) => call.operation), ["flags", "reports", "audit"]);
  assert.deepEqual((calls[0].args as { where: unknown }).where, { gameId: "game-1", resolvedAt: null });
  assert.deepEqual((calls[0].args as { data: unknown }).data, { resolvedAt: now, resolvedByUserId: "admin-1" });
  assert.deepEqual((calls[1].args as { where: unknown }).where, { gameId: "game-1", status: { in: ["OPEN", "IN_REVIEW"] } });
  assert.equal(((calls[2].args as { data: { action: string } }).data.action), "RESOLVED");
});

test("bereits erledigte Meldungen werden durch die Filter ignoriert", async () => {
  const { tx, calls } = transaction({ flags: 0, reports: 0 });
  const result = await resolveOpenGameReviews(tx, "game-1", "admin-1");
  assert.deepEqual(result, { closedCount: 0, closedReportCount: 0 });
  assert.deepEqual(calls.map((call) => call.operation), ["flags", "reports"]);
});

test("ein Schreibfehler verhindert Abschluss-Audit und wird an die Transaktion weitergegeben", async () => {
  let auditWritten = false;
  const tx = {
    gameReviewFlag: { updateMany: async () => ({ count: 1 }) },
    gameReport: { updateMany: async () => { throw new Error("simulierter Schreibfehler"); } },
    auditLog: { create: async () => { auditWritten = true; } },
  } as unknown as Prisma.TransactionClient;
  await assert.rejects(resolveOpenGameReviews(tx, "game-1", "admin-1"), /simulierter Schreibfehler/);
  assert.equal(auditWritten, false);
});

test("Bearbeitungs-Checkbox ist standardmäßig aus und schließt nur innerhalb der Partie-Transaktion", () => {
  const editor = readFileSync("app/admin/partien/[id]/GameEditor.tsx", "utf8");
  const action = readFileSync("app/admin/partien/[id]/actions.ts", "utf8");
  assert.ok(editor.includes("useState(false)"));
  assert.ok(editor.includes("Offene Meldungen dieser Partie als erledigt markieren"));
  assert.ok(action.includes("if (input.resolveOpenReports) await resolveOpenGameReviews(tx, gameId, adminId)"));
  assert.ok(action.includes("return prisma.$transaction"));
});

test("separater Abschluss-Button bestätigt, ändert keine Partiedaten und aktualisiert die Seite", () => {
  const button = readFileSync("app/admin/partien/[id]/ResolveGameReportsButton.tsx", "utf8");
  const action = readFileSync("app/admin/partien/[id]/actions.ts", "utf8");
  assert.ok(button.includes("window.confirm"));
  assert.ok(button.includes("Meldung als erledigt markieren"));
  const standalone = action.slice(action.indexOf("export async function resolveGameReports"));
  assert.ok(standalone.includes("prisma.$transaction"));
  assert.equal(standalone.includes("tx.game.update"), false);
});

test("Dashboard und Partieübersicht zählen ausschließlich offene GameReviewFlags", () => {
  const dashboard = readFileSync("app/admin/page.tsx", "utf8");
  const overview = readFileSync("app/admin/partien/page.tsx", "utf8");
  assert.ok(dashboard.includes("prisma.gameReviewFlag.count({ where: { resolvedAt: null } })"));
  assert.ok(overview.includes("reviewReasons: { where: { resolvedAt: null } }"));
  assert.equal(dashboard.includes("gameReport.count"), false);
});

test("Migration übernimmt bereits vorhandene offene Einzelmeldungen", () => {
  const migration = readFileSync("prisma/migrations/20260804120000_game_review_resolution/migration.sql", "utf8");
  assert.ok(migration.includes("WHERE report.\"status\" IN ('OPEN', 'IN_REVIEW')"));
  assert.ok(migration.includes("ON CONFLICT (\"gameId\", \"reason\") DO UPDATE"));
  assert.ok(migration.includes('SET "resolvedAt" = NULL, "resolvedByUserId" = NULL'));
});

test("neue Nutzermeldungen öffnen den Prüfstatus atomar erneut", () => {
  const action = readFileSync("app/partien/[id]/actions.ts", "utf8");
  assert.ok(action.includes("prisma.$transaction"));
  assert.ok(action.includes("tx.gameReport.upsert"));
  assert.ok(action.includes("tx.gameReviewFlag.upsert"));
  assert.ok(action.includes("update: { resolvedAt: null, resolvedByUserId: null }"));
});
