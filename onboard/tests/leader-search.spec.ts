import { test, expect } from "@playwright/test";
import { seedDatabase } from "./helpers";

test("superadmin searches and filters leaders", async ({ page }) => {
  seedDatabase("superadmin");

  // Log in as the superadmin.
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill("admin@onboard.local");
  await page.getByPlaceholder("Password").fill("admin123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Superadmin" })).toBeVisible();

  // Create three leaders with distinguishable emails.
  const leaders = [
    ["alice@onboard.local", "alicepass"],
    ["bob@onboard.local", "bobpass"],
    ["carol@onboard.local", "carolpass"],
  ];
  for (const [email, password] of leaders) {
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByTestId(`leader-${email}`)).toBeVisible();
  }

  const search = page.getByTestId("leader-search");
  const list = page.getByTestId("leader-list");
  const empty = page.getByTestId("leader-list-empty");

  // A fragment matching exactly one leader narrows the list to that leader.
  await search.fill("bob");
  await expect(page.getByTestId("leader-bob@onboard.local")).toBeVisible();
  await expect(page.getByTestId("leader-alice@onboard.local")).toHaveCount(0);
  await expect(page.getByTestId("leader-carol@onboard.local")).toHaveCount(0);
  await expect(list.getByRole("listitem")).toHaveCount(1);

  // Clearing the search restores all three.
  await page.getByTestId("leader-search-clear").click();
  await expect(search).toHaveValue("");
  await expect(list.getByRole("listitem")).toHaveCount(3);
  for (const [email] of leaders) {
    await expect(page.getByTestId(`leader-${email}`)).toBeVisible();
  }

  // A fragment matching nothing shows the empty state instead of the list.
  await search.fill("zzz-nobody");
  await expect(list).toHaveCount(0);
  await expect(empty).toBeVisible();
  await expect(empty).toContainText("No leaders match");
});
