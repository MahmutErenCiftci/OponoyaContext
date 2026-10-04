"use client";

import { Archive, ArrowCounterClockwise, ArrowRight, Blueprint, MagnifyingGlass, PencilSimple, Plus, Tray } from "@phosphor-icons/react/dist/ssr";
import { recipeListResponseSchema, recipeResponseSchema, type Recipe, type RecipeSummary } from "@devcontext/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { DrawerFrame } from "../../../components/drawer";
import { useLocale } from "../../../components/locale-provider";
import { PageHead } from "../../../components/page-heading";
import { RowMenu } from "../../../components/row-menu";
import { responseError } from "../../../lib/errors";
import { defineCopy } from "../../../lib/i18n";
import { pluralCount } from "../../../lib/resource-labels";
import { EntityList } from "../profiles/profiles-client";

type ArchiveView = "active" | "archived";
type Editor = { kind: "closed" } | { kind: "create" } | { kind: "edit"; recipe: RecipeSummary };

const copy = defineCopy({
  tr: {
    nameRequired: "Tarife bir ad ver.",
    serviceUnreachable: "Tarif hizmetine ulaşılamıyor. Tekrar dene.",
    closeEditor: "Tarif düzenleyiciyi kapat",
    cancel: "İptal",
    saving: "Kaydediliyor…",
    saveChanges: "Değişiklikleri kaydet",
    createRecipe: "Tarif oluştur",
    editRecipe: "Tarifi düzenle",
    recipeName: "Tarif adı *",
    recipeNamePlaceholder: "örn. Hızlı SaaS MVP",
    description: "Açıklama",
    descriptionPlaceholder: "Hangi projeler bu tariften başlamalı…",
    editorHelp: "Tarif; profilleri ve kendi kararlarını bir araya getirir. Projeler tarifi referansla uygular: tarifi sonradan düzenlersen onu kullanan her proje bir sonraki oluşturmada değişikliği alır.",
    archivedChip: "Arşivde",
    profiles: (count: number) => pluralCount(count, "profil"),
    decisions: (count: number) => pluralCount(count, "karar"),
    projects: (count: number) => pluralCount(count, "proje"),
    openRecipe: (name: string) => `${name} tarifini aç`,
    rowActions: (name: string) => `${name} işlemleri`,
    edit: "Düzenle",
    restore: "Geri yükle",
    archive: "Arşivle",
    refreshFailed: "Tarifler yenilenemedi.",
    restored: (name: string) => `${name} geri yüklendi.`,
    archived: (name: string) => `${name} arşivlendi. Onu kullanan projeler kararlarını devralmaya devam eder.`,
    workspaceUnreachable: "Çalışma alanına ulaşılamıyor. Tekrar dene.",
    lead: "Profillerini birleştir, yeni projelere hazır bir başlangıç ver.",
    title: "Tarifler",
    search: "Tariflerde ara",
    searchPlaceholder: "Tariflerde ara…",
    status: "Tarif durumu",
    tabActive: "Aktif",
    tabArchive: "Arşiv",
    emptyArchiveTitle: "Arşiv boş",
    emptyTitle: "Henüz tarif yok",
    emptyArchiveText: "Arşivlediğin tarifleri buradan geri yükleyebilirsin.",
    emptyText: "Sık kullandığın profilleri ve AI tercihlerini birleştirerek yeni projelerine hazır başla.",
    createFirst: "İlk tarifini oluştur",
    priorityNote: "Tarifteki öncelikler, çakışan kararların hangisinin kullanılacağını belirler.",
    saved: (name: string) => `${name} kaydedildi.`,
  },
  en: {
    nameRequired: "Give the recipe a name.",
    serviceUnreachable: "The recipe service can't be reached. Try again.",
    closeEditor: "Close the recipe editor",
    cancel: "Cancel",
    saving: "Saving…",
    saveChanges: "Save changes",
    createRecipe: "Create recipe",
    editRecipe: "Edit recipe",
    recipeName: "Recipe name *",
    recipeNamePlaceholder: "e.g. Fast SaaS MVP",
    description: "Description",
    descriptionPlaceholder: "Which projects should start from this recipe…",
    editorHelp: "A recipe brings profiles and its own decisions together. Projects apply a recipe by reference: if you edit the recipe later, every project that uses it picks up the change the next time its instructions are created.",
    archivedChip: "Archived",
    profiles: (count: number) => pluralCount(count, "profile", "profiles"),
    decisions: (count: number) => pluralCount(count, "decision", "decisions"),
    projects: (count: number) => pluralCount(count, "project", "projects"),
    openRecipe: (name: string) => `Open the ${name} recipe`,
    rowActions: (name: string) => `${name} actions`,
    edit: "Edit",
    restore: "Restore",
    archive: "Archive",
    refreshFailed: "Recipes could not be refreshed.",
    restored: (name: string) => `${name} restored.`,
    archived: (name: string) => `${name} archived. Projects that use it keep inheriting its decisions.`,
    workspaceUnreachable: "The workspace can't be reached. Try again.",
    lead: "Combine your profiles and give new projects a ready-made start.",
    title: "Recipes",
    search: "Search recipes",
    searchPlaceholder: "Search recipes…",
    status: "Recipe status",
    tabActive: "Active",
    tabArchive: "Archive",
    emptyArchiveTitle: "The archive is empty",
    emptyTitle: "No recipes yet",
    emptyArchiveText: "You can restore archived recipes from here.",
    emptyText: "Combine the profiles and AI preferences you use often, and start new projects ready to go.",
    createFirst: "Create your first recipe",
    priorityNote: "Priorities in a recipe decide which conflicting decision is used.",
    saved: (name: string) => `${name} saved.`,
  },
});

