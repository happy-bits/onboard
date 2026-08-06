/* Sequence diagrams built directly from the assertions and UI steps in
   tests/superadmin.spec.ts and tests/onboarding.spec.ts. No external
   libraries — plain SVG generated at runtime. */

const SVGNS = "http://www.w3.org/2000/svg";

const STORY_1 = {
  title: "Superadmin creates two leaders",
  source: "tests/superadmin.spec.ts",
  actors: [
    { id: "browser", label: "Superadmin Browser", color: "var(--browser)" },
    { id: "server", label: "Server", color: "var(--server)" },
    { id: "db", label: "Database", color: "var(--db)" },
  ],
  messages: [
    { type: "call", from: "browser", to: "server", lines: ["GET /login"] },
    { type: "return", from: "server", to: "browser", lines: ["login form (Email, Password)"] },
    { type: "call", from: "browser", to: "server", lines: ["POST login", "admin@onboard.local / admin123"] },
    { type: "call", from: "server", to: "db", lines: ["verify credentials", "create Session"] },
    { type: "return", from: "db", to: "server", lines: ["session-token-1"] },
    { type: "return", from: "server", to: "browser", lines: ['heading "Superadmin"'] },
    { type: "call", from: "browser", to: "server", lines: ["Create leader", "leader1@onboard.local / leader1pass"] },
    { type: "call", from: "server", to: "db", lines: ["insert User(role=LEADER)", 'insert Team "Team leader1@onboard.local"'] },
    { type: "return", from: "server", to: "browser", lines: ["leader-list contains leader1@onboard.local"] },
    { type: "call", from: "browser", to: "server", lines: ["Create leader", "leader2@onboard.local / leader2pass"] },
    { type: "call", from: "server", to: "db", lines: ["insert User(role=LEADER)", 'insert Team "Team leader2@onboard.local"'] },
    { type: "return", from: "server", to: "browser", lines: ["leader-list contains leader2@onboard.local"] },
    {
      type: "note",
      from: "browser",
      to: "db",
      lines: [
        'dumpDatabase("test1") →',
        "3 users (1 superadmin + 2 leaders)",
        "2 teams, 1 session",
        "0 invitations, 0 progress, 0 emails",
      ],
    },
  ],
};

