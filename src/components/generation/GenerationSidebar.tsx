import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Send, Loader2, Globe, Database, CheckCircle, ImagePlus, X, Circle, FileText, FilePen, Eye, ChevronDown, ChevronUp, MessageCircle, Code2 } from "lucide-react";

interface Task {
  id: string;
  title: string;
  status: "pending" | "in-progress" | "done";
}

interface FileAction {
  type: "reading" | "editing" | "edited";
  path: string;
}

interface ChatMessage {
  id: string;
  content: string;
  type: "user" | "ai" | "system" | "file-update";
  timestamp: Date;
  metadata?: {
    scrapedUrl?: string;
    appliedFiles?: string[];
    isSupabaseInfo?: boolean;
    imageUrl?: string;
    tasks?: Task[];
    fileActions?: FileAction[];
    thinkingTime?: number;
    isThinking?: boolean;
  };
}

interface SupabaseConnection {
  url: string;
  connected: boolean;
  connectedVia?: "oauth" | "manual";
}

interface GenerationSidebarProps {
  chatMessages: ChatMessage[];
  chatInput: string;
  setChatInput: (value: string) => void;
  onSubmit: (imageData?: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  isLoading: boolean;
  chatContainerRef: React.RefObject<HTMLDivElement>;
  onBack: () => void;
  urlScreenshot?: string | null;
  supabaseConnection?: SupabaseConnection | null;
  onOpenSupabaseModal?: () => void;
  // New: mode toggle
  aiMode: "chat" | "build";
  onModeChange: (mode: "chat" | "build") => void;
}

function TaskItem({ task }: { task: Task }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {task.status === "done" ? (
        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
      ) : task.status === "in-progress" ? (
        <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
      ) : (
        <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      )}
      <span className={task.status === "done" ? "text-muted-foreground" : "text-foreground"}>
        {task.title}
      </span>
    </div>
  );
}

function FileActionItem({ action }: { action: FileAction }) {
  const fileName = action.path.split("/").pop() || action.path;
  
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {action.type === "reading" ? (
        <Eye className="w-3.5 h-3.5 flex-shrink-0" />
      ) : action.type === "editing" ? (
        <FilePen className="w-3.5 h-3.5 flex-shrink-0" />
      ) : (
        <FileText className="w-3.5 h-3.5 flex-shrink-0" />
      )}
      <span className="capitalize">{action.type === "editing" ? "Editing" : action.type === "reading" ? "Read" : "Edited"}</span>
      <span className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{fileName}</span>
    </div>
  );
}

