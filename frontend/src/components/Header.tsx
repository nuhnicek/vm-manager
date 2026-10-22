interface HeaderProps {
    currentUser: string;
    userRole?: string;
    currentView: 'student' | 'teacher';
    onViewChange: (view: 'student' | 'teacher') => void;
    showNetworkMap: boolean;
    onToggleNetworkMap: () => void;
    theme: 'light' | 'dark';
    onToggleTheme: () => void;
    onLogout: () => void;
}

export function Header({
    currentUser,
    userRole,
    currentView,
    onViewChange,
    showNetworkMap,
    onToggleNetworkMap,
    theme,
    onToggleTheme,
    onLogout
}: HeaderProps) {
    const isTeacher = userRole === 'teacher';

    return (
        <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary-color)' }}>
                        <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                        <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                        <line x1="6" y1="6" x2="6.01" y2="6"></line>
                        <line x1="6" y1="18" x2="6.01" y2="18"></line>
                    </svg>
                    <h2 style={{ margin: 0 }}>Správce Virtuálních Strojů</h2>
                </div>

                {isTeacher && (
                    <div style={{ display: 'flex', background: 'var(--card-bg-subtle)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-color)', gap: '2px' }}>
                        <button 
                            className={`btn btn-sm ${currentView === 'student' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => onViewChange('student')}
                        >
                            Moje VM
                        </button>
                        <button 
                            className={`btn btn-sm ${currentView === 'teacher' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => onViewChange('teacher')}
                        >
                            Učitelský Panel
                        </button>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {currentUser && (
                    <span className="user-badge" title="Přihlášená relace">
                        <span className="user-badge-dot"></span>
                        {currentUser}
                    </span>
                )}
                {isTeacher && (
                    <span className="status-badge status-running">
                        <span className="status-badge-dot"></span>
                        UČITEL
                    </span>
                )}
                <button 
                    className="theme-toggle-btn"
                    onClick={onToggleTheme}
                    title={theme === 'dark' ? 'Přepnout na světlý režim' : 'Přepnout na tmavý režim'}
                >
                    {theme === 'dark' ? (
                        <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="5"></circle>
                                <line x1="12" y1="1" x2="12" y2="3"></line>
                                <line x1="12" y1="21" x2="12" y2="23"></line>
                                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                                <line x1="1" y1="12" x2="3" y2="12"></line>
                                <line x1="21" y1="12" x2="23" y2="12"></line>
                                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                            </svg>
                            Světlý
                        </>
                    ) : (
                        <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                            </svg>
                            Tmavý
                        </>
                    )}
                </button>
                <button 
                    className="btn btn-secondary btn-sm" 
                    onClick={onToggleNetworkMap} 
                >
                    {showNetworkMap ? 'Skrýt síťovou mapu' : 'Zobrazit síťovou mapu'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={onLogout}>
                    Odhlásit se
                </button>
            </div>
        </header>
    );
}
