import type { LegalConfig } from "@devcontext/contracts";
import { Info, Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import { LanguageSwitch } from "../../components/language-switch";
import { ThemeToggle } from "../../components/theme-toggle";
import { getLegalConfig } from "../../lib/api";
import { defineCopy, intlLocales, type Locale } from "../../lib/i18n";
import { getLocale } from "../../lib/locale-server";
import { loadSession } from "../../lib/server-session";
import { readTheme } from "../../lib/theme-server";
import { BrandMark } from "../../components/brand-mark";

/** Human names of the configuration keys the operator still has to supply. */
export const placeholderLabels = defineCopy<Record<string, string>>({
  tr: {
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
  },
  en: {
    LEGAL_ENTITY_NAME: "legal name of the service provider",
    LEGAL_ENTITY_ADDRESS: "address of the service provider",
    LEGAL_CONTACT_EMAIL: "contact email",
    LEGAL_JURISDICTION: "governing law and competent courts",
    LEGAL_EFFECTIVE_DATE: "effective date",
    LEGAL_APPROVED_AT: "legal approval date",
    LEGAL_SUBPROCESSORS: "list of subprocessors",
    HOSTING_REGION: "hosting region",
    BACKUP_RETENTION_DAYS: "backup retention period",
    BILLING_RECORDS_RETENTION_YEARS: "retention period for billing records",
  },
});

const copy = defineCopy({
  tr: {
    notSet: "belirlenmedi",
    navLabel: "Yasal belgeler",
    terms: "Kullanım Şartları",
    privacy: "Gizlilik Politikası",
    backToWorkspace: "Çalışma alanına dön",
    signIn: "Giriş yap",
    start: "Başla",
    effectiveDate: "Yürürlük tarihi: ",
    status: "Durum: ",
    draft: "taslak, hukuki onay bekliyor",
    approved: (date: string) => `onaylandı (${date})`,
    draftBanner: "Bu metin bir taslaktır; işletme sahibinin ve hukuk danışmanının onayını bekler. “belirlenmedi” olarak işaretli alanlar sunucu yapılandırmasından gelir ve henüz girilmemiştir. Burada hiçbir şirket kimliği, adres, alt işlemci, saklama süresi veya yargı yeri varsayılmamıştır.",
    /** Only the English text carries a translation note; Turkish is the reference. */
    referenceNote: null as string | null,
    configUnavailable: "Yapılandırma şu an okunamıyor; yapılandırmaya bağlı alanlar “belirlenmedi” görünür.",
  },
  en: {
    notSet: "not set",
    navLabel: "Legal documents",
    terms: "Terms of Use",
    privacy: "Privacy Policy",
    backToWorkspace: "Back to workspace",
    signIn: "Sign in",
    start: "Get started",
    effectiveDate: "Effective date: ",
    status: "Status: ",
    draft: "draft, awaiting legal approval",
    approved: (date: string) => `approved (${date})`,
    draftBanner: "This text is a draft awaiting approval by the business owner and legal counsel. Fields marked “not set” come from the server configuration and have not been entered yet. No company identity, address, subprocessor, retention period or jurisdiction is assumed here.",
    referenceNote: "This English text is a translation for convenience. Until the legal review is complete, the Turkish version is the reference text.",
    configUnavailable: "The configuration can't be read right now; fields that depend on it show as “not set”.",
  },
});

/** A configured value, or an explicit placeholder that names the missing key; never an invented claim. */
export async function Value({ value, name }: { value: string | number | null; name: string }) {
  if (value === null || value === "") {
    const locale = await getLocale();
    return <mark className="placeholder" title={placeholderLabels[locale][name] ?? name}>{copy[locale].notSet}: {name}</mark>;
  }
  return <>{String(value)}</>;
}

export function formatLegalDate(value: string | null, locale: Locale) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(intlLocales[locale], { dateStyle: "long", timeZone: "UTC" }).format(parsed);
}

export async function LegalPage({ current, title, children }: {
  current: "terms" | "privacy";
  title: string;
  children(legal: LegalConfig | null): ReactNode;
}) {
  const [legal, theme, session, locale] = await Promise.all([getLegalConfig(), readTheme(), loadSession(), getLocale()]);
  const signedIn = session.status === "authenticated";
  const draft = legal === null || legal.draft;
  const t = copy[locale];

  return (
    <main>
      <header className="site-header">
        <Link className="brand" href="/"><BrandMark /></Link>
        <nav aria-label={t.navLabel}><Link aria-current={current === "terms" ? "page" : undefined} href="/legal/terms">{t.terms}</Link><Link aria-current={current === "privacy" ? "page" : undefined} href="/legal/privacy">{t.privacy}</Link></nav>
        <div className="right">
          <LanguageSwitch />
          <ThemeToggle initialTheme={theme} />
          {signedIn
            ? <Link className="button" href="/workspace">{t.backToWorkspace}</Link>
            : <><Link className="login" href="/auth?mode=sign-in">{t.signIn}</Link><Link className="button primary" href="/auth">{t.start}</Link></>}
        </div>
      </header>
      <article aria-labelledby="legal-title" className="legal-page">
        <h1 id="legal-title">{title}</h1>
        <p className="meta">
          {t.effectiveDate}<Value name="LEGAL_EFFECTIVE_DATE" value={formatLegalDate(legal?.effectiveDate ?? null, locale)} />
          {" · "}{t.status}{draft ? t.draft : t.approved(formatLegalDate(legal?.approvedAt ?? null, locale) ?? "")}
        </p>
        {draft && (
          <p className="draft-banner" role="status">
            <Warning aria-hidden size={22} />
            <span>{t.draftBanner}</span>
          </p>
        )}
        {draft && t.referenceNote && <p className="note info" style={{ marginBottom: 24 }}><Info aria-hidden size={20} />{t.referenceNote}</p>}
        {legal === null && <p className="note warning" role="status"><Warning aria-hidden size={20} />{t.configUnavailable}</p>}
        {children(legal)}
      </article>
    </main>
  );
}