export function RecipeEditor({ recipe, onClose, onSaved }: {
  recipe: RecipeSummary | null;
  onClose(): void;
  onSaved(recipe: Recipe): void;
}) {
  const t = copy[useLocale()];
  const [name, setName] = useState(recipe?.name ?? "");
  const [description, setDescription] = useState(recipe?.description ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) { setError(t.nameRequired); return; }
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
      setError(t.serviceUnreachable);
    } finally {
      setPending(false);
    }
  }

  return (
    <DrawerFrame
      closeLabel={t.closeEditor}
      footer={<><button className="button" onClick={onClose} type="button">{t.cancel}</button><button className="button primary" disabled={pending || !name.trim()} type="submit">{pending ? t.saving : recipe ? t.saveChanges : t.createRecipe}</button></>}
      onClose={onClose}
      onSubmit={submit}
      title={recipe ? t.editRecipe : t.createRecipe}
      variant="dialog"
    >
      <label className="field"><span>{t.recipeName}</span><input data-autofocus maxLength={160} onChange={(event) => setName(event.target.value)} placeholder={t.recipeNamePlaceholder} required value={name} /></label>
      <label className="field"><span>{t.description}</span><textarea maxLength={2000} onChange={(event) => setDescription(event.target.value)} placeholder={t.descriptionPlaceholder} rows={3} value={description} /></label>
      <p className="muted small">{t.editorHelp}</p>
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
  const t = copy[useLocale()];
  const archived = Boolean(recipe.archivedAt);
  return (
    <li className={`entity-row${archived ? " archived" : ""}`}>
      <span className="mark large" style={{ color: "var(--locked)" }}><Blueprint aria-hidden size={40} weight="thin" /></span>
      <div className="grow">
        <h3><Link href={`/workspace/recipes/${recipe.id}`}>{recipe.name}</Link></h3>
        {recipe.description && <p>{recipe.description}</p>}
        {archived && <small>{t.archivedChip}</small>}
      </div>
      <span className="muted small nowrap">{t.profiles(recipe.profileCount)} · {t.decisions(recipe.decisionCount)}{recipe.projectCount > 0 ? ` · ${t.projects(recipe.projectCount)}` : ""}</span>
      <Link aria-label={t.openRecipe(recipe.name)} className="icon-button" href={`/workspace/recipes/${recipe.id}`}><ArrowRight aria-hidden size={22} /></Link>
      <RowMenu label={t.rowActions(recipe.name)}>
        {!archived && <button onClick={onEdit} type="button"><PencilSimple aria-hidden size={18} />{t.edit}</button>}
        {archived
          ? <button onClick={onRestore} type="button"><ArrowCounterClockwise aria-hidden size={18} />{t.restore}</button>
          : <button onClick={onArchive} type="button"><Archive aria-hidden size={18} />{t.archive}</button>}
      </RowMenu>
    </li>
  );
}

