"use client";

import { Archive, ArrowCounterClockwise, BookOpen, Copy, FloppyDisk, PencilSimple } from "@phosphor-icons/react/dist/ssr";
import { profileTypeSchema, projectResponseSchema, saveProjectAsProfileResponseSchema, saveProjectAsRecipeResponseSchema, type ProfileType, type Project } from "@devcontext/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { DrawerFrame } from "../../../../components/drawer";
import { useLocale } from "../../../../components/locale-provider";
import { RowMenu } from "../../../../components/row-menu";
import { readApiError, responseError } from "../../../../lib/errors";
import { defineCopy } from "../../../../lib/i18n";
import { profileTypeDescriptions, profileTypeLabels } from "../../../../lib/resource-labels";

type Dialog = "clone" | "profile" | "recipe" | null;

const copy = defineCopy({
  tr: {
    cloneName: (name: string) => `${name} kopyası`,
    profileName: (name: string) => `${name} stack`,
    recipeName: (name: string) => `${name} tarifi`,
    projectUnreachable: "Proje hizmetine ulaşılamıyor. Tekrar dene.",
    profileUnreachable: "Profil hizmetine ulaşılamıyor. Tekrar dene.",
    recipeUnreachable: "Tarif hizmetine ulaşılamıyor. Tekrar dene.",
    edit: "Projeyi düzenle",
    more: "Diğer işlemler",
    clone: "Kopyala",
    saveAsProfile: "Profil olarak kaydet",
    saveAsRecipe: "Tarif olarak kaydet",
    restoring: "Geri yükleniyor…",
    restore: "Projeyi geri yükle",
    archiving: "Arşivleniyor…",
    archive: "Projeyi arşivle",
    cancel: "Vazgeç",
    cloning: "Kopyalanıyor…",
    cloneSubmit: "Projeyi kopyala",
    cloneTitle: (name: string) => `${name} projesini kopyala`,
    cloneNote: "Kopya; proje bilgilerini, kuralları, bağlı kaynakları, profilleri ve tüm proje kararlarını alır. Sürüm geçmişi ve dışa aktarımlar sıfırdan başlar.",
    cloneField: "Kopyanın adı *",
    saving: "Kaydediliyor…",
    createProfile: "Profil oluştur",
    profileTitle: "Kararları profil olarak kaydet",
    profileNote: "Yalnızca bu projenin kendi kararları kopyalanır; profil ve Kütüphane’den devralınan kurallar yerinde kalır. Yeni profil her projeye bağlanabilir.",
    profileField: "Profil adı *",
    profileType: "Profil türü *",
    createRecipe: "Tarif oluştur",
    recipeTitle: "Projeyi tarif olarak kaydet",
    recipeNote: "Tarif, bu projenin kendi kararlarını ve bağlı profillerini yeni projeler için başlangıç noktası olarak saklar. Projeler tarife referansla bağlanır; tarifte yaptığın değişiklik onu kullanan projelere yansır. Bu proje değişmez.",
    recipeField: "Tarif adı *",
  },
  en: {
    cloneName: (name: string) => `${name} copy`,
    profileName: (name: string) => `${name} stack`,
    recipeName: (name: string) => `${name} recipe`,
    projectUnreachable: "The project service cannot be reached. Try again.",
    profileUnreachable: "The profile service cannot be reached. Try again.",
    recipeUnreachable: "The recipe service cannot be reached. Try again.",
    edit: "Edit project",
    more: "More actions",
    clone: "Duplicate",
    saveAsProfile: "Save as profile",
    saveAsRecipe: "Save as recipe",
    restoring: "Restoring…",
    restore: "Restore project",
    archiving: "Archiving…",
    archive: "Archive project",
    cancel: "Cancel",
    cloning: "Duplicating…",
    cloneSubmit: "Duplicate project",
    cloneTitle: (name: string) => `Duplicate ${name}`,
    cloneNote: "The copy takes the project details, rules, attached resources, profiles and every project decision. Version history and exports start from scratch.",
    cloneField: "Name of the copy *",
    saving: "Saving…",
    createProfile: "Create profile",
    profileTitle: "Save decisions as a profile",
    profileNote: "Only this project's own decisions are copied; rules inherited from profiles and the Library stay where they are. The new profile can be attached to any project.",
    profileField: "Profile name *",
    profileType: "Profile type *",
    createRecipe: "Create recipe",
    recipeTitle: "Save project as a recipe",
    recipeNote: "A recipe keeps this project's own decisions and attached profiles as a starting point for new projects. Projects link to a recipe by reference, so changes you make to the recipe reach every project that uses it. This project does not change.",
    recipeField: "Recipe name *",
  },
});

