ALTER TYPE "AuditAction" ADD VALUE 'RESOLVED';

ALTER TABLE "GameReviewFlag" ADD COLUMN "resolvedByUserId" TEXT;

CREATE INDEX "GameReviewFlag_resolvedAt_idx" ON "GameReviewFlag"("resolvedAt");
CREATE INDEX "GameReviewFlag_resolvedByUserId_idx" ON "GameReviewFlag"("resolvedByUserId");

ALTER TABLE "GameReviewFlag"
ADD CONSTRAINT "GameReviewFlag_resolvedByUserId_fkey"
FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Bestehende offene Einzelmeldungen erhalten ebenfalls einen offenen Prüfstatus,
-- damit sie nach der Umstellung in Dashboard und Partieübersicht sichtbar bleiben.
INSERT INTO "GameReviewFlag" ("id", "gameId", "reason", "createdAt", "resolvedAt", "resolvedByUserId")
SELECT
  'migrated_' || md5(report."gameId"),
  report."gameId",
  'MANUAL_ADMIN_REVIEW',
  MIN(report."createdAt"),
  NULL,
  NULL
FROM "GameReport" AS report
WHERE report."status" IN ('OPEN', 'IN_REVIEW')
GROUP BY report."gameId"
ON CONFLICT ("gameId", "reason") DO UPDATE
SET "resolvedAt" = NULL, "resolvedByUserId" = NULL;
