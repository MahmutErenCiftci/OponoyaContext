import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { upgradeToPro } from "./support/billing";
import { decisionRow, noHorizontalOverflow, openMoreMenu, projectSections, signUp, workspaceNav } from "./support/workspace";

test("first run: sample data, recipe inheritance, bundle download, export and import round trip, removal", async ({ page }, testInfo) => {
  const email = `playwright-portability-${Date.now()}@example.test`;
  const sidebar = workspaceNav(page);

  await signUp(page, "Portability Tester", email);
  await expect(page.getByRole("heading", { name: "Çalışma alanın hazır." })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("first-run-desktop.png"), fullPage: true });

  // Sample data is opt-in and versioned; installing it advances the checklist.
  await page.getByRole("radio", { name: /^Örneklerle başla/ }).check();
  await page.getByRole("button", { name: "Örnekleri ekle ve başla" }).click();
  await expect(page.getByRole("heading", { name: "Örneklerin hazır." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kurulum: 2 / 4 tamamlandı" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Son etkinlikler" })).toContainText("Örnek veriler yüklendi");

  // The recipe exists with its profiles and decisions.
  await openMoreMenu(page, "Tarifler");
  await expect(page.getByRole("heading", { name: "Sample · SaaS MVP" })).toBeVisible();
  await page.getByRole("link", { name: "Sample · SaaS MVP", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Sample · SaaS MVP/, level: 1 })).toBeVisible();
  const attached = page.getByRole("list", { name: "Bağlı profiller" });
  await expect(attached).toContainText("Sample · Fast SaaS stack");
  await expect(attached).toContainText("Sample · Design defaults");
  await expect(decisionRow(page, "database.cache")).toContainText("Devre dışı");
  await expect(decisionRow(page, "backend.framework")).toContainText("AI karar versin");

  // The sample project inherits through the recipe; provenance is explicit on the Stack.
  await sidebar.getByRole("link", { name: "Projeler" }).click();
  await page.getByRole("link", { name: "Sample · Atlas Finance", exact: true }).first().click();
  await expect(page).toHaveURL(/\/workspace\/projects\/[0-9a-f-]{36}$/);
  await expect(page.locator(".brief-item").filter({ hasText: "Kaynak tarif" })).toContainText("Sample · SaaS MVP");
  const sections = projectSections(page);
  await sections.getByRole("link", { name: "Teknoloji yığını" }).click();
  await expect(decisionRow(page, "database.cache")).toContainText("Sample · SaaS MVP");
  await expect(decisionRow(page, "frontend.framework")).toContainText("Sample · Fast SaaS stack");
  await page.screenshot({ path: testInfo.outputPath("stack-recipe-desktop.png"), fullPage: true });

  // Compile and download the bundle.
  await sections.getByRole("link", { name: "AI talimatları" }).click();
  await page.getByRole("button", { name: "Talimatları oluştur" }).click();
  await expect(page.getByText("Sürüm 1 oluşturuldu.")).toBeVisible();
  await page.getByLabel("Coding agent").selectOption("claude");
  await page.getByRole("button", { name: "Ham metin" }).click();
  await expect(page.getByRole("region", { name: "Talimat önizlemesi" })).toContainText('Source: recipe "Sample · SaaS MVP"');
  // The zipped bundle is a Pro feature; the Free plan gets the reason, then the test-mode provider upgrades the account.
  await page.getByRole("button", { name: "Tüm dosyalar (.zip)" }).click();
  await expect(page.getByText("The zipped context bundle is a Pro feature. Upgrade on the Plan page to use it.")).toBeVisible();
  await upgradeToPro(page);
  const bundleDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tüm dosyalar (.zip)" }).click();
  const bundle = await bundleDownload;
  expect(bundle.suggestedFilename()).toMatch(/^sample-atlas-finance-[a-f0-9]{8}-context-v1\.zip$/);
  await expect(page.getByText(/context-v1\.zip indirildi/)).toBeVisible();
  if (await page.locator(".context-side details").getAttribute("open") === null) await page.getByText("Sürüm ve dışa aktarma geçmişi", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Dışa aktarma geçmişi" }).locator("..")).toContainText("context-v1.zip");

  // Export the workspace: structured data, no secrets.
  await openMoreMenu(page, "Ayarlar");
  await expect(page.getByRole("heading", { name: "Ayarlar" })).toBeVisible();
  const exportDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "Çalışma alanını dışa aktar" }).click();
  const exported = await exportDownload;
  expect(exported.suggestedFilename()).toMatch(/^devcontext-export-\d{4}-\d{2}-\d{2}\.json$/);
  const exportPath = await exported.path();
  const text = await readFile(exportPath, "utf8");
  const exportedDocument = JSON.parse(text) as { format: string; version: number; resources: Array<{ ref: string; preference: unknown }>; recipes: unknown[]; projects: unknown[] };
  expect(exportedDocument.format).toBe("devcontext");
  expect(exportedDocument.version).toBe(1);
  expect(exportedDocument.resources).toHaveLength(8);
  expect(exportedDocument.recipes).toHaveLength(1);
  expect(exportedDocument.projects).toHaveLength(1);
  for (const forbidden of [email, '"password":', '"session_token":', '"contentHash":']) expect(text).not.toContain(forbidden);

  // Import the same file: the dry run shows skips first, then copies are created only after confirmation.
  await page.getByLabel("İçe aktarılacak dosya").setInputFiles(exportPath);
  await expect(page.getByRole("heading", { name: /Ön kontrol: “Mevcutları koru” ile 0 kayıt yazılacak/ })).toBeAttached();
  await expect(page.getByRole("button", { name: "0 kaydı içe aktar" })).toBeDisabled();
  await page.getByRole("radio", { name: /^Kopya oluştur/ }).check();
  await expect(page.getByRole("heading", { name: /Ön kontrol: “Kopya oluştur” ile 13 kayıt yazılacak/ })).toBeAttached();
  await expect(page.getByText("Henüz hiçbir kayıt değiştirilmedi.")).toBeVisible();
  await page.getByRole("button", { name: "13 kaydı içe aktar" }).click();
  await expect(page.getByRole("status").filter({ hasText: "İçe aktarma tamamlandı: 13 kayıt yazıldı." })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("settings-import-desktop.png"), fullPage: true });
  await sidebar.getByRole("link", { name: "Kütüphane" }).click();
  await page.getByLabel("Kaynaklarda ara").fill("(imported)");
  await page.getByLabel("Kaynaklarda ara").press("Enter");
  await expect(page.getByRole("heading", { name: "Sample · Next.js (imported)" })).toBeVisible();

  // The copies still inherit Library preferences pointing to the originals.
  // Removal must explain the conflict and preserve everything.
  await openMoreMenu(page, "Ayarlar");
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Örnekleri kaldır" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Nothing was deleted" })).toBeVisible();
  // Explicitly clear those inherited preferences through the authenticated API.
  for (const resource of exportedDocument.resources.filter((item) => item.preference)) {
    const response = await page.request.patch(`/api/resources/${resource.ref}`, { data: { preference: null } });
    expect(response.ok()).toBe(true);
  }
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Örnekleri kaldır" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Örnek veriler kaldırıldı: 8 kaynak" })).toBeVisible();
  await sidebar.getByRole("link", { name: "Kütüphane" }).click();
  await expect(page.getByRole("heading", { name: "Sample · Next.js (imported)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sample · Next.js", exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await openMoreMenu(page, "Ayarlar");
  await expect(page.getByRole("heading", { name: "Ayarlar" })).toBeVisible();
  await noHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("settings-mobile.png"), fullPage: true });
});