const STORY_2 = {
  title: "Leader invites members and follows onboarding progress",
  source: "tests/onboarding.spec.ts",
  actors: [
    { id: "leader", label: "Leader Browser", color: "var(--browser)" },
    { id: "server", label: "Server", color: "var(--server)" },
    { id: "db", label: "Database", color: "var(--db)" },
    { id: "member", label: "Member Browser", color: "var(--browser)" },
  ],
  messages: [
    { type: "call", from: "leader", to: "server", lines: ["POST login", "leader@onboard.local / leader123"] },
    { type: "call", from: "server", to: "db", lines: ["verify credentials", "create Session"] },
    { type: "return", from: "server", to: "leader", lines: ['heading "Team leader@onboard.local"'] },
    { type: "call", from: "leader", to: "server", lines: ["Invite member1@onboard.local"] },
    { type: "call", from: "server", to: "db", lines: ["insert Invitation(token=invite-token-1)", "insert Email"] },
    { type: "return", from: "server", to: "leader", lines: ["invitation-list contains member1@onboard.local"] },
    { type: "call", from: "leader", to: "server", lines: ["Invite member2@onboard.local"] },
    { type: "call", from: "server", to: "db", lines: ["insert Invitation(token=invite-token-2)", "insert Email"] },
    { type: "return", from: "server", to: "leader", lines: ["invitation-list contains member2@onboard.local"] },
    { type: "call", from: "member", to: "server", lines: ["GET /dev/inbox"] },
    { type: "call", from: "server", to: "db", lines: ["read Email rows"] },
    { type: "return", from: "server", to: "member", lines: ['email-body containing "invite-token-1"'] },
    { type: "note", from: "member", to: "member", lines: ["extracts /invite/invite-token-1", "link from the email body"] },
    { type: "call", from: "member", to: "server", lines: ["GET /invite/invite-token-1"] },
    { type: "return", from: "server", to: "member", lines: ['heading "Join Team leader@onboard.local"'] },
    { type: "call", from: "member", to: "server", lines: ["Create account", "password=member1pass"] },
    { type: "call", from: "server", to: "db", lines: ["insert User(role=MEMBER)", "consume Invitation, create Session"] },
    { type: "return", from: "server", to: "member", lines: ['heading "Your onboarding"', 'onboarding-summary "0/3 steps completed"'] },
    { type: "async", from: "server", to: "leader", lines: ["SSE: progress-member1@onboard.local = 0/3"] },
    { type: "call", from: "member", to: "server", lines: ["check checkbox-step1"] },
    { type: "call", from: "server", to: "db", lines: ["update OnboardingProgress.step1"] },
    { type: "async", from: "server", to: "leader", lines: ["SSE: progress = 1/3"] },
    { type: "call", from: "member", to: "server", lines: ["check checkbox-step2"] },
    { type: "call", from: "server", to: "db", lines: ["update OnboardingProgress.step2"] },
    { type: "async", from: "server", to: "leader", lines: ["SSE: progress = 2/3"] },
    { type: "call", from: "member", to: "server", lines: ["check checkbox-step3"] },
    { type: "call", from: "server", to: "db", lines: ["update OnboardingProgress.step3"] },
    { type: "async", from: "server", to: "leader", lines: ["SSE: progress = 3/3"] },
    {
      type: "note",
      from: "leader",
      to: "member",
      lines: [
        'dumpDatabase("test2") →',
        "3 users, 1 team",
        "2 invitations (1 used, 1 pending)",
        "1 onboardingProgress (3/3)",
        "2 sessions, 2 emails",
      ],
    },
  ],
};

