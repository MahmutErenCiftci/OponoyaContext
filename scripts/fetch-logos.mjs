/**
 * Downloads brand logos for the technology catalog from Simple Icons
 * (https://simpleicons.org, CC0-1.0) into apps/web/public/logos and writes the
 * manifest the web app uses to render them.
 *
 * Usage: node scripts/fetch-logos.mjs [--offline]
 *   --offline  rebuild the manifest from already downloaded files only
 *
 * Every icon is a monochrome SVG path on a 24x24 viewBox. The manifest keeps
 * the brand colour so the UI can tint the icon per theme. Entries without a
 * Simple Icons match are listed in apps/web/public/logos/README.md and get a
 * monogram fallback in the UI.
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const catalogDir = join(root, "data/catalog");
const logoDir = join(root, "apps/web/public/logos");
const manifestPath = join(root, "apps/web/lib/logo-manifest.json");
const simpleIconsVersion = "16.30.0";
const cdn = `https://cdn.jsdelivr.net/npm/simple-icons@${simpleIconsVersion}`;
const offline = process.argv.includes("--offline");

/**
 * Catalog slug → Simple Icons slug candidates, tried in order before the
 * automatic guesses. Combined catalog entries ("Redis / Valkey") use the first
 * named brand. Entries that are practices or Turkish services without a
 * public brand icon are left out on purpose and fall back to a monogram.
 */
