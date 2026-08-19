import { loadEnvConfig } from "@next/env";
import { GameStatus, PrismaClient } from "@prisma/client";
import { DEFAULT_INITIAL_RATING } from "../lib/elo/constants.ts";
import { rebuildAllEloAt1500InTransaction } from "../lib/elo/rebuild-all-1500.ts";
import { ELO_RECALCULATION_TRANSACTION_OPTIONS } from "../lib/prisma/transaction-options.ts";

loadEnvConfig(process.cwd());
const prisma = new PrismaClient();
const execute = process.argv.includes("--execute");

async function main() {
  const [totalPlayers, affectedPlayers, confirmedGames] = await Promise.all([
    prisma.player.count(),
    prisma.player.count({ where: { initialRating: { not: DEFAULT_INITIAL_RATING } } }),
    prisma.game.count({ where: { status: GameStatus.CONFIRMED, deletedAt: null } }),
  ]);
  console.log(`Spieler gesamt: ${totalPlayers}`);
  console.log(`Auf Start-Elo 1500 umzustellende Spieler: ${affectedPlayers}`);
  console.log(`Chronologisch neu zu berechnende Partien: ${confirmedGames}`);
  if (!execute) { console.log("Nur Vorschau. Zum bewussten Ausführen denselben Befehl mit --execute starten."); return; }
  const summary = await prisma.$transaction(
    (tx) => rebuildAllEloAt1500InTransaction(tx),
    { ...ELO_RECALCULATION_TRANSACTION_OPTIONS, timeout: 300_000 },
  );
  console.log("Elo-Rebuild vollständig und atomar abgeschlossen.");
  console.log(`Umgestellte Spieler: ${summary.affectedPlayers}`);
  console.log(`Neu berechnete Partien: ${summary.recalculatedGames}`);
  console.log(`Aktualisierte Teilnehmerergebnisse: ${summary.updatedParticipants}`);
}

main().catch((error) => {
  console.error("Elo-Rebuild fehlgeschlagen; die Transaktion wurde vollständig zurückgerollt.", error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
