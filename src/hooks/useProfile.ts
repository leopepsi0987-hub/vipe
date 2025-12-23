import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching profile:", error);
    }
    
    setProfile(data as Profile | null);
    setLoading(false);
  };

  const createProfile = async (displayName: string, username: string, avatarUrl?: string) => {
    if (!user) return { error: new Error("Not authenticated") };

    const { data, error } = await supabase
      .from("profiles")
      .insert({
        user_id: user.id,
        display_name: displayName,
        username: username.toLowerCase(),
        avatar_url: avatarUrl || null,
      })
      .select()
      .single();

    if (error) {
      return { error };
    }

    setProfile(data as Profile);
    return { data };
  };

  const updateProfile = async (updates: Partial<Pick<Profile, "display_name" | "username" | "avatar_url" | "bio">>) => {
    if (!user || !profile) return { error: new Error("Not authenticated") };

    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      return { error };
    }

    setProfile(data as Profile);
    return { data };
  };

  const checkUsernameAvailable = async (username: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .single();

    if (error && error.code === "PGRST116") {
      return true; // Not found = available
    }
    
    // If we found a profile but it's ours, still available (for updates)
    if (data && profile && data.id === profile.id) {
      return true;
    }

    return !data;
  };

  const uploadAvatar = async (file: File): Promise<{ url?: string; error?: Error }> => {
    if (!user) return { error: new Error("Not authenticated") };

    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      return { error: uploadError };
    }

    const { data } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    return { url: data.publicUrl };
  };

  return {
    profile,
    loading,
    fetchProfile,
    createProfile,
    updateProfile,
    checkUsernameAvailable,
    uploadAvatar,
  };
}
