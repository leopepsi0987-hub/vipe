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

/**
 * Escape content for embedding in a Python string literal
 */
function escapeForPython(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"""/g, '\\"\\"\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
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

    console.log(`[apply-code] Applying code to sandbox ${sandboxId}`);

    // Build Python code for package installation and file writing
    let pythonCode = `
import subprocess
import os

os.chdir("/home/user/app")
`;

    // Install packages if specified
    if (Array.isArray(packages) && packages.length > 0) {
      const pkgList = packages.map((p: string) => `"${p}"`).join(", ");
      pythonCode += `
print("Installing packages: ${packages.join(", ")}")
subprocess.run(["npm", "install", ${pkgList}], capture_output=True, text=True)
print("Packages installed!")
`;
      results.packagesInstalled = packages;
    }

    // Write files
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
          pythonCode += `
try:
    os.remove("${filePath}")
    print("Deleted: ${filePath}")
except:
    pass
`;
        } else {
          const escapedContent = escapeForPython(file.content);
          pythonCode += `
dir_path = os.path.dirname("${filePath}")
os.makedirs(dir_path, exist_ok=True)
with open("${filePath}", 'w') as f:
    f.write("""${escapedContent}""")
print("Written: ${filePath}")
`;
          if (action === "update") {
            results.filesUpdated.push(file.path);
          } else {
            results.filesCreated.push(file.path);
          }
        }
      }
    }

    // Touch vite config to trigger HMR
    pythonCode += `
# Trigger Vite HMR
import time
time.sleep(0.5)
os.utime("/home/user/app/vite.config.js", None)
print("Vite config touched for HMR")
`;

    // Execute via code interpreter endpoint
    const execResponse = await fetch(`https://api.e2b.dev/sandboxes/${sandboxId}/code`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": E2B_API_KEY,
      },
      body: JSON.stringify({
        code: pythonCode,
        language: "python",
      }),
    });

    if (!execResponse.ok) {
      const errorText = await execResponse.text();
      console.warn("[apply-code] Code execution warning:", errorText);
      results.errors.push(`Code execution failed: ${errorText}`);
    } else {
      const execResult = await execResponse.json();
      console.log("[apply-code] Execution result:", JSON.stringify(execResult).substring(0, 500));
    }

    console.log(`[apply-code] Code application complete`);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        message: `Applied ${results.filesCreated.length + results.filesUpdated.length} files`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
