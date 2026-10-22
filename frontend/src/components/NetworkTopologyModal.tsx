import { main } from '../../wailsjs/go/models';
import { NetworkMap } from './NetworkMap';

interface NetworkTopologyModalProps {
    isOpen: boolean;
    vms: main.VM[];
    onClose: () => void;
}

export function NetworkTopologyModal({ isOpen, vms, onClose }: NetworkTopologyModalProps) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" style={{ maxWidth: '90vw', width: '100%', height: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h4 style={{ margin: 0 }}>Topologie sítě virtuálních strojů</h4>
                    <button className="btn btn-sm btn-secondary" onClick={onClose}>Zavřít</button>
                </div>
                <div style={{ flex: 1, overflow: 'auto', backgroundColor: 'var(--card-bg-subtle)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
                    <NetworkMap vms={vms} />
                </div>
            </div>
        </div>
    );
}

