export type MergeCandidate = { id: string; userId: string | null };

export function validateMergeCandidates(source: MergeCandidate, target: MergeCandidate) {
  if (source.id === target.id) throw new Error("Quell- und Zielspieler müssen unterschiedlich sein.");
  if (source.userId && target.userId && source.userId !== target.userId) throw new Error("Beide Spieler sind unterschiedlichen Benutzerkonten zugeordnet und können nicht automatisch zusammengeführt werden.");
}

export function canClaimPlayer(player: { userId: string | null; pendingClaims: number }) {
  return player.userId === null && player.pendingClaims === 0;
}

export function createClaimAssignment(userId: string, player: { id: string; userId: string | null; pendingClaims: number }) {
  if (!canClaimPlayer(player)) throw new Error("Dieser Spieler ist bereits zugeordnet oder wird bereits beansprucht.");
  return { playerId: player.id, submittedByUserId: userId, status: "PENDING" as const };
}

export function planParticipationTransfer(sourcePlayerId: string, targetPlayerId: string, participations: readonly { id: string; gameId: string; playerId: string }[]) {
  const source = participations.filter((item) => item.playerId === sourcePlayerId);
  const targetGames = new Set(participations.filter((item) => item.playerId === targetPlayerId).map((item) => item.gameId));
  if (source.some((item) => targetGames.has(item.gameId))) throw new Error("Die Spieler kommen in mindestens einer Partie gemeinsam vor.");
  return participations.map((item) => item.playerId === sourcePlayerId ? { ...item, playerId: targetPlayerId } : item);
}
