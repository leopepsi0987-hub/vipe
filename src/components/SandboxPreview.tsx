import { useEffect, useMemo, useState } from "react";
import { generateBundledHTML } from "@/lib/sandboxBundler";

interface SandboxPreviewProps {
  files: Record<string, string>;
  className?: string;
}

export function SandboxPreview({ files, className }: SandboxPreviewProps) {
  const [lastError, setLastError] = useState<string | null>(null);

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

  return (
    <div className={"relative w-full h-full"}>
      <iframe
        srcDoc={bundledHTML}
        className={className}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        style={{ width: "100%", height: "100%", border: "none" }}
        title="Preview"
      />

      {lastError && (
        <div className="absolute inset-0 p-4 bg-background/95 text-foreground">
          <div className="h-full w-full rounded-lg border border-border bg-card p-4 overflow-auto">
            <h2 className="text-base font-semibold">Preview failed to run</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The generated app uses imports/APIs that this preview sandbox can’t execute.
            </p>
            <pre className="mt-4 text-xs whitespace-pre-wrap break-words">{lastError}</pre>
          </div>
        </div>
      )}
    </div>
  );
}


