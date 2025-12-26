import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    if (!E2B_API_KEY) {
      throw new Error("E2B_API_KEY is not configured");
    }

    if (!sandboxId) {
      throw new Error("sandboxId is required");
    }

    const results = {
      filesCreated: [] as string[],
      filesUpdated: [] as string[],
      packagesInstalled: [] as string[],
      errors: [] as string[],
    };

    console.log(`[apply-code] Applying code to sandbox ${sandboxId}`);

    // Install packages if specified
    if (packages && packages.length > 0) {
      console.log(`[apply-code] Installing packages:`, packages);
      
      const installResponse = await fetch(
        `https://api.e2b.dev/sandboxes/${sandboxId}/process`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": E2B_API_KEY,
          },
          body: JSON.stringify({
            cmd: `cd /home/user/app && npm install ${packages.join(" ")}`,
          }),
        }
      );

      if (installResponse.ok) {
        results.packagesInstalled = packages;
        console.log(`[apply-code] Packages installed successfully`);
      } else {
        const error = await installResponse.text();
        console.error(`[apply-code] Package installation failed:`, error);
        results.errors.push(`Failed to install packages: ${error}`);
      }
    }

    // Write files
    if (files && Array.isArray(files)) {
      for (const file of files as FileOperation[]) {
        const action = file.action || "create";
        
        // Ensure path starts with src/ for app files
        let filePath = file.path;
        if (!filePath.startsWith("/")) {
          filePath = `/home/user/app/${filePath}`;
        } else if (!filePath.startsWith("/home/user/app")) {
          filePath = `/home/user/app${filePath}`;
        }

        if (action === "delete") {
          // Delete file
          const deleteResponse = await fetch(
            `https://api.e2b.dev/sandboxes/${sandboxId}/filesystem?path=${encodeURIComponent(filePath)}`,
            {
              method: "DELETE",
              headers: {
                "X-API-Key": E2B_API_KEY,
              },
            }
          );

          if (deleteResponse.ok) {
            console.log(`[apply-code] Deleted: ${file.path}`);
          } else {
            results.errors.push(`Failed to delete ${file.path}`);
          }
        } else {
          // Create parent directories if needed
          const dirPath = filePath.split("/").slice(0, -1).join("/");
          await fetch(
            `https://api.e2b.dev/sandboxes/${sandboxId}/process`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-API-Key": E2B_API_KEY,
              },
              body: JSON.stringify({
                cmd: `mkdir -p ${dirPath}`,
              }),
            }
          );

          // Write file
          const writeResponse = await fetch(
            `https://api.e2b.dev/sandboxes/${sandboxId}/filesystem`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-API-Key": E2B_API_KEY,
              },
              body: JSON.stringify({
                path: filePath,
                content: file.content,
              }),
            }
          );

          if (writeResponse.ok) {
            if (action === "update") {
              results.filesUpdated.push(file.path);
            } else {
              results.filesCreated.push(file.path);
            }
            console.log(`[apply-code] Written: ${file.path}`);
          } else {
            const error = await writeResponse.text();
            console.error(`[apply-code] Failed to write ${file.path}:`, error);
            results.errors.push(`Failed to write ${file.path}: ${error}`);
          }
        }
      }
    }

    // Force Vite to reload by touching the config
    await fetch(
      `https://api.e2b.dev/sandboxes/${sandboxId}/process`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": E2B_API_KEY,
        },
        body: JSON.stringify({
          cmd: "touch /home/user/app/vite.config.js",
        }),
      }
    );

    console.log(`[apply-code] Code application complete`);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        message: `Applied ${results.filesCreated.length + results.filesUpdated.length} files`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
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
      }
    );
  }
});
