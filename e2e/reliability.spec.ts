import { expect, test } from "@playwright/test";
import { unavailableWebUrl } from "../playwright.config";
import { addResource, createProjectFromWizard, noHorizontalOverflow, openNewProject, projectSections, signUp, skipFirstRun, workspaceNav } from "./support/workspace";

test("an unreachable API leaves the user with a clear, retryable screen instead of a sign-in bounce", async ({ page }, testInfo) => {
  await page.goto(`${unavailableWebUrl}/`);
  await expect(page.getByRole("status")).toHaveText("Bağlantı kurulamıyor");
  await page.goto(`${unavailableWebUrl}/workspace`);
  await expect(page).toHaveURL(/\/workspace$/);
  await expect(page.getByRole("heading", { name: "Çalışma alanına şu an ulaşılamıyor." })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "ulaşılamıyor" })).toContainText("Oturumunu yeniden açman gerekmiyor.");
  await page.getByRole("button", { name: "Yeniden dene" }).click();
  await expect(page.getByRole("heading", { name: "Çalışma alanına şu an ulaşılamıyor." })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("unavailable-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await noHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("unavailable-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${unavailableWebUrl}/workspace/projects`);
  await expect(page.getByRole("heading", { name: "Çalışma alanına şu an ulaşılamıyor." })).toBeVisible();
  await page.goto(`${unavailableWebUrl}/auth`);
  await expect(page.getByRole("status")).toContainText("ulaşılamıyor");
  await expect(page.getByRole("button", { name: "Hesap oluştur" })).toBeVisible();

  const response = await page.request.get(`${unavailableWebUrl}/`);
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).not.toContain("unsafe-eval");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("recoverable failures: a failed compile can be retried, unknown entities are explained and every change is auditable", async ({ page }, testInfo) => {
  const email = `playwright-reliability-${Date.now()}@example.test`;
  const sidebar = workspaceNav(page);

  await signUp(page, "Reliability Tester", email);
  await skipFirstRun(page);
  await expect(page.getByRole("list", { name: "Son etkinlikler" })).toContainText("Çalışma alanı oluşturuldu");

  await sidebar.getByRole("link", { name: "Kütüphane" }).click();
  await addResource(page, { name: "Fastify", type: "framework", url: "https://fastify.dev" });

  await sidebar.getByRole("link", { name: "Projeler" }).click();
  const wizard = await openNewProject(page);
  await wizard.getByLabel("Proje adı *").fill("Recovery Lab");
  await createProjectFromWizard(wizard, page);
  const projectUrl = page.url();
  const sections = projectSections(page);
  await sections.getByRole("link", { name: "AI talimatları" }).click();
  await expect(page.getByRole("heading", { name: "Henüz oluşturulmadı" })).toBeVisible();

  // The first compile fails at the API; the screen reports it and stays usable.
  await page.route("**/api/projects/*/compile", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ error: { code: "SERVICE_UNAVAILABLE", message: "Database is unavailable", requestId: "req-playwright" } }),
  }), { times: 1 });
  await page.getByRole("button", { name: "Talimatları oluştur" }).click();
  await expect(page.getByText("Database is unavailable")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Henüz oluşturulmadı" })).toBeVisible();
  await page.getByRole("button", { name: "Talimatları oluştur" }).click();
  await expect(page.getByText("Sürüm 1 oluşturuldu.")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("context-recovered-desktop.png"), fullPage: true });

  // Responses carry a request id, rate-limit budget and no-store caching through the proxy.
  const api = await page.request.get("/api/projects?limit=1");
  expect(api.status()).toBe(200);
  const headers = api.headers();
  expect(headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  expect(headers["cache-control"]).toBe("no-store");
  expect(Number(headers["x-ratelimit-limit"])).toBeGreaterThan(0);

  // Foreign or missing entities look identical and land on the not-found screen.
  await page.goto("/workspace/projects/00000000-0000-4000-8000-000000000000");
  await expect(page.getByRole("heading", { name: "Bu sayfa çalışma alanında bulunamadı." })).toBeVisible();
  await page.getByRole("link", { name: "Genel bakışa dön" }).click();
  await expect(page).toHaveURL(/\/workspace$/);

  const activity = page.getByRole("list", { name: "Son etkinlikler" });
  await expect(activity).toContainText("Talimatlar oluşturuldu");
  await expect(activity).toContainText("Proje oluşturuldu");
  await expect(activity).toContainText("Kaynak kaydedildi");
  await expect(activity).not.toContainText("Fastify");
  await expect(activity).not.toContainText("Recovery Lab");
  await page.screenshot({ path: testInfo.outputPath("overview-activity-desktop.png"), fullPage: true });
  await page.goto(projectUrl);
  await expect(page.getByRole("heading", { name: /Recovery Lab/ })).toBeVisible();
});
