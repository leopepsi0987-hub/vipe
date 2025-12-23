import { useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { useMessages, Conversation } from "@/hooks/useMessages";
import { useFriendships } from "@/hooks/useFriendships";
import { ChatWindow } from "@/components/ChatWindow";
import { AddFriendModal } from "@/components/AddFriendModal";
import { FriendRequests } from "@/components/FriendRequests";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, UserPlus, Search, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Profile } from "@/hooks/useProfile";

export default function MessagesPage() {
  const { conversations, loading: messagesLoading } = useMessages();
  const { friends, loading: friendsLoading } = useFriendships();
  const [selectedFriend, setSelectedFriend] = useState<Profile | null>(null);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loading = messagesLoading || friendsLoading;

  // Filter conversations by search
  const filteredConversations = conversations.filter(
    (c) =>
      c.profile.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.profile.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Friends without conversations
  const friendsWithoutConversations = friends.filter(
    (f) => !conversations.some((c) => c.friendId === f.profile.user_id)
  );

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedFriend(conv.profile);
  };

  const handleSelectFriend = (profile: Profile) => {
    setSelectedFriend(profile);
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
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {selectedFriend ? (
          <div className="glass-card rounded-xl overflow-hidden">
            <ChatWindow
              friend={selectedFriend}
              onBack={() => setSelectedFriend(null)}
            />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-primary" />
                Messages
              </h1>
              <Button
                onClick={() => setShowAddFriend(true)}
                className="bg-gradient-primary"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add Friend
              </Button>
            </div>

            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="pl-10 glass-input"
              />
            </div>

            {/* Friend Requests */}
            <FriendRequests />

            {/* Conversations */}
            {filteredConversations.length > 0 && (
              <div className="mb-6">
                <h2 className="text-sm font-medium text-muted-foreground mb-3">
                  Conversations
                </h2>
                <div className="space-y-2">
                  {filteredConversations.map((conv) => (
                    <button
                      key={conv.friendId}
                      onClick={() => handleSelectConversation(conv)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg glass-card hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="relative">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={conv.profile.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {conv.profile.display_name?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {conv.unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {conv.profile.display_name}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {conv.lastMessage?.content}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {conv.lastMessage &&
                          format(new Date(conv.lastMessage.created_at), "MMM d")}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Friends without conversations */}
            {friendsWithoutConversations.length > 0 && (
              <div className="mb-6">
                <h2 className="text-sm font-medium text-muted-foreground mb-3">
                  Friends
                </h2>
                <div className="space-y-2">
                  {friendsWithoutConversations.map((friend) => (
                    <button
                      key={friend.id}
                      onClick={() => handleSelectFriend(friend.profile)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg glass-card hover:bg-muted/50 transition-colors text-left"
                    >
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={friend.profile.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {friend.profile.display_name?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {friend.profile.display_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          @{friend.profile.username}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Start a conversation
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {conversations.length === 0 && friends.length === 0 && (
              <div className="glass-card rounded-xl p-12 text-center">
                <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-lg font-medium text-foreground mb-2">
                  No messages yet
                </h2>
                <p className="text-muted-foreground mb-4">
                  Start a conversation by adding friends!
                </p>
                <Button
                  onClick={() => setShowAddFriend(true)}
                  className="bg-gradient-primary"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Friend
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <AddFriendModal open={showAddFriend} onClose={() => setShowAddFriend(false)} />
    </MainLayout>
  );
}
