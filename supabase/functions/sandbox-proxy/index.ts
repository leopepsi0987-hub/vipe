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

    // Check if this is a non-HTML asset request (JS, CSS, etc)
    const isAssetRequest = /\.(js|jsx|ts|tsx|css|json|svg|png|jpg|jpeg|gif|woff|woff2|ttf|eot|ico)($|\?)/.test(targetUrl) ||
                           targetUrl.includes("/@") || // Vite special paths like /@vite/client, /@react-refresh
                           targetUrl.includes("/node_modules/");

    // Forward the request to the E2B sandbox
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; VipeProxy/1.0)",
        "Accept": isAssetRequest ? "*/*" : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    // For asset requests, stream the response directly without modification
    if (isAssetRequest) {
      const originalContentType = response.headers.get("Content-Type") || "application/octet-stream";
      
      return new Response(response.body, {
        status: response.status,
        headers: {
          ...corsHeaders,
          "Content-Type": originalContentType,
          "Cache-Control": "no-cache",
        },
      });
    }

    // Get the response body for HTML processing
    let body = await response.text();

    // Check for various E2B error conditions
    const isClosedPort = body.includes("Closed Port") || body.includes("Connection refused") || body.includes("no service running");
    const isSandboxExpired = body.includes("Sandbox Not Found") || (body.includes("sandbox") && body.includes("wasn't found"));
    
    if (isSandboxExpired) {
      console.log(`[sandbox-proxy] Sandbox expired`);
      return new Response(
        generateErrorPage("Sandbox Expired", "The sandbox has timed out. Please regenerate your app."),
        {
          status: 200,
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
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
        },
      );
    }

    // Build proxy URL for rewriting
    const proxyBase = `${url.origin}${url.pathname}?url=`;
    const baseUrl = new URL(targetUrl);

    // Only process HTML content
    const contentType = response.headers.get("Content-Type") || "";
    const isHtml = contentType.includes("text/html") || 
                   body.trim().startsWith("<!DOCTYPE") || 
                   body.trim().startsWith("<html") || 
                   body.includes("<head>");

    if (isHtml) {
      // Rewrite script src and link href to go through proxy
      body = body.replace(
        /<(script|link)([^>]*)(src|href)=["']([^"']+)["']([^>]*)>/gi,
        (match, tag, before, attr, urlPath, after) => {
          // Skip data URLs and fragments
          if (urlPath.startsWith("data:") || urlPath.startsWith("#") || urlPath.startsWith("javascript:")) {
            return match;
          }
          
          // Build absolute URL
          let absoluteUrl: string;
          if (urlPath.startsWith("http://") || urlPath.startsWith("https://")) {
            absoluteUrl = urlPath;
          } else if (urlPath.startsWith("/")) {
            absoluteUrl = `${baseUrl.origin}${urlPath}`;
          } else {
            absoluteUrl = new URL(urlPath, targetUrl).href;
          }
          
          const proxiedUrl = `${proxyBase}${encodeURIComponent(absoluteUrl)}`;
          return `<${tag}${before}${attr}="${proxiedUrl}"${after}>`;
        }
      );

      // Rewrite ES module imports in inline scripts
      body = body.replace(
        /import\s+(?:{[^}]+}|[\w\*\s,]+)\s+from\s+["']([^"']+)["']/g,
        (match, importPath) => {
          if (importPath.startsWith("http://") || importPath.startsWith("https://")) {
            // Already absolute, just proxy it
            return match.replace(importPath, `${proxyBase}${encodeURIComponent(importPath)}`);
          }
          if (importPath.startsWith("/") || importPath.startsWith("./") || importPath.startsWith("../")) {
            const absoluteUrl = new URL(importPath, targetUrl).href;
            return match.replace(importPath, `${proxyBase}${encodeURIComponent(absoluteUrl)}`);
          }
          return match;
        }
      );
    }

    // Create response headers
    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      "Content-Type": isHtml ? "text/html; charset=utf-8" : (contentType || "text/html; charset=utf-8"),
      "Cache-Control": "no-cache",
    };

    console.log(`[sandbox-proxy] Returning HTML with proxied assets`);

    return new Response(body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("[sandbox-proxy] Error:", error);
    return new Response(
      generateErrorPage("Connection Error", "Failed to connect to sandbox. Please try refreshing."),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
    );
  }
});
