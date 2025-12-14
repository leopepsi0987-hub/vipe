import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PublishedApp() {
  const { slug } = useParams<{ slug: string }>();
  const [html, setHtml] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchApp = async () => {
      if (!slug) {
        setError("No app specified");
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("projects")
        .select("html_code, name, is_published")
        .eq("slug", slug)
        .eq("is_published", true)
        .single();

      if (fetchError || !data) {
        setError("App not found or not published");
        setLoading(false);
        return;
      }

      setHtml(data.html_code);
      setProjectName(data.name);
      setLoading(false);
    };

    fetchApp();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading app...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-destructive/10 flex items-center justify-center">
            <span className="text-3xl">😕</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">App Not Found</h1>
            <p className="text-muted-foreground">{error}</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go to Vipe
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header Bar */}
      <div className="h-12 bg-card border-b border-border flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-6 h-6 rounded-md bg-gradient-primary flex items-center justify-center">
              <Zap className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Made with Vipe</span>
          </Link>
          <span className="text-border">|</span>
          <span className="text-sm font-medium text-foreground">{projectName}</span>
        </div>
        <Button asChild size="sm" variant="glow">
          <Link to="/">Build Your Own</Link>
        </Button>
      </div>

      {/* App Content */}
      <div className="flex-1">
        <iframe
          srcDoc={html || ""}
          className="w-full h-full border-0"
          title={projectName}
          sandbox="allow-scripts allow-forms allow-modals allow-popups"
        />
      </div>
    </div>
  );
}
