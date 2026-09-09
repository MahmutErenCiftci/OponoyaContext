import { expect, type Page } from "@playwright/test";

/**
 * Upgrades the signed-in Playwright user to Pro through the test-mode billing
 * provider: the checkout is created by the API and completed as "paid", which
 * delivers a signed webhook before the call returns.
 */
export async function upgradeToPro(page: Page) {
  const checkout = await page.request.post("/api/billing/checkout");
  expect(checkout.status(), await checkout.text()).toBe(200);
  const { url } = (await checkout.json()) as { url: string };
  const session = new URL(url).searchParams.get("session");
  expect(session).toBeTruthy();
  const paid = await page.request.post(`/api/billing/test/checkout/${encodeURIComponent(session!)}`, { data: { outcome: "paid" } });
  expect(paid.status(), await paid.text()).toBe(200);
  const summary = await page.request.get("/api/billing");
  expect(((await summary.json()) as { billing: { entitlement: { plan: string } } }).billing.entitlement.plan).toBe("pro");
}
