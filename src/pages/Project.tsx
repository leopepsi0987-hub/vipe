import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { AuthPage } from "@/components/AuthPage";
import { Editor } from "@/components/Editor";
import { EditorHeader } from "@/components/EditorHeader";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const Project = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const {
    projects,
    currentProject,
    setCurrentProject,
    loading: projectsLoading,
    updateProject,
    publishProject,
    updatePublishedProject,
  } = useProjects();

  // Set current project based on URL param
  useEffect(() => {
    if (!projectsLoading && projects.length > 0 && projectId) {
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        setCurrentProject(project);
      } else {
        toast.error("Project not found");
        navigate("/");
      }
    }
  }, [projectId, projects, projectsLoading, setCurrentProject, navigate]);

  if (authLoading || projectsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (!currentProject) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleBackToProjects = () => {
    navigate("/");
  };

  const handleUpdateCode = async (code: string) => {
    await updateProject(currentProject.id, { html_code: code });
  };

  const handlePublish = async (customSlug?: string, bundledHtml?: string) => {
    return await publishProject(currentProject.id, customSlug, bundledHtml);
  };

  const handleUpdatePublished = async (bundledHtml?: string) => {
    return await updatePublishedProject(currentProject.id, bundledHtml);
  };

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
};

export default Project;
