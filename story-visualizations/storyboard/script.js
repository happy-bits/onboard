/* Storyboard built directly from the UI steps and assertions in
   tests/superadmin.spec.ts and tests/onboarding.spec.ts. Plain DOM,
   no external libraries. */

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function renderElements(body, elements) {
  elements.forEach((item) => {
    if (item.type === "heading") {
      body.appendChild(el("div", "mock-heading", item.text));
    } else if (item.type === "text") {
      const t = el("div", "mock-text");
      const strong = el("strong", null, item.text);
      t.appendChild(strong);
      body.appendChild(t);
    } else if (item.type === "field") {
      const wrap = el("div", "mock-field");
      wrap.appendChild(el("span", "mock-field-label", item.label));
      wrap.appendChild(el("span", "mock-field-box"));
      body.appendChild(wrap);
    } else if (item.type === "button") {
      body.appendChild(el("div", "mock-button", item.text));
    } else if (item.type === "list") {
      const wrap = el("div", "mock-list");
      wrap.appendChild(el("div", "mock-list-title", item.testid));
      if (item.items.length === 0) {
        wrap.appendChild(el("div", "mock-list-row empty", "(empty)"));
      } else {
        item.items.forEach((row) => {
          const r = el("div", "mock-list-row");
          r.appendChild(el("span", null, row.label));
          if (row.right) {
            r.appendChild(el("span", row.highlight ? "progress" : "", row.right));
          }
          wrap.appendChild(r);
        });
      }
      body.appendChild(wrap);
    } else if (item.type === "emailList") {
      const wrap = el("div", "mock-list");
      wrap.appendChild(el("div", "mock-list-title", "Email"));
      item.items.forEach((row) => {
        const r = el("div", "mock-list-row");
        const left = el("span", null, `${row.to}`);
        r.appendChild(left);
        r.appendChild(el("span", row.highlighted ? "highlight" : "", row.token));
        wrap.appendChild(r);
      });
      body.appendChild(wrap);
    } else if (item.type === "checklist") {
      const wrap = el("div", "mock-checklist");
      item.items.forEach((row) => {
        const r = el("div", `mock-check-row${row.checked ? " checked" : ""}`);
        const box = el("span", "box", row.checked ? "✓" : "");
        r.appendChild(box);
        r.appendChild(el("span", null, row.label));
        wrap.appendChild(r);
      });
      body.appendChild(wrap);
    }
  });
}

function buildFrame(frameData) {
  const block = el("div", "frame-block");
  const badgeRow = el("div", "badge-row");
  badgeRow.appendChild(el("span", `actor-tag ${frameData.actor.toLowerCase()}`, frameData.actor));
  block.appendChild(badgeRow);

  const frame = el("div", "browser-frame");
  const bar = el("div", "frame-bar");
  const dots = el("div", "frame-dots");
  dots.appendChild(el("span"));
  dots.appendChild(el("span"));
  dots.appendChild(el("span"));
  bar.appendChild(dots);
  bar.appendChild(el("div", "frame-url", frameData.route));
  frame.appendChild(bar);

  const body = el("div", "frame-body");
  renderElements(body, frameData.elements);
  frame.appendChild(body);

  block.appendChild(frame);
  return block;
}

function renderBoard(container, story) {
  container.innerHTML = "";
  const board = el("div", "board");

  story.panels.forEach((panel, i) => {
    if (panel.type === "single") {
      const cell = el("div", "cell");
      const badgeRow = el("div", "badge-row");
      badgeRow.appendChild(el("span", "step-badge", String(i + 1)));
      cell.appendChild(badgeRow);
      cell.appendChild(buildFrame(panel));
      cell.appendChild(el("div", "caption", panel.caption));
      board.appendChild(cell);
    } else if (panel.type === "pair") {
      const cell = el("div", "cell span-2");
      const badgeRow = el("div", "badge-row");
      badgeRow.appendChild(el("span", "step-badge", String(i + 1)));
      cell.appendChild(badgeRow);

      const row = el("div", "pair-row");
      row.appendChild(buildFrame(panel.left));
      const connector = el("div", "connector");
      connector.appendChild(el("span", "bolt", "⚡"));
      connector.appendChild(el("span", null, panel.connector));
      row.appendChild(connector);
      row.appendChild(buildFrame(panel.right));
      cell.appendChild(row);

      cell.appendChild(el("div", "caption", panel.caption));
      board.appendChild(cell);
    }
  });

  const summary = el("div", "db-summary");
  summary.appendChild(el("div", "title", story.dbSummary.title));
  const ul = el("ul");
  story.dbSummary.lines.forEach((line) => ul.appendChild(el("li", null, line)));
  summary.appendChild(ul);
  board.appendChild(summary);

  container.appendChild(board);
}

