"use client";

import { catalogLibraryAddResponseSchema, catalogStackLibraryResultSchema, catalogStackProfileResponseSchema } from "@devcontext/contracts";
import { BookOpen, Check, Plus, PlusCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useLocale } from "../../../components/locale-provider";
import { readApiError } from "../../../lib/errors";
import { defineCopy } from "../../../lib/i18n";

const copy = defineCopy({
  tr: {
    unreachable: "Çalışma alanına ulaşılamıyor. Lütfen tekrar dene.",
    inLibrary: "Kütüphanede",
    addLabel: (name: string) => `${name} kütüphaneye ekle`,
    adding: "Ekleniyor…",
    addToLibrary: "Kütüphaneye ekle",
    added: (name: string) => `${name} Kütüphanene eklendi.`,
    alreadyAdded: (name: string) => `${name} zaten Kütüphanendeydi.`,
    stackAdded: (name: string, created: number, existing: number, skipped: number) => `${name}: ${created} kaynak eklendi, ${existing} zaten Kütüphanendeydi${skipped > 0 ? `, ${skipped} henüz katalogda değil` : ""}.`,
    openProfile: "Profili aç",
    profileCreated: (name: string, decisions: number, created: number) => `“${name}” profili ${decisions} kararla oluşturuldu; ${created} yeni kaynak Kütüphanene eklendi. `,
    profileExists: (name: string) => `“${name}” adlı bir stack profili zaten var; hiçbir şey değişmedi. `,
    creating: "Oluşturuluyor…",
    createProfile: "Stack profili oluştur",
    addAll: "Tümünü kütüphaneye ekle",
  },
  en: {
    unreachable: "The workspace can't be reached. Please try again.",
    inLibrary: "In Library",
    addLabel: (name: string) => `Add ${name} to the Library`,
    adding: "Adding…",
    addToLibrary: "Add to Library",
    added: (name: string) => `${name} added to your Library.`,
    alreadyAdded: (name: string) => `${name} was already in your Library.`,
    stackAdded: (name: string, created: number, existing: number, skipped: number) => `${name}: ${created} ${created === 1 ? "resource" : "resources"} added, ${existing} already in your Library${skipped > 0 ? `, ${skipped} not in the catalog yet` : ""}.`,
    openProfile: "Open profile",
    profileCreated: (name: string, decisions: number, created: number) => `Created the “${name}” profile with ${decisions} ${decisions === 1 ? "decision" : "decisions"}; ${created} new ${created === 1 ? "resource" : "resources"} added to your Library. `,
    profileExists: (name: string) => `A stack profile named “${name}” already exists; nothing changed. `,
    creating: "Creating…",
    createProfile: "Create stack profile",
    addAll: "Add all to Library",
  },
});

export function useNotice() {
  const [notice, setNotice] = useState<ReactNode>(null);
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 8_000);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  return { notice, setNotice };
}

export function Notice({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <div className="toast" role="status">{children}</div>;
}

/** Adds one catalog technology to the Library; shows the existing entry once it is there. Adding is always an explicit click. */
export function AddToLibraryButton({ slug, name, resourceId, onAdded, primary = false }: {
  slug: string;
  name: string;
  resourceId: string | null;
  onAdded(resourceId: string, created: boolean): void;
  primary?: boolean;
}) {
  const t = copy[useLocale()];
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (resourceId) return <Link className="in-library" href={`/workspace/library?q=${encodeURIComponent(name)}`}>{t.inLibrary} <Check aria-hidden size={16} weight="bold" /></Link>;

  async function add() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/catalog/technologies/${encodeURIComponent(slug)}/library`, { method: "POST" });
      if (!response.ok) { setError((await readApiError(response)).message); return; }
      const result = catalogLibraryAddResponseSchema.parse(await response.json());
      onAdded(result.resource.id, result.created);
    } catch {
      setError(t.unreachable);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button aria-label={t.addLabel(name)} className={`button${primary ? " primary large" : " small"}`} disabled={pending} onClick={() => void add()} type="button">{primary && <Plus aria-hidden size={18} />}{pending ? t.adding : t.addToLibrary}</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </>
  );
}

/** Detail-page action for one technology with its own status message. */
export function TechnologyActions({ slug, name, resourceId: initialResourceId }: { slug: string; name: string; resourceId: string | null }) {
  const t = copy[useLocale()];
  const router = useRouter();
  const [resourceId, setResourceId] = useState(initialResourceId);
  const { notice, setNotice } = useNotice();
  return (
    <div className="actions">
      <AddToLibraryButton
        name={name}
        onAdded={(id, created) => { setResourceId(id); setNotice(created ? t.added(name) : t.alreadyAdded(name)); router.refresh(); }}
        primary
        resourceId={resourceId}
        slug={slug}
      />
      <Notice>{notice}</Notice>
    </div>
  );
}

/** Stack preset actions: create a PREFERRED stack Profile (adds its technologies too) or only add the technologies. */
export function StackActions({ slug, name }: { slug: string; name: string }) {
  const t = copy[useLocale()];
  const router = useRouter();
  const [pending, setPending] = useState<"library" | "profile" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { notice, setNotice } = useNotice();

  async function addAll() {
    setPending("library");
    setError(null);
    try {
      const response = await fetch(`/api/catalog/stacks/${encodeURIComponent(slug)}/library`, { method: "POST" });
      if (!response.ok) { setError((await readApiError(response)).message); return; }
      const result = catalogStackLibraryResultSchema.parse(await response.json());
      setNotice(t.stackAdded(name, result.created.length, result.existing.length, result.skipped.length));
      router.refresh();
    } catch {
      setError(t.unreachable);
    } finally {
      setPending(null);
    }
  }

  async function createProfile() {
    setPending("profile");
    setError(null);
    try {
      const response = await fetch(`/api/catalog/stacks/${encodeURIComponent(slug)}/profile`, { method: "POST" });
      if (!response.ok) { setError((await readApiError(response)).message); return; }
      const result = catalogStackProfileResponseSchema.parse(await response.json());
      const link = <Link href={`/workspace/profiles/${result.profile.id}`}>{t.openProfile}</Link>;
      setNotice(result.created
        ? <>{t.profileCreated(result.profile.name, result.decisions.length, result.library.created.length)}{link}</>
        : <>{t.profileExists(result.profile.name)}{link}</>);
      router.refresh();
    } catch {
      setError(t.unreachable);
    } finally {
      setPending(null);
    }
  }

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginTop: 26 }}>
      <button className="button primary large" disabled={pending !== null} onClick={() => void createProfile()} type="button"><PlusCircle aria-hidden size={20} />{pending === "profile" ? t.creating : t.createProfile}</button>
      <button className="button quiet large" disabled={pending !== null} onClick={() => void addAll()} type="button"><BookOpen aria-hidden size={20} />{pending === "library" ? t.adding : t.addAll}</button>
      {error && <p className="form-error" role="alert" style={{ width: "100%" }}>{error}</p>}
      <Notice>{notice}</Notice>
    </div>
  );
}
