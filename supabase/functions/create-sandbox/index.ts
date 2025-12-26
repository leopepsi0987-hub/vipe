import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Vite React template files
const VITE_TEMPLATE = {
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
    port: 5173
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const E2B_API_KEY = Deno.env.get("E2B_API_KEY");
    
    if (!E2B_API_KEY) {
      throw new Error("E2B_API_KEY is not configured");
    }

    console.log("[create-sandbox] Creating new E2B sandbox...");

    // Create a new sandbox using E2B API
    const createResponse = await fetch("https://api.e2b.dev/sandboxes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": E2B_API_KEY,
      },
      body: JSON.stringify({
        templateID: "base", // Use base template
        timeout: 3600, // 1 hour timeout
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

    // Write template files to the sandbox
    for (const [filePath, content] of Object.entries(VITE_TEMPLATE)) {
      const writeResponse = await fetch(
        `https://api.e2b.dev/sandboxes/${sandboxId}/filesystem`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": E2B_API_KEY,
          },
          body: JSON.stringify({
            path: `/home/user/app/${filePath}`,
            content: content,
          }),
        }
      );

      if (!writeResponse.ok) {
        console.warn(`[create-sandbox] Failed to write ${filePath}:`, await writeResponse.text());
      }
    }

    console.log("[create-sandbox] Template files written");

    // Install dependencies
    const installResponse = await fetch(
      `https://api.e2b.dev/sandboxes/${sandboxId}/process`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": E2B_API_KEY,
        },
        body: JSON.stringify({
          cmd: "cd /home/user/app && npm install",
        }),
      }
    );

    if (!installResponse.ok) {
      console.warn("[create-sandbox] npm install warning:", await installResponse.text());
    }

    console.log("[create-sandbox] Dependencies installed");

    // Start Vite dev server
    const devResponse = await fetch(
      `https://api.e2b.dev/sandboxes/${sandboxId}/process`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": E2B_API_KEY,
        },
        body: JSON.stringify({
          cmd: "cd /home/user/app && npm run dev",
          background: true,
        }),
      }
    );

    if (!devResponse.ok) {
      console.warn("[create-sandbox] npm run dev warning:", await devResponse.text());
    }

    console.log("[create-sandbox] Vite dev server started");

    // Get the sandbox URL
    // E2B expects the PORT as the subdomain prefix: https://<port>-<sandboxId>.e2b.dev
    const previewUrl = `https://5173-${sandboxId}.e2b.dev`;

    return new Response(
      JSON.stringify({
        success: true,
        sandboxId,
        url: previewUrl,
        message: "Sandbox created successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
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
