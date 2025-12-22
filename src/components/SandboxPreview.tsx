import { useEffect, useMemo, useState } from "react";
import { generateBundledHTML } from "@/lib/sandboxBundler";

interface SandboxPreviewProps {
  files: Record<string, string>;
  className?: string;
}

type ImportCheck = {
  from: string;
  resolved?: string;
  exists: boolean;
};

function resolveImportToCandidatePaths(importPath: string): string[] {
  // Only handle relative imports here. Aliases (like @/) are handled by generation prompt, not this resolver.
  if (!importPath.startsWith("./") && !importPath.startsWith("../")) return [];

  const base = "src/";
  const cleaned = importPath.replace(/^\.\//, "").replace(/^\.\.\//, "");

  // If the model uses ./components/Foo, assume src/components/Foo
  const stem = `${base}${cleaned}`;

  // Common TS/JS extensions
  return [
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
}

function findMissingImports(files: Record<string, string>): ImportCheck[] {
  const app = files["src/App.tsx"] || files["src/App.jsx"] || "";
  if (!app) return [];

  const imports = Array.from(app.matchAll(/^import\s+[^;]*?from\s+['"]([^'"]+)['"];?\s*$/gm)).map(
    (m) => m[1],
  );

  return imports
    .filter((p) => p.startsWith("./") || p.startsWith("../"))
    .map((p) => {
      const candidates = resolveImportToCandidatePaths(p);
      const found = candidates.find((c) => files[c] != null);
      return {
        from: p,
        resolved: found,
        exists: !!found,
      };
    })
    .filter((x) => !x.exists);
}

export function SandboxPreview({ files, className }: SandboxPreviewProps) {
  const [lastError, setLastError] = useState<string | null>(null);

  const missingImports = useMemo(() => findMissingImports(files ?? {}), [files]);

  const bundledHTML = useMemo(() => {
    setLastError(null);
    if (!files || Object.keys(files).length === 0) {
      return generateBundledHTML({});
    }
    return generateBundledHTML(files);
  }, [files]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data = e.data as any;
      if (!data || data.type !== "SANDBOX_ERROR") return;
      const title = typeof data.title === "string" ? data.title : "Sandbox error";
      const msg = typeof data.message === "string" ? data.message : JSON.stringify(data.message);
      setLastError(`${title}: ${msg}`);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const shouldBlock = missingImports.length > 0;

  return (
    <div className="relative w-full h-full">
      <iframe
        srcDoc={bundledHTML}
        className={className}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        style={{ width: "100%", height: "100%", border: "none" }}
        title="Preview"
      />

      {(shouldBlock || lastError) && (
        <div className="absolute inset-0 p-4 bg-background/95 text-foreground">
          <div className="h-full w-full rounded-lg border border-border bg-card p-4 overflow-auto">
            <h2 className="text-base font-semibold">Preview failed to run</h2>

            {shouldBlock ? (
              <>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your App.tsx imports files that don’t exist in this project, so the preview can’t render.
                </p>
                <div className="mt-4 space-y-2">
                  {missingImports.map((imp) => (
                    <div key={imp.from} className="rounded-md border border-border bg-background p-3">
                      <div className="text-sm font-medium">Missing: {imp.from}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Create that file under <span className="font-mono">src/</span> or update the import path.
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="mt-1 text-sm text-muted-foreground">
                  The generated app crashed at runtime inside the preview sandbox.
                </p>
                <pre className="mt-4 text-xs whitespace-pre-wrap break-words">{lastError}</pre>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}



