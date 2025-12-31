import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Sandbox } from "https://esm.sh/e2b@1.2.2";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ProjectFileRow = {
  file_path: string;
  content: string;
};

// Minimal Vite React fallback template (used if project doesn't include these files)
const FALLBACK_TEMPLATE: Record<string, string> = {
  "package.json": `{
  "name": "vipedz-project",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0 --port 5173 --strictPort",
    "build": "vite build",
    "preview": "vite preview --host 0.0.0.0 --port 5173 --strictPort"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
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
    strictPort: true,
    allowedHosts: true,
  },
})`,
  "postcss.config.js": `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};`,
  "tailwind.config.js": `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};`,
  "index.html": `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>VIPE DZ App</title>
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
  "src/App.jsx": `export default function App(){
  return <div style={{padding:24,fontFamily:'system-ui'}}>Project loaded. Start building!</div>
}`,
  "src/index.css": `@tailwind base;
@tailwind components;
@tailwind utilities;
`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const projectId = body?.projectId as string | undefined;

    if (!projectId) {
      throw new Error("projectId is required");
    }

    const E2B_API_KEY = Deno.env.get("E2B_API_KEY");
    if (!E2B_API_KEY) throw new Error("E2B_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Backend keys are not configured");

    const authHeader = req.headers.get("Authorization") || "";

    // Authenticated client (RLS will ensure project ownership)
    const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: authHeader,
          apikey: SUPABASE_ANON_KEY,
        },
      },
    });

    console.log(`[restart-sandbox] Loading files for project ${projectId}`);

    const { data: filesData, error: filesError } = await db
      .from("project_files")
      .select("file_path, content")
      .eq("project_id", projectId);

    if (filesError) {
      console.error("[restart-sandbox] DB error:", filesError);
      throw new Error(filesError.message);
    }

    const projectFiles = (filesData || []) as ProjectFileRow[];
    const fileMap = new Map<string, string>();
    for (const f of projectFiles) {
      if (!f?.file_path) continue;
      fileMap.set(f.file_path, f.content ?? "");
    }

    // Seed fallback template if essentials are missing
    for (const [p, c] of Object.entries(FALLBACK_TEMPLATE)) {
      if (!fileMap.has(p)) fileMap.set(p, c);
    }

    console.log("[restart-sandbox] Creating new sandbox...");
    const sandbox = await Sandbox.create("base", {
      apiKey: E2B_API_KEY,
      timeoutMs: 3600000,
    });

    const sandboxId = sandbox.sandboxId;
    console.log("[restart-sandbox] Sandbox created:", sandboxId);

    const fileWrites = Array.from(fileMap.entries()).map(([filePath, content]) => ({
      path: `/home/user/app/${filePath}`,
      data: content,
    }));

    console.log(`[restart-sandbox] Writing ${fileWrites.length} files...`);
    await sandbox.files.write(fileWrites);

    console.log("[restart-sandbox] Installing dependencies...");
    await sandbox.commands.run("cd /home/user/app && npm install", { timeoutMs: 180000 });

    console.log("[restart-sandbox] Starting Vite dev server...");
    sandbox.commands.run("cd /home/user/app && npm run dev", { background: true });

    await new Promise((resolve) => setTimeout(resolve, 2500));

    const previewUrl = sandbox.getHost(5173);
    console.log("[restart-sandbox] Preview URL:", previewUrl);

    return new Response(
      JSON.stringify({
        success: true,
        sandboxId,
        url: `https://${previewUrl}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[restart-sandbox] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
