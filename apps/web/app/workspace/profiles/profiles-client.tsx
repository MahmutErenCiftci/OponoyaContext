"use client";

import { Archive, ArrowCounterClockwise, ArrowRight, Brain, MagnifyingGlass, Palette, PencilSimple, Plus, RocketLaunch, Stack, Tray } from "@phosphor-icons/react/dist/ssr";
import {
  profileListResponseSchema,
  profileResponseSchema,
  profileTypeSchema,
  type Profile,
  type ProfileSummary,
  type ProfileType,
} from "@devcontext/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { DrawerFrame } from "../../../components/drawer";
import { useLocale } from "../../../components/locale-provider";
import { PageHead } from "../../../components/page-heading";
import { RowMenu } from "../../../components/row-menu";
import { responseError } from "../../../lib/errors";
import { defineCopy } from "../../../lib/i18n";
import { formatDate, pluralCount, profileTypeDescriptions, profileTypeLabels } from "../../../lib/resource-labels";

type ArchiveView = "active" | "archived";
type Editor = { kind: "closed" } | { kind: "create" } | { kind: "edit"; profile: ProfileSummary };

/** Short type names used in tabs and row labels: `profileTypeShort[locale][type]`. */
export const profileTypeShort = defineCopy<Record<ProfileType, string>>({
  tr: { stack: "Stack", design: "Tasarım", ai: "AI", deployment: "Dağıtım" },
  en: { stack: "Stack", design: "Design", ai: "AI", deployment: "Deployment" },
});

const copy = defineCopy({
  tr: {
    nameRequired: "Profile bir ad ver.",
    serviceUnreachable: "Profil hizmetine ulaşılamıyor. Tekrar dene.",
    closeEditor: "Profil düzenleyiciyi kapat",
    cancel: "İptal",
    saving: "Kaydediliyor…",
    saveChanges: "Değişiklikleri kaydet",
    createProfile: "Profil oluştur",
    editProfile: "Profili düzenle",
    profileName: "Profil adı *",
    profileNamePlaceholder: "örn. SaaS başlangıcı",
    profileTypeRequired: "Profil türü *",
    description: "Açıklama",
    descriptionPlaceholder: "Bu profile ne zaman başvurulur…",
    decisions: (count: number) => pluralCount(count, "karar"),
    projects: (count: number) => pluralCount(count, "proje"),
    archivedSuffix: " · Arşivde",
    updated: "Güncellendi ",
    openProfile: (name: string) => `${name} profilini aç`,
    rowActions: (name: string) => `${name} işlemleri`,
    edit: "Düzenle",
    restore: "Geri yükle",
    archive: "Arşivle",
    refreshFailed: "Profiller yenilenemedi.",
    restored: (name: string) => `${name} geri yüklendi.`,
    archived: (name: string) => `${name} arşivlendi. Onu kullanan projeler kararlarını korur.`,
    workspaceUnreachable: "Çalışma alanına ulaşılamıyor. Tekrar dene.",
    all: "Tümü",
    lead: "Teknoloji, tasarım ve AI tercihlerini tekrar kullan.",
    title: "Profiller",
    archivedTitle: "Arşivlenmiş profiller",
    profileType: "Profil türü",
    search: "Profillerde ara",
    emptyArchiveTitle: "Arşiv boş",
    emptyTitle: "Henüz profil yok",
    emptyArchiveText: "Arşivlediğin profilleri buradan geri yükleyebilirsin.",
    emptyText: "Bir profil oluştur ve kararlarını uygun tüm projelerinde yeniden kullan.",
    createFirst: "İlk profilini oluştur",
    showArchived: "Arşivlenmiş profiller",
    showActive: "Aktif profiller",
    saved: (name: string) => `${name} kaydedildi.`,
  },
  en: {
    nameRequired: "Give the profile a name.",
    serviceUnreachable: "The profile service can't be reached. Try again.",
    closeEditor: "Close the profile editor",
    cancel: "Cancel",
    saving: "Saving…",
    saveChanges: "Save changes",
    createProfile: "Create profile",
    editProfile: "Edit profile",
    profileName: "Profile name *",
    profileNamePlaceholder: "e.g. SaaS starter",
    profileTypeRequired: "Profile type *",
    description: "Description",
    descriptionPlaceholder: "When to reach for this profile…",
    decisions: (count: number) => pluralCount(count, "decision", "decisions"),
    projects: (count: number) => pluralCount(count, "project", "projects"),
    archivedSuffix: " · Archived",
    updated: "Updated ",
    openProfile: (name: string) => `Open the ${name} profile`,
    rowActions: (name: string) => `${name} actions`,
    edit: "Edit",
    restore: "Restore",
    archive: "Archive",
    refreshFailed: "Profiles could not be refreshed.",
    restored: (name: string) => `${name} restored.`,
    archived: (name: string) => `${name} archived. Projects that use it keep their decisions.`,
    workspaceUnreachable: "The workspace can't be reached. Try again.",
    all: "All",
    lead: "Reuse your technology, design and AI preferences.",
    title: "Profiles",
    archivedTitle: "Archived profiles",
    profileType: "Profile type",
    search: "Search profiles",
    emptyArchiveTitle: "The archive is empty",
    emptyTitle: "No profiles yet",
    emptyArchiveText: "You can restore archived profiles from here.",
    emptyText: "Create a profile and reuse its decisions in every project it fits.",
    createFirst: "Create your first profile",
    showArchived: "Archived profiles",
    showActive: "Active profiles",
    saved: (name: string) => `${name} saved.`,
  },
});

