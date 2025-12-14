import { useState, useRef, useEffect } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { Preview } from "./Preview";
import { DataPanel } from "./DataPanel";
import { Project } from "@/hooks/useProjects";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { MessageSquare, Database, Zap, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  hasCode?: boolean; // Flag to show action buttons for build responses
}

interface EditorProps {
  project: Project;
  onUpdateCode: (code: string) => void;
  onPublish: () => Promise<any>;
  onUnpublish: () => Promise<any>;
}

type LeftTab = "chat" | "data";
type ChatMode = "chat" | "build";

export function Editor({ project, onUpdateCode, onPublish, onUnpublish }: EditorProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [leftTab, setLeftTab] = useState<LeftTab>("chat");
  const [chatMode, setChatMode] = useState<ChatMode>("chat");
  const [previewView, setPreviewView] = useState<"preview" | "code">("preview");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load messages from database on project change - clear first!
  useEffect(() => {
    setMessages([]); // Clear messages immediately when switching projects
    setStreamingContent("");
    loadMessages();
  }, [project.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("project_data")
        .select("value")
        .eq("project_id", project.id)
        .eq("key", "chat_messages")
        .single();

      if (data && !error) {
        const savedMessages = data.value as unknown as Message[];
        if (Array.isArray(savedMessages)) {
          setMessages(savedMessages);
        }
      }
    } catch (error) {
      // No messages saved yet, that's fine
    }
  };

  const saveMessages = async (newMessages: Message[]) => {
    try {
      const { data: existing } = await supabase
        .from("project_data")
        .select("id")
        .eq("project_id", project.id)
        .eq("key", "chat_messages")
        .single();

      if (existing) {
        await supabase
          .from("project_data")
          .update({ value: newMessages as any })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("project_data")
          .insert({
            project_id: project.id,
            key: "chat_messages",
            value: newMessages as any,
          });
      }
    } catch (error) {
      console.error("Error saving messages:", error);
    }
  };

  const handleSendMessage = async (content: string, imageUrl?: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      imageUrl,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsGenerating(true);
    setStreamingContent("");

    try {
      // Determine which endpoint to use based on mode
      const endpoint = chatMode === "build" 
        ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-code`
        : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

      const body = chatMode === "build"
        ? JSON.stringify({
            prompt: content,
            currentCode: project.html_code,
          })
        : JSON.stringify({
            messages: newMessages.map(m => ({
              role: m.role,
              content: m.content,
              imageUrl: m.imageUrl,
            })),
            imageUrl,
          });

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get response");
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

      if (chatMode === "build") {
        // Clean up the response - extract HTML from code blocks if present
        let cleanedCode = fullContent;
        const htmlMatch = fullContent.match(/```html\n?([\s\S]*?)```/);
        if (htmlMatch) {
          cleanedCode = htmlMatch[1];
        } else {
          cleanedCode = fullContent.replace(/```\w*\n?/g, "").trim();
        }

        onUpdateCode(cleanedCode);

        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Done! Your app is ready. 🚀",
          hasCode: true,
        };
        const finalMessages = [...newMessages, assistantMessage];
        setMessages(finalMessages);
        saveMessages(finalMessages);
      } else {
        // Chat mode - just add the response
        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: fullContent,
        };
        const finalMessages = [...newMessages, assistantMessage];
        setMessages(finalMessages);
        saveMessages(finalMessages);
      }

      setStreamingContent("");
    } catch (error) {
      console.error("Error:", error);
      toast.error(error instanceof Error ? error.message : "Something went wrong");
      
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Oops, something went wrong! Try again? 😅",
      };
      const finalMessages = [...newMessages, errorMessage];
      setMessages(finalMessages);
      saveMessages(finalMessages);
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
              {/* Mode Toggle */}
              <div className="p-3 border-b border-border">
                <div className="flex bg-secondary rounded-lg p-1">
                  <button
                    onClick={() => setChatMode("chat")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all",
                      chatMode === "chat"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <MessageCircle className="w-4 h-4" />
                    Chat
                  </button>
                  <button
                    onClick={() => setChatMode("build")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all",
                      chatMode === "build"
                        ? "bg-gradient-primary text-primary-foreground shadow-glow"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Zap className="w-4 h-4" />
                    Build
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  {chatMode === "chat" 
                    ? "Chat mode: Talk with Vipe about your ideas"
                    : "Build mode: Generate and update code"}
                </p>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1">
                <div ref={scrollRef} className="p-4 space-y-4">
                  {messages.length === 0 && !isGenerating && (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
                        <span className="text-2xl">👋</span>
                      </div>
                      <h3 className="text-lg font-medium text-foreground mb-2">
                        Hey! I'm Vipe
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                        {chatMode === "chat" 
                          ? "Let's chat! Tell me about what you want to build and I'll help you figure it out."
                          : "Ready to build! Describe your app and I'll generate the code."}
                      </p>
                    </div>
                  )}

                  {messages.map((message) => (
                    <ChatMessage
                      key={message.id}
                      role={message.role}
                      content={message.content}
                      imageUrl={message.imageUrl}
                      hasCode={message.hasCode}
                      onViewPreview={() => setPreviewView("preview")}
                      onViewCode={() => setPreviewView("code")}
                    />
                  ))}

                  {isGenerating && streamingContent && chatMode === "chat" && (
                    <ChatMessage
                      role="assistant"
                      content={streamingContent}
                      isStreaming
                    />
                  )}

                  {isGenerating && (
                    <ChatMessage
                      role="assistant"
                      content={chatMode === "build" ? "🔨 Building your app..." : (streamingContent ? "" : "Thinking...")}
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
                    chatMode === "chat"
                      ? "Chat with Vipe..."
                      : messages.length === 0
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
        <Preview 
          html={project.html_code} 
          projectId={project.id}
          projectName={project.name}
          isPublished={project.is_published}
          slug={project.slug}
          onPublish={onPublish}
          onUnpublish={onUnpublish}
          activeView={previewView}
          onViewChange={setPreviewView}
          onCodeChange={onUpdateCode}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
