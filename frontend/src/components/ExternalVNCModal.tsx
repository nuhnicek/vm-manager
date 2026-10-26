import { useState, useEffect } from 'react';
import { apiFetch } from '../api';

interface ExternalVNCModalProps {
    isOpen: boolean;
    vmId: string | number;
    vmName: string;
    vmNode?: string;
    onClose: () => void;
}

export function ExternalVNCModal({ isOpen, vmId, vmName, vmNode, onClose }: ExternalVNCModalProps) {
    const [info, setInfo] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copiedCommand, setCopiedCommand] = useState(false);
    const [downloaded, setDownloaded] = useState(false);

    useEffect(() => {
        if (!isOpen || !vmId) return;
        let isCancelled = false;
        setLoading(true);
        setError(null);

        const fetchExternalVNC = async () => {
            try {
                const resp = await apiFetch('/vms/console/external', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ vmid: Number(vmId), node: vmNode })
                });
                if (isCancelled) return;
                if (resp.ok) {
                    const data = await resp.json();
                    setInfo(data);
                } else {
                    const err = await resp.json().catch(() => ({}));
                    setError(err.error || 'Nepodařilo se spustit externí VNC server.');
                }
            } catch {
                if (!isCancelled) {
                    setError('Chyba připojení k backend serveru.');
                }
            } finally {
                if (!isCancelled) {
                    setLoading(false);
                }
            }
        };

        fetchExternalVNC();

        return () => {
            isCancelled = true;
        };
    }, [isOpen, vmId, vmNode]);

    const handleDownloadFile = async () => {
        try {
            const resp = await apiFetch(`/vms/console/external/file?vmid=${vmId}`);
            if (resp.ok) {
                const blob = await resp.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `vm-${vmId}.vnc`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                setDownloaded(true);
                setTimeout(() => setDownloaded(false), 2000);
            }
        } catch {
            setError('Chyba při stahování souboru .vnc');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-backdrop" style={{ zIndex: 100000 }}>
            <div className="modal-content" style={{ maxWidth: '580px', width: '92%' }}>
                <div className="modal-header">
                    <div>
                        <h3 className="modal-title">Externí VNC klient pro {vmName}</h3>
                        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                            Připojení nativním programem (TigerVNC, RealVNC, Remmina) pro maximální FPS a nulovou latenci
                        </p>
                    </div>
                    <button
                        type="button"
                        className="close-button"
                        onClick={onClose}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <div style={{ padding: '20px 24px' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                            Inicializace VNC TCP proxy portu...
                        </div>
                    ) : info ? (
                        <div>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                                gap: '10px',
                                marginBottom: '16px'
                            }}>
                                <div style={{ background: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>HOSTITEL (IP)</div>
                                    <div style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'monospace', marginTop: '2px' }}>{info.host}</div>
                                </div>
                                <div style={{ background: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>TCP PORT</div>
                                    <div style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'monospace', marginTop: '2px', color: '#38bdf8' }}>{info.port}</div>
                                </div>
                                <div style={{ background: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>DISPLEJ</div>
                                    <div style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'monospace', marginTop: '2px' }}>:{info.display}</div>
                                </div>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                        Příkaz pro spuštění v terminálu
                                    </span>
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        style={{ fontSize: '11px', padding: '2px 8px' }}
                                        onClick={() => {
                                            navigator.clipboard.writeText(info.command);
                                            setCopiedCommand(true);
                                            setTimeout(() => setCopiedCommand(false), 2000);
                                        }}
                                    >
                                        {copiedCommand ? 'Zkopírováno!' : 'Kopírovat'}
                                    </button>
                                </div>
                                <pre style={{
                                    margin: 0,
                                    padding: '10px 12px',
                                    background: 'rgba(0,0,0,0.5)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '6px',
                                    fontFamily: 'monospace',
                                    fontSize: '12px',
                                    color: '#38bdf8'
                                }}>
                                    {info.command}
                                </pre>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    style={{ flex: 1, minWidth: '180px', fontSize: '13px' }}
                                    onClick={handleDownloadFile}
                                >
                                    {downloaded ? 'Profil stažen' : 'Stáhnout .vnc profil'}
                                </button>
                                <a
                                    href={info.vnc_url}
                                    className="btn btn-secondary"
                                    style={{ flex: 1, minWidth: '180px', fontSize: '13px', textAlign: 'center', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    Otevřít v systémovém VNC
                                </a>
                            </div>

                            <div style={{
                                background: 'rgba(16, 185, 129, 0.08)',
                                border: '1px solid rgba(16, 185, 129, 0.25)',
                                borderRadius: '8px',
                                padding: '10px 14px',
                                fontSize: '12px',
                                color: 'var(--text-muted)',
                                lineHeight: 1.45
                            }}>
                                <span style={{ fontWeight: 600, color: '#10b981' }}>Autentizace: </span>
                                Server nevyžaduje heslo (přístup je zabezpečen na úrovni relace a firewallu). Připojit se lze z libovolného VNC klienta v síti.
                            </div>
                        </div>
                    ) : (
                        <div style={{ color: 'var(--danger-text)' }}>{error || 'Nepodařilo se načíst parametry externího VNC.'}</div>
                    )}

                    <div className="modal-actions" style={{ marginTop: '20px' }}>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={onClose}
                        >
                            Zavřít
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
