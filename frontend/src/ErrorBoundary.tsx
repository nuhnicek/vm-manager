import { Component, ReactNode } from 'react';

interface State { error: Error | null }

/** Prevents a render error in any component from blanking the whole window. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: unknown) {
        console.error('UI crashed:', error, info);
    }

    render() {
        if (!this.state.error) return this.props.children;
        return (
            <div className="login-container">
                <div className="card" style={{ maxWidth: 560 }}>
                    <h3>Něco se pokazilo</h3>
                    <p className="text-muted">Rozhraní narazilo na neočekávanou chybu.</p>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: 'var(--code-bg)', padding: 12, borderRadius: 6 }}>
                        {this.state.error.message}
                    </pre>
                    <div className="modal-actions">
                        <button className="btn btn-secondary" onClick={() => this.setState({ error: null })}>Zkusit znovu</button>
                        <button className="btn btn-primary" onClick={() => window.location.reload()}>Znovu načíst aplikaci</button>
                    </div>
                </div>
            </div>
        );
    }
}
