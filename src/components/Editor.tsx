import { useState, useRef, useEffect, useCallback } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { Preview } from "./Preview";
import { DataPanel } from "./DataPanel";
import { VisualEditor } from "./VisualEditor";
import { VersionHistoryPanel } from "./VersionHistoryPanel";
import { SqlPreviewModal } from "./SqlPreviewModal";
import { Project } from "@/hooks/useProjects";
import { useVersionHistory } from "@/hooks/useVersionHistory";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { MessageSquare, Database, History, Eye, Code, Globe, Loader2, CheckCircle, FileCode } from "lucide-react";
import { cn } from "@/lib/utils";
import { BuildingOverlay } from "./BuildingOverlay";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { useI18n, LanguageToggle } from "@/lib/i18n";
import { useProjectFiles } from "@/hooks/useProjectFiles";
import { generateBundledHTML } from "@/lib/sandboxBundler";

// Task and file action types for streaming display
interface Task {
  id: string;
  title: string;
  status: "pending" | "in-progress" | "done";
}

interface FileAction {
  type: "reading" | "editing" | "edited";
  path: string;
}

interface SandboxData {
  sandboxId: string;
  url: string;
}

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
  metadata?: {
    tasks?: Task[];
    fileActions?: FileAction[];
    thinkingTime?: number;
    isThinking?: boolean;
  };
}

interface EditorProps {
  project: Project;
  onUpdateCode: (code: string) => void;
  onPublish: (customSlug?: string, bundledHtml?: string) => Promise<any>;
  onUpdatePublished: (bundledHtml?: string) => Promise<any>;
}

type LeftTab = "chat" | "data" | "history";
type MobileTab = "chat" | "preview";

