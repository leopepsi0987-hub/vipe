import { useMemo } from "react";

interface SandboxPreviewProps {
  files: Record<string, string>;
  className?: string;
}

// Generate a complete HTML document that bundles React files
function generateBundledHTML(files: Record<string, string>): string {
  const appContent = files["src/App.tsx"] || files["src/App.jsx"] || "";
  const cssContent = files["src/index.css"] || "";
  
  // Extract component files
  const componentFiles = Object.entries(files).filter(
    ([path]) => path.startsWith("src/components/") && (path.endsWith(".tsx") || path.endsWith(".jsx"))
  );

  // Build components object for inline usage
  const componentsCode = componentFiles
    .map(([path, content]) => {
      const name = path.split("/").pop()?.replace(/\.(tsx|jsx)$/, "") || "";
      // Extract the component definition
      return `// ${name}\n${content}`;
    })
    .join("\n\n");

  // Process App.tsx to extract the actual component
  let processedApp = appContent
    // Remove imports (we'll provide React globally)
    .replace(/^import\s+.*?['"].*?['"];?\s*$/gm, "")
    // Remove export default
    .replace(/export\s+default\s+/, "")
    // Remove export
    .replace(/^export\s+/gm, "");

  // Process components similarly
  let processedComponents = componentsCode
    .replace(/^import\s+.*?['"].*?['"];?\s*$/gm, "")
    .replace(/export\s+default\s+/g, "")
    .replace(/^export\s+/gm, "");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  
  <!-- React 18 -->
  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  
  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            background: 'hsl(var(--background))',
            foreground: 'hsl(var(--foreground))',
            card: 'hsl(var(--card))',
            'card-foreground': 'hsl(var(--card-foreground))',
            primary: 'hsl(var(--primary))',
            'primary-foreground': 'hsl(var(--primary-foreground))',
            secondary: 'hsl(var(--secondary))',
            'secondary-foreground': 'hsl(var(--secondary-foreground))',
            muted: 'hsl(var(--muted))',
            'muted-foreground': 'hsl(var(--muted-foreground))',
            accent: 'hsl(var(--accent))',
            'accent-foreground': 'hsl(var(--accent-foreground))',
            destructive: 'hsl(var(--destructive))',
            'destructive-foreground': 'hsl(var(--destructive-foreground))',
            border: 'hsl(var(--border))',
            input: 'hsl(var(--input))',
            ring: 'hsl(var(--ring))',
          },
          borderRadius: {
            lg: 'var(--radius)',
            md: 'calc(var(--radius) - 2px)',
            sm: 'calc(var(--radius) - 4px)',
          }
        }
      }
    }
  </script>
  
  <style>
    :root {
      --background: 0 0% 100%;
      --foreground: 222.2 84% 4.9%;
      --card: 0 0% 100%;
      --card-foreground: 222.2 84% 4.9%;
      --primary: 221.2 83.2% 53.3%;
      --primary-foreground: 210 40% 98%;
      --secondary: 210 40% 96%;
      --secondary-foreground: 222.2 47.4% 11.2%;
      --muted: 210 40% 96%;
      --muted-foreground: 215.4 16.3% 46.9%;
      --accent: 210 40% 96%;
      --accent-foreground: 222.2 47.4% 11.2%;
      --destructive: 0 84.2% 60.2%;
      --destructive-foreground: 210 40% 98%;
      --border: 214.3 31.8% 91.4%;
      --input: 214.3 31.8% 91.4%;
      --ring: 221.2 83.2% 53.3%;
      --radius: 0.5rem;
    }
    
    @media (prefers-color-scheme: dark) {
      :root {
        --background: 222.2 84% 4.9%;
        --foreground: 210 40% 98%;
        --card: 222.2 84% 4.9%;
        --card-foreground: 210 40% 98%;
        --primary: 217.2 91.2% 59.8%;
        --primary-foreground: 222.2 47.4% 11.2%;
        --secondary: 217.2 32.6% 17.5%;
        --secondary-foreground: 210 40% 98%;
        --muted: 217.2 32.6% 17.5%;
        --muted-foreground: 215 20.2% 65.1%;
        --accent: 217.2 32.6% 17.5%;
        --accent-foreground: 210 40% 98%;
        --destructive: 0 62.8% 30.6%;
        --destructive-foreground: 210 40% 98%;
        --border: 217.2 32.6% 17.5%;
        --input: 217.2 32.6% 17.5%;
        --ring: 224.3 76.3% 48%;
      }
    }
    
    body {
      background-color: hsl(var(--background));
      color: hsl(var(--foreground));
      font-family: system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 0;
    }

    ${cssContent}
  </style>
</head>
<body class="bg-background text-foreground">
  <div id="root"></div>
  <div id="__sandbox_error" style="display:none; position:fixed; inset:12px; padding:12px; border-radius:12px; background:rgba(0,0,0,0.75); color:#fff; font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono','Courier New', monospace; font-size:12px; line-height:1.4; white-space:pre-wrap; overflow:auto; z-index:99999;"></div>
  
  <script type="text/babel" data-presets="typescript,react">
    const { useState, useEffect, useContext, createContext, useCallback, useMemo, useRef, useReducer } = React;

    const __errEl = document.getElementById('__sandbox_error');
    const __showErr = (title, err) => {
      try {
        __errEl.style.display = 'block';
        const msg = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);
        __errEl.textContent = title + "\n\n" + msg;
      } catch (_) {}
    };

    window.addEventListener('error', (e) => __showErr('Sandbox runtime error', e?.error || e?.message));
    window.addEventListener('unhandledrejection', (e) => __showErr('Sandbox unhandled promise rejection', e?.reason));
    
      const toast = useCallback((message, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
      }, []);
      
      return {
        toasts,
        success: (msg) => toast(msg, 'success'),
        error: (msg) => toast(msg, 'error'),
        info: (msg) => toast(msg, 'info'),
        ToastContainer: () => toasts.length > 0 ? (
          <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
            {toasts.map(t => (
              <div
                key={t.id}
                className={\`px-4 py-3 rounded-lg shadow-lg text-sm font-medium \${
                  t.type === 'success' ? 'bg-green-500 text-white' :
                  t.type === 'error' ? 'bg-red-500 text-white' :
                  'bg-primary text-primary-foreground'
                }\`}
              >
                {t.message}
              </div>
            ))}
          </div>
        ) : null
      };
    }
    
    // Components
    ${processedComponents}
    
    // Main App
    ${processedApp || `
    function App() {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent mb-4">
              Welcome to Vipe
            </h1>
            <p className="text-muted-foreground text-lg">
              Start building by sending a message to the AI
            </p>
          </div>
        </div>
      );
    }
    `}
    
    // Find the App component (it might be named differently)
    const AppComponent = typeof App !== 'undefined' ? App : 
                         typeof Main !== 'undefined' ? Main :
                         typeof Application !== 'undefined' ? Application :
                         () => <div>No App component found</div>;
    
    // Render
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(
      <React.StrictMode>
        <AppComponent />
      </React.StrictMode>
    );
  </script>
</body>
</html>`;
}

export function SandboxPreview({ files, className }: SandboxPreviewProps) {
  const bundledHTML = useMemo(() => {
    if (!files || Object.keys(files).length === 0) {
      // Return default welcome screen
      return generateBundledHTML({});
    }
    return generateBundledHTML(files);
  }, [files]);

  return (
    <iframe
      srcDoc={bundledHTML}
      className={className}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      style={{ width: "100%", height: "100%", border: "none" }}
      title="Preview"
    />
  );
}
