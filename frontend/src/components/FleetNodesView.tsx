import { useState, useEffect } from 'react';
import { ProxmoxNode, FleetVM } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface FleetNodesViewProps {
    nodes: ProxmoxNode[];
    token: string;
    onMessage: (msg: string) => void;
    onRefreshNodes: () => void;
    onStartVM?: (id: string, name: string, node?: string) => void;
    onStopVM?: (id: string, name: string, node?: string) => void;
    onDeleteVM?: (id: string, name: string, node?: string) => void;
    onOpenConsole?: (id: string, node?: string) => void;
    initialStudentFilter?: string;
    onClearStudentFilter?: () => void;
}

export function FleetNodesView({ 
    nodes, 
    token, 
    onMessage, 
    onRefreshNodes,
    onStartVM,
    onStopVM,
    onDeleteVM,
    onOpenConsole,
    initialStudentFilter,
    onClearStudentFilter
}: FleetNodesViewProps) {
    const [fleetVMs, setFleetVMs] = useState<FleetVM[]>([]);
    const [selectedNodeFilter, setSelectedNodeFilter] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'stopped'>('all');
    const [searchQuery, setSearchQuery] = useState<string>(initialStudentFilter || '');
    const [isLoading, setIsLoading] = useState(false);
    const [isBulkActionRunning, setIsBulkActionRunning] = useState(false);

    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        message: '',
        onConfirm: () => {}
    });

    useEffect(() => {
        if (initialStudentFilter) {
            setSearchQuery(initialStudentFilter);
        }
    }, [initialStudentFilter]);

    const fetchFleetVMs = async () => {
        setIsLoading(true);
        try {
            let resp: Response;
            try {
                resp = await fetch('/teacher/vms', {
                    headers: { 'Authorization': token }
                });
            } catch {
                resp = await fetch('http://10.0.10.52:8080/teacher/vms', {
                    headers: { 'Authorization': token }
                });
            }
            if (resp.ok) {
                const data = await resp.json();
                setFleetVMs(data || []);
            }
        } catch (err: any) {
            console.error('Failed to fetch fleet VMs:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchFleetVMs();
    }, [token]);

    const handleBulkStopAll = () => {
        setConfirmDialog({
            isOpen: true,
            message: 'Opravdu chcete ZASTAVIT VŠECHNY běžící virtuální stroje napříč celým clusterem?',
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                setIsBulkActionRunning(true);
                try {
                    let resp: Response;
                    const payload = { action: 'stop_all' };
                    try {
                        resp = await fetch('/teacher/vms/bulk-action', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': token },
                            body: JSON.stringify(payload)
                        });
                    } catch {
                        resp = await fetch('http://10.0.10.52:8080/teacher/vms/bulk-action', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': token },
                            body: JSON.stringify(payload)
                        });
                    }
                    if (!resp.ok) {
                        const err = await resp.json().catch(() => ({}));
                        throw new Error(err.error || `Server responded with ${resp.status}`);
                    }
                    onMessage('Hromadná akce dokončena: Všechny běžící virtuální stroje byly zastaveny');
                    await fetchFleetVMs();
                    onRefreshNodes();
                } catch (err: any) {
                    onMessage(`Hromadná akce selhala: ${err.message}`);
                } finally {
                    setIsBulkActionRunning(false);
                }
            }
        });
    };

    const handleActionVM = async (action: 'start' | 'stop' | 'delete', vm: FleetVM) => {
        const idStr = String(vm.id);
        const nodeStr = vm.node || 'pve1';
        if (action === 'start' && onStartVM) {
            onStartVM(idStr, vm.name, nodeStr);
            setTimeout(() => fetchFleetVMs(), 1500);
            return;
        }
        if (action === 'stop' && onStopVM) {
            onStopVM(idStr, vm.name, nodeStr);
            setTimeout(() => fetchFleetVMs(), 1500);
            return;
        }
        if (action === 'delete' && onDeleteVM) {
            onDeleteVM(idStr, vm.name, nodeStr);
            setTimeout(() => fetchFleetVMs(), 1500);
            return;
        }

        const endpoint = action === 'start' ? '/vms/start' : action === 'stop' ? '/vms/stop' : '/vms/delete';
        const actionLabel = action === 'start' ? 'spuštěn' : action === 'stop' ? 'zastaven' : 'smazán';
        try {
            let resp: Response;
            const payload = { vmid: Number(vm.id), node: nodeStr };
            try {
                resp = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': token },
                    body: JSON.stringify(payload)
                });
            } catch {
                resp = await fetch(`http://10.0.10.52:8080${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': token },
                    body: JSON.stringify(payload)
                });
            }
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.error || `Server responded with ${resp.status}`);
            }
            onMessage(`Virtuální stroj ${vm.name} byl úspěšně ${actionLabel}`);
            await fetchFleetVMs();
            onRefreshNodes();
        } catch (err: any) {
            onMessage(`Operace selhala: ${err.message}`);
        }
    };

    const handleOpenVMConsole = (vm: FleetVM) => {
        const idStr = String(vm.id);
        const nodeStr = vm.node || 'pve1';
        if (onOpenConsole) {
            onOpenConsole(idStr, nodeStr);
        } else {
            onMessage(`Otevírání konzole pro VM ${vm.name} (${idStr})`);
        }
    };

    const filteredVMs = fleetVMs.filter(vm => {
        if (selectedNodeFilter && vm.node !== selectedNodeFilter) return false;
        if (statusFilter === 'running' && !vm.status.toLowerCase().includes('run')) return false;
        if (statusFilter === 'stopped' && vm.status.toLowerCase().includes('run')) return false;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            const matchName = vm.name.toLowerCase().includes(q);
            const matchId = String(vm.id).includes(q);
            const matchNode = (vm.node || '').toLowerCase().includes(q);
            const matchOwner = (vm.owner_email || vm.owner || vm.owner_uuid || '').toLowerCase().includes(q);
            if (!matchName && !matchId && !matchNode && !matchOwner) return false;
        }
        return true;
    });

    const runningCount = fleetVMs.filter(v => v.status.toLowerCase().includes('run')).length;
    const stoppedCount = fleetVMs.length - runningCount;
    const totalRAMMB = fleetVMs.reduce((acc, v) => acc + (v.ram_mb || 0), 0);
    const onlineNodesCount = nodes.filter(n => n.status === 'online').length;

    return (
        <div className="card">
            <ConfirmModal 
                isOpen={confirmDialog.isOpen}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h3 style={{ margin: 0 }}>Cluster a víceuzlová infrastruktura</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                        Přehled všech výpočetních uzlů a centrální správa všech virtuálních strojů v clusteru
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button 
                        className="btn btn-danger btn-sm"
                        onClick={handleBulkStopAll}
                        disabled={isBulkActionRunning || runningCount === 0}
                    >
                        {isBulkActionRunning ? 'Zastavování všech...' : `Zastavit všechny běžící (${runningCount})`}
                    </button>
                    <button 
                        className="btn btn-secondary btn-sm" 
                        onClick={() => { fetchFleetVMs(); onRefreshNodes(); }}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Obnovování...' : 'Obnovit cluster'}
                    </button>
                </div>
            </div>

            <div className="stats-banner">
                <div className="stat-box">
                    <span className="stat-box-label">Výpočetní uzly</span>
                    <span className="stat-box-val">{onlineNodesCount} / {nodes.length} online</span>
                </div>
                <div className="stat-box">
                    <span className="stat-box-label">Celkem VM v clusteru</span>
                    <span className="stat-box-val">{fleetVMs.length}</span>
                </div>
                <div className="stat-box">
                    <span className="stat-box-label">Běžící stroje</span>
                    <span className="stat-box-val" style={{ color: 'var(--success-color)' }}>{runningCount}</span>
                </div>
                <div className="stat-box">
                    <span className="stat-box-label">Alokovaná RAM</span>
                    <span className="stat-box-val">{(totalRAMMB / 1024).toFixed(1)} GB</span>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                {nodes.map(node => (
                    <div 
                        key={node.name}
                        onClick={() => setSelectedNodeFilter(prev => prev === node.name ? '' : node.name)}
                        className={`node-card ${selectedNodeFilter === node.name ? 'selected' : ''}`}
                        style={{ cursor: 'pointer' }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <strong style={{ fontSize: '14px' }}>{node.name}</strong>
                            <span className={`status-badge ${node.status === 'online' ? 'status-running' : 'status-stopped'}`}>
                                <span className="status-badge-dot"></span>
                                {node.status === 'online' ? 'ONLINE' : 'OFFLINE'}
                            </span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            <div>Celkem VM: <strong>{node.total_vms || 0}</strong></div>
                            <div>Běží: <strong style={{ color: 'var(--success-color)' }}>{node.running_vms || 0}</strong></div>
                            <div>Šablony: <strong>{node.templates || 0}</strong></div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="filter-bar">
                <input 
                    type="text"
                    className="search-input"
                    placeholder="Hledat VM, VMID, uzel nebo studenta..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />

                <div style={{ display: 'flex', gap: '4px' }}>
                    <button 
                        className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setStatusFilter('all')}
                    >
                        Vše ({fleetVMs.length})
                    </button>
                    <button 
                        className={`btn btn-sm ${statusFilter === 'running' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setStatusFilter('running')}
                    >
                        Běží ({runningCount})
                    </button>
                    <button 
                        className={`btn btn-sm ${statusFilter === 'stopped' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setStatusFilter('stopped')}
                    >
                        Zastaveno ({stoppedCount})
                    </button>
                </div>

                {(selectedNodeFilter || statusFilter !== 'all' || searchQuery) && (
                    <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                            setSelectedNodeFilter('');
                            setStatusFilter('all');
                            setSearchQuery('');
                            if (onClearStudentFilter) onClearStudentFilter();
                        }}
                    >
                        Vymazat filtry
                    </button>
                )}
            </div>

            <div className="table-container">
                <table className="vm-table">
                    <thead>
                        <tr>
                            <th>VMID</th>
                            <th>Název VM</th>
                            <th>Uzel</th>
                            <th>Vlastník / Student</th>
                            <th>Stav</th>
                            <th>RAM</th>
                            <th>Akce</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredVMs.map(vm => {
                            const isRunning = vm.status.toLowerCase().includes('run');
                            return (
                                <tr key={`${vm.node || 'pve'}-${vm.id}`}>
                                    <td>
                                        <span className="mono-tag" style={{ fontWeight: 600, color: 'var(--primary-color)' }}>
                                            {vm.id}
                                        </span>
                                    </td>
                                    <td className="fw-500">{vm.name}</td>
                                    <td>
                                        <span className="mono-tag">
                                            {vm.node || 'pve'}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        {vm.owner_email || vm.owner || (vm.owner_uuid ? vm.owner_uuid.slice(0, 8) + '...' : 'Systém / Učitel')}
                                    </td>
                                    <td>
                                        <span className={`status-badge ${isRunning ? 'status-running' : 'status-stopped'}`}>
                                            <span className="status-badge-dot"></span>
                                            {isRunning ? 'BĚŽÍ' : 'ZASTAVENO'}
                                        </span>
                                    </td>
                                    <td>{vm.ram_mb ? `${vm.ram_mb} MB` : '-'}</td>
                                    <td>
                                        <div className="action-buttons">
                                            {isRunning ? (
                                                <>
                                                    <button 
                                                        className="btn btn-warning btn-sm"
                                                        onClick={() => handleActionVM('stop', vm)}
                                                        title="Zastavit virtuální stroj"
                                                    >
                                                        Zastavit
                                                    </button>
                                                    <button 
                                                        className="btn btn-primary btn-sm"
                                                        onClick={() => handleOpenVMConsole(vm)}
                                                        title="Otevřít interaktivní konzoli"
                                                    >
                                                        Konzole
                                                    </button>
                                                </>
                                            ) : (
                                                <button 
                                                    className="btn btn-success btn-sm"
                                                    onClick={() => handleActionVM('start', vm)}
                                                    title="Spustit virtuální stroj"
                                                >
                                                    Spustit
                                                </button>
                                            )}
                                            <button 
                                                className="btn btn-danger btn-sm"
                                                onClick={() => {
                                                    setConfirmDialog({
                                                        isOpen: true,
                                                        message: `Opravdu chcete SMAZAT virtuální stroj ${vm.name} (VMID: ${vm.id}) na uzlu ${vm.node || 'pve'}? Tato akce je nevratná.`,
                                                        onConfirm: () => {
                                                            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                                                            handleActionVM('delete', vm);
                                                        }
                                                    });
                                                }}
                                                title="Smazat virtuální stroj"
                                            >
                                                Smazat
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredVMs.length === 0 && (
                            <tr>
                                <td colSpan={7} className="text-center text-muted" style={{ padding: '24px' }}>
                                    Žádné virtuální stroje neodpovídají zadanému filtru.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