const overrides = {
  "claude-code": ["claudecode", "claude"], "cursor": "cursor", "github-copilot": "githubcopilot", "codex-cli": "openai", "windsurf": "windsurf", "cline": "cline", "aider": "aider",
  "v0": "v0", "lovable": "lovable", "bolt-new": ["boltnew", "bolt"], "replit-agent": "replit", "mcp": "modelcontextprotocol", "claude-agent-sdk": "claude", "anthropic-api": "anthropic",
  "openai-sdk": "openai", "google-gemini-api": "googlegemini", "openrouter": "openrouter", "vercel-ai-sdk": "vercel", "langchain": "langchain", "langgraph": "langgraph", "llamaindex": "llamaindex",
  "mastra": "mastra", "crewai": "crewai", "ollama": "ollama", "huggingface": "huggingface", "pytorch": "pytorch", "langfuse": "langfuse", "braintrust": "braintrust", "n8n": "n8n",
  "elevenlabs": "elevenlabs", "replicate": "replicate", "modal": "modal",
  "nodejs": "nodedotjs", "bun": "bun", "deno": "deno", "expressjs": "express", "fastify": "fastify", "hono": "hono", "nestjs": "nestjs", "trpc": "trpc", "graphql": "graphql",
  "openapi-rest": "openapiinitiative", "grpc": "grpc", "python": "python", "fastapi": "fastapi", "django": "django", "flask": "flask", "go": "go", "rust": "rust", "java": "openjdk",
  "spring-boot": "springboot", "kotlin": "kotlin", "csharp": ["csharp", "dotnet"], "dotnet-aspnet": "dotnet", "php": "php", "laravel": "laravel", "rails": "rubyonrails", "elixir-phoenix": ["phoenixframework", "elixir"],
  "better-auth": "betterauth", "authjs": ["authdotjs", "nextdotjs"], "clerk": "clerk", "auth0": "auth0", "keycloak": "keycloak", "redis": "redis", "bullmq": "bullmq", "kafka": "apachekafka",
  "rabbitmq": "rabbitmq", "temporal": "temporal", "inngest": "inngest", "socketio": "socketdotio", "liveblocks": "liveblocks",
  "apache-airflow": "apacheairflow", "dagster": "dagster", "prefect": "prefect", "dbt": "dbt", "airbyte": "airbyte", "fivetran": "fivetran", "debezium": "debezium", "apache-spark": "apachespark",
  "polars": "polars", "pandas": "pandas", "snowflake": "snowflake", "bigquery": "googlebigquery", "databricks": "databricks", "apache-iceberg": "apacheiceberg", "trino": "trino",
  "metabase": "metabase", "apache-superset": "apachesuperset", "power-bi": ["powerbi", "looker"], "great-expectations": "greatexpectations", "mlflow": "mlflow", "kestra": "kestra",
  "postgresql": "postgresql", "mysql": "mysql", "sqlite": "sqlite", "turso": "turso", "neon": "neon", "supabase": "supabase", "firebase": "firebase", "convex": "convex", "pocketbase": "pocketbase",
  "mongodb": "mongodb", "dynamodb": "amazondynamodb", "clickhouse": "clickhouse", "duckdb": "duckdb", "pgvector": "postgresql", "pinecone": "pinecone", "qdrant": "qdrant",
  "elasticsearch": ["elasticsearch", "opensearch"], "meilisearch": "meilisearch", "algolia": "algolia", "drizzle-orm": "drizzle", "prisma": "prisma", "kysely": "kysely", "sqlalchemy": "sqlalchemy",
  "typeorm": "typeorm", "mongoose": "mongoose", "cloudflare-r2": ["cloudflare", "amazons3"], "uploadthing": "uploadthing", "cloudinary": ["cloudinary", "imagekit"], "strapi": "strapi", "sanity": "sanity",
  "payload-cms": "payloadcms", "wordpress": "wordpress",
  "vercel": "vercel", "netlify": "netlify", "cloudflare-workers": ["cloudflareworkers", "cloudflare"], "aws": ["amazonwebservices", "amazonaws"], "railway": ["railway", "render"], "fly-io": "flydotio",
  "coolify": ["coolify", "dokploy"], "docker": "docker", "kubernetes": "kubernetes", "terraform": ["terraform", "opentofu"], "github-actions": "githubactions", "sentry": "sentry", "grafana": "grafana",
  "datadog": "datadog", "opentelemetry": "opentelemetry", "posthog": "posthog", "plausible": ["plausibleanalytics", "umami"], "stripe": "stripe", "lemonsqueezy": ["lemonsqueezy", "paddle"],
  "iyzico": "iyzico", "resend": "resend", "twilio": "twilio", "vitest": "vitest", "playwright": "playwright", "cypress": "cypress", "testing-library": "testinglibrary", "figma": "figma",
  "git": "git", "hetzner": ["hetzner", "digitalocean"],
  "typescript": "typescript", "javascript": "javascript", "html5": "html5", "css3": ["css", "css3"], "react": "react", "nextjs": "nextdotjs", "remix": ["remix", "reactrouter"], "astro": "astro",
  "vue": "vuedotjs", "nuxt": "nuxt", "svelte": "svelte", "sveltekit": "svelte", "angular": "angular", "solidjs": "solid", "htmx": "htmx", "alpinejs": "alpinedotjs", "tailwindcss": "tailwindcss",
  "shadcn-ui": "shadcnui", "radix-ui": "radixui", "mui": "mui", "ant-design": "antdesign", "mantine": "mantine", "chakra-ui": "chakraui", "bootstrap": "bootstrap", "sass": "sass",
  "styled-components": "styledcomponents", "tanstack-query": "reactquery", "zustand": "zustand", "redux-toolkit": "redux", "jotai": "jotai", "pinia": "pinia", "react-hook-form": "reacthookform",
  "zod": "zod", "framer-motion": ["motion", "framer"], "gsap": "gsap", "lottie": "lottiefiles", "threejs": "threedotjs", "d3js": "d3", "recharts": "recharts", "echarts": "apacheecharts",
  "lucide-icons": "lucide", "heroicons": "heroicons", "storybook": "storybook", "vite": "vite", "turborepo": "turborepo", "pnpm": "pnpm", "biome": "biome", "eslint": "eslint",
  "react-native": "react", "expo": "expo", "flutter": "flutter", "swift-ios": "swift", "jetpack-compose": "jetpackcompose", "electron": "electron", "tauri": "tauri", "capacitor": "capacitor",
  "pwa": "pwa", "unity": "unity", "godot": "godotengine",
  "owasp-top10": "owasp", "semgrep": "semgrep", "codeql": "github", "snyk": "snyk", "dependabot": ["dependabot", "renovate"], "trivy": "trivy", "gitleaks": ["gitleaks", "trufflehog"],
  "vault": ["vault", "openbao"], "infisical": ["infisical", "doppler"], "owasp-zap": ["zap", "owasp"], "burp-suite": ["burpsuite", "portswigger"], "sonarqube": ["sonarqubeserver", "sonarqube", "sonar"],
  "cloudflare-waf": "cloudflare", "sigstore-cosign": "sigstore", "falco": "falco", "wazuh": "wazuh", "vanta": ["vanta", "drata"], "llm-security": "owasp",
  "paytr": "paytr", "craftgate": "craftgate", "shopier": ["shopier", "papara"], "netgsm": "netgsm", "parasut": "parasut", "trendyol-api": ["trendyol", "hepsiburada"], "ticimax-ideasoft": ["ticimax", "ideasoft"],
  "turkiye-cloud": "turkcell", "e-devlet-eimza": "edevlet",
};

/** Simple Icons derives slugs from titles with these rules (see its SDK). */
function titleToSlug(title) {
  return title.toLowerCase()
    .replaceAll("+", "plus").replaceAll(".", "dot").replaceAll("&", "and")
    .replaceAll("đ", "d").replaceAll("ħ", "h").replaceAll("ı", "i").replaceAll("ĸ", "k").replaceAll("ŀ", "l").replaceAll("ł", "l").replaceAll("ß", "ss").replaceAll("ŧ", "t")
    .normalize("NFD").replace(/[^a-z\d]/g, "");
}

function normalizeName(name) {
  return name.normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function hostOf(url) {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; }
}

const genericHosts = new Set([
  "github.com", "gitlab.com", "npmjs.com", "pypi.org", "en.wikipedia.org", "learn.microsoft.com", "developer.mozilla.org",
  "cloud.google.com", "docs.aws.amazon.com", "aws.amazon.com", "developer.apple.com", "developer.android.com", "owasp.org", "cheatsheetseries.owasp.org",
]);

