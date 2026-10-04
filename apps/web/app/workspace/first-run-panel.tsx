"use client";

import { sampleInstallResponseSchema, type WorkspaceSettings } from "@devcontext/contracts";
import { ArrowRight, CaretRight, Database, Folder, FolderSimplePlus, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale } from "../../components/locale-provider";
import { TechLogo } from "../../components/tech-logo";
import { readApiError } from "../../lib/errors";
import { defineCopy } from "../../lib/i18n";

type Path = "samples" | "own";

/** What the sample set installs, named as the samples are named; installing happens only through the button. */
const sampleHighlights = [
  { name: "Next.js", slug: "nextjs", type: "framework" },
  { name: "PostgreSQL", slug: "postgresql", type: "database" },
  { name: "shadcn/ui", slug: "shadcn-ui", type: "components" },
  { name: "Better Auth", slug: "better-auth", type: "auth" },
] as const;

const copy = defineCopy({
  tr: {
    sampleTypes: { framework: "Framework", database: "Veritabanı", components: "Bileşenler", auth: "Kimlik doğrulama" },
    unreachable: "Çalışma alanı hizmetine ulaşılamıyor. Tekrar dene.",
    stateFailed: "Kurulum durumu güncellenemedi.",
    compactTitleSamples: "Örneklerin hazır.",
    compactTitleImport: "İçe aktarımı Ayarlar’da tamamla.",
    compactTitleResume: "Kaldığın yerden devam et.",
    compactLead: "İlk talimat dosyanı oluşturmak için bir proje aç veya kurulumu tamamla.",
    openImport: "İçe aktarımı aç",
    completeSetup: "Kurulumu tamamla",
    title: "Çalışma alanın hazır.",
    lead: "Birkaç tercih ekleyerek ilk AI talimatlarını oluştur.",
    stepsLabel: "Üç adım",
    stepSave: "Araçlarını kaydet",
    stepProject: "Proje oluştur",
    stepExport: "Talimatları dışa aktar",
    pathLegend: "Başlangıç yolu",
    samplesTitle: "Örneklerle başla",
    samplesText: "Sık kullanılan araçlarla dolu bir başlangıç kütüphanesi ekle.",
    samplesNote: "Sekiz kaynak, iki profil, bir tarif ve bir örnek proje eklenir. Örnekleri daha sonra kaldırabilirsin.",
    ownTitle: "Kendi tercihlerimle başlayacağım",
    ownText: "Kütüphanene ilk kaynağını ekle.",
    ownNote: "Araçlarını, kurallarını ve tercihlerini kendin ekleyerek projene özgü talimatlar oluştur.",
    backupQuestion: "Yedeğin mi var?",
    importData: "Verilerini içe aktar",
    skip: "Şimdilik atla",
    addingSamples: "Örnekler ekleniyor…",
    addSamples: "Örnekleri ekle ve başla",
    opening: "Açılıyor…",
    addFirst: "İlk kaynağımı ekle",
  },
  en: {
    sampleTypes: { framework: "Framework", database: "Database", components: "Components", auth: "Authentication" },
    unreachable: "The workspace service can't be reached. Try again.",
    stateFailed: "The setup state could not be updated.",
    compactTitleSamples: "Your samples are ready.",
    compactTitleImport: "Finish the import in Settings.",
    compactTitleResume: "Pick up where you left off.",
    compactLead: "Open a project to create your first instruction file, or complete the setup.",
    openImport: "Open import",
    completeSetup: "Complete setup",
    title: "Your workspace is ready.",
    lead: "Add a few choices and create your first AI instructions.",
    stepsLabel: "Three steps",
    stepSave: "Save your tools",
    stepProject: "Create a project",
    stepExport: "Export the instructions",
    pathLegend: "How to start",
    samplesTitle: "Start with samples",
    samplesText: "Add a starter Library full of commonly used tools.",
    samplesNote: "Adds eight resources, two profiles, one recipe and one sample project. You can remove the samples later.",
    ownTitle: "I'll start with my own choices",
    ownText: "Add your first resource to your Library.",
    ownNote: "Add your own tools, rules and choices to create instructions tailored to your project.",
    backupQuestion: "Have a backup?",
    importData: "Import your data",
    skip: "Skip for now",
    addingSamples: "Adding samples…",
    addSamples: "Add samples and start",
    opening: "Opening…",
    addFirst: "Add my first resource",
  },
});

