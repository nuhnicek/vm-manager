import { useState, useMemo, useEffect, useRef, ReactNode } from 'react';
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
    /** Rendered between the page header and the filters (e.g. the teacher's node picker). */
    headerSlot?: ReactNode;
}

type RowMenuItem = { label: string; onClick: () => void; disabled?: boolean; danger?: boolean } | { divider: true };

function RowMenu({ items }: { items: (RowMenuItem | false | null | undefined | '' | 0)[] }) {
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const list = items.filter(Boolean) as RowMenuItem[];

    useEffect(() => {
        if (!pos) return;
        const close = (e: Event) => {
            if (e.type === 'keydown' && (e as KeyboardEvent).key !== 'Escape') return;
            if (e.type === 'mousedown' && (menuRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node))) return;
            setPos(null);
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', close);
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', close);
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
        };
    }, [pos]);

    const toggle = () => {
        if (pos) { setPos(null); return; }
        const r = btnRef.current!.getBoundingClientRect();
        const menuW = 240;
        const menuH = list.length * 34 + 12;
        const top = r.bottom + 4 + menuH > window.innerHeight ? Math.max(8, r.top - 4 - menuH) : r.bottom + 4;
        setPos({ top, left: Math.max(8, Math.min(r.right - menuW, window.innerWidth - menuW - 8)) });
    };

    return (
        <>
            <button ref={btnRef} type="button" className="btn btn-secondary btn-sm row-menu-trigger" onClick={toggle} title="Další akce" aria-haspopup="menu" aria-expanded={!!pos}>
                ⋯
            </button>
            {pos && (
                <div ref={menuRef} className="row-menu" role="menu" style={{ top: pos.top, left: pos.left }}>
                    {list.map((it, i) => 'divider' in it ? (
                        <div key={i} className="row-menu-divider" />
                    ) : (
                        <button
                            key={i}
                            type="button"
                            role="menuitem"
                            className={`row-menu-item${it.danger ? ' danger' : ''}`}
                            disabled={it.disabled}
                            onClick={() => { setPos(null); it.onClick(); }}
                        >
                            {it.label}
                        </button>
                    ))}
                </div>
            )}
        </>
    );
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
    headerSlot,
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
                    <td colSpan={isTeacher ? 8 : 6} className="text-center text-muted" style={{ padding: '24px' }}>
                        <div>Tady zatím nic neběží. Nasaďte stroj z katalogu nebo ho vytvořte ze šablony.</div>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '10px' }}>
                            {onOpenCatalogClick && (
                                <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={onOpenCatalogClick}
                                >
                                    Nasadit z katalogu
                                </button>
                            )}
                            {onCreateVMClick && (
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={onCreateVMClick}
                                >
                                    Vytvořit ze šablony
                                </button>
                            )}
                        </div>
                    </td>
                </tr>
            );
        }

        return list.map(vm => {
            const pendingAction = pendingActions[String(vm.id)];
            // App.tsx records these as 'start' | 'stop' | 'delete'
            const isStarting = pendingAction === 'start';
            const isStopping = pendingAction === 'stop';
            const isDeleting = pendingAction === 'delete';
            const isBusy = isStarting || isStopping || isDeleting;
            const isConnectingLab = pendingAction === 'lab_connect';
            const isDisconnectingLab = pendingAction === 'lab_disconnect';
            const isRunning = vm.status === 'Running' || vm.status === 'running';
            const isLXC = vm.type === 'lxc';
            const projName = (vm as any).project_name;
            const projColor = (vm as any).project_color || 'var(--primary-color)';

            return (
                <tr key={`${(vm as any).node || 'pve'}-${vm.id}`}>
                    <td>
                        <span className="port-plate" title={isRunning ? 'Běží' : 'Zastaveno'} aria-label={`${vm.id}, ${isRunning ? 'běží' : 'zastaveno'}`}>
                            <span className={`led${isRunning ? ' on' : ''}`} />
                            {vm.id}
                        </span>
                    </td>
                    <td>
                        <div className="vm-name">{vm.name}</div>
                        <div className="vm-tags">
                            {(!isRunning || isStarting || isStopping) && (
                                <span className="tag">{isStarting ? 'Spouští se…' : isStopping ? 'Zastavuje se…' : 'Zastaveno'}</span>
                            )}
                            {isLXC && <span className="tag kind">Kontejner</span>}
                            {(vm as any).cve_id ? (
                                <button type="button" className="tag danger" onClick={() => setSelectedCVEVM(vm)} title="Zobrazit detail zranitelnosti a návod">
                                    {(vm as any).cve_id}{(vm as any).cvss ? ` · CVSS ${(vm as any).cvss}` : ''}
                                </button>
                            ) : vm.is_vulnerable ? (
                                <span className="tag danger">Zranitelný</span>
                            ) : null}
                            {(vm as any).is_attacker && <span className="tag warn">Útočník</span>}
                        </div>
                    </td>
                    <td>
                        {projName ? (
                            <button type="button" className="project-badge" onClick={() => setMovingVM(vm)} title="Změnit projekt">
                                <span style={{ width: '4px', height: '14px', borderRadius: '2px', backgroundColor: projColor, flexShrink: 0 }}></span>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{projName}</span>
                            </button>
                        ) : (
                            <button type="button" className="project-badge text-muted" onClick={() => setMovingVM(vm)} title="Přiřadit k projektu">
                                Přiřadit
                            </button>
                        )}
                    </td>
                    {isTeacher && (
                        <td><span className="mono">{(vm as any).node || 'pve'}</span></td>
                    )}
                    {isTeacher && (
                        <td className="mono text-muted" title={(vm as any).owner || ''}>
                            {(vm as any).owner ? (vm as any).owner.slice(0, 8) : 'systém'}
                        </td>
                    )}
                    <td>
                        {vm.ip_address ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <span className="ip" style={{ marginRight: '4px' }}>{vm.ip_address}</span>
                                <button type="button" className="icon-btn" onClick={() => navigator.clipboard.writeText(vm.ip_address!)} title="Zkopírovat IP adresu"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg></button>
                                {onSetIPClick && <button type="button" className="icon-btn" onClick={() => onSetIPClick(vm)} title="Upravit IP adresu"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg></button>}
                                {vm.configured_ip && vm.configured_ip.toLowerCase() !== 'dhcp' && vm.configured_ip !== vm.ip_address && (
                                    <span className="text-muted" style={{ fontSize: '12px', marginLeft: '6px' }}>nastaveno {vm.configured_ip}</span>
                                )}
                            </div>
                        ) : vm.configured_ip ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <span className="ip text-muted" style={{ marginRight: '4px' }}>{vm.configured_ip.toLowerCase() === 'dhcp' ? 'DHCP' : vm.configured_ip}</span>
                                {onSetIPClick && <button type="button" className="icon-btn" onClick={() => onSetIPClick(vm)} title="Upravit IP adresu"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg></button>}
                            </div>
                        ) : onSetIPClick ? (
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onSetIPClick(vm)}>Nastavit IP</button>
                        ) : (
                            <span className="text-muted">–</span>
                        )}
                    </td>
                    <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '13px', whiteSpace: 'nowrap' }}>
                            {(vm as any).has_internet && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span className="led on" />Internet
                                </span>
                            )}
                            {(vm.connections || []).map((conn, idx) => (
                                <span key={idx} className="mono text-muted" style={{ fontSize: '12px' }}>
                                    {conn.local_nic} ↔ VM {conn.target_vm_id}:{conn.target_nic}
                                </span>
                            ))}
                            {!(vm as any).has_internet && !(vm.connections || []).length && (
                                <span className="text-muted">–</span>
                            )}
                        </div>
                    </td>
                    <td>
                        <div className="action-buttons row-actions">
                            {!isRunning ? (
                                <button 
                                    className="btn btn-secondary btn-sm" 
                                    disabled={isBusy}
                                    onClick={() => onStartVM(String(vm.id), vm.name, (vm as any).node)}
                                >
                                    {isStarting && <span className="btn-spinner" />}
                                    {isStarting ? 'Spouštění...' : 'Spustit'}
                                </button>
                            ) : (
                                <button 
                                    className="btn btn-secondary btn-sm" 
                                    disabled={isBusy}
                                    onClick={() => onStopVM(String(vm.id), vm.name, (vm as any).node)}
                                >
                                    {isStopping && <span className="btn-spinner" />}
                                    {isStopping ? 'Zastavování...' : 'Zastavit'}
                                </button>
                            )}

                            <button 
                                className="btn btn-secondary btn-sm" 
                                disabled={!isRunning || isBusy}
                                title={isRunning ? 'Otevřít konzoli' : 'Stroj je zastaven'}
                                onClick={() => onOpenConsole(String(vm.id), (vm as any).node)}
                            >
                                Konzole
                            </button>

                            <button 
                                className="btn btn-secondary btn-sm" 
                                onClick={() => onManageNetworking(vm)}
                            >
                                Síť
                            </button>

                            <RowMenu
                                items={[
                                    isRunning && { label: 'Externí VNC klient', onClick: () => setExternalVNCVM(vm) },
                                    onConnectLabNetwork && onDisconnectLabNetwork && (
                                        (vm as any).has_internet
                                            ? { label: isDisconnectingLab ? 'Odpojování...' : 'Odpojit od Lab sítě', disabled: isConnectingLab || isDisconnectingLab, onClick: () => onDisconnectLabNetwork(vm) }
                                            : (vm as any).is_vulnerable
                                                ? { label: 'Lab síť: izolováno (zranitelný stroj)', disabled: true, onClick: () => {} }
                                                : { label: isConnectingLab ? 'Připojování...' : 'Připojit k Lab síti (Internet)', disabled: isConnectingLab || isDisconnectingLab, onClick: () => onConnectLabNetwork(vm) }
                                    ),
                                    onSetIPClick && { label: 'Nastavit IP adresu', onClick: () => onSetIPClick(vm) },
                                    ((vm as any).cve_id || vm.is_vulnerable) && { label: 'CVE návod', onClick: () => setSelectedCVEVM(vm) },
                                    { label: 'Přesunout do projektu', onClick: () => setMovingVM(vm) },
                                    { divider: true },
                                    { label: isDeleting ? 'Mazání...' : 'Smazat stroj', danger: true, disabled: isBusy, onClick: () => onDeleteVM(String(vm.id), vm.name, (vm as any).node) },
                                ]}
                            />
                        </div>
                    </td>
                </tr>
            );
        });
    };

    return (
        <section>
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
                                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'none', marginBottom: '6px' }}>
                                        Popis a vektor zranitelnosti
                                    </div>
                                    <div>{(selectedCVEVM as any).exploit_doc}</div>
                                </div>
                            )}

                            {(selectedCVEVM as any).exploit_hint && (
                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'none' }}>
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

            <div className="page-head">
                <div>
                    <h1>Moje stroje</h1>
                    <p>{filteredVMs.length === vms.length ? `${vms.length} strojů` : `${filteredVMs.length} z ${vms.length} strojů`} · {vms.filter(v => /run/i.test(v.status || '')).length} běží</p>
                </div>
                <div className="page-head-actions">
                    <button
                        className="btn btn-secondary"
                        onClick={onRefresh}
                        title="Znovu načíst stroje z Proxmoxu"
                        disabled={isRefreshing}
                    >
                        {isRefreshing ? 'Načítám…' : 'Obnovit'}
                    </button>
                    {onCreateVMClick && (
                        <button type="button" className="btn btn-secondary" onClick={onCreateVMClick}>
                            Vytvořit ze šablony
                        </button>
                    )}
                    {onOpenCatalogClick && (
                        <button type="button" className="btn btn-primary" onClick={onOpenCatalogClick} title="Kontejnery, zranitelné cíle a nástroje připravené k nasazení">
                            Nasadit z katalogu
                        </button>
                    )}
                </div>
            </div>

            {headerSlot}

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
                        className="btn btn-secondary btn-sm"
                        onClick={onCreateProjectClick}
                    >
                        Nový projekt
                    </button>
                )}
            </div>

            {activeProject && (
                <div className="project-banner" style={{ borderLeftColor: activeProject.color || 'var(--primary-color)' }}>
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

            <div className="filter-bar">
                <input 
                    type="text"
                    className="search-input"
                    placeholder="Hledat název, VMID, IP, projekt nebo uzel"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ flex: '1 1 240px' }}
                    aria-label="Hledat stroje"
                />
                <div className="segmented" role="group" aria-label="Typ stroje">
                    {([['all', 'Vše'], ['qemu', 'VM'], ['lxc', 'Kontejnery'], ['cve', 'CVE laboratoře'], ['vulnerable', 'Zranitelné']] as const).map(([k, label]) => (
                        <button key={k} type="button" className={typeFilter === k ? 'active' : ''} onClick={() => setTypeFilter(k)} aria-pressed={typeFilter === k}>
                            {label}
                        </button>
                    ))}
                </div>
                <div className="segmented" role="group" aria-label="Zobrazení">
                    <button type="button" className={!isGroupedView ? 'active' : ''} onClick={() => setIsGroupedView(false)} aria-pressed={!isGroupedView}>Seznam</button>
                    <button type="button" className={isGroupedView ? 'active' : ''} onClick={() => setIsGroupedView(true)} aria-pressed={isGroupedView}>Podle projektů</button>
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
                                                <th>Port</th>
                                                <th>Stroj</th>
                                                <th>Projekt</th>
                                                {isTeacher && <th>Uzel</th>}
                                                {isTeacher && <th>Vlastník</th>}
                                                                                                <th>IP adresa</th>
                                                <th>Propojení</th>
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
                                <th>Port</th>
                                <th>Stroj</th>
                                <th>Projekt</th>
                                {isTeacher && <th>Uzel</th>}
                                {isTeacher && <th>Vlastník</th>}
                                                                <th>IP adresa</th>
                                <th>Propojení</th>
                                <th>Akce</th>
                            </tr>
                        </thead>
                        <tbody>
                            {renderVMRows(filteredVMs)}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
