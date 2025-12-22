// Lightweight in-browser bundler for preview/publish.
// It converts a Vite-style file map into a single HTML document executed in an iframe.
//
// Key requirement: support multi-file projects with ESM-style imports/exports.
// We implement a minimal module system (no npm deps resolution) for src/* files.

type FileMap = Record<string, string>;

type ResolvedPath = {
  path: string;
  content: string;
};

function normalizeSpecifier(spec: string) {
  // Remove query/hash and normalize slashes
  return spec.split("?")[0].split("#")[0].replace(/\\/g, "/");
}

function resolveModulePath(files: FileMap, rawSpecifier: string, fromPath?: string): string | null {
  const spec = normalizeSpecifier(rawSpecifier);

  // Alias @/ -> src/
  if (spec.startsWith("@/")) {
    const stem = `src/${spec.slice(2)}`;
    const candidates = [
      stem,
      `${stem}.ts`,
      `${stem}.tsx`,
      `${stem}.js`,
      `${stem}.jsx`,
      `${stem}/index.ts`,
      `${stem}/index.tsx`,
      `${stem}/index.js`,
      `${stem}/index.jsx`,
    ];
    return candidates.find((c) => files[c] != null) ?? null;
  }

  // Relative paths (./, ../)
  if ((spec.startsWith("./") || spec.startsWith("../")) && fromPath) {
    const fromDir = fromPath.split("/").slice(0, -1).join("/") || "src";
    const joined = `${fromDir}/${spec}`.replace(/\/\.\//g, "/");
    // normalize ../ segments
    const parts: string[] = [];
    for (const p of joined.split("/")) {
      if (!p || p === ".") continue;
      if (p === "..") parts.pop();
      else parts.push(p);
    }
    const stem = parts.join("/");

    const candidates = [
      stem,
      `${stem}.ts`,
      `${stem}.tsx`,
      `${stem}.js`,
      `${stem}.jsx`,
      `${stem}/index.ts`,
      `${stem}/index.tsx`,
      `${stem}/index.js`,
      `${stem}/index.jsx`,
    ];
    return candidates.find((c) => files[c] != null) ?? null;
  }

  // We do not resolve node_modules imports in the sandbox
  return null;
}

function extractExports(original: string) {
  const named = new Set<string>();
  let defaultName: string | null = null;

  // export default function Name
  const m1 = original.match(/export\s+default\s+function\s+([A-Za-z_$][\w$]*)/);
  if (m1) defaultName = m1[1];

  // export default Name
  if (!defaultName) {
    const m2 = original.match(/export\s+default\s+([A-Za-z_$][\w$]*)\s*;?/);
    if (m2) defaultName = m2[1];
  }

  // export function Foo / export const Foo / export class Foo
  for (const mm of original.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) named.add(mm[1]);
  for (const mm of original.matchAll(/export\s+const\s+([A-Za-z_$][\w$]*)/g)) named.add(mm[1]);
  for (const mm of original.matchAll(/export\s+let\s+([A-Za-z_$][\w$]*)/g)) named.add(mm[1]);
  for (const mm of original.matchAll(/export\s+var\s+([A-Za-z_$][\w$]*)/g)) named.add(mm[1]);
  for (const mm of original.matchAll(/export\s+class\s+([A-Za-z_$][\w$]*)/g)) named.add(mm[1]);

  // export { A, B as C }
  for (const mm of original.matchAll(/export\s*\{([^}]+)\}\s*;?/g)) {
    const inside = mm[1];
    for (const part of inside.split(",")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const asMatch = trimmed.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
      if (!asMatch) continue;
      const exportedName = asMatch[2] ?? asMatch[1];
      named.add(exportedName);
    }
  }

  return { defaultName, named: Array.from(named) };
}

function stripExportsAndImports(code: string) {
  // Remove *type-only* exports/imports don't matter; we just strip all imports.
  // Convert exports to normal declarations.
  return code
    .replace(/^import\s+.*?['"].*?['"];?\s*$/gm, "")
    .replace(/export\s+default\s+function\s+/g, "function ")
    .replace(/export\s+default\s+/g, "")
    .replace(/^export\s+(?=(const|let|var|function|class)\b)/gm, "")
    .replace(/^export\s*\{[^}]+\}\s*;?\s*$/gm, "");
}

function transformImportLine(files: FileMap, fromPath: string, line: string): string {
  // Handles:
  // import X from '...'
  // import { A, B as C } from '...'
  // import X, { A } from '...'

  const m = line.match(/^import\s+(.+?)\s+from\s+['"]([^'"]+)['"];?\s*$/);
  if (!m) return "";

  const bindings = m[1].trim();
  const spec = m[2].trim();
  const resolved = resolveModulePath(files, spec, fromPath);

  // For unsupported imports (node_modules), we drop them; the sandbox cannot run those.
  if (!resolved) return "";

  const moduleRef = `__modules[${JSON.stringify(resolved)}]`;

  // Split default + named
  const parts = bindings.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return "";

  const out: string[] = [];

  const first = parts[0];
  const hasNamed = bindings.includes("{");

  // default import
  if (!first.startsWith("{") && !first.startsWith("*")) {
    out.push(`const ${first} = ${moduleRef}.default;`);
  }

  // named import
  const namedMatch = bindings.match(/\{([^}]+)\}/);
  if (namedMatch) {
    const inside = namedMatch[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const mm = s.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
        if (!mm) return null;
        return mm[2] ? `${mm[1]}: ${mm[2]}` : mm[1];
      })
      .filter(Boolean)
      .join(", ");

    if (inside) out.push(`const { ${inside} } = ${moduleRef};`);
  }

  // namespace import: import * as X from '...'
  if (first.startsWith("*")) {
    const mm = bindings.match(/^\*\s+as\s+([A-Za-z_$][\w$]*)$/);
    if (mm) out.push(`const ${mm[1]} = ${moduleRef};`);
  }

  // If it was ONLY named (no default), we handled namedMatch.
  // If it was ONLY default, we handled default.
  // If it was mixed, both were handled.

  return out.join("\n");
}