/**
 * First-run choices shown on the overview until the user picks one or skips.
 * Every path is resumable from Settings; nothing is added to the workspace
 * unless the user explicitly installs samples or imports a file.
 */
export function FirstRunPanel({ settings }: { settings: WorkspaceSettings }) {
  const router = useRouter();
  const t = copy[useLocale()];
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
      setError(t.unreachable);
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
      setError(failure instanceof Error ? failure.message : t.stateFailed);
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
      setError(failure instanceof Error ? failure.message : t.stateFailed);
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
      setError(failure instanceof Error ? failure.message : t.stateFailed);
      setPending(null);
    }
  }

  if (settings.onboardingState === "in_progress") {
    return (
      <section aria-labelledby="first-run-title" className="first-run-compact">
        <div>
          <h2 id="first-run-title">{settings.onboardingChoice === "samples" ? t.compactTitleSamples : settings.onboardingChoice === "import" ? t.compactTitleImport : t.compactTitleResume}</h2>
          <p>{t.compactLead}</p>
          {error && <p className="form-error" role="alert" style={{ marginTop: 10 }}>{error}</p>}
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {settings.onboardingChoice === "import" && <Link className="button primary" href="/workspace/settings#import">{t.openImport}</Link>}
          <button className="button" disabled={pending !== null} onClick={() => void finish("completed")} type="button">{t.completeSetup}</button>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="first-run-title" className="first-run">
      <div className="intro">
        <h2 id="first-run-title">{t.title}</h2>
        <p>{t.lead}</p>
      </div>
      <ol aria-label={t.stepsLabel} className="stage-guide">
        <li><span className="mark"><Database aria-hidden size={30} /></span><span className="stage-label"><i>1</i>{t.stepSave}</span></li>
        <li aria-hidden="true"><span className="stage-line" /></li>
        <li><span className="mark"><Folder aria-hidden size={30} /></span><span className="stage-label"><i>2</i>{t.stepProject}</span></li>
        <li aria-hidden="true"><span className="stage-line" /></li>
        <li><span className="mark"><UploadSimple aria-hidden size={30} /></span><span className="stage-label"><i>3</i>{t.stepExport}</span></li>
      </ol>
      <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
        <legend className="visually-hidden">{t.pathLegend}</legend>
        <div className="choices">
          <label className={`choice-panel${path === "samples" ? " selected" : ""}`}>
            <input checked={path === "samples"} name="first-run-path" onChange={() => setPath("samples")} type="radio" value="samples" />
            <strong>{t.samplesTitle}</strong>
            <span>{t.samplesText}</span>
            <div className="panel-body">
              <div className="list-rows">
                {sampleHighlights.map((item) => (
                  <div key={item.slug}><span className="mark small plain"><TechLogo name={item.name} size={26} slug={item.slug} /></span><span className="grow" style={{ fontWeight: 500 }}>{item.name}</span><small>{t.sampleTypes[item.type]}</small></div>
                ))}
              </div>
              <p className="muted small" style={{ marginTop: 18 }}>{t.samplesNote}</p>
            </div>
          </label>
          <label className={`choice-panel${path === "own" ? " selected" : ""}`}>
            <input checked={path === "own"} name="first-run-path" onChange={() => setPath("own")} type="radio" value="own" />
            <strong>{t.ownTitle}</strong>
            <span>{t.ownText}</span>
            <div className="panel-body">
              <div className="panel-empty">
                <span className="mark xl plain" style={{ background: "var(--subtle)" }}><FolderSimplePlus aria-hidden size={40} /></span>
                <p>{t.ownNote}</p>
              </div>
            </div>
          </label>
        </div>
      </fieldset>
      <p className="muted small" style={{ textAlign: "center" }}>
        {t.backupQuestion}{" "}
        <button className="text-link" disabled={pending !== null} onClick={() => void chooseImport()} style={{ background: "none", border: 0, padding: 0 }} type="button">{t.importData}</button>
      </p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="foot">
        <button className="button quiet" disabled={pending !== null} onClick={() => void finish("skipped")} type="button">{t.skip}</button>
        {path === "samples"
          ? <button className="button primary large" disabled={pending !== null} onClick={() => void installSamples()} type="button">{pending === "samples" ? t.addingSamples : t.addSamples}<CaretRight aria-hidden size={18} /></button>
          : <button className="button primary large" disabled={pending !== null} onClick={() => void startOwn()} type="button">{pending === "own" ? t.opening : t.addFirst}<ArrowRight aria-hidden size={18} /></button>}
      </div>
    </section>
  );
}
