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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>Proxmox VE Cluster Nodes ({nodes.length})</h3>
                <button 
                    className="btn btn-secondary btn-sm" 
                    onClick={onRefresh} 
                    disabled={isRefreshing}
                >
                    {isRefreshing ? 'Refreshing...' : 'Refresh Nodes'}
                </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                {nodes.map(node => (
                    <div 
                        key={node.name}
                        onClick={() => onSelectNode && onSelectNode(node.name === selectedNode ? '' : node.name)}
                        style={{
                            padding: '12px',
                            borderRadius: '6px',
                            border: selectedNode === node.name ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                            backgroundColor: selectedNode === node.name ? '#eff6ff' : '#f9fafb',
                            cursor: onSelectNode ? 'pointer' : 'default'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <strong style={{ fontSize: '15px' }}>{node.name}</strong>
                            <span className={`status-badge ${node.status === 'online' ? 'status-running' : 'status-stopped'}`}>
                                {node.status}
                            </span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            <div>URI: {node.host_uri.replace('/api2/json', '')}</div>
                            {node.version && <div>PVE: {node.version}</div>}
                            <div style={{ marginTop: '4px' }}>
                                VMs: <strong>{node.total_vms || 0}</strong> ({node.running_vms || 0} running)
                            </div>
                        </div>
                    </div>
                ))}
                {nodes.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)', padding: '16px' }}>
                        No cluster nodes detected.
                    </div>
                )}
            </div>
        </div>
    );
}
