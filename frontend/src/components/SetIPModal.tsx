import { useState, useEffect } from 'react';
import { main } from '../../wailsjs/go/models';
import { apiFetch } from '../api';

interface SetIPModalProps {
    isOpen: boolean;
    vm: main.VM | null;
    onClose: () => void;
    onSuccess: () => void;
}

export function SetIPModal({ isOpen, vm, onClose, onSuccess }: SetIPModalProps) {
    const [isDHCP, setIsDHCP] = useState(true);
    const [ip, setIp] = useState('');
    const [gateway, setGateway] = useState('10.0.10.1');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        if (isOpen && vm) {
            setError('');
            setSuccessMsg('');
            const cfg = vm.configured_ip ? vm.configured_ip.trim() : '';
            if (cfg.toLowerCase() === 'dhcp') {
                setIsDHCP(true);
                setIp('');
                setGateway(vm.gateway || '10.0.10.1');
            } else if (cfg) {
                setIsDHCP(false);
                setIp(cfg);
                setGateway(vm.gateway || '10.0.10.1');
            } else if (vm.ip_address) {
                setIsDHCP(false);
                setIp(vm.ip_address.includes('/') ? vm.ip_address : `${vm.ip_address}/24`);
                setGateway(vm.gateway || '10.0.10.1');
            } else {
                setIsDHCP(true);
                setIp('');
                setGateway('10.0.10.1');
            }
        }
    }, [isOpen, vm]);

    if (!isOpen || !vm) return null;

    const isLXC = vm.type === 'lxc';

    const handleApplyPreset = (prefix: string, defaultGW: string) => {
        setIsDHCP(false);
        const lastOctet = vm.id % 200 + 50;
        setIp(`${prefix}.${lastOctet}/24`);
        setGateway(defaultGW);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');

        if (!isDHCP) {
            const trimmedIP = ip.trim();
            if (!trimmedIP) {
                setError('Zadejte prosím platnou IP adresu.');
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const resp = await apiFetch('/vms/ip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vmid: vm.id,
                    ip: isDHCP ? '' : ip.trim(),
                    gateway: isDHCP ? '' : gateway.trim(),
                    is_dhcp: isDHCP,
                    node: vm.node || ''
                })
            });

            if (!resp.ok) {
                const errData = await resp.json().catch(() => ({}));
                throw new Error(errData.error || `Chyba při ukládání IP (${resp.status})`);
            }

            setSuccessMsg('IP adresa byla úspěšně aktualizována.');
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 600);
        } catch (err: any) {
            setError(err.message || 'Nastavení IP selhalo');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-content" style={{ maxWidth: '520px' }}>
                <div className="modal-header">
                    <div>
                        <h3 className="modal-title">Konfigurace IP adresy</h3>
                        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                            {vm.name} (VMID: {vm.id})
                        </p>
                    </div>
                    <button type="button" className="close-button" onClick={onClose} disabled={isSubmitting}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
                    {error && (
                        <div style={{
                            padding: '10px 14px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '8px',
                            color: '#ef4444',
                            fontSize: '13px',
                            marginBottom: '16px'
                        }}>
                            {error}
                        </div>
                    )}

                    {successMsg && (
                        <div style={{
                            padding: '10px 14px',
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: '8px',
                            color: '#10b981',
                            fontSize: '13px',
                            marginBottom: '16px'
                        }}>
                            {successMsg}
                        </div>
                    )}

                    <div style={{
                        display: 'flex',
                        gap: '12px',
                        background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        marginBottom: '16px'
                    }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Typ stroje
                            </div>
                            <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px' }}>
                                {isLXC ? 'LXC Kontejner' : 'QEMU Virtuální stroj'}
                            </div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Aktuální runtime IP
                            </div>
                            <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px', color: vm.ip_address ? 'var(--primary-color)' : 'var(--text-muted)' }}>
                                {vm.ip_address || 'Nedetekováno'}
                            </div>
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>Režim přidělování IP:</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <button
                                type="button"
                                onClick={() => setIsDHCP(true)}
                                style={{
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    border: isDHCP ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                                    background: isDHCP ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                                    color: isDHCP ? 'var(--primary-color)' : 'inherit',
                                    fontWeight: isDHCP ? 600 : 400,
                                    cursor: 'pointer',
                                    textAlign: 'center'
                                }}
                            >
                                DHCP (Automatická IP)
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsDHCP(false)}
                                style={{
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    border: !isDHCP ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                                    background: !isDHCP ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                                    color: !isDHCP ? 'var(--primary-color)' : 'inherit',
                                    fontWeight: !isDHCP ? 600 : 400,
                                    cursor: 'pointer',
                                    textAlign: 'center'
                                }}
                            >
                                Statická IP adresa
                            </button>
                        </div>
                    </div>

                    {!isDHCP && (
                        <>
                            <div style={{ marginBottom: '12px' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                                    Rychlé předvolby podsítě:
                                </div>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        style={{ fontSize: '11px', padding: '4px 8px' }}
                                        onClick={() => handleApplyPreset('10.0.10', '10.0.10.1')}
                                    >
                                        Lab411 (10.0.10.x/24)
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        style={{ fontSize: '11px', padding: '4px 8px' }}
                                        onClick={() => handleApplyPreset('192.168.1', '192.168.1.1')}
                                    >
                                        LAN (192.168.1.x/24)
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        style={{ fontSize: '11px', padding: '4px 8px' }}
                                        onClick={() => handleApplyPreset('172.16.0', '172.16.0.1')}
                                    >
                                        VLAN (172.16.0.x/24)
                                    </button>
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: '14px' }}>
                                <label style={{ fontWeight: 600 }}>IP adresa s maskou (CIDR):</label>
                                <input
                                    type="text"
                                    value={ip}
                                    onChange={e => setIp(e.target.value)}
                                    placeholder="např. 10.0.10.150/24"
                                    required={!isDHCP}
                                    disabled={isSubmitting}
                                    style={{ width: '100%' }}
                                />
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    Pokud nezadáte masku, automaticky bude použita /24.
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: '14px' }}>
                                <label style={{ fontWeight: 600 }}>Výchozí brána (Gateway):</label>
                                <input
                                    type="text"
                                    value={gateway}
                                    onChange={e => setGateway(e.target.value)}
                                    placeholder="např. 10.0.10.1"
                                    disabled={isSubmitting}
                                    style={{ width: '100%' }}
                                />
                            </div>
                        </>
                    )}

                    <div style={{
                        padding: '10px 12px',
                        borderRadius: '6px',
                        background: 'rgba(234, 179, 8, 0.08)',
                        border: '1px solid rgba(234, 179, 8, 0.25)',
                        color: 'var(--text-muted)',
                        fontSize: '12px',
                        lineHeight: 1.4,
                        marginBottom: '16px'
                    }}>
                        Pro plné uplatnění statické konfigurace v běžícím operačním systému může být vyžadován restart stroje.
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
                            Zrušit
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? 'Ukládání...' : 'Uložit IP adresu'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
