import { expect, type Locator, type Page } from "@playwright/test";

export const password = "Playwright-password-2026!";

/** Signs a fresh user up through the real form and lands on the overview (first-run guide showing). */
export async function signUp(page: Page, name: string, email: string) {
  await page.goto("/auth");
  await page.getByLabel("Adın").fill(name);
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Şifre", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Hesap oluştur" }).click();
  await expect(page).toHaveURL(/\/workspace$/);
}

/** Dismisses the first-run guide so the regular overview (checklist, projects, activity) renders. */
export async function skipFirstRun(page: Page) {
  await expect(page.getByRole("heading", { name: "Çalışma alanın hazır." })).toBeVisible();
  await page.getByRole("button", { name: "Şimdilik atla" }).click();
  await expect(page.getByRole("heading", { name: "Çalışma alanın hazır." })).toHaveCount(0);
}

export function workspaceNav(page: Page) {
  return page.getByRole("navigation", { name: "Çalışma alanı" });
}

/** Opens the "Daha fazla" header menu and follows one of its links. */
export async function openMoreMenu(page: Page, link: string) {
  await page.locator(".workspace-navigation .header-menu > summary").click();
  await workspaceNav(page).getByRole("link", { name: link }).click();
}

export function projectSections(page: Page) {
  return page.getByRole("navigation", { name: "Proje bölümleri" });
}

/** Adds a Library resource through the drawer; `rule` picks the global decision (null = no rule). */
export async function addResource(page: Page, input: { name: string; type: string; url?: string; tags?: string; rule?: "LOCKED" | "PREFERRED" | "DISABLED" | null }) {
  await page.getByRole("button", { name: "Kaynak ekle" }).click();
  const drawer = page.getByRole("dialog", { name: "Kaynak ekle" });
  await drawer.getByLabel("Ad *").fill(input.name);
  await drawer.getByLabel("Tür *").selectOption(input.type);
  if (input.rule === null) await drawer.getByRole("radio", { name: /^Varsayılan kural yok/ }).check();
  else if (input.rule === "LOCKED") await drawer.getByRole("radio", { name: /^Kilitli/ }).check();
  else if (input.rule === "DISABLED") await drawer.getByRole("radio", { name: /^Devre dışı/ }).check();
  if (input.url) await drawer.getByLabel("Kaynak bağlantısı").fill(input.url);
  if (input.tags) await drawer.getByLabel("Etiketler").fill(input.tags);
  await drawer.getByRole("button", { name: "Kaynağı kaydet" }).click();
  await expect(page.getByRole("heading", { name: input.name, exact: true })).toBeVisible();
}

/** Opens the row menu (⋯) of a table/list row and clicks one of its actions. */
export async function rowAction(row: Locator, menuLabel: string, action: string) {
  await row.getByLabel(menuLabel).click();
  await row.getByRole("button", { name: action }).click();
}

/** The full-page project wizard. */
export function wizard(page: Page) {
  return page.locator(".wizard-page");
}

/** Starts a new project from the Projects page and returns the wizard locator. */
export async function openNewProject(page: Page) {
  await page.getByRole("button", { name: "Yeni proje" }).first().click();
  const editor = wizard(page);
  await expect(editor.getByLabel("Proje adı *")).toBeVisible();
  return editor;
}

/** Expands a `<details>` disclosure by its summary text; leaves it alone when it is already open. */
export async function openDisclosure(scope: Locator, summary: string) {
  const details = scope.locator("details").filter({ has: scope.page().getByText(summary, { exact: true }) }).first();
  if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open))) await details.locator("summary").click();
  await expect(details).toHaveAttribute("open", "");
}

/** Jumps to a wizard step through the stepper (the project name must already be set). */
export async function wizardStep(editor: Locator, label: "Proje bilgileri" | "Teknoloji kararları" | "Kurallar" | "Gözden geçir") {
  await editor.getByRole("list", { name: "Adımlar" }).getByRole("button", { name: new RegExp(`${label}$`) }).click();
}

export async function createProjectFromWizard(editor: Locator, page: Page) {
  await wizardStep(editor, "Gözden geçir");
  await editor.getByRole("button", { name: "Projeyi oluştur" }).click();
  await expect(page).toHaveURL(/\/workspace\/projects\/[0-9a-f-]{36}$/);
}

/** Adds a decision for an undecided slot through "Karar ekle" and returns the editor dialog. */
export async function addDecision(page: Page, slot: string, title: string) {
  await page.getByRole("button", { name: "Karar ekle" }).click();
  const picker = page.getByRole("dialog", { name: "Karar ekle" });
  await picker.getByLabel("Karar alanı").selectOption(slot);
  await picker.getByRole("button", { name: "Devam et" }).click();
  const editor = page.getByRole("dialog", { name: title });
  await expect(editor).toBeVisible();
  return editor;
}

export function decisionRow(page: Page, slot: string) {
  return page.getByRole("row").filter({ hasText: slot });
}

export async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}
