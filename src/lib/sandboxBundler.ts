// In-browser preview bundler for the sandbox iframe.
//
// Goals:
// - Work with multi-file projects (a Vite-style file map)
// - Support TS/TSX/JS/JSX via Babel *at runtime* (inside iframe)
// - Avoid injecting raw user code directly into an inline "text/babel" script
//   (this was causing "Unterminated string constant" crashes)
//
// Approach:
// - Build a tiny module graph (src/* only) and emit a runtime loader.
// - Embed the module sources as JSON (safe) inside the iframe.
// - Inside iframe: Babel.transform the concatenated runtime + user sources and eval it.

export type FileMap = Record<string, string>;

type ModuleMap = Record<string, string>;

type ExportInfo = {
  defaultName: string | null;
  named: string[];
};

function normalizeSpecifier(spec: string) {
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

  // We do not resolve node_modules in the sandbox.
  return null;
}

function extractExports(original: string): ExportInfo {
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
  return code
    .replace(/^import\s+.*?['"].*?['"];?\s*$/gm, "")
    .replace(/export\s+default\s+function\s+/g, "function ")
    .replace(/export\s+default\s+/g, "")
    .replace(/^export\s+(?=(const|let|var|function|class)\b)/gm, "")
    .replace(/^export\s*\{[^}]+\}\s*;?\s*$/gm, "");
}

function transformImportLine(files: FileMap, fromPath: string, line: string): string {
  // import X from '...'
  // import { A, B as C } from '...'
  // import X, { A } from '...'
  // import * as X from '...'
  const m = line.match(/^import\s+(.+?)\s+from\s+['"]([^'"]+)['"];?\s*$/);
  if (!m) return "";

  const bindings = m[1].trim();
  const spec = m[2].trim();
  const resolved = resolveModulePath(files, spec, fromPath);

  // node_modules imports are not supported; leave them in place so React etc can be globals.
  // But in our sandbox code we expect React/ReactDOM as globals anyway, so we can drop them.
  if (!resolved) return "";

  const moduleRef = `__require(${JSON.stringify(resolved)})`;
  const out: string[] = [];

  // namespace import
  if (bindings.startsWith("*")) {
    const mm = bindings.match(/^\*\s+as\s+([A-Za-z_$][\w$]*)$/);
    if (mm) out.push(`const ${mm[1]} = ${moduleRef};`);
    return out.join("\n");
  }

  // split default + named
  const parts = bindings.split(",").map((s) => s.trim()).filter(Boolean);
  const first = parts[0];

  // default import
  if (first && !first.startsWith("{")) {
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

  return out.join("\n");
}

function transformImports(files: FileMap, fromPath: string, code: string) {
  return code.replace(/^import\s+.*?from\s+['"][^'"]+['"];?\s*$/gm, (line) =>
    transformImportLine(files, fromPath, line),
  );
}

function buildModuleMap(files: FileMap): ModuleMap {
  const moduleFiles = Object.keys(files)
    .filter((p) => p.startsWith("src/"))
    .filter((p) => /\.(ts|tsx|js|jsx)$/.test(p))
    .filter((p) => p !== "src/App.tsx" && p !== "src/App.jsx")
    .sort();

  const modules: ModuleMap = {};
  for (const path of moduleFiles) {
    const original = files[path] ?? "";
    const { defaultName, named } = extractExports(original);
    const bodyNoImports = stripExportsAndImports(original);
    const body = transformImports(files, path, bodyNoImports);

    const exportLines: string[] = [];
    if (defaultName) exportLines.push(`default: (typeof ${defaultName} !== 'undefined' ? ${defaultName} : undefined)`);
    for (const n of named) exportLines.push(`${JSON.stringify(n)}: (typeof ${n} !== 'undefined' ? ${n} : undefined)`);

    modules[path] = `// ${path}\n(function(){\n${body}\nreturn { ${exportLines.join(", ")} };\n})()`;
  }

  return modules;
}

function buildAppSource(files: FileMap): { appPath: string; appSource: string } {
  const appPath = files["src/App.tsx"] ? "src/App.tsx" : files["src/App.jsx"] ? "src/App.jsx" : "";
  const original = appPath ? files[appPath] : "";

  if (!appPath || !original) {
    return {
      appPath: "",
      appSource: `function App(){\n  return (\n    <div className=\"min-h-screen flex items-center justify-center\">\n      <div className=\"text-center\">\n        <h1 className=\"text-3xl font-bold\">No src/App.tsx found</h1>\n        <p className=\"text-muted-foreground\">Generate files with /build</p>\n      </div>\n    </div>\n  );\n}`,
    };
  }

  // We keep the App file body mostly intact but:
  // - transform src/* imports into __require(...) bindings
  // - remove export keywords
  const withImports = transformImports(files, appPath, original);
  const withoutExports = withImports
    .replace(/export\s+default\s+/g, "")
    .replace(/^export\s+(?=(const|let|var|function|class)\b)/gm, "");

  return { appPath, appSource: `// ${appPath}\n${withoutExports}` };
}

function safeJsonStringify(value: unknown) {
  // Prevent accidental closing of script tags when embedding JSON into HTML.
  return JSON.stringify(value).replace(/<\//g, "<\\/");
}

export function generateBundledHTML(files: FileMap): string {
  const cssContent = files["src/index.css"] || files["src/App.css"] || "";

  const moduleMap = buildModuleMap(files);
  const { appSource } = buildAppSource(files);

  const payload = {
    modules: moduleMap,
    app: appSource,
  };

  // A tiny runtime that is compiled by Babel at runtime.
  // NOTE: we do NOT inject user code directly into the script body.
  const runtimeTsx = `
    const __errEl = document.getElementById('__sandbox_error');
    const __copyBtn = document.getElementById('__sandbox_copy');
    const __reloadBtn = document.getElementById('__sandbox_reload');

    const __showErr = (title, err) => {
      try {
        const msg = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);
        __errEl.style.display = 'block';
        __errEl.querySelector('[data-role="title"]').textContent = title || 'Sandbox error';
        __errEl.querySelector('[data-role="msg"]').textContent = msg;
        try { window.parent && window.parent.postMessage({ type: 'SANDBOX_ERROR', title: title || 'Sandbox error', message: msg }, '*'); } catch (_) {}
      } catch (_) {}
    };

    window.addEventListener('error', function(e) { __showErr('Sandbox runtime error', (e && (e.error || e.message))); });
    window.addEventListener('unhandledrejection', function(e) { __showErr('Sandbox unhandled promise rejection', e && e.reason); });

    __copyBtn.addEventListener('click', async () => {
      try {
        const t = __errEl.querySelector('[data-role="title"]').textContent || 'Sandbox error';
        const m = __errEl.querySelector('[data-role="msg"]').textContent || '';
        await navigator.clipboard.writeText([t, m].filter(Boolean).join('\\n\\n'));
      } catch (_) {}
    });

    __reloadBtn.addEventListener('click', () => location.reload());

    const payload = JSON.parse(document.getElementById('__sandbox_payload').textContent || '{}');

    const __compile = (code, filename) => {
      try {
        return Babel.transform(code, {
          filename: filename || 'unknown.tsx',
          presets: ['typescript', 'react'],
        }).code;
      } catch (e) {
        throw new Error('Babel compile failed for ' + (filename || 'unknown') + '\\n' + String((e && (e.stack || e.message)) || e));
      }
    };

    const __cache = {};
    const __require = (path) => {
      if (__cache[path]) return __cache[path];
      const factorySrc = payload.modules && payload.modules[path];
      if (!factorySrc) throw new Error('Module not found: ' + path);
      const compiled = __compile(factorySrc, path);
      const exportsObj = (0, eval)(compiled);
      __cache[path] = exportsObj;
      return exportsObj;
    };

    // Expose require globally for transformed imports.
    window.__require = __require;

    try {
      // Evaluate App source (after import transforms). It should define App.
      const compiledApp = __compile(payload.app || '', 'src/App.tsx');
      (0, eval)(compiledApp);

      const AppComponent = typeof App !== 'undefined' ? App : function(){ return React.createElement('div', null, 'No App component found'); };
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(React.StrictMode, null, React.createElement(AppComponent, null)));
    } catch (e) {
      __showErr('Sandbox render failed', e);
    }
  `;

  // We transform the runtime with Babel in the iframe (so TSX works),
  // but we keep the user payload as JSON.
  const runnerJs = `
    (function(){
      const payloadScript = document.getElementById('__sandbox_payload');
      if (!payloadScript) return;

      const source = document.getElementById('__sandbox_runtime').textContent || '';
      try {
        const out = Babel.transform(source, { filename: 'runtime.tsx', presets: ['typescript', 'react'] }).code;
        (0, eval)(out);
      } catch (e) {
        // If even the runtime fails, show a minimal error.
        const el = document.getElementById('__sandbox_error');
        if (el) {
          el.style.display = 'block';
          const msg = (e && (e.stack || e.message)) ? (e.stack || e.message) : String(e);
          el.querySelector('[data-role="title"]').textContent = 'Sandbox bootstrap failed';
          el.querySelector('[data-role="msg"]').textContent = msg;
        }
        try { window.parent && window.parent.postMessage({ type: 'SANDBOX_ERROR', title: 'Sandbox bootstrap failed', message: String(e && (e.stack || e.message) || e) }, '*'); } catch (_) {}
      }
    })();
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preview</title>

  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            background: 'hsl(var(--background))',
            foreground: 'hsl(var(--foreground))',
            muted: 'hsl(var(--muted))',
            'muted-foreground': 'hsl(var(--muted-foreground))',
            border: 'hsl(var(--border))',
            card: 'hsl(var(--card))',
            'card-foreground': 'hsl(var(--card-foreground))',
            primary: 'hsl(var(--primary))',
            'primary-foreground': 'hsl(var(--primary-foreground))',
            destructive: 'hsl(var(--destructive))',
            'destructive-foreground': 'hsl(var(--destructive-foreground))'
          },
          borderRadius: {
            lg: 'var(--radius)',
            md: 'calc(var(--radius) - 2px)',
            sm: 'calc(var(--radius) - 4px)'
          }
        }
      }
    };
  </script>

  <style>
    :root {
      --background: 0 0% 100%;
      --foreground: 222.2 84% 4.9%;
      --card: 0 0% 100%;
      --card-foreground: 222.2 84% 4.9%;
      --primary: 221.2 83.2% 53.3%;
      --primary-foreground: 210 40% 98%;
      --muted: 210 40% 96%;
      --muted-foreground: 215.4 16.3% 46.9%;
      --destructive: 0 84.2% 60.2%;
      --destructive-foreground: 210 40% 98%;
      --border: 214.3 31.8% 91.4%;
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
        --muted: 217.2 32.6% 17.5%;
        --muted-foreground: 215 20.2% 65.1%;
        --destructive: 0 62.8% 30.6%;
        --destructive-foreground: 210 40% 98%;
        --border: 217.2 32.6% 17.5%;
      }
    }

    body {
      margin: 0;
      background: hsl(var(--background));
      color: hsl(var(--foreground));
      font-family: system-ui, -apple-system, sans-serif;
    }

    ${cssContent}
  </style>
</head>
<body class="bg-background text-foreground">
  <div id="root"></div>

  <div id="__sandbox_error" style="display:none; position:fixed; inset:12px; padding:14px; border-radius:14px; background:hsl(var(--background)); color:hsl(var(--foreground)); border:1px solid hsl(var(--border)); box-shadow:0 20px 60px rgba(0,0,0,0.35); overflow:auto; z-index:99999;">
    <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px;">
      <div style="font-weight:700;" data-role="title">Sandbox error</div>
      <div style="display:flex; gap:8px;">
        <button id="__sandbox_copy" style="padding:8px 10px; border-radius:10px; border:1px solid hsl(var(--border)); background:transparent; color:inherit; cursor:pointer;">Copy error</button>
        <button id="__sandbox_reload" style="padding:8px 10px; border-radius:10px; border:1px solid hsl(var(--border)); background:transparent; color:inherit; cursor:pointer;">Reload</button>
      </div>
    </div>
    <pre data-role="msg" style="margin:0; white-space:pre-wrap; word-break:break-word; font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono','Courier New', monospace; font-size:12px; line-height:1.45; color:hsl(var(--destructive));"></pre>
  </div>

  <script id="__sandbox_payload" type="application/json">${safeJsonStringify(payload)}</script>
  <script id="__sandbox_runtime" type="text/plain">${runtimeTsx.replace(/<\//g, "<\\/")}</script>
  <script>${runnerJs.replace(/<\//g, "<\\/")}</script>
</body>
</html>`;
}
