import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, Loader2, Globe, MessageSquare } from "lucide-react";

interface ChatMessage {
  id: string;
  content: string;
  type: "user" | "ai" | "system" | "file-update";
  timestamp: Date;
  metadata?: {
    scrapedUrl?: string;
    appliedFiles?: string[];
  };
}

interface GenerationSidebarProps {
  chatMessages: ChatMessage[];
  chatInput: string;
  setChatInput: (value: string) => void;
  onSubmit: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  isLoading: boolean;
  chatContainerRef: React.RefObject<HTMLDivElement>;
  onBack: () => void;
  urlScreenshot?: string | null;
}

export function GenerationSidebar({
  chatMessages,
  chatInput,
  setChatInput,
  onSubmit,
  onKeyDown,
  isLoading,
  chatContainerRef,
  onBack,
  urlScreenshot,
}: GenerationSidebarProps) {
  return (
    <div className="w-[380px] border-r border-border bg-card flex flex-col">
      {/* Header */}
      <div className="h-14 border-b border-border flex items-center px-4 gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">V</span>
          </div>
          <span className="font-semibold text-foreground">Vipe</span>
        </div>
      </div>

      {/* Screenshot Preview */}
      {urlScreenshot && (
        <div className="p-4 border-b border-border">
          <div className="relative rounded-lg overflow-hidden border border-border">
            <img
              src={urlScreenshot}
              alt="Website preview"
              className="w-full h-32 object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute bottom-2 left-2 text-xs text-white/80 flex items-center gap-1">
              <Globe className="w-3 h-3" />
              Source website
            </div>
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <ScrollArea className="flex-1">
        <div ref={chatContainerRef} className="p-4 space-y-4">
          {chatMessages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl px-4 py-2.5 ${
                  message.type === "user"
                    ? "bg-primary text-primary-foreground"
                    : message.type === "ai"
                    ? "bg-muted text-foreground"
                    : "bg-muted/50 text-muted-foreground text-sm"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                
                {message.metadata?.appliedFiles && message.metadata.appliedFiles.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/20">
                    <p className="text-xs opacity-70 mb-1">Files created:</p>
                    <div className="flex flex-wrap gap-1">
                      {message.metadata.appliedFiles.slice(0, 5).map((file) => (
                        <span
                          key={file}
                          className="text-xs bg-black/10 rounded px-1.5 py-0.5"
                        >
                          {file.split("/").pop()}
                        </span>
                      ))}
                      {message.metadata.appliedFiles.length > 5 && (
                        <span className="text-xs opacity-70">
                          +{message.metadata.appliedFiles.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted/50 rounded-2xl px-4 py-2.5 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Processing...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="relative">
          <Textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Enter URL to clone or describe what to build..."
            className="min-h-[80px] pr-12 resize-none bg-background"
            disabled={isLoading}
          />
          <Button
            size="icon"
            className="absolute bottom-2 right-2 h-8 w-8"
            onClick={onSubmit}
            disabled={isLoading || !chatInput.trim()}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Paste a URL to clone or describe your app
        </p>
      </div>
    </div>
  );
}
