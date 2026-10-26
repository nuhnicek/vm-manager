import { useState, useMemo } from 'react';
import { main } from '../../wailsjs/go/models';
import { Project } from '../types';
import { MoveVMToProjectModal } from './MoveVMToProjectModal';
import { ExternalVNCModal } from './ExternalVNCModal';

interface VMTableProps {
    vms: main.VM[];
    projects?: Project[];
    selectedProjectId?: string;
    userRole?: string;
    isRefreshing: boolean;
    onRefresh: () => void;
    onStartVM: (id: string, name: string, node?: string) => void;
    onStopVM: (id: string, name: string, node?: string) => void;
    onOpenConsole: (id: string, node?: string) => void;
    onManageNetworking: (vm: main.VM) => void;
    onDeleteVM: (id: string, name: string, node?: string) => void;
    onSelectProject?: (projectId: string) => void;
    onCreateProjectClick?: () => void;
    onEditProjectClick?: (project: Project) => void;
    onDeleteProjectClick?: (project: Project) => void;
    onManageProjectVMsClick?: (project: Project) => void;
    onAssignVMProject?: (vmId: number, projectId: string) => Promise<void>;
    onCreateVMClick?: () => void;
    onSetIPClick?: (vm: main.VM) => void;
    onOpenCatalogClick?: () => void;
    onConnectLabNetwork?: (vm: main.VM) => void;
    onDisconnectLabNetwork?: (vm: main.VM) => void;
    pendingActions?: Record<string, string>;
}

