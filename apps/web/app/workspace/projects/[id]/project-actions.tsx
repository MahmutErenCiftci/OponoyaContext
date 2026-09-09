"use client";

import { Archive, ArrowCounterClockwise, Copy, FloppyDisk, PencilSimple } from "@phosphor-icons/react/dist/ssr";
import { profileTypeSchema, projectResponseSchema, saveProjectAsProfileResponseSchema, type ProfileType, type Project } from "@devcontext/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { DrawerFrame } from "../../../../components/drawer";
import { RowMenu } from "../../../../components/row-menu";
import { readApiError, responseError } from "../../../../lib/errors";
import { profileTypeDescriptions, profileTypeLabels } from "../../../../lib/resource-labels";

type Dialog = "clone" | "profile" | null;

/** Edit pencil plus the "more" menu of the project header: clone, save as profile, archive/restore. */
export function ProjectActions({ project }: { project: Project }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [cloneName, setCloneName] = useState(`${project.name} kopyası`);
  const [profileName, setProfileName] = useState(`${project.name} stack`);
  const [profileType, setProfileType] = useState<ProfileType>("stack");
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
      setError("Proje hizmetine ulaşılamıyor. Tekrar dene.");
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
      setError("Proje hizmetine ulaşılamıyor. Tekrar dene.");
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
      setError("Profil hizmetine ulaşılamıyor. Tekrar dene.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="actions">
      {!archived && <Link aria-label="Projeyi düzenle" className="icon-button bordered" href={`/workspace/projects?edit=${project.id}`} title="Projeyi düzenle"><PencilSimple aria-hidden size={20} /></Link>}
      <RowMenu label="Diğer işlemler">
        <button disabled={pending !== null} onClick={() => openDialog("clone")} type="button"><Copy aria-hidden size={18} />Kopyala</button>
        <button disabled={pending !== null} onClick={() => openDialog("profile")} type="button"><FloppyDisk aria-hidden size={18} />Profil olarak kaydet</button>
        {archived
          ? <button disabled={pending !== null} onClick={() => void run("restore")} type="button"><ArrowCounterClockwise aria-hidden size={18} />{pending === "restore" ? "Geri yükleniyor…" : "Projeyi geri yükle"}</button>
          : <button disabled={pending !== null} onClick={() => void run("archive")} type="button"><Archive aria-hidden size={18} />{pending === "archive" ? "Arşivleniyor…" : "Projeyi arşivle"}</button>}
      </RowMenu>
      {error && !dialog && <p className="form-error" role="alert">{error}</p>}
      {dialog === "clone" && (
        <DrawerFrame
          footer={<><button className="button" onClick={() => setDialog(null)} type="button">Vazgeç</button><button className="button primary" disabled={pending !== null || !cloneName.trim()} type="submit">{pending === "clone" ? "Kopyalanıyor…" : "Projeyi kopyala"}</button></>}
          onClose={() => setDialog(null)}
          onSubmit={clone}
          title={`${project.name} projesini kopyala`}
          variant="dialog"
        >
          <p className="muted small">Kopya; proje bilgilerini, kuralları, bağlı kaynakları, profilleri ve tüm proje kararlarını alır. Sürüm geçmişi ve dışa aktarımlar sıfırdan başlar.</p>
          <label className="field"><span>Kopyanın adı *</span><input data-autofocus maxLength={160} onChange={(event) => setCloneName(event.target.value)} required value={cloneName} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
        </DrawerFrame>
      )}
      {dialog === "profile" && (
        <DrawerFrame
          footer={<><button className="button" onClick={() => setDialog(null)} type="button">Vazgeç</button><button className="button primary" disabled={pending !== null || !profileName.trim()} type="submit">{pending === "profile" ? "Kaydediliyor…" : "Profil oluştur"}</button></>}
          onClose={() => setDialog(null)}
          onSubmit={saveAsProfile}
          title="Kararları profil olarak kaydet"
          variant="dialog"
        >
          <p className="muted small">Yalnızca bu projenin kendi kararları kopyalanır; profil ve Kütüphane’den devralınan kurallar yerinde kalır. Yeni profil her projeye bağlanabilir.</p>
          <label className="field"><span>Profil adı *</span><input data-autofocus maxLength={160} onChange={(event) => setProfileName(event.target.value)} required value={profileName} /></label>
          <fieldset style={{ border: 0, margin: 0, padding: 0, display: "grid", gap: 10 }}>
            <legend className="field-label">Profil türü *</legend>
            <div className="radio-grid">
              {profileTypeSchema.options.map((option) => (
                <label className={`radio-card${profileType === option ? " selected" : ""}`} key={option}>
                  <input checked={profileType === option} name="save-profile-type" onChange={() => setProfileType(option)} type="radio" value={option} />
                  <strong>{profileTypeLabels[option]}</strong>
                  <span>{profileTypeDescriptions[option]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {error && <p className="form-error" role="alert">{error}</p>}
        </DrawerFrame>
      )}
    </div>
  );
}
