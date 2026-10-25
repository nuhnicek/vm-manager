import { useState, useEffect } from 'react';
import { Project } from '../types';

interface ProjectModalProps {
    isOpen: boolean;
    project?: Project | null;
    onClose: () => void;
    onSave: (name: string, description: string, color: string) => Promise<void>;
}

const COLOR_OPTIONS = [
    '#3b82f6',
    '#10b981',
    '#8b5cf6',
    '#f59e0b',
    '#ef4444',
    '#06b6d4',
    '#ec4899',
    '#64748b'
];

export function ProjectModal({ isOpen, project, onClose, onSave }: ProjectModalProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [color, setColor] = useState('#3b82f6');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (project) {
            setName(project.name || '');
            setDescription(project.description || '');
            setColor(project.color || '#3b82f6');
        } else {
            setName('');
            setDescription('');
            setColor('#3b82f6');
        }
        setError('');
    }, [project, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError('Název projektu nesmí být prázdný');
            return;
        }
        setIsSubmitting(true);
        setError('');
        try {
            await onSave(name.trim(), description.trim(), color);
            onClose();
        } catch (err: any) {
            setError(err?.message || 'Uložení projektu selhalo');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0 }}>
                        {project ? 'Upravit projekt' : 'Vytvořit nový projekt'}
                    </h3>
                    <button className="btn btn-secondary btn-sm" onClick={onClose} disabled={isSubmitting}>
                        Zavřít
                    </button>
                </div>

                {error && (
                    <div className="message error" style={{ marginBottom: '14px' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group" style={{ marginBottom: '14px' }}>
                        <label>Název projektu:</label>
                        <input 
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="např. Webový Stack, Síťové Laborky, Semestrálka..."
                            disabled={isSubmitting}
                            autoFocus
                            required
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: '14px' }}>
                        <label>Popis projektu (volitelné):</label>
                        <textarea 
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Stručný popis účelu projektu, předmětu či topologie..."
                            disabled={isSubmitting}
                            rows={3}
                            style={{ 
                                width: '100%', 
                                padding: '8px 12px', 
                                borderRadius: '6px', 
                                border: '1px solid var(--border-color)', 
                                background: 'var(--input-bg)', 
                                color: 'var(--text-main)',
                                fontFamily: 'inherit',
                                fontSize: '13px',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label>Barva projektu:</label>
                        <div className="color-palette-grid">
                            {COLOR_OPTIONS.map(c => (
                                <button 
                                    key={c}
                                    type="button"
                                    className={`color-palette-circle ${color === c ? 'selected' : ''}`}
                                    style={{ backgroundColor: c }}
                                    onClick={() => setColor(c)}
                                    title={c}
                                />
                            ))}
                        </div>
                    </div>

                    <div style={{ 
                        padding: '10px 14px', 
                        background: 'var(--card-bg-subtle)', 
                        borderRadius: '6px', 
                        border: '1px solid var(--border-color)', 
                        marginBottom: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Náhled štítku:</span>
                        <span className="project-badge" style={{ borderColor: color, color: 'var(--text-main)' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color, display: 'inline-block' }}></span>
                            {name.trim() || 'Název projektu'}
                        </span>
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
                            Zrušit
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={isSubmitting || !name.trim()}>
                            {isSubmitting ? 'Ukládám...' : project ? 'Uložit změny' : 'Vytvořit projekt'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
