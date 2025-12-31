import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GenerationSidebar } from "@/components/generation/GenerationSidebar";
import { GenerationPreview } from "@/components/generation/GenerationPreview";
import { GenerationCodePanel } from "@/components/generation/GenerationCodePanel";
import { SupabaseConnectionModal } from "@/components/SupabaseConnectionModal";
import { VisualEditor } from "@/components/VisualEditor";
import { AuthPage } from "@/components/AuthPage";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft, Send, Database, CheckCircle, Edit3 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { generateBundledHTML } from "@/lib/sandboxBundler";

interface SandboxData {
  sandboxId: string;
  url: string;
}

interface Task {
  id: string;
  title: string;
  status: "pending" | "in-progress" | "done";
}

interface FileAction {
  type: "reading" | "editing" | "edited";
  path: string;
}

interface ChatMessage {
  id: string;
  content: string;
  type: "user" | "ai" | "system" | "file-update";
  timestamp: Date;
  metadata?: {
    scrapedUrl?: string;
    appliedFiles?: string[];
    isSupabaseInfo?: boolean;
    supabaseConnection?: SupabaseConnection;
    imageUrl?: string;
    tasks?: Task[];
    fileActions?: FileAction[];
    thinkingTime?: number;
    isThinking?: boolean;
  };
}

interface GenerationFile {
  path: string;
  content: string;
  type: string;
  completed: boolean;
}

interface SupabaseConnection {
  url: string;
  serviceRoleKey?: string;
  anonKey?: string;
  connected: boolean;
  connectedVia?: "oauth" | "manual";
  supabaseProjectId?: string;
}

