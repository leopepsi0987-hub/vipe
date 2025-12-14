import { cn } from "@/lib/utils";
import { User, Zap, Eye, Code } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  isStreaming?: boolean;
  hasCode?: boolean;
  onViewPreview?: () => void;
  onViewCode?: () => void;
}

export function ChatMessage({ 
  role, 
  content, 
  imageUrl, 
  isStreaming, 
  hasCode,
  onViewPreview,
  onViewCode 
}: ChatMessageProps) {
  const isUser = role === "user";

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
          {content}
          {isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-current animate-typing" />
          )}
        </p>

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