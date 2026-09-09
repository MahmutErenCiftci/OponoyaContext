import { expect, test } from "@playwright/test";
import { upgradeToPro } from "./support/billing";
import { addDecision, addResource, createProjectFromWizard, decisionRow, noHorizontalOverflow, openNewProject, projectSections, rowAction, signUp, skipFirstRun, wizardStep, workspaceNav } from "./support/workspace";

test("onboarding checklist, search palette, favorites, duplicate evidence, clone and diff", async ({ page }, testInfo) => {
  const email = `playwright-usability-${Date.now()}@example.test`;
  const sidebar = workspaceNav(page);

  await signUp(page, "Usability Tester", email);
  await skipFirstRun(page);
  const checklist = page.getByRole("list", { name: "Kurulum adımları" });
  await expect(page.getByRole("heading", { name: "Kurulum: 0 / 4 tamamlandı" })).toBeVisible();
  await expect(checklist).toContainText("Kütüphanene beş kaynak ekle");

  // Library: favorites, quick views and duplicate evidence.
  await sidebar.getByRole("link", { name: "Kütüphane" }).click();
  for (const [name, type, url] of [
    ["Next.js", "framework", "https://nextjs.org"],
    ["PostgreSQL", "database", "https://www.postgresql.org"],
    ["Drizzle ORM", "orm", "https://orm.drizzle.team"],
    ["Better Auth", "auth", "https://www.better-auth.com"],
    ["shadcn/ui", "ui_library", "https://ui.shadcn.com"],
  ] as const) {
    await addResource(page, { name, type, url, rule: null });
  }
  await addResource(page, { name: "Next JS", type: "framework", url: "https://www.nextjs.org/?utm_source=newsletter", rule: null });
  const toast = page.getByRole("status").filter({ hasText: "kopyası olabilir" });
  await expect(toast).toContainText("Aynı kaynak bağlantısı:");
  await expect(toast.getByRole("link", { name: "Next.js" })).toBeVisible();

  await page.getByLabel("Next.js favorilere ekle").click();
  await expect(page.getByLabel("Next.js favorilerden kaldır")).toBeVisible();
  await page.getByRole("tab", { name: "Favoriler" }).click();
  await expect(page).toHaveURL(/view=favorites/);
  await expect(page.getByRole("heading", { name: "Next.js", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "PostgreSQL" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Next.js", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "PostgreSQL" })).toHaveCount(0);
  await page.getByRole("tab", { name: "Tümü" }).click();
  await expect(page.getByRole("heading", { name: "PostgreSQL" })).toBeVisible();

  // Compatibility rule curated from the resource editor.
  await rowAction(page.getByRole("row").filter({ hasText: "Drizzle ORM" }), "Drizzle ORM işlemleri", "Düzenle");
  const editor = page.getByRole("dialog", { name: "Kaynağı düzenle" });
  await expect(editor.getByText("Bu kaynakla ilgili uyumluluk kuralı yok.")).toBeVisible();
  await editor.getByRole("combobox", { name: "Kural", exact: true }).selectOption("requires");
  await editor.getByRole("combobox", { name: "Diğer kaynak", exact: true }).selectOption({ label: "PostgreSQL · Veritabanı" });
  await editor.getByLabel("Gerekçe (isteğe bağlı)").fill("Drizzle here always targets PostgreSQL.");
  await editor.getByRole("button", { name: "Kural ekle" }).click();
  await expect(editor.getByText("Drizzle here always targets PostgreSQL.")).toBeVisible();
  await editor.getByRole("button", { name: "Kaynağı kaydet" }).click();
  await expect(page.getByRole("heading", { name: "Drizzle ORM" })).toBeVisible();

  // Command palette finds owner-scoped entities and quick actions.
  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Çalışma alanında ara" });
  await expect(palette.getByRole("option", { name: /Yeni proje/ })).toBeVisible();
  await palette.getByRole("combobox").fill("postgres");
  await expect(palette.getByRole("option", { name: /PostgreSQL/ })).toBeVisible();
  await palette.getByRole("combobox").press("Enter");
  await expect(page).toHaveURL(/\/workspace\/library\?q=PostgreSQL/);
  await expect(page.getByRole("heading", { name: "PostgreSQL" })).toBeVisible();

  // Project with a rule-triggering choice: impact warning appears without changing anything.
  await sidebar.getByRole("link", { name: "Projeler" }).click();
  const wizard = await openNewProject(page);
  await wizard.getByLabel("Proje adı *").fill("Atlas");
  await wizardStep(wizard, "Teknoloji kararları");
  await wizard.getByRole("tab", { name: "Veri", exact: true }).click();
  const queryLayer = wizard.getByRole("group", { name: "Sorgu katmanı için karar biçimi" });
  await queryLayer.getByRole("button", { name: "Kilitli" }).click();
  await wizard.getByLabel("Sorgu katmanı kaynağı").selectOption({ label: "Drizzle ORM · ORM / query" });
  await createProjectFromWizard(wizard, page);
  const sections = projectSections(page);
  await sections.getByRole("link", { name: "Teknoloji yığını" }).click();
  const impact = page.getByRole("region", { name: /Etki uyarıları/ });
  await expect(impact).toContainText("MISSING_REQUIREMENT");
  await expect(impact).toContainText("Drizzle ORM requires PostgreSQL");
  await expect(decisionRow(page, "database.query_layer")).toContainText("Kilitli");

  // Compile twice with a change in between, then read the semantic diff.
  await sections.getByRole("link", { name: "AI talimatları" }).click();
  await page.getByRole("button", { name: "Talimatları oluştur" }).click();
  await expect(page.getByText("Sürüm 1 oluşturuldu.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /1 uyarı/ })).toBeVisible();
  await sections.getByRole("link", { name: "Teknoloji yığını" }).click();
  const decide = await addDecision(page, "database.primary", "Veritabanı kararı");
  await decide.getByRole("radio", { name: /^Kilitli/ }).check();
  await decide.getByLabel("Kaynak *").selectOption({ label: "PostgreSQL · Veritabanı" });
  await decide.getByRole("button", { name: "Kararı kaydet" }).click();
  await expect(decisionRow(page, "database.primary")).toContainText("Kilitli");
  await expect(page.getByRole("region", { name: /Etki uyarıları/ })).toHaveCount(0);
  await sections.getByRole("link", { name: "AI talimatları" }).click();
  await page.getByRole("button", { name: "Yeniden oluştur" }).click();
  await expect(page.getByText("Sürüm 2 oluşturuldu.")).toBeVisible();
  // The diff is a Pro feature: the Free plan sees the reason, and the API keeps refusing until the plan changes.
  await page.getByLabel("Coding agent").selectOption("diff");
  await expect(page.getByRole("alert").filter({ hasText: "Pro feature" })).toContainText("Version diff is a Pro feature. Upgrade on the Plan page to use it.");
  await upgradeToPro(page);
  await page.getByRole("button", { name: "Güncel talimatları aç" }).click();
  await page.getByLabel("Coding agent").selectOption("diff");
  const changes = page.getByRole("list", { name: "Değişiklikler" });
  await expect(changes).toContainText("Veritabanı");
  await expect(changes).toContainText("Eklendi");
  await expect(changes).toContainText("Çözüldü");
  await expect(changes).toContainText("MISSING_REQUIREMENT");
  await page.screenshot({ path: testInfo.outputPath("diff-desktop.png"), fullPage: true });

  // Clone copies decisions; the clone compiles from a fresh history.
  await sections.getByRole("link", { name: "Genel bakış" }).click();
  await expect(page.getByRole("heading", { name: "Teknoloji yığını", exact: true })).toBeVisible();
  await page.getByLabel("Diğer işlemler").click();
  await page.getByRole("button", { name: "Kopyala" }).click();
  const cloneDialog = page.getByRole("dialog", { name: /kopyala/ });
  await cloneDialog.getByLabel("Kopyanın adı *").fill("Atlas Europe");
  await cloneDialog.getByRole("button", { name: "Projeyi kopyala" }).click();
  await expect(page).toHaveURL(/\/workspace\/projects\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: /Atlas Europe/ })).toBeVisible();
  const clonedStack = page.getByRole("region", { name: "Teknoloji yığını" });
  await expect(clonedStack).toContainText("Drizzle ORM");
  await expect(clonedStack).toContainText("PostgreSQL");
  await sections.getByRole("link", { name: "AI talimatları" }).click();
  await expect(page.getByRole("heading", { name: "Henüz oluşturulmadı" })).toBeVisible();

  // Save as profile reuses the project's own decisions.
  await sections.getByRole("link", { name: "Genel bakış" }).click();
  await expect(page.getByRole("heading", { name: "Teknoloji yığını", exact: true })).toBeVisible();
  await page.getByLabel("Diğer işlemler").click();
  await page.getByRole("button", { name: "Profil olarak kaydet" }).click();
  const profileDialog = page.getByRole("dialog", { name: "Kararları profil olarak kaydet" });
  await profileDialog.getByLabel("Profil adı *").fill("Data stack");
  await profileDialog.getByRole("button", { name: "Profil oluştur" }).click();
  await expect(page).toHaveURL(/\/workspace\/profiles\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: /Data stack/ })).toBeVisible();
  await expect(decisionRow(page, "database.primary")).toContainText("Kilitli");

  // Onboarding progress is real: resources, project and compile are done; export is pending.
  await sidebar.getByRole("link", { name: "Genel bakış" }).click();
  await expect(page.getByRole("heading", { name: "Kurulum: 3 / 4 tamamlandı" })).toBeVisible();
  await expect(checklist).toContainText("Bir coding agent’a aktar");
  await page.setViewportSize({ width: 390, height: 844 });
  await noHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("dashboard-mobile.png"), fullPage: true });
});