export function ProfileIcon({ type, size = 32 }: { type: ProfileType; size?: number }) {
  if (type === "design") return <Palette aria-hidden size={size} />;
  if (type === "ai") return <Brain aria-hidden size={size} />;
  if (type === "deployment") return <RocketLaunch aria-hidden size={size} />;
  return <Stack aria-hidden size={size} />;
}

export function ProfileEditor({ profile, onClose, onSaved }: {
  profile: ProfileSummary | null;
  onClose(): void;
  onSaved(profile: Profile): void;
}) {
  const locale = useLocale();
  const t = copy[locale];
  const [name, setName] = useState(profile?.name ?? "");
  const [type, setType] = useState<ProfileType>(profile?.type ?? "stack");
  const [description, setDescription] = useState(profile?.description ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) { setError(t.nameRequired); return; }
    setPending(true);
    setError(null);
    const payload = profile
      ? { name: name.trim(), type, description: description.trim() || null }
      : { name: name.trim(), type, ...(description.trim() ? { description: description.trim() } : {}) };
    try {
      const response = await fetch(profile ? `/api/profiles/${profile.id}` : "/api/profiles", {
        method: profile ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setError(await responseError(response));
        return;
      }
      onSaved(profileResponseSchema.parse(await response.json()).profile);
    } catch {
      setError(t.serviceUnreachable);
    } finally {
      setPending(false);
    }
  }

  return (
    <DrawerFrame
      closeLabel={t.closeEditor}
      footer={<><button className="button" onClick={onClose} type="button">{t.cancel}</button><button className="button primary" disabled={pending || !name.trim()} type="submit">{pending ? t.saving : profile ? t.saveChanges : t.createProfile}</button></>}
      onClose={onClose}
      onSubmit={submit}
      title={profile ? t.editProfile : t.createProfile}
      variant="dialog"
    >
      <label className="field"><span>{t.profileName}</span><input data-autofocus maxLength={160} onChange={(event) => setName(event.target.value)} placeholder={t.profileNamePlaceholder} required value={name} /></label>
      <fieldset style={{ border: 0, margin: 0, padding: 0, display: "grid", gap: 10 }}>
        <legend className="field-label">{t.profileTypeRequired}</legend>
        <div className="radio-grid">
          {profileTypeSchema.options.map((option) => (
            <label className={`radio-card${type === option ? " selected" : ""}`} key={option}>
              <input checked={type === option} name="profile-type" onChange={() => setType(option)} type="radio" value={option} />
              <strong>{profileTypeLabels[locale][option]}</strong>
              <span>{profileTypeDescriptions[locale][option]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field"><span>{t.description}</span><textarea maxLength={2000} onChange={(event) => setDescription(event.target.value)} placeholder={t.descriptionPlaceholder} rows={3} value={description} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
    </DrawerFrame>
  );
}

function ProfileRow({ profile, onEdit, onArchive, onRestore }: {
  profile: ProfileSummary;
  onEdit(): void;
  onArchive(): void;
  onRestore(): void;
}) {
  const locale = useLocale();
  const t = copy[locale];
  const archived = Boolean(profile.archivedAt);
  return (
    <li className={`entity-row${archived ? " archived" : ""}`}>
      <span className={`mark large tone profile-${profile.type}`}><ProfileIcon type={profile.type} /></span>
      <div className="grow">
        <h3><Link href={`/workspace/profiles/${profile.id}`}>{profile.name}</Link></h3>
        <small>{profileTypeShort[locale][profile.type]} · {t.decisions(profile.decisionCount)}{profile.projectCount > 0 ? ` · ${t.projects(profile.projectCount)}` : ""}{archived ? t.archivedSuffix : ""}</small>
        {profile.description && <p>{profile.description}</p>}
      </div>
      <span className="muted small nowrap">{t.updated}{formatDate(profile.updatedAt, locale)}</span>
      <Link aria-label={t.openProfile(profile.name)} className="icon-button" href={`/workspace/profiles/${profile.id}`}><ArrowRight aria-hidden size={22} /></Link>
      <RowMenu label={t.rowActions(profile.name)}>
        {!archived && <button onClick={onEdit} type="button"><PencilSimple aria-hidden size={18} />{t.edit}</button>}
        {archived
          ? <button onClick={onRestore} type="button"><ArrowCounterClockwise aria-hidden size={18} />{t.restore}</button>
          : <button onClick={onArchive} type="button"><Archive aria-hidden size={18} />{t.archive}</button>}
      </RowMenu>
    </li>
  );
}

export function EntityList({ children }: { children: ReactNode }) {
  return <ul className="entity-list">{children}</ul>;
}

export function ProfilesClient({ initial, openCreateOnLoad }: {
  initial: { profiles: ProfileSummary[]; total: number };
  openCreateOnLoad: boolean;
}) {
  const locale = useLocale();
  const t = copy[locale];
  const router = useRouter();
  const [profiles, setProfiles] = useState(initial.profiles);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [archived, setArchived] = useState<ArchiveView>("active");
  const [editor, setEditor] = useState<Editor>(openCreateOnLoad ? { kind: "create" } : { kind: "closed" });
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4_500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function load(next: { search?: string; type?: string; archived?: ArchiveView } = {}) {
    const values = { search: next.search ?? search, type: next.type ?? type, archived: next.archived ?? archived };
    // One full page (the API maximum, also the Pro profile limit).
    const params = new URLSearchParams({ archived: values.archived, limit: "100" });
    if (values.search) params.set("q", values.search);
    if (values.type) params.set("type", values.type);
    setLoading(true);
    try {
      const response = await fetch(`/api/profiles?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load profiles");
      setProfiles(profileListResponseSchema.parse(await response.json()).profiles);
    } catch {
      setNotice(t.refreshFailed);
    } finally {
      setLoading(false);
    }
  }

  const busy = useRef(false);

  async function mutate(profile: ProfileSummary, action: "archive" | "restore") {
    if (busy.current) return;
    busy.current = true;
    try {
      const response = await fetch(`/api/profiles/${profile.id}${action === "restore" ? "/restore" : ""}`, { method: action === "restore" ? "POST" : "DELETE" });
      if (!response.ok) {
        setNotice(await responseError(response));
        return;
      }
      setNotice(action === "restore" ? t.restored(profile.name) : t.archived(profile.name));
      await load();
    } catch {
      setNotice(t.workspaceUnreachable);
    } finally {
      busy.current = false;
    }
  }

  function closeEditor() {
    setEditor({ kind: "closed" });
    if (window.location.search) router.replace("/workspace/profiles");
  }

  const tabs: Array<{ id: string; label: string }> = [{ id: "", label: t.all }, ...profileTypeSchema.options.map((option) => ({ id: option, label: profileTypeShort[locale][option] }))];

  return (
    <section className="page">
      <PageHead
        actions={<button className="button primary large" onClick={() => setEditor({ kind: "create" })} type="button"><Plus aria-hidden size={20} />{t.createProfile}</button>}
        lead={t.lead}
        title={archived === "archived" ? t.archivedTitle : t.title}
      />
      <div className="tab-row">
        <div aria-label={t.profileType} className="tabs" role="tablist">
          {tabs.map((tab) => <button aria-selected={type === tab.id} key={tab.id || "all"} onClick={() => { setType(tab.id); void load({ type: tab.id }); }} role="tab" type="button">{tab.label}</button>)}
        </div>
        <form className="search" onSubmit={(event) => { event.preventDefault(); void load(); }} role="search">
          <MagnifyingGlass aria-hidden size={20} />
          <input aria-label={t.search} onChange={(event) => setSearch(event.target.value)} placeholder={t.search} value={search} />
        </form>
      </div>
      {profiles.length > 0 && (
        <EntityList>
          {profiles.map((profile) => <ProfileRow key={profile.id} onArchive={() => void mutate(profile, "archive")} onEdit={() => setEditor({ kind: "edit", profile })} onRestore={() => void mutate(profile, "restore")} profile={profile} />)}
        </EntityList>
      )}
      {!loading && profiles.length === 0 && (
        <div className="empty">
          <span className="mark xl"><Tray aria-hidden size={34} /></span>
          <h2>{archived === "archived" ? t.emptyArchiveTitle : t.emptyTitle}</h2>
          <p>{archived === "archived" ? t.emptyArchiveText : t.emptyText}</p>
          {archived === "active" && <button className="button primary" onClick={() => setEditor({ kind: "create" })} type="button">{t.createFirst}</button>}
        </div>
      )}
      <p style={{ marginTop: 24 }}>
        <button className="text-link" onClick={() => { const next = archived === "active" ? "archived" : "active"; setArchived(next); void load({ archived: next }); }} style={{ background: "none", border: 0, padding: 0, color: "var(--ink)" }} type="button">
          <Archive aria-hidden size={20} />{archived === "active" ? t.showArchived : t.showActive}
        </button>
      </p>
      {notice && <div className="toast" role="status">{notice}</div>}
      {editor.kind !== "closed" && (
        <ProfileEditor
          key={editor.kind === "edit" ? editor.profile.id : "create"}
          onClose={closeEditor}
          onSaved={(profile) => {
            if (editor.kind === "create") {
              router.push(`/workspace/profiles/${profile.id}`);
              return;
            }
            setEditor({ kind: "closed" });
            setNotice(t.saved(profile.name));
            void load();
          }}
          profile={editor.kind === "edit" ? editor.profile : null}
        />
      )}
    </section>
  );
}
