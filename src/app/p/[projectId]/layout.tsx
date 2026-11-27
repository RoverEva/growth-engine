import { ProjectNav } from "@/components/project-nav";
import { TopBar } from "@/components/top-bar";
import { Badge } from "@/components/ui";
import { requireProject } from "@/lib/auth";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { user, project, role } = await requireProject(projectId);
  return (
    <>
      <TopBar email={user.email} />
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{project.name}</span>
            <Badge value={role} />
          </div>
          <ProjectNav projectId={projectId} />
        </div>
      </div>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
