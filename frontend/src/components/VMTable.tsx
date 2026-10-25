import { useState, useMemo } from 'react';
import { main } from '../../wailsjs/go/models';
import { Project } from '../types';
import { MoveVMToProjectModal } from './MoveVMToProjectModal';

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
}: VMTableProps) {
    const isTeacher = userRole === 'teacher';
    const [searchQuery, setSearchQuery] = useState('');
    const [isGroupedView, setIsGroupedView] = useState(false);
    const [movingVM, setMovingVM] = useState<main.VM | null>(null);

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
            const matchesSearch = 
                !searchQuery.trim() ||
                vm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                String(vm.id).includes(searchQuery) ||
                ((vm as any).node && (vm as any).node.toLowerCase().includes(searchQuery.toLowerCase())) ||
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
    }, [vms, searchQuery, selectedProjectId]);

    const groupedData = useMemo(() => {
        const groups: { project: Project | null; vms: main.VM[] }[] = [];

        projects.forEach(p => {
            const projVMs = vms.filter(v => (v as any).project_id === p.id && (
                !searchQuery.trim() ||
                v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                String(v.id).includes(searchQuery)
            ));
            groups.push({ project: p, vms: projVMs });
        });

        const unassignedVMs = vms.filter(v => !(v as any).project_id && (
            !searchQuery.trim() ||
            v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            String(v.id).includes(searchQuery)
        ));
        if (unassignedVMs.length > 0 || projects.length === 0) {
            groups.push({ project: null, vms: unassignedVMs });
        }

        return groups;
    }, [vms, projects, searchQuery]);

    const renderVMRows = (list: main.VM[]) => {
        if (list.length === 0) {
            return (
                <tr>
                    <td colSpan={isTeacher ? 8 : 6} className="text-center text-muted" style={{ padding: '24px' }}>
                        Nebyly nalezeny žádné virtuální stroje pro toto zobrazení.
                    </td>
                </tr>
            );
        }

        return list.map(vm => {
            const isRunning = vm.status === 'Running' || vm.status === 'running';
            const projName = (vm as any).project_name;
            const projColor = (vm as any).project_color || 'var(--primary-color)';

            return (
                <tr key={`${(vm as any).node || 'pve'}-${vm.id}`}>
                    <td>
                        <span className="mono-tag" style={{ fontWeight: 600, color: 'var(--primary-color)' }}>
                            {vm.id}
                        </span>
                    </td>
                    <td className="fw-500">{vm.name}</td>
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
                            <span className="status-badge-dot"></span>
                            {isRunning ? 'BĚŽÍ' : 'ZASTAVENO'}
                        </span>
                    </td>
                    <td>
                        {vm.connections && vm.connections.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                {vm.connections.map((conn, idx) => (
                                    <span key={idx} style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                                        &rarr; VM {conn.target_vm_id} ({conn.local_nic} &harr; {conn.target_nic})
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Bez propojení</span>
                        )}
                    </td>
                    <td>
                        <div className="action-buttons">
                            {!isRunning ? (
                                <button 
                                    className="btn btn-success btn-sm" 
                                    onClick={() => onStartVM(String(vm.id), vm.name, (vm as any).node)}
                                >
                                    Spustit
                                </button>
                            ) : (
                                <button 
                                    className="btn btn-warning btn-sm" 
                                    onClick={() => onStopVM(String(vm.id), vm.name, (vm as any).node)}
                                >
                                    Zastavit
                                </button>
                            )}
                            
                            <button 
                                className="btn btn-primary btn-sm" 
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

                            <button 
                                className="btn btn-secondary btn-sm" 
                                onClick={() => setMovingVM(vm)}
                                title="Přiřadit nebo přesunout do jiného projektu"
                            >
                                Projekt
                            </button>
                            
                            <button 
                                className="btn btn-danger btn-sm" 
                                onClick={() => onDeleteVM(String(vm.id), vm.name, (vm as any).node)}
                            >
                                Smazat
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                    <h3 style={{ margin: 0 }}>Virtuální stroje ({filteredVMs.length})</h3>
                    <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                        Správa vašich instancí organizovaných do projektů
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                <div className="project-banner" style={{ borderLeftColor: activeProject.color || 'var(--primary-color)' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: activeProject.color || 'var(--primary-color)' }}></span>
                            <strong style={{ fontSize: '15px', color: 'var(--text-main)' }}>{activeProject.name}</strong>
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

            <div className="filter-bar" style={{ marginBottom: '14px' }}>
                <input 
                    type="text"
                    className="search-input"
                    placeholder="Hledat stroj podle názvu, VMID, projektu nebo uzlu..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
            </div>

            {isGroupedView ? (
                <div>
                    {groupedData.map((group, gIdx) => {
                        const proj = group.project;
                        const headerColor = proj ? proj.color || 'var(--primary-color)' : 'var(--text-muted)';
                        const headerTitle = proj ? proj.name : 'Virtuální stroje bez projektu';

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
