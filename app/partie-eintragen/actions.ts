"use server";

import { GameReviewReason, GameStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { calculateMultiplayerElo, ELO_K_FACTOR } from "@/lib/elo";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { gameSubmissionPolicy } from "@/lib/auth/policy";

type SaveParticipantInput = {
  playerId: string;
  points: number;
  missionId: string;
  missionKept: boolean;
  tiebreakRank?: number;
};

type SaveGameInput = {
  playedAt: string;
  participants: SaveParticipantInput[];
};

export async function getGameFormOptions() {
  await requireUser("/partie-eintragen");
  const [players, missions] = await Promise.all([
    prisma.player.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        mergedIntoPlayerId: null,
      },
      orderBy: { alias: "asc" },
      select: { id: true, alias: true, user: { select: { profileImageUrl: true } } },
    }),
    prisma.mission.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return { players, missions };
}

export async function createPlayer(input: { alias: string; level: "beginner" | "advanced" }) {
  const user = await requireUser("/partie-eintragen");
  const policy = gameSubmissionPolicy(user);
  if (!policy.allowed) return { error: policy.message ?? "Keine Berechtigung." };
  const alias = input.alias.trim();
  if (!alias) return { error: "Bitte gib einen Alias ein." };
  if (alias.length > 80) return { error: "Der Alias darf höchstens 80 Zeichen lang sein." };
  if (input.level !== "beginner" && input.level !== "advanced") {
    return { error: "Bitte wähle ein gültiges Startniveau." };
  }

  const initialRating = input.level === "beginner" ? 1200 : 1500;

  try {
    const player = await prisma.$transaction(
      async (transaction) => {
        const existing = await transaction.player.findFirst({
          where: {
            alias: { equals: alias, mode: "insensitive" },
            deletedAt: null,
            mergedIntoPlayerId: null,
          },
          select: { id: true },
        });
        if (existing) throw new Error("Ein Spieler mit diesem Alias existiert bereits.");

        return transaction.player.create({
          data: {
            alias,
            initialRating,
            currentRating: initialRating,
            isActive: true,
            createdByUserId: user.id,
            aliases: { create: { alias } },
          },
          select: { id: true, alias: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    revalidatePath("/partie-eintragen");
    return { player };
  } catch (error) {
    console.error("Spieler konnte nicht angelegt werden:", error);
    return {
      error: error instanceof Error ? error.message : "Der Spieler konnte nicht angelegt werden.",
    };
  }
}

function validateInput(input: SaveGameInput) {
  if (input.participants.length !== 4 && input.participants.length !== 5) {
    throw new Error("Eine Partie muss genau 4 oder 5 Spieler enthalten.");
  }

  const playedAt = new Date(input.playedAt);
  if (Number.isNaN(playedAt.getTime())) {
    throw new Error("Datum und Uhrzeit der Partie sind ungültig.");
  }
  if (playedAt.getTime() > Date.now() + 5 * 60 * 1000) {
    throw new Error("Die Partie darf nicht in der Zukunft liegen.");
  }

  const playerIds = input.participants.map(({ playerId }) => playerId.trim());
  if (playerIds.some((id) => !id)) {
    throw new Error("Jeder Teilnehmer benötigt ein Spielerprofil.");
  }
  if (new Set(playerIds).size !== playerIds.length) {
    throw new Error("Jeder Spieler darf nur einmal teilnehmen.");
  }

  for (const participant of input.participants) {
    if (!Number.isInteger(participant.points)) {
      throw new Error("Alle Punktzahlen müssen ganze Zahlen sein.");
    }
    if (!participant.missionId.trim()) {
      throw new Error("Jeder Teilnehmer benötigt eine Mission.");
    }
  }

  return { playedAt, playerIds };
}

async function persistGame(input: SaveGameInput, creator: Awaited<ReturnType<typeof requireUser>>) {
  const { playedAt, playerIds } = validateInput(input);
  const missionIds = [...new Set(input.participants.map(({ missionId }) => missionId.trim()))];

  return prisma.$transaction(
    async (transaction) => {
      const [players, missions, laterConfirmedGame] = await Promise.all([
        transaction.player.findMany({
          where: {
            id: { in: playerIds },
            isActive: true,
            deletedAt: null,
            mergedIntoPlayerId: null,
          },
          select: { id: true, alias: true, currentRating: true, user: { select: { profileImageUrl: true } } },
        }),
        transaction.mission.findMany({
          where: { id: { in: missionIds }, isActive: true },
          select: { id: true },
        }),
        transaction.game.findFirst({
          where: { status: GameStatus.CONFIRMED, deletedAt: null, playedAt: { gt: playedAt } },
          select: { id: true },
        }),
      ]);
      if (players.length !== playerIds.length) {
        throw new Error("Mindestens ein Spielerprofil ist nicht vorhanden oder nicht aktiv.");
      }
      if (missions.length !== missionIds.length) {
        throw new Error("Mindestens eine Mission ist nicht vorhanden oder nicht aktiv.");
      }

      const ratings = new Map(players.map((player) => [player.id, player.currentRating]));
      const eloResults = calculateMultiplayerElo(
        input.participants.map((participant) => ({
          id: participant.playerId,
          rating: ratings.get(participant.playerId) as number,
          points: participant.points,
          tiebreakRank: participant.tiebreakRank,
        })),
      );
      const eloByPlayer = new Map(eloResults.map((result) => [result.id, result]));

      const policy = gameSubmissionPolicy(creator);
      if (!policy.allowed) throw new Error(policy.message ?? "Keine Berechtigung zur Partieerfassung.");
      const reviewReasons = [...policy.reasons] as GameReviewReason[];
      if (laterConfirmedGame) reviewReasons.push(GameReviewReason.BACKDATED);
      const confirmed = reviewReasons.length === 0;

      const game = await transaction.game.create({
        data: {
          playedAt,
          status: confirmed ? GameStatus.CONFIRMED : GameStatus.PENDING,
          confirmedAt: confirmed ? new Date() : null,
          ratingSystemVersion: 1,
          kFactor: ELO_K_FACTOR,
          createdByUserId: creator.id,
          reviewReasons: reviewReasons.length ? { create: reviewReasons.map((reason) => ({ reason })) } : undefined,
        },
        select: { id: true },
      });

      await transaction.gameParticipant.createMany({
        data: input.participants.map((participant) => {
          const elo = eloByPlayer.get(participant.playerId);
          if (!elo) throw new Error("Die Elo-Berechnung ist unvollständig.");
          return {
            gameId: game.id,
            playerId: participant.playerId,
            points: participant.points,
            placement: elo.placement,
            tiebreakRank: participant.tiebreakRank,
            missionId: participant.missionId,
            missionKept: participant.missionKept,
            ratingBefore: elo.rating,
            ratingChange: confirmed ? elo.ratingChange : 0,
            ratingAfter: confirmed ? elo.ratingAfter : elo.rating,
          };
        }),
      });

      if (confirmed) {
        for (const elo of eloResults) {
          await transaction.player.update({
            where: { id: elo.id },
            data: { currentRating: elo.ratingAfter },
          });
        }
      }

      const aliases = new Map(players.map((player) => [player.id, player.alias]));
      const images = new Map(players.map((player) => [player.id, player.user?.profileImageUrl ?? null]));
      return {
        gameId: game.id,
        status: confirmed ? "CONFIRMED" as const : "PENDING" as const,
        reviewReasons,
        results: eloResults.map((result) => ({
          playerId: result.id,
          alias: aliases.get(result.id) ?? "Unbekannter Spieler",
          imageUrl: images.get(result.id) ?? null,
          placement: result.placement,
          ratingBefore: result.rating,
          ratingChange: result.ratingChange,
          ratingAfter: result.ratingAfter,
        })),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function saveGame(input: SaveGameInput) {
  try {
    const creator = await requireUser("/partie-eintragen");
    const savedGame = await persistGame(input, creator);
    revalidatePath("/");
    return savedGame;
  } catch (error) {
    console.error("Partie konnte nicht gespeichert werden:", error);
    return {
      error: error instanceof Error ? error.message : "Die Partie konnte nicht gespeichert werden.",
    };
  }
}
