import { test, expect } from "@playwright/test";
import { seedDatabase } from "./helpers";

const LEADERS = [
  ["alice@onboard.local", "alicepass"],
  ["bob@onboard.local", "bobpass"],
  ["carol@onboard.local", "carolpass"],
];

test("superadmin searches and filters leaders", async ({ page }) => {
  seedDatabase("superadmin");

  // Log in as the superadmin.
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill("admin@onboard.local");
  await page.getByPlaceholder("Password").fill("admin123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Superadmin" })).toBeVisible();

  // Create three leaders with distinguishable emails.
  for (const [email, password] of LEADERS) {
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByTestId("leader-list")).toContainText(email);
  }

  const list = page.getByTestId("leader-list");
  const search = page.getByTestId("leader-search");

  // All three are listed to start with.
  await expect(list.getByRole("listitem")).toHaveCount(3);

  // A fragment matching exactly one leader narrows the list to that leader.
  await search.fill("bob");
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(list).toContainText("bob@onboard.local");
  await expect(list).not.toContainText("alice@onboard.local");
  await expect(list).not.toContainText("carol@onboard.local");

  // Clearing the search restores every leader.
  await page.getByTestId("leader-search-clear").click();
  await expect(search).toHaveValue("");
  await expect(list.getByRole("listitem")).toHaveCount(3);
  for (const [email] of LEADERS) {
    await expect(list).toContainText(email);
  }

  // A fragment matching nobody shows the empty state instead of the list.
  await search.fill("nobody");
  await expect(list).toHaveCount(0);
  await expect(page.getByTestId("leader-search-empty")).toBeVisible();
});
