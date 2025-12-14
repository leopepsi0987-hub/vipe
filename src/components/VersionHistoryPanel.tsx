import { useState } from "react";
import { Version } from "@/hooks/useVersionHistory";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, RotateCcw, Loader2, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";

interface VersionHistoryPanelProps {
  versions: Version[];
  loading: boolean;
  onRestore: (version: Version) => void;
  onClose: () => void;
}

export function VersionHistoryPanel({
  versions,
  loading,
  onRestore,
  onClose,
}: VersionHistoryPanelProps) {
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const handleRestoreClick = (version: Version) => {
    setSelectedVersion(version);
    setShowConfirmDialog(true);
  };

  const handleConfirmRestore = async () => {
    if (!selectedVersion) return;
    setRestoring(true);
    await onRestore(selectedVersion);
    setRestoring(false);
    setShowConfirmDialog(false);
    onClose();
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Version History</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Version List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-muted-foreground text-sm">No versions yet</p>
              <p className="text-muted-foreground/70 text-xs mt-1">
                Versions are saved automatically when you build with AI
              </p>
            </div>
          ) : (
            versions.map((version, index) => (
              <div
                key={version.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-primary/50 transition-colors",
                  index === 0 && "bg-primary/5 border-primary/30"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium",
                      index === 0
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground"
                    )}
                  >
                    v{version.version_number}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Version {version.version_number}
                      {index === 0 && (
                        <span className="ml-2 text-xs text-primary">(Current)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(version.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
                {index !== 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => handleRestoreClick(version)}
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restore
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Confirm Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Version {selectedVersion?.version_number}?</DialogTitle>
            <DialogDescription>
              This will replace your current code with the code from version{" "}
              {selectedVersion?.version_number}. A new version will be saved with
              your current code before restoring.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={restoring}
            >
              Cancel
            </Button>
            <Button variant="glow" onClick={handleConfirmRestore} disabled={restoring}>
              {restoring ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RotateCcw className="w-4 h-4 mr-2" />
              )}
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
