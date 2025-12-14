import { ArrowLeft, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EditorHeaderProps {
  projectName: string;
  onBack: () => void;
}

export function EditorHeader({ projectName, onBack }: EditorHeaderProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onBack}
      >
        <ArrowLeft className="w-4 h-4" />
      </Button>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-sm">
          <span className="text-primary-foreground font-bold text-sm">
            {projectName.charAt(0).toUpperCase()}
          </span>
        </div>
        <span className="font-medium text-foreground">{projectName}</span>
      </div>
    </div>
  );
}
