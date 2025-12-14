import { useState } from "react";
import { ChevronRight, ChevronDown, FileCode, FileText, Folder, FolderOpen, Search, Image, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FileNode {
  name: string;
  type: "file" | "folder";
  icon?: React.ReactNode;
  children?: FileNode[];
  section?: "html" | "css" | "js" | "full";
}

interface FileExplorerProps {
  onFileSelect: (section: "html" | "css" | "js" | "full") => void;
  activeFile: string;
}

const fileTree: FileNode[] = [
  {
    name: "public",
    type: "folder",
    children: [
      { name: "favicon.ico", type: "file", icon: <Image className="w-4 h-4 text-yellow-500" /> },
      { name: "robots.txt", type: "file", icon: <FileText className="w-4 h-4 text-muted-foreground" /> },
    ],
  },
  {
    name: "src",
    type: "folder",
    children: [
      {
        name: "components",
        type: "folder",
        children: [
          { name: "App.tsx", type: "file", section: "html", icon: <FileCode className="w-4 h-4 text-blue-400" /> },
        ],
      },
      {
        name: "styles",
        type: "folder",
        children: [
          { name: "index.css", type: "file", section: "css", icon: <FileCode className="w-4 h-4 text-pink-400" /> },
        ],
      },
      { name: "main.tsx", type: "file", section: "js", icon: <FileCode className="w-4 h-4 text-yellow-400" /> },
    ],
  },
  { name: "index.html", type: "file", section: "full", icon: <FileCode className="w-4 h-4 text-orange-400" /> },
  { name: "package.json", type: "file", icon: <Settings className="w-4 h-4 text-green-400" /> },
  { name: "vite.config.ts", type: "file", icon: <FileCode className="w-4 h-4 text-purple-400" /> },
];

function FileTreeItem({ 
  node, 
  depth = 0, 
  onFileSelect, 
  activeFile,
  searchQuery 
}: { 
  node: FileNode; 
  depth?: number; 
  onFileSelect: (section: "html" | "css" | "js" | "full") => void;
  activeFile: string;
  searchQuery: string;
}) {
  const [isOpen, setIsOpen] = useState(depth < 2);
  
  const matchesSearch = searchQuery === "" || 
    node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (node.children?.some(child => 
      child.name.toLowerCase().includes(searchQuery.toLowerCase())
    ));

  if (!matchesSearch) return null;

  const isActive = activeFile === node.name;

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
          {isOpen ? (
            <ChevronDown className="w-4 h-4 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 shrink-0" />
          )}
          {isOpen ? (
            <FolderOpen className="w-4 h-4 text-blue-400 shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-blue-400 shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {isOpen && node.children && (
          <div>
            {node.children.map((child, index) => (
              <FileTreeItem
                key={index}
                node={child}
                depth={depth + 1}
                onFileSelect={onFileSelect}
                activeFile={activeFile}
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
      onClick={() => node.section && onFileSelect(node.section)}
      className={cn(
        "flex items-center gap-2 w-full px-2 py-1 text-sm rounded transition-colors",
        isActive 
          ? "bg-primary/20 text-primary" 
          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
        !node.section && "opacity-50 cursor-not-allowed"
      )}
      style={{ paddingLeft: `${depth * 12 + 28}px` }}
      disabled={!node.section}
    >
      {node.icon || <FileCode className="w-4 h-4 shrink-0" />}
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export function FileExplorer({ onFileSelect, activeFile }: FileExplorerProps) {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-secondary rounded-md">
          <FileCode className="w-4 h-4" />
          Files
        </button>
        <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Search className="w-4 h-4" />
          Search
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
          {fileTree.map((node, index) => (
            <FileTreeItem
              key={index}
              node={node}
              onFileSelect={onFileSelect}
              activeFile={activeFile}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}