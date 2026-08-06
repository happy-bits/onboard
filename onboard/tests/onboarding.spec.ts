import { test, expect } from "@playwright/test";
import {
  seedDatabase,
  dumpDatabase,
  hash,
  EPOCH,
  EPOCH_PLUS_24H,
} from "./helpers";

test("leader invites members and follows onboarding progress", async ({
  browser,
}) => {
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
    await expect(leaderPage.getByTestId("invitation-list")).toContainText(
      email
    );
  }

  // The first invitee reads the invitation email in the dev inbox and
  // follows the link.
  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await memberPage.goto("/dev/inbox");
  const emailBody = memberPage
    .getByTestId("email-body")
    .filter({ hasText: "invite-token-1" });
  const bodyText = await emailBody.textContent();
  const link = bodyText!.match(/http:\/\/[^\s]+\/invite\/[\w-]+/)![0];

  // Create the account and land on the onboarding page.
  await memberPage.goto(link);
  await expect(
    memberPage.getByRole("heading", { name: "Join Team leader@onboard.local" })
  ).toBeVisible();
  await memberPage.getByPlaceholder("Choose a password").fill("member1pass");
  await memberPage.getByRole("button", { name: "Create account" }).click();
  await expect(
    memberPage.getByRole("heading", { name: "Your onboarding" })
  ).toBeVisible();
  await expect(memberPage.getByTestId("onboarding-summary")).toHaveText(
    "0/3 steps completed"
  );

  // The leader sees the new member appear (via SSE, no reload).
  const progress = leaderPage.getByTestId("progress-member1@onboard.local");
  await expect(progress).toHaveText("0/3");

  // The member checks the boxes one by one; the leader sees each update.
  for (const [step, expected] of [
    ["step1", "1/3"],
    ["step2", "2/3"],
    ["step3", "3/3"],
  ] as const) {
    await memberPage.getByTestId(`checkbox-${step}`).check();
    await expect(progress).toHaveText(expected);
  }

  await leaderContext.close();
  await memberContext.close();

  // Verify the database.
  const dump = dumpDatabase("test2");
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
        usedAt: null,
      },
    ],
    onboardingProgress: [
      { id: 1, userId: 3, step1: true, step2: true, step3: true },
    ],
    sessions: [
      { id: 1, token: "session-token-1", userId: 2 },
      { id: 2, token: "session-token-2", userId: 3 },
    ],
    emails: [
      {
        id: 1,
        to: "member1@onboard.local",
        subject: "You have been invited to onboard",
        body: `Hi! leader@onboard.local invited you to join Team leader@onboard.local. Follow this link to create your account: http://localhost:3000/invite/invite-token-1 (valid for 24 hours)`,
        sentAt: EPOCH,
      },
      {
        id: 2,
        to: "member2@onboard.local",
        subject: "You have been invited to onboard",
        body: `Hi! leader@onboard.local invited you to join Team leader@onboard.local. Follow this link to create your account: http://localhost:3000/invite/invite-token-2 (valid for 24 hours)`,
        sentAt: EPOCH,
      },
    ],
  });
});
