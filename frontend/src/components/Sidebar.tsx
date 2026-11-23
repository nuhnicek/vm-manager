import { ReactNode } from 'react';

export type AppSection = 'vms' | 'labs' | 'templates' | 'fleet' | 'students';

interface SidebarProps {
    section: AppSection;
    onSectionChange: (s: AppSection) => void;
    isTeacher: boolean;
    vmCount: number;
    currentUser: string;
    userRole?: string;
    theme: 'light' | 'dark';
    onToggleTheme: () => void;
    onOpenNetworkMap: () => void;
    onLogout: () => void;
    hasUpdate?: boolean;
    updateVersion?: string;
    onOpenUpdate?: () => void;
    onCheckUpdate?: () => void;
    isCheckingUpdate?: boolean;
    onOpenConfig?: () => void;
    activeEnvName?: string;
}

const Icon = ({ children }: { children: ReactNode }) => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
    </svg>
);

const icons = {
    vms: <Icon><rect x="2" y="3" width="20" height="7" rx="1.5" /><rect x="2" y="14" width="20" height="7" rx="1.5" /><circle cx="6" cy="6.5" r="0.6" fill="currentColor" /><circle cx="6" cy="17.5" r="0.6" fill="currentColor" /></Icon>,
    labs: <Icon><path d="M9 3h6" /><path d="M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3" /><path d="M7 15h10" /></Icon>,
    templates: <Icon><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="8" rx="1" /><rect x="3" y="13" width="8" height="8" rx="1" /><path d="M17 13v8M13 17h8" /></Icon>,
    fleet: <Icon><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M8 20h8M12 16v4" /><path d="M7 8h4M7 11h2" /></Icon>,
    students: <Icon><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 20a6.5 6.5 0 0 0-3-5.5" /></Icon>,
    map: <Icon><circle cx="5" cy="6" r="2.5" /><circle cx="19" cy="6" r="2.5" /><circle cx="12" cy="18" r="2.5" /><path d="M7.5 6h9M6.3 8.2l4.4 7.6M17.7 8.2l-4.4 7.6" /></Icon>,
    env: <Icon><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></Icon>,
    update: <Icon><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5M12 15V3" /></Icon>,
    check: <Icon><path d="M21 12a9 9 0 1 1-2.6-6.4L21 8" /><path d="M21 3v5h-5" /></Icon>,
    sun: <Icon><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Icon>,
    moon: <Icon><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" /></Icon>,
    logout: <Icon><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></Icon>,
};

export function Sidebar(props: SidebarProps) {
    const {
        section, onSectionChange, isTeacher, vmCount, currentUser, userRole,
        theme, onToggleTheme, onOpenNetworkMap, onLogout,
        hasUpdate, updateVersion, onOpenUpdate, onCheckUpdate, isCheckingUpdate,
        onOpenConfig, activeEnvName,
    } = props;

    const link = (id: AppSection, label: string, count?: number) => (
        <button
            type="button"
            className={`sidebar-link${section === id ? ' active' : ''}`}
            onClick={() => onSectionChange(id)}
            aria-current={section === id ? 'page' : undefined}
            title={label}
        >
            {icons[id]}
            <span>{label}</span>
            {count !== undefined && <em className="sidebar-link-count" style={{ fontStyle: 'normal' }}>{count}</em>}
        </button>
    );

    return (
        <nav className="sidebar" aria-label="Hlavní navigace">
            <div className="sidebar-brand">
                <div className="sidebar-brand-mark" aria-hidden="true">
                    <span className="on" /><span className="on" /><span className="amber" />
                    <span className="on" /><span /><span className="on" />
                </div>
                <span className="sidebar-brand-name">Lab411</span>
            </div>

            <div className="sidebar-section">
                {link('vms', 'Moje stroje', vmCount)}
                <button type="button" className="sidebar-link" onClick={onOpenNetworkMap} title="Síťová mapa">
                    {icons.map}
                    <span>Síťová mapa</span>
                </button>
            </div>

            {isTeacher && (
                <div className="sidebar-section">
                    <div className="sidebar-section-title">Výuka</div>
                    {link('labs', 'Laboratoře')}
                    {link('students', 'Třída a studenti')}
                    {link('templates', 'Šablony')}
                    {link('fleet', 'Cluster a uzly')}
                </div>
            )}

            <div className="sidebar-footer">
                {hasUpdate ? (
                    <button type="button" className="sidebar-link update" onClick={onOpenUpdate} title="Nainstalovat aktualizaci">
                        {icons.update}
                        <span>Aktualizovat{updateVersion ? ` na ${updateVersion}` : ''}</span>
                    </button>
                ) : onCheckUpdate && (
                    <button type="button" className="sidebar-link" onClick={onCheckUpdate} disabled={isCheckingUpdate} title="Zkontrolovat aktualizace">
                        <span style={{ display: 'inline-flex', animation: isCheckingUpdate ? 'spin 1s linear infinite' : 'none' }}>{icons.check}</span>
                        <span>{isCheckingUpdate ? 'Kontroluji…' : 'Zkontrolovat aktualizace'}</span>
                    </button>
                )}
                {onOpenConfig && (
                    <button type="button" className="sidebar-link" onClick={onOpenConfig} title="Prostředí a nastavení">
                        {icons.env}
                        <span>Prostředí: {activeEnvName || 'Lab 411'}</span>
                    </button>
                )}
                <button type="button" className="sidebar-link" onClick={onToggleTheme} title={theme === 'dark' ? 'Světlý režim' : 'Tmavý režim'}>
                    {theme === 'dark' ? icons.sun : icons.moon}
                    <span>{theme === 'dark' ? 'Světlý režim' : 'Tmavý režim'}</span>
                </button>

                <div className="sidebar-user" title={currentUser}>
                    {currentUser || 'Nepřihlášený uživatel'}
                    <small>{userRole === 'teacher' ? 'Učitel' : 'Student'}</small>
                </div>
                <button type="button" className="sidebar-link" onClick={onLogout} title="Odhlásit se">
                    {icons.logout}
                    <span>Odhlásit se</span>
                </button>
            </div>
        </nav>
    );
}
