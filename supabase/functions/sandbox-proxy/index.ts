import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const targetUrl = url.searchParams.get("url");

    if (!targetUrl) {
      return new Response(
        JSON.stringify({ error: "Missing 'url' query parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[sandbox-proxy] Proxying: ${targetUrl}`);

    // Forward the request to the E2B sandbox
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; VipeProxy/1.0)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    // Get the response body
    let body = await response.text();

    // Rewrite asset URLs to go through proxy
    const baseUrl = new URL(targetUrl);
    const proxyBase = `${url.origin}${url.pathname}?url=`;

    // Rewrite relative URLs in the HTML
    body = body.replace(
      /(src|href)=["'](?!https?:\/\/|data:|#|javascript:)([^"']+)["']/g,
      (match, attr, path) => {
        const absoluteUrl = new URL(path, targetUrl).href;
        return `${attr}="${proxyBase}${encodeURIComponent(absoluteUrl)}"`;
      }
    );

    // Rewrite module imports
    body = body.replace(
      /from\s+["'](?!https?:\/\/)([^"']+)["']/g,
      (match, path) => {
        if (path.startsWith('/')) {
          const absoluteUrl = `${baseUrl.origin}${path}`;
          return `from "${proxyBase}${encodeURIComponent(absoluteUrl)}"`;
        }
        return match;
      }
    );

    // Add base tag to handle relative URLs
    if (body.includes('<head>')) {
      body = body.replace('<head>', `<head><base href="${targetUrl}">`);
    }

    // Create response headers without X-Frame-Options or restrictive CSP
    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      "Content-Type": response.headers.get("Content-Type") || "text/html",
      // Remove frame-blocking headers by not including them
    };

    // Copy some useful headers but skip security headers that block framing
    const skipHeaders = [
      "x-frame-options",
      "content-security-policy",
      "x-content-type-options",
      "cross-origin-opener-policy",
      "cross-origin-embedder-policy",
      "cross-origin-resource-policy",
    ];

    response.headers.forEach((value, key) => {
      if (!skipHeaders.includes(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    });

    return new Response(body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("[sandbox-proxy] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Proxy error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
