import { Component, type ReactNode } from "react";
import { primaryButtonClass } from "../styles";
import StatusMessage from "./StatusMessage";

interface ErrorBoundaryProps {
  // Changing this (e.g. the route) clears the error, so the nav still works.
  resetKey: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  resetKey: string;
}

// Keeps a render error (such as the calendar chunk failing to download, or a
// stale tab after a redeploy) from blanking the whole app: the header, nav and
// footer stay, and the page area offers a reload.
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  static getDerivedStateFromProps(props: ErrorBoundaryProps, state: ErrorBoundaryState): Partial<ErrorBoundaryState> | null {
    return props.resetKey === state.resetKey ? null : { hasError: false, resetKey: props.resetKey };
  }

  override render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="mx-auto max-w-2xl">
        <StatusMessage tone="error" title="This page couldn’t be loaded.">
          <p className="mb-4">Check your connection and reload. If the site was just updated, a reload fixes it.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={primaryButtonClass}
          >
            Reload
          </button>
        </StatusMessage>
      </div>
    );
  }
}

export default ErrorBoundary;
