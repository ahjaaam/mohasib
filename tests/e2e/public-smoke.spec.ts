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
  await expect(page.getByRole("button", { name: /^TPME/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Cabinet comptable/i })).toBeVisible();
  await page.getByRole("button", { name: /^TPME/i }).click();
  await expect(page.getByRole("textbox", { name: /e-?mail/i })).toBeVisible();

  await page.goto("/facturation");
  const facturationBrand = page.getByRole("link", { name: "Mohasib", exact: true });
  await expect(facturationBrand).toBeVisible();
  await expect(facturationBrand.getByRole("img", { name: "Mohasib" })).toHaveCSS("mask-image", /\/logo\.png/);
});

test("solutions navigation leads to the six automations section", async ({ page }) => {
  await page.goto("/");
  const solutionsLink = page.locator(".public-navbar a[href='/#six-automatisations']:visible").first();
  if (await solutionsLink.count() === 0) {
    await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  }
  await expect(solutionsLink).toBeVisible();

  await solutionsLink.click();
  await expect(page).toHaveURL(/\/#six-automatisations$/);
  await expect(page.locator("#six-automatisations")).toBeInViewport();
  await expect(page.locator("#six-automatisations")).toContainText(/Six automatisations/i);
});

test("health endpoint reports a ready release", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-security-policy"]).toContain("default-src 'self'");

  const payload = await response.json();
  expect(payload.status).toBe("ok");
  expect(payload.checks.configuration).toBe("ok");
});

test("protected application routes do not expose private content anonymously", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/(auth\/login|connexion)(\?|$)/);
});
