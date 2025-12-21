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
      "w-64 h-full flex flex-col bg-sidebar border-sidebar-border",
      isRTL ? "border-l font-arabic" : "border-r"
    )} dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className={cn(
          "flex items-center gap-2",
          isRTL && "flex-row-reverse"
        )}>
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold text-gradient">Vipe</span>
        </div>
      </div>

      {/* Language Toggle */}
      <div className="px-4 py-2">
        <LanguageToggle className="w-full" />
      </div>

      {/* Projects List */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className={cn(
          "flex items-center justify-between px-2 py-2",
          isRTL && "flex-row-reverse"
        )}>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t("projects")}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onCreateProject}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-1">
          {projects.map((project) => (
            <div
              key={project.id}
              className={cn(
                "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors",
                isRTL && "flex-row-reverse",
                currentProject?.id === project.id
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "hover:bg-sidebar-accent/50 text-sidebar-foreground"
              )}
              onClick={() => editingId !== project.id && onSelectProject(project)}
            >
              <Folder className="w-4 h-4 shrink-0 text-muted-foreground" />

              {editingId === project.id ? (
                <div className={cn(
                  "flex-1 flex items-center gap-1",
                  isRTL && "flex-row-reverse"
                )}>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-6 px-1 text-sm"
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
                    className="h-5 w-5"
                    onClick={(e) => {
                      e.stopPropagation();
                      saveEdit();
                    }}
                  >
                    <Check className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={(e) => {
                      e.stopPropagation();
                      cancelEdit();
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <>
                  <span className="flex-1 text-sm truncate">{project.name}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align={isRTL ? "start" : "end"}>
                      <DropdownMenuItem onClick={() => startEditing(project)}>
                        <Edit2 className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
                        {t("rename")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
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
            <div className="px-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">{t("noProjects")}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={onCreateProject}
              >
                <Plus className={cn("w-4 h-4", isRTL ? "ml-1" : "mr-1")} />
                {t("newProject")}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className={cn(
            "w-full text-muted-foreground hover:text-foreground",
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
