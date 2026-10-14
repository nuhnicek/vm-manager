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
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '90vw', width: '100%', height: '90vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h4 style={{ margin: 0 }}>VM Network Topology</h4>
                    <button className="btn btn-sm btn-secondary" onClick={onClose}>Close</button>
                </div>
                <div style={{ flex: 1, overflow: 'auto', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
                    <NetworkMap vms={vms} />
                </div>
            </div>
        </div>
    );
}
