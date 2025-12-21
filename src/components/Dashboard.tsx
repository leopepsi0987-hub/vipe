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
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: 'hsl(260 30% 4%)' }}>
        {/* Background orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="orb orb-purple w-[500px] h-[500px] top-1/4 left-1/4 animate-float-slow opacity-40" />
          <div className="orb orb-gold w-[400px] h-[400px] bottom-1/4 right-1/4 animate-float opacity-30" />
        </div>
        
        <div className="relative z-10 flex flex-col items-center gap-6 animate-scale-in">
          <div className="relative">
            <div className="absolute inset-0 w-20 h-20 rounded-2xl bg-gradient-primary blur-2xl opacity-60 animate-pulse-glow" />
            <div className="absolute w-20 h-20 rounded-2xl border-2 border-primary/30 animate-ripple" />
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow animate-energy-pulse">
              <Loader2 className="w-10 h-10 animate-spin text-white" />
            </div>
          </div>
          <p className="text-muted-foreground text-sm font-light animate-pulse">{t("loading")}...</p>
        </div>
      </div>
    );
  }

  // Show projects list
  if (showingSidebar || !currentProject) {
    return (
      <div className={cn(
        "h-screen flex overflow-hidden relative",
        isRTL && "flex-row-reverse font-arabic"
      )} dir={isRTL ? "rtl" : "ltr"} style={{ background: 'hsl(260 30% 4%)' }}>
        
        {/* Background orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="orb orb-purple w-[600px] h-[600px] -top-48 right-1/4 animate-float-slow opacity-30" />
          <div className="orb orb-gold w-[500px] h-[500px] bottom-1/4 left-1/3 animate-float opacity-25" />
          <div className="orb orb-pink w-[400px] h-[400px] top-1/2 -right-32 animate-float-slow opacity-20" style={{ animationDelay: '3s' }} />
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
            <div className="text-center max-w-lg">
              {/* Animated icon */}
              <div className="relative inline-flex mb-10 animate-scale-in">
                {/* Glow */}
                <div className="absolute w-32 h-32 rounded-3xl bg-gradient-primary blur-3xl opacity-40 animate-pulse-glow" />
                
                {/* Icon container */}
                <div className="relative w-28 h-28 rounded-3xl glass-card flex items-center justify-center animate-energy-pulse">
                  <Rocket className="w-14 h-14 text-primary animate-bounce-soft" />
                </div>
                
                {/* Floating decorations */}
                <Sparkles className="absolute -top-3 -right-3 w-7 h-7 text-accent animate-pulse-glow" />
                <Zap className="absolute -bottom-2 -left-4 w-6 h-6 text-primary animate-float" style={{ animationDelay: '1s' }} />
              </div>
              
              <h2 className={cn(
                "text-4xl font-bold text-foreground mb-4 animate-slide-up opacity-0",
                isRTL && "font-arabic"
              )} style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}>
                {t("selectProject")}
              </h2>
              
              <p className={cn(
                "text-muted-foreground mb-8 text-lg font-light animate-slide-up opacity-0",
                isRTL && "font-arabic"
              )} style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
                {t("selectProjectDesc")}
              </p>
              
              {/* Feature badges */}
              <div className="flex flex-wrap justify-center gap-3 animate-slide-up opacity-0" style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>
                {[
                  { text: 'AI-Powered', color: 'primary' },
                  { text: 'Real-time', color: 'accent' },
                  { text: 'Deploy Instantly', color: 'primary' }
                ].map((badge, i) => (
                  <span 
                    key={badge.text}
                    className={cn(
                      "px-4 py-2 rounded-full text-xs font-medium glass-button",
                      badge.color === 'accent' ? 'text-accent border-accent/20' : 'text-primary border-primary/20'
                    )}
                  >
                    {badge.text}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show editor
  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'hsl(260 30% 4%)' }}>
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