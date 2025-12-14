import { useEffect, useRef, useState } from "react";
import { RefreshCw, Maximize2, Minimize2, Monitor, Tablet, Smartphone, Globe, Link2, Check, Loader2, Eye, Code, Save, X, PanelLeftClose, PanelLeft, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Editor from "@monaco-editor/react";
import { FileExplorer } from "./FileExplorer";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PreviewProps {
  html: string;
  projectId?: string;
  projectName?: string;
  isPublished?: boolean;
  slug?: string | null;
  onPublish?: (customSlug?: string) => Promise<any>;
  onUpdatePublished?: () => Promise<any>;
  activeView?: "preview" | "code";
  onViewChange?: (view: "preview" | "code") => void;
  onCodeChange?: (code: string) => void;
}

type DeviceMode = "desktop" | "tablet" | "mobile";
type FileSection = "html" | "css" | "js" | "full";

// Extract CSS from HTML - uses markers if available
function extractCSS(html: string): string {
  // Try to find marked section first
  const markedMatch = html.match(/\/\* === STYLES START === \*\/([\s\S]*?)\/\* === STYLES END === \*\//);
  if (markedMatch) {
    return markedMatch[1].trim();
  }
  
  // Fallback to extracting all style tags
  const styleMatches = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
  if (!styleMatches) return "/* No styles found */";
  
  return styleMatches
    .map(match => match.replace(/<\/?style[^>]*>/gi, "").trim())
    .join("\n\n");
}

// Extract JS from HTML - uses markers if available
function extractJS(html: string): string {
  // Try to find marked section first
  const markedMatch = html.match(/\/\/ === SCRIPT START ===([\s\S]*?)\/\/ === SCRIPT END ===/);
  if (markedMatch) {
    return markedMatch[1].trim();
  }
  
  // Fallback to extracting all script tags
  const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
  if (!scriptMatches) return "// No scripts found";
  
  return scriptMatches
    .filter(match => !match.includes("src=")) // Exclude external scripts
    .map(match => match.replace(/<\/?script[^>]*>/gi, "").trim())
    .filter(content => content.length > 0)
    .join("\n\n");
}

// Extract HTML structure (body content without styles/scripts)
function extractHTML(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return html;
  
  let content = bodyMatch[1];
  // Remove script and style tags for cleaner view
  content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  return content.trim();
}

export function Preview({ 
  html, 
  projectId, 
  projectName, 
  isPublished, 
  slug, 
  onPublish, 
  onUpdatePublished,
  activeView = "preview",
  onViewChange,
  onCodeChange
}: PreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [localView, setLocalView] = useState<"preview" | "code">(activeView);
  const [editedCode, setEditedCode] = useState(html);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeSection, setActiveSection] = useState<FileSection>("full");
  const [showExplorer, setShowExplorer] = useState(true);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [customSlug, setCustomSlug] = useState("");
  const [openTabs, setOpenTabs] = useState<{name: string; section: FileSection}[]>([
    { name: "index.html", section: "full" }
  ]);
  
  const currentView = onViewChange ? activeView : localView;
  const handleViewChange = (view: "preview" | "code") => {
    if (onViewChange) {
      onViewChange(view);
    } else {
      setLocalView(view);
    }
  };

  // Get content for current section
  const getEditorContent = () => {
    switch (activeSection) {
      case "css": return extractCSS(html);
      case "js": return extractJS(html);
      case "html": return extractHTML(html);
      default: return html;
    }
  };

  // Get language for current section
  const getEditorLanguage = () => {
    switch (activeSection) {
      case "css": return "css";
      case "js": return "javascript";
      case "html": return "html";
      default: return "html";
    }
  };

  // Get file name for current section
  const getFileName = () => {
    switch (activeSection) {
      case "css": return "index.css";
      case "js": return "main.tsx";
      case "html": return "App.tsx";
      default: return "index.html";
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S to save code
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (currentView === 'code' && hasUnsavedChanges && activeSection === 'full' && onCodeChange && editedCode) {
          onCodeChange(editedCode);
          setHasUnsavedChanges(false);
          toast.success("Code saved!");
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentView, hasUnsavedChanges, activeSection, onCodeChange, editedCode]);

  // Sync edited code when html prop changes
  useEffect(() => {
    setEditedCode(html);
    setHasUnsavedChanges(false);
  }, [html]);

  useEffect(() => {
    if (iframeRef.current && html) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
        
        // Inject script to hide Lovable branding in the iframe
        const hideScript = doc.createElement('script');
        hideScript.textContent = `
          (function(){
            const hide = () => {
              const selectors = ['a[href*="lovable.dev"]','a[href*="lovable.app"]','[class*="lovable"]','[class*="Lovable"]','#lovable-badge','.lovable-badge','[data-lovable]','img[src*="lovable"]','div[id*="lovable"]'];
              selectors.forEach(sel => {
                document.querySelectorAll(sel).forEach(el => {
                  el.style.cssText = 'display:none!important;visibility:hidden!important;opacity:0!important;';
                });
              });
            };
            hide();
            setTimeout(hide, 100);
            setTimeout(hide, 500);
            setTimeout(hide, 1000);
            new MutationObserver(hide).observe(document.documentElement, { childList: true, subtree: true });
          })();
        `;
        doc.body.appendChild(hideScript);
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
      // Validate and format slug
      const slugToUse = customSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
      const result = await onPublish(slugToUse || undefined);
      if (result) {
        toast.success("App published! 🚀", {
          description: "Your app is now live and shareable.",
        });
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
      toast.success("App updated! 🔄", {
        description: "Your changes are now live.",
      });
    } catch (error) {
      toast.error("Failed to update");
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

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined && activeSection === "full") {
      setEditedCode(value);
      setHasUnsavedChanges(value !== html);
    }
  };

  const handleSaveCode = () => {
    if (onCodeChange && editedCode) {
      onCodeChange(editedCode);
      setHasUnsavedChanges(false);
      toast.success("Code saved!");
    }
  };

  const handleFileSelect = (section: FileSection) => {
    setActiveSection(section);
    const fileName = section === "full" ? "index.html" 
      : section === "css" ? "index.css"
      : section === "js" ? "main.tsx"
      : "App.tsx";
    
    if (!openTabs.find(t => t.section === section)) {
      setOpenTabs([...openTabs, { name: fileName, section }]);
    }
  };

  const handleCloseTab = (section: FileSection) => {
    const newTabs = openTabs.filter(t => t.section !== section);
    setOpenTabs(newTabs);
    if (activeSection === section && newTabs.length > 0) {
      setActiveSection(newTabs[newTabs.length - 1].section);
    }
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
          <span className="text-muted-foreground text-sm ml-2">
            {currentView === "preview" ? "Preview" : getFileName()}
          </span>
          {hasUnsavedChanges && (
            <span className="text-xs text-yellow-500 ml-2">• Unsaved</span>
          )}
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

          {/* Save button - only show in code mode with changes */}
          {currentView === "code" && hasUnsavedChanges && activeSection === "full" && (
            <Button
              variant="glow"
              size="sm"
              className="h-7 px-3 text-xs mr-2"
              onClick={handleSaveCode}
            >
              <Save className="w-3 h-3 mr-1" />
              Save
            </Button>
          )}

          {/* Toggle file explorer */}
          {currentView === "code" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowExplorer(!showExplorer)}
            >
              {showExplorer ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeft className="w-4 h-4" />
              )}
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
                    variant="glow"
                    size="sm"
                    className="h-8 gap-2"
                    onClick={handleUpdate}
                    disabled={publishing}
                  >
                    {publishing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCcw className="w-4 h-4" />
                    )}
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

      {/* Publish Dialog */}
      <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Publish Your App</DialogTitle>
            <DialogDescription>
              Choose a custom URL for your app. Leave empty for auto-generated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="slug">Custom URL</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">vipe.lovable.app/app/</span>
                <Input
                  id="slug"
                  placeholder="my-cool-app"
                  value={customSlug}
                  onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Only lowercase letters, numbers, and hyphens allowed
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPublishDialog(false)}>
              Cancel
            </Button>
            <Button variant="glow" onClick={handlePublish} disabled={publishing}>
              {publishing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Globe className="w-4 h-4 mr-2" />
              )}
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview/Code Area */}
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
        <div className="flex-1 flex overflow-hidden">
          {/* File Explorer */}
          {showExplorer && (
            <ResizablePanelGroup direction="horizontal" className="flex-1">
              <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
                <FileExplorer 
                  onFileSelect={handleFileSelect}
                  activeFile={getFileName()}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={75}>
                <div className="flex flex-col h-full">
                  {/* File Tabs */}
                  <div className="flex bg-[#252526] border-b border-[#3c3c3c] overflow-x-auto">
                    {openTabs.map((tab) => (
                      <div
                        key={tab.section}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 text-sm border-r border-[#3c3c3c] cursor-pointer min-w-max",
                          activeSection === tab.section
                            ? "bg-[#1e1e1e] text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => setActiveSection(tab.section)}
                      >
                        <span>{tab.name}</span>
                        {openTabs.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCloseTab(tab.section);
                            }}
                            className="hover:bg-secondary rounded p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* Editor */}
                  <div className="flex-1">
                    <Editor
                      height="100%"
                      language={getEditorLanguage()}
                      value={activeSection === "full" ? editedCode : getEditorContent()}
                      onChange={handleEditorChange}
                      theme="vs-dark"
                      options={{
                        minimap: { enabled: true },
                        fontSize: 14,
                        lineNumbers: "on",
                        wordWrap: "on",
                        automaticLayout: true,
                        scrollBeyondLastLine: false,
                        padding: { top: 16 },
                        fontFamily: "'Fira Code', 'Monaco', 'Consolas', monospace",
                        fontLigatures: true,
                        renderWhitespace: "selection",
                        bracketPairColorization: { enabled: true },
                        guides: {
                          bracketPairs: true,
                          indentation: true,
                        },
                        readOnly: activeSection !== "full",
                      }}
                    />
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
          
          {/* Editor only (no explorer) */}
          {!showExplorer && (
            <div className="flex flex-col flex-1">
              {/* File Tabs */}
              <div className="flex bg-[#252526] border-b border-[#3c3c3c] overflow-x-auto">
                {openTabs.map((tab) => (
                  <div
                    key={tab.section}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm border-r border-[#3c3c3c] cursor-pointer min-w-max",
                      activeSection === tab.section
                        ? "bg-[#1e1e1e] text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setActiveSection(tab.section)}
                  >
                    <span>{tab.name}</span>
                    {openTabs.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloseTab(tab.section);
                        }}
                        className="hover:bg-secondary rounded p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Editor */}
              <div className="flex-1">
                <Editor
                  height="100%"
                  language={getEditorLanguage()}
                  value={activeSection === "full" ? editedCode : getEditorContent()}
                  onChange={handleEditorChange}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: true },
                    fontSize: 14,
                    lineNumbers: "on",
                    wordWrap: "on",
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    padding: { top: 16 },
                    fontFamily: "'Fira Code', 'Monaco', 'Consolas', monospace",
                    fontLigatures: true,
                    renderWhitespace: "selection",
                    bracketPairColorization: { enabled: true },
                    guides: {
                      bracketPairs: true,
                      indentation: true,
                    },
                    readOnly: activeSection !== "full",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}