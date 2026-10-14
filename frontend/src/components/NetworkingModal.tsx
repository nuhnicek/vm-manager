import { useState, useEffect } from 'react';
import { main } from '../../wailsjs/go/models';

interface NetworkingModalProps {
    vm: main.VM | null;
    allVMs: main.VM[];
    onClose: () => void;
    onAddNIC: () => void;
    onRemoveNIC: (nic: string) => void;
    onConnect: (localNic: string, targetVmId: string, targetNic: string) => void;
    onDisconnect: (targetVmId: string) => void;
}

export function NetworkingModal({
    vm,
    allVMs,
    onClose,
    onAddNIC,
    onRemoveNIC,
    onConnect,
    onDisconnect,
}: NetworkingModalProps) {
    const [connectionTargetId, setConnectionTargetId] = useState<string>('');
    const [localNic, setLocalNic] = useState<string>('');
    const [targetNic, setTargetNic] = useState<string>('');

    const getUnusedNICs = (targetVM: main.VM) => {
        const used = (targetVM.connections || []).map(c => c.local_nic);
        return (targetVM.available_nics || []).filter(nic => !used.includes(nic));
    };

    useEffect(() => {
        if (vm) {
            const unusedLocal = getUnusedNICs(vm);
            if (!localNic || !unusedLocal.includes(localNic)) {
                setLocalNic(unusedLocal.length > 0 ? unusedLocal[0] : '');
            }
        }
    }, [vm]);

    useEffect(() => {
        if (connectionTargetId) {
            const tgtVM = allVMs.find(v => String(v.id) === String(connectionTargetId));
            if (tgtVM) {
                const unusedTarget = getUnusedNICs(tgtVM);
                if (!targetNic || !unusedTarget.includes(targetNic)) {
                    setTargetNic(unusedTarget.length > 0 ? unusedTarget[0] : '');
                }
            } else {
                setTargetNic('');
            }
        } else {
            setTargetNic('');
        }
    }, [connectionTargetId, allVMs]);

    if (!vm) return null;

    const unusedLocalNICs = getUnusedNICs(vm);
    const availableVMsToConnect = allVMs.filter(v => 
        String(v.id) !== String(vm.id) && 
        !(vm.connections || []).some(c => String(c.target_vm_id) === String(v.id))
    );

    const tgtVM = connectionTargetId ? allVMs.find(v => String(v.id) === String(connectionTargetId)) : null;
    const unusedTargetNICs = tgtVM ? getUnusedNICs(tgtVM) : [];

    const handleConnectSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!connectionTargetId || !localNic || !targetNic) return;
        onConnect(localNic, connectionTargetId, targetNic);
        setConnectionTargetId('');
        setTargetNic('');
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '750px', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0 }}>Networking for {vm.name}</h4>
                    <button className="btn btn-sm btn-success" onClick={onAddNIC}>+ Add Virtual NIC</button>
                </div>

                <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
                    <h5>Network Interfaces</h5>
                    {(vm.available_nics || []).length === 0 ? (
                        <p className="text-muted" style={{ fontSize: '14px' }}>No network interfaces configured.</p>
                    ) : (
                        <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
                            {(vm.available_nics || []).map(nic => {
                                const netDesc = (vm.networks || []).find(n => n.startsWith(nic + ':'));
                                return (
                                    <li key={nic} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                            <code style={{ fontWeight: 600, fontSize: '13px' }}>{nic}</code>
                                            {netDesc && (
                                                <span className="text-muted" style={{ fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {netDesc.replace(nic + ':', '').trim()}
                                                </span>
                                            )}
                                        </div>
                                        <button 
                                            className="btn btn-sm btn-danger" 
                                            onClick={() => onRemoveNIC(nic)}
                                            style={{ padding: '2px 8px', fontSize: '12px', marginLeft: '12px', flexShrink: 0 }}
                                            title={`Remove ${nic} from ${vm.name}`}
                                        >
                                            Remove NIC
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
                
                <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
                    <h5>Current Links</h5>
                    {(vm.connections || []).length === 0 ? (
                        <p className="text-muted">No connections yet.</p>
                    ) : (
                        <ul style={{ listStyleType: 'none', padding: 0 }}>
                            {(vm.connections || []).map(conn => {
                                const cVm = allVMs.find(v => String(v.id) === String(conn.target_vm_id));
                                return (
                                    <li key={conn.target_vm_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                                        <div style={{ fontFamily: 'monospace', fontSize: '14px' }}>
                                            <strong>{vm.name}</strong> [<code>{conn.local_nic}</code>] 
                                            <span style={{ margin: '0 8px', color: '#6b7280' }}>&lt;----&gt;</span> 
                                            [<code>{conn.target_nic}</code>] <strong>{cVm ? cVm.name : conn.target_vm_id}</strong>
                                        </div>
                                        <button className="btn btn-sm btn-danger" onClick={() => onDisconnect(String(conn.target_vm_id))}>Disconnect</button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {availableVMsToConnect.length > 0 && unusedLocalNICs.length > 0 && (
                    <form onSubmit={handleConnectSubmit} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', marginTop: '1.5rem', backgroundColor: '#f9fafb', padding: '16px', borderRadius: '4px' }}>
                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label>Local NIC:</label>
                            <select value={localNic} onChange={(e) => setLocalNic(e.target.value)} required>
                                <option value="">-- Select --</option>
                                {unusedLocalNICs.map(nic => (
                                    <option key={nic} value={nic}>{nic}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                            <label>Connect to VM:</label>
                            <select 
                                value={connectionTargetId} 
                                onChange={(e) => setConnectionTargetId(e.target.value)}
                                required
                            >
                                <option value="">-- Select Target VM --</option>
                                {availableVMsToConnect.map(v => {
                                    const uNics = getUnusedNICs(v);
                                    return (
                                        <option key={v.id} value={String(v.id)} disabled={uNics.length === 0}>
                                            {v.name} (VMID: {v.id}, {uNics.length} NICs available)
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                        {connectionTargetId && unusedTargetNICs.length > 0 && (
                            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                <label>Target NIC:</label>
                                <select value={targetNic} onChange={(e) => setTargetNic(e.target.value)} required>
                                    <option value="">-- Select --</option>
                                    {unusedTargetNICs.map(nic => (
                                        <option key={nic} value={nic}>{nic}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <button 
                            type="submit" 
                            className="btn btn-primary" 
                            style={{ padding: '8px 16px' }} 
                            disabled={!connectionTargetId || !localNic || !targetNic}
                        >
                            Link
                        </button>
                    </form>
                )}
                
                {unusedLocalNICs.length === 0 && (
                    <p className="text-muted" style={{ marginTop: '1rem', fontStyle: 'italic' }}>
                        No available local NICs. Add a new Virtual NIC to establish more links.
                    </p>
                )}

                <div className="modal-actions" style={{ marginTop: '2rem' }}>
                    <button 
                        className="btn btn-secondary" 
                        onClick={onClose}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
