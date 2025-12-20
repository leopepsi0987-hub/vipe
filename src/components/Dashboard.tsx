import { useState } from "react";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/hooks/useAuth";
import { ProjectSidebar } from "./ProjectSidebar";
import { Editor } from "./Editor";
import { EditorHeader } from "./EditorHeader";
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
    updatePublishedProject,
  } = useProjects();

  // When in a project, hide the sidebar and show the editor with back button
  const [showingSidebar, setShowingSidebar] = useState(true);

  const handleCreateProject = async () => {
    const project = await createProject();
    if (project) {
      toast.success("Project created!");
      setShowingSidebar(false); // Go directly to editor
    }
  };

  const handleSelectProject = (project: typeof currentProject) => {
    setCurrentProject(project);
    setShowingSidebar(false); // Hide sidebar when selecting a project
  };

  const handleBackToProjects = () => {
    setShowingSidebar(true);
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

  const handlePublish = async (customSlug?: string) => {
    if (currentProject) {
      return await publishProject(currentProject.id, customSlug);
    }
    return null;
  };

  const handleUpdatePublished = async () => {
    if (currentProject) {
      return await updatePublishedProject(currentProject.id);
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

  // Show projects list
  if (showingSidebar || !currentProject) {
    return (
      <div className="h-screen flex bg-background overflow-hidden">
        <ProjectSidebar
          projects={projects}
          currentProject={currentProject}
          onSelectProject={handleSelectProject}
          onCreateProject={handleCreateProject}
          onDeleteProject={handleDeleteProject}
          onRenameProject={handleRenameProject}
          onSignOut={handleSignOut}
        />

        <div className="flex-1 overflow-hidden">
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow opacity-50">
                <span className="text-3xl">🚀</span>
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Select a project
              </h2>
              <p className="text-muted-foreground mb-4">
                Choose a project from the sidebar or create a new one
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show editor with header (no sidebar)
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <EditorHeader 
        projectName={currentProject.name}
        projectId={currentProject.id}
        onBack={handleBackToProjects} 
      />
      <div className="flex-1 overflow-hidden">
        <Editor 
          project={currentProject} 
          onUpdateCode={handleUpdateCode} 
          onPublish={handlePublish}
          onUpdatePublished={handleUpdatePublished}
        />
      </div>
    </div>
  );
}
