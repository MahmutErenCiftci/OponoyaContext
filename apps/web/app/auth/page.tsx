import type { Metadata } from "next";
import { Briefcase, CheckCircle, File, FileText, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ThemeToggle } from "../../components/theme-toggle";
import { getAuthOptions } from "../../lib/api";
import { loadSession } from "../../lib/server-session";
import { readTheme } from "../../lib/theme-server";
import { AuthForm } from "./auth-form";
import { BrandMark } from "../../components/brand-mark";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ mode?: string }> }): Promise<Metadata> {
  const { mode } = await searchParams;
  return { title: mode === "sign-in" ? "Giriş yap" : "Hesap oluştur" };
}

const preview = [
  ["1", "# Atlas Finance — AGENTS.md", true],
  ["2", "", false],
  ["3", "Bu dosya, Atlas Finance projesine katkı sunacak", false],
  ["4", "yapay zekâ ajanları ve geliştiriciler için", false],
  ["5", "deterministik talimatları içerir.", false],
  ["6", "", false],
  ["7", "## Proje özeti", true],
  ["8", "Atlas Finance, serbest çalışanlar için kişisel finans", false],
  ["9", "SaaS uygulamasıdır.", false],
  ["10", "Teknoloji yığını: Next.js, TypeScript, PostgreSQL.", false],
] as const;

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ mode?: string; deleted?: string }> }) {
  const query = await searchParams;
  const mode = query.mode === "sign-in" ? "sign-in" : "sign-up";
  const deleted = query.deleted === "1";
  const [session, theme, options] = await Promise.all([loadSession(), readTheme(), getAuthOptions()]);
  if (session.status === "authenticated") redirect("/workspace");
  const unavailable = session.status === "unavailable";

  return (
    <main>
      <header className="auth-header">
        <Link className="brand" href="/"><BrandMark /></Link>
        <ThemeToggle initialTheme={theme} />
      </header>
      {deleted && (
        <p className="note success" role="status" style={{ margin: "16px var(--gutter) 0" }}>
          <CheckCircle aria-hidden size={20} />Hesabın ve tüm verilerin silindi; oturumun kapatıldı. Yeni bir hesap açmak istersen buradan başlayabilirsin.
        </p>
      )}
      {unavailable && (
        <p className="note warning" role="status" style={{ margin: "16px var(--gutter) 0" }}>
          Çalışma alanı motoruna şu an ulaşılamıyor; geri gelene kadar giriş yapılamaz. Kaydettiğin hiçbir şey etkilenmedi, birazdan tekrar dene.
        </p>
      )}
      <AuthForm
        initialMode={mode}
        passwordReset={options.passwordReset}
        signInNarrative={(
          <section aria-label="Ürün tanıtımı" className="auth-narrative">
            <h2>Kaldığın yerden devam et.</h2>
            <p className="lead">Geliştirici bağlamını tek yerde birleştir, her projede tutarlı ve izlenebilir şekilde ilerle.</p>
            <div className="code-preview" aria-hidden="true">
              <header><File aria-hidden size={20} />AGENTS.md<span className="chip mono">Proje: Atlas Finance</span></header>
              <pre>{preview.map(([line, text, highlight]) => <span key={line}><span className="ln">{line}</span><span className={highlight ? "hl" : ""}>{text}</span>{"\n"}</span>)}</pre>
            </div>
          </section>
        )}
        signUpNarrative={(
          <section aria-label="Ürün tanıtımı" className="auth-narrative">
            <h2>Geliştirme alışkanlıkların,<br />tek yerde.</h2>
            <p className="lead">Kullandığın araçları ve tekrar eden kuralları kaydet. Projendeki kararların nereden geldiğini gör. Deterministik talimatları derle ve dış araçlara aktar.</p>
            <div className="benefits">
              <div><span className="mark"><Briefcase aria-hidden size={28} /></span><div><strong>Araçlarını kaydet</strong><p>Tercih ettiğin araçları, sürümleri ve ayarları profiller halinde sakla.</p></div></div>
              <div><span className="mark"><FileText aria-hidden size={28} /></span><div><strong>Kuralları yeniden kullan</strong><p>Sık kullandığın kuralları tariflerle birleştir, tutarlı şekilde uygula.</p></div></div>
              <div><span className="mark"><ShieldCheck aria-hidden size={28} /></span><div><strong>Kararların kaynağını izle</strong><p>Her kararın nereden geldiğini ve oluşturduğun talimat sürümlerini gör.</p></div></div>
            </div>
          </section>
        )}
      />
    </main>
  );
}
