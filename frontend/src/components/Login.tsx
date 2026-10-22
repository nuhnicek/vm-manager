import { useState } from 'react';
import { Login as WailsLogin } from '../../wailsjs/go/main/App';

interface LoginProps {
    onLoginSuccess: (token: string, email: string, role?: string) => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email.trim() || !password) {
            setError('Zadejte prosím e-mail i heslo.');
            return;
        }

        setIsLoading(true);

        try {
            let token = '';
            let userEmail = email.trim();
            let role = '';

            if (typeof window !== 'undefined' && (window as any).go?.main?.App?.Login) {
                const res = await WailsLogin(userEmail, password);
                token = res.token;
                userEmail = res.email || userEmail;
                role = (res as any).role || '';
            } else {
                let resp: Response;
                try {
                    resp = await fetch('/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: userEmail, password })
                    });
                } catch {
                    resp = await fetch('http://10.0.10.52:8080/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: userEmail, password })
                    });
                }

                if (resp.status === 200) {
                    const data = await resp.json();
                    token = data.token;
                    role = data.role || '';
                } else if (resp.status === 500 || resp.status === 401) {
                    throw new Error('Neplatný e-mail nebo heslo.');
                } else if (resp.status === 400) {
                    throw new Error('Neplatný formát požadavku na přihlášení.');
                } else {
                    throw new Error(`Chyba serveru (${resp.status}). Zkuste to prosím znovu.`);
                }
            }

            if (!token) {
                throw new Error('Ze serveru nebyl obdržen žádný bezpečnostní token.');
            }

            onLoginSuccess(token, userEmail, role);
            setPassword('');
        } catch (err: any) {
            console.error('Login failed:', err);
            setError(err?.message || 'Nepodařilo se připojit k autentizačnímu serveru.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="card login-card">
                <div className="login-header">
                    <div style={{ display: 'inline-flex', padding: '10px', background: 'var(--card-bg-subtle)', borderRadius: '6px', border: '1px solid var(--border-color)', marginBottom: '12px', color: 'var(--primary-color)' }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                            <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                            <line x1="6" y1="6" x2="6.01" y2="6"></line>
                            <line x1="6" y1="18" x2="6.01" y2="18"></line>
                        </svg>
                    </div>
                    <h2>Správce Virtuálních Strojů</h2>
                    <p>Přihlášení do výukového laboratorního prostředí</p>
                </div>

                {error && (
                    <div className="message error" style={{ marginBottom: '16px' }}>
                        {error}
                    </div>
                )}

                <form className="login-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Uživatelské jméno nebo e-mail</label>
                        <input 
                            type="text" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            placeholder="admin nebo ucitel@skola.cz"
                            required
                            disabled={isLoading}
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label>Heslo</label>
                        <input 
                            type="password" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            placeholder="heslo"
                            required
                            disabled={isLoading}
                        />
                    </div>

                    <button 
                        type="submit" 
                        className="btn btn-primary login-btn"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Ověřování přihlášení...' : 'Přihlásit se'}
                    </button>
                </form>

                <div className="login-hint">
                    Přihlaste se svými školními přístupovými údaji.
                </div>
            </div>
        </div>
    );
}