// Generate a random session ID
const generateSessionId = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export default function GenerationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { sessionId: urlSessionId } = useParams();
  
  // Session ID state
  const [sessionId, setSessionId] = useState<string>(() => urlSessionId || generateSessionId());
  
  // Core state
  const [sandboxData, setSandboxData] = useState<SandboxData | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");
  
  // Supabase connection state
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);
  const [supabaseConnection, setSupabaseConnection] = useState<SupabaseConnection | null>(null);
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationFiles, setGenerationFiles] = useState<GenerationFile[]>([]);
  const [streamedCode, setStreamedCode] = useState("");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  
  // Scraping state
  const [isScrapingUrl, setIsScrapingUrl] = useState(false);
  const [scrapedData, setScrapedData] = useState<any>(null);
  const [urlScreenshot, setUrlScreenshot] = useState<string | null>(null);
  
  // Refs
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const hasLoadedSession = useRef(false);
  
  // Mobile view mode: chat or preview (must be before any early returns)
  const [mobileView, setMobileView] = useState<"chat" | "preview">("chat");
  
  // AI mode: chat (conversation only) or build (code generation)
  const [aiMode, setAiMode] = useState<"chat" | "build">("build");
  
  // Visual editor state
  const [showVisualEditor, setShowVisualEditor] = useState(false);
  
  // Project ID (for saving to projects table)
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>("Untitled Project");
  
  // Auth
  const { user, loading: authLoading } = useAuth();

  // Auth is required for saving (projects are user-owned). We'll gate rendering below,
  // and delay loading until auth is ready.

  // Redirect to unique URL if on /generation
  useEffect(() => {
    if (!urlSessionId) {
      navigate(`/g/${sessionId}`, { replace: true });
    }
  }, [urlSessionId, sessionId, navigate]);

  // Load project data from database (using projects table instead of sessions)
  useEffect(() => {
    if (authLoading || !user) return;
    if (!sessionId || hasLoadedSession.current) return;
    hasLoadedSession.current = true;

    const loadProject = async () => {
      try {
        setInitialLoading(true);

        // First check if this session ID maps to an existing project
        const { data: projectData } = await supabase
          .from("projects")
          .select("*")
          .eq("slug", sessionId)
          .maybeSingle();

        if (projectData) {
          setProjectId(projectData.id);
          setProjectName(projectData.name);
          
          // Load files from project_files
          const { data: filesData } = await supabase
            .from("project_files")
            .select("*")
            .eq("project_id", projectData.id);

          if (filesData && filesData.length > 0) {
            const loadedFiles: GenerationFile[] = filesData.map((f: any) => ({
              path: f.file_path,
              content: f.content,
              type: f.file_path.split(".").pop() || "javascript",
              completed: true,
            }));
            setGenerationFiles(loadedFiles);
            
            // Rebuild streamed code from files
            const codeStr = loadedFiles.map(f => `<file path="${f.path}">\n${f.content}\n</file>`).join("\n\n");
            setStreamedCode(codeStr);
          }
          
          // Load supabase connection from project_data
          const { data: connData } = await supabase
            .from("project_data")
            .select("value")
            .eq("project_id", projectData.id)
            .eq("key", "supabase_connection")
            .maybeSingle();

          if (connData) {
            const conn = connData.value as unknown as SupabaseConnection;
            setSupabaseConnection(conn);
          }
          
          // Load sandbox data from project_data
          const { data: sandboxDataStored } = await supabase
            .from("project_data")
            .select("value")
            .eq("project_id", projectData.id)
            .eq("key", "sandbox_data")
            .maybeSingle();

          if (sandboxDataStored) {
            const sandbox = sandboxDataStored.value as unknown as SandboxData;
            setSandboxData(sandbox);
          }
          
          // Load chat messages from project_data
          const { data: messagesDataStored } = await supabase
            .from("project_data")
            .select("value")
            .eq("project_id", projectData.id)
            .eq("key", "chat_messages")
            .maybeSingle();

          if (messagesDataStored && Array.isArray(messagesDataStored.value)) {
            const loadedMessages: ChatMessage[] = (messagesDataStored.value as any[]).map((m: any) => ({
              ...m,
              timestamp: new Date(m.timestamp),
            }));
            setChatMessages(loadedMessages);
            
            // Check for supabase connection in messages
            const supabaseMsg = loadedMessages.find(m => m.metadata?.isSupabaseInfo && m.metadata?.supabaseConnection);
            if (supabaseMsg?.metadata?.supabaseConnection) {
              setSupabaseConnection(supabaseMsg.metadata.supabaseConnection);
            }
          } else {
            // No messages - add welcome message
            setChatMessages([{
              id: "welcome",
              content: "Welcome to VIPE DZ! Enter a URL to clone or describe what you want to build.",
              type: "system",
              timestamp: new Date(),
            }]);
          }
        } else {
          // New session - check if user is logged in to create a project
          if (user) {
            // Create a new project for this session
            const { data: newProject, error: createError } = await supabase
              .from("projects")
              .insert({
                user_id: user.id,
                name: "Untitled Project",
                slug: sessionId,
              })
              .select()
              .single();

            if (newProject && !createError) {
              setProjectId(newProject.id);
              setProjectName(newProject.name);
            }
          }
          
          // No existing project - show welcome message
          setChatMessages([{
            id: "welcome",
            content: "Welcome to VIPE DZ! Enter a URL to clone or describe what you want to build.",
            type: "system",
            timestamp: new Date(),
          }]);
        }
      } catch (error) {
        console.error("Error loading project:", error);
      } finally {
        setInitialLoading(false);
      }
    };

    loadProject();
  }, [sessionId, user]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Check URL params for auto-start
  useEffect(() => {
    const urlParam = searchParams.get("url");
    if (urlParam) {
      setChatInput(urlParam);
      // Auto-start after a short delay
      setTimeout(() => handleSubmit(urlParam), 500);
    }
  }, []);

  const addMessage = async (content: string, type: ChatMessage["type"], metadata?: ChatMessage["metadata"]) => {
    const newMessage: ChatMessage = {
      id: crypto.randomUUID(),
      content,
      type,
      timestamp: new Date(),
      metadata,
    };
    
    setChatMessages((prev) => {
      const updated = [...prev, newMessage];
      
      // Save messages to project_data (non-blocking)
      if (projectId) {
        supabase
          .from("project_data")
          .upsert({
            project_id: projectId,
            key: "chat_messages",
            value: updated.map(m => ({
              ...m,
              timestamp: m.timestamp.toISOString(),
            })) as any,
          }, { onConflict: "project_id,key" })
          .then(({ error }) => {
            if (error) console.error("Error saving messages:", error);
          });
      }
      
      return updated;
    });
  };
  
  // Save sandbox data to project_data
  const saveSandboxData = async (sandbox: SandboxData) => {
    if (!projectId) return;
    
    await supabase
      .from("project_data")
      .upsert({
        project_id: projectId,
        key: "sandbox_data",
        value: sandbox as any,
      }, { onConflict: "project_id,key" });
  };

  // Handle Supabase connection callback
  const handleSupabaseConnected = (connection: SupabaseConnection) => {
    setSupabaseConnection(connection);
    setShowSupabaseModal(false);
    
    // Add visible message to chat
    addMessage("I've connected my Supabase database! 🎉", "user");
    
    // Add AI acknowledgment with hidden Supabase info in metadata
    addMessage(
      "Great! I can now create tables, schemas, and RLS policies for your app. What would you like me to build?",
      "ai",
      {
        isSupabaseInfo: true,
        supabaseConnection: connection,
      }
    );
  };

  const isUrl = (str: string): boolean => {
    const urlPattern = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/;
    return urlPattern.test(str.trim());
  };

  const isChatOnlyPrompt = (p: string): boolean => {
    const t = (p || "").trim().toLowerCase();
    if (!t) return true;

    // Strong "build" indicators - explicit commands to create
    // Check these FIRST - if user wants to build, let them build!
    const buildKeywords = [
      "build",
      "create",
      "creat", // typo
      "make",
      "design",
      "implement",
      "code",
      "add",
      "remove",
      "change",
      "update",
      "fix",
      "edit",
      "clone",
      "replicate",
      "landing page",
      "dashboard",
      "website",
      "web app",
      "webapp",
      "application",
      "app",
      "page",
      "component",
      "button",
      "form",
      "navbar",
      "header",
      "footer",
      "hero",
      "card",
      "list",
      "table",
      "modal",
      "sidebar",
      "menu",
      "todo",
      "hello world",
      "blank",
      "simple",
      "basic",
      "start",
    ];
    if (buildKeywords.some((k) => t.includes(k))) return false;

    // Strong "chat" indicators - these mean chat
    const strongChatPatterns = [
      /^(hi|hello|hey|yo|sup|howdy|hola)$/,  // ONLY exact greetings
      /^(hi|hello|hey)\s*[!.,]*$/,           // Just "hi!" or "hello."
      /is it (safe|ok|okay|good|fine)/,
      /can i (send|give|share|use)/,
      /should i/,
      /what (is|are|do|does|should|can|will)\s+(a|an|the|your|my)/,
      /how (do|does|can|should)\s+(i|you|we)/,
      /who (are|is)\s+(you|your)/,
      /why (do|does|is|are|should)/,
      /\bapi\s*key\b/,
      /\bsafe\b/,
      /^thanks?$/,
      /^thank you$/,
      /\bwhat do you think\b/,
      /^explain\b/,
      /\bhelp me understand\b/,
      /\bi have a question\b/,
    ];
    if (strongChatPatterns.some((pattern) => pattern.test(t))) return true;

    // If ends with question mark AND doesn't have build words, it's chat
    if (t.endsWith("?") && !buildKeywords.some((k) => t.includes(k))) return true;

    // Default: assume user wants to build something!
    return false;
  };

  const createSandbox = async (): Promise<SandboxData | null> => {
    try {
      addMessage("Creating sandbox environment...", "system");
      
      const { data, error } = await supabase.functions.invoke("create-sandbox", {
        body: {},
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to create sandbox");

      const sandbox = {
        sandboxId: data.sandboxId,
        url: data.url,
      };
      
      setSandboxData(sandbox);
      addMessage(`Sandbox ready! ID: ${data.sandboxId}`, "system");
      
      // Save sandbox data to project_data
      await saveSandboxData(sandbox);
      
      return sandbox;
    } catch (error) {
      console.error("[generation] Sandbox error:", error);
      addMessage(`Failed to create sandbox: ${error instanceof Error ? error.message : "Unknown error"}`, "system");
      return null;
    }
  };

  const scrapeUrl = async (url: string) => {
    setIsScrapingUrl(true);
    
    try {
      let formattedUrl = url.trim();
      if (!formattedUrl.startsWith("http")) {
        formattedUrl = `https://${formattedUrl}`;
      }

      addMessage(`Analyzing ${formattedUrl}...`, "system");

      const { data, error } = await supabase.functions.invoke("firecrawl-scrape", {
        body: { 
          url: formattedUrl,
          options: {
            formats: ["markdown", "screenshot", "branding"],
          },
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to scrape URL");

      const scraped = data.data || data;
      setScrapedData(scraped);
      
      if (scraped.screenshot) {
        setUrlScreenshot(scraped.screenshot);
      }

      addMessage(`Scraped ${formattedUrl} successfully!`, "system", {
        scrapedUrl: formattedUrl,
      });

      return scraped;
    } catch (error) {
      console.error("[generation] Scrape error:", error);
      addMessage(`Failed to scrape URL: ${error instanceof Error ? error.message : "Unknown error"}`, "system");
      return null;
    } finally {
      setIsScrapingUrl(false);
    }
  };

  const generateCode = async (prompt: string, scrapedContent?: any, forceNewProject = false, imageData?: string) => {
    // Use aiMode state directly - if "chat" mode, force chat-only behavior
    const chatOnly = aiMode === "chat" || (isChatOnlyPrompt(prompt) && !scrapedContent && !forceNewProject && aiMode !== "build");

    // Track if we've shown the plan message (to avoid duplicates)
    let planShown = false;
    let planMessageId: string | null = null;
    const startTime = Date.now();
    
    // Track current tasks and file actions
    let currentTasks: Array<{ id: string; title: string; status: "pending" | "in-progress" | "done" }> = [];
    let fileActions: Array<{ type: "reading" | "editing" | "edited"; path: string }> = [];

    setIsGenerating(true);
    if (!chatOnly) {
      setStreamedCode("");
      setActiveTab("code");
    }

    try {
      addMessage(prompt, "user", imageData ? { imageUrl: imageData } : undefined);

      // If this is a chat-only prompt, we still call the AI but we do NOT stream into the code panel.
      // We'll stream into a single AI chat message.
      const chatStreamMessageId = chatOnly ? crypto.randomUUID() : null;
      if (chatOnly && chatStreamMessageId) {
        const aiMsg: ChatMessage = {
          id: chatStreamMessageId,
          content: "",
          type: "ai",
          timestamp: new Date(),
        };
        setChatMessages((prev) => [...prev, aiMsg]);
        supabase
          .from("generation_messages")
          .insert({
            id: aiMsg.id,
            session_id: sessionId,
            content: aiMsg.content,
            type: aiMsg.type,
            metadata: aiMsg.metadata as any,
          })
          .then(({ error }) => {
            if (error) console.error("Error saving message:", error);
          });
      }

      // Create sandbox if not exists (only required for code builds)
      let sandbox = sandboxData;
      if (!chatOnly && !sandbox) {
        sandbox = await createSandbox();
        if (!sandbox) {
          throw new Error("Failed to create sandbox");
        }
      }

      // Determine if this is an edit (we have existing files from previous generation)
      const hasExistingFiles = generationFiles.length > 0;
      const isEdit = !chatOnly && hasExistingFiles && !forceNewProject && !scrapedContent;

      // Build existing files map for edit mode
      let existingFilesMap: Record<string, string> = {};
      if (isEdit) {
        for (const file of generationFiles) {
          existingFilesMap[file.path] = file.content;
        }
      } else if (!chatOnly) {
        // Clear existing files for new project
        setGenerationFiles([]);
      }

      addMessage(chatOnly ? "Thinking..." : isEdit ? "Editing your code..." : "Generating code...", "system");

      // Find if there's a supabase connection message in chat history
      const supabaseInfoMessage = chatMessages.find(
        (m) => m.metadata?.isSupabaseInfo && m.metadata?.supabaseConnection
      );

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ai-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          prompt,
          scrapedContent,
          mode: chatOnly ? "chat" : "code",
          isEdit,
          existingFiles: isEdit ? existingFilesMap : undefined,
          supabaseConnection: supabaseInfoMessage?.metadata?.supabaseConnection || supabaseConnection,
          sessionId,
          imageData,
          context: {
            sandboxId: sandbox?.sandboxId,
            sessionId,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate code");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      // Helper to update the plan message with current tasks/file actions
      const updatePlanMessage = (planContent: string) => {
        const thinkingTime = Math.round((Date.now() - startTime) / 1000);
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === planMessageId
              ? {
                  ...m,
                  content: planContent,
                  metadata: {
                    ...m.metadata,
                    tasks: [...currentTasks],
                    fileActions: [...fileActions],
                    thinkingTime,
                    isThinking: false,
                  },
                }
              : m
          )
        );
      };

      if (reader) {
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
            if (line.startsWith(":")) continue; // SSE keepalive/comment
            if (line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") continue;

            try {
              const data = JSON.parse(jsonStr);

              if (data.type === "stream" && data.text) {
                fullContent += data.text;

                if (chatOnly) {
                  // Stream into the last AI message instead of the code panel
                  setChatMessages((prev) =>
                    prev.map((m) =>
                      m.id === chatStreamMessageId ? { ...m, content: fullContent } : m
                    )
                  );
                } else {
                  // Extract and display <plan> tag content as a chat message with tasks
                  const planMatch = fullContent.match(/<plan>([\s\S]*?)<\/plan>/);
                  if (planMatch && !planShown) {
                    planShown = true;
                    planMessageId = crypto.randomUUID();
                    const newMsg: ChatMessage = {
                      id: planMessageId,
                      content: planMatch[1].trim(),
                      type: "ai",
                      timestamp: new Date(),
                      metadata: {
                        isThinking: true,
                        thinkingTime: Math.round((Date.now() - startTime) / 1000),
                      },
                    };
                    setChatMessages((prev) => [...prev, newMsg]);
                  }
                  
                  // Parse tasks from <tasks> tag
                  const tasksMatch = fullContent.match(/<tasks>\s*(\[[\s\S]*?\])\s*<\/tasks>/);
                  if (tasksMatch) {
                    try {
                      currentTasks = JSON.parse(tasksMatch[1]);
                      if (planMessageId) {
                        updatePlanMessage(planMatch?.[1]?.trim() || "");
                      }
                    } catch {}
                  }
                  
                  // Parse task updates
                  const taskUpdateRegex = /<task-update\s+id="([^"]+)"\s+status="([^"]+)"\s*\/>/g;
                  let taskMatch;
                  while ((taskMatch = taskUpdateRegex.exec(fullContent)) !== null) {
                    const taskId = taskMatch[1];
                    const newStatus = taskMatch[2] as "pending" | "in-progress" | "done";
                    const taskIndex = currentTasks.findIndex((t) => t.id === taskId);
                    if (taskIndex !== -1 && currentTasks[taskIndex].status !== newStatus) {
                      currentTasks[taskIndex].status = newStatus;
                      if (planMessageId) {
                        updatePlanMessage(planMatch?.[1]?.trim() || "");
                      }
                    }
                  }
                  
                  // Parse file actions
                  const fileActionRegex = /<file-action\s+type="([^"]+)"\s+path="([^"]+)"\s*\/>/g;
                  let fileMatch;
                  const seenActions = new Set(fileActions.map((a) => `${a.type}:${a.path}`));
                  while ((fileMatch = fileActionRegex.exec(fullContent)) !== null) {
                    const actionType = fileMatch[1] as "reading" | "editing";
                    const actionPath = fileMatch[2];
                    const key = `${actionType}:${actionPath}`;
                    if (!seenActions.has(key)) {
                      seenActions.add(key);
                      fileActions.push({ type: actionType, path: actionPath });
                      if (planMessageId) {
                        updatePlanMessage(planMatch?.[1]?.trim() || "");
                      }
                    }
                  }
                  
                  // Update file actions to "edited" when file is complete
                  const fileRegex = /<file path="([^"]+)">[\s\S]*?<\/file>/g;
                  let completedFileMatch;
                  while ((completedFileMatch = fileRegex.exec(fullContent)) !== null) {
                    const filePath = completedFileMatch[1];
                    const actionIndex = fileActions.findIndex(
                      (a) => a.path === filePath && a.type === "editing"
                    );
                    if (actionIndex !== -1) {
                      fileActions[actionIndex].type = "edited";
                      if (planMessageId) {
                        updatePlanMessage(planMatch?.[1]?.trim() || "");
                      }
                    }
                  }
                  
                  // Only show code in the code panel (strip plan/summary/tasks/etc)
                  const codeOnly = fullContent
                    .replace(/<plan>[\s\S]*?<\/plan>/g, "")
                    .replace(/<summary>[\s\S]*?<\/summary>/g, "")
                    .replace(/<tasks>[\s\S]*?<\/tasks>/g, "")
                    .replace(/<task-update[^>]*\/>/g, "")
                    .replace(/<file-action[^>]*\/>/g, "")
                    .trim();
                  setStreamedCode(codeOnly);
                  parseFilesFromCode(codeOnly, isEdit);
                }
              } else if (data.type === "complete") {
                fullContent = data.generatedCode || fullContent;

                if (chatOnly) {
                  setChatMessages((prev) =>
                    prev.map((m) =>
                      m.id === chatStreamMessageId ? { ...m, content: fullContent.trim() } : m
                    )
                  );
                  setIsGenerating(false);
                  return;
                }

                // Strip plan/summary from code display
                const codeOnly = fullContent
                  .replace(/<plan>[\s\S]*?<\/plan>/g, "")
                  .replace(/<summary>[\s\S]*?<\/summary>/g, "")
                  .trim();
                setStreamedCode(codeOnly);

                // Check if this is a chat response (legacy support)
                const chatMatch = fullContent.match(/```chat\s*([\s\S]*?)```/);
                if (chatMatch) {
                  const chatResponse = chatMatch[1].trim();
                  addMessage(chatResponse, "ai");
                  setIsGenerating(false);
                  return;
                }

                parseFilesFromCode(codeOnly, isEdit);

                // Apply code to sandbox (may create new one if expired)
                const activeSandbox = await applyCodeToSandbox(sandbox!, codeOnly);
                if (activeSandbox !== sandbox) {
                  sandbox = activeSandbox;
                }
              } else if (data.type === "error") {
                throw new Error(data.error || "Generation failed");
              }
            } catch {
              // Incomplete JSON split across chunks: put it back and wait for more data
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }

        if (textBuffer.trim().startsWith("data: ")) {
          try {
            const data = JSON.parse(textBuffer.trim().slice(6));
            if (data?.type === "complete") {
              fullContent = data.generatedCode || fullContent;

              if (chatOnly) {
                setChatMessages((prev) =>
                  prev.map((m) =>
                    m.id === chatStreamMessageId ? { ...m, content: fullContent.trim() } : m
                  )
                );
                setIsGenerating(false);
                return;
              }

              // Strip plan/summary from code display
              const codeOnly = fullContent
                .replace(/<plan>[\s\S]*?<\/plan>/g, "")
                .replace(/<summary>[\s\S]*?<\/summary>/g, "")
                .trim();
              setStreamedCode(codeOnly);

              // Check for chat response in final flush too (legacy support)
              const chatMatch = fullContent.match(/```chat\s*([\s\S]*?)```/);
              if (chatMatch) {
                const chatResponse = chatMatch[1].trim();
                addMessage(chatResponse, "ai");
                setIsGenerating(false);
                return;
              }

              parseFilesFromCode(codeOnly, isEdit);
              const activeSandbox = await applyCodeToSandbox(sandbox!, codeOnly);
              if (activeSandbox !== sandbox) {
                sandbox = activeSandbox;
              }
            }
          } catch {
            // ignore
          }
        }
      }

      // Extract summary from the full content, or use a default message
      const summaryMatch = fullContent.match(/<summary>([\s\S]*?)<\/summary>/);
      const summaryText = summaryMatch 
        ? summaryMatch[1].trim() 
        : (isEdit ? "Edit applied!" : "Code generated and applied!");
      
      addMessage(summaryText, "ai", {
        appliedFiles: generationFiles.map((f) => f.path),
      });

      setActiveTab("preview");
      
      // Refresh iframe
      if (iframeRef.current && sandbox.url) {
        iframeRef.current.src = `${sandbox.url}?t=${Date.now()}`;
      }
    } catch (error) {
      console.error("[generation] Generate error:", error);
      addMessage(`Generation failed: ${error instanceof Error ? error.message : "Unknown error"}`, "system");
    } finally {
      setIsGenerating(false);
    }
  };

  const parseFilesFromCode = async (code: string, mergeWithExisting = false) => {
    // Parse regular file blocks
    const fileRegex = /<file path="([^"]+)">([^]*?)<\/file>/g;
    const newFiles: GenerationFile[] = [];
    let match;

    while ((match = fileRegex.exec(code)) !== null) {
      const filePath = match[1];
      const fileContent = match[2].trim();
      const ext = filePath.split(".").pop() || "";
      
      newFiles.push({
        path: filePath,
        content: fileContent,
        type: ext === "jsx" || ext === "js" ? "javascript" : ext,
        completed: true,
      });
    }

    // Parse SQL migration blocks and execute them
    const sqlMigrationRegex = /```sql-migration\n([\s\S]*?)```/g;
    let sqlMatch;
    while ((sqlMatch = sqlMigrationRegex.exec(code)) !== null) {
      const sqlContent = sqlMatch[1].trim();
      if (sqlContent && supabaseConnection?.connected) {
        await executeSqlMigration(sqlContent);
      }
    }

    if (newFiles.length > 0) {
      let finalFiles: GenerationFile[];
      
      if (mergeWithExisting) {
        // Merge new files with existing ones (new files take precedence)
        setGenerationFiles(prev => {
          const existingMap = new Map(prev.map(f => [f.path, f]));
          for (const file of newFiles) {
            existingMap.set(file.path, file);
          }
          finalFiles = Array.from(existingMap.values());
          return finalFiles;
        });
      } else {
        finalFiles = newFiles;
        setGenerationFiles(newFiles);
      }

      // Save files to project_files (batch upsert)
      if (projectId) {
        const filesToSave = (finalFiles! || newFiles).map(f => ({
          project_id: projectId,
          file_path: f.path,
          content: f.content,
        }));

        // Use upsert to handle both new and updated files
        supabase
          .from("project_files")
          .upsert(filesToSave, { onConflict: "project_id,file_path" })
          .then(({ error }) => {
            if (error) console.error("Error saving files:", error);
          });

        // Update the project preview HTML so it shows up correctly in /builder
        const fileMap: Record<string, string> = {};
        for (const f of (finalFiles! || newFiles)) fileMap[f.path] = f.content;
        const bundledHtml = generateBundledHTML(fileMap, window.location.origin);
        supabase
          .from("projects")
          .update({ html_code: bundledHtml, updated_at: new Date().toISOString() })
          .eq("id", projectId)
          .then(({ error }) => {
            if (error) console.error("Error updating project html:", error);
          });
      }
    }
  };

  // Execute SQL migration on user's connected Supabase database
  const executeSqlMigration = async (sql: string) => {
    if (!supabaseConnection?.connected || !supabaseConnection?.supabaseProjectId) {
      console.log("[generation] No Supabase connection for SQL execution");
      return;
    }

    try {
      addMessage("Executing database migration...", "system");

      const { data, error } = await supabase.functions.invoke("execute-user-sql", {
        body: {
          sessionId,
          sql,
          supabaseProjectId: supabaseConnection.supabaseProjectId,
        },
      });

      if (error) throw error;

      if (data?.success) {
        addMessage("Database migration executed successfully!", "system");
        console.log("[generation] SQL migration result:", data);
      } else {
        // Extract and show the actual SQL error message
        const errorMsg = data?.error || "Migration failed";
        const sqlPreview = sql.length > 100 ? sql.substring(0, 100) + "..." : sql;
        throw new Error(`${errorMsg}\n\nSQL attempted:\n${sqlPreview}`);
      }
    } catch (error) {
      console.error("[generation] SQL migration error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      // Show a more detailed error message with the actual error
      addMessage(
        `Database migration failed: ${errorMessage}\n\nYou may need to run this SQL manually in your Supabase dashboard's SQL Editor.`,
        "system"
      );
      
      // Also show a toast with the specific error
      toast.error(`SQL Error: ${errorMessage.split('\n')[0]}`);
    }
  };

  const applyCodeToSandbox = async (sandbox: SandboxData, code: string): Promise<SandboxData> => {
    try {
      const fileRegex = /<file path="([^"]+)">([^]*?)<\/file>/g;
      const files: Array<{ path: string; content: string }> = [];
      let match;

      while ((match = fileRegex.exec(code)) !== null) {
        files.push({
          path: match[1],
          content: match[2].trim(),
        });
      }

      if (files.length === 0) {
        console.warn("[generation] No files to apply");
        return sandbox;
      }

      const { data, error } = await supabase.functions.invoke("apply-code", {
        body: {
          sandboxId: sandbox.sandboxId,
          files,
        },
      });

      if (error) {
        // Check if it's a sandbox expired error (410 status)
        if (error.message?.includes("SANDBOX_EXPIRED") || error.message?.includes("410")) {
          console.log("[generation] Sandbox expired, creating new one...");
          addMessage("Sandbox expired, creating a new one...", "system");
          
          const newSandbox = await createSandbox();
          if (!newSandbox) {
            throw new Error("Failed to create new sandbox");
          }
          
          // Retry with new sandbox
          const retryResult = await supabase.functions.invoke("apply-code", {
            body: {
              sandboxId: newSandbox.sandboxId,
              files,
            },
          });
          
          if (retryResult.error) throw retryResult.error;
          if (!retryResult.data?.success) throw new Error(retryResult.data?.error || "Failed to apply code");
          
          console.log("[generation] Code applied to new sandbox:", retryResult.data.results);
          return newSandbox;
        }
        throw error;
      }
      
      if (!data?.success) {
        if (data?.error === "SANDBOX_EXPIRED") {
          console.log("[generation] Sandbox expired, creating new one...");
          addMessage("Sandbox expired, creating a new one...", "system");
          
          const newSandbox = await createSandbox();
          if (!newSandbox) {
            throw new Error("Failed to create new sandbox");
          }
          
          // Retry with new sandbox
          const retryResult = await supabase.functions.invoke("apply-code", {
            body: {
              sandboxId: newSandbox.sandboxId,
              files,
            },
          });
          
          if (retryResult.error) throw retryResult.error;
          if (!retryResult.data?.success) throw new Error(retryResult.data?.error || "Failed to apply code");
          
          console.log("[generation] Code applied to new sandbox:", retryResult.data.results);
          return newSandbox;
        }
        throw new Error(data?.error || "Failed to apply code");
      }

      console.log("[generation] Code applied:", data.results);
      return sandbox;
    } catch (error) {
      console.error("[generation] Apply error:", error);
      throw error;
    }
  };

  const handleSubmit = async (inputValue?: string, imageData?: string) => {
    const input = (typeof inputValue === 'string' ? inputValue : chatInput).trim();
    if (!input && !imageData) return;

    setChatInput("");
    setLoading(true);

    try {
      if (isUrl(input) && !imageData) {
        // It's a URL - scrape and clone
        const scraped = await scrapeUrl(input);
        if (scraped) {
          await generateCode(`Clone this website: ${input}`, scraped);
        }
      } else {
        // It's a prompt (with optional image) - generate directly
        await generateCode(input || "Analyze this image and create something based on it", scrapedData, false, imageData);
      }
    } catch (error) {
      console.error("[generation] Submit error:", error);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };
  
  // Handle visual editor updates
  const handleVisualEditorUpdate = (newHtml: string) => {
    // For now, we'll update the index.html file in generationFiles
    const indexFileIndex = generationFiles.findIndex(f => f.path === "index.html" || f.path === "src/App.jsx");
    
    if (indexFileIndex >= 0) {
      const updatedFiles = [...generationFiles];
      updatedFiles[indexFileIndex] = {
        ...updatedFiles[indexFileIndex],
        content: newHtml,
      };
      setGenerationFiles(updatedFiles);
      
      // Update streamed code
      const codeStr = updatedFiles.map(f => `<file path="${f.path}">\n${f.content}\n</file>`).join("\n\n");
      setStreamedCode(codeStr);
      
      // Save to project_files
      if (projectId) {
        supabase
          .from("project_files")
          .upsert({
            project_id: projectId,
            file_path: updatedFiles[indexFileIndex].path,
            content: newHtml,
          }, { onConflict: "project_id,file_path" })
          .then(({ error }) => {
            if (error) console.error("Error saving visual edit:", error);
          });
      }
      
      // Apply to sandbox
      if (sandboxData) {
        supabase.functions.invoke("apply-code", {
          body: {
            sandboxId: sandboxData.sandboxId,
            files: [{ path: updatedFiles[indexFileIndex].path, content: newHtml }],
          },
        }).then(({ error }) => {
          if (error) console.error("Error applying visual edit to sandbox:", error);
        });
      }
    }
  };
  
  // Get HTML for visual editor
  const getVisualEditorHtml = (): string => {
    const indexFile = generationFiles.find(f => f.path === "index.html");
    if (indexFile) return indexFile.content;
    
    // Try to build HTML from App.jsx
    const appFile = generationFiles.find(f => f.path === "src/App.jsx");
    if (appFile) {
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VIPE DZ App</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <div id="root"></div>
  <script type="module">
    ${appFile.content}
  </script>
</body>
</html>`;
    }
    
    return "";
  };

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading your account...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  // Show loading state while loading session
  if (initialLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading your project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Desktop Layout */}
      <div className="hidden md:flex w-full">
        {/* Sidebar - Chat & Controls */}
        <GenerationSidebar
          chatMessages={chatMessages}
          chatInput={chatInput}
          setChatInput={setChatInput}
          onSubmit={(imageData) => handleSubmit(chatInput, imageData)}
          onKeyDown={handleKeyDown}
          isLoading={loading || isGenerating || isScrapingUrl}
          chatContainerRef={chatContainerRef}
          onBack={() => navigate("/builder")}
          urlScreenshot={urlScreenshot}
          supabaseConnection={supabaseConnection}
          onOpenSupabaseModal={() => setShowSupabaseModal(true)}
          aiMode={aiMode}
          onModeChange={setAiMode}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Tabs */}
          <div className="h-12 border-b border-border flex items-center px-4 gap-4 bg-card">
            <button
              onClick={() => setActiveTab("preview")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === "preview"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              Preview
            </button>
            <button
              onClick={() => setActiveTab("code")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === "code"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
            Code
            </button>
            
            {/* Visual Edit Button */}
            {generationFiles.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowVisualEditor(true)}
                className="gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Visual Edit
              </Button>
            )}
            
            {sandboxData && (
              <span className="ml-auto text-xs text-muted-foreground">
                {projectName}
              </span>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === "preview" ? (
              <GenerationPreview
                sandboxUrl={sandboxData?.url || null}
                sandboxId={sandboxData?.sandboxId || null}
                iframeRef={iframeRef}
                isLoading={isGenerating || isScrapingUrl}
                screenshot={urlScreenshot}
                files={Object.fromEntries(generationFiles.map((f) => [f.path, f.content]))}
              />
            ) : (
              <GenerationCodePanel
                files={generationFiles}
                streamedCode={streamedCode}
                selectedFile={selectedFile}
                onSelectFile={setSelectedFile}
                isGenerating={isGenerating}
              />
            )}
          </div>
        </div>
      </div>

      {/* Mobile Layout - Separate Chat and Preview tabs */}
      <div className="flex md:hidden flex-col w-full h-full">
        {/* Mobile Header with Tabs */}
        <div className="h-12 border-b border-border flex items-center justify-between px-2 bg-card">
          <Button variant="ghost" size="icon" onClick={() => navigate("/builder")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setMobileView("chat")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                mobileView === "chat"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setMobileView("preview")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                mobileView === "preview"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              Preview
            </button>
          </div>
          
          <Button
            variant={supabaseConnection?.connected ? "outline" : "ghost"}
            size="icon"
            onClick={() => setShowSupabaseModal(true)}
          >
            {supabaseConnection?.connected ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <Database className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Mobile Content */}
        <div className="flex-1 overflow-hidden">
          {mobileView === "chat" ? (
            <div className="flex flex-col h-full">
              {/* Chat Messages */}
              <ScrollArea className="flex-1">
                <div ref={chatContainerRef} className="p-4 space-y-4">
                  {chatMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                          message.type === "user"
                            ? "bg-primary text-primary-foreground"
                            : message.type === "ai"
                            ? "bg-muted text-foreground"
                            : "bg-muted/50 text-muted-foreground text-sm"
                        }`}
                      >
                        {message.metadata?.imageUrl && (
                          <div className="mb-2 rounded-lg overflow-hidden">
                            <img
                              src={message.metadata.imageUrl}
                              alt="Attached"
                              className="max-w-full h-auto max-h-32 object-contain"
                            />
                          </div>
                        )}
                        <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                      </div>
                    </div>
                  ))}
                  
                  {(loading || isGenerating || isScrapingUrl) && (
                    <div className="flex justify-start">
                      <div className="bg-muted/50 rounded-2xl px-4 py-2.5 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">Processing...</span>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Mobile Input */}
              <div className="p-3 border-t border-border bg-card">
                <div className="flex items-center gap-2">
                  <Textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Describe what to build..."
                    className="min-h-[44px] max-h-[120px] resize-none bg-background text-sm"
                    disabled={loading || isGenerating}
                  />
                  <Button
                    size="icon"
                    onClick={() => handleSubmit()}
                    disabled={loading || isGenerating || !chatInput.trim()}
                  >
                    {loading || isGenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <GenerationPreview
              sandboxUrl={sandboxData?.url || null}
              sandboxId={sandboxData?.sandboxId || null}
              iframeRef={iframeRef}
              isLoading={isGenerating || isScrapingUrl}
              screenshot={urlScreenshot}
              files={Object.fromEntries(generationFiles.map((f) => [f.path, f.content]))}
            />
          )}
        </div>
      </div>

      {/* Supabase Connection Modal */}
      <SupabaseConnectionModal
        open={showSupabaseModal}
        onOpenChange={setShowSupabaseModal}
        projectId={projectId || sessionId}
        onConnected={handleSupabaseConnected}
      />
      
      {/* Visual Editor */}
      {showVisualEditor && (
        <VisualEditor
          html={getVisualEditorHtml()}
          onUpdate={handleVisualEditorUpdate}
          onClose={() => setShowVisualEditor(false)}
        />
      )}
    </div>
  );
}
