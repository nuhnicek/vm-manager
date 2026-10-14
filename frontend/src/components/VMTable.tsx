import { main } from '../../wailsjs/go/models';

interface VMTableProps {
    vms: main.VM[];
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
    isRefreshing,
    onRefresh,
    onStartVM,
    onStopVM,
    onOpenConsole,
    onManageNetworking,
    onDeleteVM,
}: VMTableProps) {
    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>Existing VMs</h3>
                <button 
                    className="btn btn-secondary btn-sm" 
                    onClick={onRefresh} 
                    title="Reload VMs from Proxmox"
                    disabled={isRefreshing}
                >
                    {isRefreshing ? 'Refreshing...' : '↻ Refresh'}
                </button>
            </div>
            <table className="vm-table">
                <thead>
                    <tr>
                        <th>VMID</th>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Network Links</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                {vms.map((vm) => (
                    <tr key={vm.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{vm.id}</td>
                        <td className="fw-500">{vm.name}</td>
                        <td>
                            <span className={`status-badge ${vm.status === 'Running' ? 'status-running' : 'status-stopped'}`}>
                                {vm.status || 'Stopped'}
                            </span>
                        </td>
                        <td>
                            {(vm.connections || []).length === 0 ? (
                                <span className="text-muted">None</span>
                            ) : (
                                <ul style={{ listStyleType: 'none', padding: 0, margin: 0, fontSize: '12px', fontFamily: 'monospace' }}>
                                    {(vm.connections || []).map(conn => {
                                        const tVm = vms.find(v => String(v.id) === String(conn.target_vm_id));
                                        return (
                                            <li key={conn.target_vm_id} style={{ whiteSpace: 'nowrap' }}>
                                                [{conn.local_nic}] &rarr; [{conn.target_nic}] {tVm ? tVm.name : conn.target_vm_id}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </td>
                        <td>
                            <div className="action-buttons">
                                {vm.status === 'Running' ? (
                                    <>
                                        <button 
                                            className="btn btn-sm btn-warning"
                                            onClick={() => onStopVM(String(vm.id), vm.name)}
                                        >
                                            Stop
                                        </button>
                                        <button 
                                            className="btn btn-sm btn-primary"
                                            onClick={() => onOpenConsole(String(vm.id))}
                                        >
                                            Console
                                        </button>
                                    </>
                                ) : (
                                    <button 
                                        className="btn btn-sm btn-success"
                                        onClick={() => onStartVM(String(vm.id), vm.name)}
                                    >
                                        Start
                                    </button>
                                )}
                                <button 
                                    className="btn btn-sm btn-secondary ml-2"
                                    onClick={() => onManageNetworking(vm)}
                                >
                                    Networking
                                </button>
                                <button 
                                    className="btn btn-sm btn-danger ml-2"
                                    onClick={() => onDeleteVM(String(vm.id), vm.name)}
                                >
                                    Delete
                                </button>
                            </div>
                        </td>
                    </tr>
                ))}
                {vms.length === 0 && (
                    <tr>
                        <td colSpan={5} className="text-center text-muted" style={{ padding: '24px' }}>
                            No VMs found on Proxmox for this account.
                        </td>
                    </tr>
                )}
                </tbody>
            </table>
        </div>
    );
}
