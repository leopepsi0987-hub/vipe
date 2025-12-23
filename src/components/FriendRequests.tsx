import { useFriendships } from "@/hooks/useFriendships";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

export function FriendRequests() {
  const { pendingRequests, acceptFriendRequest, declineFriendRequest } = useFriendships();

  const handleAccept = async (friendshipId: string, displayName: string) => {
    const { error } = await acceptFriendRequest(friendshipId);
    if (error) {
      toast.error("Failed to accept request");
    } else {
      toast.success(`You are now friends with ${displayName}`);
    }
  };

  const handleDecline = async (friendshipId: string) => {
    const { error } = await declineFriendRequest(friendshipId);
    if (error) {
      toast.error("Failed to decline request");
    }
  };

  if (pendingRequests.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="text-sm font-medium text-muted-foreground mb-3">
        Friend Requests ({pendingRequests.length})
      </h2>
      <div className="space-y-2">
        {pendingRequests.map((request) => (
          <div
            key={request.id}
            className="flex items-center justify-between p-3 rounded-lg glass-card"
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={request.profile.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {request.profile.display_name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-foreground">{request.profile.display_name}</p>
                <p className="text-sm text-muted-foreground">@{request.profile.username}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                className="bg-gradient-primary"
                onClick={() => handleAccept(request.id, request.profile.display_name)}
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDecline(request.id)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
