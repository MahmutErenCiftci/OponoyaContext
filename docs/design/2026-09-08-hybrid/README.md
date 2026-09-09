# DevContext — Birleşik UI tasarım seti

8 Eylül 2026 · 16 ana sayfa ve kritik akışlar için 27 masaüstü görünümü.

Bu dosyalar yerleşim ve görsel tasarım referansıdır. Yerleşik ImageGen ile üretilmiş PNG görsellerdir; düzenlenebilir Figma katmanları değildir. Hedef çalışma alanı 1440 × 1024; dosyalar aracın doğal çıktı çözünürlüğünü korur. Ekranlardaki içerik ve sayılar örnektir.

## Görseller

| Ekran | Akış | Görsel |
|---|---|---|
| Tanıtım | Başlangıç | [Aç](images/01-landing.png) |
| Giriş yap | Başlangıç | [Aç](images/02-sign-in-v2.png) |
| Hesap oluştur | Başlangıç | [Aç](images/03-sign-up.png) |
| İlk kullanım | Başlangıç | [Aç](images/05-onboarding.png) |
| Genel bakış | Çalışma alanı | [Aç](images/04-dashboard.png) |
| Kütüphane | Kaynaklar | [Aç](images/06-library.png) |
| Kaynak ekleme ve düzenleme | Kaynaklar | [Aç](images/07-resource-editor.png) |
| Teknoloji kataloğu | Kaynaklar | [Aç](images/08-catalog.png) |
| Teknoloji detayı | Kaynaklar | [Aç](images/09-technology-detail.png) |
| Hazır stack detayı | Kaynaklar | [Aç](images/10-stack-preset.png) |
| Profiller | Yeniden kullanım | [Aç](images/11-profiles.png) |
| Profil detayı | Yeniden kullanım | [Aç](images/12-profile-detail.png) |
| Tarifler | Yeniden kullanım | [Aç](images/13-recipes.png) |
| Tarif detayı | Yeniden kullanım | [Aç](images/14-recipe-detail.png) |
| Projeler | Projeler | [Aç](images/15-projects.png) |
| Yeni proje — bilgiler | Proje oluşturma | [Aç](images/16-project-basics-v2.png) |
| Yeni proje — teknoloji kararları | Proje oluşturma | [Aç](images/17-project-technologies-v2.png) |
| Yeni proje — kurallar | Proje oluşturma | [Aç](images/18-project-rules-v2.png) |
| Yeni proje — gözden geçirme | Proje oluşturma | [Aç](images/19-project-review.png) |
| Proje genel bakış | Projeler | [Aç](images/20-project-overview.png) |
| Proje teknoloji yığını | Projeler | [Aç](images/21-project-stack.png) |
| Karar düzenleyici | Projeler | [Aç](images/22-decision-editor.png) |
| AI talimatları — birleşik ana tasarım | AI talimatları | [Aç](images/00-context-master-v2.png) |
| Bağlam sürüm karşılaştırması | AI talimatları | [Aç](images/23-context-diff.png) |
| Ayarlar | Ayarlar | [Aç](images/24-settings.png) |
| Veri içe ve dışa aktarma | Ayarlar | [Aç](images/25-import-export.png) |
| Bağlantı hatası ve yeniden deneme | Durumlar | [Aç](images/26-unavailable.png) |

## Tasarım kararları

- Açık zemin, lime ana işlem, Manrope metinler ve okunabilir satır aralıkları.
- Ortak üst gezinme; proje içinde Genel bakış / Teknoloji yığını / AI talimatları.
- Proje oluşturma: bilgiler → teknoloji kararları → kurallar → gözden geçirme. Yedi teknoloji grubu ikinci aşamanın sekmelerindedir.
- Karar kaynakları, tercih biçimleri ve işlem önizlemeleri görünürdür.
- Koyu tema ve mobil davranış mevcut uygulamada korunmalı, bu masaüstü referanslarından uyarlanmalıdır.

## Uygulama sırasında bağlayıcı ayrıntılar

Görsel metinlerdeki küçük üretim farklılıkları veri sözleşmelerinin yerine geçmez. Kilitli karar, kodlama ajanının uyması gereken tercihtir; kullanıcı bu kararı değiştirebilir. Kaynak ve profil birbirinden ayrı tutulur. AI karar versin durumunda seçili bir kaynak bağlayıcı seçim gibi gösterilmez; kısıt veya izin verilen seçenek olarak açıklanır. Örnekler yüklüyken ekleme işlemi tekrar teşvik edilmez. İçe aktarma önizlemesinde henüz kaydetme başarı bildirimi gösterilmez. Gezinmede menüler yalnızca kullanıcı açtığında görünür.

## Üretim kayıtları

Ortak üretim talimatı: [BASE.txt](prompts/BASE.txt). Ekran talimatları: [screens.json](prompts/screens.json). Düzeltme talimatları prompts klasöründe. Son dosyaların listesi: [manifest.json](manifest.json).

## Tam boy inceleme

### Tanıtım

![Tanıtım](images/01-landing.png)

### Giriş yap

![Giriş yap](images/02-sign-in-v2.png)

### Hesap oluştur

![Hesap oluştur](images/03-sign-up.png)

### İlk kullanım

![İlk kullanım](images/05-onboarding.png)

### Genel bakış

![Genel bakış](images/04-dashboard.png)

### Kütüphane

![Kütüphane](images/06-library.png)

### Kaynak ekleme ve düzenleme

![Kaynak ekleme ve düzenleme](images/07-resource-editor.png)

### Teknoloji kataloğu

![Teknoloji kataloğu](images/08-catalog.png)

### Teknoloji detayı

![Teknoloji detayı](images/09-technology-detail.png)

### Hazır stack detayı

![Hazır stack detayı](images/10-stack-preset.png)

### Profiller

![Profiller](images/11-profiles.png)

### Profil detayı

![Profil detayı](images/12-profile-detail.png)

### Tarifler

![Tarifler](images/13-recipes.png)

### Tarif detayı

![Tarif detayı](images/14-recipe-detail.png)

### Projeler

![Projeler](images/15-projects.png)

### Yeni proje — bilgiler

![Yeni proje — bilgiler](images/16-project-basics-v2.png)

### Yeni proje — teknoloji kararları

![Yeni proje — teknoloji kararları](images/17-project-technologies-v2.png)

### Yeni proje — kurallar

![Yeni proje — kurallar](images/18-project-rules-v2.png)

### Yeni proje — gözden geçirme

![Yeni proje — gözden geçirme](images/19-project-review.png)

### Proje genel bakış

![Proje genel bakış](images/20-project-overview.png)

### Proje teknoloji yığını

![Proje teknoloji yığını](images/21-project-stack.png)

### Karar düzenleyici

![Karar düzenleyici](images/22-decision-editor.png)

### AI talimatları — birleşik ana tasarım

![AI talimatları — birleşik ana tasarım](images/00-context-master-v2.png)

### Bağlam sürüm karşılaştırması

![Bağlam sürüm karşılaştırması](images/23-context-diff.png)

### Ayarlar

![Ayarlar](images/24-settings.png)

### Veri içe ve dışa aktarma

![Veri içe ve dışa aktarma](images/25-import-export.png)

### Bağlantı hatası ve yeniden deneme

![Bağlantı hatası ve yeniden deneme](images/26-unavailable.png)