test("first run can be skipped and resumed from Settings", async ({ page }) => {
  const email = `playwright-skip-${Date.now()}@example.test`;
  await signUp(page, "Skip Tester", email);
  await expect(page.getByRole("heading", { name: "Çalışma alanın hazır." })).toBeVisible();
  await page.getByRole("button", { name: "Şimdilik atla" }).click();
  await expect(page.getByRole("heading", { name: "Çalışma alanın hazır." })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Kurulum: 0 / 4 tamamlandı" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Çalışma alanın hazır." })).toHaveCount(0);
  await openMoreMenu(page, "Ayarlar");
  await expect(page.getByRole("region", { name: "Hesap bilgileri" })).toContainText("atlandı");
  await page.getByRole("button", { name: "Rehberi yeniden göster" }).click();
  await expect(page.getByRole("status").filter({ hasText: "yeniden gösterilecek" })).toBeVisible();
  await workspaceNav(page).getByRole("link", { name: "Genel bakış" }).click();
  await expect(page.getByRole("heading", { name: "Çalışma alanın hazır." })).toBeVisible();
  await page.getByRole("radio", { name: /^Kendi tercihlerimle başlayacağım/ }).check();
  await page.getByRole("button", { name: "İlk kaynağımı ekle" }).click();
  await expect(page).toHaveURL(/\/workspace\/library\?add=1$/);
  await expect(page.getByRole("dialog", { name: "Kaynak ekle" })).toBeVisible();
  await page.getByLabel("Kaynak düzenleyiciyi kapat").click();
  await workspaceNav(page).getByRole("link", { name: "Genel bakış" }).click();
  await expect(page.getByRole("heading", { name: "Çalışma alanın hazır." })).toHaveCount(0);
});
