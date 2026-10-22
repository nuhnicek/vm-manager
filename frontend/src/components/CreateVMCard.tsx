import { useState, useEffect } from 'react';
import { main } from '../../wailsjs/go/models';
import { ProxmoxNode } from '../types';

interface CreateVMCardProps {
    templates: main.Template[];
    nodes?: ProxmoxNode[];
    onCreateVM: (name: string, templateId: string, node?: string) => Promise<void>;
    userRole?: string;
}

export function CreateVMCard({ templates, nodes = [], onCreateVM, userRole }: CreateVMCardProps) {
    const [name, setName] = useState('');
    const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
    const [selectedNode, setSelectedNode] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (templates.length > 0) {
            const exists = templates.some(t => {
                const nodePart = (t as any).node || '';
                const val = nodePart ? `${nodePart}:${t.id}` : `${t.id}:${t.name}`;
                return val === selectedTemplateKey;
            });
            if (!selectedTemplateKey || !exists) {
                const first = templates[0];
                const nodePart = (first as any).node || '';
                setSelectedTemplateKey(nodePart ? `${nodePart}:${first.id}` : `${first.id}:${first.name}`);
            }
        } else {
            setSelectedTemplateKey('');
        }
    }, [templates, selectedTemplateKey]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTemplateKey || isSubmitting) return;
        setIsSubmitting(true);
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
            await onCreateVM(name, tplId, tplNode);
            setName('');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="card">
            <h3>Vytvořit nový virtuální stroj</h3>
            <form className="create-form" onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Název VM:</label>
                    <input 
                        type="text" 
                        value={name} 
                        onChange={(e) => setName(e.target.value)} 
                        placeholder="např. debian-lab1"
                        disabled={isSubmitting}
                        required
                    />
                </div>
                <div className="form-group">
                    <label>Šablona:</label>
                    <select 
                        value={selectedTemplateKey} 
                        onChange={(e) => setSelectedTemplateKey(e.target.value)}
                        disabled={isSubmitting || templates.length === 0}
                    >
                        {templates.map(t => {
                            const nodePart = (t as any).node || '';
                            const optionValue = nodePart ? `${nodePart}:${t.id}` : `${t.id}:${t.name}`;
                            const isTeacher = userRole === 'teacher';
                            const label = isTeacher && nodePart
                                ? `${t.name} (VMID: ${t.id}, Uzel: ${nodePart})`
                                : `${t.name} (VMID: ${t.id})`;
                            return (
                                <option key={optionValue} value={optionValue}>
                                    {label}
                                </option>
                            );
                        })}
                        {templates.length === 0 && (
                            <option value="">Žádné šablony nejsou k dispozici</option>
                        )}
                    </select>
                </div>
                {userRole === 'teacher' && nodes.length > 0 && (
                    <div className="form-group">
                        <label>Cílový uzel:</label>
                        <select 
                            value={selectedNode}
                            onChange={(e) => setSelectedNode(e.target.value)}
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
                <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={isSubmitting || templates.length === 0 || !name.trim()}
                >
                    {isSubmitting ? 'Vytváření VM...' : 'Vytvořit VM'}
                </button>
            </form>
        </div>
    );
}