const STORY_1 = {
  panels: [
    {
      type: "single",
      actor: "Superadmin",
      route: "/login",
      elements: [
        { type: "field", label: "Email" },
        { type: "field", label: "Password" },
        { type: "button", text: "Log in" },
      ],
      caption: 'A user opens the login page and signs in as admin@onboard.local / admin123.',
    },
    {
      type: "single",
      actor: "Superadmin",
      route: "/superadmin",
      elements: [
        { type: "heading", text: "Superadmin" },
        { type: "field", label: "Email" },
        { type: "field", label: "Password" },
        { type: "button", text: "Create" },
        { type: "list", testid: "leader-list", items: [] },
      ],
      caption: 'She lands on a page headed "Superadmin", with an empty leader list.',
    },
    {
      type: "single",
      actor: "Superadmin",
      route: "/superadmin",
      elements: [
        { type: "heading", text: "Superadmin" },
        { type: "field", label: "Email" },
        { type: "field", label: "Password" },
        { type: "button", text: "Create" },
        { type: "list", testid: "leader-list", items: [{ label: "leader1@onboard.local" }] },
      ],
      caption: "She enters leader1@onboard.local / leader1pass and clicks Create — it appears in the list.",
    },
    {
      type: "single",
      actor: "Superadmin",
      route: "/superadmin",
      elements: [
        { type: "heading", text: "Superadmin" },
        { type: "field", label: "Email" },
        { type: "field", label: "Password" },
        { type: "button", text: "Create" },
        {
          type: "list",
          testid: "leader-list",
          items: [{ label: "leader1@onboard.local" }, { label: "leader2@onboard.local" }],
        },
      ],
      caption: "She repeats this for leader2@onboard.local / leader2pass.",
    },
  ],
  dbSummary: {
    title: 'dumpDatabase("test1") →',
    lines: [
      "3 users (1 superadmin + 2 leaders)",
      "2 teams (Team leader1@onboard.local, Team leader2@onboard.local)",
      "1 session (the superadmin's)",
      "0 invitations, 0 onboarding progress, 0 emails",
    ],
  },
};

