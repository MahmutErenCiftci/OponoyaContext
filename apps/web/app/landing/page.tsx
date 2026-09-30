import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";
import Link from "next/link";
import { ArrowRight, CheckCircle, CircleDashed, Clock, Database, DownloadSimple, LockSimple, MinusCircle, Sparkle, Stack, Star } from "@phosphor-icons/react/dist/ssr";
import type { CSSProperties } from "react";
import { productName } from "@devcontext/contracts/brand";
import { BrandMark } from "../../components/brand-mark";
import { LogoMark } from "../../components/logo-mark";
import { TechLogo } from "../../components/tech-logo";
import { ThemeToggle } from "../../components/theme-toggle";
import { proPricing } from "../../lib/roadmap";
import { readTheme } from "../../lib/theme-server";
import { LiveClock } from "../workspace/live-clock";
import { AgentFiles, RevealOnScroll, SpotlightGrid } from "./landing-effects";

// Italic accent words only; downloaded at build time and served from this origin like the other fonts.
const serif = Instrument_Serif({ subsets: ["latin", "latin-ext"], weight: "400", style: ["normal", "italic"], variable: "--font-serif", display: "swap" });

/** Preview of the next landing page (owner review, 2026-09-30); `/` stays unchanged until it is chosen. */
export const metadata: Metadata = {
  title: "Yeni landing önizlemesi",
  robots: { index: false, follow: false },
};

const agents = [
  { file: "AGENTS.md", name: "Codex", slug: "codex-cli" },
  { file: "CLAUDE.md", name: "Claude Code", slug: "claude-code" },
  { file: ".mdc", name: "Cursor", slug: "cursor" },
  { file: "instructions", name: "GitHub Copilot", slug: "github-copilot" },
  { file: ".md", name: "Genel talimat", slug: null },
];

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

const decisions = [
  { tech: "Next.js", mode: "Kilitli", tone: "locked", icon: LockSimple, text: "AI bu seçimi değiştirmesin." },
  { tech: "Drizzle ORM", mode: "Tercih edilen", tone: "preferred", icon: Star, text: "Varsayılan bu; gerekçeyle değiştirilebilir." },
  { tech: "Mimari", mode: "AI karar versin", tone: "delegated", icon: CircleDashed, text: "Kısıtlar içinde ajan seçsin, gerekçesini yazsın." },
  { tech: "Redis", mode: "Devre dışı", tone: "disabled", icon: MinusCircle, text: "Bu projede kullanılmasın." },
];

const faqs = [
  { q: "Oponoya ücretli mi?", a: `Şu an geliştirme aşamasında ve tamamen ücretsiz. Free hesap her zaman kalacak; Pro, V2 ile gelişim indirimiyle ${proPricing.launch} / ${proPricing.period} olarak gelecek.` },
  { q: "Hangi ajanlarla çalışır?", a: "Genel talimat, AGENTS.md (Codex) ve CLAUDE.md (Claude Code) Free’de; Cursor ve GitHub Copilot çıktıları Pro’da." },
  { q: "Verilerim bir AI’a gönderiliyor mu?", a: "Hayır. Talimatlar sunucuda deterministik olarak derlenir. İleride gelecek AI önerileri yalnızca sen izin verirsen çalışacak." },
  { q: "Verilerimi geri alabilir miyim?", a: "Evet. Tüm çalışma alanını JSON olarak dışa aktarabilir, istediğin an hesabını ve verilerini silebilirsin." },
];

