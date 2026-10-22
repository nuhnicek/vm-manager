import { useState, useEffect } from 'react';
import { ProxmoxNode, FleetVM } from '../types';

interface FleetNodesViewProps {
    nodes: ProxmoxNode[];
    token: string;
    onMessage: (msg: string) => void;
    onRefreshNodes: () => void;
}

export function FleetNodesView({ nodes, token, onMessage, onRefreshNodes }: FleetNodesViewProps) {
    const [fleetVMs, setFleetVMs] = useState<FleetVM[]>([]);
    const [selectedNodeFilter, setSelectedNodeFilter] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [isBulkActionRunning, setIsBulkActionRunning] = useState(false);

    const fetchFleetVMs = async () => {
        setIsLoading(true);
        try {
            let resp: Response;
            try {
                resp = await fetch('/teacher/vms', {
                    headers: { 'Authorization': token }
                });
            } catch {
                resp = await fetch('http://localhost:8080/teacher/vms', {
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

    const handleBulkStopAll = async () => {
        if (!window.confirm('Opravdu chcete ZASTAVIT VŠECHNY běžící virtuální stroje napříč všemi uzly clusteru?')) {
            return;
        }
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
                resp = await fetch('http://localhost:8080/teacher/vms/bulk-action', {
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
    };

    const filteredVMs = selectedNodeFilter 
        ? fleetVMs.filter(v => v.node === selectedNodeFilter)
        : fleetVMs;

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h3 style={{ margin: 0 }}>Cluster a víceuzlová infrastruktura</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                        Přehled výpočetních uzlů a všech virtuálních strojů běžících v clusteru
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                        className="btn btn-danger btn-sm"
                        onClick={handleBulkStopAll}
                        disabled={isBulkActionRunning || fleetVMs.length === 0}
                    >
                        {isBulkActionRunning ? 'Zastavování všech...' : 'Zastavit všechny stroje v clusteru'}
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                {nodes.map(node => (
                    <div 
                        key={node.name}
                        onClick={() => setSelectedNodeFilter(prev => prev === node.name ? '' : node.name)}
                        style={{
                            padding: '12px',
                            borderRadius: '8px',
                            border: selectedNodeFilter === node.name ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                            backgroundColor: selectedNodeFilter === node.name ? 'var(--primary-subtle)' : 'var(--card-bg-subtle)',
                            cursor: 'pointer'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <strong style={{ fontSize: '14px' }}>{node.name}</strong>
                            <span className={`status-badge ${node.status === 'online' ? 'status-running' : 'status-stopped'}`}>
                                {node.status === 'online' ? 'ONLINE' : 'OFFLINE'}
                            </span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            <div>Celkem VM: <strong>{node.total_vms || 0}</strong></div>
                            <div>Běží: <strong>{node.running_vms || 0}</strong></div>
                            <div>Šablony: <strong>{node.templates || 0}</strong></div>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h4 style={{ margin: 0 }}>
                    Virtuální stroje v clusteru ({filteredVMs.length}) {selectedNodeFilter && `(Filtrováno: ${selectedNodeFilter})`}
                </h4>
                {selectedNodeFilter && (
                    <button 
                        className="btn btn-secondary btn-sm" 
                        onClick={() => setSelectedNodeFilter('')}
                        style={{ fontSize: '11px', padding: '2px 8px' }}
                    >
                        Zrušit filtr
                    </button>
                )}
            </div>

            <table className="vm-table">
                <thead>
                    <tr>
                        <th>VMID</th>
                        <th>Název</th>
                        <th>Uzel</th>
                        <th>Vlastník</th>
                        <th>Stav</th>
                        <th>RAM</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredVMs.map(vm => (
                        <tr key={vm.id}>
                            <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{vm.id}</td>
                            <td className="fw-500">{vm.name}</td>
                            <td>
                                <span style={{ fontFamily: 'monospace', fontSize: '12px', padding: '2px 6px', background: 'var(--badge-bg)', borderRadius: '4px' }}>
                                    {vm.node || 'pve'}
                                </span>
                            </td>
                            <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                {vm.owner_email || vm.owner || (vm.owner_uuid ? vm.owner_uuid.slice(0, 8) + '...' : 'Systém')}
                            </td>
                            <td>
                                <span className={`status-badge ${vm.status === 'Running' ? 'status-running' : 'status-stopped'}`}>
                                    {vm.status === 'Running' ? 'BĚŽÍ' : 'ZASTAVENO'}
                                </span>
                            </td>
                            <td>{vm.ram_mb ? `${vm.ram_mb} MB` : '-'}</td>
                        </tr>
                    ))}
                    {filteredVMs.length === 0 && (
                        <tr>
                            <td colSpan={6} className="text-center text-muted" style={{ padding: '24px' }}>
                                Nebyly nalezeny žádné virtuální stroje v clusteru.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

