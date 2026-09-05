export type PlayerSearchCandidate = {
  id: string;
  alias: string;
  firstName: string | null;
  lastName: string | null;
};

export function normalizePlayerSearch(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("de");
}

function matchPriority(player: PlayerSearchCandidate, query: string) {
  const alias = normalizePlayerSearch(player.alias);
  const firstName = normalizePlayerSearch(player.firstName ?? "");
  const lastName = normalizePlayerSearch(player.lastName ?? "");
  const fullName = normalizePlayerSearch(`${player.firstName ?? ""} ${player.lastName ?? ""}`);
  if (alias === query) return 1;
  if (alias.startsWith(query)) return 2;
  if (alias.includes(query)) return 3;
  if ([firstName, lastName, fullName].includes(query)) return 4;
  return 5;
}

export function playerMatchesSearch(player: PlayerSearchCandidate, value: string) {
  const query = normalizePlayerSearch(value);
  if (!query) return true;
  const fields = [player.alias, player.firstName ?? "", player.lastName ?? "", `${player.firstName ?? ""} ${player.lastName ?? ""}`];
  return fields.some((field) => normalizePlayerSearch(field).includes(query));
}

export function comparePlayerSearchMatches(query: string) {
  const normalizedQuery = normalizePlayerSearch(query);
  return (left: PlayerSearchCandidate, right: PlayerSearchCandidate) =>
    matchPriority(left, normalizedQuery) - matchPriority(right, normalizedQuery)
    || left.alias.localeCompare(right.alias, "de", { sensitivity: "base" })
    || left.id.localeCompare(right.id);
}
