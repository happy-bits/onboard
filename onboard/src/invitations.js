import crypto from 'node:crypto';
import { all, one } from './db.js';
import { now } from './clock.js';
import { sendEmail } from './email.js';

/**
 * Deterministic invitation token: derived from the invitation's own content
 * (team, email, and how many invitations that pair already has) rather than from
 * randomness or the clock, so seeds and dumps are reproducible.
 */
export function inviteToken(teamId, email, nth) {
  return crypto
    .createHash('sha256')
    .update(`onboard-invite:${teamId}:${email}:${nth}`)
    .digest('hex')
    .slice(0, 32);
}

export function inviteUrl(baseUrl, token) {
  return `${baseUrl}/invite/${token}`;
}

export async function createInvitation({ teamId, email, baseUrl }) {
  const { count } = await one(
    'SELECT count(*)::int AS count FROM invitations WHERE team_id = $1 AND email = $2',
    [teamId, email],
  );
  const token = inviteToken(teamId, email, count);
  const invitation = await one(
    `INSERT INTO invitations (email, token, team_id, status, created_at)
     VALUES ($1, $2, $3, 'pending', $4)
     RETURNING *`,
    [email, token, teamId, now()],
  );

  const url = inviteUrl(baseUrl, token);
  sendEmail({
    to: email,
    subject: 'You have been invited to join a team on Onboard',
    text: `Hi!\n\nYou have been invited to join a team on Onboard.\n\nAccept your invitation: ${url}\n`,
  });

  return { invitation, url };
}

/**
 * Atomically consume a pending invitation on the given client, which must be
 * inside a transaction. Returns the claimed row, or null if somebody else got
 * there first.
 *
 * The `AND status = 'pending'` predicate is what makes an invitation
 * single-use: a concurrent transaction blocks on this row's lock, then
 * re-evaluates the predicate against the committed value and matches nothing.
 * It lives here rather than inline in the route so that the atomicity can be
 * tested with two interleaved transactions — see
 * tests/integration/invitation-claim.spec.js.
 */
export async function claimInvitation(client, invitationId) {
  const { rows } = await client.query(
    `UPDATE invitations
        SET status = 'accepted', accepted_at = $2
      WHERE id = $1 AND status = 'pending'
      RETURNING *`,
    [invitationId, now()],
  );
  return rows[0] ?? null;
}

export function pendingInvitations(teamId) {
  return all(
    `SELECT * FROM invitations WHERE team_id = $1 AND status = 'pending' ORDER BY id`,
    [teamId],
  );
}
