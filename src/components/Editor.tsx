import { useState, useRef, useEffect } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { Preview } from "./Preview";
import { DataPanel } from "./DataPanel";
import { Project } from "@/hooks/useProjects";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { MessageSquare, Database } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface EditorProps {
  project: Project;
  onUpdateCode: (code: string) => void;
}

type LeftTab = "chat" | "data";

export function Editor({ project, onUpdateCode }: EditorProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [leftTab, setLeftTab] = useState<LeftTab>("chat");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsGenerating(true);
    setStreamingContent("");

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-code`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            prompt: content,
            currentCode: project.html_code,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate code");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullContent = "";
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              setStreamingContent(fullContent);
            }
          } catch {
            // Ignore parse errors for incomplete JSON
          }
        }
      }

      // Clean up the response - extract HTML from code blocks if present
      let cleanedCode = fullContent;
      const htmlMatch = fullContent.match(/```html\n?([\s\S]*?)```/);
      if (htmlMatch) {
        cleanedCode = htmlMatch[1];
      } else {
        // Remove any markdown code fences
        cleanedCode = fullContent.replace(/```\w*\n?/g, "").trim();
      }

      // Update the code
      onUpdateCode(cleanedCode);

      // Add assistant message
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "I've updated your app! Check the preview to see the changes.",
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingContent("");
    } catch (error) {
      console.error("Error generating code:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate code");
      
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
      setStreamingContent("");
    }
  };

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      {/* Left Panel - Chat & Data */}
      <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
        <div className="flex flex-col h-full bg-card">
          {/* Tab Header */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setLeftTab("chat")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
                leftTab === "chat"
                  ? "text-primary border-b-2 border-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <MessageSquare className="w-4 h-4" />
              Chat
            </button>
            <button
              onClick={() => setLeftTab("data")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
                leftTab === "data"
                  ? "text-primary border-b-2 border-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Database className="w-4 h-4" />
              Data
            </button>
          </div>

          {leftTab === "chat" ? (
            <>
              {/* Messages */}
              <ScrollArea className="flex-1">
                <div ref={scrollRef} className="p-4 space-y-4">
                  {messages.length === 0 && !isGenerating && (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
                        <span className="text-2xl">✨</span>
                      </div>
                      <h3 className="text-lg font-medium text-foreground mb-2">
                        Ready to build
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                        Describe your idea and I'll generate the code. You can iterate
                        and refine with follow-up messages.
                      </p>
                    </div>
                  )}

                  {messages.map((message) => (
                    <ChatMessage
                      key={message.id}
                      role={message.role}
                      content={message.content}
                    />
                  ))}

                  {isGenerating && streamingContent && (
                    <ChatMessage
                      role="assistant"
                      content="Generating your code..."
                      isStreaming
                    />
                  )}
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="p-4 border-t border-border">
                <ChatInput
                  onSend={handleSendMessage}
                  disabled={isGenerating}
                  placeholder={
                    messages.length === 0
                      ? "Describe what you want to build..."
                      : "Make changes or add features..."
                  }
                />
              </div>
            </>
          ) : (
            <DataPanel projectId={project.id} />
          )}
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Preview Panel */}
      <ResizablePanel defaultSize={65}>
        <Preview html={project.html_code} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
