import { Component } from "react";

export default class RouteErrorBoundary extends Component {
  state = { error: null, componentStack: "" };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(error, errorInfo);
    this.setState({ componentStack: errorInfo.componentStack || "" });
  }

  render() {
    if (!this.state.error) return this.props.children;

    const message = this.props.fallbackMessage || "This page could not be displayed";
    return (
      <section className="mx-auto max-w-xl px-6 py-12 text-center" role="alert">
        <h1 className="text-2xl font-bold">{message}</h1>
        {import.meta.env.DEV ? (
          <div className="mt-4 text-left">
            <pre className="overflow-auto whitespace-pre-wrap break-words rounded-lg bg-fail-tint p-4 text-sm text-fail">
              {String(this.state.error)}
              {this.state.componentStack && `\n\n${this.state.componentStack}`}
            </pre>
          </div>
        ) : !this.props.fallbackMessage ? (
          <p className="mt-2 text-ink-2">An unexpected error occurred. Reload the page to try again.</p>
        ) : null}
        {this.props.showReload !== false && (
          <button type="button" className="btn btn-primary mt-5" onClick={() => window.location.reload()}>
            Reload page
          </button>
        )}
      </section>
    );
  }
}
