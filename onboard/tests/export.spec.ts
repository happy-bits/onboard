import { readFileSync } from "fs";
import { test, expect } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";
import { seedDatabase } from "./helpers";

// Opens the dev inbox, finds the invitation email carrying `token`, and
// returns the invitation link embedded in its body.
async function invitationLink(page: Page, token: string): Promise<string> {
  await page.goto("/dev/inbox");
  const body = page.getByTestId("email-body").filter({ hasText: token });
  const text = await body.textContent();
  return text!.match(/http:\/\/[^\s]+\/invite\/[\w-]+/)![0];
}

// Follows an invitation link in a fresh browser context and creates the
// account, leaving the new member on the onboarding page.
async function acceptInvitation(
  browser: Browser,
  link: string,
  password: string
): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(link);
  await page.getByPlaceholder("Choose a password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Your onboarding" })).toBeVisible();
  return page;
}

test("leader downloads the team's progress as CSV", async ({ browser }) => {
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

  // Both invitees follow their link from the dev inbox and create accounts.
  const inboxPage = await (await browser.newContext()).newPage();
  const link1 = await invitationLink(inboxPage, "invite-token-1");
  const link2 = await invitationLink(inboxPage, "invite-token-2");

  const member1 = await acceptInvitation(browser, link1, "member1pass");
  const member2 = await acceptInvitation(browser, link2, "member2pass");

  // The first member checks two of the three boxes; the second checks none.
  await member1.getByTestId("checkbox-step1").check();
  await member1.getByTestId("checkbox-step2").check();

  // Wait for the leader's dashboard to reflect both members (via SSE) so the
  // export reads a settled state.
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
  expect(download.suggestedFilename()).toBe(
    "team-leader-onboard-local-progress.csv"
  );

  const csv = readFileSync((await download.path())!, "utf8");
  const lines = csv.trimEnd().split("\n");

  // Exactly a header row plus one row per team member — nobody else.
  expect(lines).toEqual([
    "email,step1,step2,step3,completed",
    "member1@onboard.local,yes,yes,no,2/3",
    "member2@onboard.local,no,no,no,0/3",
  ]);
  expect(csv).not.toContain("admin@onboard.local");
  expect(csv).not.toContain("leader@onboard.local");

  await member1.context().close();
  await member2.context().close();
  await inboxPage.context().close();
  await leaderContext.close();
});
