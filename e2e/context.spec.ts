import { expect, test } from "@playwright/test";
import { addResource, createProjectFromWizard, decisionRow, noHorizontalOverflow, openNewProject, projectSections, signUp, skipFirstRun, wizardStep, workspaceNav } from "./support/workspace";

test("user compiles project context, downloads an export and watches versions evolve", async ({ page }, testInfo) => {
  const email = `playwright-context-${Date.now()}@example.test`;

  await signUp(page, "Context Builder", email);
  await skipFirstRun(page);

  await workspaceNav(page).getByRole("link", { name: "Kütüphane", exact: true }).click();
  await addResource(page, { name: "Next.js", type: "framework", url: "https://nextjs.org" });

  await workspaceNav(page).getByRole("link", { name: "Projeler" }).click();
  const editor = await openNewProject(page);
  await editor.getByLabel("Proje adı *").fill("Context Lab");
  await wizardStep(editor, "Kurallar");
  await editor.getByRole("checkbox", { name: /Next\.js/ }).check();
  await createProjectFromWizard(editor, page);

  const sections = projectSections(page);
  await sections.getByRole("link", { name: "AI talimatları" }).click();
  await expect(page).toHaveURL(/\/context$/);
  await expect(page.getByRole("heading", { name: "Henüz oluşturulmadı" })).toBeVisible();

  await page.getByRole("button", { name: "Talimatları oluştur" }).click();
  await expect(page.getByText("Sürüm 1 oluşturuldu.")).toBeVisible();
  await expect(page.getByText("Güncel", { exact: true }).first()).toBeVisible();
  const panel = page.getByRole("region", { name: "Talimat önizlemesi" });
  await page.getByRole("button", { name: "Ham metin" }).click();
  await expect(panel).toContainText("# AGENTS.md — Context Lab");
  await expect(panel).toContainText("Prefer Next.js");
  await expect(panel).toContainText("https://nextjs.org");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Dışa aktar" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("AGENTS.md");
  await expect(page.getByText("AGENTS.md indirildi (sürüm 1).")).toBeVisible();
  if (await page.locator(".context-side details").getAttribute("open") === null) await page.getByText("Sürüm ve dışa aktarma geçmişi", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Dışa aktarma geçmişi" }).locator("..")).toContainText("AGENTS.md");

  await page.getByRole("button", { name: "Yeniden oluştur" }).click();
  await expect(page.getByText("Sürüm 1 sonrasında değişiklik yok.")).toBeVisible();

  await sections.getByRole("link", { name: "Teknoloji yığını" }).click();
  const frontend = decisionRow(page, "frontend.framework");
  await frontend.getByRole("button", { name: "Framework kararını düzenle" }).click();
  const lock = page.getByRole("dialog", { name: "Framework kararı" });
  await lock.getByRole("radio", { name: /^Kilitli/ }).check();
  await lock.getByRole("button", { name: "Kararı kaydet" }).click();
  await expect(frontend).toContainText("Kilitli");

  await sections.getByRole("link", { name: "AI talimatları" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Yenileme gerekli" })).toBeVisible();
  await page.getByRole("button", { name: "Yeniden oluştur" }).click();
  await expect(page.getByText("Sürüm 2 oluşturuldu.")).toBeVisible();
  await page.getByRole("button", { name: "Ham metin" }).click();
  await expect(panel).toContainText("Use Next.js. Do not replace it");
  await expect(panel).toContainText("Overrides: global PREFERRED");

  if (await page.locator(".context-side details").getAttribute("open") === null) await page.getByText("Sürüm ve dışa aktarma geçmişi", { exact: true }).click();
  await page.getByRole("button", { name: /^v1/ }).click();
  await expect(page.getByText("Sürüm 1 görüntüleniyor. Güncel sürüm 2.")).toBeVisible();
  await expect(panel).toContainText("Prefer Next.js");
  await page.getByRole("button", { name: "Güncel sürümü göster" }).click();
  await expect(panel).toContainText("Use Next.js. Do not replace it");
  await page.getByLabel("Coding agent").selectOption("canonical");
  await expect(panel).toContainText("\"compilerVersion\": \"0.4.1\"");
  await expect(panel).toContainText("\"source\": \"project\"");

  await page.screenshot({ path: testInfo.outputPath("context-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await noHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("context-mobile.png"), fullPage: true });
});
