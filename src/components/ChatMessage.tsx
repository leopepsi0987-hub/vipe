import { cn } from "@/lib/utils";
import { User, Zap, Eye, Code, Database, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface QuickAction {
  id: string;
  label: string;
  icon?: string;
}

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  isStreaming?: boolean;
  hasCode?: boolean;
  actions?: QuickAction[];
  onViewPreview?: () => void;
  onViewCode?: () => void;
  onActionSelect?: (actionId: string) => void;
}

export function ChatMessage({ 
  role, 
  content, 
  imageUrl, 
  isStreaming, 
  hasCode,
  actions,
  onViewPreview,
  onViewCode,
  onActionSelect
}: ChatMessageProps) {
  const isUser = role === "user";

  // Parse out [VIPE_ACTIONS] block from content for display
  const displayContent = content.replace(/\[VIPE_ACTIONS\][\s\S]*?\[\/VIPE_ACTIONS\]/g, '').trim();

  const getActionIcon = (iconName?: string) => {
    switch (iconName) {
      case 'database': return <Database className="w-4 h-4" />;
      case 'settings': return <Settings className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <div
      className={cn(
        "flex gap-3 animate-fade-in",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
          isUser
            ? "bg-secondary"
            : "bg-gradient-primary shadow-glow"
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-muted-foreground" />
        ) : (
          <Zap className="w-4 h-4 text-primary-foreground" />
        )}
      </div>

      <div
        className={cn(
          "max-w-[80%] rounded-xl px-4 py-3 space-y-3",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-foreground"
        )}
      >
        {/* Image if present */}
        {imageUrl && (
          <img 
            src={imageUrl} 
            alt="Shared image" 
            className="max-w-full h-auto rounded-lg max-h-48 object-cover"
          />
        )}
        
        <p className="text-sm whitespace-pre-wrap">
          {displayContent}
          {isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-current animate-typing" />
          )}
        </p>

        {/* Quick Action Buttons */}
        {actions && actions.length > 0 && !isStreaming && (
          <div className="flex flex-wrap gap-2 pt-2">
            {actions.map((action) => (
              <Button
                key={action.id}
                size="sm"
                variant="outline"
                className="h-9 text-xs bg-background/80 hover:bg-primary hover:text-primary-foreground border-primary/30 transition-all"
                onClick={() => onActionSelect?.(action.id)}
              >
                {getActionIcon(action.icon)}
                <span className={action.icon ? "ml-1.5" : ""}>{action.label}</span>
              </Button>
            ))}
          </div>
        )}

        {/* Action buttons for build responses */}
        {hasCode && !isStreaming && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs bg-background/50 hover:bg-background"
              onClick={onViewPreview}
            >
              <Eye className="w-3 h-3 mr-1" />
              Preview
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs bg-background/50 hover:bg-background"
              onClick={onViewCode}
            >
              <Code className="w-3 h-3 mr-1" />
              Code
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}