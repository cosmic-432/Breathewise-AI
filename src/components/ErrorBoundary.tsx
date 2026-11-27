import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Keep error handling quiet and safe without leaking stack traces to the UI
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="rounded-xl border border-[#C94D53]/40 bg-white p-6 space-y-3"
        >
          <h2 className="text-base font-semibold text-[#20332B]">
            This section ran into an unexpected display issue
          </h2>
          <p className="text-sm text-[#52645A]">
            Your saved preferences and data are safe. Try reloading this view.
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false });
              this.props.onReset?.();
            }}
            className="rounded-lg bg-[#237A57] px-4 py-2 text-sm font-medium text-white hover:bg-[#18543F] transition-colors"
          >
            Reload Section
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
