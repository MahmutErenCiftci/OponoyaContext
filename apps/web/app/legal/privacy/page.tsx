import type { LegalConfig } from "@devcontext/contracts";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { defineCopy } from "../../../lib/i18n";
import { getLocale } from "../../../lib/locale-server";
import { LegalPage, Value } from "../legal-page";

/**
 * Privacy draft. The data inventory below mirrors the database schema and the
 * logging rules of this build; controller identity, region, subprocessors and
 * retention periods are configuration and remain placeholders until supplied.
 * Turkish is the reference text; English translates it statement by statement.
 */
const copy = defineCopy({
  tr: {
    title: "Gizlilik Politikası",
    body: (legal: LegalConfig | null): ReactNode => {
      const provider = legal?.processing.billingProvider ?? null;
      const aiProvider = legal?.processing.aiProvider ?? null;
      const aiProviderName = aiProvider === "anthropic" ? "Anthropic (Claude API)" : aiProvider === "fake" ? "test sağlayıcısı (ağ çağrısı yok)" : null;
      const subprocessors = legal?.processing.subprocessors ?? [];
      return (
        <>
          <h2>1. Veri sorumlusu</h2>
          <p>Kişisel verilerinin sorumlusu <Value name="LEGAL_ENTITY_NAME" value={legal?.entity.name ?? null} />, <Value name="LEGAL_ENTITY_ADDRESS" value={legal?.entity.address ?? null} /> adresindedir. Gizlilikle ilgili talepler için: <Value name="LEGAL_CONTACT_EMAIL" value={legal?.entity.contactEmail ?? null} />.</p>

          <h2>2. Hangi verileri saklıyoruz</h2>
          <table>
            <thead><tr><th scope="col">Veri</th><th scope="col">İçerik</th><th scope="col">Neden</th></tr></thead>
            <tbody>
              <tr><td>Hesap</td><td>E-posta, ad, şifre özeti (hash), hesap tarihi</td><td>Giriş ve hesabın sana ait olduğunu doğrulama</td></tr>
              <tr><td>Oturum</td><td>Oturum belirteci, oluşturulma/son kullanma zamanı, IP adresi ve tarayıcı bilgisi</td><td>Oturumu sürdürmek ve kötüye kullanımı sınırlamak</td></tr>
              <tr><td>Çalışma alanı içeriği</td><td>Kaynaklar, etiketler, kararlar, profiller, tarifler, projeler, uyumluluk kuralları, derlenmiş talimat sürümleri, dışa/içe aktarma kayıtları</td><td>Hizmetin kendisi; yalnızca sana gösterilir</td></tr>
              <tr><td>Etkinlik kaydı</td><td>Yapılan işlemin türü, ilgili kaydın kimliği, sayılar ve istek kimliği; her oturum açmanın zamanı. İçerik metni, IP adresi veya tarayıcı bilgisi yok</td><td>Hesabındaki değişiklikleri sana açıklamak ve genel bakışta son girişini göstermek</td></tr>
              <tr><td>Abonelik</td><td>Plan, durum, dönem tarihleri ve ödeme sağlayıcısının müşteri/abonelik kimlikleri. Kart, fatura adresi veya ödeme bilgisi saklanmaz.</td><td>Plan sınırlarını uygulamak ve faturalama olaylarını eşleştirmek</td></tr>
              <tr><td>Sunucu günlükleri</td><td>İstek kimliği, yol, durum kodu, süre, hata sınıfı. Çerezler, istek gövdeleri, e-posta adresleri ve içerik günlüklere yazılmaz.</td><td>Arıza ve güvenlik analizi</td></tr>
            </tbody>
          </table>

          <h2>3. Yapay zekâ ve dış işleme</h2>
          <ul>
            {aiProviderName ? (
              <>
                <li>Talimatlar her zaman bu sunucuda deterministik olarak derlenir.</li>
                <li>İsteğe bağlı AI önerileri: <strong>{aiProviderName}</strong>. Varsayılan olarak kapalıdır; yalnızca Ayarlar’dan açıkça izin verdiğinde ve bir karar için öneri istediğinde, o kararın kısıtları, proje özeti, etkin teknoloji yığını ve Kütüphanendeki kaynakların adı, türü ve kısa açıklaması bu sağlayıcıya gönderilir. Bağlantılar, notlar, kurulum komutları, e-posta adresin ve şifren gönderilmez. İzni istediğin an geri alabilirsin; öneriler sen kabul etmeden hiçbir kararı değiştirmez ve hesabınla birlikte silinir.</li>
              </>
            ) : (
              <li>Dış yapay zekâ işleme: <strong>kapalı</strong>. Talimatlar bu sunucuda deterministik olarak derlenir; hiçbir içerik bir AI sağlayıcısına veya üçüncü tarafa gönderilmez.</li>
            )}
            <li>İçe aktardığın URL’ler, promptlar, kurallar ve kurulum komutları yalnızca metin olarak saklanır; Hizmet bunları ziyaret etmez, indirmez ve çalıştırmaz.</li>
            <li>Ürün analitiği yalnızca yapısal olay kayıtlarıdır (ör. “proje oluşturuldu”) ve üçüncü taraf bir analitik hizmetine gönderilmez.</li>
          </ul>

          <h2>4. Alt işlemciler ve barındırma</h2>
          <p>Barındırma bölgesi: <Value name="HOSTING_REGION" value={legal?.processing.hostingRegion ?? null} />.{aiProviderName ? ` AI önerileri sağlayıcısı: ${aiProviderName} (yalnızca izin veren kullanıcılar için).` : ""} Ödeme sağlayıcısı: {provider === null ? "yapılandırılmadı (ücretli plan sunulmuyor)" : legal?.processing.billingTestMode ? `${provider} (test modu, gerçek ödeme yok)` : provider}.</p>
          {subprocessors.length > 0
            ? <ul>{subprocessors.map((item) => <li key={item}>{item}</li>)}</ul>
            : <p>Alt işlemci listesi: <Value name="LEGAL_SUBPROCESSORS" value={null} />.</p>}

          <h2>5. Çerezler</h2>
          <p>Oturum çerezi (HttpOnly, SameSite, HTTPS’te Secure) ve yalnızca bu tarayıcıda görünümü hatırlayan dört tercih çerezi kullanılır: arayüz dili, tema, kenar çubuğunun daraltılmış olup olmadığı ve kapatılan son duyuru. Tercih çerezleri kimliğini içermez ve sunucuda saklanmaz. Reklam, izleme veya üçüncü taraf çerezi yoktur.</p>

          <h2>6. Saklama ve silme</h2>
          <ul>
            <li><strong>Hesap silme:</strong> Ayarlar › Gizlilik ve veriler’den, şifreni yeniden girerek. Silme anında uygulanır: hesap satırı, oturumlar, çalışma alanı içeriği, derlenmiş sürümler, dışa/içe aktarma kayıtları ve etkinlik kaydı tek işlemde kaldırılır; oturumların geçersiz olur.</li>
            <li><strong>Asgari fatura kaydı:</strong> Silinen hesap için yalnızca ödeme sağlayıcısının müşteri/abonelik kimlikleri, plan, durum ve tarihler saklanır (ad, e-posta veya içerik değil). Saklama süresi: <Value name="BILLING_RECORDS_RETENTION_YEARS" value={legal?.retention.billingRecordsYears ?? null} /> yıl.</li>
            <li><strong>Abonelik iptali:</strong> Silme, bağlı aboneliği sağlayıcıda iptal eder. Sağlayıcıya ulaşılamazsa hiçbir şey silinmez; durum sana gösterilir ve aynı isteği yeniden gönderebilirsin.</li>
            <li><strong>Yedekler:</strong> Şifreli veritabanı yedekleri <Value name="BACKUP_RETENTION_DAYS" value={legal?.retention.backupDays ?? null} /> gün sonra silinir; silinen bir hesap yedeklerden geri yüklenmez.</li>
          </ul>

          <h2>7. Hakların</h2>
          <ul>
            <li><strong>Erişim ve taşınabilirlik:</strong> Tüm verini Ayarlar’dan JSON olarak indirebilirsin (hesap, ayarlar, çalışma alanı, derlenmiş sürümler, dışa aktarma ve etkinlik kayıtları).</li>
            <li><strong>Silme:</strong> Yukarıdaki hesap silme akışı.</li>
            <li><strong>Düzeltme ve itiraz:</strong> <Value name="LEGAL_CONTACT_EMAIL" value={legal?.entity.contactEmail ?? null} /> adresine yaz.</li>
          </ul>

          <h2>8. Güvenlik</h2>
          <p>Bağlantılar HTTPS ile şifrelenir, şifreler yalnızca özet olarak tutulur, her sorgu hesabına göre ayrılır ve istek sınırları uygulanır. Ayrıntılı güvenlik uygulamaları <Link href="/legal/terms">Kullanım Şartları</Link> ile birlikte hukuki onayı bekleyen taslak kapsamındadır.</p>

          <h2>9. Değişiklikler</h2>
          <p>Bu politika değiştiğinde yürürlük tarihi güncellenir ve önemli değişiklikler uygulama içinde duyurulur. Uygulanacak hukuk: <Value name="LEGAL_JURISDICTION" value={legal?.entity.jurisdiction ?? null} />.</p>
        </>
      );
    },
  },
  en: {
    title: "Privacy Policy",
    body: (legal: LegalConfig | null): ReactNode => {
      const provider = legal?.processing.billingProvider ?? null;
      const aiProvider = legal?.processing.aiProvider ?? null;
      const aiProviderName = aiProvider === "anthropic" ? "Anthropic (Claude API)" : aiProvider === "fake" ? "test provider (no network calls)" : null;
      const subprocessors = legal?.processing.subprocessors ?? [];
      return (
        <>
          <h2>1. Data controller</h2>
          <p>The controller of your personal data is <Value name="LEGAL_ENTITY_NAME" value={legal?.entity.name ?? null} />, located at <Value name="LEGAL_ENTITY_ADDRESS" value={legal?.entity.address ?? null} />. For privacy requests: <Value name="LEGAL_CONTACT_EMAIL" value={legal?.entity.contactEmail ?? null} />.</p>

          <h2>2. What data we store</h2>
          <table>
            <thead><tr><th scope="col">Data</th><th scope="col">Contents</th><th scope="col">Why</th></tr></thead>
            <tbody>
              <tr><td>Account</td><td>Email, name, password hash, account creation date</td><td>Signing in and verifying that the account is yours</td></tr>
              <tr><td>Session</td><td>Session token, creation/expiry time, IP address and browser information</td><td>Keeping you signed in and limiting abuse</td></tr>
              <tr><td>Workspace content</td><td>Resources, tags, decisions, profiles, recipes, projects, compatibility rules, compiled instruction versions, export/import records</td><td>The service itself; shown only to you</td></tr>
              <tr><td>Activity log</td><td>The type of action, the ID of the related record, counts and the request ID; the time of each sign-in. No content text, IP address or browser information</td><td>Explaining the changes in your account to you and showing your last sign-in on the overview</td></tr>
              <tr><td>Subscription</td><td>Plan, status, period dates and the payment provider’s customer/subscription IDs. No card, billing address or payment details are stored.</td><td>Enforcing plan limits and matching billing events</td></tr>
              <tr><td>Server logs</td><td>Request ID, path, status code, duration, error class. Cookies, request bodies, email addresses and content are not written to the logs.</td><td>Failure and security analysis</td></tr>
            </tbody>
          </table>

          <h2>3. AI and external processing</h2>
          <ul>
            {aiProviderName ? (
              <>
                <li>Instructions are always compiled deterministically on this server.</li>
                <li>Optional AI suggestions: <strong>{aiProviderName}</strong>. Off by default; only when you explicitly allow it in Settings and ask for a suggestion for a decision are that decision’s constraints, the project summary, the active tech stack and the name, type and short description of the resources in your Library sent to this provider. Links, notes, install commands, your email address and your password are not sent. You can withdraw your consent at any time; suggestions never change a decision until you accept them, and they are deleted with your account.</li>
              </>
            ) : (
              <li>External AI processing: <strong>off</strong>. Instructions are compiled deterministically on this server; no content is sent to an AI provider or any third party.</li>
            )}
            <li>The URLs, prompts, rules and install commands you import are stored as text only; the Service does not visit, download or run them.</li>
            <li>Product analytics are structural event records only (e.g. “project created”) and are not sent to a third-party analytics service.</li>
          </ul>

          <h2>4. Subprocessors and hosting</h2>
          <p>Hosting region: <Value name="HOSTING_REGION" value={legal?.processing.hostingRegion ?? null} />.{aiProviderName ? ` AI suggestions provider: ${aiProviderName} (only for users who allow it).` : ""} Payment provider: {provider === null ? "not configured (no paid plan is offered)" : legal?.processing.billingTestMode ? `${provider} (test mode, no real payments)` : provider}.</p>
          {subprocessors.length > 0
            ? <ul>{subprocessors.map((item) => <li key={item}>{item}</li>)}</ul>
            : <p>List of subprocessors: <Value name="LEGAL_SUBPROCESSORS" value={null} />.</p>}

          <h2>5. Cookies</h2>
          <p>A session cookie (HttpOnly, SameSite, Secure over HTTPS) is used, plus four preference cookies that only remember the view in this browser: the interface language, the theme, whether the sidebar is collapsed, and the last announcement you dismissed. Preference cookies do not contain your identity and are not stored on the server. There are no advertising, tracking or third-party cookies.</p>

          <h2>6. Retention and deletion</h2>
          <ul>
            <li><strong>Account deletion:</strong> from Settings › Privacy and data, by re-entering your password. Deletion takes effect immediately: the account row, sessions, workspace content, compiled versions, export/import records and the activity log are removed in a single operation; your sessions become invalid.</li>
            <li><strong>Minimal billing record:</strong> for a deleted account, only the payment provider’s customer/subscription IDs, the plan, status and dates are kept (no name, email or content). Retention period: <Value name="BILLING_RECORDS_RETENTION_YEARS" value={legal?.retention.billingRecordsYears ?? null} /> years.</li>
            <li><strong>Subscription cancellation:</strong> deletion cancels the linked subscription with the provider. If the provider can’t be reached, nothing is deleted; you are shown the status and can send the same request again.</li>
            <li><strong>Backups:</strong> encrypted database backups are deleted after <Value name="BACKUP_RETENTION_DAYS" value={legal?.retention.backupDays ?? null} /> days; a deleted account is not restored from backups.</li>
          </ul>

          <h2>7. Your rights</h2>
          <ul>
            <li><strong>Access and portability:</strong> you can download all your data as JSON from Settings (account, settings, workspace, compiled versions, export and activity records).</li>
            <li><strong>Erasure:</strong> the account deletion flow above.</li>
            <li><strong>Rectification and objection:</strong> write to <Value name="LEGAL_CONTACT_EMAIL" value={legal?.entity.contactEmail ?? null} />.</li>
          </ul>

          <h2>8. Security</h2>
          <p>Connections are encrypted with HTTPS, passwords are stored only as hashes, every query is scoped to your account and request limits apply. Detailed security practices are covered by the draft awaiting legal approval, together with the <Link href="/legal/terms">Terms of Use</Link>.</p>

          <h2>9. Changes</h2>
          <p>When this policy changes, the effective date is updated and significant changes are announced in the app. Governing law: <Value name="LEGAL_JURISDICTION" value={legal?.entity.jurisdiction ?? null} />.</p>
        </>
      );
    },
  },
});

export async function generateMetadata(): Promise<Metadata> {
  return { title: copy[await getLocale()].title };
}

export default async function PrivacyPage() {
  const t = copy[await getLocale()];
  return (
    <LegalPage current="privacy" title={t.title}>
      {(legal) => t.body(legal)}
    </LegalPage>
  );
}
