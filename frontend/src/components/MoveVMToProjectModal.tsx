import { useState, useEffect } from 'react';
import { main } from '../../wailsjs/go/models';
import { Project } from '../types';

interface MoveVMToProjectModalProps {
    isOpen: boolean;
    vm: main.VM | null;
    projects: Project[];
    onClose: () => void;
    onAssign: (vmId: number, projectId: string) => Promise<void>;
    onCreateNewProjectClick: () => void;
}

export function MoveVMToProjectModal({
    isOpen,
    vm,
    projects,
    onClose,
    onAssign,
    onCreateNewProjectClick
}: MoveVMToProjectModalProps) {
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (vm) {
            setSelectedProjectId((vm as any).project_id || '');
        } else {
            setSelectedProjectId('');
        }
        setError('');
    }, [vm, isOpen]);

    if (!isOpen || !vm) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');
        try {
            await onAssign(Number(vm.id), selectedProjectId);
            onClose();
        } catch (err: any) {
            setError(err?.message || 'Přiřazení projektu selhalo');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0 }}>Přiřadit stroj k projektu</h3>
                    <button className="btn btn-secondary btn-sm" onClick={onClose} disabled={isSubmitting}>
                        Zavřít
                    </button>
                </div>

                <div style={{ padding: '10px 14px', background: 'var(--card-bg-subtle)', borderRadius: '6px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                        {vm.name} <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>(VMID: {vm.id})</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Aktuální projekt: {(vm as any).project_name ? (
                            <span style={{ color: (vm as any).project_color || 'var(--primary-color)', fontWeight: 600 }}>
                                {(vm as any).project_name}
                            </span>
                        ) : 'Žádný projekt'}
                    </div>
                </div>

                {error && (
                    <div className="message error" style={{ marginBottom: '14px' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label>Vyberte cílový projekt:</label>
                        <select 
                            value={selectedProjectId}
                            onChange={e => setSelectedProjectId(e.target.value)}
                            disabled={isSubmitting}
                        >
                            <option value="">Bez projektu (Odebrat ze všech projektů)</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name} ({p.vm_ids?.length || 0} strojů)
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', marginBottom: '18px' }}>
                        <button 
                            type="button" 
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                                onClose();
                                onCreateNewProjectClick();
                            }}
                        >
                            + Vytvořit nový projekt...
                        </button>
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
                            Zrušit
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? 'Ukládám...' : 'Uložit přiřazení'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
