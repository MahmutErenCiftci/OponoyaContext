import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineCopy, isEnglishLandingPath, localeCookie, localeFromAcceptLanguage, localeFromCookieHeader, localeHeaderName, parseLocale } from "../lib/i18n";
import { proxyToApi } from "../lib/proxy";
import { proxy, requestLocale } from "../proxy";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function page(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { headers });
}

describe("interface language", () => {
  it("picks Turkish or English from Accept-Language by quality, English for other languages, Turkish without a header", () => {
    expect(localeFromAcceptLanguage(undefined)).toBe("tr");
    expect(localeFromAcceptLanguage("")).toBe("tr");
    expect(localeFromAcceptLanguage("tr-TR,tr;q=0.9,en;q=0.8")).toBe("tr");
    expect(localeFromAcceptLanguage("en-US,en;q=0.9,tr;q=0.8")).toBe("en");
    expect(localeFromAcceptLanguage("de-DE,de;q=0.9,tr;q=0.5")).toBe("tr");
    expect(localeFromAcceptLanguage("tr;q=0.4, en;q=0.6")).toBe("en");
    expect(localeFromAcceptLanguage("de-DE,fr;q=0.8")).toBe("en");
    expect(localeFromAcceptLanguage("en;q=0, tr")).toBe("tr");
  });

  it("reads only a valid stored choice", () => {
    expect(parseLocale("en")).toBe("en");
    expect(parseLocale("EN")).toBeNull();
    expect(localeFromCookieHeader("a=1; devcontext-locale=en; b=2")).toBe("en");
    expect(localeFromCookieHeader("devcontext-locale=de")).toBeNull();
    expect(localeFromCookieHeader(null)).toBeNull();
    expect(localeCookie("en")).toMatch(/^devcontext-locale=en; Path=\/; Max-Age=\d+; SameSite=Lax$/);
  });

  it("keeps copy per language and treats /en as the English landing only", () => {
    const copy = defineCopy({ tr: { hello: "Merhaba", count: (n: number) => `${n} proje` }, en: { hello: "Hello", count: (n: number) => `${n} projects` } });
    expect(copy.en.count(2)).toBe("2 projects");
    expect(isEnglishLandingPath("/en")).toBe(true);
    expect(isEnglishLandingPath("/en/")).toBe(true);
    expect(isEnglishLandingPath("/enterprise")).toBe(false);
  });

  it("resolves the page language in the request proxy: /en, then the stored choice, then the browser", () => {
    expect(requestLocale(page("http://localhost/en"))).toBe("en");
    // The Turkish landing stays Turkish (html lang, metadata) for an English browser without a stored choice.
    expect(requestLocale(page("http://localhost/", { "accept-language": "en-US" }))).toBe("tr");
    expect(requestLocale(page("http://localhost/workspace", { cookie: "devcontext-locale=en", "accept-language": "tr" }))).toBe("en");
    expect(requestLocale(page("http://localhost/workspace", { "accept-language": "en-GB" }))).toBe("en");
    expect(requestLocale(page("http://localhost/workspace"))).toBe("tr");

    const response = proxy(page("http://localhost/workspace", { "accept-language": "en-US", [localeHeaderName]: "tr" }));
    // A client cannot pick the resolved language by sending the internal header itself.
    expect(response.headers.get("x-middleware-request-" + localeHeaderName)).toBe("en");
  });

  it("sends someone who chose English from / to /en, and leaves crawlers on /", () => {
    const chosen = proxy(page("http://localhost/", { cookie: "devcontext-locale=en" }));
    expect(chosen.status).toBe(307);
    expect(chosen.headers.get("location")).toBe("http://localhost/en");
    expect(proxy(page("http://localhost/", { "accept-language": "en-US" })).status).toBe(200);
  });

  it("answers proxy outages in the visitor's language", async () => {
    vi.stubEnv("API_URL", "http://127.0.0.1:1");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED")));
    const options = { prefix: "/v1/projects", unavailableMessage: "Proje hizmetine şu an ulaşılamıyor." };
    const turkish = await proxyToApi(new NextRequest("http://localhost/api/projects"), [], options);
    expect((await turkish.json()).error.message).toBe("Proje hizmetine şu an ulaşılamıyor.");
    const english = await proxyToApi(new NextRequest("http://localhost/api/projects", { headers: { cookie: "devcontext-locale=en" } }), [], options);
    expect((await english.json()).error.message).toBe("The service cannot be reached right now. Try again shortly.");
  });
});
