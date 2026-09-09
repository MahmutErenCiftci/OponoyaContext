import Link from "next/link";
import Image from "next/image";
import { BookmarkSimple, CircleDashed, DownloadSimple, LockSimple, MinusCircle, Stack, Star } from "@phosphor-icons/react/dist/ssr";
import { TechLogo } from "../components/tech-logo";
import { ThemeToggle } from "../components/theme-toggle";
import { getWorkspaceStatus } from "../lib/api";
import { readTheme } from "../lib/theme-server";

export const dynamic = "force-dynamic";

const tools: Array<{ name: string; slug: string | null }> = [
  { name: "Next.js", slug: "nextjs" },
  { name: "PostgreSQL", slug: "postgresql" },
  { name: "shadcn/ui", slug: "shadcn-ui" },
  { name: "Codex", slug: "codex-cli" },
  { name: "Claude Code", slug: "claude-code" },
  { name: "Cursor", slug: "cursor" },
];

export default async function HomePage() {
  const [status, theme] = await Promise.all([getWorkspaceStatus(), readTheme()]);
  const online = status === "connected";

  return (
    <main>
      <header className="site-header">
        <Link className="brand" href="/"><span className="brand-mark">D</span><span>DevContext</span></Link>
        <nav aria-label="Site"><a href="#product">Ürün</a><a href="#workflow">Nasıl çalışır</a><a href="#principles">İlkeler</a></nav>
        <div className="right">
          <ThemeToggle initialTheme={theme} />
          <Link className="login" href="/auth?mode=sign-in">Giriş yap</Link>
          <Link className="button primary" href="/auth">Başla</Link>
        </div>
      </header>

      <section className="hero" id="product">
        <div>
          <h1>Teknolojilerini bir kez anlat. Her projede hatırlansın.</h1>
          <p className="lead">Araçlarını, tercihlerini ve kurallarını kodlama ajanlarının anlayacağı talimatlara dönüştür.</p>
          <div className="cta">
            <Link className="button primary large" href="/auth">Çalışma alanını oluştur</Link>
            <a className="button large" href="#workflow">Nasıl çalışır</a>
          </div>
          <p className={`status${online ? "" : " offline"}`}><span role="status">{online ? "Çalışma alanı hazır" : "Bağlantı kurulamıyor"}</span></p>
        </div>
        <div className="hero-preview">
          <Image alt="DevContext’te proje kararları ve AI talimatlarının önizlemesi" height={1058} priority sizes="(max-width: 900px) 100vw, 58vw" src="/design/context-preview.png" width={1487} />
        </div>
      </section>

      <section aria-label="Desteklenen araçlar" className="brand-strip">
        {tools.map((tool) => <span key={tool.name}><TechLogo name={tool.name} size={28} slug={tool.slug} />{tool.name}</span>)}
      </section>

      <section className="steps" id="workflow">
        <div><span className="mark"><BookmarkSimple size={30} weight="fill" /></span><div><h3>Kaydet</h3><p>Kullandığın teknoloji yığınını, tercihlerini ve kurallarını tek yerde sakla.</p></div></div>
        <div><span className="mark"><Stack size={30} /></span><div><h3>Projeni oluştur</h3><p>Profil ve tariflerini birleştirerek her proje için net, tutarlı bağlam oluştur.</p></div></div>
        <div><span className="mark"><DownloadSimple size={30} /></span><div><h3>Talimatları dışa aktar</h3><p>Deterministik talimatları oluştur ve Codex, Claude Code, Cursor veya Copilot’a aktar.</p></div></div>
      </section>

      <section aria-label="Karar biçimleri" className="legend" id="principles">
        <div className="locked"><LockSimple size={22} /><strong>Kilitli</strong><span>AI bu seçimi değiştirmesin</span></div>
        <div className="preferred"><Star size={22} /><strong>Tercih edilen</strong><span>Gerekirse değiştirilebilir</span></div>
        <div><CircleDashed size={22} /><strong>AI karar versin</strong><span>Duruma göre seçsin</span></div>
        <div><MinusCircle size={22} /><strong>Devre dışı</strong><span>Bu projede kullanılmasın</span></div>
      </section>

      <footer className="site-footer">
        <span className="brand"><span className="brand-mark">D</span><span>DevContext</span></span>
        <p>Geliştirici bağlamını kaydet, şekillendir ve kodlama ajanlarına net talimatlar olarak aktar.</p>
        <nav aria-label="Yasal"><Link href="/legal/terms">Kullanım Şartları</Link><Link href="/legal/privacy">Gizlilik</Link></nav>
        <span className="right">© 2026 DevContext</span>
      </footer>
    </main>
  );
}
