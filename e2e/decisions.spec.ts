import { expect, test } from "@playwright/test";
import { addDecision, createProjectFromWizard, decisionRow, noHorizontalOverflow, openNewProject, projectSections, signUp, skipFirstRun, workspaceNav } from "./support/workspace";

test("user locks a frontend choice, delegates the backend to AI and restores Library inheritance", async ({ page }, testInfo) => {
  const email = `playwright-decisions-${Date.now()}@example.test`;

  await signUp(page, "Decision Maker", email);
  await skipFirstRun(page);

  // A preferred framework in the Library becomes an inherited global rule.
  await workspaceNav(page).getByRole("link", { name: "Kütüphane", exact: true }).click();
  await page.getByRole("button", { name: "Kaynak ekle" }).click();
  const drawer = page.getByRole("dialog", { name: "Kaynak ekle" });
  await drawer.getByLabel("Ad *").fill("Next.js");
  await drawer.getByLabel("Tür *").selectOption("framework");
  await expect(drawer.getByLabel("Karar alanı *")).toHaveValue("frontend.framework");
  await drawer.getByRole("button", { name: "Kaynağı kaydet" }).click();
  await expect(page.getByRole("heading", { name: "Next.js" })).toBeVisible();

  await workspaceNav(page).getByRole("link", { name: "Projeler" }).click();
  const editor = await openNewProject(page);
  await editor.getByLabel("Proje adı *").fill("Decision Lab");
  // Keep the project free of preset placeholders so the counts below reflect only explicit decisions.
  await editor.getByRole("radio", { name: /^Düşük/ }).check();
  await createProjectFromWizard(editor, page);
  const stackCard = page.getByRole("region", { name: "Teknoloji yığını" });
  await expect(stackCard).toContainText("Next.js");
  await expect(stackCard).toContainText("karar");

  const sections = projectSections(page);
  await sections.getByRole("link", { name: "Teknoloji yığını" }).click();
  await expect(page).toHaveURL(/\/stack$/);
  const frontend = decisionRow(page, "frontend.framework");
  await expect(frontend).toContainText("Tercih edilen");
  await expect(frontend).toContainText("Next.js");
  await expect(frontend).toContainText("Kütüphane");
  await expect(page.getByRole("status").filter({ hasText: "Kütüphane kuralından" })).toContainText("1 Kütüphane kuralından");

  // Override the inherited rule with a project-level lock.
  await frontend.getByRole("button", { name: "Framework kararını düzenle" }).click();
  const lock = page.getByRole("dialog", { name: "Framework kararı" });
  await expect(lock.getByRole("note").first()).toContainText("Kütüphane");
  await expect(lock.getByRole("radio", { name: /^Tercih edilen/ })).toBeChecked();
  await lock.getByRole("radio", { name: /^Kilitli/ }).check();
  await lock.getByRole("textbox", { name: "Gerekçe", exact: true }).fill("Team standard for every web product.");
  await lock.getByRole("button", { name: "Kararı kaydet" }).click();
  await expect(frontend).toContainText("Kilitli");
  await expect(frontend).toContainText("Proje");

  // Delegate the backend framework deliberately, without a resource.
  const delegate = await addDecision(page, "backend.framework", "Framework kararı");
  await delegate.getByRole("radio", { name: /^AI karar versin/ }).check();
  await expect(delegate.getByText("Bu kararda kaynak seçilmez.")).toBeVisible();
  await delegate.getByLabel("İzin verilen seçenek ekle").fill("Fastify");
  await delegate.getByLabel("İzin verilen seçenek ekle").press("Enter");
  await delegate.getByLabel("İzin verilen seçenek ekle").fill("Hono");
  await delegate.getByLabel("İzin verilen seçenek ekle").press("Enter");
  await delegate.getByLabel("Kısıt notları").fill("TypeScript only, no decorators.");
  await delegate.getByRole("button", { name: "Kararı kaydet" }).click();
  const backend = decisionRow(page, "backend.framework");
  await expect(backend).toContainText("AI karar versin");
  await expect(backend).toContainText("İzin verilen: Fastify, Hono");

  await page.reload();
  await expect(decisionRow(page, "frontend.framework")).toContainText("Kilitli");
  await expect(decisionRow(page, "backend.framework")).toContainText("AI karar versin");
  await expect(page.getByRole("status").filter({ hasText: "proje kararı" })).toContainText("2 proje kararı");
  await page.screenshot({ path: testInfo.outputPath("stack-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await noHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("stack-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });

  // Removing the override reveals the Library rule again instead of deleting it.
  await decisionRow(page, "frontend.framework").getByRole("button", { name: "Framework kararını düzenle" }).click();
  const override = page.getByRole("dialog", { name: "Framework kararı" });
  await expect(override.getByRole("radio", { name: /^Kilitli/ })).toBeChecked();
  await override.getByRole("button", { name: "Kütüphane tercihini kullan" }).first().click();
  const restored = decisionRow(page, "frontend.framework");
  await expect(restored).toContainText("Tercih edilen");
  await expect(restored).toContainText("Kütüphane");
  await expect(page.getByText("Framework yeniden Kütüphane tercihini izliyor.")).toBeVisible();

  await sections.getByRole("link", { name: "Genel bakış" }).click();
  await expect(page.getByText("2 karar", { exact: true })).toBeVisible();
  await expect(page.getByText("AI karar versin").first()).toBeVisible();
});
