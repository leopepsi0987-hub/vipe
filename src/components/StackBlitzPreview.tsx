import { useEffect, useRef, useState } from "react";
import sdk from "@stackblitz/sdk";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Loader2 } from "lucide-react";

interface StackBlitzPreviewProps {
  files: Record<string, string>;
  className?: string;
}

// Convert project files to StackBlitz format
function convertFilesToStackBlitz(files: Record<string, string>): Record<string, string> {
  const stackblitzFiles: Record<string, string> = {};

  // Get index.css content for Tailwind
  const indexCss = files["src/index.css"] || `
@tailwind base;
@tailwind components;
@tailwind utilities;
`;

  // Get tailwind config
  const tailwindConfig = files["tailwind.config.ts"] || files["tailwind.config.js"] || `
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
`;

  // Create package.json for Vite + React + Tailwind
  stackblitzFiles["package.json"] = JSON.stringify({
    name: "vipe-preview",
    private: true,
    version: "0.0.0",
    type: "module",
    scripts: {
      dev: "vite",
      build: "vite build",
      preview: "vite preview"
    },
    dependencies: {
      "react": "^18.2.0",
      "react-dom": "^18.2.0",
      "lucide-react": "^0.400.0",
      "clsx": "^2.1.0",
      "tailwind-merge": "^2.2.0",
      "class-variance-authority": "^0.7.0",
      "@radix-ui/react-slot": "^1.0.2"
    },
    devDependencies: {
      "@types/react": "^18.2.0",
      "@types/react-dom": "^18.2.0",
      "@vitejs/plugin-react": "^4.2.0",
      "autoprefixer": "^10.4.17",
      "postcss": "^8.4.33",
      "tailwindcss": "^3.4.1",
      "typescript": "^5.3.0",
      "vite": "^5.0.0"
    }
  }, null, 2);

  // Create vite.config.ts
  stackblitzFiles["vite.config.ts"] = `
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
`;

  // Create tsconfig.json
  stackblitzFiles["tsconfig.json"] = JSON.stringify({
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
        "@/*": ["./src/*"]
      }
    },
    include: ["src"],
    references: [{ path: "./tsconfig.node.json" }]
  }, null, 2);

  stackblitzFiles["tsconfig.node.json"] = JSON.stringify({
    compilerOptions: {
      composite: true,
      skipLibCheck: true,
      module: "ESNext",
      moduleResolution: "bundler",
      allowSyntheticDefaultImports: true
    },
    include: ["vite.config.ts"]
  }, null, 2);

  // Create postcss.config.js
  stackblitzFiles["postcss.config.js"] = `
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`;

  // Create tailwind.config.js (converted from ts if needed)
  stackblitzFiles["tailwind.config.js"] = tailwindConfig.replace("export default", "module.exports =");

  // Create index.html
  stackblitzFiles["index.html"] = `
<!DOCTYPE html>
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
</html>
`;

  // Create main.tsx
  stackblitzFiles["src/main.tsx"] = `
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`;

  // Add index.css
  stackblitzFiles["src/index.css"] = indexCss;

  // Copy all src files from the project
  Object.entries(files).forEach(([path, content]) => {
    if (path.startsWith("src/") && path !== "src/main.tsx" && path !== "src/index.css") {
      stackblitzFiles[path] = content;
    }
  });

  // Ensure we have App.tsx
  if (!stackblitzFiles["src/App.tsx"] && !stackblitzFiles["src/App.jsx"]) {
    stackblitzFiles["src/App.tsx"] = files["src/App.tsx"] || files["src/App.jsx"] || `
export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <h1 className="text-2xl font-bold text-gray-800">Hello from Vipe!</h1>
    </div>
  );
}
`;
  }

  // Add utils if not present
  if (!stackblitzFiles["src/lib/utils.ts"]) {
    stackblitzFiles["src/lib/utils.ts"] = `
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`;
  }

  return stackblitzFiles;
}

export function StackBlitzPreview({ files, className }: StackBlitzPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const embedRef = useRef<any>(null);
  const filesHashRef = useRef<string>("");

  // Create a hash of files to detect changes
  const getFilesHash = (f: Record<string, string>) => {
    return Object.entries(f)
      .map(([k, v]) => `${k}:${v.length}`)
      .join("|");
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const currentHash = getFilesHash(files);
    
    // If files haven't changed, don't re-embed
    if (currentHash === filesHashRef.current && embedRef.current) {
      return;
    }
    
    filesHashRef.current = currentHash;
    setLoading(true);
    setError(null);

    const stackblitzFiles = convertFilesToStackBlitz(files);

    // Clear previous embed
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }

    sdk.embedProject(
      containerRef.current,
      {
        title: "Vipe Preview",
        description: "Live preview powered by StackBlitz",
        template: "node",
        files: stackblitzFiles,
      },
      {
        clickToLoad: false,
        openFile: "src/App.tsx",
        terminalHeight: 0,
        hideNavigation: true,
        hideDevTools: true,
        view: "preview",
        height: "100%",
      }
    )
      .then((vm) => {
        embedRef.current = vm;
        setLoading(false);
      })
      .catch((err) => {
        console.error("StackBlitz embed error:", err);
        setError(err.message || "Failed to load preview");
        setLoading(false);
      });

    return () => {
      embedRef.current = null;
    };
  }, [files]);

  const handleRefresh = () => {
    filesHashRef.current = "";
    setLoading(true);
    setError(null);
    
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }

    const stackblitzFiles = convertFilesToStackBlitz(files);

    sdk.embedProject(
      containerRef.current!,
      {
        title: "Vipe Preview",
        description: "Live preview powered by StackBlitz",
        template: "node",
        files: stackblitzFiles,
      },
      {
        clickToLoad: false,
        openFile: "src/App.tsx",
        terminalHeight: 0,
        hideNavigation: true,
        hideDevTools: true,
        view: "preview",
        height: "100%",
      }
    )
      .then((vm) => {
        embedRef.current = vm;
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load preview");
        setLoading(false);
      });
  };

  return (
    <div className={`relative w-full h-full ${className || ""}`}>
      {/* StackBlitz Container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading StackBlitz preview...</p>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 p-4 bg-background/98 flex items-center justify-center">
          <div className="max-w-md text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Preview Failed</h2>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button variant="outline" onClick={handleRefresh} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Retry
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
