import { useState, useEffect } from 'react';
import { 
    GetVMs, GetTemplates, StartVM, StopVM, DeleteVM, CreateVMFromTemplate, 
    GetLaunchedConsoleVM, GetConsoleParams, OpenConsole, ConnectVMs, DisconnectVMs, AddNIC, RemoveNIC,
    VerifySession, Logout
} from '../wailsjs/go/main/App';
import { main } from '../wailsjs/go/models';
import { VMConsole } from './VMConsole';
import { Quit } from '../wailsjs/runtime/runtime';

import { Header } from './components/Header';
import { Login } from './components/Login';
import { CreateVMCard } from './components/CreateVMCard';
import { VMTable } from './components/VMTable';
import { NetworkingModal } from './components/NetworkingModal';
import { NetworkTopologyModal } from './components/NetworkTopologyModal';
import { ConfirmModal } from './components/ConfirmModal';

import './App.css';

function App() {
    const [launchedConsoleVM, setLaunchedConsoleVM] = useState<string>('');

    // Authentication State
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isVerifyingSession, setIsVerifyingSession] = useState(true);
    const [currentUser, setCurrentUser] = useState<string>('');
    const [authToken, setAuthToken] = useState<string>('');

    // VM and Template Data State
    const [vms, setVms] = useState<main.VM[]>([]);
    const [templates, setTemplates] = useState<main.Template[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [message, setMessage] = useState('');

    // Modal States
    const [managingConnectionsVM, setManagingConnectionsVM] = useState<main.VM | null>(null);
    const [activeConsoleVM, setActiveConsoleVM] = useState<main.VM | null>(null);
    const [launchedConsoleParams, setLaunchedConsoleParams] = useState<Record<string, string> | null>(null);
    const [showNetworkMap, setShowNetworkMap] = useState<boolean>(false);
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        message: '',
        onConfirm: () => {}
    });

    // Check if app was launched in console window mode
    useEffect(() => {
        const checkLaunchedConsole = async () => {
            try {
                if (typeof window !== 'undefined' && (window as any).go?.main?.App?.GetConsoleParams) {
                    const params = await GetConsoleParams();
                    if (params && (params.id || params.name)) {
                        setLaunchedConsoleParams(params);
                        setLaunchedConsoleVM(params.name || params.id);
                        if (params.token) {
                            setAuthToken(params.token);
                        }
                        return;
                    }
                }
                const consoleVM = await GetLaunchedConsoleVM();
                if (consoleVM) {
                    setLaunchedConsoleVM(consoleVM);
                }
            } catch (err) {
                console.error('Failed to check launched console VM:', err);
            }
        };
        checkLaunchedConsole();
    }, []);

    // Restore saved session on startup
    useEffect(() => {
        const restoreSession = async () => {
            const savedToken = localStorage.getItem('vm_manager_token');
            const savedEmail = localStorage.getItem('vm_manager_email');
            if (savedToken) {
                try {
                    let isValid = false;
                    if (typeof window !== 'undefined' && (window as any).go?.main?.App?.VerifySession) {
                        isValid = await VerifySession(savedToken);
                    } else {
                        const resp = await fetch('/ping', {
                            headers: { 'Authorization': savedToken }
                        }).catch(async () => {
                            return await fetch('http://localhost:8080/ping', {
                                headers: { 'Authorization': savedToken }
                            });
                        });
                        isValid = !!resp && resp.status === 200;
                    }

                    if (isValid) {
                        setIsAuthenticated(true);
                        setAuthToken(savedToken);
                        setCurrentUser(savedEmail || '');
                        await fetchVMs(savedToken);
                        await fetchTemplates(savedToken);
                    } else {
                        localStorage.removeItem('vm_manager_token');
                        localStorage.removeItem('vm_manager_email');
                    }
                } catch {
                    localStorage.removeItem('vm_manager_token');
                    localStorage.removeItem('vm_manager_email');
                }
            }
            setIsVerifyingSession(false);
        };
        restoreSession();
    }, []);

    // Keep managingConnectionsVM reference in sync with latest vms
    useEffect(() => {
        if (managingConnectionsVM) {
            const updatedVM = vms.find(v => String(v.id) === String(managingConnectionsVM.id));
            setManagingConnectionsVM(updatedVM || null);
        }
    }, [vms]);

    // Data Fetching
    const fetchVMs = async (tokenOverride?: string) => {
        const token = tokenOverride || authToken || localStorage.getItem('vm_manager_token') || '';
        if (!token) return;
        setIsRefreshing(true);
        try {
            let data: main.VM[] = [];
            if (typeof window !== 'undefined' && (window as any).go?.main?.App?.GetVMs) {
                data = await GetVMs(token);
            } else {
                let resp: Response;
                try {
                    resp = await fetch('/vms', {
                        headers: { 'Authorization': token }
                    });
                } catch {
                    resp = await fetch('http://localhost:8080/vms', {
                        headers: { 'Authorization': token }
                    });
                }
                if (resp && resp.ok) {
                    data = await resp.json();
                } else if (resp && resp.status === 401) {
                    handleLogout();
                    return;
                }
            }
            setVms(data || []);
        } catch (err) {
            console.error('Failed to fetch VMs:', err);
        } finally {
            setIsRefreshing(false);
        }
    };

    const fetchTemplates = async (tokenOverride?: string) => {
        const token = tokenOverride || authToken || localStorage.getItem('vm_manager_token') || '';
        if (!token) return;
        try {
            let data: main.Template[] = [];
            if (typeof window !== 'undefined' && (window as any).go?.main?.App?.GetTemplates) {
                data = await GetTemplates(token);
            } else {
                let resp: Response;
                try {
                    resp = await fetch('/vms/templates', {
                        headers: { 'Authorization': token }
                    });
                } catch {
                    resp = await fetch('http://localhost:8080/vms/templates', {
                        headers: { 'Authorization': token }
                    });
                }
                if (resp && resp.ok) {
                    data = await resp.json();
                }
            }
            setTemplates(data || []);
        } catch (err) {
            console.error('Failed to fetch templates:', err);
        }
    };

    // Auth Handlers
    const handleLoginSuccess = async (token: string, userEmail: string) => {
        localStorage.setItem('vm_manager_token', token);
        localStorage.setItem('vm_manager_email', userEmail);
        setAuthToken(token);
        setCurrentUser(userEmail);
        setIsAuthenticated(true);
        await fetchVMs(token);
        await fetchTemplates(token);
    };

    const handleLogout = async () => {
        try {
            if (typeof window !== 'undefined' && (window as any).go?.main?.App?.Logout) {
                await Logout();
            }
        } catch (e) {
            console.error('Logout error:', e);
        }
        localStorage.removeItem('vm_manager_token');
        localStorage.removeItem('vm_manager_email');
        setIsAuthenticated(false);
        setAuthToken('');
        setCurrentUser('');
        setMessage('');
        setVms([]);
        setTemplates([]);
    };

    // Action Helpers
    const executeAction = async (actionFn: (id: string) => Promise<string>, id: string, endpoint?: string) => {
        try {
            if (typeof window !== 'undefined' && (window as any).go?.main?.App) {
                const result = await actionFn(id);
                setMessage(result);
            } else if (endpoint) {
                const token = authToken || localStorage.getItem('vm_manager_token') || '';
                const vmid = parseInt(id, 10);
                const payload = { id: isNaN(vmid) ? id : vmid };
                let resp = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': token },
                    body: JSON.stringify(payload)
                }).catch(async () => {
                    return await fetch('http://localhost:8080' + endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': token },
                        body: JSON.stringify(payload)
                    });
                });
                if (!resp || !resp.ok) {
                    const errData = await resp?.json().catch(() => ({}));
                    throw new Error(errData?.error || `Action failed with status ${resp ? resp.status : 'network error'}`);
                }
                setMessage(`Action completed successfully`);
            }
            await fetchVMs();
        } catch (error: any) {
            setMessage(`Error: ${error?.message || error}`);
        }
    };

    const handleActionWithConfirm = (
        actionFn: (id: string) => Promise<string>,
        id: string,
        confirmMsg: string,
        endpoint?: string
    ) => {
        setConfirmDialog({
            isOpen: true,
            message: confirmMsg,
            onConfirm: () => {
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                executeAction(actionFn, id, endpoint);
            }
        });
    };

    // VM Operations
    const handleStartVM = (id: string, _name: string) => {
        executeAction(StartVM, id, '/vms/start');
    };

    const handleStopVM = (id: string, name: string) => {
        handleActionWithConfirm(StopVM, id, `Are you sure you want to stop ${name}?`, '/vms/stop');
    };

    const handleDeleteVM = (id: string, name: string) => {
        handleActionWithConfirm(DeleteVM, id, `Are you sure you want to DELETE ${name}? This action cannot be undone.`, '/vms/delete');
    };

    const handleOpenConsole = (id: string) => {
        const targetVM = vms.find(v => String(v.id) === id);
        if (!targetVM) {
            setMessage(`Error: VM ${id} not found`);
            return;
        }
        if (targetVM.status !== 'Running') {
            setMessage(`Error: ${targetVM.name} is stopped. Start the VM first to open the console.`);
            return;
        }
        setActiveConsoleVM(targetVM);
    };

    const handlePopOutConsole = async (id: string) => {
        try {
            if (typeof window !== 'undefined' && (window as any).go?.main?.App?.OpenConsole) {
                await OpenConsole(id);
                setActiveConsoleVM(null);
            }
        } catch (error) {
            setMessage(`Error popping out console: ${error}`);
        }
    };

    const handleCreateVM = async (name: string, templateId: string) => {
        if (!name.trim()) {
            setMessage('Error: VM name cannot be empty');
            return;
        }
        try {
            if (typeof window !== 'undefined' && (window as any).go?.main?.App?.CreateVMFromTemplate) {
                await CreateVMFromTemplate(name, templateId);
            } else {
                const token = authToken || localStorage.getItem('vm_manager_token') || '';
                const templateNum = parseInt(templateId, 10);
                const payload = {
                    name,
                    template_id: isNaN(templateNum) ? templateId : templateNum
                };
                let resp: Response;
                try {
                    resp = await fetch('/vms/create', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': token
                        },
                        body: JSON.stringify(payload)
                    });
                } catch {
                    resp = await fetch('http://localhost:8080/vms/create', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': token
                        },
                        body: JSON.stringify(payload)
                    });
                }

                if (!resp || !resp.ok) {
                    throw new Error(`Creation failed with status ${resp ? resp.status : 'network error'}`);
                }
            }
            setMessage(`Successfully created VM: ${name}`);
            await fetchVMs();
        } catch (error: any) {
            setMessage(`Error: ${error?.message || error}`);
        }
    };

    // Networking Operations
    const handleAddNIC = async () => {
        if (!managingConnectionsVM) return;
        try {
            if (typeof window !== 'undefined' && (window as any).go?.main?.App?.AddNIC) {
                const result = await AddNIC(String(managingConnectionsVM.id));
                setMessage(result);
            } else {
                const token = authToken || localStorage.getItem('vm_manager_token') || '';
                const vmid = parseInt(String(managingConnectionsVM.id), 10);
                const resp = await fetch('/vms/network/add-nic', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': token },
                    body: JSON.stringify({ vmid })
                }).catch(async () => {
                    return await fetch('http://localhost:8080/vms/network/add-nic', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': token },
                        body: JSON.stringify({ vmid })
                    });
                });
                if (!resp || !resp.ok) throw new Error('Failed to add NIC');
                setMessage(`Added Virtual NIC to ${managingConnectionsVM.name}`);
            }
            await fetchVMs();
        } catch (error: any) {
            setMessage(`Error: ${error?.message || error}`);
        }
    };

    const handleRemoveNIC = async (nic: string) => {
        if (!managingConnectionsVM) return;
        try {
            if (typeof window !== 'undefined' && (window as any).go?.main?.App?.RemoveNIC) {
                const result = await RemoveNIC(String(managingConnectionsVM.id), nic);
                setMessage(result);
            } else {
                const token = authToken || localStorage.getItem('vm_manager_token') || '';
                const vmid = parseInt(String(managingConnectionsVM.id), 10);
                const resp = await fetch('/vms/network/remove', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': token },
                    body: JSON.stringify({ vmid, nic })
                }).catch(async () => {
                    return await fetch('http://localhost:8080/vms/network/remove', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': token },
                        body: JSON.stringify({ vmid, nic })
                    });
                });
                if (!resp || !resp.ok) throw new Error('Failed to remove NIC');
                setMessage(`Removed ${nic} from ${managingConnectionsVM.name}`);
            }
            await fetchVMs();
        } catch (error: any) {
            setMessage(`Error: ${error?.message || error}`);
        }
    };

    const handleConnect = async (localNic: string, targetVmId: string, targetNic: string) => {
        if (!managingConnectionsVM) return;
        try {
            if (typeof window !== 'undefined' && (window as any).go?.main?.App?.ConnectVMs) {
                const result = await ConnectVMs(String(managingConnectionsVM.id), localNic, targetVmId, targetNic);
                setMessage(result);
            } else {
                const token = authToken || localStorage.getItem('vm_manager_token') || '';
                const vmid1 = parseInt(String(managingConnectionsVM.id), 10);
                const vmid2 = parseInt(targetVmId, 10);
                const resp = await fetch('/vms/network/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': token },
                    body: JSON.stringify({ vmid1, vmid2, nic1: localNic, nic2: targetNic })
                }).catch(async () => {
                    return await fetch('http://localhost:8080/vms/network/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': token },
                        body: JSON.stringify({ vmid1, vmid2, nic1: localNic, nic2: targetNic })
                    });
                });
                if (!resp || !resp.ok) throw new Error('Failed to connect VMs');
                setMessage(`Connected ${managingConnectionsVM.name} to target VM`);
            }
            await fetchVMs();
        } catch (error: any) {
            setMessage(`Error: ${error?.message || error}`);
        }
    };

    const handleDisconnect = async (targetId: string) => {
        if (!managingConnectionsVM) return;
        try {
            if (typeof window !== 'undefined' && (window as any).go?.main?.App?.DisconnectVMs) {
                const result = await DisconnectVMs(String(managingConnectionsVM.id), targetId);
                setMessage(result);
            } else {
                const token = authToken || localStorage.getItem('vm_manager_token') || '';
                const vmid1 = parseInt(String(managingConnectionsVM.id), 10);
                const vmid2 = parseInt(targetId, 10);
                const resp = await fetch('/vms/network/disconnect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': token },
                    body: JSON.stringify({ vmid1, vmid2 })
                }).catch(async () => {
                    return await fetch('http://localhost:8080/vms/network/disconnect', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': token },
                        body: JSON.stringify({ vmid1, vmid2 })
                    });
                });
                if (!resp || !resp.ok) throw new Error('Failed to disconnect VMs');
                setMessage(`Disconnected ${managingConnectionsVM.name} from target VM`);
            }
            await fetchVMs();
        } catch (error: any) {
            setMessage(`Error: ${error?.message || error}`);
        }
    };

    // Console Mode
    if (launchedConsoleVM) {
        return (
            <div style={{ height: '100vh', width: '100vw', backgroundColor: '#0a0f1d', margin: 0, padding: 0 }}>
                <VMConsole 
                    vmId={launchedConsoleParams?.id || launchedConsoleVM}
                    vmName={launchedConsoleParams?.name || launchedConsoleVM}
                    token={launchedConsoleParams?.token || authToken}
                    onClose={() => Quit()} 
                />
            </div>
        );
    }

    // Session Verifying State
    if (isVerifyingSession) {
        return (
            <div className="login-container">
                <div className="card login-card" style={{ textAlign: 'center', padding: '36px 24px' }}>
                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>Verifying session...</p>
                </div>
            </div>
        );
    }

    // Login Form
    if (!isAuthenticated) {
        return <Login onLoginSuccess={handleLoginSuccess} />;
    }

    // Main App View
    return (
        <div className="container">
            <ConfirmModal 
                isOpen={confirmDialog.isOpen}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
            />

            <NetworkingModal 
                vm={managingConnectionsVM}
                allVMs={vms}
                onClose={() => setManagingConnectionsVM(null)}
                onAddNIC={handleAddNIC}
                onRemoveNIC={handleRemoveNIC}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
            />

            <NetworkTopologyModal 
                isOpen={showNetworkMap}
                vms={vms}
                onClose={() => setShowNetworkMap(false)}
            />

            {activeConsoleVM && (
                <VMConsole 
                    vmId={activeConsoleVM.id}
                    vmName={activeConsoleVM.name}
                    token={authToken}
                    onClose={() => setActiveConsoleVM(null)}
                    onPopOut={typeof window !== 'undefined' && (window as any).go?.main?.App?.OpenConsole ? () => handlePopOutConsole(String(activeConsoleVM.id)) : undefined}
                />
            )}

            <Header 
                currentUser={currentUser}
                showNetworkMap={showNetworkMap}
                onToggleNetworkMap={() => setShowNetworkMap(prev => !prev)}
                onLogout={handleLogout}
            />

            {message && (
                <div className={`message ${message.startsWith('Error') ? 'error' : 'success'}`}>
                    {message}
                </div>
            )}

            <CreateVMCard 
                templates={templates}
                onCreateVM={handleCreateVM}
            />

            <VMTable 
                vms={vms}
                isRefreshing={isRefreshing}
                onRefresh={() => fetchVMs()}
                onStartVM={handleStartVM}
                onStopVM={handleStopVM}
                onOpenConsole={handleOpenConsole}
                onManageNetworking={(vm) => setManagingConnectionsVM(vm)}
                onDeleteVM={handleDeleteVM}
            />
        </div>
    );
}

export default App;
