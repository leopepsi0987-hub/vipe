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
  ChevronDown,
  Zap,
  Box,
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
import { WebContainerPreview } from "./WebContainerPreview";
import { FileExplorer } from "./FileExplorer";
import { generateBundledHTML } from "@/lib/sandboxBundler";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PreviewProps {
  html: string;
  files?: Record<string, string>;
  projectId?: string;
  projectName?: string;
  isPublished?: boolean;
  slug?: string | null;
  onPublish?: (customSlug?: string, bundledHtml?: string) => Promise<any>;
  onUpdatePublished?: (bundledHtml?: string) => Promise<any>;
  activeView?: "preview" | "code";
  onViewChange?: (view: "preview" | "code") => void;
  onCodeChange?: (code: string) => void;
  onFileChange?: (path: string, content: string) => void;
}

type DeviceMode = "desktop" | "tablet" | "mobile";
type PreviewEngine = "sandbox" | "esm" | "webcontainer";

function getLanguageForFile(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
      return "javascript";
    case "css":
      return "css";
    case "html":
      return "html";
    case "json":
      return "json";
    case "md":
      return "markdown";
    default:
      return "plaintext";
  }
}

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
  const [previewEngine, setPreviewEngine] = useState<PreviewEngine>("sandbox");
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [localView, setLocalView] = useState<"preview" | "code">(activeView);

  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [customSlug, setCustomSlug] = useState("");

  const isFileMode = !!files && Object.keys(files).length > 0;
  const currentView = onViewChange ? activeView : localView;

  // File mode: track selected file and edited content
  const filePaths = useMemo(() => (files ? Object.keys(files).sort() : []), [files]);
  const defaultFile = filePaths.find((p) => p === "src/App.tsx") || filePaths[0] || "";
  const [selectedFile, setSelectedFile] = useState<string>(defaultFile);
  const [editedFiles, setEditedFiles] = useState<Record<string, string>>({});

  // Reset selected file when files change
  useEffect(() => {
    if (files && !files[selectedFile]) {
      const newDefault = filePaths.find((p) => p === "src/App.tsx") || filePaths[0] || "";
      setSelectedFile(newDefault);
    }
  }, [files, filePaths, selectedFile]);

  // Get current file content (edited or original)
  const currentFileContent = useMemo(() => {
    if (!files || !selectedFile) return "";
    return editedFiles[selectedFile] ?? files[selectedFile] ?? "";
  }, [files, selectedFile, editedFiles]);

  const hasUnsavedChanges = useMemo(() => {
    if (!files || !selectedFile) return false;
    const edited = editedFiles[selectedFile];
    return edited !== undefined && edited !== files[selectedFile];
  }, [files, selectedFile, editedFiles]);

  const deviceConfig = {
    desktop: { width: "100%", height: "100%" },
    tablet: { width: "768px", height: "1024px" },
    mobile: { width: "375px", height: "667px" },
  };

  const handleViewChange = (view: "preview" | "code") => {
    if (onViewChange) onViewChange(view);
    else setLocalView(view);
  };

  // HTML mode state (legacy single-file mode)
  const [editedHtml, setEditedHtml] = useState(html);
  const [hasUnsavedHtml, setHasUnsavedHtml] = useState(false);

  useEffect(() => {
    setEditedHtml(html);
    setHasUnsavedHtml(false);
  }, [html]);

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
      const slugToUse = customSlug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-");

      const bundledHtml = isFileMode ? generateBundledHTML(files ?? {}) : undefined;

      const result = await onPublish(slugToUse || undefined, bundledHtml);
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
      const bundledHtml = isFileMode ? generateBundledHTML(files ?? {}) : undefined;
      await onUpdatePublished(bundledHtml);
      toast.success("App updated", { description: "Your changes are now live." });
    } catch {
      toast.error("Failed to update");
    } finally {
      setPublishing(false);
    }
  };

  const handleSave = () => {
    if (isFileMode) {
      if (!onFileChange || !selectedFile) return;
      const content = editedFiles[selectedFile];
      if (content !== undefined) {
        onFileChange(selectedFile, content);
        // Clear the edited state for this file
        setEditedFiles((prev) => {
          const next = { ...prev };
          delete next[selectedFile];
          return next;
        });
        toast.success(`Saved ${selectedFile.split("/").pop()}`);
      }
      return;
    }

    if (!onCodeChange) return;
    onCodeChange(editedHtml);
    setHasUnsavedHtml(false);
    toast.success("Code saved!");
  };

  const showSave = currentView === "code" && (isFileMode ? hasUnsavedChanges : hasUnsavedHtml);

  return (
    <div className={cn("flex flex-col h-full bg-card rounded-xl overflow-hidden", isFullscreen && "fixed inset-0 z-50")}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-destructive/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>

          {currentView === "code" && isFileMode ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="ml-2 h-7 gap-1 text-sm text-muted-foreground">
                  {selectedFile || "Select file"}
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-80 overflow-auto">
                {filePaths.map((path) => (
                  <DropdownMenuItem
                    key={path}
                    onClick={() => setSelectedFile(path)}
                    className={cn(selectedFile === path && "bg-primary/10")}
                  >
                    {path}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="text-muted-foreground text-sm ml-2">
              {currentView === "preview" ? "Preview" : "index.html"}
            </span>
          )}

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
              {/* Preview Engine Toggle - only for file mode */}
              {isFileMode && (
                <TooltipProvider>
                  <div className="flex bg-secondary rounded-md p-0.5 mr-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn("h-7 px-2 rounded-sm text-xs gap-1", previewEngine === "sandbox" && "bg-background shadow-sm")}
                          onClick={() => {
                            setPreviewEngine("sandbox");
                            toast.success("Fast mode", { description: "Instant preview, limited npm support" });
                          }}
                        >
                          <Zap className="w-3 h-3" />
                          Fast
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Instant preview (no npm install)</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn("h-7 px-2 rounded-sm text-xs gap-1", previewEngine === "esm" && "bg-background shadow-sm")}
                          onClick={() => {
                            setPreviewEngine("esm");
                            toast.success("ESM mode", { description: "Native ES modules via esm.sh CDN" });
                          }}
                        >
                          <Globe className="w-3 h-3" />
                          ESM
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Native ES modules from CDN (more compatible)</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!window.crossOriginIsolated}
                          className={cn(
                            "h-7 px-2 rounded-sm text-xs gap-1",
                            previewEngine === "webcontainer" && "bg-background shadow-sm",
                            !window.crossOriginIsolated && "opacity-60"
                          )}
                          onClick={() => {
                            if (!window.crossOriginIsolated) {
                              toast.error("Full preview needs cross-origin isolation", {
                                description: "Open the published app (top-level tab) or run locally. The editor preview iframe can’t enable it.",
                              });
                              setPreviewEngine("sandbox");
                              return;
                            }
                            setPreviewEngine("webcontainer");
                            toast.info("Full mode", { description: "Real Vite dev server, takes longer to load" });
                          }}
                        >
                          <Box className="w-3 h-3" />
                          Full
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {window.crossOriginIsolated
                            ? "Real Vite dev server (like Lovable)"
                            : "Requires COOP/COEP (only works in a normal top-level tab)"}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              )}

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
                  <Button variant="glow" size="sm" className="h-8 gap-2" onClick={handleUpdate} disabled={publishing}>
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
                previewEngine === "webcontainer" ? (
                  <WebContainerPreview files={files ?? {}} className="w-full h-full" />
                ) : previewEngine === "esm" ? (
                  <SandboxPreview files={files ?? {}} className="w-full h-full" useESM={true} />
                ) : (
                  <SandboxPreview files={files ?? {}} className="w-full h-full" useESM={false} />
                )
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
            {/* File Explorer Sidebar */}
            {isFileMode && (
              <>
                <ResizablePanel defaultSize={20} minSize={15} maxSize={35}>
                  <FileExplorer files={files ?? {}} selectedFile={selectedFile} onFileSelect={setSelectedFile} />
                </ResizablePanel>
                <ResizableHandle withHandle />
              </>
            )}

            {/* Code Editor */}
            <ResizablePanel defaultSize={isFileMode ? 80 : 100} minSize={40}>
              <Editor
                height="100%"
                language={isFileMode ? getLanguageForFile(selectedFile) : "html"}
                theme="vs-dark"
                value={isFileMode ? currentFileContent : editedHtml}
                onChange={(value) => {
                  if (value === undefined) return;
                  if (isFileMode) {
                    setEditedFiles((prev) => ({
                      ...prev,
                      [selectedFile]: value,
                    }));
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
          </ResizablePanelGroup>
        )}
      </div>
    </div>
  );
}
