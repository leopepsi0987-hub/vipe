import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/hooks/useAuth";
import { ProjectSidebar } from "./ProjectSidebar";
import { Editor } from "./Editor";
import { EditorHeader } from "./EditorHeader";
import { Loader2, Sparkles, Rocket, Zap } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function Dashboard() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { t, isRTL } = useI18n();
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

  const [showingSidebar, setShowingSidebar] = useState(true);

  const handleCreateProject = async () => {
    const project = await createProject();
    if (project) {
      toast.success(t("projectCreated"));
      navigate(`/project/${project.id}`);
    }
  };

  const handleSelectProject = (project: typeof currentProject) => {
    if (project) {
      navigate(`/project/${project.id}`);
    }
  };

  const handleBackToProjects = () => {
    setShowingSidebar(true);
  };

  const handleDeleteProject = async (id: string) => {
    const success = await deleteProject(id);
    if (success) {
      toast.success(t("projectDeleted"));
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
    toast.success(t("signedOut"));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="orb orb-primary w-[400px] h-[400px] top-1/4 left-1/4 animate-float-slow opacity-30" />
          <div className="orb orb-accent w-[300px] h-[300px] bottom-1/4 right-1/4 animate-float opacity-20" />
          <div className="absolute inset-0 bg-gradient-mesh opacity-50" />
        </div>
        
        <div className="relative z-10 flex flex-col items-center gap-4 animate-pulse-glow">
          <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Loader2 className="w-8 h-8 animate-spin text-background" />
          </div>
          <p className="text-muted-foreground text-sm animate-pulse">{t("loading")}...</p>
        </div>
      </div>
    );
  }

  // Show projects list
  if (showingSidebar || !currentProject) {
    return (
      <div className={cn(
        "h-screen flex bg-background overflow-hidden relative",
        isRTL && "flex-row-reverse font-arabic"
      )} dir={isRTL ? "rtl" : "ltr"}>
        
        {/* Background effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="orb orb-primary w-[500px] h-[500px] -top-40 right-1/4 animate-float-slow opacity-20" />
          <div className="orb orb-accent w-[400px] h-[400px] bottom-1/4 left-1/3 animate-float opacity-15" />
          <div className="orb orb-secondary w-[300px] h-[300px] top-1/2 -right-20 animate-float-reverse opacity-20" />
          <div className="absolute inset-0 bg-gradient-mesh opacity-40" />
        </div>
        
        <ProjectSidebar
          projects={projects}
          currentProject={currentProject}
          onSelectProject={handleSelectProject}
          onCreateProject={handleCreateProject}
          onDeleteProject={handleDeleteProject}
          onRenameProject={handleRenameProject}
          onSignOut={handleSignOut}
        />

        <div className="flex-1 overflow-hidden relative z-10">
          <div className="h-full flex items-center justify-center p-8">
            <div className="text-center max-w-md animate-scale-pop">
              {/* Animated icon */}
              <div className="relative inline-flex mb-8">
                <div className="absolute inset-0 w-24 h-24 rounded-3xl bg-gradient-primary blur-2xl opacity-40 animate-pulse-glow" />
                <div className="relative w-24 h-24 rounded-3xl bg-gradient-primary/20 border border-primary/30 flex items-center justify-center backdrop-blur-sm">
                  <Rocket className="w-12 h-12 text-primary animate-bounce-subtle" />
                </div>
                {/* Floating sparkles */}
                <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-accent animate-pulse-glow" />
                <Zap className="absolute -bottom-1 -left-3 w-5 h-5 text-primary animate-float" style={{ animationDelay: '1s' }} />
              </div>
              
              <h2 className={cn(
                "text-3xl font-bold text-foreground mb-3 animate-slide-up",
                isRTL && "font-arabic"
              )} style={{ animationDelay: '0.1s' }}>
                {t("selectProject")}
              </h2>
              
              <p className={cn(
                "text-muted-foreground mb-6 text-lg animate-slide-up opacity-0",
                isRTL && "font-arabic"
              )} style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
                {t("selectProjectDesc")}
              </p>
              
              {/* Feature hints */}
              <div className="flex flex-wrap justify-center gap-3 animate-slide-up opacity-0" style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>
                {['AI-Powered', 'Real-time', 'Deploy Instantly'].map((feature, i) => (
                  <span 
                    key={feature}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-secondary/60 text-muted-foreground border border-border/50"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show editor with header
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