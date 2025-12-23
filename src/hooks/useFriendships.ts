import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { Profile } from "./useProfile";

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  updated_at: string;
}

export interface FriendWithProfile extends Friendship {
  profile: Profile;
}

export function useFriendships() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendWithProfile[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setFriends([]);
      setPendingRequests([]);
      setSentRequests([]);
      setLoading(false);
      return;
    }

    fetchFriendships();
  }, [user]);

  const fetchFriendships = async () => {
    if (!user) return;
    setLoading(true);

    const { data: friendships, error } = await supabase
      .from("friendships")
      .select("*")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    if (error) {
      console.error("Error fetching friendships:", error);
      setLoading(false);
      return;
    }

    const userIds = new Set<string>();
    friendships?.forEach((f) => {
      if (f.requester_id !== user.id) userIds.add(f.requester_id);
      if (f.addressee_id !== user.id) userIds.add(f.addressee_id);
    });

    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("user_id", Array.from(userIds));

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

    const friendsList: FriendWithProfile[] = [];
    const pendingList: FriendWithProfile[] = [];
    const sentList: FriendWithProfile[] = [];

    friendships?.forEach((f) => {
      const otherUserId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
      const profile = profileMap.get(otherUserId);
      if (!profile) return;

      const friendWithProfile: FriendWithProfile = {
        ...f,
        status: f.status as "pending" | "accepted" | "declined",
        profile: profile as Profile,
      };

      if (f.status === "accepted") {
        friendsList.push(friendWithProfile);
      } else if (f.status === "pending") {
        if (f.addressee_id === user.id) {
          pendingList.push(friendWithProfile);
        } else {
          sentList.push(friendWithProfile);
        }
      }
    });

    setFriends(friendsList);
    setPendingRequests(pendingList);
    setSentRequests(sentList);
    setLoading(false);
  };

  const sendFriendRequest = async (addresseeId: string) => {
    if (!user) return { error: new Error("Not authenticated") };

    const { data, error } = await supabase
      .from("friendships")
      .insert({
        requester_id: user.id,
        addressee_id: addresseeId,
        status: "pending",
      })
      .select()
      .single();

    if (!error) {
      await fetchFriendships();
    }

    return { data, error };
  };

  const acceptFriendRequest = async (friendshipId: string) => {
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", friendshipId);

    if (!error) {
      await fetchFriendships();
    }

    return { error };
  };

  const declineFriendRequest = async (friendshipId: string) => {
    const { error } = await supabase
      .from("friendships")
      .update({ status: "declined" })
      .eq("id", friendshipId);

    if (!error) {
      await fetchFriendships();
    }

    return { error };
  };

  const removeFriend = async (friendshipId: string) => {
    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("id", friendshipId);

    if (!error) {
      await fetchFriendships();
    }

    return { error };
  };

  const searchUsers = async (query: string): Promise<Profile[]> => {
    if (!query.trim()) return [];

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(10);

    if (error) {
      console.error("Error searching users:", error);
      return [];
    }

    // Filter out current user
    return (data as Profile[]).filter((p) => p.user_id !== user?.id);
  };

  return {
    friends,
    pendingRequests,
    sentRequests,
    loading,
    fetchFriendships,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    searchUsers,
  };
}
