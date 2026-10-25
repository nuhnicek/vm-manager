import { useState, useEffect } from 'react';
import { main } from '../../wailsjs/go/models';
import { Project } from '../types';

interface AssignProjectVMsModalProps {
    isOpen: boolean;
    project: Project | null;
    allVMs: main.VM[];
    onClose: () => void;
    onSaveVMs: (projectId: string, vmIds: number[]) => Promise<void>;
}

export function AssignProjectVMsModal({
    isOpen,
    project,
    allVMs,
    onClose,
    onSaveVMs
}: AssignProjectVMsModalProps) {
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (project && project.vm_ids) {
            setSelectedIds(new Set(project.vm_ids));
        } else {
            setSelectedIds(new Set());
        }
        setSearchQuery('');
        setError('');
    }, [project, isOpen]);

    if (!isOpen || !project) return null;

    const filteredVMs = allVMs.filter(vm => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            vm.name.toLowerCase().includes(q) ||
            String(vm.id).includes(q) ||
            ((vm as any).project_name && (vm as any).project_name.toLowerCase().includes(q))
        );
    });

    const handleToggleVM = (vmid: number) => {
        const next = new Set(selectedIds);
        if (next.has(vmid)) {
            next.delete(vmid);
        } else {
            next.add(vmid);
        }
        setSelectedIds(next);
    };

    const handleSelectAll = () => {
        const next = new Set(selectedIds);
        filteredVMs.forEach(v => next.add(Number(v.id)));
        setSelectedIds(next);
    };

    const handleDeselectAll = () => {
        const next = new Set(selectedIds);
        filteredVMs.forEach(v => next.delete(Number(v.id)));
        setSelectedIds(next);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');
        try {
            await onSaveVMs(project.id, Array.from(selectedIds));
            onClose();
        } catch (err: any) {
            setError(err?.message || 'Uložení přiřazení strojů selhalo');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: project.color || 'var(--primary-color)' }}></span>
                        <h3 style={{ margin: 0 }}>Správa strojů v projektu: {project.name}</h3>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={onClose} disabled={isSubmitting}>
                        Zavřít
                    </button>
                </div>

                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 14px 0' }}>
                    Zaškrtněte virtuální stroje, které mají patřit do tohoto projektu. Každý stroj může náležet nejvýše do jednoho projektu.
                </p>

                {error && (
                    <div className="message error" style={{ marginBottom: '14px' }}>
                        {error}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <input 
                        type="text"
                        className="search-input"
                        placeholder="Hledat stroj podle názvu nebo VMID..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ maxWidth: '320px', flex: 1 }}
                    />
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={handleSelectAll}>
                            Vybrat zobrazené
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={handleDeselectAll}>
                            Zrušit zobrazené
                        </button>
                    </div>
                </div>

                <div style={{ 
                    maxHeight: '360px', 
                    overflowY: 'auto', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '6px',
                    backgroundColor: 'var(--card-bg-subtle)',
                    padding: '8px'
                }}>
                    {filteredVMs.map(vm => {
                        const vmid = Number(vm.id);
                        const isChecked = selectedIds.has(vmid);
                        const otherProj = (vm as any).project_id && (vm as any).project_id !== project.id ? (vm as any).project_name : null;

                        return (
                            <div 
                                key={vmid}
                                onClick={() => handleToggleVM(vmid)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    backgroundColor: isChecked ? 'var(--primary-subtle)' : 'var(--card-bg)',
                                    border: isChecked ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                                    marginBottom: '6px',
                                    cursor: 'pointer',
                                    transition: 'all 0.1s ease'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <input 
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {}}
                                        style={{ cursor: 'pointer' }}
                                    />
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-main)' }}>
                                            {vm.name} <span style={{ fontFamily: 'monospace', fontWeight: 400, color: 'var(--text-muted)' }}>(VMID: {vm.id})</span>
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '8px', marginTop: '2px' }}>
                                            <span>RAM: {vm.ram_mb || 0} MB</span>
                                            <span>Stav: {vm.status}</span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    {otherProj ? (
                                        <span className="mono-tag" style={{ color: 'var(--warning-text)', fontSize: '11px' }}>
                                            Přesunout z: {otherProj}
                                        </span>
                                    ) : isChecked ? (
                                        <span className="mono-tag" style={{ color: 'var(--primary-color)', fontSize: '11px' }}>
                                            V tomto projektu
                                        </span>
                                    ) : (
                                        <span className="mono-tag" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                                            Bez projektu
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {filteredVMs.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                            Nebyly nalezeny žádné virtuální stroje odpovídající hledání.
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Vybráno strojů: <strong>{selectedIds.size}</strong> z {allVMs.length}
                    </div>
                    <div className="modal-actions" style={{ margin: 0 }}>
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
                            Zrušit
                        </button>
                        <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
                            {isSubmitting ? 'Ukládám...' : `Uložit výběr (${selectedIds.size} strojů)`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
