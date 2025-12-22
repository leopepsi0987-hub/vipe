import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, FileCode, FileText, Folder, FolderOpen, Search, Image, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileNode[];
}

interface FileExplorerProps {
  files: Record<string, string>;
  selectedFile: string | null;
  onFileSelect: (path: string) => void;
}

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "tsx":
    case "ts":
      return <FileCode className="w-4 h-4 text-blue-400" />;
    case "jsx":
    case "js":
      return <FileCode className="w-4 h-4 text-yellow-400" />;
    case "css":
      return <FileCode className="w-4 h-4 text-pink-400" />;
    case "html":
      return <FileCode className="w-4 h-4 text-orange-400" />;
    case "json":
      return <Settings className="w-4 h-4 text-green-400" />;
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
      return <Image className="w-4 h-4 text-purple-400" />;
    default:
      return <FileText className="w-4 h-4 text-muted-foreground" />;
  }
}

function buildFileTree(files: Record<string, string>): FileNode[] {
  const root: FileNode[] = [];
  const paths = Object.keys(files).sort();

  for (const filePath of paths) {
    const parts = filePath.split("/");
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join("/");

      let existing = currentLevel.find((n) => n.name === part);

      if (!existing) {
        const newNode: FileNode = {
          name: part,
          path: currentPath,
          type: isFile ? "file" : "folder",
          children: isFile ? undefined : [],
        };
        currentLevel.push(newNode);
        existing = newNode;
      }

      if (!isFile && existing.children) {
        currentLevel = existing.children;
      }
    }
  }

  // Sort: folders first, then files, alphabetically
  const sortNodes = (nodes: FileNode[]): FileNode[] => {
    return nodes
      .map((node) => ({
        ...node,
        children: node.children ? sortNodes(node.children) : undefined,
      }))
      .sort((a, b) => {
        if (a.type === "folder" && b.type === "file") return -1;
        if (a.type === "file" && b.type === "folder") return 1;
        return a.name.localeCompare(b.name);
      });
  };

  return sortNodes(root);
}

function FileTreeItem({
  node,
  depth = 0,
  selectedFile,
  onFileSelect,
  searchQuery,
}: {
  node: FileNode;
  depth?: number;
  selectedFile: string | null;
  onFileSelect: (path: string) => void;
  searchQuery: string;
}) {
  const [isOpen, setIsOpen] = useState(depth < 2);

  const matchesSearch =
    searchQuery === "" ||
    node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    node.children?.some((child) => child.name.toLowerCase().includes(searchQuery.toLowerCase()));

  if (!matchesSearch) return null;

  const isActive = selectedFile === node.path;

  if (node.type === "folder") {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex items-center gap-1 w-full px-2 py-1 text-sm hover:bg-secondary/50 rounded transition-colors",
            "text-muted-foreground hover:text-foreground"
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {isOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
          {isOpen ? (
            <FolderOpen className="w-4 h-4 text-blue-400 shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-blue-400 shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {isOpen && node.children && (
          <div>
            {node.children.map((child) => (
              <FileTreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedFile={selectedFile}
                onFileSelect={onFileSelect}
                searchQuery={searchQuery}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => onFileSelect(node.path)}
      className={cn(
        "flex items-center gap-2 w-full px-2 py-1 text-sm rounded transition-colors",
        isActive ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
      )}
      style={{ paddingLeft: `${depth * 12 + 28}px` }}
    >
      {getFileIcon(node.name)}
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export function FileExplorer({ files, selectedFile, onFileSelect }: FileExplorerProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const fileTree = useMemo(() => buildFileTree(files), [files]);

  const fileCount = Object.keys(files).length;

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-secondary rounded-md">
          <FileCode className="w-4 h-4" />
          Files ({fileCount})
        </button>
      </div>

      {/* Search */}
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search files"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm bg-secondary border-0"
          />
        </div>
      </div>

      {/* File Tree */}
      <ScrollArea className="flex-1">
        <div className="py-2">
          {fileTree.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              No files yet. Use /build to create your app.
            </div>
          ) : (
            fileTree.map((node) => (
              <FileTreeItem
                key={node.path}
                node={node}
                selectedFile={selectedFile}
                onFileSelect={onFileSelect}
                searchQuery={searchQuery}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
