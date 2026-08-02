const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const missions = [
  { name: "Brest – Petrograd", sortOrder: 1, isActive: true },
  { name: "Cádiz – Stockholm", sortOrder: 2, isActive: true },
  { name: "Edinburgh – Athína", sortOrder: 3, isActive: true },
  { name: "København – Erzurum", sortOrder: 4, isActive: true },
  { name: "Lisboa – Danzig", sortOrder: 5, isActive: true },
  { name: "Palermo – Moskva", sortOrder: 6, isActive: true },
];

async function main() {
  await prisma.$transaction(
    missions.map((mission) =>
      prisma.mission.upsert({
        where: { name: mission.name },
        update: {
          sortOrder: mission.sortOrder,
          isActive: mission.isActive,
        },
        create: mission,
      }),
    ),
  );

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
