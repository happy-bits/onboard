import "dotenv/config";
import { scryptSync } from "crypto";
import { createPrismaClient } from "../lib/db";

// Deterministic seeding: fixed salt, no randomness, no current time.
// Usage: tsx scripts/seed.ts [superadmin|superadmin+leader]

const prisma = createPrismaClient();

const FIXED_SALT = "6f6e626f6172642d66697865642d73616c74";

function hash(password: string): string {
  return `${FIXED_SALT}:${scryptSync(password, FIXED_SALT, 32).toString("hex")}`;
}

export async function resetDatabase() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "Email", "Session", "OnboardingProgress", "Invitation", "Team", "User" RESTART IDENTITY CASCADE`
  );
}

export async function seed(scenario: string) {
  await resetDatabase();
  await prisma.user.create({
    data: {
      email: "admin@onboard.local",
      passwordHash: hash("admin123"),
      role: "SUPERADMIN",
    },
  });
  if (scenario === "superadmin+leader") {
    const leader = await prisma.user.create({
      data: {
        email: "leader@onboard.local",
        passwordHash: hash("leader123"),
        role: "LEADER",
      },
    });
    await prisma.team.create({
      data: { name: "Team leader@onboard.local", leaderId: leader.id },
    });
  }
}

const scenario = process.argv[2] ?? "superadmin";
seed(scenario)
  .then(() => {
    console.log(`Seeded scenario: ${scenario}`);
    return prisma.$disconnect();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
