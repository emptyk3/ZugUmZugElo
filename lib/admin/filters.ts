export function normalizeSearch(value: string) { return value.trim().toLocaleLowerCase("de"); }
export function playerMatchesSearch(player: { alias: string; aliases: readonly string[] }, query: string) { const q=normalizeSearch(query); return !q || [player.alias,...player.aliases].some(alias=>normalizeSearch(alias).includes(q)); }
export function gameMatchesStatus(game: { status: string }, status: string) { return !status || status==="ALL" || game.status===status; }
export function assertAdminMayBeDeactivated(activeAdminCount: number, targetIsActiveAdmin: boolean) { if(targetIsActiveAdmin&&activeAdminCount<=1)throw new Error("Der letzte aktive Administrator kann nicht entfernt oder gesperrt werden."); }
export function formatAuditDetails(value: unknown) { return value === null || value === undefined ? "–" : JSON.stringify(value); }
