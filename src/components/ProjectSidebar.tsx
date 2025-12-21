import { useState } from "react";
import { Project } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Plus,
  Folder,
  MoreVertical,
  Trash2,
  Edit2,
  Check,
  X,
  Zap,
  LogOut,
  Sparkles,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n, LanguageToggle } from "@/lib/i18n";

interface ProjectSidebarProps {
  projects: Project[];
  currentProject: Project | null;
  onSelectProject: (project: Project) => void;
  onCreateProject: () => void;
  onDeleteProject: (id: string) => void;
  onRenameProject: (id: string, name: string) => void;
  onSignOut: () => void;
}

export function ProjectSidebar({
  projects,
  currentProject,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onRenameProject,
  onSignOut,
}: ProjectSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const { t, isRTL } = useI18n();

  const startEditing = (project: Project) => {
    setEditingId(project.id);
    setEditName(project.name);
  };

  const saveEdit = () => {
    if (editingId && editName.trim()) {
      onRenameProject(editingId, editName.trim());
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  return (
    <div className={cn(
      "w-72 h-full flex flex-col bg-sidebar/80 backdrop-blur-xl border-sidebar-border relative overflow-hidden",
      isRTL ? "border-l font-arabic" : "border-r"
    )} dir={isRTL ? "rtl" : "ltr"}>
      
      {/* Background glow */}
      <div className="absolute -top-20 -left-20 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
      
      {/* Header */}
      <div className="p-5 border-b border-sidebar-border/50 relative z-10">
        <div className={cn(
          "flex items-center gap-3 animate-slide-in",
          isRTL && "flex-row-reverse"
        )}>
          <div className="relative group">
            <div className="absolute inset-0 w-10 h-10 rounded-xl bg-gradient-primary blur-lg opacity-50 group-hover:opacity-80 transition-opacity" />
            <div className="relative w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow hover-scale cursor-pointer">
              <Zap className="w-5 h-5 text-background" />
            </div>
          </div>
          <span className="text-xl font-bold text-gradient">Vipe</span>
        </div>
      </div>

      {/* Language Toggle */}
      <div className="px-4 py-3 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <LanguageToggle className="w-full" />
      </div>

      {/* New Project Button */}
      <div className="px-4 pb-2 animate-fade-in" style={{ animationDelay: '0.15s' }}>
        <Button
          onClick={onCreateProject}
          className="w-full h-11 rounded-xl bg-gradient-primary text-background font-medium hover:opacity-90 transition-all shadow-glow/50 hover-lift group relative overflow-hidden"
        >
          <div className="absolute inset-0 animate-shimmer opacity-20" />
          <Plus className={cn("w-4 h-4 relative z-10", isRTL ? "ml-2" : "mr-2")} />
          <span className="relative z-10">{t("newProject")}</span>
          <Sparkles className={cn("w-4 h-4 relative z-10 opacity-0 group-hover:opacity-100 transition-opacity", isRTL ? "mr-2" : "ml-2")} />
        </Button>
      </div>

      {/* Projects List */}
      <div className="flex-1 overflow-y-auto p-3 relative z-10">
        <div className={cn(
          "flex items-center justify-between px-2 py-2 mb-2",
          isRTL && "flex-row-reverse"
        )}>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t("projects")}
          </span>
          <span className="text-xs text-muted-foreground/60 bg-secondary/50 px-2 py-0.5 rounded-full">
            {projects.length}
          </span>
        </div>

        <div className="space-y-1.5">
          {projects.map((project, index) => (
            <div
              key={project.id}
              className={cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all animate-slide-in opacity-0",
                isRTL && "flex-row-reverse",
                currentProject?.id === project.id
                  ? "bg-gradient-primary/10 border border-primary/30 text-foreground shadow-glow/20"
                  : "hover:bg-secondary/60 text-sidebar-foreground hover-lift"
              )}
              style={{ animationDelay: `${0.2 + index * 0.05}s`, animationFillMode: 'forwards' }}
              onClick={() => editingId !== project.id && onSelectProject(project)}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                currentProject?.id === project.id 
                  ? "bg-primary/20 text-primary" 
                  : "bg-secondary/80 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
              )}>
                <Folder className="w-4 h-4" />
              </div>

              {editingId === project.id ? (
                <div className={cn(
                  "flex-1 flex items-center gap-1",
                  isRTL && "flex-row-reverse"
                )}>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-7 px-2 text-sm bg-secondary/50 border-border/50 rounded-lg"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit();
                      if (e.key === "Escape") cancelEdit();
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-primary/20 hover:text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      saveEdit();
                    }}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-destructive/20 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      cancelEdit();
                    }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium truncate">{project.name}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-secondary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align={isRTL ? "start" : "end"} className="glass-strong rounded-xl border-border/50">
                      <DropdownMenuItem onClick={() => startEditing(project)} className="rounded-lg">
                        <Edit2 className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
                        {t("rename")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive rounded-lg"
                        onClick={() => onDeleteProject(project.id)}
                      >
                        <Trash2 className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
                        {t("delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          ))}

          {projects.length === 0 && (
            <div className="px-3 py-12 text-center animate-fade-in">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-primary/10 flex items-center justify-center">
                <Folder className="w-8 h-8 text-primary/50" />
              </div>
              <p className="text-sm text-muted-foreground mb-4">{t("noProjects")}</p>
              <p className="text-xs text-muted-foreground/60">{t("newProject")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border/50 relative z-10">
        <Button
          variant="ghost"
          className={cn(
            "w-full h-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all",
            isRTL ? "justify-end" : "justify-start"
          )}
          onClick={onSignOut}
        >
          <LogOut className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
          {t("signOut")}
        </Button>
      </div>
    </div>
  );
}