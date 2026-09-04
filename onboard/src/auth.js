import crypto from 'node:crypto';
import { one } from './db.js';

const COOKIE = 'onboard_sid';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

// MVP simplification: the per-user salt is derived from the email rather than
// drawn at random, so that seeded password hashes — which show up in the
// database dump the e2e tests assert against — are identical on every run.
// A real deployment should switch to a random salt (and then redact the hash
// from the dump).
const SALT_NAMESPACE = 'onboard-mvp-v1';

function saltFor(email) {
  return crypto.createHash('sha256').update(`${SALT_NAMESPACE}:${email}`).digest();
}

export function hashPassword(email, password) {
  const derived = crypto.scryptSync(password, saltFor(email), 32);
  return `scrypt$${derived.toString('hex')}`;
}

export function verifyPassword(user, password) {
  const expected = Buffer.from(user.password_hash, 'utf8');
  const actual = Buffer.from(hashPassword(user.email, password), 'utf8');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

// Sessions live in process memory only, so they never appear in the dump.
const sessions = new Map();

export function createSession(res, userId) {
  const sid = crypto.randomBytes(24).toString('hex');
  sessions.set(sid, userId);
  // Relative lifetime on purpose — see the warning in clock.js. An absolute
  // `Expires` built from the fixed test clock would already be in the past and
  // the browser would drop the cookie.
  res.cookie(COOKIE, sid, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS * 1000,
  });
  return sid;
}

export function destroySession(req, res) {
  const sid = req.cookies?.[COOKIE];
  if (sid) sessions.delete(sid);
  res.clearCookie(COOKIE, { path: '/' });
}

/** Drop every session; used by the test-support reset endpoint. */
export function clearSessions() {
  sessions.clear();
}

export async function attachUser(req, res, next) {
  const sid = req.cookies?.[COOKIE];
  const userId = sid ? sessions.get(sid) : undefined;
  req.user = userId
    ? await one(
        `SELECT u.*, t.id AS owned_team_id
           FROM users u
           LEFT JOIN teams t ON t.leader_id = u.id
          WHERE u.id = $1`,
        [userId],
      )
    : null;
  if (sid && !req.user) sessions.delete(sid);
  res.locals.user = req.user;
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.redirect('/login');
    if (!roles.includes(req.user.role)) return res.status(403).render('error', { message: 'Forbidden' });
    return next();
  };
}

export function homePathFor(user) {
  if (!user) return '/login';
  if (user.role === 'superadmin') return '/admin/leaders';
  if (user.role === 'leader') return '/team';
  return '/onboarding';
}
