import { RefObject, useState, useEffect, useRef, useCallback } from "react";
import { Loader2, RefreshCw, ExternalLink, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GenerationPreviewProps {
  sandboxUrl: string | null;
  sandboxId: string | null;
  iframeRef: RefObject<HTMLIFrameElement>;
  isLoading: boolean;
  screenshot?: string | null;
}

export function GenerationPreview({
  sandboxUrl,
  sandboxId,
  iframeRef,
  isLoading,
  screenshot,
}: GenerationPreviewProps) {
  const [iframeError, setIframeError] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isAutoRetrying, setIsAutoRetrying] = useState(false);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const maxRetries = 8;
  const retryDelay = 2000; // 2 seconds between retries

  // Build proxied URL for iframe embedding
  const getProxiedUrl = useCallback((url: string): string => {
    const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sandbox-proxy`;
    return `${proxyUrl}?url=${encodeURIComponent(url)}`;
  }, []);

  // Reset states when URL changes
  useEffect(() => {
    setIframeError(false);
    setRetryCount(0);
    setIsAutoRetrying(false);
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, [sandboxUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  // Auto-retry mechanism - check if iframe loaded properly
  const checkAndRetry = useCallback(async () => {
    if (!sandboxUrl || !iframeRef.current || isLoading) return;

    try {
      // Try to fetch the URL directly to check if it's ready
      const proxyUrl = getProxiedUrl(sandboxUrl);
      const response = await fetch(proxyUrl, { method: 'HEAD' });
      
      // Check iframe content for error messages
      const iframe = iframeRef.current;
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        const bodyText = iframeDoc?.body?.innerText || '';
        
        // If we see error indicators, retry
        if (bodyText.includes('Starting Server') || bodyText.includes('Closed Port') || bodyText.includes('BLURRED')) {
          if (retryCount < maxRetries) {
            setIsAutoRetrying(true);
            setRetryCount(prev => prev + 1);
            retryTimerRef.current = setTimeout(() => {
              handleRefresh();
              // Schedule next check
              setTimeout(checkAndRetry, retryDelay);
            }, retryDelay);
          } else {
            setIsAutoRetrying(false);
          }
          return;
        }
      } catch {
        // Cross-origin, can't check content - that's okay
      }

      // If response is OK, we're good
      if (response.ok) {
        setIsAutoRetrying(false);
        setRetryCount(0);
      }
    } catch {
      // Network error, try again
      if (retryCount < maxRetries) {
        setIsAutoRetrying(true);
        setRetryCount(prev => prev + 1);
        retryTimerRef.current = setTimeout(() => {
          handleRefresh();
          setTimeout(checkAndRetry, retryDelay);
        }, retryDelay);
      }
    }
  }, [sandboxUrl, iframeRef, isLoading, retryCount, getProxiedUrl]);

  // Start auto-retry when sandbox URL changes and we're not loading
  useEffect(() => {
    if (sandboxUrl && !isLoading) {
      // Give initial load a moment, then start checking
      const timer = setTimeout(checkAndRetry, 3000);
      return () => clearTimeout(timer);
    }
  }, [sandboxUrl, isLoading]);

  const handleRefresh = useCallback(() => {
    setIframeError(false);
    if (iframeRef.current && sandboxUrl) {
      iframeRef.current.src = getProxiedUrl(sandboxUrl) + `&t=${Date.now()}`;
    }
  }, [iframeRef, sandboxUrl, getProxiedUrl]);

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
          files: [], // Empty files = just restart Vite
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to restart server");

      toast.success("Server restarted!");
      
      // Start auto-retry after restart
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
  if (isLoading && !sandboxUrl) {
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

  // Sandbox loaded - show iframe with proxied URL
  if (sandboxUrl) {
    const proxiedUrl = getProxiedUrl(sandboxUrl);

    return (
      <div className="relative w-full h-full">
        <iframe
          ref={iframeRef}
          src={proxiedUrl}
          className="w-full h-full border-none bg-white"
          title="Sandbox Preview"
          allow="clipboard-write"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
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
          Enter a URL to clone or describe what you want to build
        </p>
      </div>
    </div>
  );
}
