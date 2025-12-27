import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GenerationSidebar } from "@/components/generation/GenerationSidebar";
import { GenerationPreview } from "@/components/generation/GenerationPreview";
import { GenerationCodePanel } from "@/components/generation/GenerationCodePanel";
import { Loader2 } from "lucide-react";

interface SandboxData {
  sandboxId: string;
  url: string;
}

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

interface GenerationFile {
  path: string;
  content: string;
  type: string;
  completed: boolean;
}

export default function GenerationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Core state
  const [sandboxData, setSandboxData] = useState<SandboxData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      content: "Welcome! Enter a URL to clone or describe what you want to build.",
      type: "system",
      timestamp: new Date(),
    },
  ]);
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

  const addMessage = (content: string, type: ChatMessage["type"], metadata?: any) => {
    setChatMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        content,
        type,
        timestamp: new Date(),
        metadata,
      },
    ]);
  };

  const isUrl = (str: string): boolean => {
    const urlPattern = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/;
    return urlPattern.test(str.trim());
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

  const generateCode = async (prompt: string, scrapedContent?: any) => {
    setIsGenerating(true);
    setStreamedCode("");
    setGenerationFiles([]);
    setActiveTab("code");

    try {
      addMessage(prompt, "user");
      
      // Create sandbox if not exists
      let sandbox = sandboxData;
      if (!sandbox) {
        sandbox = await createSandbox();
        if (!sandbox) {
          throw new Error("Failed to create sandbox");
        }
      }

      addMessage("Generating code...", "system");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ai-code`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            prompt,
            scrapedContent,
            context: {
              sandboxId: sandbox.sandboxId,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate code");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

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
                setStreamedCode(fullContent);
                parseFilesFromCode(fullContent);
              } else if (data.type === "complete") {
                fullContent = data.generatedCode || fullContent;
                setStreamedCode(fullContent);
                parseFilesFromCode(fullContent);

                // Apply code to sandbox (may create new one if expired)
                const activeSandbox = await applyCodeToSandbox(sandbox, fullContent);
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

        // Final flush (in case last line didn't end with newline)
        if (textBuffer.trim().startsWith("data: ")) {
          try {
            const data = JSON.parse(textBuffer.trim().slice(6));
            if (data?.type === "complete") {
              fullContent = data.generatedCode || fullContent;
              setStreamedCode(fullContent);
              parseFilesFromCode(fullContent);
              const activeSandbox = await applyCodeToSandbox(sandbox, fullContent);
              if (activeSandbox !== sandbox) {
                sandbox = activeSandbox;
              }
            }
          } catch {
            // ignore
          }
        }
      }

      addMessage("Code generated and applied!", "ai", {
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

  const parseFilesFromCode = (code: string) => {
    const fileRegex = /<file path="([^"]+)">([^]*?)<\/file>/g;
    const files: GenerationFile[] = [];
    let match;

    while ((match = fileRegex.exec(code)) !== null) {
      const filePath = match[1];
      const fileContent = match[2].trim();
      const ext = filePath.split(".").pop() || "";
      
      files.push({
        path: filePath,
        content: fileContent,
        type: ext === "jsx" || ext === "js" ? "javascript" : ext,
        completed: true,
      });
    }

    if (files.length > 0) {
      setGenerationFiles(files);
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

  const handleSubmit = async (inputValue?: string) => {
    const input = (inputValue || chatInput).trim();
    if (!input) return;

    setChatInput("");
    setLoading(true);

    try {
      if (isUrl(input)) {
        // It's a URL - scrape and clone
        const scraped = await scrapeUrl(input);
        if (scraped) {
          await generateCode(`Clone this website: ${input}`, scraped);
        }
      } else {
        // It's a prompt - generate directly
        await generateCode(input, scrapedData);
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

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Sidebar - Chat & Controls */}
      <GenerationSidebar
        chatMessages={chatMessages}
        chatInput={chatInput}
        setChatInput={setChatInput}
        onSubmit={() => handleSubmit()}
        onKeyDown={handleKeyDown}
        isLoading={loading || isGenerating || isScrapingUrl}
        chatContainerRef={chatContainerRef}
        onBack={() => navigate("/builder")}
        urlScreenshot={urlScreenshot}
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
          
          {sandboxData && (
            <span className="ml-auto text-xs text-muted-foreground">
              Sandbox: {sandboxData.sandboxId}
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
  );
}
