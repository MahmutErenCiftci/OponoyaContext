import { expect, test } from "@playwright/test";
import { addResource, noHorizontalOverflow, openDisclosure, openNewProject, rowAction, signUp, skipFirstRun, wizard, wizardStep, workspaceNav } from "./support/workspace";

test("user composes a project from a saved Library resource, edits, archives and restores it", async ({ page }, testInfo) => {
  const email = `playwright-projects-${Date.now()}@example.test`;
  const sidebar = workspaceNav(page);

  await signUp(page, "Project Composer", email);
  await skipFirstRun(page);
  await expect(page.getByText("Henüz proje yok")).toBeVisible();

  await sidebar.getByRole("link", { name: "Kütüphane" }).click();
  await addResource(page, { name: "Next.js", type: "framework", url: "https://nextjs.org", tags: "frontend" });

  await sidebar.getByRole("link", { name: "Projeler" }).click();
  await expect(page).toHaveURL(/\/workspace\/projects$/);
  await expect(page.getByRole("heading", { name: "İlk projeni oluştur" })).toBeVisible();
  const editor = await openNewProject(page);

  await editor.getByRole("button", { name: "Teknoloji kararlarına geç" }).click();
  await expect(editor.getByText("Devam etmek için projeye bir ad ver.")).toBeVisible();
  await editor.getByLabel("Proje adı *").fill("Atlas Finance");
  await editor.getByLabel("Proje açıklaması").fill("Personal finance SaaS for freelancers.");
  await editor.getByLabel("Ürün türü", { exact: true }).selectOption("SaaS");
  await editor.getByLabel("Aşama").selectOption("production");
  await openDisclosure(editor, "Platformlar ve öncelikler");
  await editor.getByRole("button", { name: "mobile", exact: true }).click();
  await editor.getByRole("button", { name: "Fast MVP" }).click();
  await editor.getByLabel("Özel öncelik ekle").fill("Offline first");
  await editor.getByLabel("Özel öncelik ekle").press("Enter");
  await expect(editor.getByRole("button", { name: "Offline first", pressed: true })).toBeVisible();
  await expect(editor.getByLabel("Proje özeti")).toContainText("Atlas Finance");
  await expect(editor.getByLabel("Proje özeti")).toContainText("SaaS · Üretim");
  await editor.getByRole("button", { name: "Teknoloji kararlarına geç" }).click();
  await expect(editor.getByRole("tab", { name: "Frontend" })).toBeVisible();

  await editor.getByRole("button", { name: "Kurallara geç" }).click();
  await expect(page.getByRole("heading", { name: "Kurallar ve referanslar" })).toBeVisible();
  await editor.getByRole("checkbox", { name: /Next\.js/ }).check();
  await expect(editor.getByLabel("Proje özeti")).toContainText("Next.js");
  await editor.locator(".wizard-foot").getByRole("button", { name: "Gözden geçir" }).click();
  await expect(page.getByRole("heading", { name: "Projeni oluşturmaya hazırsın." })).toBeVisible();
  await expect(editor.getByLabel("Proje özeti")).toContainText("Üretim");
  await page.screenshot({ path: testInfo.outputPath("wizard-review-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await noHorizontalOverflow(page);
  await editor.getByRole("button", { name: "Projeyi oluştur" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("wizard-review-mobile.png") });
  await page.setViewportSize({ width: 1440, height: 900 });
  await editor.getByRole("button", { name: "Projeyi oluştur" }).click();

  await expect(page).toHaveURL(/\/workspace\/projects\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: /Atlas Finance/ })).toBeVisible();
  await expect(page.getByText("Personal finance SaaS for freelancers.").first()).toBeVisible();
  await expect(page.getByText("mobile", { exact: true })).toBeVisible();
  await expect(page.getByText("Offline first", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Referans kaynaklar (1)" })).toBeVisible();
  await expect(page.locator(".brief-item a[href='https://nextjs.org']")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Offline first", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("project-overview-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await noHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("project-overview-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.getByLabel("Projeyi düzenle").click();
  const edit = wizard(page);
  await expect(edit.getByLabel("Proje açıklaması")).toHaveValue("Personal finance SaaS for freelancers.");
  await edit.getByLabel("Proje açıklaması").fill("Personal finance SaaS for freelancers and studios.");
  await expect(edit.getByLabel("Aşama")).toHaveValue("production");
  await openDisclosure(edit, "Platformlar ve öncelikler");
  await expect(edit.getByRole("button", { name: "Offline first", pressed: true })).toBeVisible();
  await wizardStep(edit, "Gözden geçir");
  await edit.getByRole("button", { name: "Değişiklikleri kaydet" }).click();
  await expect(page.getByText("Atlas Finance kaydedildi.")).toBeVisible();

  let row = page.getByRole("row").filter({ hasText: "Atlas Finance" });
  await expect(row).toContainText("Next.js");
  await expect(row).toContainText("freelancers and studios");
  await page.screenshot({ path: testInfo.outputPath("projects-list-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await noHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("projects-list-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });

  await rowAction(row, "Atlas Finance işlemleri", "Arşivle");
  await expect(page.getByRole("heading", { name: "İlk projeni oluştur" })).toBeVisible();
  await page.getByRole("tab", { name: "Arşiv" }).click();
  row = page.getByRole("row").filter({ hasText: "Atlas Finance" });
  await expect(row).toContainText("Arşivlendi");
  await rowAction(row, "Atlas Finance işlemleri", "Geri yükle");
  await page.getByRole("tab", { name: /^Aktif/ }).click();
  row = page.getByRole("row").filter({ hasText: "Atlas Finance" });
  await expect(row).toBeVisible();

  await row.getByLabel("Atlas Finance projesini aç").click();
  await expect(page.getByText("Personal finance SaaS for freelancers and studios.").first()).toBeVisible();
  await sidebar.getByRole("link", { name: "Genel bakış" }).click();
  await expect(page).toHaveURL(/\/workspace$/);
  await expect(page.getByRole("link", { name: /Atlas Finance/ }).first()).toBeVisible();
});
