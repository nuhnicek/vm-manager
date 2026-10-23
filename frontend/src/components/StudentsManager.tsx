import { useState, useEffect } from 'react';
import { TeacherStudentInfo } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface StudentsManagerProps {
    token: string;
    onMessage: (msg: string) => void;
    onViewStudentVMs?: (studentEmail: string) => void;
    onDeployLabForStudent?: (studentUUID: string) => void;
}

export function StudentsManager({ 
    token, 
    onMessage, 
    onViewStudentVMs,
    onDeployLabForStudent 
}: StudentsManagerProps) {
    const [students, setStudents] = useState<TeacherStudentInfo[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showEnrollForm, setShowEnrollForm] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [newEmail, setNewEmail] = useState('');
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState<'student' | 'teacher'>('student');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [resetPasswordStudent, setResetPasswordStudent] = useState<TeacherStudentInfo | null>(null);
    const [newResetPassword, setNewResetPassword] = useState('');
    const [isResettingPassword, setIsResettingPassword] = useState(false);

    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        message: '',
        onConfirm: () => {}
    });

    const fetchStudents = async () => {
        setIsLoading(true);
        try {
            let resp: Response;
            try {
                resp = await fetch('/teacher/students', {
                    headers: { 'Authorization': token }
                });
            } catch {
                resp = await fetch('http://10.0.10.52:8080/teacher/students', {
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
                password: newPassword,
                role: newRole
            };
            let resp: Response;
            try {
                resp = await fetch('/teacher/students', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': token },
                    body: JSON.stringify(payload)
                });
            } catch {
                resp = await fetch('http://10.0.10.52:8080/teacher/students', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': token },
                    body: JSON.stringify(payload)
                });
            }
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.error || `Server responded with ${resp.status}`);
            }
            onMessage(`Účet ${newEmail} (${newRole === 'teacher' ? 'Učitel' : 'Student'}) byl úspěšně vytvořen`);
            setNewEmail('');
            setNewUsername('');
            setNewPassword('');
            setShowEnrollForm(false);
            await fetchStudents();
        } catch (err: any) {
            onMessage(`Nepodařilo se vytvořit účet: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteStudent = (st: TeacherStudentInfo) => {
        setConfirmDialog({
            isOpen: true,
            message: `Opravdu chcete SMAZAT uživatelský účet ${st.email}? Tento krok smaže přístupové údaje.`,
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                try {
                    let resp: Response;
                    try {
                        resp = await fetch(`/teacher/students/${st.uuid}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': token }
                        });
                    } catch {
                        resp = await fetch(`http://10.0.10.52:8080/teacher/students/${st.uuid}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': token }
                        });
                    }
                    if (!resp.ok) {
                        const err = await resp.json().catch(() => ({}));
                        throw new Error(err.error || `Server responded with ${resp.status}`);
                    }
                    onMessage(`Účet ${st.email} byl úspěšně odstraněn`);
                    await fetchStudents();
                } catch (err: any) {
                    onMessage(`Smazání účtu selhalo: ${err.message}`);
                }
            }
        });
    };

    const handleResetPasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resetPasswordStudent || !newResetPassword || isResettingPassword) return;
        setIsResettingPassword(true);
        try {
            let resp: Response;
            const payload = { password: newResetPassword };
            try {
                resp = await fetch(`/teacher/students/${resetPasswordStudent.uuid}/reset-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': token },
                    body: JSON.stringify(payload)
                });
            } catch {
                resp = await fetch(`http://10.0.10.52:8080/teacher/students/${resetPasswordStudent.uuid}/reset-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': token },
                    body: JSON.stringify(payload)
                });
            }
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.error || `Server responded with ${resp.status}`);
            }
            onMessage(`Heslo pro ${resetPasswordStudent.email} bylo úspěšně změněno`);
            setResetPasswordStudent(null);
            setNewResetPassword('');
        } catch (err: any) {
            onMessage(`Změna hesla selhala: ${err.message}`);
        } finally {
            setIsResettingPassword(false);
        }
    };

    const filteredStudents = students.filter(st => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return st.email.toLowerCase().includes(q) || (st.uuid || '').toLowerCase().includes(q);
    });

    const totalStudents = students.filter(s => s.role !== 'teacher').length;
    const totalAssignedVMs = students.reduce((acc, s) => acc + (s.vm_count || 0), 0);
    const totalRunningVMs = students.reduce((acc, s) => acc + (s.running_vms || 0), 0);

    return (
        <div className="card">
            <ConfirmModal 
                isOpen={confirmDialog.isOpen}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
            />

            {resetPasswordStudent && (
                <div className="modal-backdrop" onClick={() => setResetPasswordStudent(null)}>
                    <div className="modal" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
                        <h3>Resetovat heslo pro {resetPasswordStudent.email}</h3>
                        <form onSubmit={handleResetPasswordSubmit}>
                            <div className="form-group" style={{ marginBottom: '14px' }}>
                                <label>Nové heslo</label>
                                <input 
                                    type="password"
                                    value={newResetPassword}
                                    onChange={e => setNewResetPassword(e.target.value)}
                                    placeholder="Zadejte nové silné heslo"
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="modal-actions">
                                <button 
                                    type="button" 
                                    className="btn btn-secondary" 
                                    onClick={() => setResetPasswordStudent(null)}
                                    disabled={isResettingPassword}
                                >
                                    Zrušit
                                </button>
                                <button 
                                    type="submit" 
                                    className="btn btn-primary"
                                    disabled={!newResetPassword || isResettingPassword}
                                >
                                    {isResettingPassword ? 'Ukládání...' : 'Nastavit heslo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h3 style={{ margin: 0 }}>Třída a studentské účty ({students.length})</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                        Správa přístupových účtů, přehled přidělených zdrojů a kontrola studentských relací
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                        className="btn btn-primary btn-sm"
                        onClick={() => setShowEnrollForm(prev => !prev)}
                    >
                        {showEnrollForm ? 'Zavřít formulář' : '+ Vytvořit nový účet'}
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

            <div className="stats-banner">
                <div className="stat-box">
                    <span className="stat-box-label">Zapsaní studenti</span>
                    <span className="stat-box-val">{totalStudents}</span>
                </div>
                <div className="stat-box">
                    <span className="stat-box-label">Přidělené stroje</span>
                    <span className="stat-box-val">{totalAssignedVMs} VM</span>
                </div>
                <div className="stat-box">
                    <span className="stat-box-label">Aktivní běžící VM</span>
                    <span className="stat-box-val" style={{ color: 'var(--success-color)' }}>{totalRunningVMs}</span>
                </div>
                <div className="stat-box">
                    <span className="stat-box-label">Vyučující účty</span>
                    <span className="stat-box-val">{students.length - totalStudents}</span>
                </div>
            </div>

            {showEnrollForm && (
                <div style={{ padding: '16px', backgroundColor: 'var(--card-bg-subtle)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '18px' }}>
                    <h4 style={{ margin: '0 0 12px 0' }}>Vytvořit nový uživatelský účet</h4>
                    <form onSubmit={handleEnrollStudent}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'flex-end', marginBottom: '12px' }}>
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
                                    placeholder="login_student"
                                />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>Počáteční heslo</label>
                                <input 
                                    type="password"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    placeholder="Heslo účtu"
                                    required
                                />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>Role účtu</label>
                                <select 
                                    value={newRole}
                                    onChange={e => setNewRole(e.target.value as any)}
                                >
                                    <option value="student">Student</option>
                                    <option value="teacher">Učitel</option>
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button 
                                type="button" 
                                className="btn btn-secondary btn-sm" 
                                onClick={() => setShowEnrollForm(false)}
                            >
                                Zrušit
                            </button>
                            <button 
                                type="submit" 
                                className="btn btn-primary btn-sm" 
                                disabled={isSubmitting || !newEmail.trim() || !newPassword}
                            >
                                {isSubmitting ? 'Vytváření účtu...' : 'Zaregistrovat účet'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="filter-bar">
                <input 
                    type="text"
                    className="search-input"
                    placeholder="Filtrovat studenty podle e-mailu..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                    <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSearchQuery('')}
                    >
                        Vymazat filtr
                    </button>
                )}
            </div>

            <div className="table-container">
                <table className="vm-table">
                    <thead>
                        <tr>
                            <th>Uživatel / E-mail</th>
                            <th>Role</th>
                            <th>Stroje celkem</th>
                            <th>Běží</th>
                            <th>Aktivní laboratoře</th>
                            <th>Rychlé akce</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredStudents.map(st => (
                            <tr key={st.uuid || st.email}>
                                <td>
                                    <div className="fw-500">{st.email}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                        UUID: <span className="mono-tag">{st.uuid ? st.uuid.slice(0, 8) + '...' : '-'}</span>
                                    </div>
                                </td>
                                <td>
                                    <span className={`status-badge ${st.role === 'teacher' ? 'status-running' : 'status-stopped'}`}>
                                        <span className="status-badge-dot"></span>
                                        {st.role === 'teacher' ? 'Učitel' : 'Student'}
                                    </span>
                                </td>
                                <td>
                                    <strong>{st.vm_count || 0}</strong> VM
                                </td>
                                <td>
                                    <span style={{ color: (st.running_vms || 0) > 0 ? 'var(--success-color)' : 'inherit', fontWeight: (st.running_vms || 0) > 0 ? 600 : 'normal' }}>
                                        {st.running_vms || 0} běží
                                    </span>
                                </td>
                                <td>{st.lab_count || 0} laboratoří</td>
                                <td>
                                    <div className="action-buttons">
                                        {onViewStudentVMs && (
                                            <button 
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => onViewStudentVMs(st.email)}
                                                title="Filtrovat a zobrazit virtuální stroje tohoto studenta v clusteru"
                                            >
                                                Zobrazit VM ({st.vm_count || 0})
                                            </button>
                                        )}
                                        {onDeployLabForStudent && (
                                            <button 
                                                className="btn btn-primary btn-sm"
                                                onClick={() => onDeployLabForStudent(st.uuid)}
                                                title="Nasadit laboratorní scénář pro tohoto studenta"
                                            >
                                                Nasadit lab
                                            </button>
                                        )}
                                        <button 
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => {
                                                setResetPasswordStudent(st);
                                                setNewResetPassword('');
                                            }}
                                            title="Nastavit studentovi nové heslo"
                                        >
                                            Heslo
                                        </button>
                                        <button 
                                            className="btn btn-danger btn-sm"
                                            onClick={() => handleDeleteStudent(st)}
                                            title="Smazat uživatelský účet"
                                        >
                                            Smazat
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredStudents.length === 0 && (
                            <tr>
                                <td colSpan={6} className="text-center text-muted" style={{ padding: '24px' }}>
                                    Nebyly nalezeny žádné uživatelské účty odpovídající filtru.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
