import { cn } from "@/lib/utils";
import { Copy, Check, ThumbsUp, ThumbsDown, Eye, Code, Database, Settings, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";

export interface QuickAction {
  id: string;
  label: string;
  labelDz?: string;
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
  onRegenerate?: () => void;
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
  onActionSelect,
  onRegenerate,
}: ChatMessageProps) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const { t, isRTL } = useI18n();

  // Parse out [VIPE_ACTIONS] and [VIPE_SQL] blocks from content for display
  const displayContent = content
    .replace(/\[VIPE_ACTIONS\][\s\S]*?\[\/VIPE_ACTIONS\]/g, '')
    .replace(/\[VIPE_SQL\][\s\S]*?\[\/VIPE_SQL\]/g, '✅ Database changes applied!')
    .trim();

  const handleCopy = () => {
    navigator.clipboard.writeText(displayContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getActionIcon = (iconName?: string) => {
    switch (iconName) {
      case 'database': return <Database className="w-4 h-4" />;
      case 'settings': return <Settings className="w-4 h-4" />;
      default: return null;
    }
  };

  // ChatGPT-style layout
  return (
    <div
      className={cn(
        "group w-full",
        isUser ? "bg-transparent" : "bg-secondary/30"
      )}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className={cn(
          "flex gap-4",
          isRTL && "flex-row-reverse"
        )}>
          {/* Avatar */}
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold",
              isUser
                ? "bg-primary text-primary-foreground"
                : "bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
            )}
          >
            {isUser ? (
              <span>{isRTL ? "أ" : "U"}</span>
            ) : (
              <span>V</span>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Role Label */}
            <div className={cn(
              "text-sm font-semibold text-foreground",
              isRTL && "text-right font-arabic"
            )}>
              {isUser ? t("you") : "Vipe"}
            </div>

            {/* Image if present */}
            {imageUrl && (
              <div className="mt-2">
                <img 
                  src={imageUrl} 
                  alt={t("sharedImage")}
                  className="max-w-sm h-auto rounded-xl border border-border"
                />
              </div>
            )}
            
            {/* Message Content */}
            <div className={cn(
              "text-[15px] leading-7 text-foreground/90 whitespace-pre-wrap",
              isRTL && "text-right font-arabic"
            )}>
              {displayContent}
              {isStreaming && (
                <span className="inline-block w-2 h-5 ml-1 bg-foreground/70 animate-pulse rounded-sm" />
              )}
            </div>

            {/* Quick Action Buttons */}
            {actions && actions.length > 0 && !isStreaming && (
              <div className={cn(
                "flex flex-wrap gap-2 pt-3",
                isRTL && "justify-end"
              )}>
                {actions.map((action) => (
                  <Button
                    key={action.id}
                    size="sm"
                    variant="outline"
                    className="h-9 text-sm bg-background hover:bg-primary hover:text-primary-foreground border-border/50 transition-all rounded-lg"
                    onClick={() => onActionSelect?.(action.id)}
                  >
                    {getActionIcon(action.icon)}
                    <span className={action.icon ? "ml-2" : ""}>
                      {isRTL ? (action.labelDz || action.label) : action.label}
                    </span>
                  </Button>
                ))}
              </div>
            )}

            {/* Action buttons for build responses */}
            {hasCode && !isStreaming && (
              <div className={cn(
                "flex gap-2 pt-3",
                isRTL && "justify-end"
              )}>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 text-sm rounded-lg border-border/50"
                  onClick={onViewPreview}
                >
                  <Eye className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
                  {t("preview")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 text-sm rounded-lg border-border/50"
                  onClick={onViewCode}
                >
                  <Code className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
                  {t("code")}
                </Button>
              </div>
            )}

            {/* Footer Actions (ChatGPT-style) - Only for assistant */}
            {!isUser && !isStreaming && (
              <div className={cn(
                "flex items-center gap-1 pt-2 opacity-0 group-hover:opacity-100 transition-opacity",
                isRTL && "justify-end"
              )}>
                <button
                  onClick={handleCopy}
                  className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                  title={t("copy")}
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => setFeedback("up")}
                  className={cn(
                    "p-1.5 rounded-md hover:bg-secondary transition-colors",
                    feedback === "up" ? "text-green-500" : "text-muted-foreground hover:text-foreground"
                  )}
                  title={t("good")}
                >
                  <ThumbsUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setFeedback("down")}
                  className={cn(
                    "p-1.5 rounded-md hover:bg-secondary transition-colors",
                    feedback === "down" ? "text-red-500" : "text-muted-foreground hover:text-foreground"
                  )}
                  title={t("bad")}
                >
                  <ThumbsDown className="w-4 h-4" />
                </button>
                {onRegenerate && (
                  <button
                    onClick={onRegenerate}
                    className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    title={t("regenerate")}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
