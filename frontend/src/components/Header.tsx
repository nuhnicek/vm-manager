interface HeaderProps {
    currentUser: string;
    userRole?: string;
    showNetworkMap: boolean;
    onToggleNetworkMap: () => void;
    onLogout: () => void;
}

export function Header({ currentUser, userRole, showNetworkMap, onToggleNetworkMap, onLogout }: HeaderProps) {
    return (
        <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Virtual Machine Manager</h2>
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
