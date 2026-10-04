import type { Metadata } from "next";
import { Briefcase, CheckCircle, File, FileText, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LanguageSwitch } from "../../components/language-switch";
import { ThemeToggle } from "../../components/theme-toggle";
import { getAuthOptions } from "../../lib/api";
import { defineCopy } from "../../lib/i18n";
import { getLocale } from "../../lib/locale-server";
import { loadSession } from "../../lib/server-session";
import { readTheme } from "../../lib/theme-server";
import { AuthForm } from "./auth-form";
import { BrandMark } from "../../components/brand-mark";

const copy = defineCopy({
  tr: {
    signInTitle: "Giriş yap",
    signUpTitle: "Hesap oluştur",
    deleted: "Hesabın ve tüm verilerin silindi; oturumun kapatıldı. Yeni bir hesap açmak istersen buradan başlayabilirsin.",
    unavailable: "Çalışma alanı motoruna şu an ulaşılamıyor; geri gelene kadar giriş yapılamaz. Kaydettiğin hiçbir şey etkilenmedi, birazdan tekrar dene.",
    narrativeLabel: "Ürün tanıtımı",
    signIn: {
      title: "Kaldığın yerden devam et.",
      lead: "Geliştirici bağlamını tek yerde birleştir, her projede tutarlı ve izlenebilir şekilde ilerle.",
      projectChip: "Proje: Atlas Finance",
    },
    signUp: {
      titleFirst: "Geliştirme alışkanlıkların,",
      titleSecond: "tek yerde.",
      lead: "Kullandığın araçları ve tekrar eden kuralları kaydet. Projendeki kararların nereden geldiğini gör. Deterministik talimatları derle ve dış araçlara aktar.",
      tools: { title: "Araçlarını kaydet", body: "Tercih ettiğin araçları, sürümleri ve ayarları profiller halinde sakla." },
      rules: { title: "Kuralları yeniden kullan", body: "Sık kullandığın kuralları tariflerle birleştir, tutarlı şekilde uygula." },
      trace: { title: "Kararların kaynağını izle", body: "Her kararın nereden geldiğini ve oluşturduğun talimat sürümlerini gör." },
    },
    /** Sample AGENTS.md lines: text and whether the line is a heading. */
    preview: [
      ["# Atlas Finance — AGENTS.md", true],
      ["", false],
      ["Bu dosya, Atlas Finance projesine katkı sunacak", false],
      ["yapay zekâ ajanları ve geliştiriciler için", false],
      ["deterministik talimatları içerir.", false],
      ["", false],
      ["## Proje özeti", true],
      ["Atlas Finance, serbest çalışanlar için kişisel finans", false],
      ["SaaS uygulamasıdır.", false],
      ["Teknoloji yığını: Next.js, TypeScript, PostgreSQL.", false],
    ] as Array<[string, boolean]>,
  },
  en: {
    signInTitle: "Sign in",
    signUpTitle: "Create account",
    deleted: "Your account and all your data were deleted, and you were signed out. If you want to create a new account, you can start here.",
    unavailable: "The workspace engine can't be reached right now, so you can't sign in until it's back. Nothing you saved is affected; try again shortly.",
    narrativeLabel: "Product introduction",
    signIn: {
      title: "Pick up where you left off.",
      lead: "Bring your developer context together in one place and work consistently and traceably in every project.",
      projectChip: "Project: Atlas Finance",
    },
    signUp: {
      titleFirst: "Your development habits,",
      titleSecond: "in one place.",
      lead: "Save the tools you use and the rules you repeat. See where the decisions in your project come from. Compile deterministic instructions and export them to external tools.",
      tools: { title: "Save your tools", body: "Keep the tools, versions and settings you prefer as profiles." },
      rules: { title: "Reuse your rules", body: "Combine the rules you use often into recipes and apply them consistently." },
      trace: { title: "Trace your decisions", body: "See where every decision comes from and the instruction versions you generated." },
    },
    preview: [
      ["# Atlas Finance — AGENTS.md", true],
      ["", false],
      ["This file holds deterministic instructions for", false],
      ["the AI agents and developers who contribute", false],
      ["to the Atlas Finance project.", false],
      ["", false],
      ["## Project summary", true],
      ["Atlas Finance is a personal finance SaaS app", false],
      ["for freelancers.", false],
      ["Tech stack: Next.js, TypeScript, PostgreSQL.", false],
    ],
  },
});

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ mode?: string }> }): Promise<Metadata> {
  const [{ mode }, locale] = await Promise.all([searchParams, getLocale()]);
  const t = copy[locale];
  return { title: mode === "sign-in" ? t.signInTitle : t.signUpTitle };
}

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ mode?: string; deleted?: string }> }) {
  const query = await searchParams;
  const mode = query.mode === "sign-in" ? "sign-in" : "sign-up";
  const deleted = query.deleted === "1";
  const [session, theme, options, locale] = await Promise.all([loadSession(), readTheme(), getAuthOptions(), getLocale()]);
  if (session.status === "authenticated") redirect("/workspace");
  const unavailable = session.status === "unavailable";
  const t = copy[locale];

  return (
    <main>
      <header className="auth-header">
        <Link className="brand" href="/"><BrandMark /></Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <LanguageSwitch />
          <ThemeToggle initialTheme={theme} />
        </div>
      </header>
      {deleted && (
        <p className="note success" role="status" style={{ margin: "16px var(--gutter) 0" }}>
          <CheckCircle aria-hidden size={20} />{t.deleted}
        </p>
      )}
      {unavailable && (
        <p className="note warning" role="status" style={{ margin: "16px var(--gutter) 0" }}>
          {t.unavailable}
        </p>
      )}
      <AuthForm
        initialMode={mode}
        passwordReset={options.passwordReset}
        signInNarrative={(
          <section aria-label={t.narrativeLabel} className="auth-narrative">
            <h2>{t.signIn.title}</h2>
            <p className="lead">{t.signIn.lead}</p>
            <div className="code-preview" aria-hidden="true">
              <header><File aria-hidden size={20} />AGENTS.md<span className="chip mono">{t.signIn.projectChip}</span></header>
              <pre>{t.preview.map(([text, highlight], index) => <span key={index}><span className="ln">{index + 1}</span><span className={highlight ? "hl" : ""}>{text}</span>{"\n"}</span>)}</pre>
            </div>
          </section>
        )}
        signUpNarrative={(
          <section aria-label={t.narrativeLabel} className="auth-narrative">
            <h2>{t.signUp.titleFirst}<br />{t.signUp.titleSecond}</h2>
            <p className="lead">{t.signUp.lead}</p>
            <div className="benefits">
              <div><span className="mark"><Briefcase aria-hidden size={28} /></span><div><strong>{t.signUp.tools.title}</strong><p>{t.signUp.tools.body}</p></div></div>
              <div><span className="mark"><FileText aria-hidden size={28} /></span><div><strong>{t.signUp.rules.title}</strong><p>{t.signUp.rules.body}</p></div></div>
              <div><span className="mark"><ShieldCheck aria-hidden size={28} /></span><div><strong>{t.signUp.trace.title}</strong><p>{t.signUp.trace.body}</p></div></div>
            </div>
          </section>
        )}
      />
    </main>
  );
}
