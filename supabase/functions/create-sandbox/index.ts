import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Sandbox } from "https://esm.sh/e2b@1.2.2";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const E2B_API_KEY = Deno.env.get("E2B_API_KEY");
    if (!E2B_API_KEY) throw new Error("E2B_API_KEY is not configured");

    console.log("[create-sandbox] Creating new E2B sandbox using SDK...");

    // Create sandbox using SDK - pass template as first arg, options as second
    const sandbox = await Sandbox.create("base", {
      apiKey: E2B_API_KEY,
      timeoutMs: 3600000, // 1 hour in ms
    });

    const sandboxId = sandbox.sandboxId;
    console.log("[create-sandbox] Sandbox created:", sandboxId);

    // Write all template files using SDK
    const fileWrites = Object.entries(VITE_TEMPLATE).map(([filePath, content]) => ({
      path: `/home/user/app/${filePath}`,
      data: content,
    }));

    console.log("[create-sandbox] Writing template files...");
    await sandbox.files.write(fileWrites);
    console.log("[create-sandbox] Files written successfully");

    // Install dependencies and start dev server
    console.log("[create-sandbox] Installing dependencies...");
    await sandbox.commands.run("cd /home/user/app && npm install", { timeoutMs: 120000 });
    console.log("[create-sandbox] Dependencies installed");

    // Start Vite dev server in background (don't await - it's long-running)
    console.log("[create-sandbox] Starting Vite dev server in background...");
    sandbox.commands.run("cd /home/user/app && npm run dev", { 
      background: true 
    });
    
    // Wait a moment for server to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get the host URL for port 5173
    const previewUrl = sandbox.getHost(5173);
    console.log("[create-sandbox] Preview URL:", previewUrl);

    return new Response(
      JSON.stringify({
        success: true,
        sandboxId,
        url: `https://${previewUrl}`,
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
