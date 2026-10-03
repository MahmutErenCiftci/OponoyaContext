/**
 * Public development plan shown on the Plan page (owner decisions of
 * 2026-09-30). V1 lists what ships today; later stages are intentions, not
 * commitments, and the page says so. Grounded in docs/05_ROADMAP_VERSIONS.md.
 */
export const proPricing = {
  /** Development discount while the product is still being built. */
  launch: "4,99 $",
  /** Price once the product is complete and has a real user base. */
  regular: "14,99 $",
  period: "ay",
};

export type RoadmapStageId = "v1" | "v2" | "v3" | "v3plus";
export type RoadmapStatus = "now" | "next" | "planned" | "later";

export type RoadmapStage = {
  id: RoadmapStageId;
  tag: string;
  name: string;
  status: RoadmapStatus;
  statusLabel: string;
  summary: string;
  groups: Array<{ title: string; items: string[] }>;
  note: string | null;
};

export const roadmap: RoadmapStage[] = [
  {
    id: "v1",
    tag: "V1",
    name: "Temel",
    status: "now",
    statusLabel: "Şu an · Ücretsiz",
    summary: "Bugün kullandığın sürüm. Oponoya geliştirme aşamasında olduğu için tamamen ücretsiz.",
    groups: [
      { title: "Çalışma alanı", items: [
        "Kütüphane: araçlarını, kurallarını ve tercihlerini kaydet",
        "Dört karar biçimi: Kilitli, Tercih edilen, AI karar versin, Devre dışı",
        "Projeler: dört adımlı sihirbazla proje oluştur",
        "Profiller ve tarifler: tercihlerini her projede tekrar kullan",
      ] },
      { title: "AI talimatları", items: [
        "Genel talimat, AGENTS.md, CLAUDE.md, Cursor ve Copilot çıktıları",
        "Sürüm geçmişi ve iki sürüm arasında karşılaştırma",
        "Kütüphanene göre teknoloji ve stack önerileri",
      ] },
      { title: "Keşif ve güven", items: [
        "Teknoloji kataloğu ve hazır stack’ler",
        "Verilerini içe ve dışa aktarma",
        "Gizlilik kontrolleri ve hesap silme",
      ] },
    ],
    note: null,
  },
  {
    id: "v2",
    tag: "V2",
    name: "Pro",
    status: "next",
    statusLabel: "Sıradaki",
    summary: "Pro sürüm V2 ile geliyor: ilk AI özellikleri, entegrasyonlar ve geliştirici araçları. Free hesap kalıcıdır; Pro ek özellikler ve daha yüksek limitler getirir.",
    groups: [
      { title: "AI (ilk sürüm)", items: [
        "“AI karar versin” dediğin kararlar için gerekçeli AI önerisi",
        "Bağlantıdan kaynak bilgilerini otomatik doldurma",
        "Kaynak sınıflandırma ve uyumluluk önerileri",
        "AI yalnızca önerir; sen onaylamadan hiçbir şey değişmez",
      ] },
      { title: "Entegrasyonlar ve araçlar", items: [
        "GitHub bağlantısı ve depo bilgisi içe aktarma",
        "Mevcut AGENTS.md, CLAUDE.md, Cursor ve Copilot dosyalarını içe aktarma",
        "Tarayıcı eklentisi ve komut satırı aracı (CLI)",
      ] },
      { title: "Topluluk (başlangıç)", items: [
        "Tarif ve stack’lerini bir bağlantıyla paylaşma",
        "Kataloğa yeni teknoloji önerme (editör onaylı)",
        "Trend ve yeni teknolojiler",
      ] },
    ],
    note: null,
  },
  {
    id: "v3",
    tag: "V3",
    name: "Takımlar ve topluluk",
    status: "planned",
    statusLabel: "Planlanıyor",
    summary: "Ekiplerin ortak bağlamı ve herkese açık bir topluluk alanı.",
    groups: [
      { title: "Takımlar", items: [
        "Organizasyonlar, üyeler ve roller",
        "Ortak kütüphane ve onaylı kaynaklar",
        "Zorunlu veya isteğe bağlı takım kuralları, şirket stack profilleri",
        "Takım bağlamını dışa aktarma ve denetim geçmişi",
      ] },
      { title: "Topluluk", items: [
        "Herkese açık topluluk stack’leri ve tarifleri",
        "Beğeni, yorum ve koleksiyonlar",
        "Rehberler ve örnek projeler",
        "Katkıda bulunanlar için profil ve rozetler",
      ] },
      { title: "Platform", items: [
        "MCP sunucusu: proje bağlamını coding agent’lara doğrudan sun",
        "API ve SDK",
      ] },
    ],
    note: null,
  },
  {
    id: "v3plus",
    tag: "V3+",
    name: "Gelişmiş AI ve kurumsal",
    status: "later",
    statusLabel: "V3 sonrası",
    summary: "En yeni AI özellikleri ve kurumsal kullanım V3’ten sonra gelecek.",
    groups: [
      { title: "En yeni AI özellikleri", items: [
        "Mevcut kod tabanından otomatik stack tespiti",
        "Geçiş (migration) asistanı ve bağımlılık yükseltme önerileri",
        "Eskiyen kaynak uyarıları",
        "Ajanlar arası bağlam paylaşımı",
      ] },
      { title: "Kurumsal", items: [
        "Kurumsal kullanım ve fiyatlandırma V3’ten sonra netleşecek",
        "Tek oturum açma (SSO) ve kullanıcı eşitleme (SCIM)",
        "Şirkete özel kaynak kataloğu ve politika denetimleri",
      ] },
    ],
    note: "Bu aşamanın kapsamı V3’ten sonra kullanıcı geri bildirimleriyle netleşecek.",
  },
];
