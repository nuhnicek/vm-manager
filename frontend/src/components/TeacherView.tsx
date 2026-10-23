import { useState, useEffect, useMemo } from 'react';
import { main } from '../../wailsjs/go/models';
import { LabTemplate, LabInstance, ProxmoxNode, TeacherStudentInfo } from '../types';
import { CreateLabModal } from './CreateLabModal';
import { TemplatesManager } from './TemplatesManager';
import { FleetNodesView } from './FleetNodesView';
import { StudentsManager } from './StudentsManager';
import { ConfirmModal } from './ConfirmModal';
import { NetworkTopologyModal } from './NetworkTopologyModal';

interface TeacherViewProps {
    token: string;
    nodes: ProxmoxNode[];
    templates: main.Template[];
    vms: main.VM[];
    onRefreshNodes: () => void;
    onRefreshVMs: () => void;
    onMessage: (msg: string) => void;
    onStartVM?: (id: string, name: string, node?: string) => void;
    onStopVM?: (id: string, name: string, node?: string) => void;
    onDeleteVM?: (id: string, name: string, node?: string) => void;
    onOpenConsole?: (id: string, node?: string) => void;
}

export function TeacherView({
    token,
    nodes,
    templates,
    vms,
    onRefreshNodes,
    onRefreshVMs,
    onMessage,
    onStartVM,
    onStopVM,
    onDeleteVM,
    onOpenConsole
}: TeacherViewProps) {
    const [activeTab, setActiveTab] = useState<'labs' | 'templates' | 'fleet' | 'students'>('labs');
    const [labTemplates, setLabTemplates] = useState<LabTemplate[]>([]);
    const [labInstances, setLabInstances] = useState<LabInstance[]>([]);
    const [students, setStudents] = useState<TeacherStudentInfo[]>([]);

    const [isLoading, setIsLoading] = useState(false);
    const [isCreateLabOpen, setIsCreateLabOpen] = useState(false);

    const [fleetFilterQuery, setFleetFilterQuery] = useState('');

    const [deployingLab, setDeployingLab] = useState<LabTemplate | null>(null);
    const [deployStudentUUID, setDeployStudentUUID] = useState<string>('');
    const [deployLabPrefix, setDeployLabPrefix] = useState<string>('');
    const [isDeploying, setIsDeploying] = useState(false);
    const [deployProgressText, setDeployProgressText] = useState<string>('');

    const [labTemplateSearch, setLabTemplateSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [instanceSearch, setInstanceSearch] = useState('');
    const [instanceStatusFilter, setInstanceStatusFilter] = useState<'all' | 'running' | 'stopped'>('all');

    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        message: '',
        onConfirm: () => {}
    });

    const [topologyVMs, setTopologyVMs] = useState<main.VM[] | null>(null);

    const fetchLabs = async () => {
        setIsLoading(true);
        try {
            let respTpl: Response;
            try {
                respTpl = await fetch('/labs/templates', { headers: { 'Authorization': token } });
            } catch {
                respTpl = await fetch('http://10.0.10.52:8080/labs/templates', { headers: { 'Authorization': token } });
            }
            if (respTpl.ok) {
                const data = await respTpl.json();
                setLabTemplates(data || []);
            }

            let respInst: Response;
            try {
                respInst = await fetch('/labs/instances', { headers: { 'Authorization': token } });
            } catch {
                respInst = await fetch('http://10.0.10.52:8080/labs/instances', { headers: { 'Authorization': token } });
            }
            if (respInst.ok) {
                const data = await respInst.json();
                setLabInstances(data || []);
            }

            let respStudents: Response;
            try {
                respStudents = await fetch('/teacher/students', { headers: { 'Authorization': token } });
            } catch {
                respStudents = await fetch('http://10.0.10.52:8080/teacher/students', { headers: { 'Authorization': token } });
            }
            if (respStudents.ok) {
                const stData = await respStudents.json();
                setStudents(stData || []);
            }
        } catch (err) {
            console.error('Failed to load teacher lab data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLabs();
    }, [token]);

    const categories = useMemo(() => {
        const set = new Set<string>();
        labTemplates.forEach(t => {
            if (t.category) set.add(t.category);
        });
        return Array.from(set);
    }, [labTemplates]);

    const filteredTemplates = useMemo(() => {
        return labTemplates.filter(lab => {
            const matchesSearch = 
                lab.name.toLowerCase().includes(labTemplateSearch.toLowerCase()) ||
                lab.description?.toLowerCase().includes(labTemplateSearch.toLowerCase()) ||
                lab.category?.toLowerCase().includes(labTemplateSearch.toLowerCase()) ||
                lab.vms?.some(v => v.name.toLowerCase().includes(labTemplateSearch.toLowerCase()));
            const matchesCat = selectedCategory === 'all' || lab.category === selectedCategory;
            return matchesSearch && matchesCat;
        });
    }, [labTemplates, labTemplateSearch, selectedCategory]);

    const filteredInstances = useMemo(() => {
        return labInstances.filter(inst => {
            const matchesSearch =
                inst.lab_name.toLowerCase().includes(instanceSearch.toLowerCase()) ||
                inst.id.toLowerCase().includes(instanceSearch.toLowerCase()) ||
                (inst.owner_email && inst.owner_email.toLowerCase().includes(instanceSearch.toLowerCase())) ||
                inst.vms?.some(v => v.name.toLowerCase().includes(instanceSearch.toLowerCase()) || String(v.vmid).includes(instanceSearch));
            const matchesStatus =
                instanceStatusFilter === 'all' ||
                (instanceStatusFilter === 'running' && inst.status === 'running') ||
                (instanceStatusFilter === 'stopped' && inst.status !== 'running');
            return matchesSearch && matchesStatus;
        });
    }, [labInstances, instanceSearch, instanceStatusFilter]);

    const handleDeploySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!deployingLab || isDeploying) return;
        setIsDeploying(true);

        const deploySingle = async (studentUuid: string, prefix: string) => {
            const payload = {
                template_id: deployingLab.id,
                student_uuid: studentUuid,
                lab_prefix: prefix
            };
            let resp: Response;
            try {
                resp = await fetch('/labs/deploy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': token },
                    body: JSON.stringify(payload)
                });
            } catch {
                resp = await fetch('http://10.0.10.52:8080/labs/deploy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': token },
                    body: JSON.stringify(payload)
                });
            }
            if (!resp.ok) {
                const errData = await resp.json().catch(() => ({}));
                throw new Error(errData.error || `Server responded with ${resp.status}`);
            }
            return await resp.json();
        };

        try {
            if (deployStudentUUID === '__ALL_STUDENTS__') {
                const targetStudents = students.filter(s => s.role === 'student' || !s.role);
                if (targetStudents.length === 0) {
                    throw new Error('V databázi nejsou žádní studenti k hromadnému nasazení.');
                }

                let successCount = 0;
                let failCount = 0;

                for (let i = 0; i < targetStudents.length; i++) {
                    const st = targetStudents[i];
                    setDeployProgressText(`Nasazuji pro ${st.email} (${i + 1}/${targetStudents.length})...`);
                    const studentPrefix = deployLabPrefix.trim() 
                        ? `${deployLabPrefix.trim()}-${st.email.split('@')[0]}`.slice(0, 20)
                        : `${deployingLab.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${st.email.split('@')[0]}`.slice(0, 20);

                    try {
                        await deploySingle(st.uuid, studentPrefix);
                        successCount++;
                    } catch (err: any) {
                        console.error(`Failed to deploy lab for ${st.email}:`, err);
                        failCount++;
                    }
                }

                onMessage(`Hromadné nasazení dokončeno: ${successCount} úspěšně, ${failCount} selhalo.`);
            } else {
                setDeployProgressText('Vytvářím a propojuji virtuální stroje...');
                const basePrefix = deployLabPrefix.trim() || deployingLab.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 16);
                const instance = await deploySingle(deployStudentUUID, basePrefix);
                onMessage(`Laboratoř ${deployingLab.name} byla úspěšně nasazena (Instance: ${instance.id || 'Aktivní'})`);
            }

            setDeployingLab(null);
            setDeployStudentUUID('');
            setDeployLabPrefix('');
            setDeployProgressText('');
            await fetchLabs();
            onRefreshVMs();
            onRefreshNodes();
        } catch (err: any) {
            onMessage(`Nasazení laboratoře selhalo: ${err.message}`);
        } finally {
            setIsDeploying(false);
            setDeployProgressText('');
        }
    };

    const handleStartInstance = async (id: string) => {
        try {
            let resp: Response;
            try {
                resp = await fetch(`/labs/instances/${id}/start`, {
                    method: 'POST',
                    headers: { 'Authorization': token }
                });
            } catch {
                resp = await fetch(`http://10.0.10.52:8080/labs/instances/${id}/start`, {
                    method: 'POST',
                    headers: { 'Authorization': token }
                });
            }
            if (resp.ok) {
                onMessage(`Laboratorní instance ${id} byla spuštěna`);
                await fetchLabs();
                onRefreshVMs();
            }
        } catch (err: any) {
            onMessage(`Nepodařilo se spustit laboratorní instanci: ${err.message}`);
        }
    };

    const handleStopInstance = async (id: string) => {
        try {
            let resp: Response;
            try {
                resp = await fetch(`/labs/instances/${id}/stop`, {
                    method: 'POST',
                    headers: { 'Authorization': token }
                });
            } catch {
                resp = await fetch(`http://10.0.10.52:8080/labs/instances/${id}/stop`, {
                    method: 'POST',
                    headers: { 'Authorization': token }
                });
            }
            if (resp.ok) {
                onMessage(`Laboratorní instance ${id} byla zastavena`);
                await fetchLabs();
                onRefreshVMs();
            }
        } catch (err: any) {
            onMessage(`Nepodařilo se zastavit laboratorní instanci: ${err.message}`);
        }
    };

    const confirmDeleteInstance = (id: string) => {
        setConfirmDialog({
            isOpen: true,
            message: `Opravdu chcete smazat laboratorní instanci ${id} a všechny její přiřazené virtuální stroje?`,
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                try {
                    let resp: Response;
                    try {
                        resp = await fetch(`/labs/instances/${id}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': token }
                        });
                    } catch {
                        resp = await fetch(`http://10.0.10.52:8080/labs/instances/${id}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': token }
                        });
                    }
                    if (resp.ok) {
                        onMessage(`Laboratorní instance ${id} byla smazána`);
                        await fetchLabs();
                        onRefreshVMs();
                        onRefreshNodes();
                    }
                } catch (err: any) {
                    onMessage(`Nepodařilo se smazat laboratorní instanci: ${err.message}`);
                }
            }
        });
    };

    const confirmDeleteTemplate = (id: string, name: string) => {
        setConfirmDialog({
            isOpen: true,
            message: `Opravdu chcete smazat návrh laboratorního scénáře "${name}" (ID: ${id})?`,
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                try {
                    let resp: Response;
                    try {
                        resp = await fetch(`/labs/templates/${id}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': token }
                        });
                    } catch {
                        resp = await fetch(`http://10.0.10.52:8080/labs/templates/${id}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': token }
                        });
                    }
                    if (resp.ok) {
                        onMessage(`Šablona laboratoře "${name}" byla odstraněna`);
                        await fetchLabs();
                    }
                } catch (err: any) {
                    onMessage(`Nepodařilo se smazat šablonu laboratoře: ${err.message}`);
                }
            }
        });
    };

    const handleOpenInstanceTopology = (inst: LabInstance) => {
        const instanceVmIds = new Set(inst.vms?.map(v => v.vmid) || []);
        const matchedVMs = vms.filter(v => instanceVmIds.has(v.id));
        if (matchedVMs.length > 0) {
            setTopologyVMs(matchedVMs);
        } else {
            const fallbackVMs: main.VM[] = (inst.vms || []).map(v => ({
                id: v.vmid,
                name: v.name,
                status: inst.status === 'running' ? 'running' : 'stopped',
                cpu: 1,
                ram: 1024,
                disk: 10,
                ip: '',
                node: (v as any).node || 'pve',
                nics: []
            } as any));
            setTopologyVMs(fallbackVMs);
        }
    };

    const handleOpenVMConsole = (vmid: number) => {
        const found = vms.find(v => v.id === vmid);
        if (found && onOpenConsole) {
            onOpenConsole(String(found.id), found.node);
        } else if (onOpenConsole) {
            onOpenConsole(String(vmid), 'pve1');
        }
    };

    const runningInstancesCount = useMemo(() => {
        return labInstances.filter(i => i.status === 'running').length;
    }, [labInstances]);

    return (
        <div>
            <ConfirmModal 
                isOpen={confirmDialog.isOpen}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
            />

            <NetworkTopologyModal 
                isOpen={topologyVMs !== null}
                vms={topologyVMs || []}
                onClose={() => setTopologyVMs(null)}
            />

            <CreateLabModal 
                isOpen={isCreateLabOpen}
                onClose={() => setIsCreateLabOpen(false)}
                templates={templates}
                token={token}
                onLabCreated={(newLab) => {
                    setLabTemplates(prev => [...prev, newLab]);
                    onMessage(`Laboratorní scénář ${newLab.name} byl úspěšně vytvořen`);
                }}
            />

            {deployingLab && (
                <div className="modal-backdrop" onClick={() => !isDeploying && setDeployingLab(null)}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                            <h3 style={{ margin: 0 }}>Nasadit laboratoř: {deployingLab.name}</h3>
                            {!isDeploying && (
                                <button className="btn btn-secondary btn-sm" onClick={() => setDeployingLab(null)}>
                                    Zavřít
                                </button>
                            )}
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                            {deployingLab.description}
                        </p>
                        <form onSubmit={handleDeploySubmit}>
                            <div className="form-group" style={{ marginBottom: '14px' }}>
                                <label>Cílový příjemce / Skupina</label>
                                <select 
                                    value={deployStudentUUID} 
                                    onChange={e => setDeployStudentUUID(e.target.value)}
                                    disabled={isDeploying}
                                >
                                    <option value="">Já sám (Učitelské testovací prostředí)</option>
                                    {students.length > 0 && (
                                        <option value="__ALL_STUDENTS__" style={{ fontWeight: 600, color: 'var(--primary-color)' }}>
                                            Všichni studenti ({students.length}) - Hromadné nasazení
                                        </option>
                                    )}
                                    <optgroup label="Jednotliví studenti">
                                        {students.map(s => (
                                            <option key={s.uuid} value={s.uuid}>
                                                {s.email} {s.role ? `[${s.role}]` : ''}
                                            </option>
                                        ))}
                                    </optgroup>
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: '14px' }}>
                                <label>Prefix instance (volitelné)</label>
                                <input 
                                    type="text"
                                    value={deployLabPrefix}
                                    onChange={e => setDeployLabPrefix(e.target.value)}
                                    placeholder={deployStudentUUID === '__ALL_STUDENTS__' ? 'např. sit1 (bude doplněn email studenta)' : 'např. sit-lab-01'}
                                    disabled={isDeploying}
                                />
                            </div>
                            <div style={{ padding: '12px 14px', background: 'var(--primary-subtle)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-main)', marginBottom: '18px', border: '1px solid var(--border-color)' }}>
                                <div style={{ fontWeight: 600, marginBottom: '4px' }}>Shrnutí topologie:</div>
                                <div>Počet strojů na instanci: <strong>{deployingLab.vms?.length || 0}</strong></div>
                                <div>Počet propojovacích segmentů: <strong>{deployingLab.networks?.length || 0}</strong></div>
                                {deployStudentUUID === '__ALL_STUDENTS__' && (
                                    <div style={{ marginTop: '6px', color: 'var(--primary-color)', fontWeight: 600 }}>
                                        Bude vytvořeno celkem {(deployingLab.vms?.length || 0) * students.length} virtuálních strojů pro {students.length} studentů.
                                    </div>
                                )}
                            </div>

                            {isDeploying && deployProgressText && (
                                <div style={{ marginBottom: '14px', padding: '10px 14px', background: 'var(--badge-bg)', borderRadius: '6px', fontSize: '13px', fontWeight: 500 }}>
                                    {deployProgressText}
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setDeployingLab(null)} disabled={isDeploying}>
                                    Zrušit
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={isDeploying}>
                                    {isDeploying ? 'Nasazuji...' : deployStudentUUID === '__ALL_STUDENTS__' ? `Nasadit celé třídě (${students.length})` : 'Spustit instanci'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="nav-tabs">
                <button 
                    className={`nav-tab-btn ${activeTab === 'labs' ? 'active' : ''}`}
                    onClick={() => setActiveTab('labs')}
                >
                    Laboratoře a scénáře ({labTemplates.length})
                </button>
                <button 
                    className={`nav-tab-btn ${activeTab === 'templates' ? 'active' : ''}`}
                    onClick={() => setActiveTab('templates')}
                >
                    Správce šablon ({templates.length})
                </button>
                <button 
                    className={`nav-tab-btn ${activeTab === 'fleet' ? 'active' : ''}`}
                    onClick={() => setActiveTab('fleet')}
                >
                    Cluster a uzly ({nodes.length})
                </button>
                <button 
                    className={`nav-tab-btn ${activeTab === 'students' ? 'active' : ''}`}
                    onClick={() => setActiveTab('students')}
                >
                    Třída a studenti ({students.length})
                </button>
            </div>

            {activeTab === 'labs' && (
                <div>
                    <div className="stats-banner">
                        <div className="stat-box">
                            <span className="stat-value">{labTemplates.length}</span>
                            <span className="stat-label">Výukových scénářů</span>
                        </div>
                        <div className="stat-box">
                            <span className="stat-value">{labInstances.length}</span>
                            <span className="stat-label">Aktivních instancí</span>
                        </div>
                        <div className="stat-box">
                            <span className="stat-value" style={{ color: 'var(--success-color)' }}>{runningInstancesCount}</span>
                            <span className="stat-label">Běžících laboratoří</span>
                        </div>
                        <div className="stat-box">
                            <span className="stat-value">{students.length}</span>
                            <span className="stat-label">Zapsaných studentů</span>
                        </div>
                    </div>

                    <div className="card" style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '12px' }}>
                            <div>
                                <h3 style={{ margin: 0 }}>Knihovna výukových scénářů</h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                                    Standardizované laboratorní topologie s automatickým rozmístěním na uzly a VLAN propojením
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button 
                                    className="btn btn-primary btn-sm"
                                    onClick={() => setIsCreateLabOpen(true)}
                                >
                                    + Vytvořit nový scénář
                                </button>
                                <button 
                                    className="btn btn-secondary btn-sm" 
                                    onClick={fetchLabs}
                                    disabled={isLoading}
                                >
                                    {isLoading ? 'Obnovování...' : 'Obnovit'}
                                </button>
                            </div>
                        </div>

                        <div className="filter-bar">
                            <input 
                                type="text"
                                className="search-input"
                                placeholder="Hledat scénář podle názvu, popisu nebo stroje..."
                                value={labTemplateSearch}
                                onChange={e => setLabTemplateSearch(e.target.value)}
                            />
                            {categories.length > 0 && (
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    <button 
                                        className={`btn btn-sm ${selectedCategory === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setSelectedCategory('all')}
                                    >
                                        Všechny kategorie
                                    </button>
                                    {categories.map(cat => (
                                        <button 
                                            key={cat}
                                            className={`btn btn-sm ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
                                            onClick={() => setSelectedCategory(cat)}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
                            {filteredTemplates.map(lab => (
                                <div 
                                    key={lab.id}
                                    className="node-card"
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between'
                                    }}
                                >
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                            <strong style={{ fontSize: '16px', color: 'var(--text-main)' }}>{lab.name}</strong>
                                            <span className="mono-tag" style={{ textTransform: 'uppercase', color: 'var(--warning-text)', fontWeight: 600 }}>
                                                {lab.difficulty}
                                            </span>
                                        </div>

                                        <div style={{ fontSize: '12px', color: 'var(--primary-color)', fontWeight: 600, marginBottom: '8px' }}>
                                            {lab.category}
                                        </div>

                                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 14px 0', lineHeight: 1.4 }}>
                                            {lab.description}
                                        </p>

                                        <div style={{ marginBottom: '12px' }}>
                                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                                                Stroje v topologii ({lab.vms?.length || 0}):
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {lab.vms?.map((vm, i) => (
                                                    <span key={i} className="mono-tag" style={{ color: 'var(--primary-color)', fontSize: '12px', padding: '3px 8px' }}>
                                                        {vm.name} {vm.ram_mb ? `(${vm.ram_mb} MB)` : ''}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        {lab.networks && lab.networks.length > 0 && (
                                            <div style={{ marginBottom: '14px' }}>
                                                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                                                    Spoje a segmenty ({lab.networks.length}):
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                    {lab.networks.map((net, i) => (
                                                        <span key={i} className="mono-tag" style={{ fontSize: '12px', padding: '3px 8px' }}>
                                                            {net.label || `${net.from_vm} <-> ${net.to_vm}`}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                                        <button 
                                            className="btn btn-primary btn-sm"
                                            onClick={() => setDeployingLab(lab)}
                                        >
                                            Nasadit scénář
                                        </button>
                                        <button 
                                            className="btn btn-danger btn-sm"
                                            onClick={() => confirmDeleteTemplate(lab.id, lab.name)}
                                        >
                                            Smazat
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {filteredTemplates.length === 0 && (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)', padding: '36px' }}>
                                    {labTemplates.length === 0 
                                        ? 'Nebyly nalezeny žádné návrhy laboratoří. Vytvořte nový návrh výše.' 
                                        : 'Žádné scénáře neodpovídají zadanému filtru.'}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                            <h3 style={{ margin: 0 }}>Aktivní nasazené laboratoře ({filteredInstances.length})</h3>
                            <button 
                                className="btn btn-secondary btn-sm"
                                onClick={fetchLabs}
                                disabled={isLoading}
                            >
                                Obnovit instance
                            </button>
                        </div>

                        <div className="filter-bar">
                            <input 
                                type="text"
                                className="search-input"
                                placeholder="Hledat instanci podle scénáře, studenta, ID nebo stroje..."
                                value={instanceSearch}
                                onChange={e => setInstanceSearch(e.target.value)}
                            />
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <button 
                                    className={`btn btn-sm ${instanceStatusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setInstanceStatusFilter('all')}
                                >
                                    Vše
                                </button>
                                <button 
                                    className={`btn btn-sm ${instanceStatusFilter === 'running' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setInstanceStatusFilter('running')}
                                >
                                    Běží ({runningInstancesCount})
                                </button>
                                <button 
                                    className={`btn btn-sm ${instanceStatusFilter === 'stopped' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setInstanceStatusFilter('stopped')}
                                >
                                    Zastaveno ({labInstances.length - runningInstancesCount})
                                </button>
                            </div>
                        </div>

                        <div className="table-container">
                            <table className="vm-table">
                                <thead>
                                    <tr>
                                        <th>Název laboratoře</th>
                                        <th>ID instance</th>
                                        <th>Student / Vlastník</th>
                                        <th>Stav</th>
                                        <th>Nasazené stroje</th>
                                        <th>Akce</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredInstances.map(inst => (
                                        <tr key={inst.id}>
                                            <td className="fw-500">{inst.lab_name}</td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)' }}>
                                                {inst.id}
                                            </td>
                                            <td style={{ fontSize: '12px' }}>
                                                {inst.owner_email ? (
                                                    <span style={{ fontWeight: 500 }}>{inst.owner_email}</span>
                                                ) : inst.owner_uuid ? (
                                                    <span style={{ fontFamily: 'monospace' }}>{inst.owner_uuid.slice(0, 8)}...</span>
                                                ) : (
                                                    <span className="mono-tag" style={{ color: 'var(--primary-color)' }}>Učitel</span>
                                                )}
                                            </td>
                                            <td>
                                                <span className={`status-badge ${inst.status === 'running' ? 'status-running' : 'status-stopped'}`}>
                                                    {inst.status === 'running' ? 'BĚŽÍ' : 'PŘIPRAVENO'}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                    {inst.vms?.map(v => {
                                                        const matchedVm = vms.find(x => x.id === v.vmid);
                                                        const isVmRunning = matchedVm?.status === 'running';
                                                        return (
                                                            <button 
                                                                key={v.vmid}
                                                                type="button"
                                                                onClick={() => handleOpenVMConsole(v.vmid)}
                                                                title={`Kliknutím otevřete konzoli (${v.name}, VMID: ${v.vmid})`}
                                                                style={{ 
                                                                    fontSize: '11px', 
                                                                    padding: '3px 8px', 
                                                                    background: isVmRunning ? 'rgba(74, 222, 128, 0.15)' : 'var(--badge-bg)', 
                                                                    border: isVmRunning ? '1px solid rgba(74, 222, 128, 0.4)' : '1px solid var(--border-color)',
                                                                    borderRadius: '4px',
                                                                    fontFamily: 'monospace',
                                                                    cursor: 'pointer',
                                                                    color: isVmRunning ? 'var(--success-color)' : 'var(--text-main)',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px'
                                                                }}
                                                            >
                                                                <span style={{ 
                                                                    width: '6px', 
                                                                    height: '6px', 
                                                                    borderRadius: '50%', 
                                                                    backgroundColor: isVmRunning ? 'var(--success-color)' : 'var(--danger-color)',
                                                                    display: 'inline-block' 
                                                                }}></span>
                                                                {v.name} ({v.vmid})
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                    {inst.status !== 'running' ? (
                                                        <button 
                                                            className="btn btn-success btn-sm"
                                                            onClick={() => handleStartInstance(inst.id)}
                                                        >
                                                            Spustit
                                                        </button>
                                                    ) : (
                                                        <button 
                                                            className="btn btn-warning btn-sm"
                                                            onClick={() => handleStopInstance(inst.id)}
                                                        >
                                                            Zastavit
                                                        </button>
                                                    )}
                                                    <button 
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={() => handleOpenInstanceTopology(inst)}
                                                        title="Zobrazit propojení a síťovou topologii této instance"
                                                    >
                                                        Topologie
                                                    </button>
                                                    <button 
                                                        className="btn btn-danger btn-sm"
                                                        onClick={() => confirmDeleteInstance(inst.id)}
                                                    >
                                                        Smazat
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredInstances.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="text-center text-muted" style={{ padding: '24px' }}>
                                                {labInstances.length === 0
                                                    ? 'Zatím neběží žádné laboratorní instance. Pro testování nasaďte scénář výše.'
                                                    : 'Žádné aktivní instance neodpovídají zadanému filtru.'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'templates' && (
                <TemplatesManager 
                    templates={templates}
                    vms={vms}
                    nodes={nodes}
                    token={token}
                    onRefresh={onRefreshVMs}
                    onMessage={onMessage}
                />
            )}

            {activeTab === 'fleet' && (
                <FleetNodesView 
                    nodes={nodes}
                    token={token}
                    onMessage={onMessage}
                    onRefreshNodes={onRefreshNodes}
                    onStartVM={onStartVM}
                    onStopVM={onStopVM}
                    onDeleteVM={onDeleteVM}
                    onOpenConsole={onOpenConsole}
                    initialStudentFilter={fleetFilterQuery}
                    onClearStudentFilter={() => setFleetFilterQuery('')}
                />
            )}

            {activeTab === 'students' && (
                <StudentsManager 
                    token={token}
                    onMessage={onMessage}
                    onViewStudentVMs={(email: string) => {
                        setFleetFilterQuery(email);
                        setActiveTab('fleet');
                    }}
                    onDeployLabForStudent={(studentUuid: string) => {
                        setDeployStudentUUID(studentUuid);
                        setActiveTab('labs');
                        if (labTemplates.length > 0) {
                            setDeployingLab(labTemplates[0]);
                        }
                    }}
                />
            )}
        </div>
    );
}
