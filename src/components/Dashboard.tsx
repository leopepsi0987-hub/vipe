import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/hooks/useAuth";
import { ProjectSidebar } from "./ProjectSidebar";
import { Editor } from "./Editor";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function Dashboard() {
  const { signOut } = useAuth();
  const {
    projects,
    currentProject,
    setCurrentProject,
    loading,
    createProject,
    updateProject,
    deleteProject,
    publishProject,
    unpublishProject,
  } = useProjects();

  const handleCreateProject = async () => {
    const project = await createProject();
    if (project) {
      toast.success("Project created!");
    }
  };

  const handleDeleteProject = async (id: string) => {
    const success = await deleteProject(id);
    if (success) {
      toast.success("Project deleted");
    }
  };

  const handleRenameProject = async (id: string, name: string) => {
    await updateProject(id, { name });
  };

  const handleUpdateCode = async (code: string) => {
    if (currentProject) {
      await updateProject(currentProject.id, { html_code: code });
    }
  };

  const handlePublish = async () => {
    if (currentProject) {
      return await publishProject(currentProject.id);
    }
    return null;
  };

  const handleUnpublish = async () => {
    if (currentProject) {
      return await unpublishProject(currentProject.id);
    }
    return null;
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <ProjectSidebar
        projects={projects}
        currentProject={currentProject}
        onSelectProject={setCurrentProject}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        onRenameProject={handleRenameProject}
        onSignOut={handleSignOut}
      />

      <div className="flex-1 overflow-hidden">
        {currentProject ? (
          <Editor 
            project={currentProject} 
            onUpdateCode={handleUpdateCode} 
            onPublish={handlePublish}
            onUnpublish={handleUnpublish}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow opacity-50">
                <span className="text-3xl">🚀</span>
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                No project selected
              </h2>
              <p className="text-muted-foreground mb-4">
                Create a new project to get started
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
