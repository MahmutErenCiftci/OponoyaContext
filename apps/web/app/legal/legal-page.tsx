import type { LegalConfig } from "@devcontext/contracts";
import { Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "../../components/theme-toggle";
import { getLegalConfig } from "../../lib/api";
import { loadSession } from "../../lib/server-session";
import { readTheme } from "../../lib/theme-server";

/** Human names of the configuration keys the operator still has to supply. */
export const placeholderLabels: Record<string, string> = {
  LEGAL_ENTITY_NAME: "hizmet sağlayıcının tüzel adı",
  LEGAL_ENTITY_ADDRESS: "hizmet sağlayıcının adresi",
  LEGAL_CONTACT_EMAIL: "iletişim e-postası",
  LEGAL_JURISDICTION: "uygulanacak hukuk ve yetkili yargı yeri",
  LEGAL_EFFECTIVE_DATE: "yürürlük tarihi",
  LEGAL_APPROVED_AT: "hukuki onay tarihi",
  LEGAL_SUBPROCESSORS: "alt işlemci listesi",
  HOSTING_REGION: "barındırma bölgesi",
  BACKUP_RETENTION_DAYS: "yedek saklama süresi",
  BILLING_RECORDS_RETENTION_YEARS: "fatura kayıtlarının saklama süresi",
};

/** A configured value, or an explicit placeholder that names the missing key; never an invented claim. */
export function Value({ value, name }: { value: string | number | null; name: string }) {
  if (value === null || value === "") return <mark className="placeholder" title={placeholderLabels[name] ?? name}>belirlenmedi: {name}</mark>;
  return <>{String(value)}</>;
}

export function formatLegalDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeZone: "UTC" }).format(parsed);
}

export async function LegalPage({ current, title, children }: {
  current: "terms" | "privacy";
  title: string;
  children(legal: LegalConfig | null): ReactNode;
}) {
  const [legal, theme, session] = await Promise.all([getLegalConfig(), readTheme(), loadSession()]);
  const signedIn = session.status === "authenticated";
  const draft = legal === null || legal.draft;

  return (
    <main>
      <header className="site-header">
        <Link className="brand" href="/"><span className="brand-mark">D</span><span>DevContext</span></Link>
        <nav aria-label="Yasal belgeler"><Link aria-current={current === "terms" ? "page" : undefined} href="/legal/terms">Kullanım Şartları</Link><Link aria-current={current === "privacy" ? "page" : undefined} href="/legal/privacy">Gizlilik Politikası</Link></nav>
        <div className="right">
          <ThemeToggle initialTheme={theme} />
          {signedIn
            ? <Link className="button" href="/workspace">Çalışma alanına dön</Link>
            : <><Link className="login" href="/auth?mode=sign-in">Giriş yap</Link><Link className="button primary" href="/auth">Başla</Link></>}
        </div>
      </header>
      <article aria-labelledby="legal-title" className="legal-page">
        <h1 id="legal-title">{title}</h1>
        <p className="meta">
          Yürürlük tarihi: <Value name="LEGAL_EFFECTIVE_DATE" value={formatLegalDate(legal?.effectiveDate ?? null)} />
          {" · "}Durum: {draft ? "taslak, hukuki onay bekliyor" : `onaylandı (${formatLegalDate(legal?.approvedAt ?? null) ?? ""})`}
        </p>
        {draft && (
          <p className="draft-banner" role="status">
            <Warning aria-hidden size={22} />
            <span>Bu metin bir taslaktır; işletme sahibinin ve hukuk danışmanının onayını bekler. “belirlenmedi” olarak işaretli alanlar sunucu yapılandırmasından gelir ve henüz girilmemiştir. Burada hiçbir şirket kimliği, adres, alt işlemci, saklama süresi veya yargı yeri varsayılmamıştır.</span>
          </p>
        )}
        {legal === null && <p className="note warning" role="status"><Warning aria-hidden size={20} />Yapılandırma şu an okunamıyor; yapılandırmaya bağlı alanlar “belirlenmedi” görünür.</p>}
        {children(legal)}
      </article>
    </main>
  );
}
