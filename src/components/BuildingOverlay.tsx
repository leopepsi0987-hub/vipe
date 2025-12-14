import { Code, Hammer, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface BuildingOverlayProps {
  isBuilding: boolean;
}

export function BuildingOverlay({ isBuilding }: BuildingOverlayProps) {
  if (!isBuilding) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6">
        {/* Animated icon */}
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-gradient-primary flex items-center justify-center animate-building shadow-glow">
            <Hammer className="w-10 h-10 text-primary-foreground" />
          </div>
          
          {/* Orbiting particles */}
          <div className="absolute inset-0 animate-spin" style={{ animationDuration: '3s' }}>
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-primary" />
          </div>
          <div className="absolute inset-0 animate-spin" style={{ animationDuration: '4s', animationDirection: 'reverse' }}>
            <div className="absolute top-1/2 -right-2 -translate-y-1/2 w-2 h-2 rounded-full bg-accent" />
          </div>
        </div>

        {/* Text */}
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground mb-1">Building your app...</h3>
          <p className="text-sm text-muted-foreground">This might take a moment</p>
        </div>

        {/* Code lines animation */}
        <div className="w-64 h-24 rounded-lg bg-card border border-border overflow-hidden relative code-lines">
          <div className="p-3 space-y-2">
            <div className="flex gap-2">
              <div className="w-12 h-2 rounded bg-primary/30 animate-pulse" />
              <div className="w-20 h-2 rounded bg-muted-foreground/20 animate-pulse" style={{ animationDelay: '0.1s' }} />
            </div>
            <div className="flex gap-2 pl-4">
              <div className="w-16 h-2 rounded bg-accent/30 animate-pulse" style={{ animationDelay: '0.2s' }} />
              <div className="w-24 h-2 rounded bg-muted-foreground/20 animate-pulse" style={{ animationDelay: '0.3s' }} />
            </div>
            <div className="flex gap-2 pl-4">
              <div className="w-8 h-2 rounded bg-primary/30 animate-pulse" style={{ animationDelay: '0.4s' }} />
              <div className="w-32 h-2 rounded bg-muted-foreground/20 animate-pulse" style={{ animationDelay: '0.5s' }} />
            </div>
            <div className="flex gap-2">
              <div className="w-14 h-2 rounded bg-accent/30 animate-pulse" style={{ animationDelay: '0.6s' }} />
            </div>
          </div>
          <div className="absolute inset-0 building-shimmer" />
        </div>
      </div>
    </div>
  );
}
