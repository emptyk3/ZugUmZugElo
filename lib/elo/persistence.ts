import { Prisma } from "@prisma/client";
import type { calculateChronologicalRatings } from "./timeline.ts";

const PARTICIPANT_UPDATE_BATCH_SIZE = 2_000;
const PLAYER_UPDATE_BATCH_SIZE = 5_000;

function batches<T>(items: readonly T[], size: number) {
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += size) result.push(items.slice(start, start + size));
  return result;
}

/**
 * Persists an in-memory replay with a small number of parameterized statements.
 * Batches stay well below PostgreSQL's bind-parameter limit and Prisma.sql keeps
 * every identifier value parameterized; no untrusted value becomes SQL text.
 */
export async function writeRecalculatedRatings(
  tx: Pick<Prisma.TransactionClient, "$executeRaw">,
  recalculated: ReturnType<typeof calculateChronologicalRatings>,
) {
  for (const batch of batches(recalculated.participantUpdates, PARTICIPANT_UPDATE_BATCH_SIZE)) {
    if (!batch.length) continue;
    const values = batch.map((participant) => Prisma.sql`(
      ${participant.id}::text,
      ${participant.placement}::integer,
      ${participant.ratingBefore}::double precision,
      ${participant.ratingChange}::double precision,
      ${participant.ratingAfter}::double precision
    )`);
    await tx.$executeRaw(Prisma.sql`
      UPDATE "GameParticipant" AS participant
      SET
        "placement" = updates.placement,
        "ratingBefore" = updates.rating_before,
        "ratingChange" = updates.rating_change,
        "ratingAfter" = updates.rating_after,
        "updatedAt" = CURRENT_TIMESTAMP
      FROM (VALUES ${Prisma.join(values)}) AS updates(id, placement, rating_before, rating_change, rating_after)
      WHERE participant.id = updates.id
    `);
  }

  const finalRatings = [...recalculated.finalRatings];
  for (const batch of batches(finalRatings, PLAYER_UPDATE_BATCH_SIZE)) {
    if (!batch.length) continue;
    const values = batch.map(([playerId, currentRating]) => Prisma.sql`(
      ${playerId}::text,
      ${currentRating}::double precision
    )`);
    await tx.$executeRaw(Prisma.sql`
      UPDATE "Player" AS player
      SET
        "currentRating" = updates.current_rating,
        "updatedAt" = CURRENT_TIMESTAMP
      FROM (VALUES ${Prisma.join(values)}) AS updates(id, current_rating)
      WHERE player.id = updates.id
    `);
  }
}
