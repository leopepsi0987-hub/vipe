import { useEffect, useMemo, useState } from "react";
import { generateBundledHTML } from "@/lib/sandboxBundler";
import { generateESMSandbox } from "@/lib/esmSandbox";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Copy, Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface SandboxPreviewProps {
  files: Record<string, string>;
  className?: string;
  useESM?: boolean; // Use the new ESM-based sandbox
}

type ImportCheck = {
  from: string;
  resolved?: string;
  exists: boolean;
};

function resolveImportToCandidatePaths(importPath: string): string[] {
  if (!importPath.startsWith("./") && !importPath.startsWith("../")) return [];

  const base = "src/";
  const cleaned = importPath.replace(/^\.\//, "").replace(/^\.\.\//, "");
  const stem = `${base}${cleaned}`;

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

export function SandboxPreview({ files, className, useESM = false }: SandboxPreviewProps) {
  const [lastError, setLastError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const missingImports = useMemo(() => findMissingImports(files ?? {}), [files]);

  const bundledHTML = useMemo(() => {
    setLastError(null);
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    if (!files || Object.keys(files).length === 0) {
      return generateBundledHTML({}, baseUrl);
    }
    // Use ESM sandbox if enabled
    if (useESM) {
      return generateESMSandbox(files, "src/App.tsx", baseUrl).html;
    }
    return generateBundledHTML(files, baseUrl);
  }, [files, refreshKey, useESM]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data = e.data as any;
      if (!data || data.type !== "SANDBOX_ERROR") return;
      const title = typeof data.title === "string" ? data.title : "Sandbox error";
      const msg = typeof data.message === "string" ? data.message : JSON.stringify(data.message);
      setLastError(`${title}\n\n${msg}`);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const handleCopyError = async () => {
    if (!lastError) return;
    try {
      await navigator.clipboard.writeText(lastError);
      setCopied(true);
      toast.success("Error copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleRefresh = () => {
    setLastError(null);
    setRefreshKey((k) => k + 1);
  };

  const shouldBlock = missingImports.length > 0;
  const hasError = shouldBlock || lastError;

  return (
    <div className="relative w-full h-full">
      <iframe
        key={refreshKey}
        srcDoc={bundledHTML}
        className={className}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        style={{ width: "100%", height: "100%", border: "none" }}
        title="Preview"
      />

      {hasError && (
        <div className="absolute inset-0 p-4 bg-background/98 text-foreground overflow-auto">
          <div className="max-w-2xl mx-auto mt-8">
            {/* Error Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Preview Failed</h2>
                <p className="text-sm text-muted-foreground">
                  {shouldBlock ? "Missing imports detected" : "Runtime error occurred"}
                </p>
              </div>
            </div>

            {shouldBlock ? (
              /* Missing Imports Error */
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  Your App.tsx imports files that don't exist in this project:
                </p>
                <div className="space-y-2">
                  {missingImports.map((imp) => (
                    <div
                      key={imp.from}
                      className="rounded-lg border border-destructive/30 bg-destructive/5 p-4"
                    >
                      <code className="text-sm font-mono text-destructive">{imp.from}</code>
                      <p className="text-xs text-muted-foreground mt-1">
                        Create this file under <code className="bg-muted px-1 rounded">src/</code> or update the import path.
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Runtime Error */
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  The generated app crashed at runtime. Here's the error:
                </p>

                {/* Error Box */}
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
                    <span className="text-sm font-medium text-muted-foreground">Error Details</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={handleRefresh}
                      >
                        <RefreshCw className="w-3 h-3" />
                        Retry
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={handleCopyError}
                      >
                        {copied ? (
                          <>
                            <Check className="w-3 h-3 text-green-500" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            Copy Error
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  <pre className="p-4 text-xs font-mono text-destructive whitespace-pre-wrap break-words max-h-80 overflow-auto">
                    {lastError}
                  </pre>
                </div>

                {/* Help Tips */}
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <h3 className="text-sm font-medium mb-2">Common Fixes</h3>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Check that all component names match their imports</li>
                    <li>Ensure all files use <code className="bg-muted px-1 rounded">export default</code> correctly</li>
                    <li>Verify import paths use <code className="bg-muted px-1 rounded">@/</code> alias</li>
                    <li>Look for syntax errors in the generated code</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 mt-6">
              <Button variant="outline" onClick={handleRefresh} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Refresh Preview
              </Button>
              {lastError && (
                <Button variant="secondary" onClick={handleCopyError} className="gap-2">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied!" : "Copy Error"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
