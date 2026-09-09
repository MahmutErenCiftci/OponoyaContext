import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Value } from "../legal-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gizlilik Politikası · DevContext" };

/**
 * Privacy draft. The data inventory below mirrors the database schema and the
 * logging rules of this build; controller identity, region, subprocessors and
 * retention periods are configuration and remain placeholders until supplied.
 */
export default function PrivacyPage() {
  return (
    <LegalPage current="privacy" title="Gizlilik Politikası">
      {(legal) => {
        const provider = legal?.processing.billingProvider ?? null;
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
                <tr><td>Etkinlik kaydı</td><td>Yapılan işlemin türü, ilgili kaydın kimliği, sayılar ve istek kimliği; içerik metni yok</td><td>Hesabındaki değişiklikleri sana açıklamak</td></tr>
                <tr><td>Abonelik</td><td>Plan, durum, dönem tarihleri ve ödeme sağlayıcısının müşteri/abonelik kimlikleri. Kart, fatura adresi veya ödeme bilgisi saklanmaz.</td><td>Plan sınırlarını uygulamak ve faturalama olaylarını eşleştirmek</td></tr>
                <tr><td>Sunucu günlükleri</td><td>İstek kimliği, yol, durum kodu, süre, hata sınıfı. Çerezler, istek gövdeleri, e-posta adresleri ve içerik günlüklere yazılmaz.</td><td>Arıza ve güvenlik analizi</td></tr>
              </tbody>
            </table>

            <h2>3. Yapay zekâ ve dış işleme</h2>
            <ul>
              <li>Dış yapay zekâ işleme: <strong>kapalı</strong>. Talimatlar bu sunucuda deterministik olarak derlenir; hiçbir içerik bir AI sağlayıcısına veya üçüncü tarafa gönderilmez.</li>
              <li>İçe aktardığın URL’ler, promptlar, kurallar ve kurulum komutları yalnızca metin olarak saklanır; Hizmet bunları ziyaret etmez, indirmez ve çalıştırmaz.</li>
              <li>Ürün analitiği yalnızca yapısal olay kayıtlarıdır (ör. “proje oluşturuldu”) ve üçüncü taraf bir analitik hizmetine gönderilmez.</li>
            </ul>

            <h2>4. Alt işlemciler ve barındırma</h2>
            <p>Barındırma bölgesi: <Value name="HOSTING_REGION" value={legal?.processing.hostingRegion ?? null} />. Ödeme sağlayıcısı: {provider === null ? "yapılandırılmadı (ücretli plan sunulmuyor)" : legal?.processing.billingTestMode ? `${provider} (test modu, gerçek ödeme yok)` : provider}.</p>
            {subprocessors.length > 0
              ? <ul>{subprocessors.map((item) => <li key={item}>{item}</li>)}</ul>
              : <p>Alt işlemci listesi: <Value name="LEGAL_SUBPROCESSORS" value={null} />.</p>}

            <h2>5. Çerezler</h2>
            <p>Yalnızca iki çerez kullanılır: oturum çerezi (HttpOnly, SameSite, HTTPS’te Secure) ve tema tercihi. Reklam, izleme veya üçüncü taraf çerezi yoktur.</p>

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
      }}
    </LegalPage>
  );
}
