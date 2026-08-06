import "dotenv/config";
import { writeFileSync } from "fs";
import { createPrismaClient } from "../lib/db";

// Dumps the entire database (all tables, all rows) to JSON.
// Usage: tsx scripts/dump.ts [outfile]  (prints to stdout if no outfile)

const prisma = createPrismaClient();

export async function dumpDatabase() {
  const [users, teams, invitations, progress, sessions, emails] =
    await Promise.all([
      prisma.user.findMany({ orderBy: { id: "asc" } }),
      prisma.team.findMany({ orderBy: { id: "asc" } }),
      prisma.invitation.findMany({ orderBy: { id: "asc" } }),
      prisma.onboardingProgress.findMany({ orderBy: { id: "asc" } }),
      prisma.session.findMany({ orderBy: { id: "asc" } }),
      prisma.email.findMany({ orderBy: { id: "asc" } }),
    ]);
  return {
    users,
    teams,
    invitations,
    onboardingProgress: progress,
    sessions,
    emails,
  };
}

dumpDatabase()
  .then((dump) => {
    const json = JSON.stringify(dump, null, 2);
    const outfile = process.argv[2];
    if (outfile) {
      writeFileSync(outfile, json);
      console.log(`Database dumped to ${outfile}`);
    } else {
      console.log(json);
    }
    return prisma.$disconnect();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
