import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Sandbox } from "npm:e2b";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FileOperation {
  path: string;
  content: string;
  action?: "create" | "update" | "delete";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sandboxId, files, packages } = await req.json();
    const E2B_API_KEY = Deno.env.get("E2B_API_KEY");

    if (!E2B_API_KEY) throw new Error("E2B_API_KEY is not configured");
    if (!sandboxId) throw new Error("sandboxId is required");

    const results = {
      filesCreated: [] as string[],
      filesUpdated: [] as string[],
      packagesInstalled: [] as string[],
      errors: [] as string[],
    };

    console.log(`[apply-code] Connecting to sandbox ${sandboxId} via SDK`);
    const sandbox = await Sandbox.connect(sandboxId, { apiKey: E2B_API_KEY });

    // Install packages if specified
    if (Array.isArray(packages) && packages.length > 0) {
      console.log(`[apply-code] Installing packages:`, packages);
      await sandbox.commands.run(
        `bash -lc 'cd /home/user/app && npm install ${packages.join(" ")}'`,
        { timeoutMs: 0 },
      );
      results.packagesInstalled = packages;
    }

    // Apply file operations
    if (Array.isArray(files)) {
      for (const file of files as FileOperation[]) {
        const action = file.action || "create";

        let filePath = file.path;
        if (!filePath.startsWith("/")) {
          filePath = `/home/user/app/${filePath}`;
        } else if (!filePath.startsWith("/home/user/app")) {
          filePath = `/home/user/app${filePath}`;
        }

        if (action === "delete") {
          try {
            await sandbox.files.remove(filePath);
          } catch {
            // ignore if missing
          }
          continue;
        }

        const dirPath = filePath.split("/").slice(0, -1).join("/");
        await sandbox.commands.run(`bash -lc 'mkdir -p "${dirPath}"'`, { timeoutMs: 0 });
        await sandbox.files.write(filePath, file.content);

        if (action === "update") results.filesUpdated.push(file.path);
        else results.filesCreated.push(file.path);
      }
    }

    // Nudge Vite
    await sandbox.commands.run("bash -lc 'touch /home/user/app/vite.config.js'", {
      timeoutMs: 0,
    });

    console.log(`[apply-code] Code application complete`);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        message: `Applied ${results.filesCreated.length + results.filesUpdated.length} files`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[apply-code] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
