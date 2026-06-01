import { Component, type ReactNode } from "react";

interface State { hasError: boolean; message?: string }

/** Top-level safety net: a render crash shows a recoverable screen, not a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) };
  }

  componentDidCatch(err: unknown) {
    console.error("[ErrorBoundary]", err);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-6">
        <div className="max-w-md text-center">
          <div className="h-14 w-14 rounded-2xl bg-danger-light text-danger text-2xl font-bold flex items-center justify-center mx-auto mb-4">!</div>
          <h1 className="text-lg font-bold text-fg">页面遇到意外错误</h1>
          <p className="text-sm text-fg-tertiary mt-2 leading-relaxed break-words">{this.state.message ?? "未知错误"}</p>
          <button
            onClick={() => { this.setState({ hasError: false }); location.reload(); }}
            className="mt-5 px-5 h-10 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors cursor-pointer"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }
}
