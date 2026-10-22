import { useState, useEffect } from 'react';
import { main } from '../../wailsjs/go/models';
import { LabTemplate, LabInstance, ProxmoxNode, TeacherStudentInfo } from '../types';
import { CreateLabModal } from './CreateLabModal';
import { TemplatesManager } from './TemplatesManager';
import { FleetNodesView } from './FleetNodesView';
import { StudentsManager } from './StudentsManager';

interface TeacherViewProps {
    token: string;
    nodes: ProxmoxNode[];
    templates: main.Template[];
    vms: main.VM[];
    onRefreshNodes: () => void;
    onRefreshVMs: () => void;
    onMessage: (msg: string) => void;
}

export function TeacherView({
    token,
    nodes,
    templates,
    vms,
    onRefreshNodes,
    onRefreshVMs,
    onMessage
}: TeacherViewProps) {
    const [activeTab, setActiveTab] = useState<'labs' | 'templates' | 'fleet' | 'students'>('labs');
    const [labTemplates, setLabTemplates] = useState<LabTemplate[]>([]);
    const [labInstances, setLabInstances] = useState<LabInstance[]>([]);
    const [students, setStudents] = useState<TeacherStudentInfo[]>([]);

    const [isLoading, setIsLoading] = useState(false);
    const [isCreateLabOpen, setIsCreateLabOpen] = useState(false);

    const [deployingLab, setDeployingLab] = useState<LabTemplate | null>(null);
    const [deployStudentUUID, setDeployStudentUUID] = useState<string>('');
    const [deployLabPrefix, setDeployLabPrefix] = useState<string>('');
    const [isDeploying, setIsDeploying] = useState(false);

    const fetchLabs = async () => {
        setIsLoading(true);
        try {
            let respTpl: Response;
            try {
                respTpl = await fetch('/labs/templates', { headers: { 'Authorization': token } });
            } catch {
                respTpl = await fetch('http://localhost:8080/labs/templates', { headers: { 'Authorization': token } });
            }
            if (respTpl.ok) {
                const data = await respTpl.json();
                setLabTemplates(data || []);
            }

            let respInst: Response;
            try {
                respInst = await fetch('/labs/instances', { headers: { 'Authorization': token } });
            } catch {
                respInst = await fetch('http://localhost:8080/labs/instances', { headers: { 'Authorization': token } });
            }
            if (respInst.ok) {
                const data = await respInst.json();
                setLabInstances(data || []);
            }

            let respStudents: Response;
            try {
                respStudents = await fetch('/teacher/students', { headers: { 'Authorization': token } });
            } catch {
                respStudents = await fetch('http://localhost:8080/teacher/students', { headers: { 'Authorization': token } });
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

    const handleDeploySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!deployingLab || isDeploying) return;
        setIsDeploying(true);
        try {
            const payload = {
                template_id: deployingLab.id,
                student_uuid: deployStudentUUID,
                lab_prefix: deployLabPrefix.trim() || deployingLab.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 16)
            };

            let resp: Response;
            try {
                resp = await fetch('/labs/deploy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': token },
                    body: JSON.stringify(payload)
                });
            } catch {
                resp = await fetch('http://localhost:8080/labs/deploy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': token },
                    body: JSON.stringify(payload)
                });
            }

            if (!resp.ok) {
                const errData = await resp.json().catch(() => ({}));
                throw new Error(errData.error || `Server responded with ${resp.status}`);
            }

            const instance = await resp.json();
            onMessage(`Lab ${deployingLab.name} successfully deployed (Instance: ${instance.id || 'Active'})`);
            setDeployingLab(null);
            setDeployStudentUUID('');
            setDeployLabPrefix('');
            await fetchLabs();
            onRefreshVMs();
            onRefreshNodes();
        } catch (err: any) {
            onMessage(`Lab deployment failed: ${err.message}`);
        } finally {
            setIsDeploying(false);
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
                resp = await fetch(`http://localhost:8080/labs/instances/${id}/start`, {
                    method: 'POST',
                    headers: { 'Authorization': token }
                });
            }
            if (resp.ok) {
                onMessage(`Lab instance ${id} started`);
                await fetchLabs();
                onRefreshVMs();
            }
        } catch (err: any) {
            onMessage(`Failed to start lab instance: ${err.message}`);
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
                resp = await fetch(`http://localhost:8080/labs/instances/${id}/stop`, {
                    method: 'POST',
                    headers: { 'Authorization': token }
                });
            }
            if (resp.ok) {
                onMessage(`Lab instance ${id} stopped`);
                await fetchLabs();
                onRefreshVMs();
            }
        } catch (err: any) {
            onMessage(`Failed to stop lab instance: ${err.message}`);
        }
    };

    const handleDeleteInstance = async (id: string) => {
        if (!window.confirm(`Delete lab instance ${id} and all its connected VMs?`)) return;
        try {
            let resp: Response;
            try {
                resp = await fetch(`/labs/instances/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': token }
                });
            } catch {
                resp = await fetch(`http://localhost:8080/labs/instances/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': token }
                });
            }
            if (resp.ok) {
                onMessage(`Lab instance ${id} deleted`);
                await fetchLabs();
                onRefreshVMs();
                onRefreshNodes();
            }
        } catch (err: any) {
            onMessage(`Failed to delete lab instance: ${err.message}`);
        }
    };

    const handleDeleteTemplate = async (id: string) => {
        if (!window.confirm(`Delete lab blueprint ${id}?`)) return;
        try {
            let resp: Response;
            try {
                resp = await fetch(`/labs/templates/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': token }
                });
            } catch {
                resp = await fetch(`http://localhost:8080/labs/templates/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': token }
                });
            }
            if (resp.ok) {
                onMessage(`Lab template ${id} removed`);
                await fetchLabs();
            }
        } catch (err: any) {
            onMessage(`Failed to delete lab template: ${err.message}`);
        }
    };

    return (
        <div>
            <CreateLabModal 
                isOpen={isCreateLabOpen}
                onClose={() => setIsCreateLabOpen(false)}
                templates={templates}
                token={token}
                onLabCreated={(newLab) => {
                    setLabTemplates(prev => [...prev, newLab]);
                    onMessage(`Lab scenario ${newLab.name} created successfully`);
                }}
            />

            {deployingLab && (
                <div className="modal-backdrop" onClick={() => setDeployingLab(null)}>
                    <div className="modal" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
                        <h3>Deploy Lab: {deployingLab.name}</h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            {deployingLab.description}
                        </p>
                        <form onSubmit={handleDeploySubmit}>
                            <div className="form-group">
                                <label>Target Student / Assignee</label>
                                <select 
                                    value={deployStudentUUID}
                                    onChange={e => setDeployStudentUUID(e.target.value)}
                                >
                                    <option value="">Myself (Teacher Environment)</option>
                                    {students.map(s => (
                                        <option key={s.uuid} value={s.uuid}>
                                            {s.email} ({s.uuid ? s.uuid.slice(0, 8) + '...' : ''})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Instance Prefix (Optional)</label>
                                <input 
                                    type="text"
                                    value={deployLabPrefix}
                                    onChange={e => setDeployLabPrefix(e.target.value)}
                                    placeholder="e.g. net-lab-01"
                                />
                            </div>
                            <div style={{ padding: '8px 12px', background: '#eff6ff', borderRadius: '4px', fontSize: '12px', color: '#1e40af', marginBottom: '16px' }}>
                                This will instantiate {deployingLab.vms?.length || 0} virtual machines across the cluster and interconnect them on dedicated VLAN point-to-point links.
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setDeployingLab(null)} disabled={isDeploying}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={isDeploying}>
                                    {isDeploying ? 'Deploying Topology...' : 'Launch Lab Instance'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <button 
                    className={`btn btn-sm ${activeTab === 'labs' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('labs')}
                >
                    Labs & Scenarios ({labTemplates.length})
                </button>
                <button 
                    className={`btn btn-sm ${activeTab === 'templates' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('templates')}
                >
                    Templates Manager ({templates.length})
                </button>
                <button 
                    className={`btn btn-sm ${activeTab === 'fleet' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('fleet')}
                >
                    Cluster Fleet & Nodes ({nodes.length})
                </button>
                <button 
                    className={`btn btn-sm ${activeTab === 'students' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('students')}
                >
                    Classroom & Students ({students.length})
                </button>
            </div>

            {activeTab === 'labs' && (
                <div>
                    <div className="card" style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <div>
                                <h3 style={{ margin: 0 }}>Networking & Cybersecurity Lab Curricula</h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                                    Standardized lab topologies with automated multi-node placement and VLAN interconnects
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button 
                                    className="btn btn-primary btn-sm"
                                    onClick={() => setIsCreateLabOpen(true)}
                                >
                                    + Create New Lab Scenario
                                </button>
                                <button 
                                    className="btn btn-secondary btn-sm" 
                                    onClick={fetchLabs}
                                    disabled={isLoading}
                                >
                                    {isLoading ? 'Refreshing...' : 'Refresh'}
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
                            {labTemplates.map(lab => (
                                <div 
                                    key={lab.id}
                                    style={{
                                        padding: '16px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)',
                                        backgroundColor: '#ffffff',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between'
                                    }}
                                >
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                            <strong style={{ fontSize: '16px', color: 'var(--text-main)' }}>{lab.name}</strong>
                                            <span 
                                                className="status-badge status-running"
                                                style={{ fontSize: '11px', textTransform: 'uppercase' }}
                                            >
                                                {lab.difficulty}
                                            </span>
                                        </div>

                                        <div style={{ fontSize: '12px', color: 'var(--primary-color)', fontWeight: 600, marginBottom: '8px' }}>
                                            {lab.category}
                                        </div>

                                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 12px 0', lineHeight: 1.4 }}>
                                            {lab.description}
                                        </p>

                                        <div style={{ marginBottom: '12px' }}>
                                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                                                Topology Machines ({lab.vms?.length || 0}):
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {lab.vms?.map((vm, i) => (
                                                    <span 
                                                        key={i}
                                                        style={{ 
                                                            fontSize: '11px', 
                                                            background: '#eff6ff', 
                                                            color: '#1e40af', 
                                                            padding: '2px 8px', 
                                                            borderRadius: '4px',
                                                            fontFamily: 'monospace' 
                                                        }}
                                                    >
                                                        {vm.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        {lab.networks && lab.networks.length > 0 && (
                                            <div style={{ marginBottom: '12px' }}>
                                                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                                                    Links & Segments ({lab.networks.length}):
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                    {lab.networks.map((net, i) => (
                                                        <span 
                                                            key={i}
                                                            style={{ 
                                                                fontSize: '10px', 
                                                                background: '#f3f4f6', 
                                                                color: '#374151', 
                                                                padding: '2px 6px', 
                                                                borderRadius: '4px' 
                                                            }}
                                                        >
                                                            {net.label || `${net.from_vm} <-> ${net.to_vm}`}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', borderTop: '1px solid #f3f4f6', paddingTop: '10px' }}>
                                        <button 
                                            className="btn btn-primary btn-sm"
                                            onClick={() => setDeployingLab(lab)}
                                        >
                                            Deploy Lab Scenario
                                        </button>
                                        <button 
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => handleDeleteTemplate(lab.id)}
                                            style={{ color: '#ef4444' }}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {labTemplates.length === 0 && (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                                    No lab blueprints found. Create a new lab blueprint above.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="card">
                        <h3 style={{ margin: '0 0 12px 0' }}>Active Lab Deployments ({labInstances.length})</h3>
                        <table className="vm-table">
                            <thead>
                                <tr>
                                    <th>Lab Name</th>
                                    <th>Instance ID</th>
                                    <th>Student / Owner</th>
                                    <th>Status</th>
                                    <th>Deployed VMs</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {labInstances.map(inst => (
                                    <tr key={inst.id}>
                                        <td className="fw-500">{inst.lab_name}</td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)' }}>
                                            {inst.id}
                                        </td>
                                        <td style={{ fontSize: '12px' }}>
                                            {inst.owner_email || (inst.owner_uuid ? inst.owner_uuid.slice(0, 8) + '...' : 'Teacher')}
                                        </td>
                                        <td>
                                            <span className={`status-badge ${inst.status === 'running' ? 'status-running' : 'status-stopped'}`}>
                                                {inst.status || 'Provisioned'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                {inst.vms?.map(v => (
                                                    <span 
                                                        key={v.vmid} 
                                                        style={{ 
                                                            fontSize: '11px', 
                                                            padding: '2px 6px', 
                                                            background: '#e5e7eb', 
                                                            borderRadius: '4px',
                                                            fontFamily: 'monospace' 
                                                        }}
                                                    >
                                                        {v.name} (VMID: {v.vmid})
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                {inst.status !== 'running' ? (
                                                    <button 
                                                        className="btn btn-success btn-sm"
                                                        onClick={() => handleStartInstance(inst.id)}
                                                    >
                                                        Start
                                                    </button>
                                                ) : (
                                                    <button 
                                                        className="btn btn-warning btn-sm"
                                                        onClick={() => handleStopInstance(inst.id)}
                                                    >
                                                        Stop
                                                    </button>
                                                )}
                                                <button 
                                                    className="btn btn-danger btn-sm"
                                                    onClick={() => handleDeleteInstance(inst.id)}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {labInstances.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center text-muted" style={{ padding: '24px' }}>
                                            No active lab instances running. Deploy a scenario above to test.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
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
                />
            )}

            {activeTab === 'students' && (
                <StudentsManager 
                    token={token}
                    onMessage={onMessage}
                />
            )}
        </div>
    );
}
