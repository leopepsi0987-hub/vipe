import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { Profile } from "./useProfile";

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface Conversation {
  friendId: string;
  profile: Profile;
  lastMessage: Message | null;
  unreadCount: number;
}

export function useMessages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: messages, error } = await supabase
      .from("messages")
      .select("*")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching messages:", error);
      setLoading(false);
      return;
    }

    const userIds = new Set<string>();
    messages?.forEach((m) => {
      if (m.sender_id !== user.id) userIds.add(m.sender_id);
      if (m.receiver_id !== user.id) userIds.add(m.receiver_id);
    });

    if (userIds.size === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("user_id", Array.from(userIds));

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);
    const conversationMap = new Map<string, Conversation>();

    messages?.forEach((m) => {
      const friendId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
      const profile = profileMap.get(friendId);
      if (!profile) return;

      if (!conversationMap.has(friendId)) {
        conversationMap.set(friendId, {
          friendId,
          profile: profile as Profile,
          lastMessage: m as Message,
          unreadCount: 0,
        });
      }

      if (m.receiver_id === user.id && !m.is_read) {
        const conv = conversationMap.get(friendId)!;
        conv.unreadCount++;
      }
    });

    setConversations(Array.from(conversationMap.values()));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setConversations([]);
      setLoading(false);
      return;
    }

    fetchConversations();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("messages-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchConversations]);

  const sendMessage = async (receiverId: string, content: string) => {
    if (!user) return { error: new Error("Not authenticated") };

    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: user.id,
        receiver_id: receiverId,
        content,
      })
      .select()
      .single();

    return { data, error };
  };

  const getMessagesWithUser = async (friendId: string): Promise<Message[]> => {
    if (!user) return [];

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`
      )
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching messages:", error);
      return [];
    }

    return data as Message[];
  };

  const markAsRead = async (messageIds: string[]) => {
    if (!user || messageIds.length === 0) return;

    await supabase
      .from("messages")
      .update({ is_read: true })
      .in("id", messageIds)
      .eq("receiver_id", user.id);
  };

  return {
    conversations,
    loading,
    fetchConversations,
    sendMessage,
    getMessagesWithUser,
    markAsRead,
  };
}
