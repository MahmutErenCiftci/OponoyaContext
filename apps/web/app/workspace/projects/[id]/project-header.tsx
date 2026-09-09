import type { Project } from "@devcontext/contracts";
import Link from "next/link";
import { Breadcrumb } from "../../../../components/page-heading";
import { ContextStatusLabel } from "../../../../components/status-label";
import type { ContextStatus } from "../../../../lib/context-status";
import { stageLabels } from "../../../../lib/resource-labels";
import { ProjectActions } from "./project-actions";

export type ProjectSection = "overview" | "stack" | "context";

const tabs: Array<{ id: ProjectSection; label: string; suffix: string }> = [
  { id: "overview", label: "Genel bakış", suffix: "" },
  { id: "stack", label: "Teknoloji yığını", suffix: "/stack" },
  { id: "context", label: "AI talimatları", suffix: "/context" },
];

/**
 * Shared project header: breadcrumb, name with product/stage chips, the
 * context freshness (when the page knows it), edit + more actions and the
 * three section tabs. Every tab is a real route.
 */
export function ProjectHeader({ project, active, status, lead }: { project: Project; active: ProjectSection; status?: ContextStatus | null; lead?: string }) {
  const archived = project.status === "archived";
  return (
    <>
      <Breadcrumb items={[{ label: "Projeler", href: "/workspace/projects" }, { label: project.name }]} />
      <div className="project-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title">
            {project.name}
            {project.productType && <span className="chip">{project.productType}</span>}
            {active === "overview" && <span className={`chip stage stage-${project.stage}`}>{stageLabels[project.stage]}</span>}
            {archived && <span className="chip">Arşivlendi</span>}
          </h1>
          <p className="lead">{lead ?? project.description ?? "Kararlarını gözden geçir, AI talimatlarını dışa aktar."}</p>
        </div>
        <div className="actions">
          {status && active !== "overview" && <ContextStatusLabel kind={status.kind} version={status.version} />}
          <ProjectActions project={project} />
        </div>
      </div>
      {archived && <p className="note warning" role="status" style={{ marginTop: 16 }}>Bu proje arşivde. Düzenlemeye devam etmek için geri yükle; bağlı hiçbir kayıt silinmedi.</p>}
      <nav aria-label="Proje bölümleri" className="tabs project-tabs">
        {tabs.map((tab) => (
          <Link aria-current={tab.id === active ? "page" : undefined} href={`/workspace/projects/${project.id}${tab.suffix}`} key={tab.id}>
            {tab.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
