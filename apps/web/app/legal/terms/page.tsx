import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Value } from "../legal-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kullanım Şartları · DevContext" };

/**
 * Terms draft. Every statement describes what the product actually does in
 * this build; identity, jurisdiction and money-related terms come from
 * configuration and stay placeholders until the owner supplies them.
 */
export default function TermsPage() {
  return (
    <LegalPage current="terms" title="Kullanım Şartları">
      {(legal) => {
        const provider = legal?.processing.billingProvider ?? null;
        const billingText = provider === null
          ? "Bu kurulumda ödeme sağlayıcısı yapılandırılmamıştır; her hesap ücretsiz plandadır ve ücretli plana geçiş sunulmaz."
          : legal?.processing.billingTestMode
            ? "Bu kurulumda ödeme sağlayıcısı test modundadır; hiçbir gerçek ödeme alınmaz."
            : `Ücretli plan ödemeleri “${provider}” sağlayıcısı üzerinden alınır; kart bilgileri DevContext sunucularında saklanmaz.`;
        return (
          <>
            <h2>1. Taraflar ve kapsam</h2>
            <p>Bu şartlar, <Value name="LEGAL_ENTITY_NAME" value={legal?.entity.name ?? null} /> (“hizmet sağlayıcı”) tarafından sunulan DevContext hizmetinin (“Hizmet”) kullanımını düzenler. Hizmeti kullanarak bu şartları kabul etmiş olursun. İletişim: <Value name="LEGAL_CONTACT_EMAIL" value={legal?.entity.contactEmail ?? null} />.</p>

            <h2>2. Hizmetin tanımı</h2>
            <p>DevContext, geliştiricilerin araç ve teknoloji tercihlerini (kaynaklar, kararlar, profiller, tarifler, projeler) kaydettiği ve bunlardan kodlama ajanları için deterministik talimat dosyaları ürettiği kişisel bir çalışma alanıdır. Talimatlar yalnızca hizmet sağlayıcının sunucusunda, kural tabanlı ve tekrarlanabilir biçimde derlenir; hiçbir veri bir yapay zekâ sağlayıcısına gönderilmez.</p>

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
            <p>Hizmet ücretsiz bir plan ve ücretli bir “Pro” plan sunar. Plan sınırları ve güncel fiyat, uygulamadaki Plan sayfasında gösterilir. {billingText} İptal, ödenmiş dönemin sonunda geçerli olur; iptalde hiçbir veri silinmez, hesap ücretsiz plana döner. İade koşulları hukuki onayla birlikte belirlenecektir; bu metinde iade vaadi yer almaz.</p>

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
      }}
    </LegalPage>
  );
}
