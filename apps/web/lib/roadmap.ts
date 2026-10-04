import { defineCopy } from "./i18n";

/**
 * Public development plan shown on the Plan page (owner decisions of
 * 2026-09-30). V1 lists what ships today; later stages are intentions, not
 * commitments, and the page says so. Grounded in docs/05_ROADMAP_VERSIONS.md.
 */
export const proPricing = defineCopy({
  /** `launch`: development discount while the product is still being built; `regular`: once it is complete and has real users. */
  tr: { launch: "4,99 $", regular: "14,99 $", period: "ay" },
  en: { launch: "$4.99", regular: "$14.99", period: "month" },
});

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

export const roadmap = defineCopy<RoadmapStage[]>({
  tr: [
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
        { title: "Ölçülmüş teknik analizler", items: [
          "Teknoloji ve stack’ler için k6 ile kendi sunucumuzda yapılmış yük testleri",
          "Eşzamanlı kullanıcı sayısı, gecikme ve verim gibi ölçümler, test kurulumuyla birlikte",
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
  ],
  en: [
    {
      id: "v1",
      tag: "V1",
      name: "Foundation",
      status: "now",
      statusLabel: "Now · Free",
      summary: "The version you use today. Oponoya is still in development, so it is completely free.",
      groups: [
        { title: "Workspace", items: [
          "Library: save your tools, rules and preferences",
          "Four decision modes: Locked, Preferred, Let AI decide, Disabled",
          "Projects: create a project with a four-step wizard",
          "Profiles and recipes: reuse your preferences in every project",
        ] },
        { title: "AI instructions", items: [
          "General instructions, AGENTS.md, CLAUDE.md, Cursor and Copilot outputs",
          "Version history and a comparison between two versions",
          "Technology and stack suggestions based on your Library",
        ] },
        { title: "Discovery and trust", items: [
          "Technology catalog and ready-made stacks",
          "Import and export your data",
          "Privacy controls and account deletion",
        ] },
      ],
      note: null,
    },
    {
      id: "v2",
      tag: "V2",
      name: "Pro",
      status: "next",
      statusLabel: "Next",
      summary: "Pro arrives with V2: the first AI features, integrations and developer tools. The Free account stays for good; Pro adds features and higher limits.",
      groups: [
        { title: "AI (first release)", items: [
          "Reasoned AI suggestions for decisions you left to the AI",
          "Fill in resource details from a link",
          "Resource classification and compatibility suggestions",
          "The AI only suggests; nothing changes until you approve",
        ] },
        { title: "Integrations and tools", items: [
          "GitHub connection and repository import",
          "Import existing AGENTS.md, CLAUDE.md, Cursor and Copilot files",
          "Browser extension and command-line tool (CLI)",
        ] },
        { title: "Community (first steps)", items: [
          "Share your recipes and stacks with a link",
          "Suggest new technologies for the catalog (editor approved)",
          "Trending and new technologies",
        ] },
        { title: "Measured technical analyses", items: [
          "Load tests of technologies and stacks, run with k6 on our own server",
          "Concurrent users, latency and throughput, published with the test setup",
        ] },
      ],
      note: null,
    },
    {
      id: "v3",
      tag: "V3",
      name: "Teams and community",
      status: "planned",
      statusLabel: "Planned",
      summary: "Shared context for teams and a public community space.",
      groups: [
        { title: "Teams", items: [
          "Organizations, members and roles",
          "A shared library and approved resources",
          "Required or optional team rules, company stack profiles",
          "Team context export and an audit history",
        ] },
        { title: "Community", items: [
          "Public community stacks and recipes",
          "Likes, comments and collections",
          "Guides and example projects",
          "Profiles and badges for contributors",
        ] },
        { title: "Platform", items: [
          "MCP server: serve project context straight to coding agents",
          "API and SDK",
        ] },
      ],
      note: null,
    },
    {
      id: "v3plus",
      tag: "V3+",
      name: "Advanced AI and enterprise",
      status: "later",
      statusLabel: "After V3",
      summary: "The newest AI features and enterprise use come after V3.",
      groups: [
        { title: "Newest AI features", items: [
          "Automatic stack detection from an existing codebase",
          "Migration assistant and dependency upgrade suggestions",
          "Warnings for aging resources",
          "Context sharing between agents",
        ] },
        { title: "Enterprise", items: [
          "Enterprise use and pricing will be settled after V3",
          "Single sign-on (SSO) and user provisioning (SCIM)",
          "A company-specific resource catalog and policy controls",
        ] },
      ],
      note: "The scope of this stage will be shaped by user feedback after V3.",
    },
  ],
});
