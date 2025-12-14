import { useEffect, useRef, useState } from "react";
import { RefreshCw, Maximize2, Minimize2, Monitor, Tablet, Smartphone, Globe, Link2, Check, Loader2, Eye, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PreviewProps {
  html: string;
  projectId?: string;
  projectName?: string;
  isPublished?: boolean;
  slug?: string | null;
  onPublish?: () => Promise<any>;
  onUnpublish?: () => Promise<any>;
  activeView?: "preview" | "code";
  onViewChange?: (view: "preview" | "code") => void;
}

type DeviceMode = "desktop" | "tablet" | "mobile";

export function Preview({ 
  html, 
  projectId, 
  projectName, 
  isPublished, 
  slug, 
  onPublish, 
  onUnpublish,
  activeView = "preview",
  onViewChange
}: PreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [localView, setLocalView] = useState<"preview" | "code">(activeView);
  
  const currentView = onViewChange ? activeView : localView;
  const handleViewChange = (view: "preview" | "code") => {
    if (onViewChange) {
      onViewChange(view);
    } else {
      setLocalView(view);
    }
  };

  useEffect(() => {
    if (iframeRef.current && html) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
      }
    }
  }, [html]);

  const handleRefresh = () => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
      }
    }
  };

  const handlePublish = async () => {
    if (!onPublish) return;
    setPublishing(true);
    try {
      const result = await onPublish();
      if (result) {
        toast.success("App published! 🚀", {
          description: "Your app is now live and shareable.",
        });
      }
    } catch (error) {
      toast.error("Failed to publish");
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (!onUnpublish) return;
    setPublishing(true);
    try {
      await onUnpublish();
      toast.success("App unpublished");
    } catch (error) {
      toast.error("Failed to unpublish");
    } finally {
      setPublishing(false);
    }
  };

  const copyLink = () => {
    if (!slug) return;
    const url = `https://vipe.lovable.app/app/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const deviceConfig = {
    desktop: { width: "100%", height: "100%" },
    tablet: { width: "768px", height: "1024px" },
    mobile: { width: "375px", height: "667px" },
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-editor-bg rounded-xl overflow-hidden",
        isFullscreen && "fixed inset-0 z-50"
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-destructive/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <span className="text-muted-foreground text-sm ml-2">Preview</span>
        </div>

        <div className="flex items-center gap-1">
          {/* View toggle */}
          <div className="flex bg-secondary rounded-md p-0.5 mr-2">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-3 rounded-sm text-xs",
                currentView === "preview" && "bg-background shadow-sm"
              )}
              onClick={() => handleViewChange("preview")}
            >
              <Eye className="w-3 h-3 mr-1" />
              Preview
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-3 rounded-sm text-xs",
                currentView === "code" && "bg-background shadow-sm"
              )}
              onClick={() => handleViewChange("code")}
            >
              <Code className="w-3 h-3 mr-1" />
              Code
            </Button>
          </div>

          {/* Device mode buttons - only show in preview mode */}
          {currentView === "preview" && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8", deviceMode === "desktop" && "bg-secondary")}
                onClick={() => setDeviceMode("desktop")}
              >
                <Monitor className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8", deviceMode === "tablet" && "bg-secondary")}
                onClick={() => setDeviceMode("tablet")}
              >
                <Tablet className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8", deviceMode === "mobile" && "bg-secondary")}
                onClick={() => setDeviceMode("mobile")}
              >
                <Smartphone className="w-4 h-4" />
              </Button>
              
              <div className="w-px h-4 bg-border mx-1" />
              
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRefresh}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </Button>

          {/* Publish section */}
          {projectId && (
            <>
              <div className="w-px h-4 bg-border mx-1" />
              
              {isPublished && slug ? (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-2 text-green-500"
                    onClick={copyLink}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                    {copied ? "Copied!" : "Copy Link"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={handleUnpublish}
                    disabled={publishing}
                  >
                    Unpublish
                  </Button>
                </div>
              ) : (
                <Button
                  variant="glow"
                  size="sm"
                  className="h-8 gap-2"
                  onClick={handlePublish}
                  disabled={publishing}
                >
                  {publishing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Globe className="w-4 h-4" />
                  )}
                  Publish
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Preview Area */}
      {currentView === "preview" ? (
        <div className="flex-1 flex items-center justify-center p-4 bg-[#1a1a2e] overflow-auto">
          <div
            className={cn(
              "bg-white rounded-lg shadow-2xl overflow-hidden transition-all duration-300",
              deviceMode !== "desktop" && "border-4 border-gray-800"
            )}
            style={{
              width: deviceConfig[deviceMode].width,
              height: deviceConfig[deviceMode].height,
              maxWidth: "100%",
              maxHeight: "100%",
            }}
          >
            <iframe
              ref={iframeRef}
              title="Preview"
              className="w-full h-full border-0 bg-white"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1 bg-[#1a1a2e]">
          <pre className="p-4 text-sm font-mono text-green-400 whitespace-pre-wrap break-all">
            <code>{html || "// No code generated yet"}</code>
          </pre>
        </ScrollArea>
      )}
    </div>
  );
}
