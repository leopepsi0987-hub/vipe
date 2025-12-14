import { useState } from "react";
import { Database, Plus, Trash2, Edit2, Save, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProjectData } from "@/hooks/useProjectData";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DataPanelProps {
  projectId: string | null;
}

export function DataPanel({ projectId }: DataPanelProps) {
  const { projectData, isLoading, setData, deleteData, isUpdating } = useProjectData(projectId);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    if (!newKey.trim()) {
      toast.error("Key is required");
      return;
    }

    try {
      const parsedValue = newValue.trim() ? JSON.parse(newValue) : {};
      await setData({ key: newKey.trim(), value: parsedValue });
      setNewKey("");
      setNewValue("");
      setIsAdding(false);
      toast.success("Data added");
    } catch (e) {
      toast.error("Invalid JSON value");
    }
  };

  const handleUpdate = async (key: string) => {
    try {
      const parsedValue = editValue.trim() ? JSON.parse(editValue) : {};
      await setData({ key, value: parsedValue });
      setEditingKey(null);
      toast.success("Data updated");
    } catch (e) {
      toast.error("Invalid JSON value");
    }
  };

  const handleDelete = async (key: string) => {
    try {
      await deleteData(key);
      toast.success("Data deleted");
    } catch (e) {
      toast.error("Failed to delete");
    }
  };

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Select a project to view data</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          <span className="font-medium text-foreground">Project Data</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsAdding(true)}
          disabled={isAdding}
          className="h-7"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {isAdding && (
              <div className="bg-secondary/50 rounded-lg p-3 space-y-2 border border-border">
                <Input
                  placeholder="Key (e.g. users, settings)"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="bg-background/50 h-8 text-sm"
                />
                <Input
                  placeholder='Value as JSON (e.g. {"name": "John"})'
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="bg-background/50 h-8 text-sm font-mono"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAdd} disabled={isUpdating} className="h-7">
                    <Save className="w-3 h-3 mr-1" /> Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)} className="h-7">
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}

            {projectData.length === 0 && !isAdding ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No data stored yet</p>
                <p className="text-xs mt-1">Add key-value pairs to store app data</p>
              </div>
            ) : (
              projectData.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "bg-secondary/30 rounded-lg p-3 border border-border/50",
                    editingKey === item.key && "border-primary"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-primary">{item.key}</span>
                    <div className="flex gap-1">
                      {editingKey === item.key ? (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => handleUpdate(item.key)}
                            disabled={isUpdating}
                          >
                            <Save className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => setEditingKey(null)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => {
                              setEditingKey(item.key);
                              setEditValue(JSON.stringify(item.value, null, 2));
                            }}
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(item.key)}
                            disabled={isUpdating}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {editingKey === item.key ? (
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full h-24 bg-background/50 rounded border border-border p-2 text-xs font-mono text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  ) : (
                    <pre className="text-xs font-mono text-muted-foreground overflow-auto max-h-20 whitespace-pre-wrap">
                      {JSON.stringify(item.value, null, 2)}
                    </pre>
                  )}
                </div>
              ))
            )}
          </>
        )}
      </div>

      <div className="px-4 py-2 border-t border-border bg-secondary/30">
        <p className="text-xs text-muted-foreground">
          Data is accessible in your app via the API
        </p>
      </div>
    </div>
  );
}
