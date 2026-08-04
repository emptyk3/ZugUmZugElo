import { AuditAction, Prisma, ReportStatus } from "@prisma/client";

export async function resolveOpenGameReviews(
  tx: Prisma.TransactionClient,
  gameId: string,
  adminId: string,
  resolvedAt = new Date(),
) {
  const flags = await tx.gameReviewFlag.updateMany({
    where: { gameId, resolvedAt: null },
    data: { resolvedAt, resolvedByUserId: adminId },
  });
  const reports = await tx.gameReport.updateMany({
    where: { gameId, status: { in: [ReportStatus.OPEN, ReportStatus.IN_REVIEW] } },
    data: { status: ReportStatus.RESOLVED, reviewedAt: resolvedAt, reviewedByUserId: adminId, resolution: "Durch Administrator als erledigt markiert" },
  });
  if (flags.count > 0 || reports.count > 0) {
    await tx.auditLog.create({ data: {
      actorUserId: adminId, action: AuditAction.RESOLVED, entityType: "GameReviewFlag", entityId: gameId,
      newData: { gameId, closedCount: reports.count, closedFlagCount: flags.count, adminId, resolvedAt: resolvedAt.toISOString() },
      note: "Offene Partiemeldungen als erledigt markiert",
    } });
  }
  return { closedCount: flags.count, closedReportCount: reports.count };
}
