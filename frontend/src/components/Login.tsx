import { useState } from 'react';
import { Login as WailsLogin } from '../../wailsjs/go/main/App';
import { getBackendBaseUrl } from '../api';

interface LoginProps {
    onLoginSuccess: (token: string, email: string, role?: string) => void;
    onOpenConfig?: () => void;
    activeEnvName?: string;
    backendUrl?: string;
}

export function Login({ onLoginSuccess, onOpenConfig, activeEnvName, backendUrl }: LoginProps) {
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
                const baseUrl = await getBackendBaseUrl();
                try {
                    resp = await fetch(`${baseUrl}/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: userEmail, password })
                    });
                } catch {
                    resp = await fetch('/auth/login', {
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
                    <div className="sidebar-brand-mark" aria-hidden="true" style={{ gridTemplateColumns: 'repeat(3, 7px)', gap: '4px' }}>
                        {['on', 'on', 'amber', 'on', '', 'on'].map((c, i) => (
                            <span key={i} className={c} style={{ width: 7, height: 7 }} />
                        ))}
                    </div>
                    <h2>Lab411</h2>
                    <p>Přihlaste se ke svým laboratorním strojům.</p>
                </div>

                {error && (
                    <div className="message error" style={{ marginBottom: '16px' }}>
                        {error}
                    </div>
                )}

                <form className="login-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>E-mail nebo uživatelské jméno</label>
                        <input 
                            type="text" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            placeholder="jmeno@skola.cz"
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
                            
                            required
                            disabled={isLoading}
                        />
                    </div>

                    <button 
                        type="submit" 
                        className="btn btn-primary login-btn"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Přihlašuji…' : 'Přihlásit se'}
                    </button>
                </form>


                <div style={{
                    marginTop: '16px',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '13px',
                    color: 'var(--text-muted)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="led on" />
                        <span>Prostředí: <strong>{activeEnvName || 'Lab 411'}</strong></span>
                    </div>
                    {onOpenConfig && (
                        <button
                            type="button"
                            onClick={onOpenConfig}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-main)',
                                cursor: 'pointer',
                                fontSize: '13px',
                                textDecoration: 'underline',
                                textUnderlineOffset: '3px',
                                padding: 0
                            }}
                        >
                            Změnit prostředí
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
