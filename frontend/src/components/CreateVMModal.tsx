import { useState, useEffect, useMemo } from 'react';
import { main } from '../../wailsjs/go/models';
import { ProxmoxNode, Project } from '../types';

interface CreateVMModalProps {
    isOpen: boolean;
    templates: main.Template[];
    nodes?: ProxmoxNode[];
    projects?: Project[];
    selectedProjectId?: string;
    onCreateVM: (name: string, templateId: string, node?: string, projectId?: string) => Promise<void>;
    onClose: () => void;
    userRole?: string;
}

export function CreateVMModal({
    isOpen,
    templates,
    nodes = [],
    projects = [],
    selectedProjectId,
    onCreateVM,
    onClose,
    userRole
}: CreateVMModalProps) {
    const isTeacher = userRole === 'teacher';
    const [name, setName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
    const [selectedNode, setSelectedNode] = useState('');
    const [assignedProjectId, setAssignedProjectId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setName('');
            setSearchTerm('');
            setError('');
            if (selectedProjectId && selectedProjectId !== 'all' && selectedProjectId !== 'none') {
                setAssignedProjectId(selectedProjectId);
            } else {
                setAssignedProjectId('');
            }
            if (templates.length > 0 && !selectedTemplateKey) {
                const first = templates[0];
                const nodePart = (first as any).node || '';
                setSelectedTemplateKey(nodePart ? `${nodePart}:${first.id}` : `${first.id}:${first.name}`);
            }
        }
    }, [isOpen, selectedProjectId, templates]);

    const filteredTemplates = useMemo(() => {
        if (!searchTerm.trim()) {
            return templates;
        }
        const term = searchTerm.toLowerCase().trim();
        return templates.filter(t => {
            const nameMatch = t.name.toLowerCase().includes(term);
            const idMatch = String(t.id).includes(term);
            const nodeMatch = (t as any).node ? (t as any).node.toLowerCase().includes(term) : false;
            return nameMatch || idMatch || nodeMatch;
        });
    }, [templates, searchTerm]);

    useEffect(() => {
        if (filteredTemplates.length > 0) {
            const exists = filteredTemplates.some(t => {
                const nodePart = (t as any).node || '';
                const val = nodePart ? `${nodePart}:${t.id}` : `${t.id}:${t.name}`;
                return val === selectedTemplateKey;
            });
            if (!exists) {
                const first = filteredTemplates[0];
                const nodePart = (first as any).node || '';
                setSelectedTemplateKey(nodePart ? `${nodePart}:${first.id}` : `${first.id}:${first.name}`);
            }
        }
    }, [filteredTemplates, selectedTemplateKey]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError('Zadejte název virtuálního stroje');
            return;
        }
        if (!selectedTemplateKey) {
            setError('Vyberte šablonu pro vytvoření VM');
            return;
        }

        setIsSubmitting(true);
        setError('');
        try {
            let tplNode = selectedNode;
            let tplId = selectedTemplateKey;
            if (selectedTemplateKey.includes(':')) {
                const parts = selectedTemplateKey.split(':');
                if (isNaN(Number(parts[0]))) {
                    if (!tplNode) tplNode = parts[0];
                    tplId = parts[1];
                } else {
                    tplId = parts[0];
                }
            }
            if (!tplNode) {
                const found = templates.find(t => {
                    const np = (t as any).node || '';
                    return `${np}:${t.id}` === selectedTemplateKey || `${t.id}:${t.name}` === selectedTemplateKey || String(t.id) === selectedTemplateKey;
                });
                if (found && (found as any).node) {
                    tplNode = (found as any).node;
                }
            }

            await onCreateVM(name.trim(), tplId, tplNode, assignedProjectId || undefined);
            onClose();
        } catch (err: any) {
            setError(err?.message || 'Vytvoření virtuálního stroje selhalo');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0 }}>Vytvořit nový virtuální stroj</h3>
                    <button className="btn btn-secondary btn-sm" onClick={onClose} disabled={isSubmitting}>
                        Zavřít (&times;)
                    </button>
                </div>

                {error && (
                    <div className="message error" style={{ marginBottom: '14px' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label style={{ fontWeight: 600 }}>Název nového VM:</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="např. debian-lab1, webserver, eve-ng-student..."
                            disabled={isSubmitting}
                            autoFocus
                            required
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <label style={{ fontWeight: 600, margin: 0 }}>Výběr šablony ({templates.length}):</label>
                            {searchTerm && (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    Nalezeno: {filteredTemplates.length}
                                </span>
                            )}
                        </div>

                        <div style={{ position: 'relative', marginBottom: '8px' }}>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Hledat šablonu podle názvu, VMID či uzlu..."
                                disabled={isSubmitting}
                                style={{ width: '100%', boxSizing: 'border-box', paddingRight: searchTerm ? '32px' : '10px' }}
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    style={{
                                        position: 'absolute',
                                        right: '8px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer',
                                        padding: '4px',
                                        fontSize: '14px'
                                    }}
                                    title="Vymazat hledání"
                                >
                                    &times;
                                </button>
                            )}
                        </div>

                        <div style={{
                            maxHeight: '220px',
                            overflowY: 'auto',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            backgroundColor: 'var(--input-bg)',
                            padding: '6px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                        }}>
                            {filteredTemplates.length === 0 ? (
                                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                                    {templates.length === 0 
                                        ? 'Žádné šablony nejsou k dispozici v clusteru' 
                                        : `Žádná šablona neodpovídá výrazu "${searchTerm}"`}
                                </div>
                            ) : (
                                filteredTemplates.map(t => {
                                    const nodePart = (t as any).node || '';
                                    const key = nodePart ? `${nodePart}:${t.id}` : `${t.id}:${t.name}`;
                                    const isSelected = selectedTemplateKey === key;

                                    return (
                                        <div
                                            key={key}
                                            onClick={() => setSelectedTemplateKey(key)}
                                            style={{
                                                padding: '8px 12px',
                                                borderRadius: '6px',
                                                border: isSelected ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                                                backgroundColor: isSelected ? 'var(--card-bg-subtle)' : 'var(--card-bg)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <input
                                                    type="radio"
                                                    name="template_choice"
                                                    checked={isSelected}
                                                    onChange={() => setSelectedTemplateKey(key)}
                                                    style={{ margin: 0, cursor: 'pointer' }}
                                                />
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-main)' }}>
                                                        {t.name}
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                        VMID: {t.id}
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                {isTeacher && nodePart && (
                                                    <span className="mono-tag" style={{ fontSize: '11px' }}>
                                                        Uzel: {nodePart}
                                                    </span>
                                                )}
                                                {isSelected && (
                                                    <span style={{ fontSize: '11px', color: 'var(--primary-color)', fontWeight: 600 }}>
                                                        Vybráno
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {projects && projects.length > 0 && (
                        <div className="form-group" style={{ marginBottom: '16px' }}>
                            <label style={{ fontWeight: 600 }}>Přiřadit k projektu (volitelné):</label>
                            <select
                                value={assignedProjectId}
                                onChange={e => setAssignedProjectId(e.target.value)}
                                disabled={isSubmitting}
                            >
                                <option value="">Bez projektu</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {isTeacher && nodes.length > 0 && (
                        <div className="form-group" style={{ marginBottom: '16px' }}>
                            <label style={{ fontWeight: 600 }}>Cílový Proxmox uzel:</label>
                            <select
                                value={selectedNode}
                                onChange={e => setSelectedNode(e.target.value)}
                                disabled={isSubmitting}
                            >
                                <option value="">Automatické vyvážení zátěže (Doporučeno)</option>
                                {nodes.map(n => (
                                    <option key={n.name} value={n.name}>
                                        {n.name} [{n.status.toUpperCase()}]
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="modal-actions" style={{ marginTop: '20px' }}>
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
                            Zrušit
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isSubmitting || !name.trim() || !selectedTemplateKey}
                        >
                            {isSubmitting ? 'Vytváření VM...' : 'Vytvořit VM'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