const STORY_2 = {
  panels: [
    {
      type: "single",
      actor: "Leader",
      route: "/login",
      elements: [
        { type: "field", label: "Email" },
        { type: "field", label: "Password" },
        { type: "button", text: "Log in" },
      ],
      caption: "The leader logs in as leader@onboard.local / leader123.",
    },
    {
      type: "single",
      actor: "Leader",
      route: "/leader",
      elements: [
        { type: "heading", text: "Team leader@onboard.local" },
        { type: "field", label: "Email to invite" },
        { type: "button", text: "Invite" },
        { type: "list", testid: "invitation-list", items: [] },
      ],
      caption: "She lands on her dashboard, headed with her team's name.",
    },
    {
      type: "single",
      actor: "Leader",
      route: "/leader",
      elements: [
        { type: "heading", text: "Team leader@onboard.local" },
        { type: "field", label: "Email to invite" },
        { type: "button", text: "Invite" },
        { type: "list", testid: "invitation-list", items: [{ label: "member1@onboard.local" }] },
      ],
      caption: "She invites member1@onboard.local; it appears in the invitation list.",
    },
    {
      type: "single",
      actor: "Leader",
      route: "/leader",
      elements: [
        { type: "heading", text: "Team leader@onboard.local" },
        { type: "field", label: "Email to invite" },
        { type: "button", text: "Invite" },
        {
          type: "list",
          testid: "invitation-list",
          items: [{ label: "member1@onboard.local" }, { label: "member2@onboard.local" }],
        },
      ],
      caption: "She invites member2@onboard.local too. Each invite also sent an email.",
    },
    {
      type: "single",
      actor: "Member",
      route: "/dev/inbox",
      elements: [
        { type: "heading", text: "Dev inbox" },
        {
          type: "emailList",
          items: [
            { to: "member1@onboard.local", token: "invite-token-1", highlighted: true },
            { to: "member2@onboard.local", token: "invite-token-2", highlighted: false },
          ],
        },
      ],
      caption: 'A separate user opens the dev inbox and finds the email body containing "invite-token-1".',
    },
    {
      type: "single",
      actor: "Member",
      route: "/invite/invite-token-1",
      elements: [
        { type: "heading", text: "Join Team leader@onboard.local" },
        { type: "field", label: "Choose a password" },
        { type: "button", text: "Create account" },
      ],
      caption: "Following the link, she's asked to set a password (member1pass).",
    },
    {
      type: "single",
      actor: "Member",
      route: "/onboarding",
      elements: [
        { type: "heading", text: "Your onboarding" },
        { type: "text", text: "0/3 steps completed" },
        {
          type: "checklist",
          items: [
            { label: "step1", checked: false },
            { label: "step2", checked: false },
            { label: "step3", checked: false },
          ],
        },
      ],
      caption: 'Account created — she lands on a page headed "Your onboarding".',
    },
    {
      type: "pair",
      connector: "SSE push — no reload",
      left: {
        actor: "Member",
        route: "/onboarding",
        elements: [
          { type: "heading", text: "Your onboarding" },
          { type: "text", text: "0/3 steps completed" },
        ],
      },
      right: {
        actor: "Leader",
        route: "/leader",
        elements: [
          { type: "heading", text: "Team leader@onboard.local" },
          {
            type: "list",
            testid: "progress-member1@onboard.local",
            items: [{ label: "member1@onboard.local", right: "0/3", highlight: true }],
          },
        ],
      },
      caption: "The moment the account is created, the member shows up on the leader's still-open dashboard.",
    },
    {
      type: "pair",
      connector: "SSE push — no reload",
      left: {
        actor: "Member",
        route: "/onboarding",
        elements: [
          { type: "heading", text: "Your onboarding" },
          {
            type: "checklist",
            items: [
              { label: "step1", checked: true },
              { label: "step2", checked: false },
              { label: "step3", checked: false },
            ],
          },
        ],
      },
      right: {
        actor: "Leader",
        route: "/leader",
        elements: [
          { type: "heading", text: "Team leader@onboard.local" },
          {
            type: "list",
            testid: "progress-member1@onboard.local",
            items: [{ label: "member1@onboard.local", right: "1/3", highlight: true }],
          },
        ],
      },
      caption: "She checks step1; the leader's progress cell updates to 1/3 instantly.",
    },
    {
      type: "pair",
      connector: "SSE push — no reload",
      left: {
        actor: "Member",
        route: "/onboarding",
        elements: [
          { type: "heading", text: "Your onboarding" },
          {
            type: "checklist",
            items: [
              { label: "step1", checked: true },
              { label: "step2", checked: true },
              { label: "step3", checked: false },
            ],
          },
        ],
      },
      right: {
        actor: "Leader",
        route: "/leader",
        elements: [
          { type: "heading", text: "Team leader@onboard.local" },
          {
            type: "list",
            testid: "progress-member1@onboard.local",
            items: [{ label: "member1@onboard.local", right: "2/3", highlight: true }],
          },
        ],
      },
      caption: "She checks step2; progress updates to 2/3.",
    },
    {
      type: "pair",
      connector: "SSE push — no reload",
      left: {
        actor: "Member",
        route: "/onboarding",
        elements: [
          { type: "heading", text: "Your onboarding" },
          {
            type: "checklist",
            items: [
              { label: "step1", checked: true },
              { label: "step2", checked: true },
              { label: "step3", checked: true },
            ],
          },
        ],
      },
      right: {
        actor: "Leader",
        route: "/leader",
        elements: [
          { type: "heading", text: "Team leader@onboard.local" },
          {
            type: "list",
            testid: "progress-member1@onboard.local",
            items: [{ label: "member1@onboard.local", right: "3/3", highlight: true }],
          },
        ],
      },
      caption: "She checks step3; progress updates to 3/3.",
    },
  ],
  dbSummary: {
    title: 'dumpDatabase("test2") →',
    lines: [
      "3 users, 1 team (Team leader@onboard.local)",
      "2 invitations: member1's used, member2's still pending",
      "1 onboardingProgress row, all three steps true",
      "2 sessions (leader + member1), 2 emails",
    ],
  },
};

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
  renderBoard(document.getElementById("board-1"), STORY_1);
  renderBoard(document.getElementById("board-2"), STORY_2);
  initTabs();
});
