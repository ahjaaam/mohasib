import { expect, test } from "@playwright/test";

test("public pages and authentication entry points render", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Mohasib/i);
  await expect(page.locator("body")).toContainText(/comptab|factur|Mohasib/i);

  await page.goto("/tarifs");
  await expect(page.locator("body")).toContainText(/tarif|plan|essai/i);

  await page.goto("/auth/login");
  await expect(page.getByRole("textbox", { name: /e-?mail/i })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Mot de passe", exact: true })).toBeVisible();

  await page.goto("/auth/signup");
  await page.getByRole("button", { name: /entrepreneur/i }).click();
  await expect(page.getByRole("textbox", { name: /e-?mail/i })).toBeVisible();
});

test("health endpoint reports a ready release", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();

  const payload = await response.json();
  expect(payload.status).toBe("ok");
  expect(payload.checks.configuration).toBe("ok");
});

test("protected application routes do not expose private content anonymously", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/(auth\/login|connexion)(\?|$)/);
});
