import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, Copy, Database, ExternalLink, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SqlPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sql: string;
  onApprove: () => Promise<void>;
  onCancel: () => void;
  isExecuting?: boolean;
}

export function SqlPreviewModal({
  open,
  onOpenChange,
  sql,
  onApprove,
  onCancel,
  isExecuting = false,
}: SqlPreviewModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Syntax highlight SQL keywords
  const highlightSql = (sqlText: string) => {
    const keywords = [
      "CREATE", "TABLE", "ALTER", "DROP", "INSERT", "UPDATE", "DELETE", "SELECT",
      "FROM", "WHERE", "AND", "OR", "NOT", "NULL", "DEFAULT", "PRIMARY", "KEY",
      "REFERENCES", "FOREIGN", "UNIQUE", "INDEX", "ON", "FOR", "USING", "WITH",
      "CHECK", "ENABLE", "ROW", "LEVEL", "SECURITY", "POLICY", "TO", "AS",
      "RETURNS", "LANGUAGE", "FUNCTION", "TRIGGER", "BEFORE", "AFTER", "EACH",
      "EXECUTE", "PROCEDURE", "BEGIN", "END", "IF", "THEN", "ELSE", "ELSIF",
      "RETURN", "DECLARE", "INTO", "VALUES", "SET", "CASCADE", "RESTRICT",
      "UUID", "TEXT", "INTEGER", "BOOLEAN", "TIMESTAMPTZ", "JSONB", "SERIAL",
      "BIGINT", "SMALLINT", "REAL", "DOUBLE", "PRECISION", "VARCHAR", "CHAR",
      "TRUE", "FALSE", "PUBLIC", "AUTH", "ALL", "ANY", "EXISTS", "IN", "LIKE",
      "BETWEEN", "IS", "CONSTRAINT", "ADD", "COLUMN", "RENAME", "TYPE", "OWNER",
      "GRANT", "REVOKE", "SCHEMA", "DATABASE", "EXTENSION", "PUBLICATION",
    ];

    const lines = sqlText.split('\n');
    
    return lines.map((line, lineIndex) => {
      // Handle comments
      if (line.trim().startsWith('--')) {
        return (
          <div key={lineIndex} className="text-muted-foreground italic">
            {line}
          </div>
        );
      }

      // Highlight keywords
      let result: React.ReactNode[] = [];
      let remaining = line;
      let partIndex = 0;

      while (remaining.length > 0) {
        let matched = false;

        for (const keyword of keywords) {
          const regex = new RegExp(`^(${keyword})\\b`, 'i');
          const match = remaining.match(regex);
          
          if (match) {
            result.push(
              <span key={`${lineIndex}-${partIndex}`} className="text-primary font-semibold">
                {match[1]}
              </span>
            );
            remaining = remaining.slice(match[1].length);
            partIndex++;
            matched = true;
            break;
          }
        }

        if (!matched) {
          // Check for strings
          const stringMatch = remaining.match(/^('[^']*')/);
          if (stringMatch) {
            result.push(
              <span key={`${lineIndex}-${partIndex}`} className="text-green-500">
                {stringMatch[1]}
              </span>
            );
            remaining = remaining.slice(stringMatch[1].length);
            partIndex++;
          } else {
            // Regular character
            result.push(remaining[0]);
            remaining = remaining.slice(1);
          }
        }
      }

      return <div key={lineIndex}>{result}</div>;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col bg-card border-border">
        <DialogHeader className="pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Database className="w-4 h-4 text-primary" />
            </div>
            Review Database Changes
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            The AI wants to execute the following SQL on your database. Review and approve to continue.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 max-h-[400px]">
          <div className="relative">
            {/* Copy button */}
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 z-10 h-8 gap-1.5 text-xs"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </>
              )}
            </Button>

            {/* SQL code block */}
            <div className="bg-secondary/50 rounded-lg p-4 pr-20 font-mono text-sm leading-relaxed overflow-x-auto">
              {highlightSql(sql)}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t border-border gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isExecuting}
            className="gap-2"
          >
            <X className="w-4 h-4" />
            Cancel
          </Button>
          <Button
            onClick={onApprove}
            disabled={isExecuting}
            className={cn(
              "gap-2",
              isExecuting && "cursor-wait"
            )}
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Approve & Execute
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
