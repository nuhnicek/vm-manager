import { useState } from 'react';
import { Login as WailsLogin } from '../../wailsjs/go/main/App';

interface LoginProps {
    onLoginSuccess: (token: string, email: string) => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError('');

        if (!email.trim() || !password) {
            setLoginError('Please enter both email and password.');
            return;
        }

        setIsLoading(true);
        try {
            let token = '';
            let userEmail = email.trim();

            if (typeof window !== 'undefined' && (window as any).go?.main?.App?.Login) {
                const res = await WailsLogin(userEmail, password);
                token = res.token;
                userEmail = res.email || userEmail;
            } else {
                let resp: Response;
                try {
                    resp = await fetch('/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: userEmail, password }),
                    });
                } catch {
                    resp = await fetch('http://localhost:8080/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: userEmail, password }),
                    });
                }

                if (resp.status === 200) {
                    const data = await resp.json();
                    token = data.token;
                } else if (resp.status === 500) {
                    throw new Error('Invalid email or password.');
                } else if (resp.status === 400) {
                    throw new Error('Invalid request format.');
                } else {
                    throw new Error(`Login failed with HTTP status ${resp.status}`);
                }
            }

            if (!token) {
                throw new Error('No session token received.');
            }

            onLoginSuccess(token, userEmail);
            setPassword('');
        } catch (err: any) {
            console.error('Login failed:', err);
            const msg = err?.message || String(err);
            if (msg.includes('Failed to fetch') || msg.includes('failed to reach backend') || msg.includes('connection refused')) {
                setLoginError('Cannot connect to backend server. Please make sure the backend is running on http://localhost:8080.');
            } else {
                setLoginError(msg);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="card login-card">
                <h2 className="text-center">VM Manager Login</h2>
                {loginError && <div className="message error">{loginError}</div>}
                <form className="login-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Email</label>
                        <input 
                            type="email" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            placeholder="name@example.com"
                            required
                            disabled={isLoading}
                            autoFocus
                        />
                    </div>
                    <div className="form-group" style={{ marginTop: '16px' }}>
                        <label>Password</label>
                        <input 
                            type="password" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            placeholder="••••••••"
                            required
                            disabled={isLoading}
                        />
                    </div>
                    <button 
                        type="submit" 
                        className="btn btn-primary login-btn"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Logging in...' : 'Login'}
                    </button>
                </form>
            </div>
        </div>
    );
}
