import { useState } from 'react';
import { main } from '../../wailsjs/go/models';
import { ProxmoxNode } from '../types';

interface TemplatesManagerProps {
    templates: main.Template[];
    vms: main.VM[];
    nodes: ProxmoxNode[];
    token: string;
    onRefresh: () => void;
    onMessage: (msg: string) => void;
}

export function TemplatesManager({ templates, vms, nodes, token, onRefresh, onMessage }: TemplatesManagerProps) {
    const [activeAction, setActiveAction] = useState<'none' | 'convert' | 'clone'>('none');

    const [convertVMID, setConvertVMID] = useState<string>('');
    const [cloneSourceVMID, setCloneSourceVMID] = useState<string>('');
    const [cloneName, setCloneName] = useState<string>('');
    const [cloneTargetNode, setCloneTargetNode] = useState<string>('');
    const [cloneRAM, setCloneRAM] = useState<number>(2048);
    const [cloneDescription, setCloneDescription] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleConvert = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!convertVMID || isProcessing) return;
        setIsProcessing(true);
        try {
            let resp: Response;
            const payload = { vmid: Number(convertVMID) };
            try {
                resp = await fetch('/vms/templates/convert', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': token },
                    body: JSON.stringify(payload)
                });
            } catch {
                resp = await fetch('http://10.0.10.52:8080/vms/templates/convert', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': token },
                    body: JSON.stringify(payload)
                });
            }
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.error || `Failed with status ${resp.status}`);
            }
            onMessage(`Virtuální stroj ${convertVMID} byl úspěšně převeden na šablonu`);
            setActiveAction('none');
            setConvertVMID('');
            onRefresh();
        } catch (err: any) {
            onMessage(`Chyba při převodu VM: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCloneAsTemplate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!cloneSourceVMID || !cloneName.trim() || isProcessing) return;
        setIsProcessing(true);
        try {
            const payload = {
                source_vmid: Number(cloneSourceVMID),
                template_name: cloneName.trim(),
                target_node_id: cloneTargetNode,
                description: cloneDescription.trim(),
                ram_mb: Number(cloneRAM)
            };
            let resp: Response;
            try {
                resp = await fetch('/vms/templates/clone-as-template', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': token },
                    body: JSON.stringify(payload)
                });
            } catch {
                resp = await fetch('http://10.0.10.52:8080/vms/templates/clone-as-template', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': token },
                    body: JSON.stringify(payload)
                });
            }
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.error || `Failed with status ${resp.status}`);
            }
            onMessage(`Šablona ${cloneName} byla úspěšně vytvořena z VM ${cloneSourceVMID}`);
            setActiveAction('none');
            setCloneSourceVMID('');
            setCloneName('');
            setCloneDescription('');
            onRefresh();
        } catch (err: any) {
            onMessage(`Chyba při vytváření šablony: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h3 style={{ margin: 0 }}>Šablony Proxmox Clusteru ({templates.length})</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                        Základní obrazy virtuálních strojů dostupné napříč uzly clusteru pro nasazování laboratoří a instancí
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => setActiveAction(prev => prev === 'convert' ? 'none' : 'convert')}
                    >
                        Převést VM na šablonu
                    </button>
                    <button 
                        className="btn btn-primary btn-sm"
                        onClick={() => setActiveAction(prev => prev === 'clone' ? 'none' : 'clone')}
                    >
                        + Klonovat jako šablonu
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={onRefresh}>
                        Obnovit
                    </button>
                </div>
            </div>

            {activeAction === 'convert' && (
                <div style={{ padding: '16px', backgroundColor: 'var(--card-bg-subtle)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                    <h4 style={{ margin: '0 0 8px 0' }}>Převést existující virtuální stroj na šablonu (In-Place)</h4>
                    <form onSubmit={handleConvert} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '220px' }}>
                            <label>Vyberte VM k převodu</label>
                            <select 
                                value={convertVMID} 
                                onChange={e => setConvertVMID(e.target.value)}
                                required
                            >
                                <option value="">Vyberte virtuální stroj...</option>
                                {vms.map(v => (
                                    <option key={v.id} value={String(v.id)}>
                                        {v.name} (VMID: {v.id}) - Uzel: {(v as any).node || 'pve1'} [{v.status === 'Running' ? 'Běží' : 'Zastaveno'}]
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={!convertVMID || isProcessing}>
                            {isProcessing ? 'Převádění...' : 'Převést na šablonu'}
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={() => setActiveAction('none')}>
                            Zrušit
                        </button>
                    </form>
                </div>
            )}

            {activeAction === 'clone' && (
                <div style={{ padding: '16px', backgroundColor: 'var(--card-bg-subtle)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                    <h4 style={{ margin: '0 0 8px 0' }}>Klonovat VM jako novou šablonu Proxmox (víceuzlové)</h4>
                    <form onSubmit={handleCloneAsTemplate}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>Zdrojový virtuální stroj</label>
                                <select 
                                    value={cloneSourceVMID} 
                                    onChange={e => setCloneSourceVMID(e.target.value)}
                                    required
                                >
                                    <option value="">Vyberte zdrojový virtuální stroj...</option>
                                    {vms.map(v => (
                                        <option key={v.id} value={String(v.id)}>
                                            {v.name} (VMID: {v.id}) - Uzel: {(v as any).node || 'pve1'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>Název nové šablony</label>
                                <input 
                                    type="text" 
                                    value={cloneName}
                                    onChange={e => setCloneName(e.target.value)}
                                    placeholder="např. kali-pentest-clean"
                                    required
                                />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>Cílový uzel</label>
                                <select 
                                    value={cloneTargetNode} 
                                    onChange={e => setCloneTargetNode(e.target.value)}
                                >
                                    <option value="">Automatické vyvážení</option>
                                    {nodes.map(n => (
                                        <option key={n.name} value={n.name}>{n.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>RAM (MB)</label>
                                <input 
                                    type="number" 
                                    value={cloneRAM}
                                    onChange={e => setCloneRAM(Number(e.target.value))}
                                    step={512}
                                    min={512}
                                />
                            </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: '12px' }}>
                            <label>Popis a laboratorní poznámky</label>
                            <input 
                                type="text" 
                                value={cloneDescription}
                                onChange={e => setCloneDescription(e.target.value)}
                                placeholder="Nástroje operačního systému, balíčky nebo role..."
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button type="submit" className="btn btn-primary" disabled={!cloneSourceVMID || !cloneName.trim() || isProcessing}>
                                {isProcessing ? 'Klonování a vytváření...' : 'Vytvořit klonovanou šablonu'}
                            </button>
                            <button type="button" className="btn btn-secondary" onClick={() => setActiveAction('none')}>
                                Zrušit
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
                {templates.map(tpl => (
                    <div 
                        key={tpl.id}
                        style={{
                            padding: '14px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--card-bg-subtle)'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <strong style={{ fontSize: '15px' }}>{tpl.name}</strong>
                            <span style={{ fontFamily: 'monospace', fontSize: '12px', padding: '2px 6px', background: 'var(--badge-bg)', borderRadius: '4px' }}>
                                VMID: {tpl.id}
                            </span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            <div>UUID: {tpl.uuid || `tpl-${tpl.id}`}</div>
                            <div style={{ marginTop: '4px' }}>
                                Stav: <span className="status-badge status-running" style={{ fontSize: '10px' }}>Šablona připravena</span>
                            </div>
                        </div>
                    </div>
                ))}
                {templates.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                        Na uzlech Proxmox nebyly nalezeny žádné šablony. Převeďte nebo naklonujte existující VM na šablonu výše.
                    </div>
                )}
            </div>
        </div>
    );
}

