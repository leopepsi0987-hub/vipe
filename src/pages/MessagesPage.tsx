import { MainLayout } from "@/components/MainLayout";
import { MessageSquare, UserPlus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function MessagesPage() {
  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary" />
            Messages
          </h1>
          <Button className="bg-gradient-primary">
            <UserPlus className="w-4 h-4 mr-2" />
            Add Friend
          </Button>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search conversations..." className="pl-10 glass-input" />
        </div>

        <div className="glass-card rounded-xl p-12 text-center">
          <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-medium text-foreground mb-2">No messages yet</h2>
          <p className="text-muted-foreground">Start a conversation by adding friends!</p>
        </div>
      </div>
    </MainLayout>
  );
}
