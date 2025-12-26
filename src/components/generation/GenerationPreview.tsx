import { RefObject, useState, useEffect } from "react";
import { Loader2, RefreshCw, ExternalLink, AlertCircle, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GenerationPreviewProps {
  sandboxUrl: string | null;
  iframeRef: RefObject<HTMLIFrameElement>;
  isLoading: boolean;
  screenshot?: string | null;
}

export function GenerationPreview({
  sandboxUrl,
  iframeRef,
  isLoading,
  screenshot,
}: GenerationPreviewProps) {
  const [iframeError, setIframeError] = useState(false);

  // Build proxied URL for iframe embedding
  const getProxiedUrl = (url: string): string => {
    const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sandbox-proxy`;
    return `${proxyUrl}?url=${encodeURIComponent(url)}`;
  };

  // Reset error state when URL changes
  useEffect(() => {
    setIframeError(false);
  }, [sandboxUrl]);

  const handleRefresh = () => {
    setIframeError(false);
    if (iframeRef.current && sandboxUrl) {
      iframeRef.current.src = getProxiedUrl(sandboxUrl) + `&t=${Date.now()}`;
    }
  };

  const handleOpenExternal = () => {
    if (sandboxUrl) {
      window.open(sandboxUrl, "_blank");
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
        <div className="absolute bottom-4 right-4 flex gap-2">
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
