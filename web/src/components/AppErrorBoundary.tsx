import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '2rem', maxWidth: 560, margin: '0 auto', fontFamily: 'system-ui' }}>
          <h1 style={{ fontSize: '1.25rem' }}>Something went wrong</h1>
          <p style={{ color: '#b91c1c' }}>{this.state.error.message}</p>
          <button
            type="button"
            style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
