import { Component, Fragment } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Alert, Button } from "@/components/ui";

interface BoundaryState {
  error: Error | null;
  attempt: number;
}

export class ToolErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  override state: BoundaryState = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Tool crashed:", error.message, info.componentStack);
  }

  private reset = () => {
    this.setState((state) => ({ error: null, attempt: state.attempt + 1 }));
  };

  override render() {
    if (this.state.error) {
      return (
        <div className="space-y-3">
          <Alert tone="danger" title="This tool hit an unexpected error">
            It could not render. Try again, or reload the page if the problem continues.
            {import.meta.env.DEV ? (
              <span className="mt-1 block font-mono text-[11px] opacity-80">
                {this.state.error.message}
              </span>
            ) : null}
          </Alert>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={this.reset}>
              Try again
            </Button>
            <Button variant="ghost" onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </div>
        </div>
      );
    }
    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
  }
}
