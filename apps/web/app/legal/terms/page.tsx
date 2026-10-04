import type { LegalConfig } from "@devcontext/contracts";
import { productName } from "@devcontext/contracts/brand";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { defineCopy } from "../../../lib/i18n";
import { getLocale } from "../../../lib/locale-server";
import { LegalPage, Value } from "../legal-page";

/**
 * Terms draft. Every statement describes what the product actually does in
 * this build; identity, jurisdiction and money-related terms come from
 * configuration and stay placeholders until the owner supplies them.
 * Turkish is the reference text; English translates it statement by statement.
 */
const copy = defineCopy({
  tr: {
    title: "Kullanım Şartları",
    body: (legal: LegalConfig | null): ReactNode => {
      const provider = legal?.processing.billingProvider ?? null;
      const billingText = provider === null
        ? "Bu kurulumda ödeme sağlayıcısı yapılandırılmamıştır; her hesap ücretsiz plandadır ve ücretli plana geçiş sunulmaz."
        : legal?.processing.billingTestMode
          ? "Bu kurulumda ödeme sağlayıcısı test modundadır; hiçbir gerçek ödeme alınmaz."
          : `Ücretli plan ödemeleri “${provider}” sağlayıcısı üzerinden alınır; kart bilgileri ${productName} sunucularında saklanmaz.`;
      return (
        <>
          <h2>1. Taraflar ve kapsam</h2>
          <p>Bu şartlar, <Value name="LEGAL_ENTITY_NAME" value={legal?.entity.name ?? null} /> (“hizmet sağlayıcı”) tarafından sunulan {productName} hizmetinin (“Hizmet”) kullanımını düzenler. Hizmeti kullanarak bu şartları kabul etmiş olursun. İletişim: <Value name="LEGAL_CONTACT_EMAIL" value={legal?.entity.contactEmail ?? null} />.</p>

          <h2>2. Hizmetin tanımı</h2>
          <p>{productName}, geliştiricilerin araç ve teknoloji tercihlerini (kaynaklar, kararlar, profiller, tarifler, projeler) kaydettiği ve bunlardan kodlama ajanları için deterministik talimat dosyaları ürettiği kişisel bir çalışma alanıdır. Talimatlar yalnızca hizmet sağlayıcının sunucusunda, kural tabanlı ve tekrarlanabilir biçimde derlenir. {legal?.processing.externalAi ? "İsteğe bağlı AI önerileri yalnızca açıkça izin verdiğinde ve bir öneri istediğinde kullanılır; öneriler sen kabul etmeden hiçbir kararı değiştirmez." : "Hiçbir veri bir yapay zekâ sağlayıcısına gönderilmez."}</p>

          <h2>3. Hesap</h2>
          <ul>
            <li>Hesap açmak için geçerli bir e-posta adresi ve en az 8 karakterlik bir şifre gerekir. Şifreler yalnızca özet (hash) olarak saklanır.</li>
            <li>Hesabındaki etkinliklerden ve şifrenin gizliliğinden sen sorumlusun. Yetkisiz kullanım fark edersen şifreni değiştir ve bize haber ver.</li>
            <li>Hesabını istediğin zaman Ayarlar › Gizlilik ve veriler bölümünden dışa aktarabilir ve kalıcı olarak silebilirsin.</li>
          </ul>

          <h2>4. İçerik ve fikri mülkiyet</h2>
          <ul>
            <li>Çalışma alanına girdiğin tüm içerik (kaynak adları, bağlantılar, notlar, kurallar, kararlar, derlenen talimatlar) sana aittir. Hizmet sağlayıcı bu içerik üzerinde yalnızca Hizmeti sana sunmak için gereken sınırlı kullanım hakkına sahiptir.</li>
            <li>İçe aktardığın URL’ler, promptlar, kurallar ve kurulum komutları yalnızca metin olarak saklanır; Hizmet bunları açmaz, indirmez ve çalıştırmaz.</li>
            <li>Teknoloji kataloğu editör değerlendirmelerinden oluşan referans içeriktir; ölçülmüş performans iddiası değildir ve teknoloji sahiplerinin markalarını temsil etmez.</li>
          </ul>

          <h2>5. Kabul edilebilir kullanım</h2>
          <ul>
            <li>Hizmeti yürürlükteki hukuka aykırı biçimde, başkalarının hesaplarına erişmek için veya altyapıya zarar verecek şekilde (otomatik yoğun istekler, güvenlik açığı arama) kullanamazsın.</li>
            <li>Hesap başına istek sınırları uygulanır; sınırı aşan istekler geçici olarak reddedilir.</li>
          </ul>

          <h2>6. Planlar ve ödeme</h2>
          <p>Hizmet geliştirme aşamasındadır ve şu anda ücretsiz sunulur; ücretsiz (Free) plan kalıcıdır. İleride ücretli bir “Pro” plan sunulabilir; plan sınırları, fiyat ve Pro’nun ne zaman sunulacağı uygulamadaki Plan sayfasında gösterilir. {billingText} İptal, ödenmiş dönemin sonunda geçerli olur; iptalde hiçbir veri silinmez, hesap ücretsiz plana döner. İade koşulları hukuki onayla birlikte belirlenecektir; bu metinde iade vaadi yer almaz.</p>

          <h2>7. Verilerin, dışa aktarma ve silme</h2>
          <p>Verilerini her zaman taşınabilir JSON biçiminde indirebilirsin. Hesap silme talebi, şifre doğrulamasının ardından tüm kaynaklarını, kararlarını, profillerini, tariflerini, projelerini, derlenmiş talimat sürümlerini, dışa/içe aktarma kayıtlarını, oturumlarını ve etkinlik kayıtlarını kalıcı olarak siler. Yalnızca hukuken gerekli asgari fatura kayıtları (sağlayıcı kimlikleri, tarih, plan) saklanır; ayrıntılar <Link href="/legal/privacy">Gizlilik Politikası</Link>’ndadır.</p>

          <h2>8. Hizmetin sürekliliği ve sorumluluk</h2>
          <ul>
            <li>Hizmet “olduğu gibi” sunulur; kesintisiz veya hatasız çalışacağı garanti edilmez. Planlı bakım ve arızalar için uygulama içinde durum bilgisi gösterilir.</li>
            <li>Hizmet sağlayıcının sorumluluğu, uygulanacak hukukun izin verdiği ölçüde, son 12 ayda ödediğin ücretle sınırlıdır. Bu sınırın kesin metni hukuki onayı bekler.</li>
          </ul>

          <h2>9. Değişiklikler ve fesih</h2>
          <p>Şartlar değiştiğinde yürürlük tarihi güncellenir ve önemli değişiklikler uygulama içinde duyurulur. Şartları ihlal eden hesaplar askıya alınabilir; bu durumda verilerini dışa aktarma hakkın korunur.</p>

          <h2>10. Uygulanacak hukuk</h2>
          <p>Bu şartlara <Value name="LEGAL_JURISDICTION" value={legal?.entity.jurisdiction ?? null} /> hukuku uygulanır ve uyuşmazlıklarda bu yerin mahkemeleri yetkilidir.</p>
        </>
      );
    },
  },
  en: {
    title: "Terms of Use",
    body: (legal: LegalConfig | null): ReactNode => {
      const provider = legal?.processing.billingProvider ?? null;
      const billingText = provider === null
        ? "No payment provider is configured in this installation; every account is on the free plan and no upgrade to a paid plan is offered."
        : legal?.processing.billingTestMode
          ? "The payment provider in this installation is in test mode; no real payments are taken."
          : `Paid plan payments are taken through the “${provider}” provider; card details are not stored on ${productName} servers.`;
      return (
        <>
          <h2>1. Parties and scope</h2>
          <p>These terms govern the use of the {productName} service (the “Service”) provided by <Value name="LEGAL_ENTITY_NAME" value={legal?.entity.name ?? null} /> (the “service provider”). By using the Service you accept these terms. Contact: <Value name="LEGAL_CONTACT_EMAIL" value={legal?.entity.contactEmail ?? null} />.</p>

          <h2>2. Description of the Service</h2>
          <p>{productName} is a personal workspace where developers record their tool and technology preferences (resources, decisions, profiles, recipes, projects) and generate deterministic instruction files for coding agents from them. Instructions are compiled only on the service provider’s server, in a rule-based and reproducible way. {legal?.processing.externalAi ? "Optional AI suggestions are used only when you explicitly allow them and ask for a suggestion; suggestions never change a decision until you accept them." : "No data is sent to an AI provider."}</p>

          <h2>3. Account</h2>
          <ul>
            <li>Creating an account requires a valid email address and a password of at least 8 characters. Passwords are stored only as hashes.</li>
            <li>You are responsible for the activity in your account and for keeping your password confidential. If you notice unauthorized use, change your password and let us know.</li>
            <li>You can export your account and delete it permanently at any time from Settings › Privacy and data.</li>
          </ul>

          <h2>4. Content and intellectual property</h2>
          <ul>
            <li>All content you enter in the workspace (resource names, links, notes, rules, decisions, compiled instructions) belongs to you. The service provider has only the limited right to use this content that is needed to provide the Service to you.</li>
            <li>The URLs, prompts, rules and install commands you import are stored as text only; the Service does not open, download or run them.</li>
            <li>The technology catalog is reference content made of editorial assessments; it is not a claim of measured performance and does not represent the trademarks of the technology owners.</li>
          </ul>

          <h2>5. Acceptable use</h2>
          <ul>
            <li>You may not use the Service in breach of applicable law, to access other people’s accounts, or in ways that harm the infrastructure (automated heavy traffic, vulnerability scanning).</li>
            <li>Per-account request limits apply; requests over the limit are temporarily rejected.</li>
          </ul>

          <h2>6. Plans and payment</h2>
          <p>The Service is in development and currently offered free of charge; the free (Free) plan is permanent. A paid “Pro” plan may be offered in the future; plan limits, the price and when Pro will be offered are shown on the Plan page in the app. {billingText} Cancellation takes effect at the end of the paid period; no data is deleted on cancellation and the account returns to the free plan. Refund terms will be set together with the legal approval; this text makes no promise of refunds.</p>

          <h2>7. Your data, export and deletion</h2>
          <p>You can always download your data in a portable JSON format. After your password is verified, an account deletion request permanently deletes all your resources, decisions, profiles, recipes, projects, compiled instruction versions, export/import records, sessions and activity records. Only the legally required minimal billing records (provider IDs, date, plan) are kept; details are in the <Link href="/legal/privacy">Privacy Policy</Link>.</p>

          <h2>8. Continuity of the Service and liability</h2>
          <ul>
            <li>The Service is provided “as is”; it is not guaranteed to run without interruption or errors. Status information is shown in the app for planned maintenance and outages.</li>
            <li>To the extent permitted by the governing law, the service provider’s liability is limited to the fees you paid in the last 12 months. The exact wording of this limit awaits legal approval.</li>
          </ul>

          <h2>9. Changes and termination</h2>
          <p>When the terms change, the effective date is updated and significant changes are announced in the app. Accounts that breach the terms may be suspended; in that case you keep the right to export your data.</p>

          <h2>10. Governing law</h2>
          <p>These terms are governed by the law of <Value name="LEGAL_JURISDICTION" value={legal?.entity.jurisdiction ?? null} />, and the courts of that place have jurisdiction over disputes.</p>
        </>
      );
    },
  },
});

export async function generateMetadata(): Promise<Metadata> {
  return { title: copy[await getLocale()].title };
}

export default async function TermsPage() {
  const t = copy[await getLocale()];
  return (
    <LegalPage current="terms" title={t.title}>
      {(legal) => t.body(legal)}
    </LegalPage>
  );
}
