import { useState, useRef } from "react";
import { usePosts } from "@/hooks/usePosts";
import { useProjects } from "@/hooks/useProjects";
import { useProfile } from "@/hooks/useProfile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Image, Video, X, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function CreatePost() {
  const { profile } = useProfile();
  const { createPost, uploadMedia } = usePosts();
  const { projects } = useProjects();
  const [content, setContent] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"text" | "image" | "video">("text");
  const [isAppShowcase, setIsAppShowcase] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const publishedProjects = projects.filter((p) => p.is_published);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      toast.error("Please select an image or video file");
      return;
    }

    setMediaFile(file);
    setMediaType(isImage ? "image" : "video");
    setMediaPreview(URL.createObjectURL(file));
  };

  const removeMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType("text");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePost = async () => {
    if (!content.trim() && !mediaFile) {
      toast.error("Please add some content or media");
      return;
    }

    setPosting(true);

    let mediaUrl: string | undefined;
    if (mediaFile) {
      const { url, error } = await uploadMedia(mediaFile);
      if (error) {
        toast.error("Failed to upload media");
        setPosting(false);
        return;
      }
      mediaUrl = url;
    }

    const { error } = await createPost(
      content,
      mediaUrl,
      mediaType,
      isAppShowcase,
      selectedProjectId || undefined
    );

    if (error) {
      toast.error("Failed to create post");
    } else {
      toast.success("Post created!");
      setContent("");
      removeMedia();
      setIsAppShowcase(false);
      setSelectedProjectId(null);
    }

    setPosting(false);
  };

  return (
    <div className="glass-card rounded-xl p-4 mb-6">
      <div className="flex gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={profile?.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary">
            {profile?.display_name?.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 space-y-3">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share what you're building..."
            className="min-h-[80px] resize-none bg-transparent border-none focus-visible:ring-0 p-0 text-foreground placeholder:text-muted-foreground"
          />

          {/* Media Preview */}
          {mediaPreview && (
            <div className="relative inline-block">
              {mediaType === "image" ? (
                <img
                  src={mediaPreview}
                  alt="Preview"
                  className="max-h-48 rounded-lg"
                />
              ) : (
                <video src={mediaPreview} className="max-h-48 rounded-lg" controls />
              )}
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-6 w-6"
                onClick={removeMedia}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* App Showcase Option */}
          {isAppShowcase && publishedProjects.length > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
              <Sparkles className="w-4 h-4 text-primary" />
              <Select
                value={selectedProjectId || undefined}
                onValueChange={setSelectedProjectId}
              >
                <SelectTrigger className="flex-1 h-8 bg-transparent border-none">
                  <SelectValue placeholder="Select a project to showcase" />
                </SelectTrigger>
                <SelectContent>
                  {publishedProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  setIsAppShowcase(false);
                  setSelectedProjectId(null);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-border/40">
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*,video/*"
                className="hidden"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
              >
                <Image className="w-5 h-5 text-muted-foreground" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
              >
                <Video className="w-5 h-5 text-muted-foreground" />
              </Button>
              {publishedProjects.length > 0 && (
                <Button
                  variant={isAppShowcase ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setIsAppShowcase(!isAppShowcase)}
                  className="gap-1"
                >
                  <Sparkles className="w-4 h-4" />
                  Showcase App
                </Button>
              )}
            </div>

            <Button
              onClick={handlePost}
              disabled={posting || (!content.trim() && !mediaFile)}
              className="bg-gradient-primary"
            >
              {posting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Post"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
