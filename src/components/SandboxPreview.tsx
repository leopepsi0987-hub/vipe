import { useMemo } from "react";
import { generateBundledHTML } from "@/lib/sandboxBundler";

interface SandboxPreviewProps {
  files: Record<string, string>;
  className?: string;
}

export function SandboxPreview({ files, className }: SandboxPreviewProps) {
  const bundledHTML = useMemo(() => {
    if (!files || Object.keys(files).length === 0) {
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

