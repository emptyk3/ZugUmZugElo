export const ELO_K_FACTOR = 20;

export type EloParticipant = {
  id: string;
  rating: number;
  points: number;
  /** Lower values win when two or more players have the same points. */
  tiebreakRank?: number;
};

export type EloResult = EloParticipant & {
  placement: number;
  ratingChange: number;
  ratingAfter: number;
};

function expectedScore(rating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}

function validateParticipants(participants: readonly EloParticipant[]): void {
  if (participants.length !== 4 && participants.length !== 5) {
    throw new RangeError("Eine Elo-Partie muss genau 4 oder 5 Spieler enthalten.");
  }

  const ids = new Set<string>();
  for (const participant of participants) {
    if (!participant.id) {
      throw new TypeError("Jeder Spieler benötigt eine ID.");
    }
    if (ids.has(participant.id)) {
      throw new TypeError(`Spieler-ID ${participant.id} kommt mehrfach vor.`);
    }
    ids.add(participant.id);

    if (!Number.isFinite(participant.rating)) {
      throw new TypeError(`Der Elo-Wert von ${participant.id} muss endlich sein.`);
    }
    if (!Number.isInteger(participant.points)) {
      throw new TypeError(
        `Die Punktzahl von ${participant.id} muss eine ganze Zahl sein; negative ganze Zahlen sind erlaubt.`,
      );
    }
    if (
      participant.tiebreakRank !== undefined &&
      (!Number.isInteger(participant.tiebreakRank) || participant.tiebreakRank < 1)
    ) {
      throw new TypeError(`Der Tiebreak-Rang von ${participant.id} muss eine positive ganze Zahl sein.`);
    }
  }

  const playersByPoints = new Map<number, EloParticipant[]>();
  for (const participant of participants) {
    const group = playersByPoints.get(participant.points) ?? [];
    group.push(participant);
    playersByPoints.set(participant.points, group);
  }

  for (const [points, group] of playersByPoints) {
    if (group.length < 2) continue;

    if (group.some(({ tiebreakRank }) => tiebreakRank === undefined)) {
      throw new TypeError(`Bei ${points} Punkten benötigt jeder Spieler einen Tiebreak-Rang.`);
    }

    const ranks = group.map(({ tiebreakRank }) => tiebreakRank as number);
    if (new Set(ranks).size !== ranks.length) {
      throw new TypeError(`Bei ${points} Punkten müssen die Tiebreak-Ränge eindeutig sein.`);
    }

    const sortedRanks = [...ranks].sort((left, right) => left - right);
    const isContinuous = sortedRanks.every((rank, index) => rank === index + 1);
    if (!isContinuous) {
      throw new TypeError(
        `Bei ${points} Punkten müssen die Tiebreak-Ränge lückenlos von 1 bis ${group.length} reichen.`,
      );
    }
  }
}

function normalizeParticipants(
  participants: readonly EloParticipant[],
): EloParticipant[] {
  return participants.map((participant) => ({
    ...participant,
    id: participant.id.trim(),
  }));
}

function rankParticipants(participants: readonly EloParticipant[]): EloParticipant[] {
  return [...participants].sort((left, right) => {
    if (left.points !== right.points) return right.points - left.points;
    return (left.tiebreakRank as number) - (right.tiebreakRank as number);
  });
}

/**
 * Calculates one multiplayer result as all pairwise one-on-one duels.
 * Every expectation uses the ratings from before the game.
 */
export function calculateMultiplayerElo(
  participants: readonly EloParticipant[],
): EloResult[] {
  const normalizedParticipants = normalizeParticipants(participants);
  validateParticipants(normalizedParticipants);

  const ranked = rankParticipants(normalizedParticipants);
  const changes = new Map(ranked.map(({ id }) => [id, 0]));

  for (let winnerIndex = 0; winnerIndex < ranked.length - 1; winnerIndex += 1) {
    const winner = ranked[winnerIndex];

    for (let loserIndex = winnerIndex + 1; loserIndex < ranked.length; loserIndex += 1) {
      const loser = ranked[loserIndex];
      const duelChange = ELO_K_FACTOR * (1 - expectedScore(winner.rating, loser.rating));

      changes.set(winner.id, (changes.get(winner.id) ?? 0) + duelChange);
      changes.set(loser.id, (changes.get(loser.id) ?? 0) - duelChange);
    }
  }

  const results = ranked.map((participant, index) => ({
    ...participant,
    placement: index + 1,
    ratingChange: changes.get(participant.id) ?? 0,
    ratingAfter: participant.rating + (changes.get(participant.id) ?? 0),
  }));

  // Elo values remain completely unrounded in the engine and must later be stored
  // at full precision. Rounding belongs exclusively to the UI presentation layer.
  // Remove only the tiny IEEE-754 zero-sum residue while preserving every duel.
  const lastResult = results.at(-1) as EloResult;
  const precedingSum = results
    .slice(0, -1)
    .reduce((sum, participant) => sum + participant.ratingChange, 0);
  lastResult.ratingChange = -precedingSum;
  lastResult.ratingAfter = lastResult.rating + lastResult.ratingChange;

  return results;
}
