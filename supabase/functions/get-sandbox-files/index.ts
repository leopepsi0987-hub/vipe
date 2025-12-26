import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sandboxId } = await req.json();
    const E2B_API_KEY = Deno.env.get("E2B_API_KEY");

    if (!E2B_API_KEY) {
      throw new Error("E2B_API_KEY is not configured");
    }

    if (!sandboxId) {
      throw new Error("sandboxId is required");
    }

    console.log(`[get-sandbox-files] Fetching files from sandbox ${sandboxId}`);

    // Get file listing recursively
    const listResponse = await fetch(
      `https://api.e2b.dev/sandboxes/${sandboxId}/process`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": E2B_API_KEY,
        },
        body: JSON.stringify({
          cmd: "find /home/user/app/src -type f -name '*.jsx' -o -name '*.js' -o -name '*.tsx' -o -name '*.ts' -o -name '*.css' -o -name '*.json' 2>/dev/null | head -50",
        }),
      }
    );

    if (!listResponse.ok) {
      throw new Error(`Failed to list files: ${await listResponse.text()}`);
    }

    const listData = await listResponse.json();
    const fileList = (listData.stdout || "")
      .split("\n")
      .filter((f: string) => f.trim() && !f.includes("node_modules"));

    const files: Record<string, string> = {};

    // Read each file
    for (const filePath of fileList) {
      if (!filePath) continue;

      const readResponse = await fetch(
        `https://api.e2b.dev/sandboxes/${sandboxId}/filesystem?path=${encodeURIComponent(filePath)}`,
        {
          method: "GET",
          headers: {
            "X-API-Key": E2B_API_KEY,
          },
        }
      );

      if (readResponse.ok) {
        const content = await readResponse.text();
        // Convert absolute path to relative
        const relativePath = filePath.replace("/home/user/app/", "");
        files[relativePath] = content;
      }
    }

    // Build structure tree
    const structure = Object.keys(files)
      .sort()
      .map((path) => `  ${path}`)
      .join("\n");

    console.log(`[get-sandbox-files] Found ${Object.keys(files).length} files`);

    return new Response(
      JSON.stringify({
        success: true,
        files,
        structure: `app/\n${structure}`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[get-sandbox-files] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        files: {},
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
