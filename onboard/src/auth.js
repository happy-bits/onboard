export const SESSION_COOKIE = 'onboard_session';

export function signIn(res, user) {
  res.cookie(SESSION_COOKIE, String(user.id), { signed: true, httpOnly: true, sameSite: 'lax' });
}

export function signOut(res) {
  res.clearCookie(SESSION_COOKIE);
}

export const HOME_BY_ROLE = { superadmin: '/admin', leader: '/team', member: '/onboarding' };

export function loadUser(db) {
  return async (req, res, next) => {
    const id = Number(req.signedCookies[SESSION_COOKIE]);
    req.user = null;
    if (id) {
      const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
      req.user = rows[0] ?? null;
    }
    res.locals.user = req.user;
    next();
  };
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.redirect('/login');
    if (req.user.role !== role) return res.status(403).send('Forbidden');
    next();
  };
}
