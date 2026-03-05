import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-secondary, #f5f5f5)', color: 'var(--text-primary, #333)',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{ textAlign: 'center', maxWidth: 400, padding: 24 }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: 18 }}>Something went wrong</h2>
            <p style={{ margin: '0 0 16px 0', fontSize: 13, color: 'var(--text-muted, #888)' }}>
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '6px 16px', border: '1px solid var(--border-primary, #ddd)', borderRadius: 4,
                background: 'var(--bg-primary, #fff)', color: 'var(--text-primary, #333)', cursor: 'pointer', fontSize: 13,
              }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
