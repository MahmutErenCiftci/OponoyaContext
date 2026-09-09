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
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { DrawerFrame } from "../../../components/drawer";
import { PageHead } from "../../../components/page-heading";
import { RowMenu } from "../../../components/row-menu";
import { responseError } from "../../../lib/errors";
import { formatDate, pluralCount, profileTypeDescriptions, profileTypeLabels } from "../../../lib/resource-labels";

type ArchiveView = "active" | "archived";
type Editor = { kind: "closed" } | { kind: "create" } | { kind: "edit"; profile: ProfileSummary };

/** Short type names used in tabs and row labels. */
export const profileTypeShort: Record<ProfileType, string> = { stack: "Stack", design: "Tasarım", ai: "AI", deployment: "Dağıtım" };

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
  const [name, setName] = useState(profile?.name ?? "");
  const [type, setType] = useState<ProfileType>(profile?.type ?? "stack");
  const [description, setDescription] = useState(profile?.description ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) { setError("Profile bir ad ver."); return; }
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
      setError("Profil hizmetine ulaşılamıyor. Tekrar dene.");
    } finally {
      setPending(false);
    }
  }

  return (
    <DrawerFrame
      closeLabel="Profil düzenleyiciyi kapat"
      footer={<><button className="button" onClick={onClose} type="button">İptal</button><button className="button primary" disabled={pending || !name.trim()} type="submit">{pending ? "Kaydediliyor…" : profile ? "Değişiklikleri kaydet" : "Profil oluştur"}</button></>}
      onClose={onClose}
      onSubmit={submit}
      title={profile ? "Profili düzenle" : "Profil oluştur"}
      variant="dialog"
    >
      <label className="field"><span>Profil adı *</span><input data-autofocus maxLength={160} onChange={(event) => setName(event.target.value)} placeholder="örn. SaaS başlangıcı" required value={name} /></label>
      <fieldset style={{ border: 0, margin: 0, padding: 0, display: "grid", gap: 10 }}>
        <legend className="field-label">Profil türü *</legend>
        <div className="radio-grid">
          {profileTypeSchema.options.map((option) => (
            <label className={`radio-card${type === option ? " selected" : ""}`} key={option}>
              <input checked={type === option} name="profile-type" onChange={() => setType(option)} type="radio" value={option} />
              <strong>{profileTypeLabels[option]}</strong>
              <span>{profileTypeDescriptions[option]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field"><span>Açıklama</span><textarea maxLength={2000} onChange={(event) => setDescription(event.target.value)} placeholder="Bu profile ne zaman başvurulur…" rows={3} value={description} /></label>
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
  const archived = Boolean(profile.archivedAt);
  return (
    <li className={`entity-row${archived ? " archived" : ""}`}>
      <span className={`mark large tone profile-${profile.type}`}><ProfileIcon type={profile.type} /></span>
      <div className="grow">
        <h3><Link href={`/workspace/profiles/${profile.id}`}>{profile.name}</Link></h3>
        <small>{profileTypeShort[profile.type]} · {pluralCount(profile.decisionCount, "karar")}{profile.projectCount > 0 ? ` · ${pluralCount(profile.projectCount, "proje")}` : ""}{archived ? " · Arşivde" : ""}</small>
        {profile.description && <p>{profile.description}</p>}
      </div>
      <span className="muted small nowrap">Güncellendi {formatDate(profile.updatedAt)}</span>
      <Link aria-label={`${profile.name} profilini aç`} className="icon-button" href={`/workspace/profiles/${profile.id}`}><ArrowRight aria-hidden size={22} /></Link>
      <RowMenu label={`${profile.name} işlemleri`}>
        {!archived && <button onClick={onEdit} type="button"><PencilSimple aria-hidden size={18} />Düzenle</button>}
        {archived
          ? <button onClick={onRestore} type="button"><ArrowCounterClockwise aria-hidden size={18} />Geri yükle</button>
          : <button onClick={onArchive} type="button"><Archive aria-hidden size={18} />Arşivle</button>}
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
    const params = new URLSearchParams({ archived: values.archived });
    if (values.search) params.set("q", values.search);
    if (values.type) params.set("type", values.type);
    setLoading(true);
    try {
      const response = await fetch(`/api/profiles?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load profiles");
      setProfiles(profileListResponseSchema.parse(await response.json()).profiles);
    } catch {
      setNotice("Profiller yenilenemedi.");
    } finally {
      setLoading(false);
    }
  }

  async function mutate(profile: ProfileSummary, action: "archive" | "restore") {
    const response = await fetch(`/api/profiles/${profile.id}${action === "restore" ? "/restore" : ""}`, { method: action === "restore" ? "POST" : "DELETE" });
    if (!response.ok) {
      setNotice(await responseError(response));
      return;
    }
    setNotice(action === "restore" ? `${profile.name} geri yüklendi.` : `${profile.name} arşivlendi. Onu kullanan projeler kararlarını korur.`);
    await load();
  }

  function closeEditor() {
    setEditor({ kind: "closed" });
    if (window.location.search) router.replace("/workspace/profiles");
  }

  const tabs: Array<{ id: string; label: string }> = [{ id: "", label: "Tümü" }, ...profileTypeSchema.options.map((option) => ({ id: option, label: profileTypeShort[option] }))];

  return (
    <section className="page">
      <PageHead
        actions={<button className="button primary large" onClick={() => setEditor({ kind: "create" })} type="button"><Plus aria-hidden size={20} />Profil oluştur</button>}
        lead="Teknoloji, tasarım ve AI tercihlerini tekrar kullan."
        title={archived === "archived" ? "Arşivlenmiş profiller" : "Profiller"}
      />
      <div className="tab-row">
        <div aria-label="Profil türü" className="tabs" role="tablist">
          {tabs.map((tab) => <button aria-selected={type === tab.id} key={tab.id || "all"} onClick={() => { setType(tab.id); void load({ type: tab.id }); }} role="tab" type="button">{tab.label}</button>)}
        </div>
        <form className="search" onSubmit={(event) => { event.preventDefault(); void load(); }} role="search">
          <MagnifyingGlass aria-hidden size={20} />
          <input aria-label="Profillerde ara" onChange={(event) => setSearch(event.target.value)} placeholder="Profillerde ara" value={search} />
        </form>
      </div>
      {profiles.length > 0 && (
        <EntityList>
          {profiles.map((profile) => <ProfileRow key={profile.id} onArchive={() => void mutate(profile, "archive")} onEdit={() => setEditor({ kind: "edit", profile })} onRestore={() => void mutate(profile, "restore")} profile={profile} />)}
        </EntityList>
      )}
      {!loading && profiles.length === 0 && (
        <div className="empty">
          <span className="mark xl"><Tray size={34} /></span>
          <h2>{archived === "archived" ? "Arşiv boş" : "Henüz profil yok"}</h2>
          <p>{archived === "archived" ? "Arşivlediğin profilleri buradan geri yükleyebilirsin." : "Bir profil oluştur ve kararlarını uygun tüm projelerinde yeniden kullan."}</p>
          {archived === "active" && <button className="button primary" onClick={() => setEditor({ kind: "create" })} type="button">İlk profilini oluştur</button>}
        </div>
      )}
      <p style={{ marginTop: 24 }}>
        <button className="text-link" onClick={() => { const next = archived === "active" ? "archived" : "active"; setArchived(next); void load({ archived: next }); }} style={{ background: "none", border: 0, padding: 0, color: "var(--ink)" }} type="button">
          <Archive aria-hidden size={20} />{archived === "active" ? "Arşivlenmiş profiller" : "Aktif profiller"}
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
            setNotice(`${profile.name} kaydedildi.`);
            void load();
          }}
          profile={editor.kind === "edit" ? editor.profile : null}
        />
      )}
    </section>
  );
}
