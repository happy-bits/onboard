import crypto from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import { HOME_BY_ROLE, loadUser, requireRole, signIn, signOut } from './auth.js';
import { hashPassword, verifyPassword } from './passwords.js';
import { ONBOARDING_STEPS, isStepKey, progressLabel } from './onboarding.js';
import * as views from './views.js';

const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase();
const isUniqueViolation = (err) => err?.code === '23505';

export function createApp({ db, email, config }) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(cookieParser(config.sessionSecret));
  app.use(loadUser(db));

  const page = (res, title, body, status = 200) =>
    res.status(status).type('html').send(views.layout({ title, user: res.locals.user, body }));

  // ---- Auth -------------------------------------------------------------

  app.get('/', (req, res) => res.redirect(req.user ? HOME_BY_ROLE[req.user.role] : '/login'));

  app.get('/login', (req, res) => {
    if (req.user) return res.redirect(HOME_BY_ROLE[req.user.role]);
    page(res, 'Log in', views.loginPage());
  });

  app.post('/login', async (req, res) => {
    const emailAddress = normalizeEmail(req.body.email);
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [emailAddress]);
    const user = rows[0];
    if (!user || !verifyPassword(String(req.body.password ?? ''), user.password_hash)) {
      return page(res, 'Log in', views.loginPage({ error: 'Invalid email or password.', email: emailAddress }), 401);
    }
    signIn(res, user);
    res.redirect(HOME_BY_ROLE[user.role]);
  });

  app.post('/logout', (req, res) => {
    signOut(res);
    res.redirect('/login');
  });

  // ---- Superadmin: manage leaders ---------------------------------------

  const listLeaders = async () =>
    (
      await db.query(
        `SELECT u.id, u.name, u.email, t.name AS team_name
           FROM users u LEFT JOIN teams t ON t.id = u.team_id
          WHERE u.role = 'leader' ORDER BY u.id`,
      )
    ).rows;

  app.get('/admin', requireRole('superadmin'), async (req, res) => {
    page(res, 'Leaders', views.adminPage({ leaders: await listLeaders(), notice: req.query.notice }));
  });

  app.post('/admin/leaders', requireRole('superadmin'), async (req, res) => {
    const name = String(req.body.name ?? '').trim();
    const emailAddress = normalizeEmail(req.body.email);
    const password = String(req.body.password ?? '');
    const fail = async (error) =>
      page(res, 'Leaders', views.adminPage({ leaders: await listLeaders(), error }), 400);

    if (!name || !emailAddress || !password) return fail('Name, email and password are required.');

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const team = await client.query('INSERT INTO teams (name) VALUES ($1) RETURNING id', [`${name}'s team`]);
      await client.query(
        `INSERT INTO users (email, name, password_hash, role, team_id) VALUES ($1, $2, $3, 'leader', $4)`,
        [emailAddress, name, hashPassword(password), team.rows[0].id],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      if (isUniqueViolation(err)) return fail('A user with that email already exists.');
      throw err;
    } finally {
      client.release();
    }
    res.redirect(`/admin?notice=${encodeURIComponent(`Leader ${name} created.`)}`);
  });

  app.post('/admin/leaders/:id/delete', requireRole('superadmin'), async (req, res) => {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `DELETE FROM users WHERE id = $1 AND role = 'leader' RETURNING name, team_id`,
        [Number(req.params.id)],
      );
      // Removing a leader removes their team (and pending invitations); members stay but lose the team.
      if (rows[0]?.team_id) await client.query('DELETE FROM teams WHERE id = $1', [rows[0].team_id]);
      await client.query('COMMIT');
      const notice = rows[0] ? `Leader ${rows[0].name} removed.` : 'Leader not found.';
      res.redirect(`/admin?notice=${encodeURIComponent(notice)}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ---- Leader: team, invitations, progress ------------------------------

  const teamMembers = async (teamId) =>
    (
      await db.query(
        `SELECT u.id, u.name, u.email, count(s.step_key)::int AS completed
           FROM users u LEFT JOIN onboarding_steps s ON s.user_id = u.id
          WHERE u.team_id = $1 AND u.role = 'member'
          GROUP BY u.id ORDER BY u.id`,
        [teamId],
      )
    ).rows;

  const renderTeam = async (req, res, { error, notice, status } = {}) => {
    const teamId = req.user.team_id;
    const team = (await db.query('SELECT * FROM teams WHERE id = $1', [teamId])).rows[0];
    const invitations = (
      await db.query('SELECT email, accepted_at FROM invitations WHERE team_id = $1 ORDER BY id', [teamId])
    ).rows;
    page(
      res,
      'My team',
      views.teamPage({ team, members: await teamMembers(teamId), invitations, error, notice }),
      status,
    );
  };

  app.get('/team', requireRole('leader'), (req, res) => renderTeam(req, res, { notice: req.query.notice }));

  app.get('/team/progress', requireRole('leader'), async (req, res) => {
    const members = await teamMembers(req.user.team_id);
    res.json({
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        completed: m.completed,
        total: ONBOARDING_STEPS.length,
        progress: `${m.completed}/${ONBOARDING_STEPS.length}`,
        status: progressLabel(m.completed),
      })),
    });
  });

  app.post('/team/invitations', requireRole('leader'), async (req, res) => {
    const emailAddress = normalizeEmail(req.body.email);
    if (!emailAddress) return renderTeam(req, res, { error: 'Email is required.', status: 400 });

    const existing = await db.query('SELECT 1 FROM users WHERE email = $1', [emailAddress]);
    if (existing.rowCount) {
      return renderTeam(req, res, { error: 'A user with that email already exists.', status: 400 });
    }

    const token = crypto.randomBytes(32).toString('hex');
    await db.query('INSERT INTO invitations (team_id, email, token, invited_by) VALUES ($1, $2, $3, $4)', [
      req.user.team_id,
      emailAddress,
      token,
      req.user.id,
    ]);

    const link = `${req.protocol}://${req.get('host')}/invite/${token}`;
    await email.send({
      to: emailAddress,
      subject: `${req.user.name} invited you to Onboard`,
      text: `${req.user.name} has invited you to join their team on Onboard.\n\nCreate your account: ${link}\n`,
      html: views.html`<p>${req.user.name} has invited you to join their team on Onboard.</p>
        <p><a href="${link}">Accept invitation</a></p>`.value,
    });
    res.redirect(`/team?notice=${encodeURIComponent(`Invitation sent to ${emailAddress}.`)}`);
  });

  // ---- Invitation acceptance --------------------------------------------

  const findOpenInvitation = async (token) =>
    (
      await db.query(
        `SELECT i.*, t.name AS team_name FROM invitations i JOIN teams t ON t.id = i.team_id
          WHERE i.token = $1 AND i.accepted_at IS NULL`,
        [token],
      )
    ).rows[0];

  app.get('/invite/:token', async (req, res) => {
    const invitation = await findOpenInvitation(req.params.token);
    if (!invitation) return page(res, 'Invitation', views.messagePage('Invitation not found', 'This invitation is invalid or has already been used.'), 404);
    page(res, 'Join team', views.acceptInvitePage({ invitation }));
  });

  app.post('/invite/:token', async (req, res) => {
    const invitation = await findOpenInvitation(req.params.token);
    if (!invitation) return page(res, 'Invitation', views.messagePage('Invitation not found', 'This invitation is invalid or has already been used.'), 404);

    const name = String(req.body.name ?? '').trim();
    const password = String(req.body.password ?? '');
    if (!name || !password) {
      return page(res, 'Join team', views.acceptInvitePage({ invitation, error: 'Name and password are required.' }), 400);
    }

    const client = await db.connect();
    let user;
    try {
      await client.query('BEGIN');
      user = (
        await client.query(
          `INSERT INTO users (email, name, password_hash, role, team_id)
           VALUES ($1, $2, $3, 'member', $4) RETURNING *`,
          [invitation.email, name, hashPassword(password), invitation.team_id],
        )
      ).rows[0];
      await client.query('UPDATE invitations SET accepted_at = now(), accepted_user_id = $1 WHERE id = $2', [
        user.id,
        invitation.id,
      ]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      if (isUniqueViolation(err)) {
        return page(res, 'Join team', views.acceptInvitePage({ invitation, error: 'An account with this email already exists.' }), 400);
      }
      throw err;
    } finally {
      client.release();
    }
    signIn(res, user);
    res.redirect('/onboarding');
  });

  // ---- Member: onboarding -------------------------------------------------

  const completedSteps = async (userId) =>
    new Set((await db.query('SELECT step_key FROM onboarding_steps WHERE user_id = $1', [userId])).rows.map((r) => r.step_key));

  app.get('/onboarding', requireRole('member'), async (req, res) => {
    const team = (await db.query('SELECT * FROM teams WHERE id = $1', [req.user.team_id])).rows[0];
    page(res, 'Onboarding', views.onboardingPage({ user: req.user, team, completedKeys: await completedSteps(req.user.id) }));
  });

  app.post('/onboarding/steps/:key', requireRole('member'), async (req, res) => {
    const { key } = req.params;
    if (!isStepKey(key)) return res.status(404).json({ error: 'Unknown step' });
    if (req.body.completed) {
      await db.query('INSERT INTO onboarding_steps (user_id, step_key) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.user.id, key]);
    } else {
      await db.query('DELETE FROM onboarding_steps WHERE user_id = $1 AND step_key = $2', [req.user.id, key]);
    }
    res.json({ completed: (await completedSteps(req.user.id)).size, total: ONBOARDING_STEPS.length });
  });

  // ---- Fake mailbox (dev/test only) -------------------------------------

  if (config.enableDevMailbox) {
    app.get('/dev/mailbox', (req, res) => page(res, 'Mailbox', views.mailboxPage({ emails: email.sent })));
    app.get('/dev/mailbox.json', (req, res) => res.json(email.sent));
    app.delete('/dev/mailbox', (req, res) => {
      email.clear();
      res.status(204).end();
    });
  }

  app.use((err, req, res, _next) => {
    console.error(err);
    res.status(500).send('Something went wrong.');
  });

  return app;
}
