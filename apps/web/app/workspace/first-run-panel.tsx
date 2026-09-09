"use client";

import { sampleInstallResponseSchema, type WorkspaceSettings } from "@devcontext/contracts";
import { ArrowRight, CaretRight, Database, Folder, FolderSimplePlus, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TechLogo } from "../../components/tech-logo";
import { readApiError } from "../../lib/errors";

type Path = "samples" | "own";

/** What the sample set installs, named as the samples are named; installing happens only through the button. */
const sampleHighlights = [
  { name: "Next.js", slug: "nextjs", type: "Framework" },
  { name: "PostgreSQL", slug: "postgresql", type: "Veritabanı" },
  { name: "shadcn/ui", slug: "shadcn-ui", type: "Bileşenler" },
  { name: "Better Auth", slug: "better-auth", type: "Kimlik doğrulama" },
];

/**
 * First-run choices shown on the overview until the user picks one or skips.
 * Every path is resumable from Settings; nothing is added to the workspace
 * unless the user explicitly installs samples or imports a file.
 */
export function FirstRunPanel({ settings }: { settings: WorkspaceSettings }) {
  const router = useRouter();
  const [path, setPath] = useState<Path>("samples");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patchOnboarding(state: WorkspaceSettings["onboardingState"], choice: WorkspaceSettings["onboardingChoice"]) {
    const response = await fetch("/api/workspace/onboarding", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ state, choice }) });
    if (!response.ok) throw new Error((await readApiError(response)).message);
  }

  async function installSamples() {
    setPending("samples");
    setError(null);
    try {
      const response = await fetch("/api/workspace/samples", { method: "POST" });
      if (!response.ok) {
        setError((await readApiError(response)).message);
        return;
      }
      sampleInstallResponseSchema.parse(await response.json());
      router.refresh();
    } catch {
      setError("Çalışma alanı hizmetine ulaşılamıyor. Tekrar dene.");
    } finally {
      setPending(null);
    }
  }

  async function startOwn() {
    setPending("own");
    setError(null);
    try {
      await patchOnboarding("completed", "empty");
      router.push("/workspace/library?add=1");
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Kurulum durumu güncellenemedi.");
      setPending(null);
    }
  }

  async function chooseImport() {
    setPending("import");
    setError(null);
    try {
      await patchOnboarding("in_progress", "import");
      router.push("/workspace/settings#import");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Kurulum durumu güncellenemedi.");
      setPending(null);
    }
  }

  async function finish(state: "skipped" | "completed") {
    setPending(state);
    setError(null);
    try {
      await patchOnboarding(state, state === "skipped" ? null : "empty");
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Kurulum durumu güncellenemedi.");
      setPending(null);
    }
  }

  if (settings.onboardingState === "in_progress") {
    return (
      <section aria-labelledby="first-run-title" className="first-run-compact">
        <div>
          <h2 id="first-run-title">{settings.onboardingChoice === "samples" ? "Örneklerin hazır." : settings.onboardingChoice === "import" ? "İçe aktarımı Ayarlar’da tamamla." : "Kaldığın yerden devam et."}</h2>
          <p>İlk talimat dosyanı oluşturmak için bir proje aç veya kurulumu tamamla.</p>
          {error && <p className="form-error" role="alert" style={{ marginTop: 10 }}>{error}</p>}
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {settings.onboardingChoice === "import" && <Link className="button primary" href="/workspace/settings#import">İçe aktarımı aç</Link>}
          <button className="button" disabled={pending !== null} onClick={() => void finish("completed")} type="button">Kurulumu tamamla</button>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="first-run-title" className="first-run">
      <div className="intro">
        <h2 id="first-run-title">Çalışma alanın hazır.</h2>
        <p>Birkaç tercih ekleyerek ilk AI talimatlarını oluştur.</p>
      </div>
      <ol aria-label="Üç adım" className="stage-guide">
        <li><span className="mark"><Database size={30} /></span><span className="stage-label"><i>1</i>Araçlarını kaydet</span></li>
        <li aria-hidden="true"><span className="stage-line" /></li>
        <li><span className="mark"><Folder size={30} /></span><span className="stage-label"><i>2</i>Proje oluştur</span></li>
        <li aria-hidden="true"><span className="stage-line" /></li>
        <li><span className="mark"><UploadSimple size={30} /></span><span className="stage-label"><i>3</i>Talimatları dışa aktar</span></li>
      </ol>
      <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
        <legend className="visually-hidden">Başlangıç yolu</legend>
        <div className="choices">
          <label className={`choice-panel${path === "samples" ? " selected" : ""}`}>
            <input checked={path === "samples"} name="first-run-path" onChange={() => setPath("samples")} type="radio" value="samples" />
            <strong>Örneklerle başla</strong>
            <span>Sık kullanılan araçlarla dolu bir başlangıç kütüphanesi ekle.</span>
            <div className="panel-body">
              <div className="list-rows">
                {sampleHighlights.map((item) => (
                  <div key={item.slug}><span className="mark small plain"><TechLogo name={item.name} size={26} slug={item.slug} /></span><span className="grow" style={{ fontWeight: 500 }}>{item.name}</span><small>{item.type}</small></div>
                ))}
              </div>
              <p className="muted small" style={{ marginTop: 18 }}>Sekiz kaynak, iki profil, bir tarif ve bir örnek proje eklenir. Örnekleri daha sonra kaldırabilirsin.</p>
            </div>
          </label>
          <label className={`choice-panel${path === "own" ? " selected" : ""}`}>
            <input checked={path === "own"} name="first-run-path" onChange={() => setPath("own")} type="radio" value="own" />
            <strong>Kendi tercihlerimle başlayacağım</strong>
            <span>Kütüphanene ilk kaynağını ekle.</span>
            <div className="panel-body">
              <div className="panel-empty">
                <span className="mark xl plain" style={{ background: "var(--subtle)" }}><FolderSimplePlus size={40} /></span>
                <p>Araçlarını, kurallarını ve tercihlerini kendin ekleyerek projene özgü talimatlar oluştur.</p>
              </div>
            </div>
          </label>
        </div>
      </fieldset>
      <p className="muted small" style={{ textAlign: "center" }}>
        Yedeğin mi var?{" "}
        <button className="text-link" disabled={pending !== null} onClick={() => void chooseImport()} style={{ background: "none", border: 0, padding: 0 }} type="button">Verilerini içe aktar</button>
      </p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="foot">
        <button className="button quiet" disabled={pending !== null} onClick={() => void finish("skipped")} type="button">Şimdilik atla</button>
        {path === "samples"
          ? <button className="button primary large" disabled={pending !== null} onClick={() => void installSamples()} type="button">{pending === "samples" ? "Örnekler ekleniyor…" : "Örnekleri ekle ve başla"}<CaretRight aria-hidden size={18} /></button>
          : <button className="button primary large" disabled={pending !== null} onClick={() => void startOwn()} type="button">{pending === "own" ? "Açılıyor…" : "İlk kaynağımı ekle"}<ArrowRight aria-hidden size={18} /></button>}
      </div>
    </section>
  );
}
