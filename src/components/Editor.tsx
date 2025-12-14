import { useState, useRef, useEffect, useCallback } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { Preview } from "./Preview";
import { DataPanel } from "./DataPanel";
import { VisualEditor } from "./VisualEditor";
import { VersionHistoryPanel } from "./VersionHistoryPanel";
import { Project } from "@/hooks/useProjects";
import { useVersionHistory } from "@/hooks/useVersionHistory";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { MessageSquare, Database, Zap, MessageCircle, History, Eye, Code, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { BuildingOverlay } from "./BuildingOverlay";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";

interface QuickAction {
  id: string;
  label: string;
  icon?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  hasCode?: boolean;
  actions?: QuickAction[];
}

interface EditorProps {
  project: Project;
  onUpdateCode: (code: string) => void;
  onPublish: (customSlug?: string) => Promise<any>;
  onUpdatePublished: () => Promise<any>;
}

type LeftTab = "chat" | "data" | "history";
type ChatMode = "chat" | "build";
type MobileTab = "chat" | "preview";

export function Editor({ project, onUpdateCode, onPublish, onUpdatePublished }: EditorProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [leftTab, setLeftTab] = useState<LeftTab>("chat");
  const [chatMode, setChatMode] = useState<ChatMode>("build"); // Default to build mode
  const [previewView, setPreviewView] = useState<"preview" | "code">("preview");
  const [showVisualEditor, setShowVisualEditor] = useState(false);
  const [dbChoice, setDbChoice] = useState<"BUILT_IN_DB" | "CUSTOM_DB" | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  
  // Version history
  const { versions, loading: versionsLoading, saveVersion, refreshVersions } = useVersionHistory(project.id);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + P to toggle preview/code
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        setPreviewView(prev => prev === "preview" ? "code" : "preview");
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load messages from database on project change - clear first!
  useEffect(() => {
    setMessages([]); // Clear messages immediately when switching projects
    setStreamingContent("");
    loadMessages();
  }, [project.id]);

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
            dbChoice,
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

        // Save version before updating code
        await saveVersion(project.html_code);
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
        // Chat mode - parse for [VIPE_ACTIONS] blocks
        let parsedActions: QuickAction[] | undefined;
        const actionsMatch = fullContent.match(/\[VIPE_ACTIONS\]([\s\S]*?)\[\/VIPE_ACTIONS\]/);
        if (actionsMatch) {
          try {
            const actionsContent = actionsMatch[1].trim();
            const actionLines = actionsContent.split('\n').filter(line => line.trim());
            parsedActions = actionLines.map(line => {
              const match = line.match(/\[(.+?)\]\s*\((.+?)\)(?:\s*icon:(\w+))?/);
              if (match) {
                return { id: match[2], label: match[1], icon: match[3] };
              }
              return null;
            }).filter(Boolean) as QuickAction[];
          } catch (e) {
            console.error("Failed to parse actions:", e);
          }
        }

        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: fullContent,
          actions: parsedActions,
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

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="flex flex-col h-full bg-background">
        {/* Mobile Content */}
        <div className="flex-1 overflow-hidden">
          {mobileTab === "chat" ? (
            <div className="flex flex-col h-full bg-card">
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
                          ? "Let's chat! Tell me about what you want to build."
                          : "Ready to build! Describe your app."}
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
                      actions={message.actions}
                      onViewPreview={() => {
                        setPreviewView("preview");
                        setMobileTab("preview");
                      }}
                      onViewCode={() => {
                        setPreviewView("code");
                        setMobileTab("preview");
                      }}
                      onActionSelect={(actionId) => {
                        if (actionId === "BUILT_IN_DB" || actionId === "CUSTOM_DB") {
                          setDbChoice(actionId);
                        }
                        handleSendMessage(`[[${actionId}]]`);
                      }}
                    />
                  ))}

                  {isGenerating && (
                    <ChatMessage
                      role="assistant"
                      content={chatMode === "build" ? "🔨 Building your app..." : (streamingContent || "Thinking...")}
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
                      : "Describe what you want to build..."
                  }
                  currentPath="/"
                  onVisualEdit={() => setShowVisualEditor(true)}
                />
              </div>
            </div>
          ) : (
            <Preview 
              html={project.html_code} 
              projectId={project.id}
              projectName={project.name}
              isPublished={project.is_published}
              slug={project.slug}
              onPublish={onPublish}
              onUpdatePublished={onUpdatePublished}
              activeView={previewView}
              onViewChange={setPreviewView}
              onCodeChange={onUpdateCode}
            />
          )}
        </div>

        {/* Mobile Bottom Tab Bar */}
        <div className="flex border-t border-border bg-card safe-area-pb">
          <button
            onClick={() => setMobileTab("chat")}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors",
              mobileTab === "chat"
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-xs font-medium">Chat</span>
          </button>
          <button
            onClick={() => {
              setPreviewView("preview");
              setMobileTab("preview");
            }}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors",
              mobileTab === "preview" && previewView === "preview"
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            <Eye className="w-5 h-5" />
            <span className="text-xs font-medium">Preview</span>
          </button>
          <button
            onClick={() => {
              setPreviewView("code");
              setMobileTab("preview");
            }}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors",
              mobileTab === "preview" && previewView === "code"
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            <Code className="w-5 h-5" />
            <span className="text-xs font-medium">Code</span>
          </button>
          <button
            onClick={() => onPublish?.()}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-3 text-muted-foreground"
          >
            <Globe className="w-5 h-5" />
            <span className="text-xs font-medium">Publish</span>
          </button>
        </div>

        {/* Visual Editor Overlay */}
        {showVisualEditor && (
          <VisualEditor
            html={project.html_code}
            onUpdate={onUpdateCode}
            onClose={() => setShowVisualEditor(false)}
          />
        )}

        {isGenerating && chatMode === "build" && <BuildingOverlay isBuilding={true} />}
      </div>
    );
  }

  // Desktop Layout
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
            <button
              onClick={() => setLeftTab("history")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
                leftTab === "history"
                  ? "text-primary border-b-2 border-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <History className="w-4 h-4" />
              History
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
                      actions={message.actions}
                      onViewPreview={() => setPreviewView("preview")}
                      onViewCode={() => setPreviewView("code")}
                      onActionSelect={(actionId) => {
                        if (actionId === "BUILT_IN_DB" || actionId === "CUSTOM_DB") {
                          setDbChoice(actionId);
                        }
                        // Send the action reply as a user message
                        handleSendMessage(`[[${actionId}]]`);
                      }}
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
                  currentPath="/"
                  onVisualEdit={() => setShowVisualEditor(true)}
                />
              </div>
            </>
          ) : leftTab === "data" ? (
            <DataPanel projectId={project.id} />
          ) : (
            <VersionHistoryPanel
              versions={versions}
              loading={versionsLoading}
              onRestore={async (version) => {
                // Save current version first
                await saveVersion(project.html_code);
                // Restore the selected version
                onUpdateCode(version.html_code);
                refreshVersions();
                toast.success(`Restored to version ${version.version_number}`);
              }}
              onClose={() => setLeftTab("chat")}
            />
          )}
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Preview Panel */}
      <ResizablePanel defaultSize={65}>
        <div className="relative h-full">
          <Preview 
            html={project.html_code} 
            projectId={project.id}
            projectName={project.name}
            isPublished={project.is_published}
            slug={project.slug}
            onPublish={onPublish}
            onUpdatePublished={onUpdatePublished}
            activeView={previewView}
            onViewChange={setPreviewView}
            onCodeChange={onUpdateCode}
          />
          <BuildingOverlay isBuilding={isGenerating && chatMode === "build"} />
        </div>
      </ResizablePanel>

      {/* Visual Editor Modal */}
      {showVisualEditor && (
        <VisualEditor
          html={project.html_code}
          onUpdate={(newHtml) => {
            onUpdateCode(newHtml);
            setShowVisualEditor(false);
          }}
          onClose={() => setShowVisualEditor(false)}
        />
      )}
    </ResizablePanelGroup>
  );
}
