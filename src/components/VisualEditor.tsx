import { useState, useEffect, useRef, useCallback } from "react";
import { X, Type, Palette, Move, Trash2, Copy, MousePointer, Edit3, Sparkles, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SelectedElement {
  tagName: string;
  text: string;
  styles: {
    color: string;
    backgroundColor: string;
    fontSize: string;
    fontWeight: string;
    padding: string;
    margin: string;
    borderRadius: string;
  };
  path: string; // CSS selector path
}

interface VisualEditorProps {
  html: string;
  onUpdate: (newHtml: string) => void;
  onClose: () => void;
  onElementSelectForChat?: (element: { tagName: string; text: string; path: string }) => void;
}

export function VisualEditor({ html, onUpdate, onClose, onElementSelectForChat }: VisualEditorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [editedText, setEditedText] = useState("");
  const [editedStyles, setEditedStyles] = useState<SelectedElement["styles"] | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Inject selection script into iframe
  useEffect(() => {
    if (!iframeRef.current) return;

    const iframe = iframeRef.current;
    
    const setupIframe = () => {
      const doc = iframe.contentDocument;
      if (!doc) return;

      // Write HTML
      doc.open();
      doc.write(html);
      doc.close();

      // Wait for content to load then inject selection script
      setTimeout(() => {
        injectSelectionScript(doc);
      }, 200);
    };

    iframe.onload = setupIframe;
    setupIframe();
  }, [html]);

  // Direct element selection handler for better reliability
  const handleElementSelect = (elementData: SelectedElement) => {
    setSelectedElement(elementData);
    setEditedText(elementData.text);
    setEditedStyles(elementData.styles);
  };

  const injectSelectionScript = (doc: Document) => {
    // Add highlight styles
    const style = doc.createElement("style");
    style.id = "vipe-visual-editor-styles";
    style.textContent = `
      .vipe-hover {
        outline: 2px dashed #14b8a6 !important;
        outline-offset: 2px !important;
        cursor: pointer !important;
      }
      .vipe-selected {
        outline: 3px solid #14b8a6 !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 20px rgba(20, 184, 166, 0.3) !important;
      }
      .vipe-editing {
        outline: 3px solid #8b5cf6 !important;
        min-width: 50px !important;
        min-height: 20px !important;
      }
    `;
    
    // Remove existing style if present
    const existingStyle = doc.getElementById("vipe-visual-editor-styles");
    if (existingStyle) existingStyle.remove();
    doc.head.appendChild(style);

    // Track selected element
    let currentSelected: HTMLElement | null = null;

    // Hover effect
    doc.body.addEventListener("mouseover", (e) => {
      const target = e.target as HTMLElement;
      if (target === doc.body || target === doc.documentElement) return;
      if (target.classList.contains("vipe-selected")) return;
      target.classList.add("vipe-hover");
    });

    doc.body.addEventListener("mouseout", (e) => {
      const target = e.target as HTMLElement;
      target.classList.remove("vipe-hover");
    });

    // Helper functions defined first
    function buildCSSPath(el: HTMLElement): string {
      const path: string[] = [];
      let current: HTMLElement | null = el;
      
      while (current && current !== doc.body) {
        let selector = current.tagName.toLowerCase();
        if (current.id) {
          selector += `#${current.id}`;
        } else if (current.className && typeof current.className === 'string') {
          const classes = current.className.split(' ').filter(c => !c.startsWith('vipe-')).join('.');
          if (classes) selector += `.${classes}`;
        }
        path.unshift(selector);
        current = current.parentElement;
      }
      
      return path.join(' > ') || '/';
    }

    function rgbToHex(rgb: string): string {
      if (rgb.startsWith('#')) return rgb;
      if (rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return 'transparent';
      
      const match = rgb.match(/\d+/g);
      if (!match || match.length < 3) return rgb;
      
      const [r, g, b] = match.map(Number);
      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }

    // Click to select
    doc.body.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const target = e.target as HTMLElement;
      if (target === doc.body || target === doc.documentElement) return;

      // Remove previous selection
      if (currentSelected) {
        currentSelected.classList.remove("vipe-selected");
      }

      // Select new element
      target.classList.remove("vipe-hover");
      target.classList.add("vipe-selected");
      currentSelected = target;

      // Get computed styles
      const computed = doc.defaultView?.getComputedStyle(target) || window.getComputedStyle(target);
      
      // Build CSS path
      const path = buildCSSPath(target);

      // Send selection to parent
      const elementData = {
        tagName: target.tagName.toLowerCase(),
        text: target.innerText || "",
        styles: {
          color: rgbToHex(computed.color),
          backgroundColor: rgbToHex(computed.backgroundColor) || "transparent",
          fontSize: computed.fontSize,
          fontWeight: computed.fontWeight,
          padding: computed.padding,
          margin: computed.margin,
          borderRadius: computed.borderRadius,
        },
        path,
      };

      // Post message to parent using multiple methods for reliability
      try {
        window.parent.postMessage({ type: "element-selected", data: elementData }, "*");
      } catch (err) {
        console.error("postMessage failed:", err);
      }
    });

    // Double click to edit text
    doc.body.addEventListener("dblclick", (e) => {
      e.preventDefault();
      const target = e.target as HTMLElement;
      if (target === doc.body || target === doc.documentElement) return;
      
      target.contentEditable = "true";
      target.classList.add("vipe-editing");
      target.focus();

      target.addEventListener("blur", () => {
        target.contentEditable = "false";
        target.classList.remove("vipe-editing");
        
        // Send updated HTML
        window.parent.postMessage({ 
          type: "html-updated", 
          html: doc.documentElement.outerHTML 
        }, "*");
      }, { once: true });
    });

    // Helper functions already defined above - removed duplicates
  };

  // Helper to build clean HTML using original structure but updated body
  const buildCleanHtml = useCallback(
    (doc: Document) => {
      // Get the current body content with all changes
      const updatedBody = doc.body.innerHTML;

      // Start from original HTML prop so we keep <html>, <head> and attributes intact
      let baseHtml = html;

      const bodyMatch = baseHtml.match(/<body[^>]*>[\s\S]*?<\/body>/i);
      if (bodyMatch) {
        const bodyOpenTagMatch = baseHtml.match(/<body[^>]*>/i);
        const bodyOpenTag = bodyOpenTagMatch ? bodyOpenTagMatch[0] : "<body>";
        baseHtml = baseHtml.replace(
          /<body[^>]*>[\s\S]*?<\/body>/i,
          `${bodyOpenTag}\n${updatedBody}\n</body>`
        );
      } else {
        // Fallback: use full document HTML
        baseHtml = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
      }

      // If text content was edited, also patch the raw HTML string so inline JS/markup stay in sync
      if (selectedElement?.text && editedText && editedText !== selectedElement.text) {
        baseHtml = baseHtml.replace(selectedElement.text, editedText);
      }

      // Remove our injected visual editor style tag only
      baseHtml = baseHtml.replace(
        /<style[^>]*id=["']vipe-visual-editor-styles["'][^>]*>[\s\S]*?<\/style>/gi,
        ""
      );

      // Strip any vipe-* helper classes from class attributes
      baseHtml = baseHtml.replace(/class="([^"]*)"/g, (_match, classNames: string) => {
        const filtered = classNames
          .split(/\s+/)
          .filter((name) => name && !name.startsWith("vipe-"))
          .join(" ");
        return filtered ? `class="${filtered}"` : "";
      });

      // Also clean up empty class attributes
      baseHtml = baseHtml.replace(/\s*class=""\s*/g, " ");

      return baseHtml;
    },
    [html, selectedElement, editedText]
  );

  // Listen for messages from iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      console.log("[VisualEditor] Received message:", e.data?.type);
      
      if (e.data?.type === "element-selected" && e.data?.data) {
        console.log("[VisualEditor] Element selected:", e.data.data);
        setSelectedElement(e.data.data);
        setEditedText(e.data.data.text || "");
        setEditedStyles(e.data.data.styles);

        if (onElementSelectForChat) {
          onElementSelectForChat({
            tagName: e.data.data.tagName,
            text: e.data.data.text,
            path: e.data.data.path,
          });
        }

        toast.success(`Selected: <${e.data.data.tagName}>`);
      } else if (e.data?.type === "html-updated" && iframeRef.current?.contentDocument) {
        // Use the live document plus original HTML to build a clean update
        const newHtml = buildCleanHtml(iframeRef.current.contentDocument);
        onUpdate(newHtml);
        toast.success("Element updated!");
      }
    };

    window.addEventListener("message", handleMessage);
    console.log("[VisualEditor] Message listener attached");
    
    return () => {
      window.removeEventListener("message", handleMessage);
      console.log("[VisualEditor] Message listener removed");
    };
  }, [onUpdate, onElementSelectForChat, buildCleanHtml]);

  const applyStyleChange = (property: keyof SelectedElement["styles"], value: string) => {
    if (!iframeRef.current || !selectedElement) return;

    const doc = iframeRef.current.contentDocument;
    if (!doc) return;

    const selected = doc.querySelector(".vipe-selected") as HTMLElement;
    if (!selected) return;

    // Apply the style
    switch (property) {
      case "color":
        selected.style.color = value;
        break;
      case "backgroundColor":
        selected.style.backgroundColor = value;
        break;
      case "fontSize":
        selected.style.fontSize = value;
        break;
      case "fontWeight":
        selected.style.fontWeight = value;
        break;
      case "borderRadius":
        selected.style.borderRadius = value;
        break;
      case "padding":
        selected.style.padding = value;
        break;
      case "margin":
        selected.style.margin = value;
        break;
    }

    setEditedStyles(prev => prev ? { ...prev, [property]: value } : null);
  };

  const applyTextChange = () => {
    if (!iframeRef.current || !selectedElement) return;

    const doc = iframeRef.current.contentDocument;
    if (!doc) return;

    const selected = doc.querySelector(".vipe-selected") as HTMLElement;
    if (!selected) return;

    selected.innerText = editedText;
  };

  // AI-assisted editing
  const handleAiEdit = async () => {
    if (!aiPrompt.trim()) return;
    if (!iframeRef.current) return;

    const doc = iframeRef.current.contentDocument;
    if (!doc) return;

    const selected = doc.querySelector(".vipe-selected") as HTMLElement | null;
    if (!selected) {
      toast.error("Select an element in the preview first");
      return;
    }

    // Build element info and current styles directly from the DOM
    const computed = doc.defaultView?.getComputedStyle(selected) || window.getComputedStyle(selected);

    const elementInfo = {
      tagName: selected.tagName.toLowerCase(),
      text: selected.innerText || "",
    };

    const currentStyles = {
      color: computed.color,
      backgroundColor: computed.backgroundColor,
      fontSize: computed.fontSize,
      fontWeight: computed.fontWeight,
      padding: computed.padding,
      margin: computed.margin,
      borderRadius: computed.borderRadius,
    };

    setIsAiLoading(true);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/visual-edit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          instruction: aiPrompt,
          elementInfo,
          currentStyles,
        }),
      });

      if (!response.ok) {
        throw new Error("AI request failed");
      }

      const data = await response.json();
      const changes = data.changes;

      if (!changes || Object.keys(changes).length === 0) {
        toast.error("AI couldn't understand the request");
        return;
      }

      // Apply the changes
      const doc = iframeRef.current.contentDocument;
      if (!doc) return;

      const selected = doc.querySelector(".vipe-selected") as HTMLElement;
      if (!selected) return;

      // Apply each style change
      Object.entries(changes).forEach(([key, value]) => {
        if (key === "text" && typeof value === "string") {
          selected.innerText = value;
          setEditedText(value);
        } else if (typeof value === "string") {
          // Apply as inline style
          (selected.style as any)[key] = value;
          
          // Update local state if it's a tracked style
          if (key in (editedStyles || {})) {
            setEditedStyles(prev => prev ? { ...prev, [key]: value } : null);
          }
        }
      });

      setAiPrompt("");
      toast.success("AI changes applied!");
    } catch (error) {
      console.error("AI edit error:", error);
      toast.error("Failed to apply AI changes");
    } finally {
      setIsAiLoading(false);
    }
  };

  const saveChanges = () => {
    if (!iframeRef.current) {
      console.error("[VisualEditor] No iframe ref");
      return;
    }

    const doc = iframeRef.current.contentDocument;
    if (!doc) {
      console.error("[VisualEditor] No iframe document");
      return;
    }

    // Remove selection classes before saving
    doc.querySelectorAll(".vipe-selected, .vipe-hover, .vipe-editing").forEach((el) => {
      el.classList.remove("vipe-selected", "vipe-hover", "vipe-editing");
    });

    // Build clean HTML based on the original structure + current body content
    const newHtml = buildCleanHtml(doc);
    
    console.log("[VisualEditor] Saving HTML, length:", newHtml.length);
    console.log("[VisualEditor] Body preview:", doc.body.innerHTML.substring(0, 200));
    
    onUpdate(newHtml);
    toast.success("Changes saved!");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-background">
      {/* Editor Sidebar */}
      <div className="w-80 bg-card border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Edit3 className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">Visual Editor</h2>
              <p className="text-xs text-muted-foreground">Click elements to edit</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* AI Edit - always visible */}
        <div className="p-4 border-b border-border">
          <div className="p-3 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
            <Label className="text-xs flex items-center gap-2 mb-2">
              <Sparkles className="w-3 h-3 text-primary" />
              AI Edit
            </Label>
            <div className="flex gap-2">
              <Input
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g., make this button bigger and blue"
                className="text-xs h-8 flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isAiLoading) {
                    handleAiEdit();
                  }
                }}
                disabled={isAiLoading}
              />
              <Button
                size="sm"
                className="h-8 px-2"
                onClick={handleAiEdit}
                disabled={isAiLoading || !aiPrompt.trim()}
              >
                {isAiLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Send className="w-3 h-3" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Select an element in the preview, then describe the change
            </p>
          </div>
        </div>

        {/* Instructions or Element Properties */}
        <ScrollArea className="flex-1">
          {selectedElement ? (
            <div className="p-4 space-y-4">
              {/* AI Prompt - Top of sidebar when element selected */}
              <div className="p-3 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
                <Label className="text-xs flex items-center gap-2 mb-2">
                  <Sparkles className="w-3 h-3 text-primary" />
                  AI Edit
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g., make it bigger and blue"
                    className="text-xs h-8 flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isAiLoading) {
                        handleAiEdit();
                      }
                    }}
                    disabled={isAiLoading}
                  />
                  <Button
                    size="sm"
                    className="h-8 px-2"
                    onClick={handleAiEdit}
                    disabled={isAiLoading || !aiPrompt.trim()}
                  >
                    {isAiLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Send className="w-3 h-3" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Describe changes in plain English
                </p>
              </div>

              {/* Element Info */}
              <div className="p-3 rounded-lg bg-secondary/50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono bg-primary/20 text-primary px-2 py-0.5 rounded">
                    {selectedElement.tagName}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {selectedElement.path}
                </p>
              </div>

              {/* Text Content */}
              {selectedElement.text && (
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-2">
                    <Type className="w-3 h-3" />
                    Text Content
                  </Label>
                  <Input
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    onBlur={applyTextChange}
                    className="text-sm"
                  />
                </div>
              )}

              {/* Colors */}
              <div className="space-y-3">
                <Label className="text-xs flex items-center gap-2">
                  <Palette className="w-3 h-3" />
                  Colors
                </Label>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-xs text-muted-foreground">Text</span>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="color"
                        value={editedStyles?.color || "#000000"}
                        onChange={(e) => applyStyleChange("color", e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer"
                      />
                      <Input
                        value={editedStyles?.color || ""}
                        onChange={(e) => applyStyleChange("color", e.target.value)}
                        className="text-xs h-8"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-xs text-muted-foreground">Background</span>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="color"
                        value={editedStyles?.backgroundColor === "transparent" ? "#ffffff" : editedStyles?.backgroundColor || "#ffffff"}
                        onChange={(e) => applyStyleChange("backgroundColor", e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer"
                      />
                      <Input
                        value={editedStyles?.backgroundColor || ""}
                        onChange={(e) => applyStyleChange("backgroundColor", e.target.value)}
                        className="text-xs h-8"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Typography */}
              <div className="space-y-2">
                <Label className="text-xs">Typography</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-xs text-muted-foreground">Size</span>
                    <Input
                      value={editedStyles?.fontSize || ""}
                      onChange={(e) => applyStyleChange("fontSize", e.target.value)}
                      placeholder="16px"
                      className="text-xs h-8 mt-1"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Weight</span>
                    <Input
                      value={editedStyles?.fontWeight || ""}
                      onChange={(e) => applyStyleChange("fontWeight", e.target.value)}
                      placeholder="400"
                      className="text-xs h-8 mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Spacing */}
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-2">
                  <Move className="w-3 h-3" />
                  Spacing
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-xs text-muted-foreground">Padding</span>
                    <Input
                      value={editedStyles?.padding || ""}
                      onChange={(e) => applyStyleChange("padding", e.target.value)}
                      placeholder="8px"
                      className="text-xs h-8 mt-1"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Margin</span>
                    <Input
                      value={editedStyles?.margin || ""}
                      onChange={(e) => applyStyleChange("margin", e.target.value)}
                      placeholder="0px"
                      className="text-xs h-8 mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Border Radius */}
              <div className="space-y-2">
                <Label className="text-xs">Border Radius</Label>
                <Input
                  value={editedStyles?.borderRadius || ""}
                  onChange={(e) => applyStyleChange("borderRadius", e.target.value)}
                  placeholder="4px"
                  className="text-xs h-8"
                />
              </div>
            </div>
          ) : (
            <div className="p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-secondary flex items-center justify-center animate-pulse">
                <MousePointer className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium mb-2">Select an Element</h3>
              <p className="text-sm text-muted-foreground">
                Click on any element in the preview to select and edit it.
              </p>
              <div className="mt-4 p-3 rounded-lg bg-secondary/50 text-left">
                <p className="text-xs text-muted-foreground mb-2">Tips:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• <strong>Click</strong> to select an element</li>
                  <li>• <strong>Double-click</strong> to edit text directly</li>
                  <li>• Use <strong>AI Edit</strong> to describe changes</li>
                </ul>
              </div>
              
              {/* AI Edit available even without selection for global changes */}
              <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 text-left">
                <Label className="text-xs flex items-center gap-2 mb-2">
                  <Sparkles className="w-3 h-3 text-primary" />
                  Quick AI Edit
                </Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Select an element first, then describe what to change
                </p>
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Actions */}
        <div className="p-4 border-t border-border space-y-2">
          <Button onClick={saveChanges} className="w-full" variant="glow">
            Save Changes
          </Button>
          <Button onClick={onClose} variant="outline" className="w-full">
            Cancel
          </Button>
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 bg-[#1a1a2e] p-4 overflow-auto">
        <div className="bg-white rounded-lg shadow-2xl overflow-hidden h-full">
          <iframe
            ref={iframeRef}
            title="Visual Editor Preview"
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
}
