import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/MainLayout";
import { usePosts } from "@/hooks/usePosts";
import { CreatePost } from "@/components/CreatePost";
import { PostCard } from "@/components/PostCard";
import { LayoutGrid, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function NewsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { posts, loading } = usePosts();

  const handleRemix = async (projectId: string) => {
    if (!user) {
      toast.error("Please sign in to remix projects");
      return;
    }

    // Fetch the original project (it must be published to be visible)
    const { data: originalProject, error: fetchError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("is_published", true)
      .single();

    if (fetchError || !originalProject) {
      toast.error("Could not find the project to remix");
      return;
    }

    // Create a copy of the project for the current user
    const { data: newProject, error: createError } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        name: `${originalProject.name} (Remix)`,
        html_code: originalProject.html_code,
        is_published: false,
      })
      .select()
      .single();

    if (createError || !newProject) {
      toast.error("Failed to create remix");
      return;
    }

    // Also copy the project files
    const { data: originalFiles } = await supabase
      .from("project_files")
      .select("*")
      .eq("project_id", projectId);

    if (originalFiles && originalFiles.length > 0) {
      const newFiles = originalFiles.map((file) => ({
        project_id: newProject.id,
        file_path: file.file_path,
        content: file.content,
      }));

      await supabase.from("project_files").insert(newFiles);
    }

    toast.success("Project remixed! Opening editor...");
    navigate(`/project/${newProject.id}`);
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2 mb-6">
          <LayoutGrid className="w-6 h-6 text-primary" />
          Posts
        </h1>

        {/* Create Post */}
        <CreatePost />

        {/* Posts */}
        {posts.length > 0 ? (
          <div className="space-y-6">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onRemix={handleRemix} />
            ))}
          </div>
        ) : (
          <div className="glass-card rounded-xl p-12 text-center">
            <LayoutGrid className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-medium text-foreground mb-2">No posts yet</h2>
            <p className="text-muted-foreground">Be the first to share something!</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
