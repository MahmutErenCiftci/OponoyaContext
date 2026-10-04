import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";
import Link from "next/link";
import { ArrowRight, CheckCircle, CircleDashed, Clock, Database, DownloadSimple, LockSimple, MinusCircle, Sparkle, Stack, Star } from "@phosphor-icons/react/dist/ssr";
import type { CSSProperties } from "react";
import { productName } from "@devcontext/contracts/brand";
import { BrandMark } from "../components/brand-mark";
import { LanguageSwitch } from "../components/language-switch";
import { LocaleProvider } from "../components/locale-provider";
import { LogoMark } from "../components/logo-mark";
import { TechLogo } from "../components/tech-logo";
import { ThemeToggle } from "../components/theme-toggle";
import { getWorkspaceStatus } from "../lib/api";
import { brandCopy } from "../lib/brand-copy";
import { defineCopy, type Locale } from "../lib/i18n";
import { proPricing } from "../lib/roadmap";
import { readTheme } from "../lib/theme-server";
import { LiveClock } from "./workspace/live-clock";
import { AgentFiles, RevealOnScroll, SpotlightGrid } from "./landing-effects";

// Italic accent words only; downloaded at build time and served from this origin like the other fonts.
const serif = Instrument_Serif({ subsets: ["latin", "latin-ext"], weight: "400", style: ["normal", "italic"], variable: "--font-serif", display: "swap" });

/** Each landing has one fixed language: / is Turkish, /en is English. */
const landingPaths: Record<Locale, string> = { tr: "/", en: "/en" };

/**
 * Title, description and language alternates of the landing in `locale`.
 * Open Graph and Twitter stay with the root layout: a page-level `openGraph`
 * without images would drop the `app/opengraph-image` card on /en.
 */
export function landingMetadata(locale: Locale): Metadata {
  const { tagline, description } = brandCopy[locale];
  return {
    title: { absolute: `${productName} · ${tagline}` },
    description,
    alternates: { canonical: landingPaths[locale], languages: { tr: landingPaths.tr, en: landingPaths.en } },
  };
}

const stack = [
  { name: "Next.js", slug: "nextjs" },
  { name: "TypeScript", slug: "typescript" },
  { name: "PostgreSQL", slug: "postgresql" },
  { name: "Drizzle ORM", slug: "drizzle-orm" },
  { name: "Better Auth", slug: "better-auth" },
  { name: "shadcn/ui", slug: "shadcn-ui" },
  { name: "Tailwind CSS", slug: "tailwindcss" },
  { name: "React", slug: "react" },
];

