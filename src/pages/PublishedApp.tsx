import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PublishedApp() {
  const { slug } = useParams<{ slug: string }>();
  const [html, setHtml] = useState<string | null>(null);
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
              Go Back
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Clean published app - full screen iframe, no branding
  return (
    <iframe
      srcDoc={html || ""}
      className="w-full h-screen border-0"
      title="Published App"
      sandbox="allow-scripts allow-forms allow-modals allow-popups"
    />
  );
}
