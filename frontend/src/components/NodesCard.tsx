export interface ProxmoxNode {
    name: string;
    host_uri: string;
    status: string;
    version?: string;
    total_vms?: number;
    running_vms?: number;
    templates?: number;
}

interface NodesCardProps {
    nodes: ProxmoxNode[];
    isRefreshing: boolean;
    onRefresh: () => void;
    selectedNode?: string;
    onSelectNode?: (nodeName: string) => void;
}

export function NodesCard({ nodes, isRefreshing, onRefresh, selectedNode, onSelectNode }: NodesCardProps) {
    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                    <h3 style={{ margin: 0 }}>Uzly Proxmox VE Clusteru ({nodes.length})</h3>
                    <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                        Fyzické hypervizory připojené do výpočetního poolu
                    </p>
                </div>
                <button 
                    className="btn btn-secondary btn-sm" 
                    onClick={onRefresh} 
                    disabled={isRefreshing}
                >
                    {isRefreshing ? 'Obnovování...' : 'Obnovit uzly'}
                </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '14px' }}>
                {nodes.map(node => {
                    const isOnline = node.status.toLowerCase() === 'online';
                    const isSelected = selectedNode === node.name;

                    return (
                        <div 
                            key={node.name}
                            onClick={() => onSelectNode && onSelectNode(isSelected ? '' : node.name)}
                            className={`node-card ${isSelected ? 'selected' : ''}`}
                            style={{ cursor: onSelectNode ? 'pointer' : 'default' }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span className="status-badge-dot" style={{ backgroundColor: isOnline ? 'var(--success-text)' : 'var(--danger-text)' }}></span>
                                    <strong style={{ fontSize: '14px' }}>{node.name}</strong>
                                </div>
                                <span className={`status-badge ${isOnline ? 'status-running' : 'status-stopped'}`}>
                                    <span className="status-badge-dot"></span>
                                    {isOnline ? 'ONLINE' : 'OFFLINE'}
                                </span>
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div>URI: <span className="mono-tag">{node.host_uri.replace('/api2/json', '')}</span></div>
                                {node.version && <div>PVE Verze: {node.version}</div>}
                                <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid var(--border-subtle)' }}>
                                    VM Celkem: <strong>{node.total_vms || 0}</strong> ({node.running_vms || 0} běží)
                                </div>
                            </div>
                        </div>
                    );
                })}
                {nodes.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                        Nebyly zjištěny žádné uzly clusteru.
                    </div>
                )}
            </div>
        </div>
    );
}
