import { expect, test } from "@playwright/test";
import { addDecision, addResource, createProjectFromWizard, decisionRow, openNewProject, projectSections, signUp, skipFirstRun, workspaceNav } from "./support/workspace";

/**
 * AI groundwork end to end with the deterministic test provider (AI_PROVIDER=fake
 * in playwright.config.ts): nothing is sent before consent, a proposal only
 * names a Library resource, and it changes the Project only when accepted.
 */
test("AI suggestions: consent first, a proposal from the Library, accepted as a project decision", async ({ page }) => {
  const email = `playwright-ai-${Date.now()}@example.test`;
  await signUp(page, "AI Reviewer", email);
  await skipFirstRun(page);

  await workspaceNav(page).getByRole("link", { name: "Kütüphane", exact: true }).click();
  await addResource(page, { name: "Fastify", type: "framework", rule: null });
  await addResource(page, { name: "Hono", type: "framework", rule: null });

  await workspaceNav(page).getByRole("link", { name: "Projeler" }).click();
  const editor = await openNewProject(page);
  await editor.getByLabel("Proje adı *").fill("AI Lab");
  await editor.getByRole("radio", { name: /^Düşük/ }).check();
  await createProjectFromWizard(editor, page);
  await projectSections(page).getByRole("link", { name: "Teknoloji yığını" }).click();
  await expect(page).toHaveURL(/\/stack$/);
  const stackUrl = page.url();

  // Delegate the backend framework, allowing only Hono.
  const delegate = await addDecision(page, "backend.framework", "Framework kararı");
  await delegate.getByRole("radio", { name: /^AI karar versin/ }).check();
  await delegate.getByLabel("İzin verilen seçenek ekle").fill("Hono");
  await delegate.getByLabel("İzin verilen seçenek ekle").press("Enter");
  await delegate.getByRole("button", { name: "Kararı kaydet" }).click();
  const backend = decisionRow(page, "backend.framework");
  await expect(backend).toContainText("AI karar versin");

  // Without consent the editor explains where to allow it and offers no request.
  await backend.getByRole("button", { name: "Framework kararını düzenle" }).click();
  const decision = page.getByRole("dialog", { name: "Framework kararı" });
  await expect(decision.getByRole("link", { name: "Ayarlar › Gizlilik ve veriler" })).toBeVisible();
  await expect(decision.getByRole("button", { name: "AI önerisi iste" })).toHaveCount(0);

  await page.goto("/workspace/settings?section=privacy");
  // The switch follows the saved state, so it flips only after the API confirmed the consent.
  await page.getByRole("checkbox", { name: "İzin ver" }).click();
  await expect(page.getByText("AI önerilerine izin verildi.")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "İzin verildi" })).toBeChecked();
  await expect(page.getByText(/Bu ay: 0\/\d+ öneri/)).toBeVisible();

  // A proposal names a Library resource and changes nothing until it is accepted.
  await page.goto(stackUrl);
  await decisionRow(page, "backend.framework").getByRole("button", { name: "Framework kararını düzenle" }).click();
  const withConsent = page.getByRole("dialog", { name: "Framework kararı" });
  await withConsent.getByRole("button", { name: "AI önerisi iste" }).click();
  const proposal = withConsent.getByRole("region", { name: "Önerilen seçim" });
  await expect(proposal).toContainText("Hono");
  await expect(proposal).toContainText("test sağlayıcısı");
  await expect(decisionRow(page, "backend.framework")).toContainText("AI karar versin");

  await proposal.getByRole("button", { name: "Tercih edilen olarak kabul et" }).click();
  await expect(page.getByText("Framework için AI önerisi kabul edildi.")).toBeVisible();
  const accepted = decisionRow(page, "backend.framework");
  await expect(accepted).toContainText("Tercih edilen");
  await expect(accepted).toContainText("Hono");

  // The accepted choice survives a reload and the quota counts the request.
  await page.reload();
  await expect(decisionRow(page, "backend.framework")).toContainText("Hono");
  await page.goto("/workspace/settings?section=privacy");
  await expect(page.getByText(/Bu ay: 1\/\d+ öneri/)).toBeVisible();
});
