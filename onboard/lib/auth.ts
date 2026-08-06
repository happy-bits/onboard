import { cookies } from "next/headers";
import { prisma } from "./db";
import { sessionToken } from "./tokens";
import type { User } from "@prisma/client";

const COOKIE = "onboard_session";

export async function createSession(userId: number) {
  const token = await sessionToken();
  await prisma.session.create({ data: { token, userId } });
  const store = await cookies();
  store.set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/" });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
    store.delete(COOKIE);
  }
}

export async function currentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  return session?.user ?? null;
}

export function homeFor(role: string): string {
  switch (role) {
    case "SUPERADMIN":
      return "/superadmin";
    case "LEADER":
      return "/leader";
    default:
      return "/onboarding";
  }
}
