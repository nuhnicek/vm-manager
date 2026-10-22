import { useState, useEffect } from 'react';
import { TeacherStudentInfo } from '../types';

interface StudentsManagerProps {
    token: string;
    onMessage: (msg: string) => void;
}

export function StudentsManager({ token, onMessage }: StudentsManagerProps) {
    const [students, setStudents] = useState<TeacherStudentInfo[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showEnrollForm, setShowEnrollForm] = useState(false);

    const [newEmail, setNewEmail] = useState('');
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchStudents = async () => {
        setIsLoading(true);
        try {
            let resp: Response;
            try {
                resp = await fetch('/teacher/students', {
                    headers: { 'Authorization': token }
                });
            } catch {
                resp = await fetch('http://localhost:8080/teacher/students', {
                    headers: { 'Authorization': token }
                });
            }
            if (resp.ok) {
                const data = await resp.json();
                setStudents(data || []);
            }
        } catch (err) {
            console.error('Failed to fetch students:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStudents();
    }, [token]);

    const handleEnrollStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmail.trim() || !newPassword || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const payload = {
                email: newEmail.trim(),
                username: newUsername.trim() || newEmail.split('@')[0],
                password: newPassword
            };
            let resp: Response;
            try {
                resp = await fetch('/teacher/students', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': token },
                    body: JSON.stringify(payload)
                });
            } catch {
                resp = await fetch('http://localhost:8080/teacher/students', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': token },
                    body: JSON.stringify(payload)
                });
            }
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.error || `Server responded with ${resp.status}`);
            }
            onMessage(`Studentský účet ${newEmail} byl úspěšně zaregistrován`);
            setNewEmail('');
            setNewUsername('');
            setNewPassword('');
            setShowEnrollForm(false);
            await fetchStudents();
        } catch (err: any) {
            onMessage(`Nepodařilo se zaregistrovat studenta: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h3 style={{ margin: 0 }}>Třída a studentské účty ({students.length})</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                        Správa přístupů studentů, přehled přidělených zdrojů a přiřazování laboratoří
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                        className="btn btn-primary btn-sm"
                        onClick={() => setShowEnrollForm(prev => !prev)}
                    >
                        {showEnrollForm ? 'Zrušit' : '+ Zapsat studenta'}
                    </button>
                    <button 
                        className="btn btn-secondary btn-sm"
                        onClick={fetchStudents}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Obnovování...' : 'Obnovit'}
                    </button>
                </div>
            </div>

            {showEnrollForm && (
                <div style={{ padding: '16px', backgroundColor: 'var(--card-bg-subtle)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                    <h4 style={{ margin: '0 0 12px 0' }}>Zapsat nového studenta</h4>
                    <form onSubmit={handleEnrollStudent}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', alignItems: 'flex-end' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>E-mailová adresa</label>
                                <input 
                                    type="email"
                                    value={newEmail}
                                    onChange={e => setNewEmail(e.target.value)}
                                    placeholder="student@skola.cz"
                                    required
                                />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>Uživatelské jméno (volitelné)</label>
                                <input 
                                    type="text"
                                    value={newUsername}
                                    onChange={e => setNewUsername(e.target.value)}
                                    placeholder="student_login"
                                />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>Počáteční heslo</label>
                                <input 
                                    type="password"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    placeholder="Dočasné heslo"
                                    required
                                />
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                                {isSubmitting ? 'Registrace...' : 'Vytvořit účet'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <table className="vm-table">
                <thead>
                    <tr>
                        <th>E-mail / Student</th>
                        <th>UUID</th>
                        <th>Role</th>
                        <th>Přiřazené VM</th>
                        <th>Běží</th>
                        <th>Aktivní laboratoře</th>
                    </tr>
                </thead>
                <tbody>
                    {students.map(st => (
                        <tr key={st.uuid || st.email}>
                            <td className="fw-500">{st.email}</td>
                            <td style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)' }}>
                                {st.uuid ? st.uuid.slice(0, 8) + '...' : '-'}
                            </td>
                            <td>
                                <span className={`status-badge ${st.role === 'teacher' ? 'status-running' : 'status-stopped'}`}>
                                    {st.role === 'teacher' ? 'Učitel' : 'Student'}
                                </span>
                            </td>
                            <td><strong>{st.vm_count || 0}</strong> VM</td>
                            <td>{st.running_vms || 0} běží</td>
                            <td>{st.lab_count || 0} laboratoří</td>
                        </tr>
                    ))}
                    {students.length === 0 && (
                        <tr>
                            <td colSpan={6} className="text-center text-muted" style={{ padding: '24px' }}>
                                Nebyly nalezeny žádné studentské účty.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

