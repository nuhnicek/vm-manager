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
                    <h4 style={{ margin: 0 }}>Správa sítě pro {vm.name}</h4>
                    <button className="btn btn-sm btn-success" onClick={onAddNIC}>+ Přidat síťovou kartu</button>
                </div>

                <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
                    <h5>Síťová rozhraní</h5>
                    {(vm.available_nics || []).length === 0 ? (
                        <p className="text-muted" style={{ fontSize: '14px' }}>Nejsou nakonfigurována žádná síťová rozhraní.</p>
                    ) : (
                        <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
                            {(vm.available_nics || []).map(nic => {
                                const netDesc = (vm.networks || []).find(n => n.startsWith(nic + ':'));
                                return (
                                    <li key={nic} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
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
                                            title={`Odebrat ${nic} ze stroje ${vm.name}`}
                                        >
                                            Odebrat rozhraní
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
                
                <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
                    <h5>Aktivní síťová propojení</h5>
                    {(vm.connections || []).length === 0 ? (
                        <p className="text-muted">Zatím žádná síťová propojení.</p>
                    ) : (
                        <ul style={{ listStyleType: 'none', padding: 0 }}>
                            {(vm.connections || []).map(conn => {
                                const cVm = allVMs.find(v => String(v.id) === String(conn.target_vm_id));
                                return (
                                    <li key={conn.target_vm_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                                        <div style={{ fontFamily: 'monospace', fontSize: '14px' }}>
                                            <strong>{vm.name}</strong> [<code>{conn.local_nic}</code>] 
                                            <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>&lt;----&gt;</span> 
                                            [<code>{conn.target_nic}</code>] <strong>{cVm ? cVm.name : conn.target_vm_id}</strong>
                                        </div>
                                        <button className="btn btn-sm btn-danger" onClick={() => onDisconnect(String(conn.target_vm_id))}>Odpojit</button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {availableVMsToConnect.length > 0 && unusedLocalNICs.length > 0 && (
                    <form onSubmit={handleConnectSubmit} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', marginTop: '1.5rem', backgroundColor: 'var(--card-bg-subtle)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label>Lokální rozhraní:</label>
                            <select value={localNic} onChange={(e) => setLocalNic(e.target.value)} required>
                                <option value="">-- Vybrat --</option>
                                {unusedLocalNICs.map(nic => (
                                    <option key={nic} value={nic}>{nic}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                            <label>Připojit k VM:</label>
                            <select 
                                value={connectionTargetId} 
                                onChange={(e) => setConnectionTargetId(e.target.value)}
                                required
                            >
                                <option value="">-- Vybrat cílový virtuální stroj --</option>
                                {availableVMsToConnect.map(v => {
                                    const uNics = getUnusedNICs(v);
                                    return (
                                        <option key={v.id} value={String(v.id)} disabled={uNics.length === 0}>
                                            {v.name} (VMID: {v.id}, {uNics.length} rozhraní k dispozici)
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                        {connectionTargetId && unusedTargetNICs.length > 0 && (
                            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                <label>Cílové rozhraní:</label>
                                <select value={targetNic} onChange={(e) => setTargetNic(e.target.value)} required>
                                    <option value="">-- Vybrat --</option>
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
                            Propojit
                        </button>
                    </form>
                )}
                
                {unusedLocalNICs.length === 0 && (
                    <p className="text-muted" style={{ marginTop: '1rem', fontStyle: 'italic' }}>
                        Nejsou k dispozici žádná volná rozhraní. Pro vytvoření dalších propojení přidejte novou virtuální síťovou kartu.
                    </p>
                )}

                <div className="modal-actions" style={{ marginTop: '2rem' }}>
                    <button 
                        className="btn btn-secondary" 
                        onClick={onClose}
                    >
                        Zavřít
                    </button>
                </div>
            </div>
        </div>
    );
}
