import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { TEST_MODE } from "./clock";

// Format: <salt-hex>:<hash-hex>. In test mode the salt is fixed so that
// seeded and runtime-created users produce identical dumps across runs.

const FIXED_SALT = "6f6e626f6172642d66697865642d73616c74"; // "onboard-fixed-salt"

export function hashPassword(password: string): string {
  const salt = TEST_MODE ? FIXED_SALT : randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 32);
  return timingSafeEqual(candidate, Buffer.from(hash, "hex"));
}
