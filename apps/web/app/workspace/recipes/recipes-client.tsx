"use client";

import { Archive, ArrowCounterClockwise, ArrowRight, Blueprint, MagnifyingGlass, PencilSimple, Plus, Tray } from "@phosphor-icons/react/dist/ssr";
import { recipeListResponseSchema, recipeResponseSchema, type Recipe, type RecipeSummary } from "@devcontext/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { DrawerFrame } from "../../../components/drawer";
import { PageHead } from "../../../components/page-heading";
import { RowMenu } from "../../../components/row-menu";
import { responseError } from "../../../lib/errors";
import { pluralCount } from "../../../lib/resource-labels";
import { EntityList } from "../profiles/profiles-client";

type ArchiveView = "active" | "archived";
type Editor = { kind: "closed" } | { kind: "create" } | { kind: "edit"; recipe: RecipeSummary };

export function RecipeEditor({ recipe, onClose, onSaved }: {
  recipe: RecipeSummary | null;
  onClose(): void;
  onSaved(recipe: Recipe): void;
}) {
  const [name, setName] = useState(recipe?.name ?? "");
  const [description, setDescription] = useState(recipe?.description ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) { setError("Tarife bir ad ver."); return; }
    setPending(true);
    setError(null);
    const payload = recipe
      ? { name: name.trim(), description: description.trim() || null }
      : { name: name.trim(), ...(description.trim() ? { description: description.trim() } : {}) };
    try {
      const response = await fetch(recipe ? `/api/recipes/${recipe.id}` : "/api/recipes", {
        method: recipe ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setError(await responseError(response));
        return;
      }
      onSaved(recipeResponseSchema.parse(await response.json()).recipe);
    } catch {
      setError("Tarif hizmetine ulaşılamıyor. Tekrar dene.");
    } finally {
      setPending(false);
    }
  }

  return (
    <DrawerFrame
      closeLabel="Tarif düzenleyiciyi kapat"
      footer={<><button className="button" onClick={onClose} type="button">İptal</button><button className="button primary" disabled={pending || !name.trim()} type="submit">{pending ? "Kaydediliyor…" : recipe ? "Değişiklikleri kaydet" : "Tarif oluştur"}</button></>}
      onClose={onClose}
      onSubmit={submit}
      title={recipe ? "Tarifi düzenle" : "Tarif oluştur"}
      variant="dialog"
    >
      <label className="field"><span>Tarif adı *</span><input data-autofocus maxLength={160} onChange={(event) => setName(event.target.value)} placeholder="örn. Hızlı SaaS MVP" required value={name} /></label>
      <label className="field"><span>Açıklama</span><textarea maxLength={2000} onChange={(event) => setDescription(event.target.value)} placeholder="Hangi projeler bu tariften başlamalı…" rows={3} value={description} /></label>
      <p className="muted small">Tarif; profilleri ve kendi kararlarını bir araya getirir. Projeler tarifi referansla uygular: tarifi sonradan düzenlersen onu kullanan her proje bir sonraki oluşturmada değişikliği alır.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
    </DrawerFrame>
  );
}

function RecipeRow({ recipe, onEdit, onArchive, onRestore }: {
  recipe: RecipeSummary;
  onEdit(): void;
  onArchive(): void;
  onRestore(): void;
}) {
  const archived = Boolean(recipe.archivedAt);
  return (
    <li className={`entity-row${archived ? " archived" : ""}`}>
      <span className="mark large" style={{ color: "var(--locked)" }}><Blueprint aria-hidden size={40} weight="thin" /></span>
      <div className="grow">
        <h3><Link href={`/workspace/recipes/${recipe.id}`}>{recipe.name}</Link></h3>
        {recipe.description && <p>{recipe.description}</p>}
        {archived && <small>Arşivde</small>}
      </div>
      <span className="muted small nowrap">{pluralCount(recipe.profileCount, "profil")} · {pluralCount(recipe.decisionCount, "karar")}{recipe.projectCount > 0 ? ` · ${pluralCount(recipe.projectCount, "proje")}` : ""}</span>
      <Link aria-label={`${recipe.name} tarifini aç`} className="icon-button" href={`/workspace/recipes/${recipe.id}`}><ArrowRight aria-hidden size={22} /></Link>
      <RowMenu label={`${recipe.name} işlemleri`}>
        {!archived && <button onClick={onEdit} type="button"><PencilSimple aria-hidden size={18} />Düzenle</button>}
        {archived
          ? <button onClick={onRestore} type="button"><ArrowCounterClockwise aria-hidden size={18} />Geri yükle</button>
          : <button onClick={onArchive} type="button"><Archive aria-hidden size={18} />Arşivle</button>}
      </RowMenu>
    </li>
  );
}