async function fetchText(url) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.text();
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  return null;
}

async function loadCatalog() {
  const items = [];
  for (const file of (await readdir(catalogDir)).sort()) {
    if (!file.startsWith("technologies.") || !file.endsWith(".json")) continue;
    const document = JSON.parse(await readFile(join(catalogDir, file), "utf8"));
    for (const item of document.items) items.push({ ...item, domain: document.domain });
  }
  return items;
}

async function loadIconIndex() {
  const text = await fetchText(`${cdn}/data/simple-icons.json`);
  if (!text) throw new Error("Simple Icons data file not found");
  const document = JSON.parse(text);
  const list = Array.isArray(document) ? document : document.icons;
  const index = new Map();
  for (const icon of list) {
    const slug = icon.slug ?? titleToSlug(icon.title);
    index.set(slug, { slug, title: icon.title, hex: icon.hex });
  }
  return index;
}

function candidatesFor(item) {
  const preferred = overrides[item.slug];
  const list = Array.isArray(preferred) ? [...preferred] : preferred ? [preferred] : [];
  list.push(item.slug.replace(/-/g, ""));
  list.push(titleToSlug(item.name));
  const firstWord = item.name.split(/[\s/(]/)[0];
  if (firstWord) list.push(titleToSlug(firstWord));
  return [...new Set(list.filter(Boolean))];
}

async function main() {
  await mkdir(logoDir, { recursive: true });
  const items = await loadCatalog();
  const index = offline ? new Map() : await loadIconIndex();
  const logos = {};
  const missing = [];
  const queue = [...items];
  const workers = Array.from({ length: 8 }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      const target = join(logoDir, `${item.slug}.svg`);
      if (offline) {
        if (existsSync(target)) {
          const svg = await readFile(target, "utf8");
          const icon = /data-icon="([a-z0-9]+)"/.exec(svg)?.[1] ?? item.slug;
          const title = /<title>([^<]*)<\/title>/.exec(svg)?.[1] ?? item.name;
          const hex = /data-brand="([0-9A-Fa-f]{6})"/.exec(svg)?.[1] ?? "888888";
          logos[item.slug] = { icon, title, hex };
        } else missing.push(item);
        continue;
      }
      const match = candidatesFor(item).map((slug) => index.get(slug)).find(Boolean);
      if (!match) { missing.push(item); continue; }
      let svg = existsSync(target) ? await readFile(target, "utf8") : null;
      if (!svg || !svg.includes(`data-icon="${match.slug}"`)) {
        const body = await fetchText(`${cdn}/icons/${match.slug}.svg`);
        if (!body) { missing.push(item); continue; }
        // Keep the icon slug and brand colour inside the file so offline rebuilds stay exact.
        svg = body.replace("<svg ", `<svg data-icon="${match.slug}" data-brand="${match.hex}" `);
        await writeFile(target, svg);
      }
      logos[item.slug] = { icon: match.slug, title: match.title, hex: match.hex };
    }
  });
  await Promise.all(workers);

  const names = {};
  const hostOwners = new Map();
  for (const item of items) {
    names[normalizeName(item.name)] = item.slug;
    for (const url of [item.docsUrl, item.repoUrl]) {
      const host = url ? hostOf(url) : null;
      if (!host || genericHosts.has(host)) continue;
      hostOwners.set(host, hostOwners.has(host) && hostOwners.get(host) !== item.slug ? null : item.slug);
    }
  }
  const hosts = {};
  for (const [host, owner] of hostOwners) if (owner) hosts[host] = owner;

  const sortEntries = (object) => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
  const manifest = { source: "simple-icons", version: simpleIconsVersion, license: "CC0-1.0", logos: sortEntries(logos), names: sortEntries(names), hosts: sortEntries(hosts) };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  missing.sort((a, b) => a.slug.localeCompare(b.slug));
  const readme = [
    "# Technology logos",
    "",
    `Icons in this directory come from [Simple Icons](https://simpleicons.org) ${simpleIconsVersion} (CC0-1.0),`,
    "downloaded by `scripts/fetch-logos.mjs`. Each file is named after the catalog slug in `data/catalog/`",
    "and keeps the Simple Icons slug and brand colour as `data-icon` / `data-brand` attributes.",
    "",
    "Brand names and logos are trademarks of their respective owners; they are used here only to identify",
    "the technology they refer to (see Simple Icons' DISCLAIMER.md). Do not present them as an endorsement.",
    "",
    `Matched: ${Object.keys(logos).length} of ${items.length} catalog entries. The web app shows a monogram for the rest:`,
    "",
    ...missing.map((item) => `- \`${item.slug}\` (${item.name})`),
    "",
  ].join("\n");
  await writeFile(join(logoDir, "README.md"), readme);
  console.log(`logos: ${Object.keys(logos).length}/${items.length} matched, ${missing.length} missing`);
  if (missing.length > 0) console.log(missing.map((item) => `${item.slug} (${item.name})`).join("\n"));
}

await main();