export function VMTable({
    vms,
    projects = [],
    selectedProjectId = 'all',
    userRole,
    isRefreshing,
    onRefresh,
    onStartVM,
    onStopVM,
    onOpenConsole,
    onManageNetworking,
    onDeleteVM,
    onSelectProject,
    onCreateProjectClick,
    onEditProjectClick,
    onDeleteProjectClick,
    onManageProjectVMsClick,
    onAssignVMProject,
    onCreateVMClick,
    onSetIPClick,
    onOpenCatalogClick,
    onConnectLabNetwork,
    onDisconnectLabNetwork,
    pendingActions = {},
}: VMTableProps) {
    const isTeacher = userRole === 'teacher';
    const [searchQuery, setSearchQuery] = useState('');
    const [isGroupedView, setIsGroupedView] = useState(false);
    const [movingVM, setMovingVM] = useState<main.VM | null>(null);
    const [selectedCVEVM, setSelectedCVEVM] = useState<main.VM | null>(null);
    const [copiedCmd, setCopiedCmd] = useState(false);
    const [typeFilter, setTypeFilter] = useState<'all' | 'qemu' | 'lxc' | 'cve' | 'vulnerable'>('all');
    const [externalVNCVM, setExternalVNCVM] = useState<main.VM | null>(null);

    const activeProject = useMemo(() => {
        if (!selectedProjectId || selectedProjectId === 'all' || selectedProjectId === 'none') {
            return null;
        }
        return projects.find(p => p.id === selectedProjectId) || null;
    }, [projects, selectedProjectId]);

    const projectCounts = useMemo(() => {
        const counts: Record<string, number> = {
            all: vms.length,
            none: 0
        };

        projects.forEach(p => {
            counts[p.id] = 0;
        });

        vms.forEach(vm => {
            const pid = (vm as any).project_id;
            if (pid && counts[pid] !== undefined) {
                counts[pid]++;
            } else {
                counts.none++;
            }
        });

        return counts;
    }, [vms, projects]);

    const filteredVMs = useMemo(() => {
        return vms.filter(vm => {
            if (typeFilter === 'lxc' && vm.type !== 'lxc') return false;
            if (typeFilter === 'qemu' && vm.type === 'lxc') return false;
            if (typeFilter === 'cve' && !(vm as any).cve_id && !vm.is_vulnerable) return false;
            if (typeFilter === 'vulnerable' && !vm.is_vulnerable) return false;

            const matchesSearch = 
                !searchQuery.trim() ||
                vm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                String(vm.id).includes(searchQuery) ||
                ((vm as any).cve_id && (vm as any).cve_id.toLowerCase().includes(searchQuery.toLowerCase())) ||
                ((vm as any).node && (vm as any).node.toLowerCase().includes(searchQuery.toLowerCase())) ||
                ((vm as any).ip_address && (vm as any).ip_address.toLowerCase().includes(searchQuery.toLowerCase())) ||
                ((vm as any).configured_ip && (vm as any).configured_ip.toLowerCase().includes(searchQuery.toLowerCase())) ||
                ((vm as any).project_name && (vm as any).project_name.toLowerCase().includes(searchQuery.toLowerCase()));

            if (!matchesSearch) return false;

            if (selectedProjectId === 'all' || !selectedProjectId) {
                return true;
            }
            if (selectedProjectId === 'none') {
                return !(vm as any).project_id;
            }
            return (vm as any).project_id === selectedProjectId;
        });
    }, [vms, searchQuery, selectedProjectId, typeFilter]);

    const groupedData = useMemo(() => {
        const groups: { project: Project | null; vms: main.VM[] }[] = [];

        projects.forEach(p => {
            const projVMs = filteredVMs.filter(v => (v as any).project_id === p.id);
            groups.push({ project: p, vms: projVMs });
        });

        const unassignedVMs = filteredVMs.filter(v => !(v as any).project_id);
        if (unassignedVMs.length > 0 || projects.length === 0) {
            groups.push({ project: null, vms: unassignedVMs });
        }

        return groups;
    }, [filteredVMs, projects]);

    const renderVMRows = (list: main.VM[]) => {
        if (list.length === 0) {
            return (
                <tr>
                    <td colSpan={isTeacher ? 9 : 7} className="text-center text-muted" style={{ padding: '24px' }}>
                        <div>Nebyly nalezeny žádné virtuální stroje ani kontejnery pro toto zobrazení.</div>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '10px' }}>
                            {onOpenCatalogClick && (
                                <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={onOpenCatalogClick}
                                >
                                    Otevřít katalog & rychlé kontejnery
                                </button>
                            )}
                            {onCreateVMClick && (
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={onCreateVMClick}
                                >
                                    + Vytvořit ze šablony
                                </button>
                            )}
                        </div>
                    </td>
                </tr>
            );
        }

        return list.map(vm => {
            const pendingAction = pendingActions[String(vm.id)];
            const isStarting = pendingAction === 'starting';
            const isStopping = pendingAction === 'stopping';
            const isDeleting = pendingAction === 'deleting';
            const isConnectingLab = pendingAction === 'lab_connect';
            const isDisconnectingLab = pendingAction === 'lab_disconnect';
            const isRunning = vm.status === 'Running' || vm.status === 'running';
            const isLXC = vm.type === 'lxc';
            const projName = (vm as any).project_name;
            const projColor = (vm as any).project_color || 'var(--primary-color)';

            return (
                <tr key={`${(vm as any).node || 'pve'}-${vm.id}`}>
                    <td>
                        <span className="mono-tag" style={{ fontWeight: 600, color: 'var(--primary-color)' }}>
                            {vm.id}
                        </span>
                    </td>
                    <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span className="fw-500">{vm.name}</span>
                            <span style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: isLXC ? 'rgba(59, 130, 246, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                                color: isLXC ? '#3b82f6' : '#a855f7'
                            }}>
                                {isLXC ? 'LXC' : 'VM'}
                            </span>
                            {(vm as any).cve_id ? (
                                <button
                                    type="button"
                                    onClick={() => setSelectedCVEVM(vm)}
                                    title="Zobrazit detail zranitelnosti a návod"
                                    style={{
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '10px',
                                        fontWeight: 700,
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        background: 'rgba(239, 68, 68, 0.15)',
                                        color: '#ef4444'
                                    }}
                                >
                                    {(vm as any).cve_id}
                                </button>
                            ) : vm.is_vulnerable ? (
                                <span style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    color: '#ef4444'
                                }}>
                                    ZRANITELNÝ
                                </span>
                            ) : null}
                            {(vm as any).cvss && (
                                <span style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: 'rgba(245, 158, 11, 0.15)',
                                    color: '#f59e0b'
                                }}>
                                    {(vm as any).cvss}
                                </span>
                            )}
                            {(vm as any).is_attacker && (
                                <span style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: 'rgba(249, 115, 22, 0.15)',
                                    color: '#f97316'
                                }}>
                                    ÚTOČNÍK
                                </span>
                            )}
                            {(vm as any).has_internet && (
                                <span style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    color: '#10b981'
                                }}>
                                    INTERNET
                                </span>
                            )}
                        </div>
                    </td>
                    <td>
                        {projName ? (
                            <button
                                type="button"
                                className="project-badge"
                                onClick={() => setMovingVM(vm)}
                                title="Kliknutím změníte projekt stroje"
                                style={{ borderColor: projColor }}
                            >
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: projColor, display: 'inline-block' }}></span>
                                <span>{projName}</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                className="project-badge text-muted"
                                onClick={() => setMovingVM(vm)}
                                title="Kliknutím přiřadíte stroj k projektu"
                                style={{ borderStyle: 'dashed' }}
                            >
                                + Přiřadit projekt
                            </button>
                        )}
                    </td>
                    {isTeacher && (
                        <td>
                            <span className="mono-tag">
                                {(vm as any).node || 'pve'}
                            </span>
                        </td>
                    )}
                    {isTeacher && (
                        <td style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                            {(vm as any).owner ? (vm as any).owner.slice(0, 8) + '...' : 'Systém'}
                        </td>
                    )}
                    <td>
                        <span className={`status-badge ${isRunning ? 'status-running' : 'status-stopped'}`}>
                            {isRunning ? 'BĚŽÍ' : 'ZASTAVENO'}
                        </span>
                    </td>
                    <td>
                        {vm.ip_address ? (
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', flexShrink: 0 }}></span>
                                    <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 600 }}>{vm.ip_address}</span>
                                    <button
                                        type="button"
                                        onClick={() => navigator.clipboard.writeText(vm.ip_address!)}
                                        title="Zkopírovat IP adresu do schránky"
                                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px', color: 'var(--text-muted)', display: 'inline-flex' }}
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                        </svg>
                                    </button>
                                    {onSetIPClick && (
                                        <button
                                            type="button"
                                            onClick={() => onSetIPClick(vm)}
                                            title="Upravit konfiguraci IP"
                                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px', color: 'var(--text-muted)', display: 'inline-flex' }}
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                            </svg>
                                        </button>
                                    )}
                                </div>
                                {vm.configured_ip && vm.configured_ip.toLowerCase() !== 'dhcp' && vm.configured_ip !== vm.ip_address && (
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        konfig: {vm.configured_ip}
                                    </div>
                                )}
                            </div>
                        ) : vm.configured_ip ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-muted)' }}>{vm.configured_ip}</span>
                                {onSetIPClick && (
                                    <button
                                        type="button"
                                        onClick={() => onSetIPClick(vm)}
                                        title="Upravit IP adresu"
                                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px', color: 'var(--text-muted)', display: 'inline-flex' }}
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                        </svg>
                                    </button>
                                )}
                            </div>
                        ) : onSetIPClick ? (
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '11px', padding: '2px 8px' }}
                                onClick={() => onSetIPClick(vm)}
                            >
                                + Nastavit IP
                            </button>
                        ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>-</span>
                        )}
                    </td>
                    <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {(vm as any).has_internet && (
                                <span style={{ fontSize: '11px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', flexShrink: 0 }}></span>
                                    <span>Lab Síť (Internet)</span>
                                </span>
                            )}
                            {vm.connections && vm.connections.length > 0 ? (
                                vm.connections.map((conn, idx) => (
                                    <span key={idx} style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                                        &rarr; VM {conn.target_vm_id} ({conn.local_nic} &harr; {conn.target_nic})
                                    </span>
                                ))
                            ) : !(vm as any).has_internet ? (
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Bez propojení</span>
                            ) : null}
                        </div>
                    </td>
                    <td>
                        <div className="action-buttons">
                            {!isRunning ? (
                                <button 
                                    className="btn btn-success btn-sm" 
                                    disabled={isStarting || isStopping || isDeleting}
                                    onClick={() => onStartVM(String(vm.id), vm.name, (vm as any).node)}
                                >
                                    {isStarting && <span className="btn-spinner" />}
                                    {isStarting ? 'Spouštění...' : 'Spustit'}
                                </button>
                            ) : (
                                <button 
                                    className="btn btn-warning btn-sm" 
                                    disabled={isStarting || isStopping || isDeleting}
                                    onClick={() => onStopVM(String(vm.id), vm.name, (vm as any).node)}
                                >
                                    {isStopping && <span className="btn-spinner" />}
                                    {isStopping ? 'Zastavování...' : 'Zastavit'}
                                </button>
                            )}
                            
                            <button 
                                className="btn btn-primary btn-sm" 
                                onClick={() => onOpenConsole(String(vm.id), (vm as any).node)}
                            >
                                Konzole
                            </button>

                            {isRunning && (
                                <button 
                                    className="btn btn-secondary btn-sm" 
                                    onClick={() => setExternalVNCVM(vm)}
                                    title="Připojit se přes externí VNC klient"
                                >
                                    VNC Klient
                                </button>
                            )}

                            <button 
                                className="btn btn-secondary btn-sm" 
                                onClick={() => onManageNetworking(vm)}
                            >
                                Síť
                            </button>

                            {onConnectLabNetwork && onDisconnectLabNetwork && (
                                (vm as any).has_internet ? (
                                    <button 
                                        className="btn btn-secondary btn-sm" 
                                        disabled={isConnectingLab || isDisconnectingLab}
                                        onClick={() => onDisconnectLabNetwork(vm)}
                                        title="Odpojit od laboratorní sítě (Internet)"
                                        style={{ fontSize: '11px', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                                    >
                                        {isDisconnectingLab && <span className="btn-spinner" />}
                                        {isDisconnectingLab ? 'Odpojování...' : 'Odpojit Lab'}
                                    </button>
                                ) : (
                                    <button 
                                        className="btn btn-primary btn-sm" 
                                        disabled={isConnectingLab || isDisconnectingLab}
                                        onClick={() => onConnectLabNetwork(vm)}
                                        title="Připojit stroj k laboratorní síti s internetem pro stahování balíčků a nástrojů"
                                        style={{
                                            fontSize: '11px',
                                            background: (vm as any).is_attacker ? '#f97316' : undefined,
                                            borderColor: (vm as any).is_attacker ? '#f97316' : undefined
                                        }}
                                    >
                                        {isConnectingLab && <span className="btn-spinner" />}
                                        {isConnectingLab ? 'Připojování...' : 'Připojit Lab Síť'}
                                    </button>
                                )
                            )}

                            {onSetIPClick && (
                                <button 
                                    className="btn btn-secondary btn-sm" 
                                    onClick={() => onSetIPClick(vm)}
                                    title="Změnit IP adresu"
                                >
                                    IP
                                </button>
                            )}

                            {((vm as any).cve_id || vm.is_vulnerable) && (
                                <button 
                                    className="btn btn-secondary btn-sm" 
                                    onClick={() => setSelectedCVEVM(vm)}
                                    title="Zobrazit detail CVE a návod"
                                    style={{ borderColor: 'rgba(239, 68, 68, 0.5)', color: '#ef4444' }}
                                >
                                    CVE Návod
                                </button>
                            )}

                            <button 
                                className="btn btn-secondary btn-sm" 
                                onClick={() => setMovingVM(vm)}
                                title="Přiřadit nebo přesunout do jiného projektu"
                            >
                                Projekt
                            </button>
                            
                            <button 
                                className="btn btn-danger btn-sm" 
                                disabled={isDeleting || isStarting || isStopping}
                                onClick={() => onDeleteVM(String(vm.id), vm.name, (vm as any).node)}
                            >
                                {isDeleting && <span className="btn-spinner" />}
                                {isDeleting ? 'Mazání...' : 'Smazat'}
                            </button>
                        </div>
                    </td>
                </tr>
            );
        });
    };

    return (
        <div className="card">
            {movingVM && (
                <MoveVMToProjectModal 
                    isOpen={movingVM !== null}
                    vm={movingVM}
                    projects={projects}
                    onClose={() => setMovingVM(null)}
                    onAssign={async (vmid, pid) => {
                        if (onAssignVMProject) {
                            await onAssignVMProject(vmid, pid);
                        }
                    }}
                    onCreateNewProjectClick={() => {
                        if (onCreateProjectClick) {
                            onCreateProjectClick();
                        }
                    }}
                />
            )}

            {externalVNCVM && (
                <ExternalVNCModal
                    isOpen={externalVNCVM !== null}
                    vmId={externalVNCVM.id}
                    vmName={externalVNCVM.name}
                    vmNode={(externalVNCVM as any).node}
                    onClose={() => setExternalVNCVM(null)}
                />
            )}

            {selectedCVEVM && (
                <div className="modal-backdrop">
                    <div className="modal-content" style={{ maxWidth: '640px', width: '92%' }}>
                        <div className="modal-header">
                            <div>
                                <h3 className="modal-title">
                                    CVE Laboratoř: {(selectedCVEVM as any).cve_id || selectedCVEVM.name}
                                </h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                                    Technická dokumentace a ověření zranitelnosti pro výuku
                                </p>
                            </div>
                            <button
                                type="button"
                                className="close-button"
                                onClick={() => {
                                    setSelectedCVEVM(null);
                                    setCopiedCmd(false);
                                }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>

                        <div style={{ padding: '20px 24px' }}>
                            <div style={{
                                display: 'flex',
                                gap: '8px',
                                alignItems: 'center',
                                marginBottom: '16px',
                                flexWrap: 'wrap'
                            }}>
                                {(selectedCVEVM as any).cve_id && (
                                    <span style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        background: 'rgba(239, 68, 68, 0.15)',
                                        color: '#ef4444'
                                    }}>
                                        {(selectedCVEVM as any).cve_id}
                                    </span>
                                )}
                                {(selectedCVEVM as any).cvss && (
                                    <span style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        background: 'rgba(245, 158, 11, 0.15)',
                                        color: '#f59e0b'
                                    }}>
                                        CVSS: {(selectedCVEVM as any).cvss}
                                    </span>
                                )}
                                {(selectedCVEVM as any).port ? (
                                    <span style={{
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        background: 'rgba(59, 130, 246, 0.15)',
                                        color: '#3b82f6',
                                        fontFamily: 'monospace'
                                    }}>
                                        Port: {(selectedCVEVM as any).port}
                                    </span>
                                ) : null}
                                <span style={{
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    background: 'var(--bg-secondary, rgba(255,255,255,0.05))',
                                    fontFamily: 'monospace'
                                }}>
                                    Cílová IP: {selectedCVEVM.ip_address || (selectedCVEVM as any).configured_ip || 'Zatím nepřidělena'}
                                </span>
                            </div>

                            {(selectedCVEVM as any).exploit_doc && (
                                <div style={{
                                    background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    padding: '12px 14px',
                                    marginBottom: '16px',
                                    fontSize: '13px',
                                    lineHeight: 1.5
                                }}>
                                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                                        Popis a vektor zranitelnosti
                                    </div>
                                    <div>{(selectedCVEVM as any).exploit_doc}</div>
                                </div>
                            )}

                            {(selectedCVEVM as any).exploit_hint && (
                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                            Příkaz pro ověření / PoC
                                        </div>
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            style={{ fontSize: '11px', padding: '3px 8px' }}
                                            onClick={() => {
                                                const cmd = ((selectedCVEVM as any).exploit_hint || '').replace(/\{IP\}/g, selectedCVEVM.ip_address || '<IP>');
                                                navigator.clipboard.writeText(cmd);
                                                setCopiedCmd(true);
                                                setTimeout(() => setCopiedCmd(false), 2000);
                                            }}
                                        >
                                            {copiedCmd ? 'Zkopírováno!' : 'Kopírovat příkaz'}
                                        </button>
                                    </div>
                                    <pre style={{
                                        margin: 0,
                                        padding: '12px 14px',
                                        background: 'rgba(0, 0, 0, 0.4)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                        fontFamily: 'monospace',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-all',
                                        color: '#38bdf8'
                                    }}>
                                        {((selectedCVEVM as any).exploit_hint || '').replace(/\{IP\}/g, selectedCVEVM.ip_address || '<IP>')}
                                    </pre>
                                </div>
                            )}

                            <div style={{
                                background: 'rgba(59, 130, 246, 0.08)',
                                border: '1px solid rgba(59, 130, 246, 0.25)',
                                borderRadius: '8px',
                                padding: '12px 14px',
                                fontSize: '12px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '8px'
                            }}>
                                <div>
                                    <span style={{ color: 'var(--text-muted)' }}>Konzolový / SSH přístup: </span>
                                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>root / toor</span>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--text-muted)' }}>Cílová vlajka (CTF): </span>
                                    <span style={{ fontFamily: 'monospace', color: '#10b981' }}>/root/flag.txt</span>
                                </div>
                            </div>

                            <div className="modal-actions" style={{ marginTop: '20px' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        setSelectedCVEVM(null);
                                        setCopiedCmd(false);
                                    }}
                                >
                                    Zavřít
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                    <h3 style={{ margin: 0 }}>Virtuální stroje a kontejnery ({filteredVMs.length})</h3>
                    <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                        Správa vašich instancí, LXC kontejnerů a bezpečnostních laboratoří
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {onOpenCatalogClick && (
                        <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={onOpenCatalogClick}
                            style={{ background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)', border: 'none' }}
                            title="Rychlé nasazení LXC kontejnerů a zranitelných cílů"
                        >
                            Katalog & Kontejnery
                        </button>
                    )}
                    {onCreateVMClick && (
                        <button 
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={onCreateVMClick}
                            title="Vytvořit nový virtuální stroj ze šablony"
                        >
                            + Vytvořit VM
                        </button>
                    )}
                    <button 
                        type="button"
                        className={`btn btn-sm ${isGroupedView ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setIsGroupedView(prev => !prev)}
                        title="Přepnout seskupení strojů podle projektů"
                    >
                        {isGroupedView ? 'Zobrazit tabulku' : 'Seskupit dle projektů'}
                    </button>
                    <button 
                        className="btn btn-secondary btn-sm" 
                        onClick={onRefresh} 
                        title="Znovu načíst VM z Proxmoxu"
                        disabled={isRefreshing}
                    >
                        {isRefreshing ? 'Obnovování...' : 'Obnovit'}
                    </button>
                </div>
            </div>

            <div className="project-nav-bar">
                <div className="project-tab-list">
                    <button 
                        type="button"
                        className={`project-tab-btn ${selectedProjectId === 'all' || !selectedProjectId ? 'active' : ''}`}
                        onClick={() => onSelectProject && onSelectProject('all')}
                    >
                        <span>Všechny stroje</span>
                        <span className="project-tab-count">{projectCounts.all || 0}</span>
                    </button>

                    <button 
                        type="button"
                        className={`project-tab-btn ${selectedProjectId === 'none' ? 'active' : ''}`}
                        onClick={() => onSelectProject && onSelectProject('none')}
                    >
                        <span>Bez projektu</span>
                        <span className="project-tab-count">{projectCounts.none || 0}</span>
                    </button>

                    {projects.map(p => (
                        <button 
                            key={p.id}
                            type="button"
                            className={`project-tab-btn ${selectedProjectId === p.id ? 'active' : ''}`}
                            onClick={() => onSelectProject && onSelectProject(p.id)}
                            style={selectedProjectId === p.id && p.color ? { borderColor: p.color, color: p.color } : {}}
                        >
                            <span 
                                className="project-tab-dot" 
                                style={{ backgroundColor: p.color || 'var(--primary-color)' }}
                            />
                            <span>{p.name}</span>
                            <span className="project-tab-count">{projectCounts[p.id] || 0}</span>
                        </button>
                    ))}
                </div>

                {onCreateProjectClick && (
                    <button 
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={onCreateProjectClick}
                    >
                        + Nový projekt
                    </button>
                )}
            </div>

            {activeProject && (
                <div className="active-project-banner" style={{ borderLeftColor: activeProject.color || 'var(--primary-color)' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: activeProject.color || 'var(--primary-color)' }}></span>
                            <strong style={{ fontSize: '15px' }}>{activeProject.name}</strong>
                            <span className="mono-tag" style={{ fontSize: '11px' }}>
                                {activeProject.vm_ids?.length || 0} strojů
                            </span>
                        </div>
                        {activeProject.description && (
                            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                                {activeProject.description}
                            </p>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {onManageProjectVMsClick && (
                            <button 
                                type="button" 
                                className="btn btn-secondary btn-sm"
                                onClick={() => onManageProjectVMsClick(activeProject)}
                            >
                                Správa strojů
                            </button>
                        )}
                        {onEditProjectClick && (
                            <button 
                                type="button" 
                                className="btn btn-secondary btn-sm"
                                onClick={() => onEditProjectClick(activeProject)}
                            >
                                Upravit
                            </button>
                        )}
                        {onDeleteProjectClick && (
                            <button 
                                type="button" 
                                className="btn btn-danger btn-sm"
                                onClick={() => onDeleteProjectClick(activeProject)}
                            >
                                Smazat projekt
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: '240px' }}>
                    <input 
                        type="text"
                        className="search-input"
                        placeholder="Hledat podle názvu, VMID, IP adresy, projektu nebo uzlu..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ width: '100%' }}
                    />
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                        type="button"
                        onClick={() => setTypeFilter('all')}
                        className={`btn btn-sm ${typeFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '12px', padding: '5px 10px' }}
                    >
                        Vše
                    </button>
                    <button
                        type="button"
                        onClick={() => setTypeFilter('qemu')}
                        className={`btn btn-sm ${typeFilter === 'qemu' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '12px', padding: '5px 10px' }}
                    >
                        Virtuální stroje
                    </button>
                    <button
                        type="button"
                        onClick={() => setTypeFilter('lxc')}
                        className={`btn btn-sm ${typeFilter === 'lxc' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '12px', padding: '5px 10px' }}
                    >
                        Kontejnery (LXC)
                    </button>
                    <button
                        type="button"
                        onClick={() => setTypeFilter('cve')}
                        className={`btn btn-sm ${typeFilter === 'cve' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '12px', padding: '5px 10px' }}
                    >
                        CVE laboratoře
                    </button>
                    <button
                        type="button"
                        onClick={() => setTypeFilter('vulnerable')}
                        className={`btn btn-sm ${typeFilter === 'vulnerable' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '12px', padding: '5px 10px' }}
                    >
                        Zranitelné cíle
                    </button>
                </div>
            </div>

            {isGroupedView ? (
                <div>
                    {groupedData.map((group, gIdx) => {
                        const proj = group.project;
                        const headerColor = proj ? proj.color || 'var(--primary-color)' : 'var(--text-muted)';
                        const headerTitle = proj ? proj.name : 'Stroje bez projektu';

                        if (selectedProjectId !== 'all' && selectedProjectId !== 'none' && proj?.id !== selectedProjectId) {
                            return null;
                        }
                        if (selectedProjectId === 'none' && proj !== null) {
                            return null;
                        }

                        return (
                            <div key={proj ? proj.id : 'unassigned-' + gIdx} className="project-group-card">
                                <div className="project-group-header" style={{ borderLeft: `4px solid ${headerColor}` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: headerColor }}></span>
                                        <strong>{headerTitle}</strong>
                                        <span className="mono-tag" style={{ fontSize: '11px' }}>
                                            {group.vms.length} strojů
                                        </span>
                                    </div>
                                    {proj && (
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            {onManageProjectVMsClick && (
                                                <button 
                                                    type="button" 
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => onManageProjectVMsClick(proj)}
                                                >
                                                    Přiřadit stroje
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="table-container">
                                    <table className="vm-table">
                                        <thead>
                                            <tr>
                                                <th>VMID</th>
                                                <th>Název</th>
                                                <th>Projekt</th>
                                                {isTeacher && <th>Uzel</th>}
                                                {isTeacher && <th>Vlastník</th>}
                                                <th>Stav</th>
                                                <th>IP Adresa</th>
                                                <th>Síťová propojení</th>
                                                <th>Akce</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {renderVMRows(group.vms)}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="table-container">
                    <table className="vm-table">
                        <thead>
                            <tr>
                                <th>VMID</th>
                                <th>Název</th>
                                <th>Projekt</th>
                                {isTeacher && <th>Uzel</th>}
                                {isTeacher && <th>Vlastník</th>}
                                <th>Stav</th>
                                <th>IP Adresa</th>
                                <th>Síťová propojení</th>
                                <th>Akce</th>
                            </tr>
                        </thead>
                        <tbody>
                            {renderVMRows(filteredVMs)}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
