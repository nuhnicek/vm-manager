import { useState, useEffect, useMemo } from 'react';
import { CatalogItem, Project, ProxmoxNode } from '../types';
import { apiFetch } from '../api';

interface CatalogModalProps {
    isOpen: boolean;
    projects?: Project[];
    nodes?: ProxmoxNode[];
    selectedProjectId?: string;
    onClose: () => void;
    onSuccess: () => void;
    userRole?: string;
}

export function CatalogModal({
    isOpen,
    projects = [],
    nodes = [],
    selectedProjectId,
    onClose,
    onSuccess,
    userRole
}: CatalogModalProps) {
    const isTeacher = userRole === 'teacher';
    const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
    const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
    const [activeTab, setActiveTab] = useState<'all' | 'lxc' | 'vuln' | 'sec'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);

    const [machineName, setMachineName] = useState('');
    const [assignedProjectId, setAssignedProjectId] = useState('');
    const [ramMB, setRamMB] = useState(512);
    const [cores, setCores] = useState(1);
    const [diskGB, setDiskGB] = useState(8);
    const [isDHCP, setIsDHCP] = useState(true);
    const [ip, setIp] = useState('');
    const [gateway, setGateway] = useState('10.0.10.1');
    const [rootPassword, setRootPassword] = useState('Lab411Admin!');
    const [selectedNode, setSelectedNode] = useState('');
    const [isDeploying, setIsDeploying] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        if (isOpen) {
            setError('');
            setSuccessMsg('');
            setSelectedItem(null);
            setSearchQuery('');
            setActiveTab('all');
            fetchCatalog();
        }
    }, [isOpen]);

    const fetchCatalog = async () => {
        setIsLoadingCatalog(true);
        try {
            const resp = await apiFetch('/catalog');
            if (resp.ok) {
                const data = await resp.json();
                setCatalogItems(data);
            }
        } catch {
        } finally {
            setIsLoadingCatalog(false);
        }
    };

    const filteredItems = useMemo(() => {
        return catalogItems.filter(item => {
            if (activeTab === 'lxc' && item.type !== 'lxc') return false;
            if (activeTab === 'vuln' && !item.is_vulnerable) return false;
            if (activeTab === 'sec' && item.category !== 'Bezpečnostní nástroje') return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchName = item.name.toLowerCase().includes(q);
                const matchDesc = item.description.toLowerCase().includes(q);
                const matchCat = item.category.toLowerCase().includes(q);
                if (!matchName && !matchDesc && !matchCat) return false;
            }
            return true;
        });
    }, [catalogItems, activeTab, searchQuery]);

    const handleSelectForDeploy = (item: CatalogItem) => {
        setSelectedItem(item);
        setError('');
        setSuccessMsg('');
        const safeBase = item.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
        setMachineName(`${safeBase}-${Math.floor(Math.random() * 800 + 100)}`);
        setRamMB(item.default_ram);
        setCores(item.default_cpus);
        setDiskGB(item.default_disk_gb);
        setIsDHCP(true);
        setIp('');
        setGateway('10.0.10.1');
        setRootPassword('Lab411Admin!');
        if (selectedProjectId && selectedProjectId !== 'all' && selectedProjectId !== 'none') {
            setAssignedProjectId(selectedProjectId);
        } else {
            setAssignedProjectId('');
        }
    };

    const handleDeploy = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedItem) return;

        setError('');
        setSuccessMsg('');

        if (!machineName.trim()) {
            setError('Zadejte prosím název stroje.');
            return;
        }

        if (!isDHCP && !ip.trim()) {
            setError('Zadejte prosím statickou IP adresu.');
            return;
        }

        setIsDeploying(true);
        try {
            const resp = await apiFetch('/catalog/deploy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    catalog_id: selectedItem.id,
                    name: machineName.trim(),
                    ram: ramMB,
                    cores: cores,
                    disk: diskGB,
                    project_id: assignedProjectId,
                    ip: isDHCP ? '' : ip.trim(),
                    gateway: isDHCP ? '' : gateway.trim(),
                    is_dhcp: isDHCP,
                    node: selectedNode,
                    password: rootPassword
                })
            });

            if (!resp.ok) {
                const errData = await resp.json().catch(() => ({}));
                throw new Error(errData.error || `Nasazení selhalo (${resp.status})`);
            }

            setSuccessMsg('Stroj byl úspěšně nasazen a spuštěn.');
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 800);
        } catch (err: any) {
            setError(err.message || 'Chyba při nasazování stroje');
        } finally {
            setIsDeploying(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-backdrop">
            <div className="modal-content" style={{ maxWidth: selectedItem ? '640px' : '880px', width: '92%' }}>
                <div className="modal-header">
                    <div>
                        <h3 className="modal-title">
                            {selectedItem ? 'Konfigurace nasazení' : 'Katalog šablon a kontejnerů'}
                        </h3>
                        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                            {selectedItem
                                ? `Přizpůsobení parametrů pro ${selectedItem.name}`
                                : 'Okamžité nasazení rychlých LXC kontejnerů, zranitelných cílů a virtuálních strojů'}
                        </p>
                    </div>
                    <button type="button" className="close-button" onClick={onClose} disabled={isDeploying}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                {error && (
                    <div style={{
                        margin: '16px 24px 0 24px',
                        padding: '10px 14px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '8px',
                        color: '#ef4444',
                        fontSize: '13px'
                    }}>
                        {error}
                    </div>
                )}

                {successMsg && (
                    <div style={{
                        margin: '16px 24px 0 24px',
                        padding: '10px 14px',
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '8px',
                        color: '#10b981',
                        fontSize: '13px'
                    }}>
                        {successMsg}
                    </div>
                )}

                {!selectedItem ? (
                    <div style={{ padding: '20px 24px' }}>
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('all')}
                                    className={`btn ${activeTab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                                    style={{ fontSize: '12px', padding: '6px 12px' }}
                                >
                                    Vše
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('lxc')}
                                    className={`btn ${activeTab === 'lxc' ? 'btn-primary' : 'btn-secondary'}`}
                                    style={{ fontSize: '12px', padding: '6px 12px' }}
                                >
                                    Rychlé kontejnery (LXC)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('vuln')}
                                    className={`btn ${activeTab === 'vuln' ? 'btn-primary' : 'btn-secondary'}`}
                                    style={{ fontSize: '12px', padding: '6px 12px' }}
                                >
                                    Zranitelné cíle (Security)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('sec')}
                                    className={`btn ${activeTab === 'sec' ? 'btn-primary' : 'btn-secondary'}`}
                                    style={{ fontSize: '12px', padding: '6px 12px' }}
                                >
                                    Bezpečnostní nástroje
                                </button>
                            </div>
                            <div style={{ flex: 1, minWidth: '200px' }}>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Hledat v katalogu (např. alpine, metasploit)..."
                                    style={{ width: '100%', padding: '6px 12px', fontSize: '13px' }}
                                />
                            </div>
                        </div>

                        {isLoadingCatalog ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                Načítání katalogu...
                            </div>
                        ) : filteredItems.length === 0 ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                Žádné položky neodpovídají zvolenému filtru.
                            </div>
                        ) : (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                                gap: '14px',
                                maxHeight: '60vh',
                                overflowY: 'auto',
                                paddingRight: '4px'
                            }}>
                                {filteredItems.map(item => {
                                    const isLXC = item.type === 'lxc';
                                    return (
                                        <div
                                            key={item.id}
                                            style={{
                                                background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
                                                border: item.is_vulnerable ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-color)',
                                                borderRadius: '10px',
                                                padding: '16px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'space-between',
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                                                    <span style={{
                                                        fontSize: '10px',
                                                        fontWeight: 700,
                                                        letterSpacing: '0.05em',
                                                        padding: '3px 8px',
                                                        borderRadius: '4px',
                                                        background: isLXC ? 'rgba(59, 130, 246, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                                                        color: isLXC ? '#3b82f6' : '#a855f7'
                                                    }}>
                                                        {isLXC ? 'LXC KONTEJNER' : 'QEMU VM'}
                                                    </span>

                                                    {item.is_vulnerable && (
                                                        <span style={{
                                                            fontSize: '10px',
                                                            fontWeight: 700,
                                                            letterSpacing: '0.05em',
                                                            padding: '3px 8px',
                                                            borderRadius: '4px',
                                                            background: 'rgba(239, 68, 68, 0.15)',
                                                            color: '#ef4444'
                                                        }}>
                                                            ZRANITELNÝ CÍL
                                                        </span>
                                                    )}
                                                </div>

                                                <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 600 }}>
                                                    {item.name}
                                                </h4>

                                                <p style={{
                                                    margin: '0 0 12px 0',
                                                    fontSize: '12px',
                                                    color: 'var(--text-muted)',
                                                    lineHeight: 1.45,
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 3,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden'
                                                }}>
                                                    {item.description}
                                                </p>
                                            </div>

                                            <div>
                                                <div style={{
                                                    display: 'flex',
                                                    gap: '8px',
                                                    fontSize: '11px',
                                                    color: 'var(--text-muted)',
                                                    marginBottom: '12px'
                                                }}>
                                                    <span>{item.default_ram} MB RAM</span>
                                                    <span>•</span>
                                                    <span>{item.default_cpus} vCPU</span>
                                                    <span>•</span>
                                                    <span>{item.default_disk_gb} GB</span>
                                                </div>

                                                <button
                                                    type="button"
                                                    className="btn btn-primary"
                                                    style={{ width: '100%', fontSize: '12px', padding: '7px 12px' }}
                                                    onClick={() => handleSelectForDeploy(item)}
                                                    disabled={!item.ready}
                                                >
                                                    {item.ready ? 'Nasadit ihned' : 'Nedostupné'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="modal-actions" style={{ marginTop: '20px' }}>
                            <button type="button" className="btn btn-secondary" onClick={onClose}>
                                Zavřít
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleDeploy} style={{ padding: '20px 24px' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
                            padding: '12px 14px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            marginBottom: '16px'
                        }}>
                            <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                    Vybraná předloha
                                </div>
                                <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '2px' }}>
                                    {selectedItem.name}
                                </div>
                            </div>
                            <span style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                padding: '4px 8px',
                                borderRadius: '4px',
                                background: selectedItem.type === 'lxc' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                                color: selectedItem.type === 'lxc' ? '#3b82f6' : '#a855f7'
                            }}>
                                {selectedItem.type === 'lxc' ? 'LXC Kontejner' : 'QEMU Virtuální stroj'}
                            </span>
                        </div>

                        <div className="form-group" style={{ marginBottom: '14px' }}>
                            <label style={{ fontWeight: 600 }}>Název nového stroje:</label>
                            <input
                                type="text"
                                value={machineName}
                                onChange={e => setMachineName(e.target.value)}
                                placeholder="např. alpine-ct-01"
                                required
                                disabled={isDeploying}
                                style={{ width: '100%' }}
                            />
                        </div>

                        {projects && projects.length > 0 && (
                            <div className="form-group" style={{ marginBottom: '14px' }}>
                                <label style={{ fontWeight: 600 }}>Přiřadit k projektu:</label>
                                <select
                                    value={assignedProjectId}
                                    onChange={e => setAssignedProjectId(e.target.value)}
                                    disabled={isDeploying}
                                    style={{ width: '100%' }}
                                >
                                    <option value="">Bez projektu</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr 1fr',
                            gap: '10px',
                            marginBottom: '16px'
                        }}>
                            <div className="form-group">
                                <label style={{ fontSize: '12px', fontWeight: 600 }}>RAM (MB):</label>
                                <input
                                    type="number"
                                    min="128"
                                    max="32768"
                                    step="128"
                                    value={ramMB}
                                    onChange={e => setRamMB(parseInt(e.target.value) || 256)}
                                    disabled={isDeploying}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div className="form-group">
                                <label style={{ fontSize: '12px', fontWeight: 600 }}>Jádra vCPU:</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="8"
                                    value={cores}
                                    onChange={e => setCores(parseInt(e.target.value) || 1)}
                                    disabled={isDeploying}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div className="form-group">
                                <label style={{ fontSize: '12px', fontWeight: 600 }}>Disk (GB):</label>
                                <input
                                    type="number"
                                    min="2"
                                    max="100"
                                    value={diskGB}
                                    onChange={e => setDiskGB(parseInt(e.target.value) || 4)}
                                    disabled={isDeploying}
                                    style={{ width: '100%' }}
                                />
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '16px' }}>
                            <label style={{ fontWeight: 600, marginBottom: '6px', display: 'block' }}>Režim sítě a IP:</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                                <button
                                    type="button"
                                    onClick={() => setIsDHCP(true)}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: '6px',
                                        border: isDHCP ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                                        background: isDHCP ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                                        color: isDHCP ? 'var(--primary-color)' : 'inherit',
                                        fontWeight: isDHCP ? 600 : 400,
                                        cursor: 'pointer',
                                        fontSize: '13px'
                                    }}
                                >
                                    DHCP (Automatická IP)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsDHCP(false)}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: '6px',
                                        border: !isDHCP ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                                        background: !isDHCP ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                                        color: !isDHCP ? 'var(--primary-color)' : 'inherit',
                                        fontWeight: !isDHCP ? 600 : 400,
                                        cursor: 'pointer',
                                        fontSize: '13px'
                                    }}
                                >
                                    Statická IP adresa
                                </button>
                            </div>

                            {!isDHCP && (
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
                                    <input
                                        type="text"
                                        value={ip}
                                        onChange={e => setIp(e.target.value)}
                                        placeholder="IP (např. 10.0.10.160/24)"
                                        required={!isDHCP}
                                        disabled={isDeploying}
                                        style={{ width: '100%', fontSize: '13px' }}
                                    />
                                    <input
                                        type="text"
                                        value={gateway}
                                        onChange={e => setGateway(e.target.value)}
                                        placeholder="Brána (10.0.10.1)"
                                        disabled={isDeploying}
                                        style={{ width: '100%', fontSize: '13px' }}
                                    />
                                </div>
                            )}
                        </div>

                        {selectedItem.type === 'lxc' && (
                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label style={{ fontWeight: 600 }}>Heslo pro uživatele root:</label>
                                <input
                                    type="text"
                                    value={rootPassword}
                                    onChange={e => setRootPassword(e.target.value)}
                                    disabled={isDeploying}
                                    style={{ width: '100%' }}
                                />
                            </div>
                        )}

                        {isTeacher && nodes.length > 0 && (
                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label style={{ fontWeight: 600 }}>Cílový Proxmox uzel:</label>
                                <select
                                    value={selectedNode}
                                    onChange={e => setSelectedNode(e.target.value)}
                                    disabled={isDeploying}
                                    style={{ width: '100%' }}
                                >
                                    <option value="">Automatický výběr uzlu</option>
                                    {nodes.map(n => (
                                        <option key={n.name} value={n.name}>
                                            {n.name} [{n.status.toUpperCase()}]
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="modal-actions" style={{ marginTop: '20px' }}>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setSelectedItem(null)}
                                disabled={isDeploying}
                            >
                                Zpět na katalog
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={isDeploying || !machineName.trim()}
                            >
                                {isDeploying ? 'Nasazuji a spouštím...' : 'Nasadit a spustit'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
