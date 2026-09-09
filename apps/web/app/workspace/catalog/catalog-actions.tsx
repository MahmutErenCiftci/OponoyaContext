"use client";

import { catalogLibraryAddResponseSchema, catalogStackLibraryResultSchema, catalogStackProfileResponseSchema } from "@devcontext/contracts";
import { BookOpen, Check, Plus, PlusCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { readApiError } from "../../../lib/errors";

const unreachable = "Çalışma alanına ulaşılamıyor. Lütfen tekrar dene.";

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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (resourceId) return <Link className="in-library" href={`/workspace/library?q=${encodeURIComponent(name)}`}>Kütüphanede <Check aria-hidden size={16} weight="bold" /></Link>;

  async function add() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/catalog/technologies/${encodeURIComponent(slug)}/library`, { method: "POST" });
      if (!response.ok) { setError((await readApiError(response)).message); return; }
      const result = catalogLibraryAddResponseSchema.parse(await response.json());
      onAdded(result.resource.id, result.created);
    } catch {
      setError(unreachable);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button aria-label={`${name} kütüphaneye ekle`} className={`button${primary ? " primary large" : " small"}`} disabled={pending} onClick={() => void add()} type="button">{primary && <Plus aria-hidden size={18} />}{pending ? "Ekleniyor…" : "Kütüphaneye ekle"}</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </>
  );
}

/** Detail-page action for one technology with its own status message. */
export function TechnologyActions({ slug, name, resourceId: initialResourceId }: { slug: string; name: string; resourceId: string | null }) {
  const router = useRouter();
  const [resourceId, setResourceId] = useState(initialResourceId);
  const { notice, setNotice } = useNotice();
  return (
    <div className="actions">
      <AddToLibraryButton
        name={name}
        onAdded={(id, created) => { setResourceId(id); setNotice(created ? `${name} Kütüphanene eklendi.` : `${name} zaten Kütüphanendeydi.`); router.refresh(); }}
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
      setNotice(`${name}: ${result.created.length} kaynak eklendi, ${result.existing.length} zaten Kütüphanendeydi${result.skipped.length > 0 ? `, ${result.skipped.length} henüz katalogda değil` : ""}.`);
      router.refresh();
    } catch {
      setError(unreachable);
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
      const link = <Link href={`/workspace/profiles/${result.profile.id}`}>Profili aç</Link>;
      setNotice(result.created
        ? <>“{result.profile.name}” profili {result.decisions.length} kararla oluşturuldu; {result.library.created.length} yeni kaynak Kütüphanene eklendi. {link}</>
        : <>“{result.profile.name}” adlı bir stack profili zaten var; hiçbir şey değişmedi. {link}</>);
      router.refresh();
    } catch {
      setError(unreachable);
    } finally {
      setPending(null);
    }
  }

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginTop: 26 }}>
      <button className="button primary large" disabled={pending !== null} onClick={() => void createProfile()} type="button"><PlusCircle aria-hidden size={20} />{pending === "profile" ? "Oluşturuluyor…" : "Stack profili oluştur"}</button>
      <button className="button quiet large" disabled={pending !== null} onClick={() => void addAll()} type="button"><BookOpen aria-hidden size={20} />{pending === "library" ? "Ekleniyor…" : "Tümünü kütüphaneye ekle"}</button>
      {error && <p className="form-error" role="alert" style={{ width: "100%" }}>{error}</p>}
      <Notice>{notice}</Notice>
    </div>
  );
}
