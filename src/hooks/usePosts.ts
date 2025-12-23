import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { Profile } from "./useProfile";

export interface Post {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: "text" | "image" | "video";
  is_app_showcase: boolean;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: Profile;
}

export interface PostWithDetails extends Post {
  profile: Profile;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  is_liked: boolean;
  is_shared: boolean;
  comments: Comment[];
}

export function usePosts() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    setLoading(true);

    const { data: postsData, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching posts:", error);
      setLoading(false);
      return;
    }

    const userIds = new Set(postsData?.map((p) => p.user_id) || []);
    const postIds = postsData?.map((p) => p.id) || [];

    const [profilesRes, likesRes, commentsRes, sharesRes, userLikesRes, userSharesRes] =
      await Promise.all([
        supabase.from("profiles").select("*").in("user_id", Array.from(userIds)),
        supabase.from("likes").select("post_id"),
        supabase.from("comments").select("*").in("post_id", postIds),
        supabase.from("shares").select("post_id"),
        user
          ? supabase.from("likes").select("post_id").eq("user_id", user.id)
          : { data: [] },
        user
          ? supabase.from("shares").select("post_id").eq("user_id", user.id)
          : { data: [] },
      ]);

    const profileMap = new Map(profilesRes.data?.map((p) => [p.user_id, p]) || []);
    
    const likesCount = new Map<string, number>();
    likesRes.data?.forEach((l) => {
      likesCount.set(l.post_id, (likesCount.get(l.post_id) || 0) + 1);
    });

    const sharesCount = new Map<string, number>();
    sharesRes.data?.forEach((s) => {
      sharesCount.set(s.post_id, (sharesCount.get(s.post_id) || 0) + 1);
    });

    const userLikedPosts = new Set(userLikesRes.data?.map((l) => l.post_id) || []);
    const userSharedPosts = new Set(userSharesRes.data?.map((s) => s.post_id) || []);

    // Get comment user profiles
    const commentUserIds = new Set(commentsRes.data?.map((c) => c.user_id) || []);
    const { data: commentProfiles } = await supabase
      .from("profiles")
      .select("*")
      .in("user_id", Array.from(commentUserIds));

    const commentProfileMap = new Map(commentProfiles?.map((p) => [p.user_id, p]) || []);

    const commentsMap = new Map<string, Comment[]>();
    commentsRes.data?.forEach((c) => {
      const comments = commentsMap.get(c.post_id) || [];
      comments.push({
        ...c,
        profile: commentProfileMap.get(c.user_id) as Profile,
      });
      commentsMap.set(c.post_id, comments);
    });

    const postsWithDetails: PostWithDetails[] = (postsData || []).map((post) => ({
      ...post,
      media_type: post.media_type as "text" | "image" | "video",
      profile: profileMap.get(post.user_id) as Profile,
      likes_count: likesCount.get(post.id) || 0,
      comments_count: commentsMap.get(post.id)?.length || 0,
      shares_count: sharesCount.get(post.id) || 0,
      is_liked: userLikedPosts.has(post.id),
      is_shared: userSharedPosts.has(post.id),
      comments: commentsMap.get(post.id) || [],
    }));

    setPosts(postsWithDetails);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const createPost = async (
    content: string,
    mediaUrl?: string,
    mediaType: "text" | "image" | "video" = "text",
    isAppShowcase = false,
    projectId?: string
  ) => {
    if (!user) return { error: new Error("Not authenticated") };

    const { data, error } = await supabase
      .from("posts")
      .insert({
        user_id: user.id,
        content,
        media_url: mediaUrl || null,
        media_type: mediaType,
        is_app_showcase: isAppShowcase,
        project_id: projectId || null,
      })
      .select()
      .single();

    if (!error) {
      await fetchPosts();
    }

    return { data, error };
  };

  const deletePost = async (postId: string) => {
    const { error } = await supabase.from("posts").delete().eq("id", postId);

    if (!error) {
      await fetchPosts();
    }

    return { error };
  };

  const likePost = async (postId: string) => {
    if (!user) return { error: new Error("Not authenticated") };

    const { error } = await supabase.from("likes").insert({
      user_id: user.id,
      post_id: postId,
    });

    if (!error) {
      await fetchPosts();
    }

    return { error };
  };

  const unlikePost = async (postId: string) => {
    if (!user) return { error: new Error("Not authenticated") };

    const { error } = await supabase
      .from("likes")
      .delete()
      .eq("user_id", user.id)
      .eq("post_id", postId);

    if (!error) {
      await fetchPosts();
    }

    return { error };
  };

  const addComment = async (postId: string, content: string) => {
    if (!user) return { error: new Error("Not authenticated") };

    const { data, error } = await supabase
      .from("comments")
      .insert({
        user_id: user.id,
        post_id: postId,
        content,
      })
      .select()
      .single();

    if (!error) {
      await fetchPosts();
    }

    return { data, error };
  };

  const deleteComment = async (commentId: string) => {
    const { error } = await supabase.from("comments").delete().eq("id", commentId);

    if (!error) {
      await fetchPosts();
    }

    return { error };
  };

  const sharePost = async (postId: string) => {
    if (!user) return { error: new Error("Not authenticated") };

    const { error } = await supabase.from("shares").insert({
      user_id: user.id,
      post_id: postId,
    });

    if (!error) {
      await fetchPosts();
    }

    return { error };
  };

  const uploadMedia = async (file: File): Promise<{ url?: string; error?: Error }> => {
    if (!user) return { error: new Error("Not authenticated") };

    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("post-media")
      .upload(filePath, file);

    if (uploadError) {
      return { error: uploadError };
    }

    const { data } = supabase.storage.from("post-media").getPublicUrl(filePath);

    return { url: data.publicUrl };
  };

  return {
    posts,
    loading,
    fetchPosts,
    createPost,
    deletePost,
    likePost,
    unlikePost,
    addComment,
    deleteComment,
    sharePost,
    uploadMedia,
  };
}