const copy = defineCopy({
  tr: {
    agents: [
      { file: "AGENTS.md", name: "Codex", slug: "codex-cli" },
      { file: "CLAUDE.md", name: "Claude Code", slug: "claude-code" },
      { file: ".mdc", name: "Cursor", slug: "cursor" },
      { file: "instructions", name: "GitHub Copilot", slug: "github-copilot" },
      { file: ".md", name: "Genel talimat", slug: null },
    ] as Array<{ file: string; name: string; slug: string | null }>,
    decisions: [
      { tech: "Next.js", mode: "Kilitli", tone: "locked", icon: LockSimple, text: "AI bu seçimi değiştirmesin." },
      { tech: "Drizzle ORM", mode: "Tercih edilen", tone: "preferred", icon: Star, text: "Varsayılan bu; gerekçeyle değiştirilebilir." },
      { tech: "Mimari", mode: "AI karar versin", tone: "delegated", icon: CircleDashed, text: "Kısıtlar içinde ajan seçsin, gerekçesini yazsın." },
      { tech: "Redis", mode: "Devre dışı", tone: "disabled", icon: MinusCircle, text: "Bu projede kullanılmasın." },
    ],
    faqs: (pricing: { launch: string; period: string }) => [
      { q: "Oponoya ücretli mi?", a: `Şu an geliştirme aşamasında ve tamamen ücretsiz. Free hesap her zaman kalacak; Pro, V2 ile gelişim indirimiyle ${pricing.launch} / ${pricing.period} olarak gelecek.` },
      { q: "Hangi ajanlarla çalışır?", a: "Genel talimat, AGENTS.md (Codex) ve CLAUDE.md (Claude Code) Free’de; Cursor ve GitHub Copilot çıktıları Pro’da." },
      { q: "Verilerim bir AI’a gönderiliyor mu?", a: "Hayır. Talimatlar sunucuda deterministik olarak derlenir. İleride gelecek AI önerileri yalnızca sen izin verirsen çalışacak." },
      { q: "Verilerimi geri alabilir miyim?", a: "Evet. Tüm çalışma alanını JSON olarak dışa aktarabilir, istediğin an hesabını ve verilerini silebilirsin." },
    ],
    nav: { product: "Ürün", how: "Nasıl çalışır", plan: "Plan", faq: "SSS" },
    signIn: "Giriş yap",
    startFree: "Ücretsiz başla",
    pill: "Şu an tamamen ücretsiz · Gelişim planı",
    hero: { first: "Her yeni projede", second: "aynı şeyleri", accent: "tekrar", last: "anlatma." },
    lead: "Teknolojilerini bir kez anlat. Oponoya onları Codex, Claude Code, Cursor ve Copilot’un anlayacağı talimatlara dönüştürür.",
    createWorkspace: "Çalışma alanını oluştur",
    howItWorks: "Nasıl çalışır",
    note: "Kredi kartı gerekmez · Free hesap her zaman kalacak",
    online: "Çalışma alanı hazır",
    offline: "Bağlantı kurulamıyor",
    stageLabel: `${productName} çalışma alanının önizlemesi: projeler, teknolojiler ve öneriler`,
    app: {
      overview: "Genel bakış",
      projects: "Projeler",
      library: "Kütüphane",
      profiles: "Profiller",
      recipes: "Tarifler",
      newProjectCta: "+ Yeni proje",
      welcome: "Tekrar hoş geldin, Deniz",
      lastVisit: "Son girişin: dün · En son: Talimatlar oluşturuldu",
      yourProjects: "Projelerin",
      production: "Üretim",
      upToDate: "● Bağlam güncel",
      needsRefresh: "● Yenilenmeli",
      newProject: "Yeni proje",
      gather: "Tercihlerini topla",
      suggestions: "Senin için öneriler",
      suggestionTailwind: "Tailwind CSS · Next.js ile sık kullanılır",
      suggestionT3: "T3 Stack · 5/13 teknolojin",
      toast: "Sürüm 3 oluşturuldu",
    },
    marqueeLabel: "Desteklenen ajanlar ve teknolojiler",
    marquee: "Tek kaynaktan, her ajan için doğru dosya",
    without: {
      eyebrow: "Oponoya olmadan",
      title: "Her ajan, her projede sıfırdan başlar.",
      items: [
        "Aynı tercihleri her yeni projede yeniden yazarsın.",
        "Her araç için ayrı talimat dosyası elle güncellenir.",
        "Hangi kararın neden verildiği kaybolur.",
        "Ajan, kilitlediğin seçimi sessizce değiştirebilir.",
      ],
    },
    with: {
      eyebrow: "Oponoya ile",
      title: "Bir kez anlatırsın, her projede hatırlanır.",
      items: [
        "Tercihlerin kütüphanende, projeler profillerden devralır.",
        "Tüm talimat dosyaları tek kaynaktan üretilir.",
        "Her kararın kaynağı ve gerekçesi görünür.",
        "Kilitli seçimler talimatlarda açıkça yazar.",
      ],
    },
    source: {
      eyebrow: "Tek kaynak",
      title: "Bir kez tanımla.",
      titleAccent: "Her ajana aynı bağlamı ver.",
      body: "Kararların deterministik olarak derlenir; her ajan kendi dosya biçimini alır. İçerik değiştiğinde yeni sürüm oluşur.",
    },
    steps: {
      title: "Üç adım.",
      titleAccent: "O kadar.",
      items: [
        { n: "01", title: "Kaydet", body: "Teknoloji yığınını, tercihlerini ve kurallarını tek yerde sakla. Katalogdan tek tıkla ekle." },
        { n: "02", title: "Projeni oluştur", body: "Profil ve tariflerini birleştir; her proje için tutarlı bir bağlam kur." },
        { n: "03", title: "Aktar", body: "Talimatları oluştur ve kodlama ajanına ver. Sürümler saklanır." },
      ],
    },
    bento: {
      title: "Bağlamın tek yerde,",
      titleAccent: "kararların sende.",
      library: { title: "Kütüphane", body: "Katalogdaki yüzlerce teknolojiyi tek tıkla ekle ya da kendi kaynaklarını kaydet; her birine varsayılan bir karar ver." },
      profiles: { title: "Profiller ve tarifler", body: "Öncelik her zaman açık: Proje › Tarif › Profil › Kütüphane." },
      versions: { title: "Sürümler", body: "Her derleme saklanır; iki sürüm arasında neyin değiştiğini gör." },
      data: { title: "Verin senin", body: "Tüm çalışma alanını JSON olarak dışa aktar, içe aktar ya da hesabını sil." },
      suggestions: { title: "Öneriler", body: "Kütüphanene göre sık birlikte kullanılan teknolojiler ve hazır stack’ler." },
    },
    plan: {
      title: "Gelişim planı",
      lead: "Geliştirme aşamasında her şey ücretsiz. Free hesap her zaman kalacak.",
      v1: { name: "Temel", status: "Şu an · Ücretsiz", body: "Kütüphane, projeler, profiller, tarifler, katalog ve talimat çıktıları." },
      v2: { name: "Pro", body: "İlk AI özellikleri, GitHub ve dosya içe aktarma, tarayıcı eklentisi ve CLI." },
      v3: { name: "Takımlar ve topluluk", status: "Planlanıyor", body: "Ortak kütüphane, roller, herkese açık topluluk stack’leri, MCP sunucusu." },
      v3plus: { name: "Gelişmiş AI ve kurumsal", status: "V3 sonrası", body: "Kod tabanından stack tespiti, geçiş asistanı, SSO ve kurumsal kullanım." },
    },
    faqTitle: "Sık sorulan",
    faqTitleAccent: "sorular",
    final: { title: "Bir kez anlat.", titleAccent: "Gerisi hatırlansın." },
    footer: { label: "Yasal", terms: "Kullanım Şartları", privacy: "Gizlilik", feedback: "Geri bildirim" },
  },
  en: {
    agents: [
      { file: "AGENTS.md", name: "Codex", slug: "codex-cli" },
      { file: "CLAUDE.md", name: "Claude Code", slug: "claude-code" },
      { file: ".mdc", name: "Cursor", slug: "cursor" },
      { file: "instructions", name: "GitHub Copilot", slug: "github-copilot" },
      { file: ".md", name: "General instructions", slug: null },
    ],
    decisions: [
      { tech: "Next.js", mode: "Locked", tone: "locked", icon: LockSimple, text: "The AI must not change this choice." },
      { tech: "Drizzle ORM", mode: "Preferred", tone: "preferred", icon: Star, text: "The default; it can change with a stated reason." },
      { tech: "Architecture", mode: "Let AI decide", tone: "delegated", icon: CircleDashed, text: "The agent picks within your constraints and explains why." },
      { tech: "Redis", mode: "Disabled", tone: "disabled", icon: MinusCircle, text: "Not used in this project." },
    ],
    faqs: (pricing: { launch: string; period: string }) => [
      { q: "Does Oponoya cost anything?", a: `It is in development and completely free right now. The Free account stays for good; Pro arrives with V2 at a development discount of ${pricing.launch} / ${pricing.period}.` },
      { q: "Which agents does it work with?", a: "General instructions, AGENTS.md (Codex) and CLAUDE.md (Claude Code) are in Free; Cursor and GitHub Copilot outputs are in Pro." },
      { q: "Is my data sent to an AI?", a: "No. Instructions are compiled deterministically on the server. Future AI suggestions will only run if you allow them." },
      { q: "Can I take my data with me?", a: "Yes. You can export your whole workspace as JSON and delete your account and data whenever you like." },
    ],
    nav: { product: "Product", how: "How it works", plan: "Plan", faq: "FAQ" },
    signIn: "Sign in",
    startFree: "Start for free",
    pill: "Completely free for now · Development plan",
    hero: { first: "Stop explaining", second: "the same things", accent: "again", last: "in every new project." },
    lead: "Describe your technologies once. Oponoya turns them into instructions that Codex, Claude Code, Cursor and Copilot understand.",
    createWorkspace: "Create your workspace",
    howItWorks: "How it works",
    note: "No credit card needed · The Free account stays for good",
    online: "Workspace ready",
    offline: "Cannot connect",
    stageLabel: `Preview of the ${productName} workspace: projects, technologies and suggestions`,
    app: {
      overview: "Overview",
      projects: "Projects",
      library: "Library",
      profiles: "Profiles",
      recipes: "Recipes",
      newProjectCta: "+ New project",
      welcome: "Welcome back, Deniz",
      lastVisit: "Last sign-in: yesterday · Latest: Instructions generated",
      yourProjects: "Your projects",
      production: "Production",
      upToDate: "● Context up to date",
      needsRefresh: "● Needs a refresh",
      newProject: "New project",
      gather: "Gather your preferences",
      suggestions: "Suggestions for you",
      suggestionTailwind: "Tailwind CSS · Often used with Next.js",
      suggestionT3: "T3 Stack · 5/13 of your technologies",
      toast: "Version 3 generated",
    },
    marqueeLabel: "Supported agents and technologies",
    marquee: "One source, the right file for every agent",
    without: {
      eyebrow: "Without Oponoya",
      title: "Every agent starts from scratch in every project.",
      items: [
        "You rewrite the same preferences in every new project.",
        "Each tool's instruction file is updated by hand.",
        "Why a decision was made gets lost.",
        "An agent can quietly change a choice you locked.",
      ],
    },
    with: {
      eyebrow: "With Oponoya",
      title: "Explain it once; every project remembers.",
      items: [
        "Your preferences live in your Library; projects inherit from profiles.",
        "Every instruction file is generated from one source.",
        "The source and reasoning of every decision stay visible.",
        "Locked choices are spelled out in the instructions.",
      ],
    },
    source: {
      eyebrow: "One source",
      title: "Define it once.",
      titleAccent: "Give every agent the same context.",
      body: "Your decisions are compiled deterministically; each agent gets its own file format. When the content changes, a new version is created.",
    },
    steps: {
      title: "Three steps.",
      titleAccent: "That's it.",
      items: [
        { n: "01", title: "Save", body: "Keep your tech stack, preferences and rules in one place. Add from the catalog in one click." },
        { n: "02", title: "Create your project", body: "Combine your profiles and recipes; build a consistent context for every project." },
        { n: "03", title: "Export", body: "Generate the instructions and hand them to your coding agent. Versions are kept." },
      ],
    },
    bento: {
      title: "Your context in one place,",
      titleAccent: "your decisions in your hands.",
      library: { title: "Library", body: "Add any of hundreds of catalog technologies in one click or save your own resources; give each one a default decision." },
      profiles: { title: "Profiles and recipes", body: "Precedence is always clear: Project › Recipe › Profile › Library." },
      versions: { title: "Versions", body: "Every compilation is kept; see what changed between two versions." },
      data: { title: "Your data is yours", body: "Export your whole workspace as JSON, import it, or delete your account." },
      suggestions: { title: "Suggestions", body: "Technologies often used together and ready-made stacks, based on your Library." },
    },
    plan: {
      title: "Development plan",
      lead: "Everything is free while the product is in development. The Free account stays for good.",
      v1: { name: "Foundation", status: "Now · Free", body: "Library, projects, profiles, recipes, the catalog and instruction outputs." },
      v2: { name: "Pro", body: "The first AI features, GitHub and file import, a browser extension and a CLI." },
      v3: { name: "Teams and community", status: "Planned", body: "A shared library, roles, public community stacks and an MCP server." },
      v3plus: { name: "Advanced AI and enterprise", status: "After V3", body: "Stack detection from your codebase, a migration assistant, SSO and enterprise use." },
    },
    faqTitle: "Frequently asked",
    faqTitleAccent: "questions",
    final: { title: "Say it once.", titleAccent: "We'll remember the rest." },
    footer: { label: "Legal", terms: "Terms of Use", privacy: "Privacy", feedback: "Feedback" },
  },
});

