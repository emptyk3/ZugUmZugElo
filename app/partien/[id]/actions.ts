"use server";

import { GameReportReason, GameStatus, ReportStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function reportGame(gameId: string, message: string) {
  const user = await requireUser(`/partien/${gameId}`);
  const comment = message.trim();
  if (!comment) return { error: "Bitte beschreibe kurz, was geprüft werden soll." };
  if (comment.length > 100) return { error: "Die Meldung darf höchstens 100 Zeichen lang sein." };

  const game = await prisma.game.findFirst({ where: { id: gameId, status: GameStatus.CONFIRMED, deletedAt: null }, select: { id: true } });
  if (!game) return { error: "Diese Partie kann nicht gemeldet werden." };

  await prisma.gameReport.upsert({
    where: { gameId_submittedByUserId: { gameId, submittedByUserId: user.id } },
    create: { gameId, submittedByUserId: user.id, reason: GameReportReason.OTHER, comment, status: ReportStatus.OPEN },
    update: { reason: GameReportReason.OTHER, comment, status: ReportStatus.OPEN, reviewedByUserId: null, reviewedAt: null, resolution: null },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/partien");
  revalidatePath(`/admin/partien/${gameId}`);
  return { success: true as const };
}