export function RecipesClient({ initial, openCreateOnLoad }: {
  initial: { recipes: RecipeSummary[]; total: number };
  openCreateOnLoad: boolean;
}) {
  const t = copy[useLocale()];
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
    // One full page (the API maximum, also the Pro recipe limit).
    const params = new URLSearchParams({ archived: values.archived, limit: "100" });
    if (values.search) params.set("q", values.search);
    setLoading(true);
    try {
      const response = await fetch(`/api/recipes?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load recipes");
      setRecipes(recipeListResponseSchema.parse(await response.json()).recipes);
    } catch {
      setNotice(t.refreshFailed);
    } finally {
      setLoading(false);
    }
  }

  const busy = useRef(false);

  async function mutate(recipe: RecipeSummary, action: "archive" | "restore") {
    if (busy.current) return;
    busy.current = true;
    try {
      const response = await fetch(`/api/recipes/${recipe.id}${action === "restore" ? "/restore" : ""}`, { method: action === "restore" ? "POST" : "DELETE" });
      if (!response.ok) {
        setNotice(await responseError(response));
        return;
      }
      setNotice(action === "restore" ? t.restored(recipe.name) : t.archived(recipe.name));
      await load();
    } catch {
      setNotice(t.workspaceUnreachable);
    } finally {
      busy.current = false;
    }
  }

  function closeEditor() {
    setEditor({ kind: "closed" });
    if (window.location.search) router.replace("/workspace/recipes");
  }

  return (
    <section className="page">
      <PageHead
        actions={<button className="button primary large" onClick={() => setEditor({ kind: "create" })} type="button"><Plus aria-hidden size={20} />{t.createRecipe}</button>}
        lead={t.lead}
        title={t.title}
      />
      <div className="toolbar">
        <form className="search" onSubmit={(event) => { event.preventDefault(); void load(); }} role="search" style={{ flex: "0 1 360px" }}>
          <MagnifyingGlass aria-hidden size={20} />
          <input aria-label={t.search} onChange={(event) => setSearch(event.target.value)} placeholder={t.searchPlaceholder} value={search} />
        </form>
      </div>
      <div aria-label={t.status} className="tabs" role="tablist" style={{ marginTop: 22 }}>
        <button aria-selected={archived === "active"} onClick={() => { setArchived("active"); void load({ archived: "active" }); }} role="tab" type="button">{t.tabActive}</button>
        <button aria-selected={archived === "archived"} onClick={() => { setArchived("archived"); void load({ archived: "archived" }); }} role="tab" type="button">{t.tabArchive}</button>
      </div>
      {recipes.length > 0 && (
        <EntityList>
          {recipes.map((recipe) => <RecipeRow key={recipe.id} onArchive={() => void mutate(recipe, "archive")} onEdit={() => setEditor({ kind: "edit", recipe })} onRestore={() => void mutate(recipe, "restore")} recipe={recipe} />)}
        </EntityList>
      )}
      {!loading && recipes.length === 0 && (
        <div className="empty">
          <span className="mark xl"><Tray aria-hidden size={34} /></span>
          <h2>{archived === "archived" ? t.emptyArchiveTitle : t.emptyTitle}</h2>
          <p>{archived === "archived" ? t.emptyArchiveText : t.emptyText}</p>
          {archived === "active" && <button className="button primary" onClick={() => setEditor({ kind: "create" })} type="button">{t.createFirst}</button>}
        </div>
      )}
      <p className="muted small" style={{ marginTop: 24 }}>{t.priorityNote}</p>
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
            setNotice(t.saved(recipe.name));
            void load();
          }}
          recipe={editor.kind === "edit" ? editor.recipe : null}
        />
      )}
    </section>
  );
}
