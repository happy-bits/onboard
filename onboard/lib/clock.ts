// Injectable clock. In test mode (TEST_MODE=1) time starts at a fixed
// instant and only moves when advanced via the dev clock endpoint.

export const TEST_MODE = process.env.TEST_MODE === "1";

const TEST_EPOCH = new Date("2026-01-01T00:00:00.000Z").getTime();

const globalForClock = globalThis as unknown as { clockOffsetMs?: number };
globalForClock.clockOffsetMs ??= 0;

export function now(): Date {
  if (TEST_MODE) return new Date(TEST_EPOCH + globalForClock.clockOffsetMs!);
  return new Date();
}

export function advanceClock(ms: number): Date {
  globalForClock.clockOffsetMs! += ms;
  return now();
}

export function resetClock(): Date {
  globalForClock.clockOffsetMs = 0;
  return now();
}
