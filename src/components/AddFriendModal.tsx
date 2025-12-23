import { useState } from "react";
import { useFriendships } from "@/hooks/useFriendships";
import { Profile } from "@/hooks/useProfile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, UserPlus, Check, Clock } from "lucide-react";
import { toast } from "sonner";

interface AddFriendModalProps {
  open: boolean;
  onClose: () => void;
}

export function AddFriendModal({ open, onClose }: AddFriendModalProps) {
  const { searchUsers, sendFriendRequest, friends, sentRequests } = useFriendships();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    const results = await searchUsers(searchQuery);
    setSearchResults(results);
    setSearching(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleSendRequest = async (userId: string, displayName: string) => {
    const { error } = await sendFriendRequest(userId);
    if (error) {
      toast.error("Failed to send friend request");
    } else {
      toast.success(`Friend request sent to ${displayName}`);
      // Update search results to reflect the new status
      handleSearch();
    }
  };

  const isFriend = (userId: string) => {
    return friends.some((f) => f.profile.user_id === userId);
  };

  const isPending = (userId: string) => {
    return sentRequests.some((r) => r.profile.user_id === userId);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Friend</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Search by username or name..."
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} disabled={searching}>
              Search
            </Button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {searchResults.length === 0 && searchQuery && !searching && (
              <p className="text-center text-muted-foreground py-4">
                No users found
              </p>
            )}

            {searchResults.map((profile) => (
              <div
                key={profile.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {profile.display_name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground">{profile.display_name}</p>
                    <p className="text-sm text-muted-foreground">@{profile.username}</p>
                  </div>
                </div>

                {isFriend(profile.user_id) ? (
                  <Button variant="ghost" size="sm" disabled>
                    <Check className="w-4 h-4 mr-1" />
                    Friends
                  </Button>
                ) : isPending(profile.user_id) ? (
                  <Button variant="ghost" size="sm" disabled>
                    <Clock className="w-4 h-4 mr-1" />
                    Pending
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSendRequest(profile.user_id, profile.display_name)}
                  >
                    <UserPlus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
