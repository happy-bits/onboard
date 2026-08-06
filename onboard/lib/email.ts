import { prisma } from "./db";
import { now } from "./clock";

// Fake email service: "sent" emails are stored in the database and can be
// read in the dev inbox at /dev/inbox. Replace with a real provider later.

export async function sendEmail(to: string, subject: string, body: string) {
  await prisma.email.create({ data: { to, subject, body, sentAt: now() } });
}
