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
    const packagesToInstall = new Set<string>(Array.isArray(packages) ? packages : []);

    // If the update includes Tailwind config or Tailwind directives, ensure Tailwind tooling is installed.
    if (Array.isArray(files)) {
      const touchesTailwindConfig = files.some((f: FileOperation) =>
        ["tailwind.config.js", "tailwind.config.cjs", "postcss.config.js", "postcss.config.cjs"].includes(f.path),
      );

      const hasTailwindDirectives = files.some((f: FileOperation) =>
        typeof f.content === "string" && (f.content.includes("@tailwind") || f.content.includes("@import 'tailwindcss'") || f.content.includes('@import "tailwindcss"')),
      );

      if (touchesTailwindConfig || hasTailwindDirectives) {
        packagesToInstall.add("tailwindcss");
        packagesToInstall.add("postcss");
        packagesToInstall.add("autoprefixer");
      }
    }

    if (packagesToInstall.size > 0) {
      const pkgs = Array.from(packagesToInstall);
      console.log(`[apply-code] Installing packages: ${pkgs.join(", ")}`);
      await sandbox.commands.run(`cd /home/user/app && npm install ${pkgs.join(" ")}`, {
        timeoutMs: 180000,
      });
      results.packagesInstalled = pkgs;
    }

    // Apply file operations
    if (Array.isArray(files) && files.length > 0) {
      // Use a Map to deduplicate files by path (last occurrence wins)
      const writesMap = new Map<string, { path: string; data: string; originalPath: string; action: string }>();

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
          // Also remove from writesMap if it was queued for write
          writesMap.delete(normalizedPath);
          continue;
        }

        // Fix common Tailwind v4 import that breaks Vite/Tailwind v3 setups.
        // '@import "tailwindcss"' triggers a resolver file lookup and crashes the dev server.
        let content = file.content ?? "";

        // Strip markdown code fences that AI sometimes includes (e.g., "```html ... ```")
        if (typeof content === "string") {
          content = content.replace(/^```\w*\s*\n?/g, "").replace(/\n?```\s*$/g, "").trim();
        }

        if (typeof content === "string" && (content.includes("@import 'tailwindcss'") || content.includes('@import "tailwindcss"'))) {
          content = content.replace(/@import\s+['\"]tailwindcss['\"];?\s*/g, "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n");
        }

        // Overwrite any previous entry for this path (deduplication)
        writesMap.set(normalizedPath, { path: normalizedPath, data: content, originalPath: file.path, action });
      }

      // Build final arrays from deduplicated map
      const writes: Array<{ path: string; data: string }> = [];
      for (const entry of writesMap.values()) {
        writes.push({ path: entry.path, data: entry.data });
        if (entry.action === "create") results.filesCreated.push(entry.originalPath);
        else results.filesUpdated.push(entry.originalPath);
      }

      if (writes.length > 0) {
        console.log(`[apply-code] Writing ${writes.length} deduplicated files...`);
        await sandbox.files.write(writes);
      }

      // Restart Vite dev server to ensure port 5173 is serving the latest code
      console.log("[apply-code] Restarting Vite dev server on port 5173...");

      // Kill any existing Vite process (ignore errors)
      try {
        await sandbox.commands.run(
          "bash -lc 'pkill -9 -f node || true; sleep 0.5'",
          { timeoutMs: 10000 },
        );
      } catch {
        // Ignore kill errors
      }

      // Start Vite in background using nohup + disown so it survives
      try {
        await sandbox.commands.run(
          "bash -lc 'cd /home/user/app && nohup npm run dev -- --host 0.0.0.0 --port 5173 --strictPort > /tmp/vite.log 2>&1 &'",
          { timeoutMs: 5000 },
        );
        console.log("[apply-code] Vite start command issued");
      } catch (startErr) {
        console.error("[apply-code] Failed to start Vite:", startErr);
      }

      // Give Vite a moment to spin up
      await new Promise((r) => setTimeout(r, 2000));

      // Poll for server readiness
      let isUp = false;
      for (let i = 0; i < 10; i++) {
        try {
          const check = await sandbox.commands.run(
            "bash -lc 'curl -sf http://127.0.0.1:5173/ >/dev/null 2>&1 && echo UP || echo DOWN'",
            { timeoutMs: 3000 },
          );
          if (check.stdout.includes("UP")) {
            console.log("[apply-code] Vite is up on port 5173");
            isUp = true;
            break;
          }
        } catch {
          // ignore
        }
        await new Promise((r) => setTimeout(r, 1000));
      }

      if (!isUp) {
        console.warn("[apply-code] Vite might not be ready yet, but files were applied");
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
