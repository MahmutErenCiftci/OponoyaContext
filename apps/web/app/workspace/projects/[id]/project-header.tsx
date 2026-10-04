import type { Project } from "@devcontext/contracts";
import Link from "next/link";
import { Breadcrumb } from "../../../../components/page-heading";
import { ContextStatusLabel } from "../../../../components/status-label";
import type { ContextStatus } from "../../../../lib/context-status";
import { defineCopy } from "../../../../lib/i18n";
import { getLocale } from "../../../../lib/locale-server";
import { stageLabels } from "../../../../lib/resource-labels";
import { ProjectActions } from "./project-actions";

export type ProjectSection = "overview" | "stack" | "context";

const tabs: Array<{ id: ProjectSection; suffix: string }> = [
  { id: "overview", suffix: "" },
  { id: "stack", suffix: "/stack" },
  { id: "context", suffix: "/context" },
];

const copy = defineCopy({
  tr: {
    tabs: { overview: "Genel bakış", stack: "Teknoloji yığını", context: "AI talimatları" } as Record<ProjectSection, string>,
    projects: "Projeler",
    archived: "Arşivlendi",
    lead: "Kararlarını gözden geçir, AI talimatlarını dışa aktar.",
    archivedNote: "Bu proje arşivde. Düzenlemeye devam etmek için geri yükle; bağlı hiçbir kayıt silinmedi.",
    sections: "Proje bölümleri",
  },
  en: {
    tabs: { overview: "Overview", stack: "Tech stack", context: "AI instructions" },
    projects: "Projects",
    archived: "Archived",
    lead: "Review your decisions and export the AI instructions.",
    archivedNote: "This project is archived. Restore it to keep editing; no attached record was deleted.",
    sections: "Project sections",
  },
});

/**
 * Shared project header: breadcrumb, name with product/stage chips, the
 * context freshness (when the page knows it), edit + more actions and the
 * three section tabs. Every tab is a real route.
 */
export async function ProjectHeader({ project, active, status, lead }: { project: Project; active: ProjectSection; status?: ContextStatus | null; lead?: string }) {
  const locale = await getLocale();
  const t = copy[locale];
  const archived = project.status === "archived";
  return (
    <>
      <Breadcrumb items={[{ label: t.projects, href: "/workspace/projects" }, { label: project.name }]} />
      <div className="project-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title">
            {project.name}
            {project.productType && <span className="chip">{project.productType}</span>}
            {active === "overview" && <span className={`chip stage stage-${project.stage}`}>{stageLabels[locale][project.stage]}</span>}
            {archived && <span className="chip">{t.archived}</span>}
          </h1>
          <p className="lead">{lead ?? project.description ?? t.lead}</p>
        </div>
        <div className="actions">
          {status && active !== "overview" && <ContextStatusLabel kind={status.kind} version={status.version} />}
          <ProjectActions project={project} />
        </div>
      </div>
      {archived && <p className="note warning" role="status" style={{ marginTop: 16 }}>{t.archivedNote}</p>}
      <nav aria-label={t.sections} className="tabs project-tabs">
        {tabs.map((tab) => (
          <Link aria-current={tab.id === active ? "page" : undefined} href={`/workspace/projects/${project.id}${tab.suffix}`} key={tab.id}>
            {t.tabs[tab.id]}
          </Link>
        ))}
      </nav>
    </>
  );
}
