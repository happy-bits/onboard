import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';

import { all, one, pool, query } from './db.js';
import { now } from './clock.js';
import {
  attachUser,
  createSession,
  destroySession,
  clearSessions,
  hashPassword,
  homePathFor,
  requireRole,
  verifyPassword,
} from './auth.js';
import { ONBOARDING_STEPS, TOTAL_STEPS, isStepKey } from './onboarding.js';
import { claimInvitation, createInvitation, pendingInvitations } from './invitations.js';
import { dumpDatabase } from './dump.js';
import { listEmails } from './email.js';
import { resetDatabase } from './seed.js';

const SRC = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(SRC, 'views'));
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());
  app.use(attachUser);

  const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

  // ---------------------------------------------------------------- auth

  app.get('/', (req, res) => res.redirect(homePathFor(req.user)));

  app.get('/login', (req, res) => {
    if (req.user) return res.redirect(homePathFor(req.user));
    return res.render('login', { error: null, notice: req.query.notice ?? null, email: '' });
  });

  app.post(
    '/login',
    wrap(async (req, res) => {
      const email = String(req.body.email || '').trim().toLowerCase();
      const password = String(req.body.password || '');
      const user = await one('SELECT * FROM users WHERE email = $1', [email]);
      if (!user || !verifyPassword(user, password)) {
        return res.status(401).render('login', {
          error: 'Wrong email or password.',
          notice: null,
          email,
        });
      }
      createSession(res, user.id);
      return res.redirect(homePathFor(user));
    }),
  );

  app.post('/logout', (req, res) => {
    destroySession(req, res);
    res.redirect('/login');
  });

  // ----------------------------------------------------------- superadmin

  app.get(
    '/admin/leaders',
    requireRole('superadmin'),
    wrap(async (req, res) => {
      const leaders = await all(
        `SELECT u.id, u.email, t.id AS team_id, t.name AS team_name,
                (SELECT count(*)::int FROM users m WHERE m.team_id = t.id) AS member_count
           FROM users u
           LEFT JOIN teams t ON t.leader_id = u.id
          WHERE u.role = 'leader'
          ORDER BY u.id`,
      );
      res.render('admin-leaders', { leaders, error: req.query.error ?? null });
    }),
  );

  app.post(
    '/admin/leaders',
    requireRole('superadmin'),
    wrap(async (req, res) => {
      const email = String(req.body.email || '').trim().toLowerCase();
      const password = String(req.body.password || '');
      if (!email || !password) {
        return res.redirect('/admin/leaders?error=Email+and+password+are+required.');
      }
      const existing = await one('SELECT id FROM users WHERE email = $1', [email]);
      if (existing) {
        return res.redirect('/admin/leaders?error=That+email+is+already+in+use.');
      }
      const leader = await one(
        `INSERT INTO users (email, password_hash, role, created_at)
         VALUES ($1, $2, 'leader', $3) RETURNING id`,
        [email, hashPassword(email, password), now()],
      );
      // A Leader gets exactly one team (MVP constraint).
      await query('INSERT INTO teams (name, leader_id, created_at) VALUES ($1, $2, $3)', [
        `${email}'s team`,
        leader.id,
        now(),
      ]);
      return res.redirect('/admin/leaders');
    }),
  );

  app.post(
    '/admin/leaders/:id/delete',
    requireRole('superadmin'),
    wrap(async (req, res) => {
      // Cascades to the team, its Members, their progress and its invitations.
      // See the comment block at the top of schema.sql.
      await query(`DELETE FROM users WHERE id = $1 AND role = 'leader'`, [Number(req.params.id)]);
      res.redirect('/admin/leaders');
    }),
  );

  // --------------------------------------------------------------- leader

  app.get(
    '/team',
    requireRole('leader'),
    wrap(async (req, res) => {
      const team = await one('SELECT * FROM teams WHERE leader_id = $1', [req.user.id]);
      if (!team) return res.status(404).render('error', { message: 'You have no team yet.' });

      const members = await all(
        `SELECT u.id, u.email,
                (SELECT count(*)::int FROM onboarding_progress p WHERE p.user_id = u.id) AS completed
           FROM users u
          WHERE u.team_id = $1 AND u.role = 'member'
          ORDER BY u.id`,
        [team.id],
      );
      const memberSteps = new Map();
      for (const member of members) {
        const rows = await all(
          'SELECT step_key FROM onboarding_progress WHERE user_id = $1',
          [member.id],
        );
        memberSteps.set(member.id, new Set(rows.map((r) => r.step_key)));
      }

      res.render('team', {
        team,
        members,
        memberSteps,
        steps: ONBOARDING_STEPS,
        totalSteps: TOTAL_STEPS,
        invitations: await pendingInvitations(team.id),
        error: req.query.error ?? null,
        notice: req.query.notice ?? null,
      });
    }),
  );

  app.post(
    '/team/invites',
    requireRole('leader'),
    wrap(async (req, res) => {
      const team = await one('SELECT * FROM teams WHERE leader_id = $1', [req.user.id]);
      if (!team) return res.status(404).render('error', { message: 'You have no team yet.' });

      const email = String(req.body.email || '').trim().toLowerCase();
      if (!email) return res.redirect('/team?error=An+email+address+is+required.');

      const existingUser = await one('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser) return res.redirect('/team?error=That+person+already+has+an+account.');

      const alreadyInvited = await one(
        `SELECT id FROM invitations WHERE team_id = $1 AND email = $2 AND status = 'pending'`,
        [team.id, email],
      );
      if (alreadyInvited) return res.redirect('/team?error=That+person+is+already+invited.');

      await createInvitation({ teamId: team.id, email, baseUrl: baseUrlOf(req) });
      return res.redirect(`/team?notice=Invitation+sent+to+${encodeURIComponent(email)}`);
    }),
  );

  // ----------------------------------------------------------- invitation

  app.get(
    '/invite/:token',
    wrap(async (req, res) => {
      const invitation = await one('SELECT * FROM invitations WHERE token = $1', [
        req.params.token,
      ]);
      if (!invitation || invitation.status !== 'pending') {
        return res
          .status(410)
          .render('invite-unavailable', { used: Boolean(invitation) });
      }
      return res.render('invite-accept', { invitation, error: null });
    }),
  );

  app.post(
    '/invite/:token',
    wrap(async (req, res) => {
      const invitation = await one('SELECT * FROM invitations WHERE token = $1', [
        req.params.token,
      ]);
      if (!invitation || invitation.status !== 'pending') {
        return res
          .status(410)
          .render('invite-unavailable', { used: Boolean(invitation) });
      }

      const password = String(req.body.password || '');
      if (password.length < 8) {
        return res.status(400).render('invite-accept', {
          invitation,
          error: 'Please choose a password of at least 8 characters.',
        });
      }

      // Consume the invitation and create the account atomically, so the link
      // cannot be redeemed twice even under concurrent requests.
      const client = await pool.connect();
      let member;
      try {
        await client.query('BEGIN');
        const claimed = await claimInvitation(client, invitation.id);
        if (!claimed) {
          await client.query('ROLLBACK');
          return res.status(410).render('invite-unavailable', { used: true });
        }
        const inserted = await client.query(
          `INSERT INTO users (email, password_hash, role, team_id, created_at)
           VALUES ($1, $2, 'member', $3, $4) RETURNING *`,
          [
            invitation.email,
            hashPassword(invitation.email, password),
            invitation.team_id,
            now(),
          ],
        );
        member = inserted.rows[0];
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      createSession(res, member.id);
      return res.redirect('/onboarding');
    }),
  );

  // --------------------------------------------------------------- member

  app.get(
    '/onboarding',
    requireRole('member'),
    wrap(async (req, res) => {
      const done = new Set(
        (
          await all('SELECT step_key FROM onboarding_progress WHERE user_id = $1', [req.user.id])
        ).map((r) => r.step_key),
      );
      res.render('onboarding', { steps: ONBOARDING_STEPS, done, totalSteps: TOTAL_STEPS });
    }),
  );

  app.post(
    '/onboarding/steps/:key',
    requireRole('member'),
    wrap(async (req, res) => {
      const key = req.params.key;
      if (!isStepKey(key)) return res.status(404).render('error', { message: 'Unknown step.' });

      // The form ships a hidden "off" before the checkbox's "on", so an
      // unchecked box still posts a value. The last value wins.
      const raw = req.body.checked;
      const checked = (Array.isArray(raw) ? raw.at(-1) : raw) === 'on';

      if (checked) {
        // ON CONFLICT keeps this idempotent — one row per (user, step), ever.
        await query(
          `INSERT INTO onboarding_progress (user_id, step_key, completed_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, step_key) DO NOTHING`,
          [req.user.id, key, now()],
        );
      } else {
        await query('DELETE FROM onboarding_progress WHERE user_id = $1 AND step_key = $2', [
          req.user.id,
          key,
        ]);
      }
      return res.redirect('/onboarding');
    }),
  );

  // -------------------------------------------------- test support (opt-in)

  if (process.env.ONBOARD_TEST_SUPPORT === '1') {
    app.post(
      '/__test/reset',
      wrap(async (req, res) => {
        const seed = String(req.query.seed || req.body?.seed || 'base');
        clearSessions();
        await resetDatabase(seed);
        res.json({ ok: true, seed });
      }),
    );

    app.get('/__test/dump', wrap(async (req, res) => res.json(await dumpDatabase())));
    app.get('/__test/emails', (req, res) => res.json(listEmails()));
  }

  // ------------------------------------------------------------- fallback

  app.use((req, res) => res.status(404).render('error', { message: 'Page not found.' }));

  app.use((err, req, res, _next) => {
    console.error(err);
    res.status(500).render('error', { message: 'Something went wrong.' });
  });

  return app;
}

function baseUrlOf(req) {
  return process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
}
