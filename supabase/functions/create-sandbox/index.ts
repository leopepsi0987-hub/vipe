import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Vite React template files
const VITE_TEMPLATE: Record<string, string> = {
  "package.json": `{
  "name": "vipe-sandbox",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0 --port 5173",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.1.0"
  }
}`,
  "vite.config.js": `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true
  }
})`,
  "index.html": `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vipe App</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`,
  "src/main.jsx": `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,
  "src/App.jsx": `import React from 'react'

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">
          Welcome to Vipe 🚀
        </h1>
        <p className="text-slate-300 text-lg">
          Start chatting to build your app!
        </p>
      </div>
    </div>
  )
}

export default App`,
  "src/index.css": `@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
}`
};

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
    const E2B_API_KEY = Deno.env.get("E2B_API_KEY");
    if (!E2B_API_KEY) throw new Error("E2B_API_KEY is not configured");

    console.log("[create-sandbox] Creating new E2B sandbox...");

    // Create sandbox via API
    const createResponse = await fetch("https://api.e2b.dev/sandboxes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": E2B_API_KEY,
      },
      body: JSON.stringify({
        templateID: "base",
        timeout: 3600,
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("[create-sandbox] E2B API error:", createResponse.status, errorText);
      throw new Error(`Failed to create sandbox: ${errorText}`);
    }

    const sandboxData = await createResponse.json();
    const sandboxId = sandboxData.sandboxID;
    console.log("[create-sandbox] Sandbox created:", sandboxId);

    // Build Python code to write all template files
    const fileWriteStatements = Object.entries(VITE_TEMPLATE).map(([filePath, content]) => {
      const fullPath = `/home/user/app/${filePath}`;
      const escapedContent = escapeForPython(content);
      return `
# ${filePath}
import os
dir_path = os.path.dirname("${fullPath}")
os.makedirs(dir_path, exist_ok=True)
with open("${fullPath}", 'w') as f:
    f.write("""${escapedContent}""")
print("Written: ${fullPath}")
`;
    }).join("\n");

    const bootstrapPython = `
import subprocess
import os

# Change to app directory (create if needed)
os.makedirs("/home/user/app/src", exist_ok=True)
os.chdir("/home/user/app")

${fileWriteStatements}

print("All files written!")

# Install dependencies
print("Installing dependencies...")
subprocess.run(["npm", "install"], capture_output=True, text=True)
print("Dependencies installed!")

# Start Vite dev server in background
print("Starting Vite dev server...")
subprocess.Popen(["npm", "run", "dev"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print("Vite server started on port 5173!")
`;

    // Execute via code interpreter endpoint
    const execResponse = await fetch(`https://api.e2b.dev/sandboxes/${sandboxId}/code`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": E2B_API_KEY,
      },
      body: JSON.stringify({
        code: bootstrapPython,
        language: "python",
      }),
    });

    if (!execResponse.ok) {
      const errorText = await execResponse.text();
      console.warn("[create-sandbox] Code execution warning:", errorText);
      // Continue anyway - the sandbox may still work
    } else {
      const execResult = await execResponse.json();
      console.log("[create-sandbox] Bootstrap result:", JSON.stringify(execResult).substring(0, 500));
    }

    // E2B URL format: https://<port>-<sandboxId>.e2b.dev
    const previewUrl = `https://5173-${sandboxId}.e2b.dev`;
    console.log("[create-sandbox] Preview URL:", previewUrl);

    return new Response(
      JSON.stringify({
        success: true,
        sandboxId,
        url: previewUrl,
        message: "Sandbox created successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[create-sandbox] Error:", error);
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
