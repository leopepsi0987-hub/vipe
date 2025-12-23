import { useEffect, useRef, useState, useCallback } from "react";
import { WebContainer } from "@webcontainer/api";
import { Loader2, Terminal, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WebContainerPreviewProps {
  files: Record<string, string>;
  className?: string;
}

// WebContainer instance (singleton - can only boot once per page)
let webcontainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

async function getWebContainer(): Promise<WebContainer> {
  if (webcontainerInstance) return webcontainerInstance;
  
  if (!bootPromise) {
    bootPromise = WebContainer.boot();
  }
  
  webcontainerInstance = await bootPromise;
  return webcontainerInstance;
}

// Convert project files to WebContainer file system format
function convertToWebContainerFiles(files: Record<string, string>) {
  const fsTree: Record<string, any> = {};
  
  // Add package.json for Vite React project
  fsTree["package.json"] = {
    file: {
      contents: JSON.stringify({
        name: "vipe-preview",
        private: true,
        version: "0.0.0",
        type: "module",
        scripts: {
          dev: "vite --host",
          build: "vite build",
          preview: "vite preview"
        },
        dependencies: {
          "react": "^18.2.0",
          "react-dom": "^18.2.0"
        },
        devDependencies: {
          "@vitejs/plugin-react": "^4.2.1",
          "vite": "^5.1.0",
          "@types/react": "^18.2.0",
          "@types/react-dom": "^18.2.0",
          "typescript": "^5.3.0"
        }
      }, null, 2)
    }
  };

  // Add vite.config.ts
  fsTree["vite.config.ts"] = {
    file: {
      contents: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    }
  }
})`
    }
  };

  // Add index.html
  fsTree["index.html"] = {
    file: {
      contents: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vipe Preview</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`
    }
  };

  // Add tsconfig.json
  fsTree["tsconfig.json"] = {
    file: {
      contents: JSON.stringify({
        compilerOptions: {
          target: "ES2020",
          useDefineForClassFields: true,
          lib: ["ES2020", "DOM", "DOM.Iterable"],
          module: "ESNext",
          skipLibCheck: true,
          moduleResolution: "bundler",
          allowImportingTsExtensions: true,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: "react-jsx",
          strict: true,
          noUnusedLocals: true,
          noUnusedParameters: true,
          noFallthroughCasesInSwitch: true,
          baseUrl: ".",
          paths: {
            "@/*": ["src/*"]
          }
        },
        include: ["src"]
      }, null, 2)
    }
  };

  // Process user files
  for (const [path, content] of Object.entries(files)) {
    const parts = path.split("/");
    let current = fsTree;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = { directory: {} };
      }
      current = current[part].directory;
    }

    const fileName = parts[parts.length - 1];
    current[fileName] = { file: { contents: content } };
  }

  // Ensure src/main.tsx exists
  if (!fsTree["src"]) {
    fsTree["src"] = { directory: {} };
  }
  
  if (!fsTree["src"].directory["main.tsx"]) {
    fsTree["src"].directory["main.tsx"] = {
      file: {
        contents: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`
      }
    };
  }

  return fsTree;
}

export function WebContainerPreview({ files, className }: WebContainerPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<"booting" | "installing" | "starting" | "ready" | "error">("booting");
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<WebContainer | null>(null);
  const serverProcessRef = useRef<any>(null);

  const addLog = useCallback((message: string) => {
    setLogs(prev => [...prev.slice(-100), message]);
  }, []);

  const startDevServer = useCallback(async (container: WebContainer) => {
    try {
      // Kill previous server if running
      if (serverProcessRef.current) {
        serverProcessRef.current.kill();
      }

      setStatus("starting");
      addLog("Starting Vite dev server...");

      const devProcess = await container.spawn("npm", ["run", "dev"]);
      serverProcessRef.current = devProcess;

      devProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            addLog(data);
          }
        })
      );

      // Wait for server to be ready
      container.on("server-ready", (port, url) => {
        addLog(`Server ready at ${url}`);
        setPreviewUrl(url);
        setStatus("ready");
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start dev server";
      setError(message);
      setStatus("error");
      addLog(`Error: ${message}`);
    }
  }, [addLog]);

  const installDependencies = useCallback(async (container: WebContainer) => {
    try {
      setStatus("installing");
      addLog("Installing dependencies...");

      const installProcess = await container.spawn("npm", ["install"]);
      
      installProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            addLog(data);
          }
        })
      );

      const exitCode = await installProcess.exit;
      
      if (exitCode !== 0) {
        throw new Error(`npm install failed with exit code ${exitCode}`);
      }

      addLog("Dependencies installed successfully!");
      await startDevServer(container);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to install dependencies";
      setError(message);
      setStatus("error");
      addLog(`Error: ${message}`);
    }
  }, [addLog, startDevServer]);

  const initWebContainer = useCallback(async () => {
    try {
      // WebContainers require cross-origin isolation (SharedArrayBuffer)
      if (!window.crossOriginIsolated) {
        const msg = "This page is not crossOriginIsolated (COOP/COEP missing).";
        setError(msg);
        setStatus("error");
        addLog(`Error: ${msg}`);
        return;
      }

      setStatus("booting");
      setError(null);
      addLog("Booting WebContainer...");

      const container = await getWebContainer();
      containerRef.current = container;
      addLog("WebContainer booted successfully!");

      // Mount files
      const fsTree = convertToWebContainerFiles(files);
      await container.mount(fsTree);
      addLog("Files mounted.");

      await installDependencies(container);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to boot WebContainer";
      setError(message);
      setStatus("error");
      addLog(`Error: ${message}`);
    }
  }, [files, addLog, installDependencies]);

  // Update files when they change (without full reinstall)
  const updateFiles = useCallback(async () => {
    if (!containerRef.current || status !== "ready") return;

    try {
      addLog("Updating files...");
      const fsTree = convertToWebContainerFiles(files);
      await containerRef.current.mount(fsTree);
      addLog("Files updated - HMR should pick up changes.");
    } catch (err) {
      addLog(`Error updating files: ${err}`);
    }
  }, [files, status, addLog]);

  // Initial boot
  useEffect(() => {
    initWebContainer();

    return () => {
      if (serverProcessRef.current) {
        serverProcessRef.current.kill();
      }
    };
  }, []);

  // Update files when they change (after initial boot)
  useEffect(() => {
    if (status === "ready") {
      updateFiles();
    }
  }, [files, status, updateFiles]);

  const handleRefresh = () => {
    if (iframeRef.current && previewUrl) {
      iframeRef.current.src = previewUrl;
    }
  };

  const handleRestart = () => {
    setLogs([]);
    setPreviewUrl(null);
    initWebContainer();
  };

  return (
    <div className={cn("relative w-full h-full flex flex-col", className)}>
      {/* Preview iframe or loading state */}
      <div className="flex-1 relative">
        {status === "ready" && previewUrl ? (
          <iframe
            ref={iframeRef}
            src={previewUrl}
            className="w-full h-full border-0"
            title="Preview"
            allow="cross-origin-isolated"
          />
        ) : status === "error" ? (
          <div className="w-full h-full flex items-center justify-center bg-background">
            <div className="text-center p-6 max-w-md">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold mb-2">WebContainer Error</h3>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <p className="text-xs text-muted-foreground mb-4">
                WebContainers need cross-origin isolation (COOP/COEP). In the editor preview iframe this is usually not possible.
              </p>
              <Button onClick={handleRestart} variant="outline" className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Try Again
              </Button>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-background">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-sm text-muted-foreground">
                {status === "booting" && "Booting WebContainer..."}
                {status === "installing" && "Installing dependencies..."}
                {status === "starting" && "Starting Vite dev server..."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Terminal toggle */}
      <div className="absolute bottom-4 right-4 flex gap-2">
        {status === "ready" && (
          <Button size="sm" variant="secondary" onClick={handleRefresh} className="h-8 gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        )}
        <Button 
          size="sm" 
          variant={showLogs ? "default" : "secondary"} 
          onClick={() => setShowLogs(!showLogs)}
          className="h-8 gap-1.5"
        >
          <Terminal className="w-3.5 h-3.5" />
          Logs
        </Button>
      </div>

      {/* Terminal panel */}
      {showLogs && (
        <div className="h-48 bg-black/95 border-t border-border overflow-auto font-mono text-xs p-3">
          {logs.map((log, i) => (
            <div key={i} className="text-green-400 whitespace-pre-wrap">{log}</div>
          ))}
          {logs.length === 0 && (
            <div className="text-muted-foreground">No logs yet...</div>
          )}
        </div>
      )}
    </div>
  );
}