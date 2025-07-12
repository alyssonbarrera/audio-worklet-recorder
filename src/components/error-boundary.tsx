/** biome-ignore-all lint/suspicious/noConsole: needed for error logging */
import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error?: Error;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Error Boundary caught an error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
            <h2 className="mb-4 font-semibold text-red-800 text-xl">
              Something went wrong
            </h2>
            <p className="mb-4 text-red-600">
              An unexpected error occurred in the application. Please reload the
              page.
            </p>
            <button
              className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              onClick={() => window.location.reload()}
              type="button"
            >
              Reload Page
            </button>
            {this.state.error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-red-700 text-sm">
                  Error details (for developers)
                </summary>
                <pre className="mt-2 overflow-auto text-red-800 text-xs">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
