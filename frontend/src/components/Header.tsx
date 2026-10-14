interface HeaderProps {
    currentUser: string;
    showNetworkMap: boolean;
    onToggleNetworkMap: () => void;
    onLogout: () => void;
}

export function Header({ currentUser, showNetworkMap, onToggleNetworkMap, onLogout }: HeaderProps) {
    return (
        <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Virtual Machine Manager</h2>
            <div style={{ display: 'flex', alignItems: 'center' }}>
                {currentUser && (
                    <span className="user-badge" title="Authenticated session">
                        <span className="user-badge-icon">&#9679;</span>
                        {currentUser}
                    </span>
                )}
                <button 
                    className="btn btn-primary btn-sm" 
                    onClick={onToggleNetworkMap} 
                    style={{ marginRight: '8px' }}
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
