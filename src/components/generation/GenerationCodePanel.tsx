import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { File, Folder, ChevronRight, ChevronDown, Loader2 } from "lucide-react";
import { useState } from "react";

interface GenerationFile {
  path: string;
  content: string;
  type: string;
  completed: boolean;
}

interface GenerationCodePanelProps {
  files: GenerationFile[];
  streamedCode: string;
  selectedFile: string | null;
  onSelectFile: (path: string | null) => void;
  isGenerating: boolean;
}

export function GenerationCodePanel({
  files,
  streamedCode,
  selectedFile,
  onSelectFile,
  isGenerating,
}: GenerationCodePanelProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(["src", "src/components"])
  );

  const toggleFolder = (folder: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folder)) {
      newExpanded.delete(folder);
    } else {
      newExpanded.add(folder);
    }
    setExpandedFolders(newExpanded);
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    const colors: Record<string, string> = {
      jsx: "text-yellow-500",
      tsx: "text-blue-500",
      js: "text-yellow-500",
      ts: "text-blue-500",
      css: "text-blue-400",
      json: "text-gray-500",
      html: "text-orange-500",
    };
    return <File className={cn("w-4 h-4", colors[ext || ""] || "text-gray-500")} />;
  };

  // Group files by directory
  const fileTree: Record<string, GenerationFile[]> = {};
  files.forEach((file) => {
    const parts = file.path.split("/");
    const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
    if (!fileTree[dir]) fileTree[dir] = [];
    fileTree[dir].push(file);
  });

  const selectedFileContent = files.find((f) => f.path === selectedFile)?.content || "";

  return (
    <div className="h-full flex">
      {/* File Explorer */}
      <div className="w-60 border-r border-border bg-card flex flex-col">
        <div className="p-3 border-b border-border flex items-center gap-2">
          <Folder className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium">Explorer</span>
          {isGenerating && (
            <Loader2 className="w-3 h-3 animate-spin ml-auto text-primary" />
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 text-sm">
            {/* App folder */}
            <div
              className="flex items-center gap-1 py-1 px-2 rounded hover:bg-muted cursor-pointer"
              onClick={() => toggleFolder("app")}
            >
              {expandedFolders.has("app") ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
              <Folder className="w-4 h-4 text-blue-500" />
              <span className="font-medium">app</span>
            </div>

            {expandedFolders.has("app") && (
              <div className="ml-4">
                {Object.entries(fileTree).map(([dir, dirFiles]) => (
                  <div key={dir || "root"}>
                    {dir && (
                      <div
                        className="flex items-center gap-1 py-1 px-2 rounded hover:bg-muted cursor-pointer"
                        onClick={() => toggleFolder(dir)}
                      >
                        {expandedFolders.has(dir) ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                        <Folder className="w-4 h-4 text-yellow-500" />
                        <span>{dir.split("/").pop()}</span>
                      </div>
                    )}

                    {(!dir || expandedFolders.has(dir)) && (
                      <div className={dir ? "ml-4" : ""}>
                        {dirFiles.map((file) => (
                          <div
                            key={file.path}
                            className={cn(
                              "flex items-center gap-2 py-1 px-2 rounded cursor-pointer transition-colors",
                              selectedFile === file.path
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-muted"
                            )}
                            onClick={() => onSelectFile(file.path)}
                          >
                            {getFileIcon(file.path)}
                            <span className="truncate">{file.path.split("/").pop()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Code View */}
      <div className="flex-1 flex flex-col bg-slate-900">
        {/* File Tab */}
        {selectedFile && (
          <div className="h-10 border-b border-slate-700 flex items-center px-4 bg-slate-800">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              {getFileIcon(selectedFile)}
              <span>{selectedFile}</span>
            </div>
            <button
              className="ml-auto text-slate-500 hover:text-slate-300"
              onClick={() => onSelectFile(null)}
            >
              ×
            </button>
          </div>
        )}

        {/* Code Content */}
        <ScrollArea className="flex-1">
          <pre className="p-4 text-sm font-mono text-slate-300 whitespace-pre-wrap">
            {selectedFile ? (
              <code>{selectedFileContent}</code>
            ) : isGenerating ? (
              <div>
                <div className="flex items-center gap-2 mb-4 text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Streaming code...</span>
                </div>
                <code className="text-green-400">{streamedCode}</code>
              </div>
            ) : files.length > 0 ? (
              <div className="text-slate-500 text-center py-8">
                Select a file to view its contents
              </div>
            ) : (
              <div className="text-slate-500 text-center py-8">
                Code will appear here during generation
              </div>
            )}
          </pre>
        </ScrollArea>
      </div>
    </div>
  );
}