type Copy = (typeof copy)[Locale];

function Chips({ agents }: { agents: Copy["agents"] }) {
  return (
    <>
      {agents.map((agent) => (
        <span className="lp-chip" key={agent.name}><TechLogo name={agent.name} size={20} slug={agent.slug} /><code>{agent.file}</code>{agent.name}</span>
      ))}
      {stack.map((item) => (
        <span className="lp-chip" key={item.name}><TechLogo name={item.name} size={20} slug={item.slug} />{item.name}</span>
      ))}
    </>
  );
}

/**
 * Public landing (owner's pick 2026-09-30): the three canvas directions combined,
 * with the live workspace preview. The status line reports whether the
 * workspace engine answers, as smoke checks and uptime probes expect.
 * Rendered in Turkish at / and in English at /en; the nested provider keeps
 * the client pieces (language and theme pickers, sample files, clock) in the
 * landing's language whatever the visitor's stored preference is.
 */
export async function Landing({ locale }: { locale: Locale }) {
  const [theme, status] = await Promise.all([readTheme(), getWorkspaceStatus()]);
  const online = status === "connected";
  const t = copy[locale];
  const pricing = proPricing[locale];
  const faqs = t.faqs(pricing);
  return (
    <LocaleProvider locale={locale}>
      <main className={`lp ${serif.variable}`}>
        <RevealOnScroll />
        <header className="lp-header">
          <Link className="brand" href={landingPaths[locale]}><BrandMark /></Link>
          <nav aria-label="Site">
            <a href="#urun">{t.nav.product}</a>
            <a href="#nasil">{t.nav.how}</a>
            <a href="#plan">{t.nav.plan}</a>
            <a href="#sss">{t.nav.faq}</a>
          </nav>
          <div className="lp-header-tools">
            <ThemeToggle initialTheme={theme} />
            <LanguageSwitch />
            <Link className="lp-link" href="/auth?mode=sign-in">{t.signIn}</Link>
            <Link className="lp-button dark" href="/auth">{t.startFree}</Link>
          </div>
        </header>

        <section className="lp-hero" id="urun">
          <div className="lp-hero-copy">
            <a className="lp-pill" href="#plan"><span>Beta</span>{t.pill} <ArrowRight aria-hidden size={14} /></a>
            <h1>
              <span className="lp-word" style={{ "--d": 0 } as CSSProperties}>{t.hero.first}</span>{" "}
              <span className="lp-word" style={{ "--d": 1 } as CSSProperties}>{t.hero.second}</span>{" "}
              <span className="lp-word" style={{ "--d": 2 } as CSSProperties}><em className="lp-mark">{t.hero.accent}</em></span>{" "}
              <span className="lp-word" style={{ "--d": 3 } as CSSProperties}>{t.hero.last}</span>
            </h1>
            <p className="lp-lead">{t.lead}</p>
            <div className="lp-cta">
              <Link className="lp-button primary" href="/auth">{t.createWorkspace} <ArrowRight aria-hidden size={18} /></Link>
              <a className="lp-button ghost" href="#nasil">{t.howItWorks}</a>
            </div>
            <p className="lp-note"><CheckCircle aria-hidden size={16} weight="fill" />{t.note}</p>
            <p className={`lp-status${online ? "" : " offline"}`}><span role="status">{online ? t.online : t.offline}</span></p>
          </div>

          <div aria-label={t.stageLabel} className="lp-stage" role="img">
            <span aria-hidden="true" className="lp-float f1"><code>AGENTS.md</code></span>
            <span aria-hidden="true" className="lp-float f2"><code>CLAUDE.md</code></span>
            <span aria-hidden="true" className="lp-float f3"><code>.mdc</code></span>
            <div aria-hidden="true" className="lp-app">
              <div className="lp-app-bar"><i /><i /><i /><span>oponoya.com/workspace</span></div>
              <div className="lp-app-body">
                <div className="lp-app-side">
                  <b><span className="brand-mark"><LogoMark /></span>Oponoya</b>
                  <span className="on"><i />{t.app.overview}</span>
                  <span>{t.app.projects}</span>
                  <span>{t.app.library}</span>
                  <span>{t.app.profiles}</span>
                  <span>{t.app.recipes}</span>
                  <span className="cta">{t.app.newProjectCta}</span>
                </div>
                <div className="lp-app-main">
                  <div className="lp-app-hero">
                    <LiveClock initial={new Date().toISOString()} />
                    <strong>{t.app.welcome}</strong>
                    <small>{t.app.lastVisit}</small>
                  </div>
                  <b className="lp-app-title">{t.app.yourProjects}</b>
                  <div className="lp-app-cards">
                    <div><span className="initial">A</span><em className="mvp">MVP</em><b>Atlas Finance</b><span className="logos"><TechLogo name="Next.js" size={16} slug="nextjs" /><TechLogo name="PostgreSQL" size={16} slug="postgresql" /><TechLogo name="Drizzle ORM" size={16} slug="drizzle-orm" /></span><small className="ok">{t.app.upToDate}</small></div>
                    <div><span className="initial">S</span><em className="prod">{t.app.production}</em><b>Studio API</b><span className="logos"><TechLogo name="TypeScript" size={16} slug="typescript" /><TechLogo name="React" size={16} slug="react" /></span><small className="warn">{t.app.needsRefresh}</small></div>
                    <div className="new"><b>{t.app.newProject}</b><small>{t.app.gather}</small></div>
                  </div>
                  <b className="lp-app-title">{t.app.suggestions}</b>
                  <div className="lp-app-chips"><span>{t.app.suggestionTailwind}</span><span>{t.app.suggestionT3}</span></div>
                </div>
              </div>
              <div className="lp-app-toast"><CheckCircle aria-hidden size={16} weight="fill" />{t.app.toast}</div>
            </div>
          </div>
        </section>

        <section aria-label={t.marqueeLabel} className="lp-marquee">
          <p>{t.marquee}</p>
          <div className="lp-marquee-window">
            <div className="lp-marquee-track">
              <div className="lp-marquee-set"><Chips agents={t.agents} /></div>
              <div aria-hidden="true" className="lp-marquee-set"><Chips agents={t.agents} /></div>
            </div>
          </div>
        </section>

        <section className="lp-compare lp-reveal" id="neden">
          <article className="without">
            <span className="lp-eyebrow">{t.without.eyebrow}</span>
            <h2>{t.without.title}</h2>
            <ul>
              {t.without.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </article>
          <article className="with">
            <span className="lp-eyebrow">{t.with.eyebrow}</span>
            <h2>{t.with.title}</h2>
            <ul>
              {t.with.items.map((item) => <li key={item}><CheckCircle aria-hidden size={18} weight="fill" />{item}</li>)}
            </ul>
          </article>
        </section>

        <section className="lp-source lp-reveal">
          <div className="lp-source-copy">
            <span className="lp-eyebrow">{t.source.eyebrow}</span>
            <h2>{t.source.title} <span>{t.source.titleAccent}</span></h2>
            <p>{t.source.body}</p>
            <ul className="lp-decisions">
              {t.decisions.map((item) => (
                <li className={item.tone} key={item.tech}><item.icon aria-hidden size={20} weight={item.tone === "locked" || item.tone === "preferred" ? "fill" : "regular"} /><b>{item.tech}</b><span>{item.mode}</span><small>{item.text}</small></li>
              ))}
            </ul>
          </div>
          <AgentFiles />
        </section>

        <section className="lp-steps lp-reveal" id="nasil">
          <h2>{t.steps.title} <em>{t.steps.titleAccent}</em></h2>
          <ol>
            {t.steps.items.map((item) => <li key={item.n}><span>{item.n}</span><h3>{item.title}</h3><p>{item.body}</p></li>)}
          </ol>
        </section>

        <section className="lp-bento-wrap lp-reveal">
          <h2>{t.bento.title} <span>{t.bento.titleAccent}</span></h2>
          <SpotlightGrid className="lp-bento">
            <article className="lp-spot wide"><Database aria-hidden size={26} /><h3>{t.bento.library.title}</h3><p>{t.bento.library.body}</p><div className="lp-bento-logos">{stack.slice(0, 6).map((item) => <span key={item.name}><TechLogo name={item.name} size={22} slug={item.slug} /></span>)}</div></article>
            <article className="lp-spot"><Stack aria-hidden size={26} /><h3>{t.bento.profiles.title}</h3><p>{t.bento.profiles.body}</p></article>
            <article className="lp-spot"><Clock aria-hidden size={26} /><h3>{t.bento.versions.title}</h3><p>{t.bento.versions.body}</p></article>
            <article className="lp-spot"><DownloadSimple aria-hidden size={26} /><h3>{t.bento.data.title}</h3><p>{t.bento.data.body}</p></article>
            <article className="lp-spot"><Sparkle aria-hidden size={26} /><h3>{t.bento.suggestions.title}</h3><p>{t.bento.suggestions.body}</p></article>
          </SpotlightGrid>
        </section>

        <section className="lp-plan lp-reveal" id="plan">
          <div className="lp-plan-head">
            <h2>{t.plan.title}</h2>
            <p>{t.plan.lead}</p>
          </div>
          <ol>
            <li className="now"><b>V1</b><strong>{t.plan.v1.name}</strong><small>{t.plan.v1.status}</small><p>{t.plan.v1.body}</p></li>
            <li className="next"><b>V2</b><strong>{t.plan.v2.name}</strong><small><s>{pricing.regular}</s> {pricing.launch} / {pricing.period}</small><p>{t.plan.v2.body}</p></li>
            <li className="planned"><b>V3</b><strong>{t.plan.v3.name}</strong><small>{t.plan.v3.status}</small><p>{t.plan.v3.body}</p></li>
            <li className="later"><b>V3+</b><strong>{t.plan.v3plus.name}</strong><small>{t.plan.v3plus.status}</small><p>{t.plan.v3plus.body}</p></li>
          </ol>
        </section>

        <section className="lp-faq lp-reveal" id="sss">
          <h2>{t.faqTitle} <em>{t.faqTitleAccent}</em></h2>
          <div>
            {faqs.map((item, index) => (
              <details key={item.q} open={index === 0}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="lp-final lp-reveal">
          <h2>{t.final.title} <span>{t.final.titleAccent}</span></h2>
          <Link className="lp-button primary" href="/auth">{t.startFree} <ArrowRight aria-hidden size={18} /></Link>
        </section>

        <footer className="lp-footer">
          <span className="brand"><BrandMark /></span>
          <nav aria-label={t.footer.label}><Link href="/legal/terms">{t.footer.terms}</Link><Link href="/legal/privacy">{t.footer.privacy}</Link><Link href="/workspace/feedback">{t.footer.feedback}</Link></nav>
          <span>© {new Date().getFullYear()} {productName}</span>
        </footer>
      </main>
    </LocaleProvider>
  );
}