function transformImports(files: FileMap, fromPath: string, code: string) {
  return code.replace(/^import\s+.*?from\s+['"][^'"]+['"];?\s*$/gm, (line) => transformImportLine(files, fromPath, line));
}

function buildModule(files: FileMap, path: string): ResolvedPath {
  const original = files[path] ?? "";
  const { defaultName, named } = extractExports(original);
  const body = stripExportsAndImports(original);

  const exportLines: string[] = [];
  if (defaultName) exportLines.push(`default: (typeof ${defaultName} !== 'undefined' ? ${defaultName} : undefined)`);
  for (const n of named) exportLines.push(`${JSON.stringify(n)}: (typeof ${n} !== 'undefined' ? ${n} : undefined)`);

  const exportsObj = `{ ${exportLines.join(", ")} }`;

  const wrapped = `// ${path}\n__modules[${JSON.stringify(path)}] = (function(){\n${body}\nreturn ${exportsObj};\n})();`;

  return { path, content: wrapped };
}

function buildApp(files: FileMap): string {
  const appPath = files["src/App.tsx"] ? "src/App.tsx" : files["src/App.jsx"] ? "src/App.jsx" : "";
  const original = appPath ? files[appPath] : "";
  if (!appPath || !original) {
    return `function App(){\n  return (\n    <div className=\"min-h-screen flex items-center justify-center\">\n      <div className=\"text-center\">\n        <h1 className=\"text-3xl font-bold\">No src/App.tsx found</h1>\n        <p className=\"text-muted-foreground\">Generate files with /build</p>\n      </div>\n    </div>\n  );\n}`;
  }

  // Transform imports into const assignments using __modules
  const withImports = transformImports(files, appPath, original);
  // Strip remaining export keywords
  const body = withImports
    .replace(/export\s+default\s+/g, "")
    .replace(/^export\s+(?=(const|let|var|function|class)\b)/gm, "");

  return `// ${appPath}\n${body}`;
}

export function generateBundledHTML(files: FileMap): string {
  const cssContent = files["src/index.css"] || files["src/App.css"] || "";

  const sourceFiles = Object.keys(files)
    .filter((p) => p.startsWith("src/") && (p.endsWith(".ts") || p.endsWith(".tsx") || p.endsWith(".js") || p.endsWith(".jsx")))
    .filter((p) => p !== "src/App.tsx" && p !== "src/App.jsx")
    .sort();

  const modules = sourceFiles.map((p) => buildModule(files, p).content).join("\n\n");
  const appCode = buildApp(files);

  // Escape any script closing tags in the generated code to prevent breaking the HTML
  const escapedModules = modules.replace(/<\/script>/gi, '<\\/script>');
  const escapedAppCode = appCode.replace(/<\/script>/gi, '<\\/script>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>

  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"><\/script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>

  <script src="https://cdn.tailwindcss.com"><\/script>
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
  <\/script>

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
        __errEl.textContent = title + '\\n\\n' + msg;
        try { window.parent && window.parent.postMessage({ type: 'SANDBOX_ERROR', title: title, message: msg }, '*'); } catch (_) {}
      } catch (_) {}
    };

    window.addEventListener('error', function(e) { __showErr('Sandbox runtime error', (e && (e.error || e.message))); });
    window.addEventListener('unhandledrejection', function(e) { __showErr('Sandbox unhandled promise rejection', e && e.reason); });

    // Minimal module system
    const __modules = {};

    try {
      ${escapedModules}
    } catch (e) {
      __showErr('Sandbox module evaluation failed', e);
    }

    // App entry
    try {
      ${escapedAppCode}

      const AppComponent = typeof App !== 'undefined' ? App : function() { return React.createElement('div', null, 'No App component found'); };
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(
        React.createElement(React.StrictMode, null,
          React.createElement(AppComponent, null)
        )
      );
    } catch (e) {
      __showErr('Sandbox render failed', e);
    }
  <\/script>
</body>
</html>`;
}
