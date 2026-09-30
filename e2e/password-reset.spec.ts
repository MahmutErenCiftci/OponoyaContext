import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { emailOutboxFile } from "../playwright.config";
import { password, signUp } from "./support/workspace";

/** The newest message sent to `email` by the development e-mail provider (see playwright.config.ts). */
async function latestMessageTo(email: string) {
  const text = await readFile(emailOutboxFile, "utf8").catch(() => null);
  if (text === null) return null;
  const messages = text.split("\n").filter(Boolean).map((line) => JSON.parse(line) as { to: string; text: string });
  return messages.filter((message) => message.to === email).at(-1) ?? null;
}

test("a forgotten password is reset through a one-time e-mail link", async ({ page }) => {
  const email = `playwright-reset-${Date.now()}@example.test`;
  const newPassword = "Playwright-new-password-2026!";
  await signUp(page, "Reset Tester", email);

  // Sign out, then ask for a link from the sign-in form.
  if (await page.locator(".account-menu").getAttribute("open") === null) await page.getByLabel("Hesap menüsü").click();
  await page.getByRole("button", { name: "Çıkış yap" }).click();
  await expect(page.getByRole("heading", { name: "Giriş yap" })).toBeVisible();
  await page.getByRole("link", { name: "Şifremi unuttum" }).click();
  await expect(page.getByRole("heading", { name: "Şifreni sıfırla" })).toBeVisible();
  await page.getByLabel("E-posta").fill(email);
  await page.getByRole("button", { name: "Sıfırlama bağlantısı gönder" }).click();
  await expect(page.getByRole("heading", { name: "E-postanı kontrol et" })).toBeVisible();

  // An unknown address gets exactly the same answer.
  await page.goto("/auth/forgot");
  await page.getByLabel("E-posta").fill(`nobody-${Date.now()}@example.test`);
  await page.getByRole("button", { name: "Sıfırlama bağlantısı gönder" }).click();
  await expect(page.getByRole("heading", { name: "E-postanı kontrol et" })).toBeVisible();

  await expect.poll(async () => (await latestMessageTo(email))?.text ?? "").toContain("/auth/reset?token=");
  const link = /https?:\/\/\S+/.exec((await latestMessageTo(email))!.text)![0];

  await page.goto(link);
  await page.getByLabel("Yeni şifre", { exact: true }).fill(newPassword);
  await page.getByLabel("Yeni şifre (tekrar)").fill(newPassword);
  await page.getByRole("button", { name: "Şifreyi kaydet" }).click();
  await expect(page.getByRole("heading", { name: "Şifren güncellendi" })).toBeVisible();

  // The link works once.
  await page.goto(link);
  await page.getByLabel("Yeni şifre", { exact: true }).fill("Another-password-2026!");
  await page.getByLabel("Yeni şifre (tekrar)").fill("Another-password-2026!");
  await page.getByRole("button", { name: "Şifreyi kaydet" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "geçersiz ya da süresi dolmuş" })).toBeVisible();

  // The old password no longer signs in; the new one does.
  await page.goto("/auth?mode=sign-in");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Şifre", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "E-posta veya şifre hatalı." })).toBeVisible();
  await page.getByLabel("Şifre", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace$/);
});
