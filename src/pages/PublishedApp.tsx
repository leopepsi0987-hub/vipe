import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const PublishedApp = () => {
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

  // The bundled HTML now uses CDN URLs for all vendor files (React, Babel, Tailwind)
  // so it should work directly without path fixups
  
  // Inject minimal styling if HTML doesn't have proper structure
  const preparedHtml = html ? (
    html.includes('<html') ? html : `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <!-- React from CDN -->
  <script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone@7.24.5/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { min-height: 100vh; font-family: system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body>${html}</body>
</html>`
  ) : "";

  return (
    <div className="w-full h-screen">
      <iframe
        srcDoc={preparedHtml}
        className="w-full h-full border-0"
        title="Published App"
        sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
        style={{ display: 'block' }}
      />
    </div>
  );
};

export default PublishedApp;
