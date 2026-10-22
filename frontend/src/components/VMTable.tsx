import { main } from '../../wailsjs/go/models';

interface VMTableProps {
    vms: main.VM[];
    userRole?: string;
    isRefreshing: boolean;
    onRefresh: () => void;
    onStartVM: (id: string, name: string) => void;
    onStopVM: (id: string, name: string) => void;
    onOpenConsole: (id: string) => void;
    onManageNetworking: (vm: main.VM) => void;
    onDeleteVM: (id: string, name: string) => void;
}

export function VMTable({
    vms,
    userRole,
    isRefreshing,
    onRefresh,
    onStartVM,
    onStopVM,
    onOpenConsole,
    onManageNetworking,
    onDeleteVM,
}: VMTableProps) {
    const isTeacher = userRole === 'teacher';

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                    <h3 style={{ margin: 0 }}>Existující virtuální stroje ({vms.length})</h3>
                    <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                        Seznam vašich instancí běžících na infrastruktuře
                    </p>
                </div>
                <button 
                    className="btn btn-secondary btn-sm" 
                    onClick={onRefresh} 
                    title="Znovu načíst VM z Proxmoxu"
                    disabled={isRefreshing}
                >
                    {isRefreshing ? 'Obnovování...' : 'Obnovit'}
                </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table className="vm-table">
                    <thead>
                        <tr>
                            <th>VMID</th>
                            <th>Název</th>
                            <th>Uzel</th>
                            {isTeacher && <th>Vlastník</th>}
                            <th>Stav</th>
                            <th>Síťová propojení</th>
                            <th>Akce</th>
                        </tr>
                    </thead>
                    <tbody>
                        {vms.map((vm) => {
                            const isRunning = vm.status === 'Running' || vm.status === 'running';

                            return (
                                <tr key={vm.id}>
                                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-color)' }}>{vm.id}</td>
                                    <td className="fw-500">{vm.name}</td>
                                    <td>
                                        <span style={{ fontFamily: 'monospace', fontSize: '11px', padding: '3px 8px', background: 'var(--card-bg-subtle)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                                            {(vm as any).node || 'pve'}
                                        </span>
                                    </td>
                                    {isTeacher && (
                                        <td style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                                            {(vm as any).owner ? (vm as any).owner.slice(0, 8) + '...' : 'Systém'}
                                        </td>
                                    )}
                                    <td>
                                        <span className={`status-badge ${isRunning ? 'status-running' : 'status-stopped'}`}>
                                            <span style={{ 
                                                width: '6px', 
                                                height: '6px', 
                                                borderRadius: '50%', 
                                                backgroundColor: isRunning ? 'var(--success-color)' : 'var(--danger-color)',
                                                marginRight: '6px',
                                                display: 'inline-block' 
                                            }}></span>
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
                                                    onClick={() => onStartVM(String(vm.id), vm.name)}
                                                >
                                                    Spustit
                                                </button>
                                            ) : (
                                                <button 
                                                    className="btn btn-warning btn-sm" 
                                                    onClick={() => onStopVM(String(vm.id), vm.name)}
                                                >
                                                    Zastavit
                                                </button>
                                            )}
                                            
                                            <button 
                                                className="btn btn-primary btn-sm" 
                                                onClick={() => onOpenConsole(String(vm.id))}
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
                                                className="btn btn-danger btn-sm" 
                                                onClick={() => onDeleteVM(String(vm.id), vm.name)}
                                            >
                                                Smazat
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {vms.length === 0 && (
                            <tr>
                                <td colSpan={isTeacher ? 7 : 6} className="text-center text-muted" style={{ padding: '32px' }}>
                                    V clusteru nebyly nalezeny žádné virtuální stroje pro tento účet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
