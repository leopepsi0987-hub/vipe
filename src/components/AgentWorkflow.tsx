import { cn } from "@/lib/utils";
import { Check, Loader2, AlertCircle } from "lucide-react";

interface Agent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  status: "pending" | "working" | "done" | "error";
  message?: string;
  output?: string;
}

interface WorkflowPlan {
  summary: string;
  tasks: {
    agent: string;
    task: string;
  }[];
}

interface AgentWorkflowProps {
  agents: Agent[];
  plan?: WorkflowPlan;
  isComplete: boolean;
}

export function AgentWorkflow({ agents, plan, isComplete }: AgentWorkflowProps) {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Plan Summary */}
      {plan && (
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">📋</span>
            <h3 className="font-semibold text-foreground">Execution Plan</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-3">{plan.summary}</p>
          <div className="space-y-2">
            {plan.tasks.map((task, i) => {
              const agent = agents.find(a => a.id === task.agent);
              return (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span>{agent?.emoji || "•"}</span>
                  <span className="text-muted-foreground">{task.task}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Agent Cards */}
      <div className="grid grid-cols-1 gap-3">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className={cn(
              "relative rounded-xl p-4 border transition-all duration-300",
              agent.status === "pending" && "bg-secondary/50 border-border opacity-60",
              agent.status === "working" && "bg-primary/5 border-primary/30 shadow-glow animate-pulse",
              agent.status === "done" && "bg-background border-border",
              agent.status === "error" && "bg-destructive/5 border-destructive/30"
            )}
          >
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 transition-all",
                  agent.status === "pending" && "bg-secondary",
                  agent.status === "working" && "bg-primary/20 shadow-lg",
                  agent.status === "done" && "bg-primary/10",
                  agent.status === "error" && "bg-destructive/20"
                )}
              >
                {agent.emoji}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-foreground">{agent.name}</h4>
                  {agent.status === "working" && (
                    <Loader2 className="w-3 h-3 animate-spin text-primary" />
                  )}
                  {agent.status === "done" && (
                    <Check className="w-3 h-3 text-primary" />
                  )}
                  {agent.status === "error" && (
                    <AlertCircle className="w-3 h-3 text-destructive" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{agent.role}</p>
                {agent.message && (
                  <p className={cn(
                    "text-sm mt-2",
                    agent.status === "working" && "text-primary animate-pulse",
                    agent.status === "done" && "text-foreground",
                    agent.status === "error" && "text-destructive"
                  )}>
                    {agent.message}
                  </p>
                )}
                {agent.output && agent.status === "done" && (
                  <div className="mt-2 p-2 bg-secondary/50 rounded-md text-xs text-muted-foreground font-mono max-h-20 overflow-hidden">
                    {agent.output}
                  </div>
                )}
              </div>
            </div>

            {/* Progress bar for working state */}
            {agent.status === "working" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary/20 overflow-hidden rounded-b-xl">
                <div className="h-full bg-primary animate-progress-indeterminate" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Completion message */}
      {isComplete && (
        <div className="text-center py-4 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-primary font-medium">
            <span>🚀</span>
            <span>All agents completed! Your app is ready.</span>
          </div>
        </div>
      )}
    </div>
  );
}
