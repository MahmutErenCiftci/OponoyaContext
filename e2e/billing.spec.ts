import { expect, test } from "@playwright/test";
import { noHorizontalOverflow, openMoreMenu, signUp, skipFirstRun } from "./support/workspace";

test("free limits are enforced by the API, and the test-mode provider upgrades, manages and downgrades the plan", async ({ page }, testInfo) => {
  const email = `playwright-billing-${Date.now()}@example.test`;

  await signUp(page, "Billing Tester", email);
  await skipFirstRun(page);

  // Three projects fit the Free plan; the fourth is refused by the API with a plain explanation.
  for (const name of ["Alpha", "Beta", "Gamma"]) {
    const response = await page.request.post("/api/projects", { data: { name } });
    expect(response.status(), name).toBe(201);
  }
  const fourth = await page.request.post("/api/projects", { data: { name: "Delta" } });
  expect(fourth.status()).toBe(403);
  const refusal = (await fourth.json()) as { error: { message: string; details: Array<{ code: string }> } };
  expect(refusal.error.details[0]?.code).toBe("plan_limit");
  expect(refusal.error.message).toBe("Your Free plan allows 3 active projects. Archive one, or upgrade to Pro on the Plan page.");
  const cursorExport = await page.request.post(`/api/projects/${(await (await page.request.get("/api/projects?limit=1")).json() as { projects: Array<{ id: string }> }).projects[0]!.id}/exports`, { data: { target: "cursor" } });
  expect(cursorExport.status()).toBe(403);

  // The Plan page shows the same numbers and an honest comparison.
  await openMoreMenu(page, "Abonelik");
  await expect(page.getByRole("heading", { name: "Abonelik" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Free plan" })).toBeVisible();
  await expect(page.getByLabel("3 / 3 aktif projeler kullanıldı")).toBeVisible();
  await expect(page.getByRole("table")).toContainText("Cursor rules (.mdc) dışa aktarımı");
  await expect(page.getByText("Test modu · gerçek ödeme yok")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("billing-free-desktop.png"), fullPage: true });

  // Upgrade through the simulated provider: the outcome arrives as a signed webhook before the redirect.
  await page.getByRole("button", { name: "Pro’ya geç" }).click();
  await expect(page).toHaveURL(/\/billing\/checkout\?session=cs_fake_/);
  await expect(page.getByRole("heading", { name: "Pro planı için test ödemesi" })).toBeVisible();
  await page.getByRole("button", { name: "Öde ve Pro’yu etkinleştir" }).click();
  // The simulated provider delivers the webhook before answering, then the browser is sent back.
  await expect(page).toHaveURL(/\/workspace\/billing\?billing=success$/, { timeout: 15_000 });
  await expect(page.getByRole("status")).toContainText("Pro planın etkin.");
  await expect(page.getByRole("heading", { name: "Pro plan" })).toBeVisible();
  await expect(page.getByText(/^Pro .* tarihinde yenilenir\.$/)).toBeVisible();
  await expect(page.getByLabel("3 / 500 aktif projeler kullanıldı")).toBeVisible();
  expect((await page.request.post("/api/projects", { data: { name: "Delta" } })).status()).toBe(201);
  await page.screenshot({ path: testInfo.outputPath("billing-pro-desktop.png"), fullPage: true });

  // Manage: cancel at period end keeps Pro until the period ends; a failed renewal shows a payment problem.
  await page.getByRole("button", { name: "Aboneliği yönet" }).click();
  await expect(page).toHaveURL(/\/billing\/portal\?customer=cus_fake_/);
  await page.getByRole("button", { name: "Dönem sonunda iptal et" }).click();
  await expect(page).toHaveURL(/\/workspace\/billing\?billing=portal$/);
  await expect(page.getByText(/^Pro iptal edildi ve .* tarihine kadar etkin kalır/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pro plan" })).toBeVisible();
  await page.getByRole("button", { name: "Aboneliği yönet" }).click();
  await page.getByRole("button", { name: "Başarısız yenileme simüle et" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Ödeme sorunu" })).toContainText("Ödeme sorunu");
  await expect(page.getByRole("heading", { name: "Pro plan" })).toBeVisible();

  // Ending the subscription drops to Free without deleting anything; the Pro-only features close again.
  await page.getByRole("button", { name: "Aboneliği yönet" }).click();
  await page.getByRole("button", { name: "Aboneliği şimdi bitir" }).click();
  await expect(page.getByRole("heading", { name: "Free plan" })).toBeVisible();
  await expect(page.getByText("Pro iptal edildi. Free plandasın; hiçbir şey silinmedi.")).toBeVisible();
  expect(((await (await page.request.get("/api/projects?limit=10")).json()) as { total: number }).total).toBe(4);
  expect((await page.request.post("/api/projects", { data: { name: "Epsilon" } })).status()).toBe(403);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Abonelik" })).toBeVisible();
  await noHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("billing-mobile.png") });
});
