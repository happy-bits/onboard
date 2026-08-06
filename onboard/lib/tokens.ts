import { randomBytes } from "crypto";
import { TEST_MODE } from "./clock";
import { prisma } from "./db";

// In test mode tokens are deterministic (derived from row counts) so that
// database dumps are identical across runs. In production they are random.

export async function invitationToken(): Promise<string> {
  if (TEST_MODE) {
    const count = await prisma.invitation.count();
    return `invite-token-${count + 1}`;
  }
  return randomBytes(24).toString("hex");
}

export async function sessionToken(): Promise<string> {
  if (TEST_MODE) {
    const count = await prisma.session.count();
    return `session-token-${count + 1}`;
  }
  return randomBytes(24).toString("hex");
}