function Chips() {
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

export default async function LandingPreviewPage() {
  const theme = await readTheme();
  return (
    <main className={`lp ${serif.variable}`}>
      <RevealOnScroll />
      <header className="lp-header">
        <Link className="brand" href="/landing"><BrandMark /></Link>
        <nav aria-label="Site">
          <a href="#urun">Ürün</a>
          <a href="#nasil">Nasıl çalışır</a>
          <a href="#plan">Plan</a>
          <a href="#sss">SSS</a>
        </nav>
        <div className="lp-header-tools">
          <ThemeToggle initialTheme={theme} />
          <Link className="lp-link" href="/auth?mode=sign-in">Giriş yap</Link>
          <Link className="lp-button dark" href="/auth">Ücretsiz başla</Link>
        </div>
      </header>

      <section className="lp-hero" id="urun">
        <div className="lp-hero-copy">
          <a className="lp-pill" href="#plan"><span>Beta</span>Şu an tamamen ücretsiz · Gelişim planı <ArrowRight aria-hidden size={14} /></a>
          <h1>
            <span className="lp-word" style={{ "--d": 0 } as CSSProperties}>Her yeni projede</span>{" "}
            <span className="lp-word" style={{ "--d": 1 } as CSSProperties}>aynı şeyleri</span>{" "}
            <span className="lp-word" style={{ "--d": 2 } as CSSProperties}><em className="lp-mark">tekrar</em></span>{" "}
            <span className="lp-word" style={{ "--d": 3 } as CSSProperties}>anlatma.</span>
          </h1>
          <p className="lp-lead">Teknolojilerini bir kez anlat. Oponoya onları Codex, Claude Code, Cursor ve Copilot’un anlayacağı talimatlara dönüştürür.</p>
          <div className="lp-cta">
            <Link className="lp-button primary" href="/auth">Çalışma alanını oluştur <ArrowRight aria-hidden size={18} /></Link>
            <a className="lp-button ghost" href="#nasil">Nasıl çalışır</a>
          </div>
          <p className="lp-note"><CheckCircle aria-hidden size={16} weight="fill" />Kredi kartı gerekmez · Free hesap her zaman kalacak</p>
        </div>

        <div aria-label="Oponoya çalışma alanının önizlemesi" className="lp-stage" role="img">
          <span aria-hidden="true" className="lp-float f1"><code>AGENTS.md</code></span>
          <span aria-hidden="true" className="lp-float f2"><code>CLAUDE.md</code></span>
          <span aria-hidden="true" className="lp-float f3"><code>.mdc</code></span>
          <div aria-hidden="true" className="lp-app">
            <div className="lp-app-bar"><i /><i /><i /><span>oponoya.com/workspace</span></div>
            <div className="lp-app-body">
              <div className="lp-app-side">
                <b><span className="brand-mark"><LogoMark /></span>Oponoya</b>
                <span className="on"><i />Genel bakış</span>
                <span>Projeler</span>
                <span>Kütüphane</span>
                <span>Profiller</span>
                <span>Tarifler</span>
                <span className="cta">+ Yeni proje</span>
              </div>
              <div className="lp-app-main">
                <div className="lp-app-hero">
                  <LiveClock initial={new Date().toISOString()} />
                  <strong>Tekrar hoş geldin, Deniz</strong>
                  <small>Son girişin: dün · En son: Talimatlar oluşturuldu</small>
                </div>
                <b className="lp-app-title">Projelerin</b>
                <div className="lp-app-cards">
                  <div><span className="initial">A</span><em className="mvp">MVP</em><b>Atlas Finance</b><span className="logos"><TechLogo name="Next.js" size={16} slug="nextjs" /><TechLogo name="PostgreSQL" size={16} slug="postgresql" /><TechLogo name="Drizzle ORM" size={16} slug="drizzle-orm" /></span><small className="ok">● Bağlam güncel</small></div>
                  <div><span className="initial">S</span><em className="prod">Üretim</em><b>Studio API</b><span className="logos"><TechLogo name="TypeScript" size={16} slug="typescript" /><TechLogo name="React" size={16} slug="react" /></span><small className="warn">● Yenilenmeli</small></div>
                  <div className="new"><b>Yeni proje</b><small>Tercihlerini topla</small></div>
                </div>
                <b className="lp-app-title">Senin için öneriler</b>
                <div className="lp-app-chips"><span>Tailwind CSS · Next.js ile sık kullanılır</span><span>T3 Stack · 5/13 teknolojin</span></div>
              </div>
            </div>
            <div className="lp-app-toast"><CheckCircle aria-hidden size={16} weight="fill" />Sürüm 3 oluşturuldu</div>
          </div>
        </div>
      </section>

      <section aria-label="Desteklenen ajanlar ve teknolojiler" className="lp-marquee">
        <p>Tek kaynaktan, her ajan için doğru dosya</p>
        <div className="lp-marquee-window">
          <div className="lp-marquee-track">
            <div className="lp-marquee-set"><Chips /></div>
            <div aria-hidden="true" className="lp-marquee-set"><Chips /></div>
          </div>
        </div>
      </section>

      <section className="lp-compare lp-reveal" id="neden">
        <article className="without">
          <span className="lp-eyebrow">Oponoya olmadan</span>
          <h2>Her ajan, her projede sıfırdan başlar.</h2>
          <ul>
            <li>Aynı tercihleri her yeni projede yeniden yazarsın.</li>
            <li>Her araç için ayrı talimat dosyası elle güncellenir.</li>
            <li>Hangi kararın neden verildiği kaybolur.</li>
            <li>Ajan, kilitlediğin seçimi sessizce değiştirebilir.</li>
          </ul>
        </article>
        <article className="with">
          <span className="lp-eyebrow">Oponoya ile</span>
          <h2>Bir kez anlatırsın, her projede hatırlanır.</h2>
          <ul>
            <li><CheckCircle aria-hidden size={18} weight="fill" />Tercihlerin kütüphanende, projeler profillerden devralır.</li>
            <li><CheckCircle aria-hidden size={18} weight="fill" />Tüm talimat dosyaları tek kaynaktan üretilir.</li>
            <li><CheckCircle aria-hidden size={18} weight="fill" />Her kararın kaynağı ve gerekçesi görünür.</li>
            <li><CheckCircle aria-hidden size={18} weight="fill" />Kilitli seçimler talimatlarda açıkça yazar.</li>
          </ul>
        </article>
      </section>

      <section className="lp-source lp-reveal">
        <div className="lp-source-copy">
          <span className="lp-eyebrow">Tek kaynak</span>
          <h2>Bir kez tanımla. <span>Her ajana aynı bağlamı ver.</span></h2>
          <p>Kararların deterministik olarak derlenir; her ajan kendi dosya biçimini alır. İçerik değiştiğinde yeni sürüm oluşur.</p>
          <ul className="lp-decisions">
            {decisions.map((item) => (
              <li className={item.tone} key={item.tech}><item.icon aria-hidden size={20} weight={item.tone === "locked" || item.tone === "preferred" ? "fill" : "regular"} /><b>{item.tech}</b><span>{item.mode}</span><small>{item.text}</small></li>
            ))}
          </ul>
        </div>
        <AgentFiles />
      </section>

      <section className="lp-steps lp-reveal" id="nasil">
        <h2>Üç adım. <em>O kadar.</em></h2>
        <ol>
          <li><span>01</span><h3>Kaydet</h3><p>Teknoloji yığınını, tercihlerini ve kurallarını tek yerde sakla. Katalogdan tek tıkla ekle.</p></li>
          <li><span>02</span><h3>Projeni oluştur</h3><p>Profil ve tariflerini birleştir; her proje için tutarlı bir bağlam kur.</p></li>
          <li><span>03</span><h3>Aktar</h3><p>Talimatları oluştur ve kodlama ajanına ver. Sürümler saklanır.</p></li>
        </ol>
      </section>

      <section className="lp-bento-wrap lp-reveal">
        <h2>Bağlamın tek yerde, <span>kararların sende.</span></h2>
        <SpotlightGrid className="lp-bento">
          <article className="lp-spot wide"><Database aria-hidden size={26} /><h3>Kütüphane</h3><p>Katalogdaki yüzlerce teknolojiyi tek tıkla ekle ya da kendi kaynaklarını kaydet; her birine varsayılan bir karar ver.</p><div className="lp-bento-logos">{stack.slice(0, 6).map((item) => <span key={item.name}><TechLogo name={item.name} size={22} slug={item.slug} /></span>)}</div></article>
          <article className="lp-spot"><Stack aria-hidden size={26} /><h3>Profiller ve tarifler</h3><p>Öncelik her zaman açık: Proje › Tarif › Profil › Kütüphane.</p></article>
          <article className="lp-spot"><Clock aria-hidden size={26} /><h3>Sürümler</h3><p>Her derleme saklanır; iki sürüm arasında neyin değiştiğini gör.</p></article>
          <article className="lp-spot"><DownloadSimple aria-hidden size={26} /><h3>Verin senin</h3><p>Tüm çalışma alanını JSON olarak dışa aktar, içe aktar ya da hesabını sil.</p></article>
          <article className="lp-spot"><Sparkle aria-hidden size={26} /><h3>Öneriler</h3><p>Kütüphanene göre sık birlikte kullanılan teknolojiler ve hazır stack’ler.</p></article>
        </SpotlightGrid>
      </section>

      <section className="lp-plan lp-reveal" id="plan">
        <div className="lp-plan-head">
          <h2>Gelişim planı</h2>
          <p>Geliştirme aşamasında her şey ücretsiz. Free hesap her zaman kalacak.</p>
        </div>
        <ol>
          <li className="now"><b>V1</b><strong>Temel</strong><small>Şu an · Ücretsiz</small><p>Kütüphane, projeler, profiller, tarifler, katalog ve talimat çıktıları.</p></li>
          <li className="next"><b>V2</b><strong>Pro</strong><small><s>{proPricing.regular}</s> {proPricing.launch} / {proPricing.period}</small><p>İlk AI özellikleri, GitHub ve dosya içe aktarma, tarayıcı eklentisi ve CLI.</p></li>
          <li className="planned"><b>V3</b><strong>Takımlar ve topluluk</strong><small>Planlanıyor</small><p>Ortak kütüphane, roller, herkese açık topluluk stack’leri, MCP sunucusu.</p></li>
          <li className="later"><b>V3+</b><strong>Gelişmiş AI ve kurumsal</strong><small>V3 sonrası</small><p>Kod tabanından stack tespiti, geçiş asistanı, SSO ve kurumsal kullanım.</p></li>
        </ol>
      </section>

      <section className="lp-faq lp-reveal" id="sss">
        <h2>Sık sorulan <em>sorular</em></h2>
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
        <h2>Bir kez anlat. <span>Gerisi hatırlansın.</span></h2>
        <Link className="lp-button primary" href="/auth">Ücretsiz başla <ArrowRight aria-hidden size={18} /></Link>
      </section>

      <footer className="lp-footer">
        <span className="brand"><BrandMark /></span>
        <nav aria-label="Yasal"><Link href="/legal/terms">Kullanım Şartları</Link><Link href="/legal/privacy">Gizlilik</Link></nav>
        <span>© {new Date().getFullYear()} {productName}</span>
      </footer>
    </main>
  );
}