export function Editor({ project, onUpdateCode, onPublish, onUpdatePublished }: EditorProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [leftTab, setLeftTab] = useState<LeftTab>("chat");
  const [previewView, setPreviewView] = useState<"preview" | "code">("preview");
  const [showVisualEditor, setShowVisualEditor] = useState(false);
  const [dbChoice, setDbChoice] = useState<"BUILT_IN_DB" | "CUSTOM_DB" | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");
  
  // SQL Preview Modal state
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [pendingSql, setPendingSql] = useState("");
  const [isExecutingSql, setIsExecutingSql] = useState(false);

  // Sandbox state for live preview (same as Generation page)
  const [sandboxData, setSandboxData] = useState<SandboxData | null>(null);
  const [currentTasks, setCurrentTasks] = useState<Task[]>([]);
  const [currentFileActions, setCurrentFileActions] = useState<FileAction[]>([]);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const { t, isRTL } = useI18n();

  // Version history
  const { versions, loading: versionsLoading, saveVersion, refreshVersions } = useVersionHistory(project.id);

  // Project files (React project mode)
  const { files, applyOperations, updateFile } = useProjectFiles(project.id);

  // Auto-save: keep projects.html_code in sync with project_files so projects always appear in Builder.
  const htmlAutosaveTimerRef = useRef<number | null>(null);
  const latestFilesRef = useRef<Record<string, string>>({});

  useEffect(() => {
    latestFilesRef.current = files;

    if (!files || Object.keys(files).length === 0) return;

    if (htmlAutosaveTimerRef.current) {
      window.clearTimeout(htmlAutosaveTimerRef.current);
    }

    htmlAutosaveTimerRef.current = window.setTimeout(() => {
      try {
        const baseUrl = window.location.origin;
        const bundled = generateBundledHTML(latestFilesRef.current, baseUrl);
        onUpdateCode(bundled);
      } catch (e) {
        console.warn("[Editor] Failed to bundle for autosave", e);
      }
    }, 1200);

    return () => {
      if (htmlAutosaveTimerRef.current) window.clearTimeout(htmlAutosaveTimerRef.current);
    };
  }, [files, onUpdateCode]);

  useEffect(() => {
    const flush = () => {
      if (!latestFilesRef.current || Object.keys(latestFilesRef.current).length === 0) return;
      try {
        const baseUrl = window.location.origin;
        const bundled = generateBundledHTML(latestFilesRef.current, baseUrl);
        onUpdateCode(bundled);
      } catch {
        // ignore
      }
    };

    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [onUpdateCode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + P to toggle preview/code
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        setPreviewView((prev) => (prev === "preview" ? "code" : "preview"));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Load messages from database on project change - clear first!
  useEffect(() => {
    setMessages([]); // Clear messages immediately when switching projects
    setStreamingContent("");
    setSandboxData(null);
    setCurrentTasks([]);
    setCurrentFileActions([]);
    loadMessages();
    loadSandboxData();
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

  // Load sandbox data from project_data
  const loadSandboxData = async () => {
    try {
      const { data } = await supabase
        .from("project_data")
        .select("value")
        .eq("project_id", project.id)
        .eq("key", "sandbox_data")
        .maybeSingle();

      if (data?.value) {
        const sandbox = data.value as unknown as SandboxData;
        if (sandbox.sandboxId && sandbox.url) {
          setSandboxData(sandbox);
        }
      }
    } catch (error) {
      console.log("No sandbox data found");
    }
  };

  // Save sandbox data
  const saveSandboxData = async (sandbox: SandboxData) => {
    try {
      const { data: existing } = await supabase
        .from("project_data")
        .select("id")
        .eq("project_id", project.id)
        .eq("key", "sandbox_data")
        .maybeSingle();

      if (existing) {
        await supabase.from("project_data").update({ value: sandbox as any }).eq("id", existing.id);
      } else {
        await supabase.from("project_data").insert({
          project_id: project.id,
          key: "sandbox_data",
          value: sandbox as any,
        });
      }
    } catch (error) {
      console.error("Error saving sandbox data:", error);
    }
  };

  // Create sandbox for live preview
  const createSandbox = async (): Promise<SandboxData | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("create-sandbox", {
        body: {},
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to create sandbox");

      const sandbox: SandboxData = {
        sandboxId: data.sandboxId,
        url: data.url,
      };

      setSandboxData(sandbox);
      await saveSandboxData(sandbox);
      return sandbox;
    } catch (error) {
      console.error("[Editor] Sandbox creation error:", error);
      return null;
    }
  };

  // Recover sandbox if expired
  const recoverSandbox = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("restart-sandbox", {
        body: { projectId: project.id },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to recover sandbox");

      const sandbox: SandboxData = { sandboxId: data.sandboxId, url: data.url };
      setSandboxData(sandbox);
      await saveSandboxData(sandbox);
      return sandbox;
    } catch (e) {
      console.error("[Editor] recoverSandbox error", e);
      toast.error("Failed to recover preview");
      return null;
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
        await supabase.from("project_data").update({ value: newMessages as any }).eq("id", existing.id);
      } else {
        await supabase.from("project_data").insert({
          project_id: project.id,
          key: "chat_messages",
          value: newMessages as any,
        });
      }
    } catch (error) {
      console.error("Error saving messages:", error);
    }
  };

  // Check if user has connected their Supabase
  const [hasConnectedSupabase, setHasConnectedSupabase] = useState(false);

  useEffect(() => {
    const checkSupabaseConnection = async () => {
      try {
        const { data } = await supabase
          .from("project_data")
          .select("value")
          .eq("project_id", project.id)
          .eq("key", "supabase_connection")
          .maybeSingle();

        if (data?.value) {
          const conn = data.value as { connected?: boolean };
          setHasConnectedSupabase(!!conn.connected);
        }
      } catch (error) {
        console.log("No Supabase connection found");
      }
    };
    checkSupabaseConnection();
  }, [project.id]);

  // Parse files from AI streamed content (same as Generation page)
  const parseFilesFromContent = (content: string): Array<{ path: string; content: string }> => {
    const files: Array<{ path: string; content: string }> = [];
    const fileRegex = /<file\s+path="([^"]+)">([\s\S]*?)<\/file>/g;
    let match;

    while ((match = fileRegex.exec(content)) !== null) {
      const filePath = match[1];
      let fileContent = match[2].trim();

      // Strip markdown code fences that AI sometimes includes
      fileContent = fileContent
        .replace(/^```\w*\s*\n?/g, "")
        .replace(/\n?```\s*$/g, "")
        .trim();

      files.push({ path: filePath, content: fileContent });
    }

    return files;
  };

  const streamSseToText = async (response: Response, onDelta: (delta: string) => void) => {
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
        if (line.startsWith(":" ) || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") continue;

        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullContent += delta;
            onDelta(fullContent);
          }
        } catch {
          // ignore partial/incomplete JSON
        }
      }
    }

    return fullContent;
  };

  const handleSendMessage = async (rawContent: string, imageUrl?: string) => {
    const content = rawContent.trim();

    // Explicit build commands only (prevents "hi" from triggering a build)
    const isBuildCommand = /^\/(build|edit)\b/i.test(content);
    const mode: "chat" | "build" = isBuildCommand ? "build" : "chat";

    const promptForBuild = isBuildCommand ? content.replace(/^\/(build|edit)\b\s*/i, "").trim() : content;

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

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      if (mode === "chat") {
        const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

        // send full conversation history for better continuity
        const chatMessages = newMessages.map((m) => ({
          role: m.role,
          content: m.content,
          ...(m.imageUrl ? { imageUrl: m.imageUrl } : {}),
        }));

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ 
            messages: chatMessages, 
            imageUrl,
            supabaseConnected: hasConnectedSupabase,
          }),
          signal: abortControllerRef.current?.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to get response");
        }

        const finalText = await streamSseToText(response, (next) => setStreamingContent(next));

        // Check for SQL execution blocks [VIPE_SQL]...[/VIPE_SQL]
        const sqlMatch = finalText.match(/\[VIPE_SQL\]([\s\S]*?)\[\/VIPE_SQL\]/);
        if (sqlMatch && hasConnectedSupabase) {
          const sql = sqlMatch[1].trim();
          console.log("[Editor] Detected SQL block, showing preview modal...");
          
          // Show the SQL preview modal instead of auto-executing
          setPendingSql(sql);
          setShowSqlModal(true);
        }

        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: finalText || "",
        };

        const finalMessages = [...newMessages, assistantMessage];
        setMessages(finalMessages);
        saveMessages(finalMessages);
        setStreamingContent("");
        return;
      }

      // BUILD MODE - Use generate-ai-code (same as Generation page)
      // This gives us: sandbox creation, file streaming with tasks/actions, image understanding
      
      // Ensure sandbox exists
      let sandbox = sandboxData;
      if (!sandbox) {
        sandbox = await createSandbox();
        if (!sandbox) {
          throw new Error("Failed to create sandbox environment");
        }
      }

      const hasExistingFiles = Object.keys(files).length > 0;

      // Use generate-ai-code for full capabilities
      const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ai-code`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          prompt: promptForBuild,
          mode: "code",
          isEdit: hasExistingFiles,
          existingFiles: hasExistingFiles ? files : undefined,
          supabaseConnection: hasConnectedSupabase ? { connected: true } : null,
          imageData: imageUrl,
          context: {
            sandboxId: sandbox.sandboxId,
          },
        }),
        signal: abortControllerRef.current?.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Build failed");
      }

      // Stream with task/file action parsing (same as Generation page)
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullContent = "";
      let textBuffer = "";
      let tasks: Task[] = [];
      let fileActions: FileAction[] = [];
      const startTime = Date.now();
      let planMessageId: string | null = null;
      let planShown = false;

      // Create initial building message
      const buildingMessageId = crypto.randomUUID();
      const buildingMessage: Message = {
        id: buildingMessageId,
        role: "assistant",
        content: "Building...",
        metadata: { tasks: [], fileActions: [], isThinking: true },
      };
      setMessages([...newMessages, buildingMessage]);

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
            
            // Handle generate-ai-code SSE format: {type: "stream", text, raw}
            // AND OpenAI format: {choices: [{delta: {content}}]}
            let delta: string | undefined;
            if (parsed.type === "stream" && parsed.text) {
              // generate-ai-code format - text is the FULL content so far (raw: true)
              if (parsed.raw) {
                fullContent = parsed.text;
              } else {
                delta = parsed.text;
                fullContent += delta;
              }
            } else if (parsed.type === "complete") {
              // Final complete message from generate-ai-code
              fullContent = parsed.generatedCode || fullContent;
            } else if (parsed.choices?.[0]?.delta?.content) {
              // OpenAI format
              delta = parsed.choices[0].delta.content;
              fullContent += delta;
            }
            
            if (fullContent) {
              setStreamingContent(fullContent);

              // Parse plan
              if (!planShown) {
                const planMatch = fullContent.match(/<plan>([\s\S]*?)<\/plan>/);
                if (planMatch) {
                  planShown = true;
                  planMessageId = buildingMessageId;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === buildingMessageId
                        ? { ...m, content: planMatch[1].trim(), metadata: { ...m.metadata, isThinking: false } }
                        : m
                    )
                  );
                }
              }

              // Parse tasks
              const tasksMatch = fullContent.match(/<tasks>([\s\S]*?)<\/tasks>/);
              if (tasksMatch) {
                try {
                  tasks = JSON.parse(tasksMatch[1]);
                  setCurrentTasks(tasks);
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === buildingMessageId ? { ...m, metadata: { ...m.metadata, tasks } } : m
                    )
                  );
                } catch {}
              }

              // Parse task updates
              const taskUpdates = fullContent.matchAll(/<task-update\s+id="([^"]+)"\s+status="([^"]+)"\s*\/>/g);
              for (const match of taskUpdates) {
                const [, id, status] = match;
                tasks = tasks.map((t) => (t.id === id ? { ...t, status: status as Task["status"] } : t));
              }
              setCurrentTasks(tasks);

              // Parse file actions
              const fileActionMatches = fullContent.matchAll(
                /<file-action\s+type="([^"]+)"\s+path="([^"]+)"\s*\/>/g
              );
              for (const match of fileActionMatches) {
                const [, type, path] = match;
                if (!fileActions.find((a) => a.path === path && a.type === type)) {
                  fileActions.push({ type: type as FileAction["type"], path });
                }
              }
              setCurrentFileActions(fileActions);

              // Update message with current tasks and file actions
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === buildingMessageId
                    ? {
                        ...m,
                        metadata: {
                          ...m.metadata,
                          tasks: [...tasks],
                          fileActions: [...fileActions],
                          thinkingTime: Math.round((Date.now() - startTime) / 1000),
                        },
                      }
                    : m
                )
              );
            }
          } catch {
            // ignore partial JSON
          }
        }
      }

      // Parse files from streamed content and apply
      const parsedFiles = parseFilesFromContent(fullContent);
      
      if (parsedFiles.length > 0) {
        // Apply to project_files database
        const ops = parsedFiles.map((f) => ({
          path: f.path,
          action: "create" as const,
          content: f.content,
        }));
        await applyOperations(ops);

        // Apply to sandbox
        try {
          await supabase.functions.invoke("apply-code", {
            body: {
              sandboxId: sandbox.sandboxId,
              files: parsedFiles.map((f) => ({ path: f.path, content: f.content })),
            },
          });
        } catch (e) {
          console.warn("[Editor] Failed to apply to sandbox:", e);
        }
      }

      // Parse summary
      const summaryMatch = fullContent.match(/<summary>([\s\S]*?)<\/summary>/);
      const summary = summaryMatch ? summaryMatch[1].trim() : "Done! Applied changes to your project.";

      // Update final message
      setMessages((prev) =>
        prev.map((m) =>
          m.id === buildingMessageId
            ? {
                ...m,
                content: planShown ? m.content + "\n\n" + summary : summary,
                hasCode: true,
                metadata: {
                  ...m.metadata,
                  tasks: tasks.map((t) => ({ ...t, status: "done" as const })),
                  isThinking: false,
                  thinkingTime: Math.round((Date.now() - startTime) / 1000),
                },
              }
            : m
        )
      );

      // Auto-publish after successful build if not already published
      if (parsedFiles.length > 0 && !project.is_published) {
        try {
          const bundledHtml = generateBundledHTML(latestFilesRef.current, window.location.origin);
          const result = await onPublish(undefined, bundledHtml);
          if (result?.slug) {
            toast.success("App auto-published!", {
              description: `Live at vipe.lovable.app/app/${result.slug}`,
              action: {
                label: "Copy Link",
                onClick: () => {
                  navigator.clipboard.writeText(`https://vipe.lovable.app/app/${result.slug}`);
                  toast.success("Link copied!");
                },
              },
            });
          }
        } catch (pubError) {
          console.warn("[Editor] Auto-publish failed:", pubError);
        }
      }

      // Save final messages
      setMessages((prev) => {
        saveMessages(prev);
        return prev;
      });
      setStreamingContent("");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        toast.info(mode === "build" ? "Build stopped" : "Stopped");
        return;
      }

      console.error("Error:", error);
      toast.error(error instanceof Error ? error.message : "Something went wrong");

      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Oops, something went wrong. Try again?",
      };
      const finalMessages = [...newMessages, errorMessage];
      setMessages(finalMessages);
      saveMessages(finalMessages);
    } finally {
      setIsGenerating(false);
      setStreamingContent("");
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // SQL Execution Handler
  const handleExecuteSql = async () => {
    if (!pendingSql) return;
    
    setIsExecutingSql(true);
    
    try {
      const migrationResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/execute-migration`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            action: "run_sql_migration",
            projectId: project.id,
            sql: pendingSql,
            description: "Executed from Vipe AI with user approval",
          }),
        }
      );

      const migrationResult = await migrationResponse.json();
      
      if (migrationResult.success) {
        if (migrationResult.data?.requiresManualExecution) {
          toast.info("SQL ready! Open your Supabase SQL Editor to run it.", {
            duration: 8000,
            action: {
              label: "Open Dashboard",
              onClick: () => window.open(migrationResult.data.dashboardUrl, "_blank"),
            },
          });
        } else {
          toast.success("Database updated successfully!");
        }
        setShowSqlModal(false);
        setPendingSql("");
      } else {
        toast.error(`Database error: ${migrationResult.error}`);
      }
    } catch (sqlError) {
      console.error("[Editor] SQL execution error:", sqlError);
      toast.error("Failed to execute database changes");
    } finally {
      setIsExecutingSql(false);
    }
  };

  const handleCancelSql = () => {
    setShowSqlModal(false);
    setPendingSql("");
    toast.info("Database changes cancelled");
  };

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="flex flex-col h-full bg-background">
        {/* Mobile Content */}
        <div className="flex-1 overflow-hidden">
          {mobileTab === "chat" ? (
            <div className={cn("flex flex-col h-full bg-background", isRTL && "font-arabic")}>
              {/* ChatGPT-style Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm">
                    V
                  </div>
                  <span className="font-semibold text-foreground">Vipe</span>
                </div>
                <LanguageToggle />
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1">
                <div ref={scrollRef} className="py-4">
                  {messages.length === 0 && !isGenerating && (
                    <div className="text-center py-12 px-4">
                      <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                        <span className="text-2xl font-bold text-white">V</span>
                      </div>
                      <h3 className="text-xl font-semibold text-foreground mb-2">
                        {t("howCanIHelp")}
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                        {t("tellMeWhatToBuild")}
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
                      content={streamingContent || t("building")}
                      isStreaming
                      metadata={{
                        tasks: currentTasks,
                        fileActions: currentFileActions,
                        isThinking: currentTasks.length === 0,
                      }}
                    />
                  )}
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="p-4 border-t border-border bg-background">
                <ChatInput
                  onSend={handleSendMessage}
                  onStop={handleStop}
                  disabled={isGenerating}
                  currentPath="/"
                  onVisualEdit={() => setShowVisualEditor(true)}
                />
              </div>
            </div>
          ) : (
            <Preview 
              html={project.html_code} 
              files={files}
              projectId={project.id}
              projectName={project.name}
              isPublished={project.is_published}
              slug={project.slug}
              sandboxUrl={sandboxData?.url}
              onPublish={onPublish}
              onUpdatePublished={onUpdatePublished}
              activeView={previewView}
              onViewChange={setPreviewView}
              onCodeChange={onUpdateCode}
              onFileChange={(path, content) => updateFile(path, content)}
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
        {isGenerating && <BuildingOverlay isBuilding={true} />}

        {/* SQL Preview Modal (Mobile) */}
        <SqlPreviewModal
          open={showSqlModal}
          onOpenChange={setShowSqlModal}
          sql={pendingSql}
          onApprove={handleExecuteSql}
          onCancel={handleCancelSql}
          isExecuting={isExecutingSql}
        />
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
              {/* ChatGPT-style Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm">
                    V
                  </div>
                  <span className="font-semibold text-foreground">Vipe</span>
                </div>
                <LanguageToggle />
              </div>

              {/* Messages - ChatGPT style */}
              <ScrollArea className="flex-1">
                <div ref={scrollRef} className={cn("py-4", isRTL && "font-arabic")}>
                  {messages.length === 0 && !isGenerating && (
                    <div className="text-center py-16 px-4">
                      <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                        <span className="text-3xl font-bold text-white">V</span>
                      </div>
                      <h2 className="text-2xl font-semibold text-foreground mb-3">
                        {t("howCanIHelp")}
                      </h2>
                      <p className="text-muted-foreground max-w-md mx-auto">
                        {t("tellMeWhatToBuild")}
                      </p>
                      
                      {/* Quick Suggestions */}
                      <div className="flex flex-wrap justify-center gap-2 mt-8">
                        <button
                          onClick={() => handleSendMessage(`/build ${t("buildTodoApp")}`)}
                          className="px-4 py-2 text-sm rounded-xl border border-border hover:bg-secondary transition-colors"
                        >
                          {t("buildTodoApp")}
                        </button>
                        <button
                          onClick={() => handleSendMessage(`/build ${t("createLandingPage")}`)}
                          className="px-4 py-2 text-sm rounded-xl border border-border hover:bg-secondary transition-colors"
                        >
                          {t("createLandingPage")}
                        </button>
                        <button
                          onClick={() => handleSendMessage(`/build ${t("makeDashboard")}`)}
                          className="px-4 py-2 text-sm rounded-xl border border-border hover:bg-secondary transition-colors"
                        >
                          {t("makeDashboard")}
                        </button>
                      </div>
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
                        handleSendMessage(`[[${actionId}]]`);
                      }}
                    />
                  ))}

                  {isGenerating && (
                    <ChatMessage
                      role="assistant"
                      content={streamingContent || t("building")}
                      isStreaming
                      metadata={{
                        tasks: currentTasks,
                        fileActions: currentFileActions,
                        isThinking: currentTasks.length === 0,
                      }}
                    />
                  )}
                </div>
              </ScrollArea>

              {/* ChatGPT-style Input */}
              <div className="p-4 border-t border-border bg-background">
                <ChatInput
                  onSend={handleSendMessage}
                  onStop={handleStop}
                  disabled={isGenerating}
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
            files={files}
            projectId={project.id}
            projectName={project.name}
            isPublished={project.is_published}
            slug={project.slug}
            sandboxUrl={sandboxData?.url}
            onPublish={onPublish}
            onUpdatePublished={onUpdatePublished}
            activeView={previewView}
            onViewChange={setPreviewView}
            onCodeChange={onUpdateCode}
            onFileChange={(path, content) => updateFile(path, content)}
          />
          <BuildingOverlay isBuilding={isGenerating} />
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

      {/* SQL Preview Modal */}
      <SqlPreviewModal
        open={showSqlModal}
        onOpenChange={setShowSqlModal}
        sql={pendingSql}
        onApprove={handleExecuteSql}
        onCancel={handleCancelSql}
        isExecuting={isExecutingSql}
      />
    </ResizablePanelGroup>
  );
}
