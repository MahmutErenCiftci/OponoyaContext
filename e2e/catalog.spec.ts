import { expect, test } from "@playwright/test";
import { noHorizontalOverflow, openMoreMenu, signUp, skipFirstRun, workspaceNav } from "./support/workspace";

test("technology catalog: browse, add to Library with logos, stack preset to profile, light theme", async ({ page }, testInfo) => {
  const email = `playwright-catalog-${Date.now()}@example.test`;
  const sidebar = workspaceNav(page);

  await signUp(page, "Catalog Tester", email);
  await skipFirstRun(page);

  // Catalog overview: research counts, disclaimer, presets and search.
  await sidebar.getByRole("link", { name: "Katalog" }).click();
  await expect(page.getByRole("heading", { name: "Teknoloji kataloğu" })).toBeVisible();
  await expect(page.getByText("246 teknoloji · 15 hazır stack")).toBeVisible();
  await expect(page.getByRole("link", { name: /T3 Stack/ }).first()).toBeAttached();
  await expect(page.getByText("editör görüşüdür")).toBeVisible();
  await page.getByLabel("Katalogda ara").fill("Next.js");
  const nextCard = page.getByRole("article", { name: "Next.js" });
  await expect(nextCard).toBeVisible();
  await expect(nextCard.getByRole("img", { name: "Next.js logo" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("catalog-dark-desktop.png"), fullPage: true });

  // Add one technology; the card flips to "Kütüphanede" and the toast confirms.
  await nextCard.getByRole("button", { name: "Next.js kütüphaneye ekle" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Next.js Kütüphanene eklendi." })).toBeVisible();
  await expect(nextCard.getByRole("link", { name: "Kütüphanede" })).toBeVisible();

  // Detail page carries the editor-assessment label and cross references.
  await nextCard.getByRole("link", { name: "Next.js", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/catalog\/nextjs$/);
  await expect(page.getByRole("heading", { level: 1, name: "Next.js" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "AI ile geliştirme" })).toBeVisible();
  await expect(page.getByText("Editör değerlendirmesi")).toBeVisible();
  await expect(page.getByRole("link", { name: "Kütüphanede" })).toBeVisible();
  await page.getByRole("heading", { name: "Hazır stack’lerde" }).locator("..").getByRole("link", { name: "T3 Stack" }).click();

  // Stack preset → Library entries + PREFERRED stack profile, idempotent.
  await expect(page.getByRole("heading", { level: 1, name: "T3 Stack" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Katmanlar" })).toContainText("PostgreSQL");
  await page.getByRole("button", { name: "Stack profili oluştur" }).click();
  const created = page.getByRole("status").filter({ hasText: /“T3 Stack” profili \d+ kararla oluşturuldu/ });
  await expect(created).toBeVisible();
  await created.getByRole("link", { name: "Profili aç" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /T3 Stack/ })).toBeVisible();
  await expect(page.getByText("frontend.framework")).toBeVisible();
  await page.goBack();
  await page.getByRole("button", { name: "Stack profili oluştur" }).click();
  await expect(page.getByRole("status").filter({ hasText: "zaten var; hiçbir şey değişmedi" })).toBeVisible();

  // Library shows the downloaded brand marks for catalog resources.
  await sidebar.getByRole("link", { name: "Kütüphane" }).click();
  await page.getByLabel("Kaynaklarda ara").fill("Next.js");
  await page.getByLabel("Kaynaklarda ara").press("Enter");
  await expect(page.getByRole("heading", { name: "Next.js", exact: true })).toBeVisible();
  await expect(page.locator('[data-logo="nextjs"]').first()).toBeVisible();

  // Light theme: chosen in Settings, persisted across reloads and public pages.
  await openMoreMenu(page, "Ayarlar");
  await expect(page.getByRole("heading", { name: "Görünüm" })).toBeVisible();
  await page.getByRole("radio", { name: /^Açık/ }).check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("radio", { name: /^Açık/ })).toBeChecked();
  await sidebar.getByRole("link", { name: "Katalog" }).click();
  await expect(page.getByRole("heading", { name: "Teknoloji kataloğu" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.screenshot({ path: testInfo.outputPath("catalog-light-desktop.png"), fullPage: true });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.screenshot({ path: testInfo.outputPath("landing-light-desktop.png"), fullPage: true });
  await page.getByRole("combobox", { name: "Tema" }).selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  // Mobile: the catalog and its header controls fit the viewport.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/workspace/catalog");
  await expect(page.getByRole("heading", { name: "Teknoloji kataloğu" })).toBeVisible();
  await noHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("catalog-mobile.png") });
});
