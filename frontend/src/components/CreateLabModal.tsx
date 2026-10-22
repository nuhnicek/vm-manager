import { useState } from 'react';
import { LabTemplate, LabVMTemplate, LabNetworkLink } from '../types';
import { main } from '../../wailsjs/go/models';

interface CreateLabModalProps {
    isOpen: boolean;
    onClose: () => void;
    templates: main.Template[];
    token: string;
    onLabCreated: (lab: LabTemplate) => void;
}

export function CreateLabModal({ isOpen, onClose, templates, token, onLabCreated }: CreateLabModalProps) {
    const [name, setName] = useState('');
    const [category, setCategory] = useState('Cybersecurity & Architecture');
    const [difficulty, setDifficulty] = useState('Intermediate');
    const [description, setDescription] = useState('');
    const [objectives, setObjectives] = useState<string[]>(['Configure network interfaces', 'Verify packet routing']);
    const [newObjective, setNewObjective] = useState('');

    const [vms, setVms] = useState<LabVMTemplate[]>([
        {
            name: 'Router-Gateway',
            template_id: templates.length > 0 ? Number(templates[0].id) : 101,
            description: 'Core gateway and firewall router',
            ram_mb: 2048,
            default_user: 'root',
            default_password: 'password'
        },
        {
            name: 'Target-Server',
            template_id: templates.length > 0 ? Number(templates[0].id) : 101,
            description: 'Protected host on internal subnet',
            ram_mb: 2048,
            default_user: 'student',
            default_password: 'password'
        }
    ]);

    const [networks, setNetworks] = useState<LabNetworkLink[]>([
        {
            from_vm: 'Router-Gateway',
            from_nic: 'net0',
            to_vm: 'Target-Server',
            to_nic: 'net0',
            label: 'Internal Subnet (10.0.1.0/24)'
        }
    ]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    if (!isOpen) return null;

    const handleAddObjective = () => {
        if (!newObjective.trim()) return;
        setObjectives(prev => [...prev, newObjective.trim()]);
        setNewObjective('');
    };

    const handleRemoveObjective = (index: number) => {
        setObjectives(prev => prev.filter((_, i) => i !== index));
    };

    const handleAddVM = () => {
        const nextId = vms.length + 1;
        setVms(prev => [
            ...prev,
            {
                name: `Node-${nextId}`,
                template_id: templates.length > 0 ? Number(templates[0].id) : 101,
                description: 'Lab virtual machine',
                ram_mb: 2048,
                default_user: 'student',
                default_password: 'password'
            }
        ]);
    };

    const handleUpdateVM = (index: number, field: keyof LabVMTemplate, value: any) => {
        setVms(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const handleRemoveVM = (index: number) => {
        const removedName = vms[index]?.name;
        setVms(prev => prev.filter((_, i) => i !== index));
        if (removedName) {
            setNetworks(prev => prev.filter(n => n.from_vm !== removedName && n.to_vm !== removedName));
        }
    };

    const handleAddNetwork = () => {
        if (vms.length < 2) return;
        setNetworks(prev => [
            ...prev,
            {
                from_vm: vms[0].name,
                from_nic: 'net0',
                to_vm: vms[1].name,
                to_nic: 'net0',
                label: `Point-to-Point Link ${prev.length + 1}`
            }
        ]);
    };

    const handleUpdateNetwork = (index: number, field: keyof LabNetworkLink, value: any) => {
        setNetworks(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const handleRemoveNetwork = (index: number) => {
        setNetworks(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        if (!name.trim()) {
            setErrorMsg('Lab scenario name is required');
            return;
        }
        if (vms.length === 0) {
            setErrorMsg('At least one virtual machine is required in the lab');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                name: name.trim(),
                category,
                difficulty,
                description: description.trim(),
                objectives,
                vms,
                networks
            };

            let resp: Response;
            try {
                resp = await fetch('/labs/templates', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token
                    },
                    body: JSON.stringify(payload)
                });
            } catch {
                resp = await fetch('http://localhost:8080/labs/templates', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token
                    },
                    body: JSON.stringify(payload)
                });
            }

            if (!resp.ok) {
                const errData = await resp.json().catch(() => ({}));
                throw new Error(errData.error || `Server responded with ${resp.status}`);
            }

            const createdLab = await resp.json();
            onLabCreated(createdLab);
            onClose();
        } catch (err: any) {
            setErrorMsg(err.message || 'Failed to create lab template');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div 
                className="modal" 
                style={{ maxWidth: '820px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0 }}>Create Networking & Cybersecurity Lab Scenario</h3>
                    <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
                </div>

                {errorMsg && (
                    <div className="message error" style={{ marginBottom: '16px' }}>
                        {errorMsg}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label>Lab Name</label>
                            <input 
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g. BGP Routing & Traffic Hijack"
                                required
                            />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label>Category</label>
                            <select value={category} onChange={e => setCategory(e.target.value)}>
                                <option value="Cybersecurity & Architecture">Cybersecurity & Architecture</option>
                                <option value="Networking">Networking</option>
                                <option value="Offensive Security">Offensive Security</option>
                                <option value="Systems Administration">Systems Administration</option>
                            </select>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label>Difficulty</label>
                            <select value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                                <option value="Beginner">Beginner</option>
                                <option value="Intermediate">Intermediate</option>
                                <option value="Advanced">Advanced</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '12px' }}>
                        <label>Description & Scenario Brief</label>
                        <textarea 
                            rows={3}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Describe the architectural challenge, threat model, or networking exercise..."
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
                        />
                    </div>

                    <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                        <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>Learning Objectives</label>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                            <input 
                                type="text"
                                value={newObjective}
                                onChange={e => setNewObjective(e.target.value)}
                                placeholder="Add specific task or milestone..."
                                style={{ flex: 1 }}
                            />
                            <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddObjective}>
                                Add Objective
                            </button>
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px' }}>
                            {objectives.map((obj, i) => (
                                <li key={i} style={{ marginBottom: '4px' }}>
                                    <span>{obj}</span>
                                    <button 
                                        type="button" 
                                        onClick={() => handleRemoveObjective(i)}
                                        style={{ marginLeft: '8px', border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}
                                    >
                                        [remove]
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <strong style={{ fontSize: '14px' }}>Virtual Machines in Topology ({vms.length})</strong>
                            <button type="button" className="btn btn-primary btn-sm" onClick={handleAddVM}>
                                + Add Machine
                            </button>
                        </div>

                        {vms.map((vm, idx) => (
                            <div 
                                key={idx} 
                                style={{ 
                                    padding: '10px', 
                                    borderRadius: '6px', 
                                    border: '1px solid #e5e7eb', 
                                    backgroundColor: '#ffffff',
                                    marginBottom: '8px' 
                                }}
                            >
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr auto', gap: '8px', alignItems: 'center' }}>
                                    <div>
                                        <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Role Name</label>
                                        <input 
                                            type="text"
                                            value={vm.name}
                                            onChange={e => handleUpdateVM(idx, 'name', e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Base Template</label>
                                        <select 
                                            value={vm.template_id}
                                            onChange={e => handleUpdateVM(idx, 'template_id', Number(e.target.value))}
                                        >
                                            {templates.map(t => (
                                                <option key={t.id} value={Number(t.id)}>
                                                    {t.name} (VMID: {t.id})
                                                </option>
                                            ))}
                                            {templates.length === 0 && (
                                                <option value={101}>eve-ng (VMID 101)</option>
                                            )}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>RAM (MB)</label>
                                        <input 
                                            type="number"
                                            value={vm.ram_mb || 2048}
                                            onChange={e => handleUpdateVM(idx, 'ram_mb', Number(e.target.value))}
                                            step={512}
                                            min={512}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Default User</label>
                                        <input 
                                            type="text"
                                            value={vm.default_user || ''}
                                            onChange={e => handleUpdateVM(idx, 'default_user', e.target.value)}
                                            placeholder="root"
                                        />
                                    </div>
                                    <div style={{ paddingTop: '16px' }}>
                                        <button 
                                            type="button" 
                                            className="btn btn-danger btn-sm"
                                            onClick={() => handleRemoveVM(idx)}
                                            disabled={vms.length <= 1}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <strong style={{ fontSize: '14px' }}>Network Links & Interconnects ({networks.length})</strong>
                            <button 
                                type="button" 
                                className="btn btn-secondary btn-sm" 
                                onClick={handleAddNetwork}
                                disabled={vms.length < 2}
                            >
                                + Add Link
                            </button>
                        </div>

                        {networks.map((net, idx) => (
                            <div 
                                key={idx} 
                                style={{ 
                                    padding: '8px', 
                                    borderRadius: '6px', 
                                    border: '1px solid #e5e7eb', 
                                    backgroundColor: '#ffffff',
                                    marginBottom: '6px',
                                    display: 'grid',
                                    gridTemplateColumns: '2fr 1fr 2fr 1fr 2fr auto',
                                    gap: '8px',
                                    alignItems: 'center'
                                }}
                            >
                                <div>
                                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>From VM</label>
                                    <select 
                                        value={net.from_vm}
                                        onChange={e => handleUpdateNetwork(idx, 'from_vm', e.target.value)}
                                    >
                                        {vms.map(v => (
                                            <option key={v.name} value={v.name}>{v.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>NIC</label>
                                    <input 
                                        type="text"
                                        value={net.from_nic || 'net0'}
                                        onChange={e => handleUpdateNetwork(idx, 'from_nic', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>To VM</label>
                                    <select 
                                        value={net.to_vm}
                                        onChange={e => handleUpdateNetwork(idx, 'to_vm', e.target.value)}
                                    >
                                        {vms.map(v => (
                                            <option key={v.name} value={v.name}>{v.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>NIC</label>
                                    <input 
                                        type="text"
                                        value={net.to_nic || 'net0'}
                                        onChange={e => handleUpdateNetwork(idx, 'to_nic', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Segment Label</label>
                                    <input 
                                        type="text"
                                        value={net.label || ''}
                                        onChange={e => handleUpdateNetwork(idx, 'label', e.target.value)}
                                        placeholder="e.g. DMZ or LAN"
                                    />
                                </div>
                                <div style={{ paddingTop: '16px' }}>
                                    <button 
                                        type="button" 
                                        className="btn btn-danger btn-sm"
                                        onClick={() => handleRemoveNetwork(idx)}
                                    >
                                        X
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? 'Saving Lab Blueprint...' : 'Save & Publish Lab Scenario'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