/** Edit pencil plus the "more" menu of the project header: clone, save as profile or recipe, archive/restore. */
export function ProjectActions({ project }: { project: Project }) {
  const locale = useLocale();
  const t = copy[locale];
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [cloneName, setCloneName] = useState(() => t.cloneName(project.name));
  const [profileName, setProfileName] = useState(() => t.profileName(project.name));
  const [profileType, setProfileType] = useState<ProfileType>("stack");
  const [recipeName, setRecipeName] = useState(() => t.recipeName(project.name));
  // One idempotency key per open dialog so a retried submit never duplicates.
  const keyRef = useRef<string | null>(null);
  const archived = project.status === "archived";

  function openDialog(next: Dialog) {
    keyRef.current = crypto.randomUUID();
    setError(null);
    setDialog(next);
  }

  async function run(action: "archive" | "restore") {
    setPending(action);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${project.id}${action === "restore" ? "/restore" : ""}`, {
        method: action === "restore" ? "POST" : "DELETE",
      });
      if (!response.ok) {
        setError(await responseError(response));
        return;
      }
      router.refresh();
    } catch {
      setError(t.projectUnreachable);
    } finally {
      setPending(null);
    }
  }

  async function clone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("clone");
    setError(null);
    try {
      const response = await fetch(`/api/projects/${project.id}/clone`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(keyRef.current ? { "idempotency-key": keyRef.current } : {}) },
        body: JSON.stringify(cloneName.trim() ? { name: cloneName.trim() } : {}),
      });
      if (!response.ok) {
        setError((await readApiError(response)).message);
        return;
      }
      const result = projectResponseSchema.parse(await response.json());
      router.push(`/workspace/projects/${result.project.id}`);
    } catch {
      setError(t.projectUnreachable);
    } finally {
      setPending(null);
    }
  }

  async function saveAsProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("profile");
    setError(null);
    try {
      const response = await fetch(`/api/projects/${project.id}/save-as-profile`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(keyRef.current ? { "idempotency-key": keyRef.current } : {}) },
        body: JSON.stringify({ name: profileName.trim(), type: profileType }),
      });
      if (!response.ok) {
        setError((await readApiError(response)).message);
        return;
      }
      const result = saveProjectAsProfileResponseSchema.parse(await response.json());
      router.push(`/workspace/profiles/${result.profile.id}`);
    } catch {
      setError(t.profileUnreachable);
    } finally {
      setPending(null);
    }
  }

  async function saveAsRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("recipe");
    setError(null);
    try {
      const response = await fetch(`/api/projects/${project.id}/save-as-recipe`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(keyRef.current ? { "idempotency-key": keyRef.current } : {}) },
        body: JSON.stringify({ name: recipeName.trim() }),
      });
      if (!response.ok) {
        setError((await readApiError(response)).message);
        return;
      }
      const result = saveProjectAsRecipeResponseSchema.parse(await response.json());
      router.push(`/workspace/recipes/${result.recipe.id}`);
    } catch {
      setError(t.recipeUnreachable);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="actions">
      {!archived && <Link aria-label={t.edit} className="icon-button bordered" href={`/workspace/projects?edit=${project.id}`} title={t.edit}><PencilSimple aria-hidden size={20} /></Link>}
      <RowMenu label={t.more}>
        <button disabled={pending !== null} onClick={() => openDialog("clone")} type="button"><Copy aria-hidden size={18} />{t.clone}</button>
        <button disabled={pending !== null} onClick={() => openDialog("profile")} type="button"><FloppyDisk aria-hidden size={18} />{t.saveAsProfile}</button>
        <button disabled={pending !== null} onClick={() => openDialog("recipe")} type="button"><BookOpen aria-hidden size={18} />{t.saveAsRecipe}</button>
        {archived
          ? <button disabled={pending !== null} onClick={() => void run("restore")} type="button"><ArrowCounterClockwise aria-hidden size={18} />{pending === "restore" ? t.restoring : t.restore}</button>
          : <button disabled={pending !== null} onClick={() => void run("archive")} type="button"><Archive aria-hidden size={18} />{pending === "archive" ? t.archiving : t.archive}</button>}
      </RowMenu>
      {error && !dialog && <p className="form-error" role="alert">{error}</p>}
      {dialog === "clone" && (
        <DrawerFrame
          footer={<><button className="button" onClick={() => setDialog(null)} type="button">{t.cancel}</button><button className="button primary" disabled={pending !== null || !cloneName.trim()} type="submit">{pending === "clone" ? t.cloning : t.cloneSubmit}</button></>}
          onClose={() => setDialog(null)}
          onSubmit={clone}
          title={t.cloneTitle(project.name)}
          variant="dialog"
        >
          <p className="muted small">{t.cloneNote}</p>
          <label className="field"><span>{t.cloneField}</span><input data-autofocus maxLength={160} onChange={(event) => setCloneName(event.target.value)} required value={cloneName} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
        </DrawerFrame>
      )}
      {dialog === "profile" && (
        <DrawerFrame
          footer={<><button className="button" onClick={() => setDialog(null)} type="button">{t.cancel}</button><button className="button primary" disabled={pending !== null || !profileName.trim()} type="submit">{pending === "profile" ? t.saving : t.createProfile}</button></>}
          onClose={() => setDialog(null)}
          onSubmit={saveAsProfile}
          title={t.profileTitle}
          variant="dialog"
        >
          <p className="muted small">{t.profileNote}</p>
          <label className="field"><span>{t.profileField}</span><input data-autofocus maxLength={160} onChange={(event) => setProfileName(event.target.value)} required value={profileName} /></label>
          <fieldset style={{ border: 0, margin: 0, padding: 0, display: "grid", gap: 10 }}>
            <legend className="field-label">{t.profileType}</legend>
            <div className="radio-grid">
              {profileTypeSchema.options.map((option) => (
                <label className={`radio-card${profileType === option ? " selected" : ""}`} key={option}>
                  <input checked={profileType === option} name="save-profile-type" onChange={() => setProfileType(option)} type="radio" value={option} />
                  <strong>{profileTypeLabels[locale][option]}</strong>
                  <span>{profileTypeDescriptions[locale][option]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {error && <p className="form-error" role="alert">{error}</p>}
        </DrawerFrame>
      )}
      {dialog === "recipe" && (
        <DrawerFrame
          footer={<><button className="button" onClick={() => setDialog(null)} type="button">{t.cancel}</button><button className="button primary" disabled={pending !== null || !recipeName.trim()} type="submit">{pending === "recipe" ? t.saving : t.createRecipe}</button></>}
          onClose={() => setDialog(null)}
          onSubmit={saveAsRecipe}
          title={t.recipeTitle}
          variant="dialog"
        >
          <p className="muted small">{t.recipeNote}</p>
          <label className="field"><span>{t.recipeField}</span><input data-autofocus maxLength={160} onChange={(event) => setRecipeName(event.target.value)} required value={recipeName} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
        </DrawerFrame>
      )}
    </div>
  );
}