export function RecipesClient({ initial, openCreateOnLoad }: {
  initial: { recipes: RecipeSummary[]; total: number };
  openCreateOnLoad: boolean;
}) {
  const router = useRouter();
  const [recipes, setRecipes] = useState(initial.recipes);
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState<ArchiveView>("active");
  const [editor, setEditor] = useState<Editor>(openCreateOnLoad ? { kind: "create" } : { kind: "closed" });
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4_500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function load(next: { search?: string; archived?: ArchiveView } = {}) {
    const values = { search: next.search ?? search, archived: next.archived ?? archived };
    const params = new URLSearchParams({ archived: values.archived });
    if (values.search) params.set("q", values.search);
    setLoading(true);
    try {
      const response = await fetch(`/api/recipes?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load recipes");
      setRecipes(recipeListResponseSchema.parse(await response.json()).recipes);
    } catch {
      setNotice("Tarifler yenilenemedi.");
    } finally {
      setLoading(false);
    }
  }

  async function mutate(recipe: RecipeSummary, action: "archive" | "restore") {
    const response = await fetch(`/api/recipes/${recipe.id}${action === "restore" ? "/restore" : ""}`, { method: action === "restore" ? "POST" : "DELETE" });
    if (!response.ok) {
      setNotice(await responseError(response));
      return;
    }
    setNotice(action === "restore" ? `${recipe.name} geri yüklendi.` : `${recipe.name} arşivlendi. Onu kullanan projeler kararlarını devralmaya devam eder.`);
    await load();
  }

  function closeEditor() {
    setEditor({ kind: "closed" });
    if (window.location.search) router.replace("/workspace/recipes");
  }

  return (
    <section className="page">
      <PageHead
        actions={<button className="button primary large" onClick={() => setEditor({ kind: "create" })} type="button"><Plus aria-hidden size={20} />Tarif oluştur</button>}
        lead="Profillerini birleştir, yeni projelere hazır bir başlangıç ver."
        title="Tarifler"
      />
      <div className="toolbar">
        <form className="search" onSubmit={(event) => { event.preventDefault(); void load(); }} role="search" style={{ flex: "0 1 360px" }}>
          <MagnifyingGlass aria-hidden size={20} />
          <input aria-label="Tariflerde ara" onChange={(event) => setSearch(event.target.value)} placeholder="Tariflerde ara…" value={search} />
        </form>
      </div>
      <div aria-label="Tarif durumu" className="tabs" role="tablist" style={{ marginTop: 22 }}>
        <button aria-selected={archived === "active"} onClick={() => { setArchived("active"); void load({ archived: "active" }); }} role="tab" type="button">Aktif</button>
        <button aria-selected={archived === "archived"} onClick={() => { setArchived("archived"); void load({ archived: "archived" }); }} role="tab" type="button">Arşiv</button>
      </div>
      {recipes.length > 0 && (
        <EntityList>
          {recipes.map((recipe) => <RecipeRow key={recipe.id} onArchive={() => void mutate(recipe, "archive")} onEdit={() => setEditor({ kind: "edit", recipe })} onRestore={() => void mutate(recipe, "restore")} recipe={recipe} />)}
        </EntityList>
      )}
      {!loading && recipes.length === 0 && (
        <div className="empty">
          <span className="mark xl"><Tray size={34} /></span>
          <h2>{archived === "archived" ? "Arşiv boş" : "Henüz tarif yok"}</h2>
          <p>{archived === "archived" ? "Arşivlediğin tarifleri buradan geri yükleyebilirsin." : "Sık kullandığın profilleri ve AI tercihlerini birleştirerek yeni projelerine hazır başla."}</p>
          {archived === "active" && <button className="button primary" onClick={() => setEditor({ kind: "create" })} type="button">İlk tarifini oluştur</button>}
        </div>
      )}
      <p className="muted small" style={{ marginTop: 24 }}>Tarifteki öncelikler, çakışan kararların hangisinin kullanılacağını belirler.</p>
      {notice && <div className="toast" role="status">{notice}</div>}
      {editor.kind !== "closed" && (
        <RecipeEditor
          key={editor.kind === "edit" ? editor.recipe.id : "create"}
          onClose={closeEditor}
          onSaved={(recipe) => {
            if (editor.kind === "create") {
              router.push(`/workspace/recipes/${recipe.id}`);
              return;
            }
            setEditor({ kind: "closed" });
            setNotice(`${recipe.name} kaydedildi.`);
            void load();
          }}
          recipe={editor.kind === "edit" ? editor.recipe : null}
        />
      )}
    </section>
  );
}
