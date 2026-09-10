import { test, expect } from "@playwright/test";
import {
  seedDatabase,
  dumpDatabase,
  hash,
  EPOCH,
  EPOCH_PLUS_24H,
  APP_URL,
} from "./helpers";

test("member sets a display name and the leader sees it", async ({
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

  // Invite one person.
  await leaderPage.getByPlaceholder("Email").fill("member1@onboard.local");
  await leaderPage.getByRole("button", { name: "Invite" }).click();
  await expect(leaderPage.getByTestId("invitation-list")).toContainText(
    "member1@onboard.local"
  );

  // The invitee reads the invitation email in the dev inbox and follows
  // the link.
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
  await memberPage.getByPlaceholder("Choose a password").fill("member1pass");
  await memberPage.getByRole("button", { name: "Create account" }).click();
  await expect(
    memberPage.getByRole("heading", { name: "Your onboarding" })
  ).toBeVisible();

  // Before choosing a name, the member is identified by email everywhere.
  await expect(memberPage.getByTestId("member-name")).toHaveText(
    "member1@onboard.local"
  );
  await expect(
    leaderPage.getByTestId("member-member1@onboard.local")
  ).toContainText("member1@onboard.local");

  // The member sets a display name and sees it in place of their email.
  await memberPage.getByTestId("display-name-input").fill("Mia Member");
  await memberPage.getByRole("button", { name: "Save name" }).click();
  await expect(memberPage.getByTestId("member-name")).toHaveText("Mia Member");

  // The leader's dashboard shows the display name (via SSE, no reload).
  const memberRow = leaderPage.getByTestId("member-member1@onboard.local");
  await expect(memberRow).toContainText("Mia Member");
  await expect(memberRow).not.toContainText("member1@onboard.local");

  // It survives a reload of the member's own page.
  await memberPage.reload();
  await expect(memberPage.getByTestId("member-name")).toHaveText("Mia Member");

  await leaderContext.close();
  await memberContext.close();

  // Verify the database.
  const dump = dumpDatabase("test3");
  expect(dump).toEqual({
    users: [
      {
        id: 1,
        email: "admin@onboard.local",
        displayName: null,
        passwordHash: hash("admin123"),
        role: "SUPERADMIN",
        teamId: null,
      },
      {
        id: 2,
        email: "leader@onboard.local",
        displayName: null,
        passwordHash: hash("leader123"),
        role: "LEADER",
        teamId: null,
      },
      {
        id: 3,
        email: "member1@onboard.local",
        displayName: "Mia Member",
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
    ],
    onboardingProgress: [
      { id: 1, userId: 3, step1: false, step2: false, step3: false },
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
        body: `Hi! leader@onboard.local invited you to join Team leader@onboard.local. Follow this link to create your account: ${APP_URL}/invite/invite-token-1 (valid for 24 hours)`,
        sentAt: EPOCH,
      },
    ],
  });
});
