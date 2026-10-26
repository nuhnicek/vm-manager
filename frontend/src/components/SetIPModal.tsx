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
    const nics = (vm?.available_nics && vm.available_nics.length > 0) ? vm.available_nics : ['net0'];
    const [selectedNic, setSelectedNic] = useState<string>('net0');
    const [isDHCP, setIsDHCP] = useState(true);
    const [ip, setIp] = useState('');
    const [gateway, setGateway] = useState('10.0.10.1');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const getNicDetails = (nicName: string) => {
        if (!vm) return { isUntagged: false, tag: null, currentIP: '', isDHCP: false, gateway: '', raw: '' };
        const desc = (vm.networks || []).find(n => n.startsWith(nicName + ':'));
        if (!desc) return { isUntagged: false, tag: null, currentIP: '', isDHCP: false, gateway: '', raw: '' };
        const raw = desc.replace(nicName + ':', '').trim();
        const tagMatch = raw.match(/tag=(\d+)/);
        const tag = tagMatch ? tagMatch[1] : null;
        const isUntagged = !tag;
        const ipMatch = raw.match(/ip=([^,]+)/);
        const ipVal = ipMatch ? ipMatch[1] : '';
        const isDHCPVal = ipVal.toLowerCase() === 'dhcp';
        const gwMatch = raw.match(/gw=([^,]+)/);
        const gwVal = gwMatch ? gwMatch[1] : '';
        return { isUntagged, tag, currentIP: ipVal, isDHCP: isDHCPVal, gateway: gwVal, raw };
    };

    const loadNicConfig = (nicName: string) => {
        if (!vm) return;
        const details = getNicDetails(nicName);
        if (details.isDHCP) {
            setIsDHCP(true);
            setIp('');
            setGateway(details.gateway || '10.0.10.1');
        } else if (details.currentIP && details.currentIP !== 'none') {
            setIsDHCP(false);
            setIp(details.currentIP);
            setGateway(details.gateway || '10.0.10.1');
        } else if (nicName === 'net0' && vm.configured_ip) {
            if (vm.configured_ip.toLowerCase() === 'dhcp') {
                setIsDHCP(true);
                setIp('');
                setGateway(vm.gateway || '10.0.10.1');
            } else {
                setIsDHCP(false);
                setIp(vm.configured_ip);
                setGateway(vm.gateway || '10.0.10.1');
            }
        } else if (details.tag) {
            setIsDHCP(false);
            const lastOctet = (vm.id % 200) + 50;
            setIp(`10.0.1.${lastOctet}/24`);
            setGateway('');
        } else {
            setIsDHCP(true);
            setIp('');
            setGateway('10.0.10.1');
        }
    };

    useEffect(() => {
        if (isOpen && vm) {
            setError('');
            setSuccessMsg('');
            const initialNic = (vm.available_nics && vm.available_nics.length > 0) ? vm.available_nics[0] : 'net0';
            setSelectedNic(initialNic);
            loadNicConfig(initialNic);
        }
    }, [isOpen, vm]);

    if (!isOpen || !vm) return null;

    const isLXC = vm.type === 'lxc';

    const handleApplyPreset = (prefix: string, defaultGW: string) => {
        setIsDHCP(false);
        const lastOctet = (vm.id % 200) + 50;
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
                    nic: selectedNic,
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

            setSuccessMsg(`IP adresa na rozhraní ${selectedNic} byla úspěšně uložena.`);
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 500);
        } catch (err: any) {
            setError(err.message || 'Nastavení IP selhalo');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-content" style={{ maxWidth: '560px' }}>
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
                                Runtime detekovaná IP
                            </div>
                            <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px', color: vm.ip_address ? 'var(--primary-color)' : 'var(--text-muted)' }}>
                                {vm.ip_address || 'Nedetekováno'}
                            </div>
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>Vyberte síťové rozhraní:</label>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {nics.map(nicName => {
                                const details = getNicDetails(nicName);
                                const isSelected = selectedNic === nicName;
                                return (
                                    <button
                                        key={nicName}
                                        type="button"
                                        onClick={() => {
                                            setSelectedNic(nicName);
                                            loadNicConfig(nicName);
                                        }}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: '8px',
                                            border: isSelected ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                                            background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-secondary)',
                                            color: isSelected ? 'var(--primary-color)' : 'inherit',
                                            fontWeight: isSelected ? 600 : 400,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            fontSize: '13px',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        <code style={{ fontWeight: 700 }}>{nicName}</code>
                                        {details.isUntagged ? (
                                            <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '1px 5px', borderRadius: '4px' }}>
                                                Lab / Internet
                                            </span>
                                        ) : details.tag ? (
                                            <span style={{ fontSize: '11px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', padding: '1px 5px', borderRadius: '4px' }}>
                                                VLAN {details.tag}
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>vmbr0</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        {selectedNic && (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                                Konfigurujete: <strong style={{ color: 'var(--text-main)' }}>{selectedNic}</strong>
                                {getNicDetails(selectedNic).raw ? ` [${getNicDetails(selectedNic).raw}]` : ''}
                            </div>
                        )}
                    </div>

                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>Režim přidělování pro {selectedNic}:</label>
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
                                    textAlign: 'center',
                                    transition: 'all 0.15s ease'
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
                                    textAlign: 'center',
                                    transition: 'all 0.15s ease'
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
                                        onClick={() => handleApplyPreset('10.0.1', '')}
                                    >
                                        VLAN (10.0.1.x/24)
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
                                    placeholder="např. 10.0.10.1 (nebo prázdné pro izolovanou síť)"
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
                        Konfigurace bude zapsána pro rozhraní {selectedNic}. Pro plné uplatnění statické konfigurace v operačním systému může být vyžadován restart síťové služby nebo stroje.
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
                            Zrušit
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? 'Ukládání...' : `Uložit IP pro ${selectedNic}`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
