import { Component } from 'react';
import { AlertTriangle, RefreshCw, Home as HomeIcon } from 'lucide-react';

/**
 * Catches render-time errors so the whole app does not white-screen.
 * Wrap routed sections (or the whole <App />) in this.
 */
export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-[60vh] grid place-items-center px-4 py-10">
        <div className="card-flat max-w-lg w-full text-center">
          <div className="mx-auto inline-grid place-items-center w-14 h-14 rounded-full bg-danger/15 text-danger mb-3">
            <AlertTriangle size={28} />
          </div>
          <h1 className="text-xl font-extrabold text-neutral-900 dark:text-white">
            Something went wrong
          </h1>
          <p className="text-sm text-neutral-600 dark:text-slate-400 mt-2">
            The page hit an unexpected error. You can try again, or go back to the home page.
          </p>
          {import.meta.env.DEV && (
            <pre className="text-xs text-start mt-3 p-3 rounded bg-neutral-50 dark:bg-slate-800 dark:text-slate-300 overflow-auto">
              {String(this.state.error?.stack || this.state.error)}
            </pre>
          )}
          <div className="mt-5 flex flex-wrap gap-2 justify-center">
            <button onClick={this.reset} className="btn-primary">
              <RefreshCw size={16} /> Try again
            </button>
            <a href="/" className="btn-outline">
              <HomeIcon size={16} /> Home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
