/* Before/after database state diagrams, derived from:
   - the seed scenario each spec starts from (seedDatabase(...)), described
     in the accompanying story text, and
   - the exact dumpDatabase(...) assertion at the end of each spec.
   Rendered as plain HTML tables, no external libraries. */

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function fmt(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

function diffRows(before, after) {
  const beforeById = new Map(before.map((r) => [r.id, r]));
  return after.map((row) => {
    const prev = beforeById.get(row.id);
    if (!prev) return { row, status: "new", changed: [] };
    const changed = Object.keys(row).filter(
      (k) => JSON.stringify(row[k]) !== JSON.stringify(prev[k])
    );
    return { row, status: changed.length ? "changed" : "unchanged", changed };
  });
}

function buildTable(columns, rows, statusById) {
  const table = el("table");
  const thead = el("thead");
  const headRow = el("tr");
  columns.forEach((c) => headRow.appendChild(el("th", null, c.label)));
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = el("tbody");
  if (rows.length === 0) {
    table.remove();
    return el("div", "empty-note", "(no rows)");
  }

  rows.forEach((row) => {
    const info = statusById ? statusById.get(row.id) : null;
    const tr = el("tr", info ? `row-${info.status}` : "");
    columns.forEach((c) => tr.appendChild(el("td", null, fmt(row[c.key]))));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

function renderTableBlock(container, name, columns, before, after) {
  const diffs = diffRows(before, after);
  const statusById = new Map(diffs.map((d) => [d.row.id, d]));
  const newCount = diffs.filter((d) => d.status === "new").length;
  const changedCount = diffs.filter((d) => d.status === "changed").length;

  const block = el("div", "table-block");
  const head = el("div", "table-block-head");
  head.appendChild(el("h3", null, name));
  if (newCount) head.appendChild(el("span", "delta-badge new", `+${newCount} new`));
  if (changedCount) head.appendChild(el("span", "delta-badge changed", `${changedCount} changed`));
  if (!newCount && !changedCount) head.appendChild(el("span", "delta-badge none", "unchanged"));
  block.appendChild(head);

  const grid = el("div", "diff-grid");
  const beforeWrap = el("div");
  beforeWrap.appendChild(buildTable(columns, before, null));
  const afterWrap = el("div");
  afterWrap.appendChild(buildTable(columns, after, statusById));

  diffs
    .filter((d) => d.status === "changed")
    .forEach((d) => {
      const note = el(
        "div",
        "change-note",
        `id ${d.row.id}: ${d.changed.map((k) => `${k} → ${fmt(d.row[k])}`).join(", ")}`
      );
      afterWrap.appendChild(note);
    });

  grid.appendChild(beforeWrap);
  grid.appendChild(afterWrap);
  block.appendChild(grid);
  container.appendChild(block);
}

const usersCols = [
  { key: "id", label: "id" },
  { key: "email", label: "email" },
  { key: "role", label: "role" },
  { key: "teamId", label: "teamId" },
];
const teamsCols = [
  { key: "id", label: "id" },
  { key: "name", label: "name" },
  { key: "leaderId", label: "leaderId" },
];
const invitationsCols = [
  { key: "id", label: "id" },
  { key: "email", label: "email" },
  { key: "token", label: "token" },
  { key: "teamId", label: "teamId" },
  { key: "usedAt", label: "usedAt" },
];
const progressCols = [
  { key: "id", label: "id" },
  { key: "userId", label: "userId" },
  { key: "step1", label: "step1" },
  { key: "step2", label: "step2" },
  { key: "step3", label: "step3" },
];
const sessionsCols = [
  { key: "id", label: "id" },
  { key: "token", label: "token" },
  { key: "userId", label: "userId" },
];
const emailsCols = [
  { key: "id", label: "id" },
  { key: "to", label: "to" },
  { key: "subject", label: "subject" },
];

const STORY_1 = {
  before: {
    label: 'Before — seedDatabase("superadmin")',
    users: [{ id: 1, email: "admin@onboard.local", role: "SUPERADMIN", teamId: null }],
    teams: [],
    invitations: [],
    progress: [],
    sessions: [],
    emails: [],
  },
  after: {
    label: 'After — dumpDatabase("test1")',
    users: [
      { id: 1, email: "admin@onboard.local", role: "SUPERADMIN", teamId: null },
      { id: 2, email: "leader1@onboard.local", role: "LEADER", teamId: null },
      { id: 3, email: "leader2@onboard.local", role: "LEADER", teamId: null },
    ],
    teams: [
      { id: 1, name: "Team leader1@onboard.local", leaderId: 2 },
      { id: 2, name: "Team leader2@onboard.local", leaderId: 3 },
    ],
    invitations: [],
    progress: [],
    sessions: [{ id: 1, token: "session-token-1", userId: 1 }],
    emails: [],
  },
};

const STORY_2 = {
  before: {
    label: 'Before — seedDatabase("superadmin+leader")',
    users: [
      { id: 1, email: "admin@onboard.local", role: "SUPERADMIN", teamId: null },
      { id: 2, email: "leader@onboard.local", role: "LEADER", teamId: null },
    ],
    teams: [{ id: 1, name: "Team leader@onboard.local", leaderId: 2 }],
    invitations: [],
    progress: [],
    sessions: [],
    emails: [],
  },
  after: {
    label: 'After — dumpDatabase("test2")',
    users: [
      { id: 1, email: "admin@onboard.local", role: "SUPERADMIN", teamId: null },
      { id: 2, email: "leader@onboard.local", role: "LEADER", teamId: null },
      { id: 3, email: "member1@onboard.local", role: "MEMBER", teamId: 1 },
    ],
    teams: [{ id: 1, name: "Team leader@onboard.local", leaderId: 2 }],
    invitations: [
      { id: 1, email: "member1@onboard.local", token: "invite-token-1", teamId: 1, usedAt: "2026-01-01T00:00:00Z" },
      { id: 2, email: "member2@onboard.local", token: "invite-token-2", teamId: 1, usedAt: null },
    ],
    progress: [{ id: 1, userId: 3, step1: true, step2: true, step3: true }],
    sessions: [
      { id: 1, token: "session-token-1", userId: 2 },
      { id: 2, token: "session-token-2", userId: 3 },
    ],
    emails: [
      { id: 1, to: "member1@onboard.local", subject: "You have been invited to onboard" },
      { id: 2, to: "member2@onboard.local", subject: "You have been invited to onboard" },
    ],
  },
};

function renderStory(container, story) {
  container.innerHTML = "";

  const labels = el("div", "stage-labels");
  labels.appendChild(el("div", null, story.before.label));
  labels.appendChild(el("div", null, story.after.label));
  container.appendChild(labels);

  renderTableBlock(container, "users", usersCols, story.before.users, story.after.users);
  renderTableBlock(container, "teams", teamsCols, story.before.teams, story.after.teams);
  renderTableBlock(container, "invitations", invitationsCols, story.before.invitations, story.after.invitations);
  renderTableBlock(container, "onboardingProgress", progressCols, story.before.progress, story.after.progress);
  renderTableBlock(container, "sessions", sessionsCols, story.before.sessions, story.after.sessions);
  renderTableBlock(container, "emails", emailsCols, story.before.emails, story.after.emails);
}

function initTabs() {
  const tabs = document.querySelectorAll(".tab");
  const panels = document.querySelectorAll(".panel");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      panels.forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.panel).classList.add("active");
    });
  });
}

window.addEventListener("DOMContentLoaded", () => {
  renderStory(document.getElementById("board-1"), STORY_1);
  renderStory(document.getElementById("board-2"), STORY_2);
  initTabs();
});
