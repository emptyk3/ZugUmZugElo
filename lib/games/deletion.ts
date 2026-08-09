import { AuditAction, GameStatus, type Prisma } from "@prisma/client";

export type DeletableGame = { id: string; playedAt: Date; status: GameStatus; photoUrl: string | null; photoStorageId: string | null };
type Dependencies = { recalculate: (tx: Prisma.TransactionClient, from: Date) => Promise<unknown> };

/** Removes all database state for a game and replays Elo inside the caller's transaction. */
export async function hardDeleteGameInTransaction(tx: Prisma.TransactionClient, game: DeletableGame, adminId: string, dependencies: Dependencies) {
  // GameReport has no cascading foreign key in the existing schema.
  await tx.gameReport.deleteMany({ where: { gameId: game.id } });
  // GameParticipant and GameReviewFlag use the existing ON DELETE CASCADE constraints.
  await tx.game.delete({ where: { id: game.id } });
  if (game.status === GameStatus.CONFIRMED) await dependencies.recalculate(tx, game.playedAt);
  await tx.auditLog.create({ data: {
    actorUserId: adminId, action: AuditAction.DELETED, entityType: "Game", entityId: game.id,
    oldData: { playedAt: game.playedAt.toISOString(), status: game.status, photoStorageId: game.photoStorageId },
    note: "Partie endgültig gelöscht; Elo-Werte chronologisch neu berechnet",
  } });
}
