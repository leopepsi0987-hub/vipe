import { MainLayout } from "@/components/MainLayout";
import { Newspaper, Heart, MessageCircle, Share2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NewsPage() {
  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2 mb-6">
          <Newspaper className="w-6 h-6 text-primary" />
          News Feed
        </h1>

        <div className="glass-card rounded-xl p-6 mb-6">
          <textarea
            placeholder="Share what you're building..."
            className="w-full bg-transparent border-none outline-none resize-none text-foreground placeholder:text-muted-foreground"
            rows={3}
          />
          <div className="flex justify-end pt-4 border-t border-border/40">
            <Button className="bg-gradient-primary">
              <Sparkles className="w-4 h-4 mr-2" />
              Post
            </Button>
          </div>
        </div>

        <div className="glass-card rounded-xl p-12 text-center">
          <Newspaper className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-medium text-foreground mb-2">No posts yet</h2>
          <p className="text-muted-foreground">Be the first to share something!</p>
        </div>
      </div>
    </MainLayout>
  );
}