function AIMessageContent({ message }: { message: ChatMessage }) {
  const [showDetails, setShowDetails] = useState(true);
  const tasks = message.metadata?.tasks || [];
  const fileActions = message.metadata?.fileActions || [];
  const thinkingTime = message.metadata?.thinkingTime;
  const isThinking = message.metadata?.isThinking;
  
  const hasTasks = tasks.length > 0;
  const hasFileActions = fileActions.length > 0;
  const hasMetadata = hasTasks || hasFileActions;

  return (
    <div className="space-y-3">
      {/* Thinking indicator */}
      {(isThinking || thinkingTime) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center">
            {isThinking ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <span className="text-xs">💭</span>
            )}
          </div>
          <span>
            {isThinking ? "Thinking..." : `Thought for ${thinkingTime}s`}
          </span>
        </div>
      )}
      
      {/* Plan/Content */}
      {message.content && (
        <p className="whitespace-pre-wrap">{message.content}</p>
      )}
      
      {/* Tasks Panel */}
      {hasTasks && (
        <div className="bg-background/50 rounded-xl border border-border/50 overflow-hidden">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors"
          >
            <span className="font-medium text-sm">Tasks</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {tasks.filter(t => t.status === "done").length}/{tasks.length}
              </span>
              {showDetails ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </button>
          
          {showDetails && (
            <div className="px-4 pb-3 space-y-2">
              {tasks.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* File Actions */}
      {hasFileActions && showDetails && (
        <div className="space-y-1.5">
          {fileActions.map((action, i) => (
            <FileActionItem key={`${action.path}-${i}`} action={action} />
          ))}
        </div>
      )}
      
      {/* Toggle details button */}
      {hasMetadata && (
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          {showDetails ? "Hide" : "Show"} details
        </button>
      )}
      
      {/* Applied Files */}
      {message.metadata?.appliedFiles && message.metadata.appliedFiles.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border/20">
          <p className="text-xs opacity-70 mb-1">Files created:</p>
          <div className="flex flex-wrap gap-1">
            {message.metadata.appliedFiles.slice(0, 5).map((file) => (
              <span
                key={file}
                className="text-xs bg-black/10 rounded px-1.5 py-0.5"
              >
                {file.split("/").pop()}
              </span>
            ))}
            {message.metadata.appliedFiles.length > 5 && (
              <span className="text-xs opacity-70">
                +{message.metadata.appliedFiles.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function GenerationSidebar({
  chatMessages,
  chatInput,
  setChatInput,
  onSubmit,
  onKeyDown,
  isLoading,
  chatContainerRef,
  onBack,
  urlScreenshot,
  supabaseConnection,
  onOpenSupabaseModal,
  aiMode,
  onModeChange,
}: GenerationSidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedImageName, setAttachedImageName] = useState<string | null>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setAttachedImage(base64);
      setAttachedImageName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setAttachedImage(null);
    setAttachedImageName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmitWithImage = () => {
    onSubmit(attachedImage || undefined);
    // Clear image after sending
    setAttachedImage(null);
    setAttachedImageName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleKeyDownWithImage = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitWithImage();
    }
  };

  return (
    <div className="w-[380px] border-r border-border bg-card flex flex-col">
      {/* Header */}
      <div className="h-14 border-b border-border flex items-center px-4 gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">V</span>
          </div>
          <span className="font-semibold text-foreground">VIPE DZ</span>
        </div>
        
        {/* Supabase Connect Button */}
        <Button
          variant={supabaseConnection?.connected ? "outline" : "ghost"}
          size="sm"
          className="ml-auto gap-1.5"
          onClick={onOpenSupabaseModal}
        >
          {supabaseConnection?.connected ? (
            <>
              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              <span className="text-xs">Connected</span>
            </>
          ) : (
            <>
              <Database className="w-3.5 h-3.5" />
              <span className="text-xs">Connect DB</span>
            </>
          )}
        </Button>
      </div>

      {/* Chat/Build Mode Toggle */}
      <div className="px-4 py-3 border-b border-border">
        <Tabs value={aiMode} onValueChange={(v) => onModeChange(v as "chat" | "build")} className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="chat" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <MessageCircle className="w-3.5 h-3.5" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="build" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Code2 className="w-3.5 h-3.5" />
              Build
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Screenshot Preview */}
      {urlScreenshot && (
        <div className="p-4 border-b border-border">
          <div className="relative rounded-lg overflow-hidden border border-border">
            <img
              src={urlScreenshot}
              alt="Website preview"
              className="w-full h-32 object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute bottom-2 left-2 text-xs text-white/80 flex items-center gap-1">
              <Globe className="w-3 h-3" />
              Source website
            </div>
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <ScrollArea className="flex-1">
        <div ref={chatContainerRef} className="p-4 space-y-4">
          {chatMessages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl px-4 py-2.5 ${
                  message.type === "user"
                    ? "bg-primary text-primary-foreground"
                    : message.type === "ai"
                    ? "bg-muted text-foreground"
                    : "bg-muted/50 text-muted-foreground text-sm"
                }`}
              >
                {/* Show attached image if present */}
                {message.metadata?.imageUrl && (
                  <div className="mb-2 rounded-lg overflow-hidden">
                    <img
                      src={message.metadata.imageUrl}
                      alt="Attached"
                      className="max-w-full h-auto max-h-48 object-contain"
                    />
                  </div>
                )}
                
                {message.type === "ai" ? (
                  <AIMessageContent message={message} />
                ) : (
                  <>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    
                    {message.metadata?.appliedFiles && message.metadata.appliedFiles.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/20">
                        <p className="text-xs opacity-70 mb-1">Files created:</p>
                        <div className="flex flex-wrap gap-1">
                          {message.metadata.appliedFiles.slice(0, 5).map((file) => (
                            <span
                              key={file}
                              className="text-xs bg-black/10 rounded px-1.5 py-0.5"
                            >
                              {file.split("/").pop()}
                            </span>
                          ))}
                          {message.metadata.appliedFiles.length > 5 && (
                            <span className="text-xs opacity-70">
                              +{message.metadata.appliedFiles.length - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted/50 rounded-2xl px-4 py-2.5 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Processing...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border">
        {/* Attached Image Preview */}
        {attachedImage && (
          <div className="mb-3 relative inline-block">
            <div className="relative rounded-lg overflow-hidden border border-border bg-muted">
              <img
                src={attachedImage}
                alt="Attached"
                className="h-20 w-auto object-cover"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
                onClick={handleRemoveImage}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate max-w-[150px]">
              {attachedImageName}
            </p>
          </div>
        )}

        <div className="relative">
          <Textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={handleKeyDownWithImage}
            placeholder={attachedImage 
              ? "Describe what you want (e.g., 'copy this style', 'add these features'...)" 
              : "Enter URL to clone or describe what to build..."
            }
            className="min-h-[80px] pr-20 resize-none bg-background"
            disabled={isLoading}
          />
          
          {/* Action buttons */}
          <div className="absolute bottom-2 right-2 flex items-center gap-1">
            {/* Image upload button */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              title="Attach image (screenshot, design reference, etc.)"
            >
              <ImagePlus className="w-4 h-4" />
            </Button>
            
            {/* Send button */}
            <Button
              size="icon"
              className="h-8 w-8"
              onClick={handleSubmitWithImage}
              disabled={isLoading || (!chatInput.trim() && !attachedImage)}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Paste a URL, describe your app, or attach a screenshot
        </p>
      </div>
    </div>
  );
}