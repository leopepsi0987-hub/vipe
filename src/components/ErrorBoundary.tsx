import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  name?: string;
};

type State = {
  hasError: boolean;
  message?: string;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // Keep this log: it helps us identify which component triggered the crash.
    console.error(`[ErrorBoundary${this.props.name ? `:${this.props.name}` : ""}]`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-xl border border-border bg-card p-6">
            <h1 className="text-lg font-semibold text-foreground">Something crashed</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {this.state.message || "Unknown error"}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
