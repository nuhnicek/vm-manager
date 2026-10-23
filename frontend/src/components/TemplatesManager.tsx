import { useState } from 'react';
import { main } from '../../wailsjs/go/models';
import { ProxmoxNode } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface TemplatesManagerProps {
    templates: main.Template[];
    vms: main.VM[];
    nodes: ProxmoxNode[];
    token: string;
    onRefresh: () => void;
    onMessage: (msg: string) => void;
    onQuickDeployTemplate?: (templateId: string, node?: string) => void;
}

export function TemplatesManager({ 
    templates, 
    vms, 
    nodes, 
    token, 
    onRefresh, 
    onMessage,
    onQuickDeployTemplate 
}: TemplatesManagerProps) {
    const [activeAction, setActiveAction] = useState<'none' | 'convert' | 'clone'>('none');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedNodeFilter, setSelectedNodeFilter] = useState<string>('');

    const [convertVMKey, setConvertVMKey] = useState<string>('');
    const [cloneSourceVMKey, setCloneSourceVMKey] = useState<string>('');
    const [cloneName, setCloneName] = useState<string>('');
    const [cloneTargetNode, setCloneTargetNode] = useState<string>('');
    const [cloneRAM, setCloneRAM] = useState<number>(2048);
    const [cloneDescription, setCloneDescription] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);

    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        message: '',
        onConfirm: () => {}
    });

    const handleConvert = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!convertVMKey || isProcessing) return;
        setIsProcessing(true);
        try {
            const [nodeName, idStr] = convertVMKey.includes(':') 
                ? convertVMKey.split(':') 
                : ['', convertVMKey];
            const vmid = Number(idStr);
            const payload = { vmid, node: nodeName };
            let resp: Response;
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
            onMessage(`Virtuální stroj ${vmid} (${nodeName || 'pve'}) byl úspěšně převeden na šablonu`);
            setActiveAction('none');
            setConvertVMKey('');
            onRefresh();
        } catch (err: any) {
            onMessage(`Chyba při převodu VM: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCloneAsTemplate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!cloneSourceVMKey || !cloneName.trim() || isProcessing) return;
        setIsProcessing(true);
        try {
            const [sourceNode, idStr] = cloneSourceVMKey.includes(':') 
                ? cloneSourceVMKey.split(':') 
                : ['', cloneSourceVMKey];
            const sourceVmid = Number(idStr);
            const payload = {
                source_vmid: sourceVmid,
                source_node: sourceNode,
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
            onMessage(`Šablona ${cloneName} byla úspěšně vytvořena z VM ${sourceVmid}`);
            setActiveAction('none');
            setCloneSourceVMKey('');
            setCloneName('');
            setCloneDescription('');
            onRefresh();
        } catch (err: any) {
            onMessage(`Chyba při vytváření šablony: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteTemplate = (tpl: main.Template) => {
        const tplNode = (tpl as any).node || 'pve1';
        setConfirmDialog({
            isOpen: true,
            message: `Opravdu chcete SMAZAT šablonu ${tpl.name} (VMID: ${tpl.id}) na uzlu ${tplNode}? Tato akce trvale odstraní diskový obraz šablony.`,
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                try {
                    let resp: Response;
                    const payload = { vmid: Number(tpl.id), node: tplNode };
                    try {
                        resp = await fetch('/vms/delete', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': token },
                            body: JSON.stringify(payload)
                        });
                    } catch {
                        resp = await fetch('http://10.0.10.52:8080/vms/delete', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': token },
                            body: JSON.stringify(payload)
                        });
                    }
                    if (!resp.ok) {
                        const err = await resp.json().catch(() => ({}));
                        throw new Error(err.error || `Failed with status ${resp.status}`);
                    }
                    onMessage(`Šablona ${tpl.name} byla úspěšně smazána`);
                    onRefresh();
                } catch (err: any) {
                    onMessage(`Smazání šablony selhalo: ${err.message}`);
                }
            }
        });
    };

    const filteredTemplates = templates.filter(tpl => {
        const tplNode = (tpl as any).node;
        if (selectedNodeFilter && tplNode !== selectedNodeFilter) return false;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            const matchName = tpl.name.toLowerCase().includes(q);
            const matchId = String(tpl.id).includes(q);
            const matchNode = (tplNode || '').toLowerCase().includes(q);
            if (!matchName && !matchId && !matchNode) return false;
        }
        return true;
    });

    return (
        <div className="card">
            <ConfirmModal 
                isOpen={confirmDialog.isOpen}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h3 style={{ margin: 0 }}>Šablony Proxmox Clusteru ({templates.length})</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                        Základní obrazy virtuálních strojů dostupné napříč uzly clusteru pro nasazování laboratoří a instancí
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => setActiveAction(prev => prev === 'convert' ? 'none' : 'convert')}
                    >
                        {activeAction === 'convert' ? 'Zavřít formulář' : 'Převést VM na šablonu'}
                    </button>
                    <button 
                        className="btn btn-primary btn-sm"
                        onClick={() => setActiveAction(prev => prev === 'clone' ? 'none' : 'clone')}
                    >
                        {activeAction === 'clone' ? 'Zavřít formulář' : '+ Klonovat jako šablonu'}
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={onRefresh}>
                        Obnovit
                    </button>
                </div>
            </div>

            {activeAction === 'convert' && (
                <div style={{ padding: '16px', backgroundColor: 'var(--card-bg-subtle)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '18px' }}>
                    <h4 style={{ margin: '0 0 8px 0' }}>Převést existující virtuální stroj na šablonu (In-Place)</h4>
                    <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                        Převede existující zastavený virtuální stroj přímo na neměnnou šablonu v Proxmox VE.
                    </p>
                    <form onSubmit={handleConvert} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '240px' }}>
                            <label>Vyberte VM k převodu</label>
                            <select 
                                value={convertVMKey} 
                                onChange={e => setConvertVMKey(e.target.value)}
                                required
                            >
                                <option value="">Vyberte virtuální stroj...</option>
                                {vms.map(v => {
                                    const nodeName = (v as any).node || 'pve1';
                                    const keyVal = `${nodeName}:${v.id}`;
                                    return (
                                        <option key={keyVal} value={keyVal}>
                                            {v.name} (VMID: {v.id}) - Uzel: {nodeName} [{v.status === 'Running' ? 'Běží' : 'Zastaveno'}]
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                        <button type="submit" className="btn btn-primary btn-sm" disabled={!convertVMKey || isProcessing}>
                            {isProcessing ? 'Převádění...' : 'Převést na šablonu'}
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveAction('none')}>
                            Zrušit
                        </button>
                    </form>
                </div>
            )}

            {activeAction === 'clone' && (
                <div style={{ padding: '16px', backgroundColor: 'var(--card-bg-subtle)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '18px' }}>
                    <h4 style={{ margin: '0 0 8px 0' }}>Klonovat VM jako novou šablonu Proxmox (víceuzlové)</h4>
                    <form onSubmit={handleCloneAsTemplate}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>Zdrojový virtuální stroj</label>
                                <select 
                                    value={cloneSourceVMKey} 
                                    onChange={e => setCloneSourceVMKey(e.target.value)}
                                    required
                                >
                                    <option value="">Vyberte zdrojový virtuální stroj...</option>
                                    {vms.map(v => {
                                        const nodeName = (v as any).node || 'pve1';
                                        const keyVal = `${nodeName}:${v.id}`;
                                        return (
                                            <option key={keyVal} value={keyVal}>
                                                {v.name} (VMID: {v.id}) - Uzel: {nodeName}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>Název nové šablony</label>
                                <input 
                                    type="text" 
                                    value={cloneName}
                                    onChange={e => setCloneName(e.target.value)}
                                    placeholder="např. debian12-networking"
                                    required
                                />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>Cílový uzel</label>
                                <select 
                                    value={cloneTargetNode} 
                                    onChange={e => setCloneTargetNode(e.target.value)}
                                >
                                    <option value="">Automatické vyvážení zátěže</option>
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
                            <label>Popis a poznámky k obrazu</label>
                            <input 
                                type="text" 
                                value={cloneDescription}
                                onChange={e => setCloneDescription(e.target.value)}
                                placeholder="Předinstalované balíčky, síťové nástroje nebo účel šablony..."
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveAction('none')}>
                                Zrušit
                            </button>
                            <button type="submit" className="btn btn-primary btn-sm" disabled={!cloneSourceVMKey || !cloneName.trim() || isProcessing}>
                                {isProcessing ? 'Klonování a vytváření...' : 'Vytvořit klonovanou šablonu'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="filter-bar">
                <input 
                    type="text"
                    className="search-input"
                    placeholder="Hledat šablonu podle názvu, VMID nebo uzlu..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />

                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    <button 
                        className={`btn btn-sm ${selectedNodeFilter === '' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setSelectedNodeFilter('')}
                    >
                        Všechny uzly ({templates.length})
                    </button>
                    {nodes.map(n => {
                        const count = templates.filter(t => (t as any).node === n.name).length;
                        return (
                            <button 
                                key={n.name}
                                className={`btn btn-sm ${selectedNodeFilter === n.name ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setSelectedNodeFilter(prev => prev === n.name ? '' : n.name)}
                            >
                                {n.name} ({count})
                            </button>
                        );
                    })}
                </div>

                {(searchQuery || selectedNodeFilter) && (
                    <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                            setSearchQuery('');
                            setSelectedNodeFilter('');
                        }}
                    >
                        Vymazat filtr
                    </button>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                {filteredTemplates.map(tpl => {
                    const tplNode = (tpl as any).node;
                    const cardKey = tplNode ? `${tplNode}-${tpl.id}` : String(tpl.id);
                    return (
                        <div 
                            key={cardKey} 
                            className="node-card"
                            style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                        >
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                    <div>
                                        <strong style={{ fontSize: '15px' }}>{tpl.name}</strong>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                            UUID: <span className="mono-tag">{tpl.uuid || `tpl-${tpl.id}`}</span>
                                        </div>
                                    </div>
                                    <span className="mono-tag" style={{ color: 'var(--primary-color)', fontWeight: 600 }}>
                                        VMID: {tpl.id}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
                                    <span className="status-badge status-running">
                                        <span className="status-badge-dot"></span>
                                        PŘIPRAVENO
                                    </span>
                                    {tplNode && (
                                        <span className="mono-tag">
                                            Uzel: {tplNode}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', marginTop: '6px' }}>
                                {onQuickDeployTemplate ? (
                                    <button 
                                        className="btn btn-primary btn-sm"
                                        onClick={() => onQuickDeployTemplate(String(tpl.id), tplNode)}
                                        title="Rychlé vytvoření instance z této šablony"
                                    >
                                        Nasadit VM
                                    </button>
                                ) : (
                                    <span></span>
                                )}
                                <button 
                                    className="btn btn-danger btn-sm"
                                    onClick={() => handleDeleteTemplate(tpl)}
                                    title="Odstranit šablonu z clusteru"
                                >
                                    Smazat
                                </button>
                            </div>
                        </div>
                    );
                })}
                {filteredTemplates.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                        Nebyly nalezeny žádné šablony odpovídající filtru.
                    </div>
                )}
            </div>
        </div>
    );
}
