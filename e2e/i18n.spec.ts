import { expect, test } from "@playwright/test";
import { noHorizontalOverflow, password } from "./support/workspace";

/**
 * English interface. The rest of the suite runs as a Turkish browser; here
 * the browser asks for English, so the pages follow Accept-Language until a
 * choice is stored, and the stored choice wins afterwards.
 */
test.use({ locale: "en-US" });

const languageSwitch = "Dil / Language";

test("the English landing lives at /en, and / stays Turkish for an English browser", async ({ page }, testInfo) => {
  await page.goto("/en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1, name: /Stop explaining the same things again in every new project/ })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Workspace ready");
  await expect(page.locator('link[rel="alternate"][hreflang="tr"]')).toHaveCount(1);
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await noHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("landing-en-mobile.png"), fullPage: true });

  // Crawlers and first visits to / get the Turkish landing, whatever the browser asks for.
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "tr");
  await expect(page.getByRole("heading", { level: 1, name: /Her yeni projede aynı şeyleri tekrar anlatma/ })).toBeVisible();

  // Choosing English on the Turkish landing moves to /en and is remembered for /.
  await page.getByRole("combobox", { name: languageSwitch }).selectOption("en");
  await expect(page).toHaveURL(/\/en$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
});

test("an English visitor signs up, works in English and switches to Turkish", async ({ page }) => {
  const email = `playwright-en-${Date.now()}@example.test`;

  await page.goto("/workspace");
  await expect(page).toHaveURL(/\/auth/);
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  await page.locator(".auth-form .alt").getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Your name").fill("Playwright English");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/workspace$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "Your workspace is ready." })).toBeVisible();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByRole("heading", { name: /Welcome(?: back)?, Playwright/ })).toBeVisible();

  const navigation = page.getByRole("navigation", { name: "Workspace" });
  await navigation.getByRole("link", { name: "Library", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/library$/);
  await expect(page.getByRole("heading", { level: 1, name: "Library" })).toBeVisible();

  // Settings offers the same choice as the top bar.
  await page.goto("/workspace/settings#settings-appearance");
  await expect(page.getByRole("radio", { name: /English/ })).toBeChecked();

  // The top-bar switch stores Turkish and re-renders the page in place.
  await page.goto("/workspace");
  await page.getByRole("combobox", { name: languageSwitch }).selectOption("tr");
  await expect(page.locator("html")).toHaveAttribute("lang", "tr");
  await expect(page.getByRole("heading", { name: /hoş geldin, Playwright/i })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Çalışma alanı" }).getByRole("link", { name: "Kütüphane", exact: true })).toBeVisible();

  // The stored choice outranks the English browser on the next visit.
  await page.reload();
  await expect(page.getByRole("heading", { name: /hoş geldin, Playwright/i })).toBeVisible();
});
