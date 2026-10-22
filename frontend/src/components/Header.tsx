interface HeaderProps {
    currentUser: string;
    userRole?: string;
    currentView: 'student' | 'teacher';
    onViewChange: (view: 'student' | 'teacher') => void;
    showNetworkMap: boolean;
    onToggleNetworkMap: () => void;
    onLogout: () => void;
}

export function Header({
    currentUser,
    userRole,
    currentView,
    onViewChange,
    showNetworkMap,
    onToggleNetworkMap,
    onLogout
}: HeaderProps) {
    const isTeacher = userRole === 'teacher';

    return (
        <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <h2 style={{ margin: 0 }}>Virtual Machine Manager</h2>
                {isTeacher && (
                    <div style={{ display: 'flex', background: '#e5e7eb', padding: '3px', borderRadius: '6px', gap: '4px' }}>
                        <button 
                            className={`btn btn-sm ${currentView === 'student' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => onViewChange('student')}
                            style={{ padding: '3px 10px', fontSize: '12px' }}
                        >
                            My VMs
                        </button>
                        <button 
                            className={`btn btn-sm ${currentView === 'teacher' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => onViewChange('teacher')}
                            style={{ padding: '3px 10px', fontSize: '12px' }}
                        >
                            Teacher Dashboard
                        </button>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {currentUser && (
                    <span className="user-badge" title="Authenticated session">
                        <span className="user-badge-icon">&#9679;</span>
                        {currentUser}
                    </span>
                )}
                {userRole && (
                    <span 
                        className={`status-badge ${userRole === 'teacher' ? 'status-running' : 'status-stopped'}`}
                        style={{ textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px' }}
                    >
                        {userRole}
                    </span>
                )}
                <button 
                    className="btn btn-primary btn-sm" 
                    onClick={onToggleNetworkMap} 
                >
                    {showNetworkMap ? 'Hide Network Map' : 'View Network Map'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={onLogout}>
                    Logout
                </button>
            </div>
        </header>
    );
}
