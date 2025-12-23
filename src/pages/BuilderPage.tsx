import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/MainLayout";
import { useProjects } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Plus,
  FolderOpen,
  Trash2,
  MoreVertical,
  Clock,
  Globe,
  Loader2,
  Sparkles,
  Rocket,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export default function BuilderPage() {
  const navigate = useNavigate();
  const { projects, loading, createProject, deleteProject } = useProjects();

  const handleCreateProject = async () => {
    const project = await createProject();
    if (project) {
      toast.success("Project created!");
      navigate(`/project/${project.id}`);
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await deleteProject(id);
    if (success) {
      toast.success("Project deleted");
    }
  };

  const handleOpenProject = (id: string) => {
    navigate(`/project/${id}`);
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Rocket className="w-8 h-8 text-primary" />
              Builder
            </h1>
            <p className="text-muted-foreground mt-1">
              Create and manage your AI-powered applications
            </p>
          </div>
          
          <Button
            onClick={handleCreateProject}
            className="bg-gradient-primary shadow-glow"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </div>

        {/* Projects Grid */}
        {projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-muted/30 mb-6">
              <FolderOpen className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">No projects yet</h2>
            <p className="text-muted-foreground mb-6">Create your first project to get started</p>
            <Button onClick={handleCreateProject} className="bg-gradient-primary">
              <Sparkles className="w-4 h-4 mr-2" />
              Create First Project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* New Project Card */}
            <button
              onClick={handleCreateProject}
              className="glass-card rounded-xl p-6 border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center justify-center min-h-[200px] group"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Plus className="w-6 h-6 text-primary" />
              </div>
              <span className="font-medium text-foreground">New Project</span>
              <span className="text-sm text-muted-foreground">Start building with AI</span>
            </button>

            {/* Project Cards */}
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => handleOpenProject(project.id)}
                className="glass-card rounded-xl p-6 cursor-pointer hover:bg-muted/30 transition-colors relative group"
              >
                {/* Status Badge */}
                {project.is_published && (
                  <div className="absolute top-4 right-12 flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs">
                    <Globe className="w-3 h-3" />
                    Published
                  </div>
                )}

                {/* Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onClick={(e) => handleDeleteProject(project.id, e as any)}
                      className="text-red-400"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Preview */}
                <div className="w-full h-32 rounded-lg bg-muted/30 mb-4 overflow-hidden">
                  {project.html_code && (
                    <iframe
                      srcDoc={project.html_code}
                      className="w-full h-full pointer-events-none"
                      sandbox=""
                    />
                  )}
                </div>

                {/* Info */}
                <h3 className="font-semibold text-foreground truncate">{project.name}</h3>
                <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {new Date(project.updated_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
