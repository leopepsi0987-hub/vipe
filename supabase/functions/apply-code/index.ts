import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Sandbox } from "https://esm.sh/e2b@1.2.2";

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

    console.log(`[apply-code] Connecting to sandbox ${sandboxId}`);

    let sandbox;
    try {
      sandbox = await Sandbox.connect(sandboxId, {
        apiKey: E2B_API_KEY,
      });
      // Extend sandbox timeout to 1 hour from now
      await sandbox.setTimeout(3600000);
      console.log(`[apply-code] Connected and extended timeout`);
    } catch (connectError) {
      console.error(`[apply-code] Failed to connect to sandbox:`, connectError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "SANDBOX_EXPIRED",
          message: "Sandbox has expired. Please create a new sandbox.",
        }),
        {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const results = {
      filesCreated: [] as string[],
      filesUpdated: [] as string[],
      filesDeleted: [] as string[],
      packagesInstalled: [] as string[],
    };

    // Install packages if needed
    if (Array.isArray(packages) && packages.length > 0) {
      console.log(`[apply-code] Installing packages: ${packages.join(", ")}`);
      await sandbox.commands.run(`cd /home/user/app && npm install ${packages.join(" ")}`, {
        timeoutMs: 180000,
      });
      results.packagesInstalled = packages;
    }

    // Apply file operations
    if (Array.isArray(files) && files.length > 0) {
      const writes: Array<{ path: string; data: string }> = [];

      for (const file of files as FileOperation[]) {
        const action = file.action || "update";
        const normalizedPath = file.path.startsWith("/")
          ? `/home/user/app${file.path}`
          : `/home/user/app/${file.path}`;

        if (action === "delete") {
          try {
            await sandbox.files.remove(normalizedPath);
            results.filesDeleted.push(file.path);
          } catch {
            // ignore missing files
          }
          continue;
        }

        writes.push({ path: normalizedPath, data: file.content ?? "" });

        if (action === "create") results.filesCreated.push(file.path);
        else results.filesUpdated.push(file.path);
      }

      if (writes.length > 0) {
        console.log(`[apply-code] Writing ${writes.length} files...`);
        await sandbox.files.write(writes);
      }

      // Touch vite config to trigger HMR (safe no-op if it doesn't exist)
      try {
        await sandbox.commands.run("cd /home/user/app && node -e \"const fs=require('fs');try{fs.utimesSync('vite.config.js', new Date(), new Date())}catch(e){}\"", {
          timeoutMs: 15000,
        });
      } catch {
        // ignore
      }
    }

    console.log("[apply-code] Done", results);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        message: "Applied changes to sandbox",
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
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
