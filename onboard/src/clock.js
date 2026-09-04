// Deterministic clock for everything that lands in the database.
//
// Every row timestamp is this one fixed instant. That is deliberate: the e2e
// tests reset the database per test but reuse a single long-lived server
// process, so anything derived from process state (a counter, a real clock)
// would make dumps differ between "run one test" and "run the suite". Row
// ordering comes from the identity columns instead.
//
// IMPORTANT: this instant is in the past, so it must never be used to produce an
// absolute time that a browser or other external client judges for itself
// (cookie `Expires`, `Cache-Control` dates, `Retry-After`, ...) — the client
// would treat such a value as already expired and silently discard it. Client
// facing lifetimes are expressed relatively instead (see `Max-Age` in auth.js).

const FIXED_NOW = '2024-01-01T00:00:00.000Z';

/** Fixed wall-clock instant, for database row timestamps only. */
export function now() {
  return FIXED_NOW;
}
