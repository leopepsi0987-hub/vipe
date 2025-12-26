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

  // Reset error state when URL changes
  useEffect(() => {
    setIframeError(false);
  }, [sandboxUrl]);

  const handleRefresh = () => {
    setIframeError(false);
    if (iframeRef.current && sandboxUrl) {
      iframeRef.current.src = `${sandboxUrl}?t=${Date.now()}`;
    }
  };

  const handleOpenExternal = () => {
    if (sandboxUrl) {
      window.open(sandboxUrl, "_blank");
    }
  };

  const handleIframeError = () => {
    setIframeError(true);
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

  // Sandbox loaded - show open externally message (iframe embedding is blocked by E2B)
  if (sandboxUrl) {
    return (
      <div className="relative w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center max-w-lg px-6">
          {/* Success icon */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30">
            <Rocket className="w-10 h-10 text-white" />
          </div>

          <h3 className="text-2xl font-bold text-white mb-3">
            Your App is Ready! 🎉
          </h3>

          <p className="text-slate-300 mb-6">
            Your generated app is running in a live sandbox environment.
            Click the button below to view it in a new tab.
          </p>

          <Button
            size="lg"
            onClick={handleOpenExternal}
            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold px-8 py-6 text-lg shadow-lg shadow-orange-500/30"
          >
            <ExternalLink className="w-5 h-5 mr-2" />
            Open Your App
          </Button>

          <p className="text-slate-500 text-sm mt-6">
            <AlertCircle className="w-4 h-4 inline mr-1" />
            The sandbox preview opens in a new tab for security reasons
          </p>

          {/* Sandbox info */}
          <div className="mt-8 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <p className="text-slate-400 text-xs font-mono break-all">
              {sandboxUrl}
            </p>
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
          Enter a URL to clone or describe what you want to build
        </p>
      </div>
    </div>
  );
}
