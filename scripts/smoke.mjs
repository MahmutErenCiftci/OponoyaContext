import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";

/**
 * Post-deploy smoke check (Handoff 12).
 *
 *   node scripts/smoke.mjs --web https://app.example --api https://api.example [--origin https://app.example] [--keep]
 *
 * Covers liveness, readiness, the web process, sign-up, an authenticated read,
 * an owner-scoped read and a protected page, then deletes the throwaway
 * account it created (unless --keep). Prints one line per step and exits 1 on
 * the first failure. Never prints cookies, passwords or connection strings.
 */
const { values } = parseArgs({
  options: {
    web: { type: "string", default: "http://localhost:3000" },
    api: { type: "string", default: "http://localhost:4000" },
    origin: { type: "string" },
    keep: { type: "boolean", default: false },
    timeout: { type: "string", default: "8000" },
  },
});

const web = new URL(values.web).origin;
const api = new URL(values.api).origin;
const origin = values.origin ? new URL(values.origin).origin : web;
const timeoutMs = Number(values.timeout) || 8_000;
const stamp = Date.now();
const email = `smoke-${stamp}-${randomBytes(3).toString("hex")}@example.test`;
const password = `Smoke-${randomBytes(12).toString("base64url")}`;
let cookie = "";
const results = [];

function cookieHeader(response) {
  const parts = response.headers.getSetCookie().map((line) => line.split(";")[0]).filter(Boolean);
  return parts.length > 0 ? parts.join("; ") : null;
}

async function step(name, run) {
  const started = Date.now();
  try {
    const detail = await run();
    results.push({ name, ok: true, ms: Date.now() - started, detail: detail ?? "" });
    console.log(`ok    ${name} (${Date.now() - started} ms)${detail ? ` — ${detail}` : ""}`);
  } catch (error) {
    results.push({ name, ok: false, ms: Date.now() - started, detail: error instanceof Error ? error.message : String(error) });
    console.log(`FAIL  ${name} — ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function request(url, init = {}) {
  const headers = new Headers(init.headers ?? {});
  if (cookie) headers.set("cookie", cookie);
  if (init.method && init.method !== "GET") headers.set("origin", origin);
  const response = await fetch(url, { ...init, headers, redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
  return response;
}

async function json(response) {
  const text = await response.text();
  try { return JSON.parse(text); } catch { return null; }
}

try {
  await step("api liveness", async () => {
    const response = await request(`${api}/health`);
    const body = await json(response);
    if (!response.ok || body?.ok !== true) throw new Error(`status ${response.status}`);
    return `release ${body.release ?? "unset"} · env ${body.environment ?? "unset"}`;
  });
  await step("api readiness", async () => {
    const response = await request(`${api}/ready`);
    if (!response.ok) throw new Error(`status ${response.status}`);
  });
  await step("web liveness", async () => {
    const response = await request(`${web}/api/health`);
    const body = await json(response);
    if (!response.ok || body?.ok !== true) throw new Error(`status ${response.status}`);
  });
  await step("web landing", async () => {
    const response = await request(`${web}/`);
    const text = await response.text();
    if (!response.ok || !text.includes("DevContext")) throw new Error(`status ${response.status}`);
    const csp = response.headers.get("content-security-policy");
    if (!csp || !csp.includes("frame-ancestors 'none'")) throw new Error("security headers missing");
  });
  await step("sign-up", async () => {
    const response = await request(`${api}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Smoke Check", email, password }),
    });
    if (response.status !== 200) throw new Error(`status ${response.status}`);
    const session = cookieHeader(response);
    if (!session) throw new Error("no session cookie");
    cookie = session;
  });
  await step("authenticated read (/v1/me)", async () => {
    const response = await request(`${api}/v1/me`);
    const body = await json(response);
    if (!response.ok || body?.user?.email !== email) throw new Error(`status ${response.status}`);
  });
  await step("owner-scoped read (/v1/workspace/summary)", async () => {
    const response = await request(`${api}/v1/workspace/summary`);
    const body = await json(response);
    if (!response.ok || typeof body?.summary?.projects !== "number") throw new Error(`status ${response.status}`);
    return `${body.summary.projects} projects`;
  });
  await step("protected page (/workspace)", async () => {
    const response = await request(`${web}/workspace`);
    const text = await response.text();
    if (response.status !== 200 || !text.includes("Merhaba")) throw new Error(`status ${response.status}`);
  });
  await step("anonymous access refused", async () => {
    const saved = cookie;
    cookie = "";
    try {
      const response = await request(`${api}/v1/me`);
      if (response.status !== 401) throw new Error(`status ${response.status}`);
    } finally {
      cookie = saved;
    }
  });
  if (!values.keep) {
    await step("cleanup: delete throwaway account", async () => {
      const response = await request(`${api}/v1/account`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password, confirmation: email }),
      });
      const body = await json(response);
      if (response.status !== 200 || body?.deleted !== true) throw new Error(`status ${response.status}`);
      const after = await request(`${api}/v1/me`);
      if (after.status !== 401) throw new Error(`session still valid (${after.status})`);
    });
  }
  console.log(JSON.stringify({ smoke: "passed", web, api, steps: results.length, at: new Date().toISOString() }));
} catch {
  console.log(JSON.stringify({ smoke: "failed", web, api, failed: results.filter((item) => !item.ok).map((item) => item.name) }));
  process.exitCode = 1;
}
