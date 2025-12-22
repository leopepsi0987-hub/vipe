// Shared helper to bundle a React (Vite-style) file map into a single HTML document for sandbox/publish.
// NOTE: This is a lightweight bundler intended for preview/publish within this app.

export function generateBundledHTML(files: Record<string, string>): string {
  const appContent = files["src/App.tsx"] || files["src/App.jsx"] || "";
  const cssContent = files["src/index.css"] || "";

  // Extract all TS/JS source files under src/ (excluding the entry and App, which we handle separately)
  const moduleFiles = Object.entries(files).filter(
    ([path]) =>
      path.startsWith("src/") &&
      (path.endsWith(".ts") || path.endsWith(".tsx") || path.endsWith(".js") || path.endsWith(".jsx")) &&
      path !== "src/App.tsx" &&
      path !== "src/App.jsx" &&
      path !== "src/main.tsx" &&
      path !== "src/main.jsx",
  );

  // Build modules blob for inline usage (we strip imports/exports later)
  const modulesCode = moduleFiles
    .map(([path, content]) => {
      const name = path.replace(/^src\//, "");
      return `// ${name}\n${content}`;
    })
    .join("\n\n");

  // Process modules to remove ESM syntax for the in-iframe runtime
  const processedModules = modulesCode
    .replace(/^import\s+.*?['"].*?['"];?\s*$/gm, "")
    .replace(/export\s+default\s+/g, "")
    .replace(/^export\s+/gm, "");

  // Process App.tsx to extract the actual component
  const processedApp = appContent
    .replace(/^import\s+.*?['"].*?['"];?\s*$/gm, "")
    .replace(/export\s+default\s+/, "")
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

    window.addEventListener('error', (e) => __showErr('Sandbox runtime error', (e && (e.error || e.message))));
    window.addEventListener('unhandledrejection', (e) => __showErr('Sandbox unhandled promise rejection', e && e.reason));

    // Modules (components, types, utils, etc.)
    ${processedModules}

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
    try {
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(
        <React.StrictMode>
          <AppComponent />
        </React.StrictMode>
      );
    } catch (e) {
      __showErr('Sandbox render failed', e);
    }
  </script>
</body>
</html>`;
}
