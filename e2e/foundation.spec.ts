import { expect, test } from "@playwright/test";
import { addResource, noHorizontalOverflow, password, rowAction, skipFirstRun } from "./support/workspace";

test("landing page presents the product and connects to the API", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Teknolojilerini bir kez anlat. Her projede hatırlansın." })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Çalışma alanı hazır");
  await expect(page.getByRole("img", { name: "DevContext’te proje kararları ve AI talimatlarının önizlemesi" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("landing-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("status")).toBeVisible();
  await noHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("landing-mobile.png"), fullPage: true });
});

test("user can sign up, access the protected workspace, sign out and sign in", async ({ page }, testInfo) => {
  const email = `playwright-${Date.now()}@example.test`;

  await page.goto("/workspace");
  await expect(page).toHaveURL(/\/auth/);
  // A protected route bounces to sign-in; the same page switches to sign-up without a reload.
  await expect(page.getByRole("heading", { name: "Giriş yap" })).toBeVisible();
  await page.locator(".auth-form .alt").getByRole("button", { name: "Hesap oluştur" }).click();
  await page.getByLabel("Adın").fill("Playwright User");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Şifre", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Hesap oluştur" }).click();

  await expect(page).toHaveURL(/\/workspace$/);
  await skipFirstRun(page);
  await expect(page.getByRole("heading", { name: /^Merhaba, / })).toBeVisible();
  if (await page.locator(".account-menu").getAttribute("open") === null) await page.getByLabel("Hesap menüsü").click();
  await expect(page.getByText(email)).toBeVisible();

  if (await page.locator(".account-menu").getAttribute("open") === null) await page.getByLabel("Hesap menüsü").click();
  await page.getByRole("button", { name: "Çıkış yap" }).click();
  await expect(page).toHaveURL(/\/auth/);
  await expect(page.getByRole("heading", { name: "Giriş yap" })).toBeVisible();
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Şifre", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();

  await expect(page).toHaveURL(/\/workspace$/);
  await expect(page.getByRole("heading", { name: /^Merhaba, / })).toBeVisible();

  await page.getByRole("navigation", { name: "Çalışma alanı" }).getByRole("link", { name: "Kütüphane", exact: true }).click();
  await addResource(page, { name: "Animate UI Toggle", type: "component", url: "https://animate-ui.com/docs/components/radix/toggle", tags: "frontend, component" });
  let resourceRow = page.getByRole("row").filter({ hasText: "Animate UI Toggle" });
  await expect(resourceRow).toContainText("Tercih edilen");
  await page.getByLabel("Kaynaklarda ara").fill("Animate UI");
  await page.getByLabel("Kaynaklarda ara").press("Enter");
  await expect(page.getByRole("heading", { name: "Animate UI Toggle" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("library-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await noHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("library-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByLabel("Kaynaklarda ara").fill("");
  await page.getByLabel("Kaynaklarda ara").press("Enter");

  resourceRow = page.getByRole("row").filter({ hasText: "Animate UI Toggle" });
  await rowAction(resourceRow, "Animate UI Toggle işlemleri", "Düzenle");
  const editor = page.getByRole("dialog", { name: "Kaynağı düzenle" });
  await editor.getByRole("radio", { name: /^Devre dışı/ }).check();
  await editor.getByRole("button", { name: "Kaynağı kaydet" }).click();
  resourceRow = page.getByRole("row").filter({ hasText: "Animate UI Toggle" });
  await expect(resourceRow).toContainText("Devre dışı");
  await rowAction(resourceRow, "Animate UI Toggle işlemleri", "Arşivle");
  await expect(page.getByRole("heading", { name: "Kütüphanen burada başlıyor" })).toBeVisible();
  await page.getByRole("tab", { name: "Arşiv" }).click();
  resourceRow = page.getByRole("row").filter({ hasText: "Animate UI Toggle" });
  await expect(resourceRow).toBeVisible();
  await rowAction(resourceRow, "Animate UI Toggle işlemleri", "Geri yükle");
  await page.getByRole("tab", { name: "Tümü" }).click();
  await expect(page.getByRole("heading", { name: "Animate UI Toggle" })).toBeVisible();
});
