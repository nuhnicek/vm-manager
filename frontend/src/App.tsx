import { useState, useEffect } from 'react';
import { 
    GetVMs, GetTemplates, StartVM, StopVM, DeleteVM, CreateVMFromTemplate, 
    GetLaunchedConsoleVM, OpenConsole, ConnectVMs, DisconnectVMs 
} from '../wailsjs/go/main/App';
import { main } from '../wailsjs/go/models';
import { VMConsole } from './VMConsole';
import { Quit } from '../wailsjs/runtime/runtime';
import './App.css';

function App() {
    const [launchedConsoleVM, setLaunchedConsoleVM] = useState<string>("");

    // Auth state
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loginError, setLoginError] = useState("");

    const [vms, setVms] = useState<main.VM[]>([]);
    const [templates, setTemplates] = useState<main.Template[]>([]);
    const [message, setMessage] = useState("");
    
    const [newName, setNewName] = useState("");
    const [selectedTemplate, setSelectedTemplate] = useState("");
    
    // Connection Management Modal State
    const [managingConnectionsVM, setManagingConnectionsVM] = useState<main.VM | null>(null);
    const [connectionTargetId, setConnectionTargetId] = useState<string>("");

    // Custom confirm dialog state
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        message: "",
        onConfirm: () => {}
    });

    useEffect(() => {
        const checkLaunchedConsole = async () => {
            try {
                const consoleVM = await GetLaunchedConsoleVM();
                if (consoleVM) {
                    setLaunchedConsoleVM(consoleVM);
                }
            } catch (err) {
                console.error("Failed to check launched console VM", err);
            }
        };
        checkLaunchedConsole();
    }, []);

    const fetchVMs = async () => {
        const data = await GetVMs();
        setVms(data);
    };

    const fetchTemplates = async () => {
        const data = await GetTemplates();
        setTemplates(data);
        if (data && data.length > 0) {
            setSelectedTemplate(data[0].id);
        }
    };

    // Keep the managing VM state up-to-date if vms change
    useEffect(() => {
        if (managingConnectionsVM) {
            const updatedVM = vms.find(v => v.id === managingConnectionsVM.id);
            if (updatedVM) {
                setManagingConnectionsVM(updatedVM);
            } else {
                setManagingConnectionsVM(null); // was deleted
            }
        }
    }, [vms]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchVMs();
            fetchTemplates();
        }
    }, [isAuthenticated]);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        // Mock authentication
        if (username === "admin" && password === "password") {
            setIsAuthenticated(true);
            setLoginError("");
        } else {
            setLoginError("Invalid username or password. Try admin/password.");
        }
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        setUsername("");
        setPassword("");
        setMessage("");
    };

    const executeAction = async (actionFn: any, id: string) => {
        try {
            const result = await actionFn(id);
            setMessage(result);
            await fetchVMs(); // Refresh the list
        } catch (error) {
            setMessage(`Error: ${error}`);
        }
    };

    const handleAction = (actionFn: any, id: string, name: string, needsConfirm: boolean, confirmMsg: string) => {
        if (needsConfirm) {
            setConfirmDialog({
                isOpen: true,
                message: confirmMsg,
                onConfirm: () => {
                    setConfirmDialog({ ...confirmDialog, isOpen: false });
                    executeAction(actionFn, id);
                }
            });
        } else {
            executeAction(actionFn, id);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) {
            setMessage("Error: VM name cannot be empty");
            return;
        }
        try {
            await CreateVMFromTemplate(newName, selectedTemplate);
            setMessage(`Successfully created VM: ${newName}`);
            setNewName("");
            await fetchVMs();
        } catch (error) {
            setMessage(`Error: ${error}`);
        }
    };

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!managingConnectionsVM || !connectionTargetId) return;
        try {
            const result = await ConnectVMs(managingConnectionsVM.id, connectionTargetId);
            setMessage(result);
            setConnectionTargetId("");
            await fetchVMs();
        } catch (error) {
            setMessage(`Error: ${error}`);
        }
    };

    const handleDisconnect = async (targetId: string) => {
        if (!managingConnectionsVM) return;
        try {
            const result = await DisconnectVMs(managingConnectionsVM.id, targetId);
            setMessage(result);
            await fetchVMs();
        } catch (error) {
            setMessage(`Error: ${error}`);
        }
    };

    if (launchedConsoleVM) {
        return (
            <div style={{ height: '100vh', width: '100vw', backgroundColor: '#000', margin: 0, padding: 0 }}>
                <VMConsole 
                    vmName={launchedConsoleVM} 
                    onClose={() => Quit()} 
                />
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="login-container">
                <div className="card login-card">
                    <h2 className="text-center">VM Manager Login</h2>
                    {loginError && <div className="message error">{loginError}</div>}
                    <form className="login-form" onSubmit={handleLogin}>
                        <div className="form-group">
                            <label>Username</label>
                            <input 
                                type="text" 
                                value={username} 
                                onChange={(e) => setUsername(e.target.value)} 
                                placeholder="admin"
                            />
                        </div>
                        <div className="form-group" style={{marginTop: '16px'}}>
                            <label>Password</label>
                            <input 
                                type="password" 
                                value={password} 
                                onChange={(e) => setPassword(e.target.value)} 
                                placeholder="password"
                            />
                        </div>
                        <button type="submit" className="btn btn-primary login-btn">Login</button>
                    </form>
                </div>
            </div>
        );
    }

    // Prepare connection options
    let availableVMsToConnect: main.VM[] = [];
    if (managingConnectionsVM) {
        availableVMsToConnect = vms.filter(v => 
            v.id !== managingConnectionsVM.id && 
            !(managingConnectionsVM.connections || []).some(c => c.target_vm_id === v.id)
        );
    }

    return (
        <div className="container">
            {confirmDialog.isOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h4>Confirmation</h4>
                        <p>{confirmDialog.message}</p>
                        <div className="modal-actions">
                            <button 
                                className="btn btn-secondary" 
                                onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
                            >
                                Cancel
                            </button>
                            <button 
                                className="btn btn-danger" 
                                onClick={confirmDialog.onConfirm}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {managingConnectionsVM && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '600px' }}>
                        <h4>Connections for {managingConnectionsVM.name}</h4>
                        <p>Manage point-to-point links between VMs. Simulated via isolated bridges under the hood.</p>
                        
                        <div style={{ marginBottom: '1rem' }}>
                            <h5>Current Links</h5>
                            {(managingConnectionsVM.connections || []).length === 0 ? (
                                <p className="text-muted">No connections yet.</p>
                            ) : (
                                <ul style={{ listStyleType: 'none', padding: 0 }}>
                                    {(managingConnectionsVM.connections || []).map(conn => {
                                        const cVm = vms.find(v => v.id === conn.target_vm_id);
                                        return (
                                            <li key={conn.target_vm_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                                                <div style={{ fontFamily: 'monospace', fontSize: '14px' }}>
                                                    <strong>{managingConnectionsVM.name}</strong> [<code>{conn.local_nic}</code>] 
                                                    <span style={{ margin: '0 8px', color: '#6b7280' }}>&lt;----&gt;</span> 
                                                    [<code>{conn.target_nic}</code>] <strong>{cVm ? cVm.name : conn.target_vm_id}</strong>
                                                </div>
                                                <button className="btn btn-sm btn-danger" onClick={() => handleDisconnect(conn.target_vm_id)}>Disconnect</button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>

                        {availableVMsToConnect.length > 0 && (
                            <form onSubmit={handleConnect} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginTop: '1rem' }}>
                                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                    <label>Connect to:</label>
                                    <select 
                                        value={connectionTargetId} 
                                        onChange={(e) => setConnectionTargetId(e.target.value)}
                                        required
                                    >
                                        <option value="">-- Select VM --</option>
                                        {availableVMsToConnect.map(v => (
                                            <option key={v.id} value={v.id}>{v.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px' }}>Link</button>
                            </form>
                        )}

                        <div className="modal-actions" style={{ marginTop: '2rem' }}>
                            <button 
                                className="btn btn-secondary" 
                                onClick={() => setManagingConnectionsVM(null)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Virtual Machine Manager</h2>
                <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Logout</button>
            </header>
            
            {message && (
                <div className={`message ${message.startsWith('Error') ? 'error' : 'success'}`}>
                    {message}
                </div>
            )}

            <div className="card">
                <h3>Create New VM</h3>
                <form className="create-form" onSubmit={handleCreate}>
                    <div className="form-group">
                        <label>Name:</label>
                        <input 
                            type="text" 
                            value={newName} 
                            onChange={(e) => setNewName(e.target.value)} 
                            placeholder="my-new-vm"
                        />
                    </div>
                    <div className="form-group">
                        <label>Template:</label>
                        <select 
                            value={selectedTemplate} 
                            onChange={(e) => setSelectedTemplate(e.target.value)}
                        >
                            {templates.map(t => (
                                <option key={t.id} value={t.id}>{t.name} ({t.ram_mb} MB)</option>
                            ))}
                        </select>
                    </div>
                    <button type="submit" className="btn btn-primary">Create VM</button>
                </form>
            </div>

            <div className="card">
                <h3>Existing VMs</h3>
                <table className="vm-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Status</th>
                            <th>RAM (MB)</th>
                            <th>Connections</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                    {vms.map((vm) => (
                        <tr key={vm.id}>
                            <td className="fw-500">{vm.name}</td>
                            <td>
                                <span className={`status-badge ${vm.status === 'Running' ? 'status-running' : 'status-stopped'}`}>
                                    {vm.status}
                                </span>
                            </td>
                            <td>{vm.ram_mb}</td>
                            <td>
                                {(vm.connections || []).length === 0 ? (
                                    <span className="text-muted">None</span>
                                ) : (
                                    <ul style={{ listStyleType: 'none', padding: 0, margin: 0, fontSize: '12px', fontFamily: 'monospace' }}>
                                        {(vm.connections || []).map(conn => {
                                            const tVm = vms.find(v => v.id === conn.target_vm_id);
                                            return (
                                                <li key={conn.target_vm_id} style={{ whiteSpace: 'nowrap' }}>
                                                    [{conn.local_nic}] &rarr; [{conn.target_nic}] {tVm ? tVm.name : conn.target_vm_id}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </td>
                            <td>
                                <div className="action-buttons">
                                    {vm.status === 'Running' ? (
                                        <>
                                            <button 
                                                className="btn btn-sm btn-warning"
                                                onClick={() => handleAction(StopVM, vm.id, vm.name, true, `Are you sure you want to stop ${vm.name}?`)}
                                            >
                                                Stop
                                            </button>
                                            <button 
                                                className="btn btn-sm btn-primary"
                                                onClick={() => OpenConsole(vm.id)}
                                            >
                                                Console
                                            </button>
                                        </>
                                    ) : (
                                        <button 
                                            className="btn btn-sm btn-success"
                                            onClick={() => handleAction(StartVM, vm.id, vm.name, false, "")}
                                        >
                                            Start
                                        </button>
                                    )}
                                    <button 
                                        className="btn btn-sm btn-secondary ml-2"
                                        onClick={() => setManagingConnectionsVM(vm)}
                                    >
                                        Connections
                                    </button>
                                    <button 
                                        className="btn btn-sm btn-danger ml-2"
                                        onClick={() => handleAction(DeleteVM, vm.id, vm.name, true, `Are you sure you want to DELETE ${vm.name}? This action cannot be undone.`)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {vms.length === 0 && (
                        <tr>
                            <td colSpan={5} className="text-center text-muted">No VMs found.</td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default App;
