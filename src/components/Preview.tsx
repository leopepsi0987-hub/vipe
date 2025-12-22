import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Code,
  Eye,
  Globe,
  Link2,
  Loader2,
  Maximize2,
  Minimize2,
  Monitor,
  RefreshCcw,
  RefreshCw,
  Smartphone,
  Tablet,
  Save,
} from "lucide-react";
import Editor from "@monaco-editor/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SandboxPreview } from "./SandboxPreview";

interface PreviewProps {
  html: string;
  files?: Record<string, string>;
  projectId?: string;
  projectName?: string;
  isPublished?: boolean;
  slug?: string | null;
  onPublish?: (customSlug?: string) => Promise<any>;
  onUpdatePublished?: () => Promise<any>;
  activeView?: "preview" | "code";
  onViewChange?: (view: "preview" | "code") => void;
  onCodeChange?: (code: string) => void;
  onFileChange?: (path: string, content: string) => void;
}

type DeviceMode = "desktop" | "tablet" | "mobile";

export function Preview({
  html,
  files,
  projectId,
  projectName,
  isPublished,
  slug,
  onPublish,
  onUpdatePublished,
  activeView = "preview",
  onViewChange,
  onCodeChange,
  onFileChange,
}: PreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [localView, setLocalView] = useState<"preview" | "code">(activeView);

  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [customSlug, setCustomSlug] = useState("");

  const isFileMode = !!files;
  const currentView = onViewChange ? activeView : localView;

  const deviceConfig = {
    desktop: { width: "100%", height: "100%" },
    tablet: { width: "768px", height: "1024px" },
    mobile: { width: "375px", height: "667px" },
  };

  const handleViewChange = (view: "preview" | "code") => {
    if (onViewChange) onViewChange(view);
    else setLocalView(view);
  };

  // HTML mode state
  const [editedHtml, setEditedHtml] = useState(html);
  const [hasUnsavedHtml, setHasUnsavedHtml] = useState(false);

  useEffect(() => {
    setEditedHtml(html);
    setHasUnsavedHtml(false);
  }, [html]);

  // File mode state (minimal: App.tsx only)
  const appPath = "src/App.tsx";
  const fileModeCode = useMemo(() => files?.[appPath] ?? "", [files]);
  const [editedFile, setEditedFile] = useState(fileModeCode);
  const [hasUnsavedFile, setHasUnsavedFile] = useState(false);

  useEffect(() => {
    setEditedFile(fileModeCode);
    setHasUnsavedFile(false);
  }, [fileModeCode]);

  // HTML preview injection
  useEffect(() => {
    if (isFileMode) return;
    if (!iframeRef.current) return;

    const doc = iframeRef.current.contentDocument;
    if (!doc) return;

    doc.open();
    doc.write(html || "");
    doc.close();
  }, [html, isFileMode]);

  const handleRefresh = () => {
    if (isFileMode) {
      toast.info("Preview refreshed");
      return;
    }
    if (!iframeRef.current) return;
    const doc = iframeRef.current.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(html || "");
    doc.close();
  };

  const copyLink = () => {
    if (!slug) return;
    const url = `https://vipe.lovable.app/app/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePublish = async () => {
    if (!onPublish) return;
    setPublishing(true);
    try {
      const slugToUse = customSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
      const result = await onPublish(slugToUse || undefined);
      if (result) {
        toast.success("App published", { description: "Your app is now live." });
        setShowPublishDialog(false);
        setCustomSlug("");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to publish");
    } finally {
      setPublishing(false);
    }
  };

  const handleUpdate = async () => {
    if (!onUpdatePublished) return;
    setPublishing(true);
    try {
      await onUpdatePublished();
      toast.success("App updated", { description: "Your changes are now live." });
    } catch {
      toast.error("Failed to update");
    } finally {
      setPublishing(false);
    }
  };

  const handleSave = () => {
    if (isFileMode) {
      if (!onFileChange) return;
      onFileChange(appPath, editedFile);
      setHasUnsavedFile(false);
      toast.success("Saved App.tsx");
      return;
    }

    if (!onCodeChange) return;
    onCodeChange(editedHtml);
    setHasUnsavedHtml(false);
    toast.success("Code saved!");
  };

  const showSave = currentView === "code" && (isFileMode ? hasUnsavedFile : hasUnsavedHtml);

  return (
    <div className={cn("flex flex-col h-full bg-card rounded-xl overflow-hidden", isFullscreen && "fixed inset-0 z-50")}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-destructive/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <span className="text-muted-foreground text-sm ml-2">
            {currentView === "preview" ? "Preview" : isFileMode ? "src/App.tsx" : "index.html"}
          </span>
          {showSave && <span className="text-xs text-yellow-500 ml-2">• Unsaved</span>}
        </div>

        <div className="flex items-center gap-1">
          {/* View toggle */}
          <div className="flex bg-secondary rounded-md p-0.5 mr-2">
            <Button
              variant="ghost"
              size="sm"
              className={cn("h-7 px-3 rounded-sm text-xs", currentView === "preview" && "bg-background shadow-sm")}
              onClick={() => handleViewChange("preview")}
            >
              <Eye className="w-3 h-3 mr-1" />
              Preview
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn("h-7 px-3 rounded-sm text-xs", currentView === "code" && "bg-background shadow-sm")}
              onClick={() => handleViewChange("code")}
            >
              <Code className="w-3 h-3 mr-1" />
              Code
            </Button>
          </div>

          {showSave && (
            <Button variant="glow" size="sm" className="h-7 px-3 text-xs mr-2" onClick={handleSave}>
              <Save className="w-3 h-3 mr-1" />
              Save
            </Button>
          )}

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

          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsFullscreen(!isFullscreen)}>
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>

          {/* Publish section */}
          {projectId && (
            <>
              <div className="w-px h-4 bg-border mx-1" />

              {isPublished && slug ? (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-8 gap-2 text-green-500" onClick={copyLink}>
                    {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                    {copied ? "Copied!" : "Copy Link"}
                  </Button>
                  <Button
                    variant="glow"
                    size="sm"
                    className="h-8 gap-2"
                    onClick={handleUpdate}
                    disabled={publishing}
                  >
                    {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                    Update
                  </Button>
                </div>
              ) : (
                <Button
                  variant="glow"
                  size="sm"
                  className="h-8 gap-2"
                  onClick={() => setShowPublishDialog(true)}
                  disabled={publishing}
                >
                  {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                  Publish
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Publish Dialog */}
      <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Publish Your App</DialogTitle>
            <DialogDescription>Choose a custom URL for your app. Leave empty for auto-generated.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="slug">Custom URL</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">vipe.lovable.app/app/</span>
                <Input
                  id="slug"
                  value={customSlug}
                  onChange={(e) => setCustomSlug(e.target.value)}
                  placeholder={projectName ? projectName.toLowerCase().replace(/\s+/g, "-") : "my-app"}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowPublishDialog(false)} disabled={publishing}>
                Cancel
              </Button>
              <Button variant="glow" onClick={handlePublish} disabled={publishing}>
                {publishing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Publish
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {currentView === "preview" ? (
          <div className="w-full h-full flex items-center justify-center bg-muted/30 p-4">
            <div
              className="bg-background rounded-xl overflow-hidden shadow-lg border border-border"
              style={{ width: deviceConfig[deviceMode].width, height: deviceConfig[deviceMode].height }}
            >
              {isFileMode ? (
                <SandboxPreview files={files ?? {}} className="w-full h-full" />
              ) : (
                <iframe
                  ref={iframeRef}
                  className="w-full h-full"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                  title="Preview"
                />
              )}
            </div>
          </div>
        ) : (
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={100} minSize={40}>
              <Editor
                height="100%"
                language={isFileMode ? "typescript" : "html"}
                theme="vs-dark"
                value={isFileMode ? editedFile : editedHtml}
                onChange={(value) => {
                  if (value === undefined) return;
                  if (isFileMode) {
                    setEditedFile(value);
                    setHasUnsavedFile(value !== fileModeCode);
                  } else {
                    setEditedHtml(value);
                    setHasUnsavedHtml(value !== html);
                  }
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  wordWrap: "on",
                  automaticLayout: true,
                }}
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={0} minSize={0} collapsible>
              {/* reserved */}
              <div className="h-full bg-card" />
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>
    </div>
  );
}
