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
import { NodesCard, ProxmoxNode } from './components/NodesCard';
import { TeacherView } from './components/TeacherView';

import './App.css';

function App() {
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const saved = localStorage.getItem('vm_manager_theme');
        return saved === 'light' ? 'light' : 'dark';
    });

    const [launchedConsoleVM, setLaunchedConsoleVM] = useState<string>('');

    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isVerifyingSession, setIsVerifyingSession] = useState(true);
    const [currentUser, setCurrentUser] = useState<string>('');
    const [userRole, setUserRole] = useState<string>('');
    const [currentView, setCurrentView] = useState<'student' | 'teacher'>('student');
    const [authToken, setAuthToken] = useState<string>('');

    const [nodes, setNodes] = useState<ProxmoxNode[]>([]);
    const [selectedNode, setSelectedNode] = useState<string>('');

    const [vms, setVms] = useState<main.VM[]>([]);
    const [templates, setTemplates] = useState<main.Template[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [message, setMessage] = useState('');

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

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('vm_manager_theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

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

    useEffect(() => {
        const restoreSession = async () => {
            const savedToken = localStorage.getItem('vm_manager_token');
            const savedEmail = localStorage.getItem('vm_manager_email');
            const savedRole = localStorage.getItem('vm_manager_role');
            if (savedToken) {
                try {
                    let isValid = false;
                    if (typeof window !== 'undefined' && (window as any).go?.main?.App?.VerifySession) {
                        isValid = await VerifySession(savedToken);
                    } else {
                        const resp = await fetch('/ping', {
                            headers: { 'Authorization': savedToken }
                        }).catch(async () => {
                            return await fetch('http://10.0.10.52:8080/ping', {
                                headers: { 'Authorization': savedToken }
                            });
                        });
                        isValid = !!resp && resp.status === 200;
                    }

                    if (isValid) {
                        setIsAuthenticated(true);
                        setAuthToken(savedToken);
                        setCurrentUser(savedEmail || '');
                        if (savedRole) {
                            setUserRole(savedRole);
                            if (savedRole === 'teacher') {
                                setCurrentView('teacher');
                            }
                        }
                        await fetchVMs(savedToken);
                        await fetchTemplates(savedToken);
                        if (savedRole === 'teacher') {
                            await fetchNodes(savedToken);
                        }
                    } else {
                        localStorage.removeItem('vm_manager_token');
                        localStorage.removeItem('vm_manager_email');
                        localStorage.removeItem('vm_manager_role');
                    }
                } catch {
                    localStorage.removeItem('vm_manager_token');
                    localStorage.removeItem('vm_manager_email');
                    localStorage.removeItem('vm_manager_role');
                }
            }
            setIsVerifyingSession(false);
        };
        restoreSession();
    }, []);

    useEffect(() => {
        if (managingConnectionsVM) {
            const updatedVM = vms.find(v => String(v.id) === String(managingConnectionsVM.id));
            setManagingConnectionsVM(updatedVM || null);
        }
    }, [vms]);

    const fetchNodes = async (tokenOverride?: string) => {
        const token = tokenOverride || authToken || localStorage.getItem('vm_manager_token') || '';
        if (!token) return;
        try {
            let data: ProxmoxNode[] = [];
            if (typeof window !== 'undefined' && (window as any).go?.main?.App?.GetNodes) {
                data = await (window as any).go.main.App.GetNodes(token);
            } else {
                let resp: Response;
                try {
                    resp = await fetch('/nodes', {
                        headers: { 'Authorization': token }
                    });
                } catch {
                    resp = await fetch('http://10.0.10.52:8080/nodes', {
                        headers: { 'Authorization': token }
                    });
                }
                if (resp && resp.ok) {
                    data = await resp.json();
                }
            }
            setNodes(data || []);
        } catch (err) {
            console.error('Failed to fetch nodes:', err);
        }
    };

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
                    resp = await fetch('http://10.0.10.52:8080/vms', {
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
                    resp = await fetch('http://10.0.10.52:8080/vms/templates', {
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

    const handleLoginSuccess = async (token: string, userEmail: string, role?: string) => {
        localStorage.setItem('vm_manager_token', token);
        localStorage.setItem('vm_manager_email', userEmail);
        if (role) {
            localStorage.setItem('vm_manager_role', role);
            setUserRole(role);
            if (role === 'teacher') {
                setCurrentView('teacher');
            }
        }
        setAuthToken(token);
        setCurrentUser(userEmail);
        setIsAuthenticated(true);
        await fetchVMs(token);
        await fetchTemplates(token);
        if (role === 'teacher') {
            await fetchNodes(token);
        }
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
        localStorage.removeItem('vm_manager_role');
        setIsAuthenticated(false);
        setAuthToken('');
        setCurrentUser('');
        setUserRole('');
        setMessage('');
        setVms([]);
        setTemplates([]);
        setNodes([]);
        setSelectedNode('');
    };

    const executeAction = async (actionFn: (id: string) => Promise<string>, id: string, endpoint?: string, node?: string) => {
        try {
            if (typeof window !== 'undefined' && (window as any).go?.main?.App) {
                const result = await actionFn(id);
                setMessage(result);
            } else if (endpoint) {
                const token = authToken || localStorage.getItem('vm_manager_token') || '';
                const vmid = parseInt(id, 10);
                const payload: any = { id: isNaN(vmid) ? id : vmid };
                if (node) {
                    payload.node = node;
                }
                let resp = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': token },
                    body: JSON.stringify(payload)
                }).catch(async () => {
                    return await fetch('http://10.0.10.52:8080' + endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': token },
                        body: JSON.stringify(payload)
                    });
                });
                if (!resp || !resp.ok) {
                    const errData = await resp?.json().catch(() => ({}));
                    throw new Error(errData?.error || `Akce selhala se stavovým kódem ${resp ? resp.status : 'chyba sítě'}`);
                }
                setMessage(`Akce byla úspěšně dokončena`);
            }
            await fetchVMs();
        } catch (error: any) {
            setMessage(`Chyba: ${error?.message || error}`);
        }
    };

    const handleActionWithConfirm = (
        actionFn: (id: string) => Promise<string>,
        id: string,
        confirmMsg: string,
        endpoint?: string,
        node?: string
    ) => {
        setConfirmDialog({
            isOpen: true,
            message: confirmMsg,
            onConfirm: () => {
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                executeAction(actionFn, id, endpoint, node);
            }
        });
    };

    const handleStartVM = (id: string, _name: string, node?: string) => {
        executeAction(StartVM, id, '/vms/start', node);
    };

    const handleStopVM = (id: string, name: string, node?: string) => {
        handleActionWithConfirm(StopVM, id, `Opravdu chcete zastavit virtuální stroj ${name}?`, '/vms/stop', node);
    };

    const handleDeleteVM = (id: string, name: string, node?: string) => {
        handleActionWithConfirm(DeleteVM, id, `Opravdu chcete SMAZAT virtuální stroj ${name}? Tuto akci nelze vrátit.`, '/vms/delete', node);
    };

    const handleOpenConsole = (id: string, node?: string) => {
        const targetVM = vms.find(v => String(v.id) === id && (!node || (v as any).node === node));
        if (!targetVM) {
            setMessage(`Chyba: Virtuální stroj ${id} nebyl nalezen`);
            return;
        }
        if (targetVM.status !== 'Running') {
            setMessage(`Chyba: Virtuální stroj ${targetVM.name} je zastaven. Pro otevření konzole jej nejprve spusťte.`);
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
            setMessage(`Chyba při otevírání samostatného okna konzole: ${error}`);
        }
    };

    const handleCreateVM = async (name: string, templateId: string, node?: string) => {
        if (!name.trim()) {
            setMessage('Chyba: Název virtuálního stroje nesmí být prázdný');
            return;
        }
        try {
            if (typeof window !== 'undefined' && (window as any).go?.main?.App?.CreateVMOnNode && node) {
                await (window as any).go.main.App.CreateVMOnNode(name, templateId, node);
            } else if (typeof window !== 'undefined' && (window as any).go?.main?.App?.CreateVMFromTemplate) {
                await CreateVMFromTemplate(name, templateId);
            } else {
                const token = authToken || localStorage.getItem('vm_manager_token') || '';
                const templateNum = parseInt(templateId, 10);
                const payload: any = {
                    name,
                    template_id: isNaN(templateNum) ? templateId : templateNum
                };
                if (node) {
                    payload.node = node;
                }
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
                    resp = await fetch('http://10.0.10.52:8080/vms/create', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': token
                        },
                        body: JSON.stringify(payload)
                    });
                }

                if (!resp || !resp.ok) {
                    throw new Error(`Vytvoření selhalo: ${resp ? resp.status : 'chyba sítě'}`);
                }
            }
            setMessage(`Virtuální stroj ${name} byl úspěšně vytvořen`);
            await fetchVMs();
            if (userRole === 'teacher') {
                await fetchNodes();
            }
        } catch (error: any) {
            setMessage(`Chyba: ${error?.message || error}`);
        }
    };

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
                    return await fetch('http://10.0.10.52:8080/vms/network/add-nic', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': token },
                        body: JSON.stringify({ vmid })
                    });
                });
                if (!resp || !resp.ok) throw new Error('Nepodařilo se přidat síťové rozhraní');
                setMessage(`K virtuálnímu stroji ${managingConnectionsVM.name} bylo přidáno síťové rozhraní`);
            }
            await fetchVMs();
        } catch (error: any) {
            setMessage(`Chyba: ${error?.message || error}`);
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
                    return await fetch('http://10.0.10.52:8080/vms/network/remove', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': token },
                        body: JSON.stringify({ vmid, nic })
                    });
                });
                if (!resp || !resp.ok) throw new Error('Nepodařilo se odebrat síťové rozhraní');
                setMessage(`Ze stroje ${managingConnectionsVM.name} bylo odebráno rozhraní ${nic}`);
            }
            await fetchVMs();
        } catch (error: any) {
            setMessage(`Chyba: ${error?.message || error}`);
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
                    return await fetch('http://10.0.10.52:8080/vms/network/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': token },
                        body: JSON.stringify({ vmid1, vmid2, nic1: localNic, nic2: targetNic })
                    });
                });
                if (!resp || !resp.ok) throw new Error('Nepodařilo se propojit virtuální stroje');
                setMessage(`Stroj ${managingConnectionsVM.name} byl úspěšně propojen s cílovým VM`);
            }
            await fetchVMs();
        } catch (error: any) {
            setMessage(`Chyba: ${error?.message || error}`);
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
                    return await fetch('http://10.0.10.52:8080/vms/network/disconnect', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': token },
                        body: JSON.stringify({ vmid1, vmid2 })
                    });
                });
                if (!resp || !resp.ok) throw new Error('Nepodařilo se odpojit virtuální stroje');
                setMessage(`Stroj ${managingConnectionsVM.name} byl odpojen od cílového VM`);
            }
            await fetchVMs();
        } catch (error: any) {
            setMessage(`Chyba: ${error?.message || error}`);
        }
    };

    if (launchedConsoleVM) {
        return (
            <div style={{ height: '100vh', width: '100vw', backgroundColor: 'var(--bg-color)', margin: 0, padding: 0 }}>
                <VMConsole 
                    vmId={launchedConsoleParams?.id || launchedConsoleVM}
                    vmName={launchedConsoleParams?.name || launchedConsoleVM}
                    token={launchedConsoleParams?.token || authToken}
                    onClose={() => Quit()} 
                />
            </div>
        );
    }

    if (isVerifyingSession) {
        return (
            <div className="login-container">
                <div className="card login-card" style={{ textAlign: 'center', padding: '36px 24px' }}>
                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>Ověřování přihlášení...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Login onLoginSuccess={handleLoginSuccess} />;
    }

    const filteredVMs = selectedNode 
        ? vms.filter(v => (v as any).node === selectedNode) 
        : vms;

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
                    vmNode={(activeConsoleVM as any).node}
                    token={authToken}
                    onClose={() => setActiveConsoleVM(null)}
                    onPopOut={typeof window !== 'undefined' && (window as any).go?.main?.App?.OpenConsole ? () => handlePopOutConsole(String(activeConsoleVM.id)) : undefined}
                />
            )}

            <Header 
                currentUser={currentUser}
                userRole={userRole}
                currentView={currentView}
                onViewChange={setCurrentView}
                showNetworkMap={showNetworkMap}
                onToggleNetworkMap={() => setShowNetworkMap(prev => !prev)}
                theme={theme}
                onToggleTheme={toggleTheme}
                onLogout={handleLogout}
            />

            {message && (
                <div className={`message ${message.startsWith('Chyba') || message.startsWith('Error') ? 'error' : 'success'}`}>
                    {message}
                </div>
            )}

            {userRole === 'teacher' && currentView === 'teacher' ? (
                <TeacherView 
                    token={authToken}
                    nodes={nodes}
                    templates={templates}
                    vms={vms}
                    onRefreshNodes={fetchNodes}
                    onRefreshVMs={fetchVMs}
                    onMessage={setMessage}
                />
            ) : (
                <>
                    {userRole === 'teacher' && (
                        <NodesCard 
                            nodes={nodes}
                            isRefreshing={isRefreshing}
                            onRefresh={() => fetchNodes()}
                            selectedNode={selectedNode}
                            onSelectNode={setSelectedNode}
                        />
                    )}

                    <CreateVMCard 
                        templates={templates}
                        nodes={nodes}
                        onCreateVM={handleCreateVM}
                        userRole={userRole}
                    />

                    <VMTable 
                        vms={filteredVMs}
                        userRole={userRole}
                        isRefreshing={isRefreshing}
                        onRefresh={() => { fetchVMs(); if (userRole === 'teacher') fetchNodes(); }}
                        onStartVM={handleStartVM}
                        onStopVM={handleStopVM}
                        onOpenConsole={handleOpenConsole}
                        onManageNetworking={(vm) => setManagingConnectionsVM(vm)}
                        onDeleteVM={handleDeleteVM}
                    />
                </>
            )}
        </div>
    );
}

export default App;
