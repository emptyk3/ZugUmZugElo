import { AuditAction, ClaimStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recalculateEloFromTransaction } from "@/lib/elo/recalculation";
import { validateMergeCandidates } from "./policy";
import { ELO_RECALCULATION_TRANSACTION_OPTIONS } from "@/lib/prisma/transaction-options";

export async function mergePlayersInTransaction(
  tx: Prisma.TransactionClient,
  input: { sourcePlayerId: string; targetPlayerId: string; actorUserId: string; note?: string },
) {
  const [source, target] = await Promise.all([
    tx.player.findUniqueOrThrow({ where: { id: input.sourcePlayerId }, select: { id: true, alias: true, userId: true, isActive: true, deletedAt: true, mergedIntoPlayerId: true } }),
    tx.player.findUniqueOrThrow({ where: { id: input.targetPlayerId }, select: { id: true, alias: true, userId: true, isActive: true, deletedAt: true, mergedIntoPlayerId: true } }),
  ]);
  validateMergeCandidates(source, target);
  if (!source.isActive || source.deletedAt || source.mergedIntoPlayerId) throw new Error("Der Quellspieler ist nicht mehr aktiv zusammenführbar.");
  if (!target.isActive || target.deletedAt || target.mergedIntoPlayerId) throw new Error("Der Zielspieler ist nicht aktiv.");

  const sourceParticipations = await tx.gameParticipant.findMany({
    where: { playerId: source.id },
    orderBy: { game: { playedAt: "asc" } },
    select: { id: true, gameId: true, game: { select: { playedAt: true } } },
  });
  if (sourceParticipations.length) {
    const conflict = await tx.gameParticipant.findFirst({
      where: { playerId: target.id, gameId: { in: sourceParticipations.map((item) => item.gameId) } },
      select: { gameId: true },
    });
    if (conflict) throw new Error("Die Spieler kommen in mindestens einer Partie gemeinsam vor; eine verlustfreie Zusammenführung ist nicht möglich.");
  }

  const now = new Date();
  if (source.userId && !target.userId) {
    await tx.player.update({ where: { id: source.id }, data: { userId: null } });
    await tx.player.update({ where: { id: target.id }, data: { userId: source.userId } });
  }
  await tx.playerAlias.updateMany({ where: { playerId: source.id }, data: { playerId: target.id } });
  await tx.gameParticipant.updateMany({ where: { playerId: source.id }, data: { playerId: target.id } });
  await tx.playerClaim.updateMany({ where: { playerId: source.id, status: ClaimStatus.PENDING }, data: { status: ClaimStatus.CANCELLED, reviewedAt: now, note: "Durch Spielerzusammenführung erledigt" } });
  await tx.player.update({ where: { id: source.id }, data: { isActive: false, mergedIntoPlayerId: target.id, mergedAt: now, deletedAt: now, userId: null } });
  const merge = await tx.playerMerge.create({ data: { sourcePlayerId: source.id, targetPlayerId: target.id, performedByUserId: input.actorUserId, note: input.note } });
  await tx.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: AuditAction.MERGED,
      entityType: "Player",
      entityId: target.id,
      oldData: { sourcePlayerId: source.id, sourceAlias: source.alias, targetAlias: target.alias },
      newData: { targetPlayerId: target.id, transferredParticipations: sourceParticipations.length, sourceSoftDeleted: true },
      note: input.note,
    },
  });

  const earliestAffectedAt = sourceParticipations[0]?.game.playedAt ?? null;
  if (earliestAffectedAt) await recalculateEloFromTransaction(tx, earliestAffectedAt);
  return { mergeId: merge.id, earliestAffectedAt, transferredParticipations: sourceParticipations.length };
}

export function mergePlayers(input: { sourcePlayerId: string; targetPlayerId: string; actorUserId: string; note?: string }) {
  return prisma.$transaction((tx) => mergePlayersInTransaction(tx, input), ELO_RECALCULATION_TRANSACTION_OPTIONS);
}
