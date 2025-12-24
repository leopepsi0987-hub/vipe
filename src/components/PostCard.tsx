import { useState } from "react";
import { PostWithDetails, usePosts } from "@/hooks/usePosts";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Heart,
  MessageCircle,
  Share2,
  Send,
  Trash2,
  MoreHorizontal,
  Sparkles,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface PostCardProps {
  post: PostWithDetails;
  onRemix?: (projectId: string) => void;
}

export function PostCard({ post, onRemix }: PostCardProps) {
  const { user } = useAuth();
  const { likePost, unlikePost, addComment, deleteComment, sharePost, deletePost } = usePosts();
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleLike = async () => {
    if (post.is_liked) {
      await unlikePost(post.id);
    } else {
      await likePost(post.id);
    }
  };

  const handleShare = async () => {
    if (post.is_shared) {
      toast.info("You've already shared this post");
      return;
    }
    const { error } = await sharePost(post.id);
    if (!error) {
      toast.success("Post shared!");
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    const { error } = await addComment(post.id, newComment.trim());
    if (!error) {
      setNewComment("");
    }
    setSubmitting(false);
  };

  const handleDeletePost = async () => {
    const { error } = await deletePost(post.id);
    if (!error) {
      toast.success("Post deleted");
    }
  };

  const handleRemix = () => {
    if (post.project_id && onRemix) {
      onRemix(post.project_id);
    }
  };

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={post.profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {post.profile?.display_name?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-foreground">{post.profile?.display_name}</p>
            <p className="text-sm text-muted-foreground">
              @{post.profile?.username} · {format(new Date(post.created_at), "MMM d")}
            </p>
          </div>
        </div>

        {user?.id === post.user_id && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDeletePost} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Content */}
      {post.content && (
        <div className="px-4 pb-3">
          <p className="text-foreground whitespace-pre-wrap">{post.content}</p>
        </div>
      )}

      {/* Media */}
      {post.media_url && (
        <div className="px-4 pb-3">
          {post.media_type === "image" ? (
            <img
              src={post.media_url}
              alt="Post media"
              className="rounded-lg max-h-96 w-full object-cover"
              onError={(e) => {
                // Hide broken images
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : post.media_type === "video" ? (
            <video
              src={post.media_url}
              controls
              className="rounded-lg max-h-96 w-full"
            />
          ) : null}
        </div>
      )}

      {/* App Showcase Badge */}
      {post.is_app_showcase && post.project_id && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">App Showcase</span>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={handleRemix}
            >
              Remix
            </Button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-6 px-4 py-3 border-t border-border/40">
        <button
          onClick={handleLike}
          className={cn(
            "flex items-center gap-2 text-sm transition-colors",
            post.is_liked ? "text-red-500" : "text-muted-foreground hover:text-red-500"
          )}
        >
          <Heart className={cn("w-5 h-5", post.is_liked && "fill-current")} />
          {post.likes_count > 0 && post.likes_count}
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <MessageCircle className="w-5 h-5" />
          {post.comments_count > 0 && post.comments_count}
        </button>

        <button
          onClick={handleShare}
          className={cn(
            "flex items-center gap-2 text-sm transition-colors",
            post.is_shared ? "text-primary" : "text-muted-foreground hover:text-primary"
          )}
        >
          <Share2 className="w-5 h-5" />
          {post.shares_count > 0 && post.shares_count}
        </button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="border-t border-border/40 p-4 space-y-4">
          {/* Comment Input */}
          <div className="flex items-center gap-2">
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 glass-input"
              onKeyPress={(e) => {
                if (e.key === "Enter") handleAddComment();
              }}
            />
            <Button
              onClick={handleAddComment}
              disabled={!newComment.trim() || submitting}
              size="icon"
              className="bg-gradient-primary"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>

          {/* Comments List */}
          <div className="space-y-3">
            {post.comments.map((comment) => (
              <div key={comment.id} className="flex items-start gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={comment.profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {comment.profile?.display_name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">
                      {comment.profile?.display_name}
                    </p>
                    {user?.id === comment.user_id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => deleteComment(comment.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{comment.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
