import { RefObject, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Loader2, RefreshCw, ExternalLink, Play, Zap, Globe, Monitor, Tablet, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SandboxPreview } from "@/components/SandboxPreview";
import { cn } from "@/lib/utils";

interface GenerationPreviewProps {
  sandboxUrl: string | null;
  sandboxId: string | null;
  projectId?: string | null;
  iframeRef: RefObject<HTMLIFrameElement>;
  isLoading: boolean;
  screenshot?: string | null;
  files?: Record<string, string>;
  onRecoverSandbox?: () => Promise<void>;
}

type DeviceMode = "desktop" | "tablet" | "mobile";
type PreviewEngine = "local" | "sandbox";

export function GenerationPreview({
  sandboxUrl,
  sandboxId,
  projectId,
  iframeRef,
  isLoading,
  screenshot,
  files,
  onRecoverSandbox,
}: GenerationPreviewProps) {
  const [iframeError, setIframeError] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isAutoRetrying, setIsAutoRetrying] = useState(false);
  const [previewEngine, setPreviewEngine] = useState<PreviewEngine>("local"); // Default to local bundler
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const maxRetries = 10;
  const retryDelay = 1500;

  const hasFiles = files && Object.keys(files).length > 0;

  const deviceConfig = {
    desktop: { width: "100%", height: "100%" },
    tablet: { width: "768px", height: "1024px" },
    mobile: { width: "375px", height: "667px" },
  };

  // Use sandbox-proxy to avoid X-Frame-Options restrictions from E2B
  const getSandboxUrl = useCallback((url: string): string => {
    let fullUrl = url;
    if (!fullUrl.startsWith("http://") && !fullUrl.startsWith("https://")) {
      fullUrl = `https://${fullUrl}`;
    }

    let backendBase = import.meta.env.VITE_SUPABASE_URL || "";
    backendBase = backendBase.replace(/^http:\/\//, "https://");

    return `${backendBase}/functions/v1/sandbox-proxy?url=${encodeURIComponent(fullUrl)}`;
  }, []);

  const handleRefresh = useCallback(() => {
    setIframeError(false);
    if (previewEngine === "sandbox" && iframeRef.current && sandboxUrl) {
      iframeRef.current.src = getSandboxUrl(sandboxUrl) + `?t=${Date.now()}`;
    }
    // For local engine, SandboxPreview handles refresh internally
  }, [iframeRef, sandboxUrl, getSandboxUrl, previewEngine]);

  useEffect(() => {
    setIframeError(false);
    setRetryCount(0);
    setIsAutoRetrying(false);
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, [sandboxUrl]);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  const checkAndRetry = useCallback(async () => {
    if (previewEngine !== "sandbox") return;
    if (!sandboxUrl || !iframeRef.current || isLoading) return;

    try {
      const response = await fetch(getSandboxUrl(sandboxUrl), { cache: "no-store" });
      const html = await response.text().catch(() => "");

      const isExpired = html.includes("Sandbox Expired") || html.includes("Sandbox Not Found") || html.includes("wasn't found");
      if (isExpired && onRecoverSandbox) {
        setIsAutoRetrying(false);
        setRetryCount(0);
        await onRecoverSandbox();
        return;
      }

      if (!response.ok) throw new Error(`Proxy not ready: ${response.status}`);

      const isStarting = html.includes("Starting Server") || html.includes("Closed Port") || html.includes("Connection refused");
      if (isStarting) {
        if (retryCount < maxRetries) {
          setIsAutoRetrying(true);
          setRetryCount((prev) => prev + 1);
          retryTimerRef.current = setTimeout(() => {
            handleRefresh();
            setTimeout(checkAndRetry, retryDelay);
          }, retryDelay);
        } else {
          setIsAutoRetrying(false);
          if (onRecoverSandbox) {
            await onRecoverSandbox();
          }
        }
        return;
      }

      setIsAutoRetrying(false);
      setRetryCount(0);
    } catch {
      if (retryCount < maxRetries) {
        setIsAutoRetrying(true);
        setRetryCount((prev) => prev + 1);
        retryTimerRef.current = setTimeout(() => {
          handleRefresh();
          setTimeout(checkAndRetry, retryDelay);
        }, retryDelay);
      } else {
        setIsAutoRetrying(false);
        if (onRecoverSandbox) {
          await onRecoverSandbox();
        }
      }
    }
  }, [sandboxUrl, iframeRef, isLoading, retryCount, onRecoverSandbox, handleRefresh, getSandboxUrl, previewEngine]);

  useEffect(() => {
    if (previewEngine === "sandbox" && sandboxUrl && !isLoading) {
      const timer = setTimeout(checkAndRetry, 3000);
      return () => clearTimeout(timer);
    }
  }, [sandboxUrl, isLoading, previewEngine]);

  const handleOpenExternal = () => {
    if (sandboxUrl) {
      window.open(sandboxUrl, "_blank");
    }
  };

  const handleRestartServer = async () => {
    if (!sandboxId) {
      toast.error("No sandbox available");
      return;
    }

    setIsRestarting(true);
    setRetryCount(0);
    try {
      const { data, error } = await supabase.functions.invoke("apply-code", {
        body: {
          sandboxId,
          files: [],
        },
      });

      if ((error as any)?.status === 410 || data?.error === "SANDBOX_EXPIRED") {
        if (onRecoverSandbox) {
          await onRecoverSandbox();
        } else {
          throw new Error("Sandbox expired");
        }
        return;
      }

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to restart server");

      toast.success("Server restarted!");

      setIsAutoRetrying(true);
      setTimeout(() => {
        handleRefresh();
        setTimeout(checkAndRetry, retryDelay);
      }, 1500);
    } catch (err) {
      console.error("[GenerationPreview] Restart error:", err);
      toast.error("Failed to restart server");
    } finally {
      setIsRestarting(false);
    }
  };

  // Loading state with screenshot background
  if (isLoading && !sandboxUrl && !hasFiles) {
    return (
      <div className="relative w-full h-full bg-slate-900">
        {screenshot && (
          <img
            src={screenshot}
            alt="Preview"
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          />
        )}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center">
          <div className="text-center max-w-md">
            <div className="mb-8 space-y-3">
              <div
                className="h-2 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded animate-pulse"
                style={{ animationDuration: "1.5s" }}
              />
              <div
                className="h-2 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded animate-pulse w-4/5 mx-auto"
                style={{ animationDuration: "1.5s", animationDelay: "0.2s" }}
              />
              <div
                className="h-2 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded animate-pulse w-3/5 mx-auto"
                style={{ animationDuration: "1.5s", animationDelay: "0.4s" }}
              />
            </div>

            <Loader2 className="w-8 h-8 animate-spin text-white mx-auto mb-4" />
            <p className="text-white text-lg font-medium">Generating your app...</p>
            <p className="text-white/60 text-sm mt-2">
              Analyzing design and writing React components
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If we have files, use LOCAL bundler by default (same as /project page) - THIS IS THE FIX!
  if (hasFiles && previewEngine === "local") {
    return (
      <div className="relative w-full h-full flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-2 bg-card/80 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-destructive/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
            </div>
            <span className="text-xs text-muted-foreground ml-2">Local Preview</span>
          </div>

          <div className="flex items-center gap-1">
            {/* Preview Engine Toggle */}
            <div className="flex bg-secondary rounded-md p-0.5 mr-2">
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-6 px-2 rounded-sm text-xs gap-1", "bg-background shadow-sm")}
                onClick={() => {
                  toast.info("Already in Fast mode");
                }}
              >
                <Zap className="w-3 h-3" />
                Fast
              </Button>
              {sandboxUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 rounded-sm text-xs gap-1"
                  onClick={() => {
                    setPreviewEngine("sandbox");
                    toast.success("Sandbox mode", { description: "Real Vite dev server (slower startup)" });
                  }}
                >
                  <Globe className="w-3 h-3" />
                  Full
                </Button>
              )}
            </div>

            {/* Device Mode */}
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-7 w-7", deviceMode === "desktop" && "bg-secondary")}
              onClick={() => setDeviceMode("desktop")}
            >
              <Monitor className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-7 w-7", deviceMode === "tablet" && "bg-secondary")}
              onClick={() => setDeviceMode("tablet")}
            >
              <Tablet className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-7 w-7", deviceMode === "mobile" && "bg-secondary")}
              onClick={() => setDeviceMode("mobile")}
            >
              <Smartphone className="w-3.5 h-3.5" />
            </Button>

            <div className="w-px h-4 bg-border mx-1" />

            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={handleRefresh}
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 flex items-center justify-center bg-muted/30 p-4 overflow-hidden">
          <div
            className="bg-background rounded-lg overflow-hidden shadow-lg border border-border transition-all duration-300"
            style={{
              width: deviceConfig[deviceMode].width,
              height: deviceConfig[deviceMode].height,
              maxWidth: "100%",
              maxHeight: "100%",
            }}
          >
            <SandboxPreview files={files} className="w-full h-full" useESM={false} />
          </div>
        </div>

        {/* Loading overlay during regeneration */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-card rounded-lg p-4 shadow-xl flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm font-medium">Updating...</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Sandbox mode (external E2B server) - fallback option
  if (sandboxUrl && previewEngine === "sandbox") {
    const iframeSrc = getSandboxUrl(sandboxUrl);

    return (
      <div className="relative w-full h-full flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-2 bg-card/80 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-destructive/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
            </div>
            <span className="text-xs text-muted-foreground ml-2">Sandbox Preview</span>
          </div>

          <div className="flex items-center gap-1">
            {/* Preview Engine Toggle */}
            {hasFiles && (
              <div className="flex bg-secondary rounded-md p-0.5 mr-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 rounded-sm text-xs gap-1"
                  onClick={() => {
                    setPreviewEngine("local");
                    toast.success("Local mode", { description: "Instant preview with client-side bundler" });
                  }}
                >
                  <Zap className="w-3 h-3" />
                  Fast
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("h-6 px-2 rounded-sm text-xs gap-1", "bg-background shadow-sm")}
                  onClick={() => {
                    toast.info("Already in Full mode");
                  }}
                >
                  <Globe className="w-3 h-3" />
                  Full
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* iframe */}
        <div className="flex-1 relative">
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            className="w-full h-full border-none bg-white"
            title="Sandbox Preview"
            allow="clipboard-write"
          />

          {/* Floating controls */}
          <div className="absolute bottom-4 right-4 flex gap-2 items-center">
            {isAutoRetrying && (
              <span className="text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                Waiting for server... ({retryCount}/{maxRetries})
              </span>
            )}
            <Button
              size="sm"
              variant="secondary"
              className="shadow-lg"
              onClick={handleRestartServer}
              disabled={isRestarting || !sandboxId}
            >
              {isRestarting ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-1" />
              )}
              Restart Server
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="shadow-lg"
              onClick={handleRefresh}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="shadow-lg"
              onClick={handleOpenExternal}
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              Open
            </Button>
          </div>
        </div>

        {/* Loading overlay during regeneration */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-card rounded-lg p-4 shadow-xl flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm font-medium">Updating...</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Empty state
  return (
    <div className="w-full h-full flex items-center justify-center bg-muted/30">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl font-bold text-white">V</span>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Ready to Build
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Enter a URL to clone or describe what you want to build with VIPE DZ
        </p>
      </div>
    </div>
  );
}
