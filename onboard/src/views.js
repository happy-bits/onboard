import { ONBOARDING_STEPS, progressLabel } from './onboarding.js';

class Safe {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

const escape = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const render = (v) => {
  if (v == null || v === false) return '';
  if (v instanceof Safe) return v.value;
  if (Array.isArray(v)) return v.map(render).join('');
  return escape(v);
};

/** Tagged template that HTML-escapes interpolated values. */
export const html = (strings, ...values) =>
  new Safe(strings.reduce((out, s, i) => out + s + (i < values.length ? render(values[i]) : ''), ''));

const STYLES = `
  :root { --fg:#1d2330; --muted:#5b6475; --bg:#f5f6f8; --card:#fff; --accent:#2f5bea; --danger:#c62828; --border:#dfe3ea; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui, -apple-system, Segoe UI, sans-serif; color:var(--fg); background:var(--bg); }
  header { display:flex; justify-content:space-between; align-items:center; padding:12px 24px; background:var(--card); border-bottom:1px solid var(--border); }
  header .brand { font-weight:700; color:var(--accent); text-decoration:none; }
  header form { display:inline; }
  main { max-width:760px; margin:32px auto; padding:0 16px; }
  .card { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:20px 24px; margin-bottom:20px; }
  h1 { font-size:1.5rem; margin-top:0; } h2 { font-size:1.15rem; margin-top:0; }
  label { display:block; margin:10px 0 4px; font-weight:500; }
  input[type=text], input[type=email], input[type=password] { width:100%; padding:8px 10px; border:1px solid var(--border); border-radius:6px; font-size:1rem; }
  button { margin-top:14px; padding:8px 16px; border:0; border-radius:6px; background:var(--accent); color:#fff; font-size:.95rem; cursor:pointer; }
  button.link { background:none; color:var(--accent); padding:0; margin:0; }
  button.danger { background:var(--danger); margin:0; padding:4px 10px; }
  table { width:100%; border-collapse:collapse; } th, td { text-align:left; padding:8px 6px; border-bottom:1px solid var(--border); }
  .muted { color:var(--muted); } .error { color:var(--danger); } .notice { color:#1b7f3b; }
  .steps label { display:flex; gap:10px; align-items:center; font-weight:400; padding:6px 0; }
  .steps input { width:18px; height:18px; }
  pre { white-space:pre-wrap; background:var(--bg); padding:10px; border-radius:6px; }
`;

export function layout({ title, user, body }) {
  return html`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} · Onboard</title>
  <style>${new Safe(STYLES)}</style>
</head>
<body>
  <header>
    <a class="brand" href="/">Onboard</a>
    ${user
      ? html`<span><span class="muted">${user.name} (${user.role})</span> &nbsp;
          <form method="post" action="/logout"><button class="link" type="submit">Log out</button></form></span>`
      : ''}
  </header>
  <main>${body}</main>
</body>
</html>`.value;
}

const flash = ({ error, notice }) => html`
  ${error ? html`<p class="error" role="alert">${error}</p>` : ''}
  ${notice ? html`<p class="notice" role="status">${notice}</p>` : ''}`;

export const loginPage = ({ error, email = '' } = {}) => html`
  <div class="card">
    <h1>Log in</h1>
    ${flash({ error })}
    <form method="post" action="/login">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" value="${email}" required>
      <label for="password">Password</label>
      <input id="password" name="password" type="password" required>
      <button type="submit">Log in</button>
    </form>
  </div>`;

export const adminPage = ({ leaders, error, notice }) => html`
  <div class="card">
    <h1>Leaders</h1>
    ${flash({ error, notice })}
    ${leaders.length
      ? html`<table aria-label="Leaders">
          <thead><tr><th>Name</th><th>Email</th><th>Team</th><th></th></tr></thead>
          <tbody>${leaders.map(
            (l) => html`<tr>
              <td>${l.name}</td><td>${l.email}</td><td>${l.team_name}</td>
              <td><form method="post" action="/admin/leaders/${l.id}/delete">
                <button class="danger" type="submit" aria-label="Remove ${l.name}">Remove</button>
              </form></td>
            </tr>`,
          )}</tbody>
        </table>`
      : html`<p class="muted">No leaders yet.</p>`}
  </div>
  <div class="card">
    <h2>Create leader</h2>
    <form method="post" action="/admin/leaders">
      <label for="name">Name</label>
      <input id="name" name="name" type="text" required>
      <label for="email">Email</label>
      <input id="email" name="email" type="email" required>
      <label for="password">Initial password</label>
      <input id="password" name="password" type="password" required>
      <button type="submit">Create leader</button>
    </form>
  </div>`;

export const teamPage = ({ team, members, invitations, error, notice }) => html`
  <div class="card">
    <h1>${team.name}</h1>
    <h2>Members</h2>
    ${members.length
      ? html`<table aria-label="Members">
          <thead><tr><th>Name</th><th>Email</th><th>Progress</th><th>Status</th></tr></thead>
          <tbody>${members.map(
            (m) => html`<tr data-member-id="${m.id}">
              <td>${m.name}</td><td>${m.email}</td>
              <td data-field="progress">${m.completed}/${ONBOARDING_STEPS.length}</td>
              <td data-field="status">${progressLabel(m.completed)}</td>
            </tr>`,
          )}</tbody>
        </table>`
      : html`<p class="muted">No members yet.</p>`}
  </div>
  <div class="card">
    <h2>Invite member</h2>
    ${flash({ error, notice })}
    <form method="post" action="/team/invitations">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" required>
      <button type="submit">Send invitation</button>
    </form>
  </div>
  <div class="card">
    <h2>Invitations</h2>
    ${invitations.length
      ? html`<table aria-label="Invitations">
          <thead><tr><th>Email</th><th>Status</th></tr></thead>
          <tbody>${invitations.map(
            (i) => html`<tr><td>${i.email}</td><td>${i.accepted_at ? 'Accepted' : 'Pending'}</td></tr>`,
          )}</tbody>
        </table>`
      : html`<p class="muted">No invitations sent.</p>`}
  </div>
  <script>
    // Keep member progress live while the leader has the page open.
    setInterval(async () => {
      const res = await fetch('/team/progress');
      if (!res.ok) return;
      const { members } = await res.json();
      if (members.some((m) => !document.querySelector('tr[data-member-id="' + m.id + '"]'))) {
        return location.reload();
      }
      for (const m of members) {
        const row = document.querySelector('tr[data-member-id="' + m.id + '"]');
        row.querySelector('[data-field=progress]').textContent = m.progress;
        row.querySelector('[data-field=status]').textContent = m.status;
      }
    }, 1000);
  </script>`;

export const onboardingPage = ({ user, completedKeys, team }) => html`
  <div class="card">
    <h1>Welcome, ${user.name}!</h1>
    <p class="muted">${team ? html`You are part of <strong>${team.name}</strong>. ` : ''}Complete the steps below to finish your onboarding.</p>
    <div class="steps">
      ${ONBOARDING_STEPS.map(
        (s) => html`<label>
          <input type="checkbox" name="${s.key}" ${completedKeys.has(s.key) ? html`checked` : ''}
                 onchange="toggleStep(this)"> ${s.label}
        </label>`,
      )}
    </div>
    <p id="onboarding-status" class="muted" aria-live="polite">${completedKeys.size}/${ONBOARDING_STEPS.length} completed</p>
  </div>
  <script>
    async function toggleStep(input) {
      input.disabled = true;
      const res = await fetch('/onboarding/steps/' + input.name, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: input.checked }),
      });
      const data = await res.json();
      document.getElementById('onboarding-status').textContent = data.completed + '/' + data.total + ' completed';
      input.disabled = false;
    }
  </script>`;

export const acceptInvitePage = ({ invitation, error }) => html`
  <div class="card">
    <h1>Join ${invitation.team_name}</h1>
    <p class="muted">Create your account to get started with your onboarding.</p>
    ${flash({ error })}
    <form method="post" action="/invite/${invitation.token}">
      <label for="email">Email</label>
      <input id="email" type="email" value="${invitation.email}" disabled>
      <label for="name">Your name</label>
      <input id="name" name="name" type="text" required>
      <label for="password">Password</label>
      <input id="password" name="password" type="password" required>
      <button type="submit">Create account</button>
    </form>
  </div>`;

export const messagePage = (title, message) => html`<div class="card"><h1>${title}</h1><p>${message}</p></div>`;

export const mailboxPage = ({ emails }) => html`
  <div class="card">
    <h1>Fake mailbox</h1>
    <p class="muted">Emails "sent" by the fake email service since the server started.</p>
  </div>
  ${emails.length
    ? [...emails].reverse().map(
        (e) => html`<article class="card" data-email-to="${e.to}">
          <h2>${e.subject}</h2>
          <p class="muted">To: ${e.to}</p>
          <div>${new Safe(e.html)}</div>
        </article>`,
      )
    : html`<p class="muted">No emails yet.</p>`}`;