function renderDiagram(container, story) {
  container.innerHTML = "";

  const laneGap = 250;
  const leftMargin = 60;
  const actorBoxWidth = 190;
  const actorBoxHeight = 46;
  const topMargin = 20;
  const firstMessageY = topMargin + actorBoxHeight + 30;
  const lineHeight = 15;

  const xFor = (id) => leftMargin + story.actors.findIndex((a) => a.id === id) * laneGap + actorBoxWidth / 2;

  // First pass: compute the y position of each message/note and total height.
  let y = firstMessageY;
  const positions = story.messages.map((m) => {
    const startY = y;
    if (m.type === "note") {
      const h = 26 + m.lines.length * lineHeight;
      y += h + 22;
      return { startY, height: h };
    }
    const h = 20 + (m.lines.length - 1) * lineHeight;
    y += h + 22;
    return { startY, height: h };
  });
  const totalHeight = y + 20;
  const width = leftMargin * 2 + story.actors.length * laneGap - (laneGap - actorBoxWidth);

  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("width", width);
  svg.setAttribute("height", totalHeight);
  svg.setAttribute("viewBox", `0 0 ${width} ${totalHeight}`);

  // Arrow marker defs
  const defs = document.createElementNS(SVGNS, "defs");
  defs.innerHTML = `
    <marker id="arrow-solid" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L8,3 L0,6 Z" fill="currentColor" />
    </marker>
    <marker id="arrow-open" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L8,3 L0,6" fill="none" stroke="currentColor" stroke-width="1.5" />
    </marker>
  `;
  svg.appendChild(defs);

  // Lifelines
  story.actors.forEach((actor) => {
    const cx = xFor(actor.id);
    const line = document.createElementNS(SVGNS, "line");
    line.setAttribute("x1", cx);
    line.setAttribute("x2", cx);
    line.setAttribute("y1", topMargin + actorBoxHeight);
    line.setAttribute("y2", totalHeight - 10);
    line.setAttribute("stroke", "var(--border)");
    line.setAttribute("stroke-width", "1.5");
    svg.appendChild(line);
  });

  // Actor header boxes (drawn after lifelines so they sit on top)
  story.actors.forEach((actor) => {
    const cx = xFor(actor.id);
    const rect = document.createElementNS(SVGNS, "rect");
    rect.setAttribute("x", cx - actorBoxWidth / 2);
    rect.setAttribute("y", topMargin);
    rect.setAttribute("width", actorBoxWidth);
    rect.setAttribute("height", actorBoxHeight);
    rect.setAttribute("rx", 6);
    rect.setAttribute("fill", actor.color);
    svg.appendChild(rect);

    const text = document.createElementNS(SVGNS, "text");
    text.setAttribute("x", cx);
    text.setAttribute("y", topMargin + actorBoxHeight / 2 + 4);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("class", "actor-label");
    text.textContent = actor.label;
    svg.appendChild(text);
  });

  // Messages / notes
  story.messages.forEach((m, i) => {
    const { startY, height } = positions[i];

    if (m.type === "note") {
      const selfNote = m.from === m.to;
      const x1 = xFor(m.from);
      const x2 = xFor(m.to);
      const left = selfNote ? x1 + 14 : Math.min(x1, x2) + 18;
      const right = selfNote ? x1 + 14 + 220 : Math.max(x1, x2) - 18;
      const boxW = Math.max(right - left, 200);

      const rect = document.createElementNS(SVGNS, "rect");
      rect.setAttribute("x", left);
      rect.setAttribute("y", startY);
      rect.setAttribute("width", boxW);
      rect.setAttribute("height", height);
      rect.setAttribute("rx", 4);
      rect.setAttribute("fill", "var(--note-bg)");
      rect.setAttribute("stroke", "var(--note-border)");
      rect.setAttribute("stroke-width", "1");
      svg.appendChild(rect);

      m.lines.forEach((line, li) => {
        const t = document.createElementNS(SVGNS, "text");
        t.setAttribute("x", left + 10);
        t.setAttribute("y", startY + 17 + li * lineHeight);
        t.setAttribute("class", "note-line");
        t.setAttribute("font-weight", li === 0 ? "600" : "400");
        t.textContent = line;
        svg.appendChild(t);
      });
      return;
    }

    const x1 = xFor(m.from);
    const x2 = xFor(m.to);
    const lineY = startY + 2 + (m.lines.length - 1) * lineHeight;
    const dashed = m.type !== "call";
    const marker = m.type === "call" ? "arrow-solid" : "arrow-open";
    const stroke = m.type === "async" ? "var(--accent)" : m.type === "call" ? "var(--text)" : "var(--text-dim)";

    // labels above the arrow
    m.lines.forEach((line, li) => {
      const t = document.createElementNS(SVGNS, "text");
      t.setAttribute("x", (x1 + x2) / 2);
      t.setAttribute("y", startY + li * lineHeight);
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("class", "label-line");
      t.setAttribute("font-weight", li === 0 ? "600" : "400");
      t.textContent = line;
      svg.appendChild(t);
    });

    const arrow = document.createElementNS(SVGNS, "line");
    arrow.setAttribute("x1", x1 + (x2 > x1 ? 4 : x2 < x1 ? -4 : 0));
    arrow.setAttribute("x2", x2 + (x2 > x1 ? -10 : x2 < x1 ? 10 : 0));
    arrow.setAttribute("y1", lineY);
    arrow.setAttribute("y2", lineY);
    arrow.setAttribute("stroke", stroke);
    arrow.setAttribute("stroke-width", "1.75");
    if (dashed) arrow.setAttribute("stroke-dasharray", "5,4");
    arrow.setAttribute("marker-end", `url(#${marker})`);
    arrow.style.color = stroke;
    svg.appendChild(arrow);
  });

  container.appendChild(svg);
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
  renderDiagram(document.getElementById("diagram-1"), STORY_1);
  renderDiagram(document.getElementById("diagram-2"), STORY_2);
  initTabs();
});
