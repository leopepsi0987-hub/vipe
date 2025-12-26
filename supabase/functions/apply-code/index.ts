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

      // Restart Vite dev server to ensure port 5173 is serving the latest code
      try {
        console.log("[apply-code] Restarting Vite dev server on port 5173...");
        await sandbox.commands.run(
          "bash -lc 'cd /home/user/app && (command -v fuser >/dev/null 2>&1 && fuser -k 5173/tcp || true) && (pkill -f \"vite\" || true) && (nohup npm run dev -- --host 0.0.0.0 --port 5173 --strictPort > /tmp/vite.log 2>&1 &)'",
          { timeoutMs: 30000 },
        );
        // Give Vite a moment to boot
        await new Promise((r) => setTimeout(r, 2000));
      } catch (e) {
        console.error("[apply-code] Failed to restart Vite:", e);
        // don't fail the whole request, files were still applied
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
