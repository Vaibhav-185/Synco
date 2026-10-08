import { Component } from 'react';

// Catches a render crash in one section so a single bad record can never
// blank the whole app. Used around the Friends page.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('Section failed:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page">
          <div className="card">
            <div className="card-title">Something went wrong</div>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>
              This section failed to load. Reload the page; if it persists, contact support.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
