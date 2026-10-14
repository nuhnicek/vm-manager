import { useState, useEffect } from 'react';
import { main } from '../../wailsjs/go/models';

interface CreateVMCardProps {
    templates: main.Template[];
    onCreateVM: (name: string, templateId: string) => Promise<void>;
}

export function CreateVMCard({ templates, onCreateVM }: CreateVMCardProps) {
    const [name, setName] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (templates.length > 0 && !selectedTemplate) {
            setSelectedTemplate(String(templates[0].id));
        }
    }, [templates, selectedTemplate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTemplate || isSubmitting) return;
        setIsSubmitting(true);
        try {
            await onCreateVM(name, selectedTemplate);
            setName('');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="card">
            <h3>Create New VM</h3>
            <form className="create-form" onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Name:</label>
                    <input 
                        type="text" 
                        value={name} 
                        onChange={(e) => setName(e.target.value)} 
                        placeholder="my-new-vm"
                        disabled={isSubmitting}
                        required
                    />
                </div>
                <div className="form-group">
                    <label>Template:</label>
                    <select 
                        value={selectedTemplate} 
                        onChange={(e) => setSelectedTemplate(e.target.value)}
                        disabled={isSubmitting || templates.length === 0}
                    >
                        {templates.map(t => (
                            <option key={t.id} value={String(t.id)}>
                                {t.name} (VMID: {t.id})
                            </option>
                        ))}
                        {templates.length === 0 && (
                            <option value="">No templates available</option>
                        )}
                    </select>
                </div>
                <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={isSubmitting || templates.length === 0 || !name.trim()}
                >
                    {isSubmitting ? 'Creating VM...' : 'Create VM'}
                </button>
            </form>
        </div>
    );
}
