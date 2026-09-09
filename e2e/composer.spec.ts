import { expect, test } from "@playwright/test";
import { addDecision, addResource, decisionRow, noHorizontalOverflow, openMoreMenu, openNewProject, projectSections, signUp, skipFirstRun, wizardStep, workspaceNav } from "./support/workspace";

test("two projects reuse one profile with different overrides and compile to different context", async ({ page }, testInfo) => {
  const email = `playwright-composer-${Date.now()}@example.test`;
  const sidebar = workspaceNav(page);

  await signUp(page, "Composer", email);
  await skipFirstRun(page);

  // Two Library resources without global rules, so inheritance comes only from the profile.
  await sidebar.getByRole("link", { name: "Kütüphane" }).click();
  await addResource(page, { name: "Next.js", type: "framework", rule: null });
  await addResource(page, { name: "PostgreSQL", type: "database", rule: null });

  // A reusable stack profile with two decisions.
  await openMoreMenu(page, "Profiller");
  await expect(page).toHaveURL(/\/workspace\/profiles$/);
  await page.getByRole("button", { name: "Profil oluştur" }).click();
  const profileEditor = page.getByRole("dialog", { name: "Profil oluştur" });
  await profileEditor.getByLabel("Profil adı *").fill("Fast SaaS");
  await profileEditor.getByRole("radio", { name: /^Teknoloji seti/ }).check();
  await profileEditor.getByRole("button", { name: "Profil oluştur" }).click();
  await expect(page).toHaveURL(/\/workspace\/profiles\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: /Fast SaaS/ })).toBeVisible();

  let editor = await addDecision(page, "frontend.framework", "Framework kararı");
  await editor.getByRole("radio", { name: /^Kilitli/ }).check();
  await editor.getByLabel("Kaynak *").selectOption({ label: "Next.js · Framework" });
  await editor.getByRole("button", { name: "Kararı kaydet" }).click();
  const framework = decisionRow(page, "frontend.framework");
  await expect(framework).toContainText("Kilitli");
  await expect(framework).toContainText("Next.js");

  editor = await addDecision(page, "database.primary", "Veritabanı kararı");
  await editor.getByRole("radio", { name: /^Tercih edilen/ }).check();
  await editor.getByLabel("Kaynak *").selectOption({ label: "PostgreSQL · Veritabanı" });
  await editor.getByRole("button", { name: "Kararı kaydet" }).click();
  await expect(decisionRow(page, "database.primary")).toContainText("Tercih edilen");
  await page.screenshot({ path: testInfo.outputPath("profile-desktop.png"), fullPage: true });

  // Project one inherits everything from the profile.
  await sidebar.getByRole("link", { name: "Projeler" }).click();
  let wizard = await openNewProject(page);
  await wizard.getByLabel("Proje adı *").fill("Atlas");
  await wizard.getByText("Profilleri ayrı seç", { exact: true }).click();
  await wizard.getByRole("checkbox", { name: /Fast SaaS/ }).check();
  await wizard.getByRole("radio", { name: /^Dengeli/ }).check();
  await wizard.getByRole("button", { name: "Teknoloji kararlarına geç" }).click();
  await expect(wizard.getByRole("tab", { name: "Frontend" })).toBeVisible();
  await expect(wizard.getByText("Fast SaaS tercihinden: Kilitli · Next.js")).toBeVisible();
  await wizardStep(wizard, "Gözden geçir");
  await expect(page.getByRole("heading", { name: "Projeni oluşturmaya hazırsın." })).toBeVisible();
  const review = wizard.getByRole("table", { name: "Karar özeti" });
  await expect(review).toContainText("Next.js");
  await expect(review).toContainText("Fast SaaS");
  await page.screenshot({ path: testInfo.outputPath("wizard-review-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await noHorizontalOverflow(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await wizard.getByRole("button", { name: "Projeyi oluştur" }).click();
  await expect(page).toHaveURL(/\/workspace\/projects\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: /^Atlas/ })).toBeVisible();
  await expect(page.getByText(/Fast SaaS/).first()).toBeVisible();
  const sections = projectSections(page);
  await sections.getByRole("link", { name: "Teknoloji yığını" }).click();
  const atlasFramework = decisionRow(page, "frontend.framework");
  await expect(atlasFramework).toContainText("Kilitli");
  await expect(atlasFramework).toContainText("Fast SaaS");
  await expect(decisionRow(page, "database.cache")).toContainText("AI karar versin");
  await sections.getByRole("link", { name: "AI talimatları" }).click();
  await page.getByRole("button", { name: "Talimatları oluştur" }).click();
  await expect(page.getByText("Sürüm 1 oluşturuldu.")).toBeVisible();
  const atlasPanel = page.getByRole("region", { name: "Talimat önizlemesi" });
  await page.getByRole("button", { name: "Ham metin" }).click();
  await expect(atlasPanel).toContainText('Source: profile "Fast SaaS"');
  const atlasHash = (await page.locator(".context-meta code").first().textContent()) ?? "";

  // Project two reuses the same profile but overrides the database slot.
  await sidebar.getByRole("link", { name: "Projeler" }).click();
  wizard = await openNewProject(page);
  await wizard.getByLabel("Proje adı *").fill("Beacon");
  await wizard.getByText("Profilleri ayrı seç", { exact: true }).click();
  await wizard.getByRole("checkbox", { name: /Fast SaaS/ }).check();
  await wizardStep(wizard, "Teknoloji kararları");
  await wizard.getByRole("tab", { name: "Veri", exact: true }).click();
  await expect(wizard.getByText("Fast SaaS tercihinden: Tercih edilen · PostgreSQL")).toBeVisible();
  const primary = wizard.getByRole("group", { name: "Veritabanı için karar biçimi" });
  await primary.getByRole("button", { name: "AI", exact: true }).click();
  await wizard.getByLabel("AI için sınırlar").first().fill("Managed PostgreSQL or SQLite only.");
  await wizardStep(wizard, "Kurallar");
  await wizard.getByLabel("Mühendislik kuralları").fill("Validate every API input with Zod.");
  await wizardStep(wizard, "Gözden geçir");
  await wizard.getByText("1 proje kuralı").click();
  await expect(wizard.getByText("Validate every API input with Zod.")).toBeVisible();
  await wizard.getByRole("button", { name: "Projeyi oluştur" }).click();
  await expect(page).toHaveURL(/\/workspace\/projects\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: /^Beacon/ })).toBeVisible();
  await expect(page.getByText("Validate every API input with Zod.")).toBeVisible();
  await sections.getByRole("link", { name: "Teknoloji yığını" }).click();
  const beaconDatabase = decisionRow(page, "database.primary");
  await expect(beaconDatabase).toContainText("AI karar versin");
  await expect(beaconDatabase).toContainText("Fast SaaS tercihini geçersiz kılar");
  await expect(decisionRow(page, "frontend.framework")).toContainText("Fast SaaS");
  await page.screenshot({ path: testInfo.outputPath("stack-provenance-desktop.png"), fullPage: true });
  await sections.getByRole("link", { name: "AI talimatları" }).click();
  await page.getByRole("button", { name: "Talimatları oluştur" }).click();
  await expect(page.getByText("Sürüm 1 oluşturuldu.")).toBeVisible();
  const beaconPanel = page.getByRole("region", { name: "Talimat önizlemesi" });
  await page.getByRole("button", { name: "Ham metin" }).click();
  await expect(beaconPanel).toContainText("## Engineering rules");
  await expect(beaconPanel).toContainText('Overrides: profile "Fast SaaS" PREFERRED');
  const beaconHash = (await page.locator(".context-meta code").first().textContent()) ?? "";
  expect(beaconHash).not.toBe(atlasHash);

  await page.setViewportSize({ width: 390, height: 844 });
  await noHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("context-profile-mobile.png"), fullPage: true });
});
