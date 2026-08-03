const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const missions = [
  { name: "Brest – Petrograd", sortOrder: 1, isActive: true },
  { name: "Cádiz – Stockholm", sortOrder: 2, isActive: true },
  { name: "Edinburgh – Athína", sortOrder: 3, isActive: true },
  { name: "København – Erzurum", sortOrder: 4, isActive: true },
  { name: "Lisboa – Danzig", sortOrder: 5, isActive: true },
  { name: "Palermo – Moskva", sortOrder: 6, isActive: true },
];

const adminEmail = "admin@zugumzugelo.local";
async function main() {
  const verifiedAt = new Date();
  const adminPassword = process.env.ADMIN_SEED_PASSWORD;
  if (!adminPassword || adminPassword.length < 12) {
    throw new Error(
      "ADMIN_SEED_PASSWORD muss gesetzt sein und mindestens 12 Zeichen enthalten.",
    );
  }
  // Gleiche bcrypt-Bibliothek und gleicher Kostenfaktor wie bei der Registrierung.
  const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
  const [admin] = await prisma.$transaction([
    prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        passwordHash: adminPasswordHash,
        role: "ADMIN",
        status: "ACTIVE",
        emailVerifiedAt: verifiedAt,
        approvedAt: verifiedAt,
        requiresGameApproval: false,
        canCreateGames: true,
        gameEntryBlockedUntil: null,
        deletedAt: null,
      },
      create: {
        email: adminEmail,
        passwordHash: adminPasswordHash,
        firstName: "System",
        lastName: "Administrator",
        role: "ADMIN",
        status: "ACTIVE",
        emailVerifiedAt: verifiedAt,
        approvedAt: verifiedAt,
        requiresGameApproval: false,
        canCreateGames: true,
      },
      select: { id: true, email: true },
    }),
    ...missions.map((mission) =>
      prisma.mission.upsert({
        where: { name: mission.name },
        update: {
          sortOrder: mission.sortOrder,
          isActive: mission.isActive,
        },
        create: mission,
      }),
    ),
  ]);

  console.log(`Administrator ${admin.email} wurde erfolgreich angelegt oder aktualisiert.`);
  console.log(`${missions.length} Missionen wurden erfolgreich angelegt oder aktualisiert.`);
}

main()
  .catch((error) => {
    console.error("Prisma-Seed fehlgeschlagen:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
