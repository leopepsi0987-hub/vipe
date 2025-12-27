import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function generateErrorPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      min-height: 100vh; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .card {
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      padding: 32px;
      text-align: center;
      max-width: 400px;
      margin: 20px;
    }
    .icon {
      width: 64px;
      height: 64px;
      background: linear-gradient(135deg, #f97316 0%, #dc2626 100%);
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      font-size: 28px;
      font-weight: bold;
      color: white;
    }
    h1 { color: white; font-size: 20px; margin-bottom: 12px; }
    p { color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.5; }
    .loader {
      width: 24px;
      height: 24px;
      border: 3px solid rgba(255,255,255,0.2);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 20px auto 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">V</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <div class="loader"></div>
  </div>
</body>
</html>`;
}

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

    // Check for various E2B error conditions
    const isClosedPort = body.includes("Closed Port") || body.includes("Connection refused") || body.includes("no service running");
    const isSandboxExpired = body.includes("Sandbox Not Found") || (body.includes("sandbox") && body.includes("wasn't found"));
    
    if (isSandboxExpired) {
      console.log(`[sandbox-proxy] Sandbox expired`);
      return new Response(
        generateErrorPage("Sandbox Expired", "The sandbox has timed out. Please regenerate your app."),
        {
          status: 200, // Return 200 so iframe displays it
          headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
        },
      );
    }

    if (isClosedPort) {
      console.log(`[sandbox-proxy] Port closed, Vite not ready`);
      return new Response(
        generateErrorPage(
          "Starting Server...",
          "The development server is starting. Please wait a moment and press Refresh.",
        ),
        {
          status: 200, // Return 200 so iframe displays it
          headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
        },
      );
    }

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

    // Determine proper content type - always use text/html for HTML content
    const originalContentType = response.headers.get("Content-Type") || "";
    let contentType = originalContentType;
    
    // If body looks like HTML, force text/html with charset
    if (body.trim().startsWith("<!DOCTYPE") || body.trim().startsWith("<html") || body.includes("<head>")) {
      contentType = "text/html; charset=utf-8";
    } else if (!contentType) {
      contentType = "text/html; charset=utf-8";
    }

    // Create response headers without X-Frame-Options or restrictive CSP
    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      "Content-Type": contentType,
    };

    // Copy some useful headers but skip security headers that block framing
    const skipHeaders = [
      "x-frame-options",
      "content-security-policy",
      "x-content-type-options",
      "cross-origin-opener-policy",
      "cross-origin-embedder-policy",
      "cross-origin-resource-policy",
      "content-type", // Skip - we set this explicitly above
    ];

    response.headers.forEach((value, key) => {
      if (!skipHeaders.includes(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    });

    console.log(`[sandbox-proxy] Returning with Content-Type: ${contentType}`);

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
