import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import {
  seedDatabase,
  dumpDatabase,
  hash,
  APP_URL,
  EPOCH,
  EPOCH_PLUS_24H,
} from "./helpers";

test("leader exports the team's progress as CSV", async ({ browser }) => {
  seedDatabase("superadmin+leader");

  const leaderContext = await browser.newContext();
  const leaderPage = await leaderContext.newPage();

  // Log in as the leader.
  await leaderPage.goto("/login");
  await leaderPage.getByPlaceholder("Email").fill("leader@onboard.local");
  await leaderPage.getByPlaceholder("Password").fill("leader123");
  await leaderPage.getByRole("button", { name: "Log in" }).click();
  await expect(
    leaderPage.getByRole("heading", { name: "Team leader@onboard.local" })
  ).toBeVisible();

  // Invite two people.
  for (const email of ["member1@onboard.local", "member2@onboard.local"]) {
    await leaderPage.getByPlaceholder("Email").fill(email);
    await leaderPage.getByRole("button", { name: "Invite" }).click();
    await expect(leaderPage.getByTestId("invitation-list")).toContainText(email);
  }

  // Both invitees read their invitation email in the dev inbox and create
  // an account from the link.
  const memberPages: { context: BrowserContext; page: Page }[] = [];
  for (const [token, password] of [
    ["invite-token-1", "member1pass"],
    ["invite-token-2", "member2pass"],
  ] as const) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/dev/inbox");
    const body = await page
      .getByTestId("email-body")
      .filter({ hasText: token })
      .textContent();
    const link = body!.match(/http:\/\/[^\s]+\/invite\/[\w-]+/)![0];

    await page.goto(link);
    await page.getByPlaceholder("Choose a password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(
      page.getByRole("heading", { name: "Your onboarding" })
    ).toBeVisible();
    memberPages.push({ context, page });
  }

  // The first member checks two of the three boxes; the second checks none.
  await memberPages[0].page.getByTestId("checkbox-step1").check();
  await memberPages[0].page.getByTestId("checkbox-step3").check();
  await expect(memberPages[0].page.getByTestId("onboarding-summary")).toHaveText(
    "2/3 steps completed"
  );

  // The leader sees both members (via SSE) before exporting.
  await expect(
    leaderPage.getByTestId("progress-member1@onboard.local")
  ).toHaveText("2/3");
  await expect(
    leaderPage.getByTestId("progress-member2@onboard.local")
  ).toHaveText("0/3");

  // Download the CSV.
  const downloadPromise = leaderPage.waitForEvent("download");
  await leaderPage.getByTestId("export-csv").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("team-progress-2026-01-01.csv");

  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const csv = Buffer.concat(chunks).toString("utf8");

  // A header row, then exactly one row per member of this team.
  expect(csv.trimEnd().split("\n")).toEqual([
    "email,step1,step2,step3,completed",
    "member1@onboard.local,yes,no,yes,2/3",
    "member2@onboard.local,no,no,no,0/3",
  ]);
  // Nobody outside the team appears — not the superadmin, not the leader.
  expect(csv).not.toContain("admin@onboard.local");
  expect(csv).not.toContain("leader@onboard.local");

  await leaderContext.close();
  for (const { context } of memberPages) await context.close();

  // Verify the database: exporting must not change anything.
  const dump = dumpDatabase("test3");
  expect(dump).toEqual({
    users: [
      {
        id: 1,
        email: "admin@onboard.local",
        passwordHash: hash("admin123"),
        role: "SUPERADMIN",
        teamId: null,
      },
      {
        id: 2,
        email: "leader@onboard.local",
        passwordHash: hash("leader123"),
        role: "LEADER",
        teamId: null,
      },
      {
        id: 3,
        email: "member1@onboard.local",
        passwordHash: hash("member1pass"),
        role: "MEMBER",
        teamId: 1,
      },
      {
        id: 4,
        email: "member2@onboard.local",
        passwordHash: hash("member2pass"),
        role: "MEMBER",
        teamId: 1,
      },
    ],
    teams: [{ id: 1, name: "Team leader@onboard.local", leaderId: 2 }],
    invitations: [
      {
        id: 1,
        email: "member1@onboard.local",
        token: "invite-token-1",
        teamId: 1,
        createdAt: EPOCH,
        expiresAt: EPOCH_PLUS_24H,
        usedAt: EPOCH,
      },
      {
        id: 2,
        email: "member2@onboard.local",
        token: "invite-token-2",
        teamId: 1,
        createdAt: EPOCH,
        expiresAt: EPOCH_PLUS_24H,
        usedAt: EPOCH,
      },
    ],
    onboardingProgress: [
      { id: 1, userId: 3, step1: true, step2: false, step3: true },
      { id: 2, userId: 4, step1: false, step2: false, step3: false },
    ],
    sessions: [
      { id: 1, token: "session-token-1", userId: 2 },
      { id: 2, token: "session-token-2", userId: 3 },
      { id: 3, token: "session-token-3", userId: 4 },
    ],
    emails: [
      {
        id: 1,
        to: "member1@onboard.local",
        subject: "You have been invited to onboard",
        body: `Hi! leader@onboard.local invited you to join Team leader@onboard.local. Follow this link to create your account: ${APP_URL}/invite/invite-token-1 (valid for 24 hours)`,
        sentAt: EPOCH,
      },
      {
        id: 2,
        to: "member2@onboard.local",
        subject: "You have been invited to onboard",
        body: `Hi! leader@onboard.local invited you to join Team leader@onboard.local. Follow this link to create your account: ${APP_URL}/invite/invite-token-2 (valid for 24 hours)`,
        sentAt: EPOCH,
      },
    ],
  });
});
