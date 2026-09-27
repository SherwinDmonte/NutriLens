import { Component } from 'react';

export class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    if (import.meta.env.DEV) console.error('NutriLens render error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="status-page">
          <p className="eyebrow">Something went wrong</p>
          <h1>NutriLens could not load this view.</h1>
          <p>Please refresh the page and try again.</p>
          <button
            className="button button-primary"
            type="button"
            onClick={() => window.location.reload()}
          >
            Refresh page
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}
