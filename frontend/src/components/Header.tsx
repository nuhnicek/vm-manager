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
    hasUpdate?: boolean;
    updateVersion?: string;
    onOpenUpdate?: () => void;
    onCheckUpdate?: () => void;
    isCheckingUpdate?: boolean;
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
    onLogout,
    hasUpdate,
    updateVersion,
    onOpenUpdate,
    onCheckUpdate,
    isCheckingUpdate
}: HeaderProps) {
    const isTeacher = userRole === 'teacher';

    return (
        <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h2 style={{ margin: 0 }}>Lab411</h2>
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
                {hasUpdate ? (
                    <button
                        className="btn btn-sm"
                        onClick={onOpenUpdate}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: '#fff',
                            border: 'none',
                            fontWeight: 600,
                            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)',
                            cursor: 'pointer'
                        }}
                        title="Klikněte pro stažení a instalaci aktualizace"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Aktualizovat {updateVersion ? `(${updateVersion})` : ''}
                    </button>
                ) : (
                    onCheckUpdate && (
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={onCheckUpdate}
                            disabled={isCheckingUpdate}
                            title="Zkontrolovat novou verzi aplikace na GitHubu"
                            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: isCheckingUpdate ? 'spin 1s linear infinite' : 'none' }}>
                                <polyline points="23 4 23 10 17 10"></polyline>
                                <polyline points="1 20 1 14 7 14"></polyline>
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                            </svg>
                            {isCheckingUpdate ? 'Ověřuji...' : 'Aktualizace'}
                        </button>
                    )
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
