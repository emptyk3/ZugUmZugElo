export const GAME_PHOTO_REQUIRED_MESSAGE = "Bitte füge ein Foto der Partie hinzu.";

export type EditableParticipant = {
  playerId: string;
  points: number;
  missionId: string;
  missionKept: boolean;
  tiebreakRank?: number;
};

export function validateGameParticipants(participants: EditableParticipant[]) {
  if (participants.length !== 4 && participants.length !== 5) {
    throw new Error("Eine Partie muss genau 4 oder 5 Spieler enthalten.");
  }
  const playerIds = participants.map((participant) => participant.playerId.trim());
  if (playerIds.some((id) => !id)) throw new Error("Jeder Teilnehmer benötigt ein Spielerprofil.");
  if (new Set(playerIds).size !== playerIds.length) throw new Error("Jeder Spieler darf nur einmal teilnehmen.");

  for (const participant of participants) {
    if (!Number.isInteger(participant.points)) throw new Error("Alle Punktzahlen müssen ganze Zahlen sein.");
    if (!participant.missionId.trim()) throw new Error("Jeder Teilnehmer benötigt eine Mission.");
  }

  const groups = new Map<number, EditableParticipant[]>();
  for (const participant of participants) {
    groups.set(participant.points, [...(groups.get(participant.points) ?? []), participant]);
  }
  for (const group of groups.values()) {
    if (group.length === 1) {
      if (group[0].tiebreakRank !== undefined) throw new Error("Ein Tiebreak ist nur bei Punktegleichstand zulässig.");
      continue;
    }
    const ranks = group.map((participant) => participant.tiebreakRank);
    if (ranks.some((rank) => !Number.isInteger(rank) || (rank as number) <= 0)) {
      throw new Error("Bei Punktegleichstand müssen alle Tiebreak-Ränge positive ganze Zahlen sein.");
    }
    const sorted = (ranks as number[]).slice().sort((a, b) => a - b);
    if (sorted.some((rank, index) => rank !== index + 1)) {
      throw new Error("Tiebreak-Ränge müssen eindeutig und lückenlos bei 1 beginnen.");
    }
  }
  return playerIds;
}
