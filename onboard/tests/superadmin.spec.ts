import { test, expect } from "@playwright/test";
import { seedDatabase, dumpDatabase, hash } from "./helpers";

test("superadmin creates two leaders", async ({ page }) => {
  seedDatabase("superadmin");

  // Log in as the superadmin.
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill("admin@onboard.local");
  await page.getByPlaceholder("Password").fill("admin123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Superadmin" })).toBeVisible();

  // Create two leaders.
  for (const [email, password] of [
    ["leader1@onboard.local", "leader1pass"],
    ["leader2@onboard.local", "leader2pass"],
  ]) {
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByTestId("leader-list")).toContainText(email);
  }

  // Verify the database.
  const dump = dumpDatabase("test1");
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
        email: "leader1@onboard.local",
        passwordHash: hash("leader1pass"),
        role: "LEADER",
        teamId: null,
      },
      {
        id: 3,
        email: "leader2@onboard.local",
        passwordHash: hash("leader2pass"),
        role: "LEADER",
        teamId: null,
      },
    ],
    teams: [
      { id: 1, name: "Team leader1@onboard.local", leaderId: 2 },
      { id: 2, name: "Team leader2@onboard.local", leaderId: 3 },
    ],
    invitations: [],
    onboardingProgress: [],
    sessions: [{ id: 1, token: "session-token-1", userId: 1 }],
    emails: [],
  });
});
