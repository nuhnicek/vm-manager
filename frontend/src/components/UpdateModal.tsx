import { useState, useEffect } from 'react';
import { DownloadAndApplyUpdate, RestartApp } from '../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime';
import { main } from '../../wailsjs/go/models';

interface UpdateProgressData {
    downloaded_bytes: number;
    total_bytes: number;
    percentage: number;
    status: 'downloading' | 'applying' | 'ready_to_restart' | 'error';
    error?: string;
}

interface UpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    updateInfo: main.UpdateInfo | null;
}

export function UpdateModal({ isOpen, onClose, updateInfo }: UpdateModalProps) {
    const [status, setStatus] = useState<'idle' | 'downloading' | 'applying' | 'ready_to_restart' | 'error'>('idle');
    const [progress, setProgress] = useState<number>(0);
    const [downloadedMB, setDownloadedMB] = useState<string>('0');
    const [totalMB, setTotalMB] = useState<string>('0');
    const [errorMessage, setErrorMessage] = useState<string>('');

    useEffect(() => {
        if (!isOpen) {
            setStatus('idle');
            setProgress(0);
            setErrorMessage('');
            return;
        }

        const unregister = EventsOn('update-progress', (data: UpdateProgressData) => {
            if (!data) return;
            if (data.status) {
                setStatus(data.status);
            }
            if (typeof data.percentage === 'number') {
                setProgress(Math.min(100, Math.max(0, data.percentage)));
            }
            if (data.downloaded_bytes) {
                setDownloadedMB((data.downloaded_bytes / (1024 * 1024)).toFixed(1));
            }
            if (data.total_bytes && data.total_bytes > 0) {
                setTotalMB((data.total_bytes / (1024 * 1024)).toFixed(1));
            }
            if (data.error) {
                setErrorMessage(data.error);
                setStatus('error');
            }
        });

        return () => {
            if (unregister) unregister();
            EventsOff('update-progress');
        };
    }, [isOpen]);

    if (!isOpen || !updateInfo) return null;

    const handleStartUpdate = async () => {
        if (!updateInfo.download_url) {
            setErrorMessage('Pro tento operační systém nebyl v GitHub vydání nalezen kompatibilní instalační balíček.');
            setStatus('error');
            return;
        }

        setStatus('downloading');
        setProgress(0);
        setErrorMessage('');

        try {
            await DownloadAndApplyUpdate(updateInfo.download_url);
        } catch (err: any) {
            setErrorMessage(err?.message || 'Nastala chyba při stahování nebo instalaci aktualizace.');
            setStatus('error');
        }
    };

    const handleRestart = async () => {
        try {
            await RestartApp();
        } catch (err: any) {
            setErrorMessage('Restart aplikace selhal: ' + (err?.message || err));
        }
    };

    const formatSize = (bytes: number) => {
        if (!bytes || bytes <= 0) return '';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <div className="modal-overlay" onClick={status === 'downloading' || status === 'applying' ? undefined : onClose}>
            <div className="modal-content" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '8px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                    </div>
                    <div>
                        <h4 style={{ margin: 0, fontSize: '18px' }}>Dostupná nová aktualizace</h4>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Nalezena novější verze na GitHubu
                        </span>
                    </div>
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: 'var(--card-bg-subtle, rgba(255,255,255,0.04))',
                    border: '1px solid var(--border-color)',
                    marginBottom: '16px'
                }}>
                    <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                            Aktuální verze
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>
                            {updateInfo.current_version || 'v1.0.0'}
                        </div>
                    </div>

                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>

                    <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                            Nová verze
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: '#10b981' }}>
                            {updateInfo.latest_version}
                        </div>
                    </div>

                    {updateInfo.asset_size > 0 && (
                        <div>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                                Velikost
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                {formatSize(updateInfo.asset_size)}
                            </div>
                        </div>
                    )}
                </div>

                {updateInfo.release_name && (
                    <div style={{ marginBottom: '10px', fontWeight: 600, fontSize: '14px' }}>
                        {updateInfo.release_name}
                    </div>
                )}

                {updateInfo.release_notes && (
                    <div style={{
                        maxHeight: '140px',
                        overflowY: 'auto',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid var(--border-color)',
                        fontSize: '12px',
                        lineHeight: '1.5',
                        whiteSpace: 'pre-wrap',
                        color: 'var(--text-secondary)',
                        marginBottom: '16px'
                    }}>
                        {updateInfo.release_notes}
                    </div>
                )}

                {status === 'downloading' && (
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                            <span>Stahování aktualizace...</span>
                            <span>{progress.toFixed(0)}% ({downloadedMB} / {totalMB} MB)</span>
                        </div>
                        <div style={{
                            width: '100%',
                            height: '8px',
                            borderRadius: '4px',
                            background: 'var(--border-color)',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                width: `${progress}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                                transition: 'width 0.2s ease'
                            }} />
                        </div>
                    </div>
                )}

                {status === 'applying' && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px',
                        borderRadius: '6px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        color: '#60a5fa',
                        fontSize: '13px',
                        marginBottom: '16px'
                    }}>
                        <svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="2" x2="12" y2="6"></line>
                            <line x1="12" y1="18" x2="12" y2="22"></line>
                            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                            <line x1="2" y1="12" x2="6" y2="12"></line>
                            <line x1="18" y1="12" x2="22" y2="12"></line>
                            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                        </svg>
                        Instalace aktualizace a příprava aplikace...
                    </div>
                )}

                {status === 'ready_to_restart' && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px',
                        borderRadius: '6px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        color: '#10b981',
                        fontSize: '13px',
                        marginBottom: '16px'
                    }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        <span>Aktualizace byla úspěšně nainstalována! Restartujte aplikaci pro dokončení.</span>
                    </div>
                )}

                {errorMessage && (
                    <div style={{
                        padding: '10px 12px',
                        borderRadius: '6px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#f87171',
                        fontSize: '13px',
                        marginBottom: '16px'
                    }}>
                        {errorMessage}
                    </div>
                )}

                <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    {status === 'ready_to_restart' ? (
                        <button
                            className="btn btn-primary"
                            onClick={handleRestart}
                            style={{ background: '#10b981', borderColor: '#10b981' }}
                        >
                            Restartovat aplikaci nyní
                        </button>
                    ) : (
                        <>
                            <button
                                className="btn btn-secondary"
                                onClick={onClose}
                                disabled={status === 'downloading' || status === 'applying'}
                            >
                                Později
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleStartUpdate}
                                disabled={status === 'downloading' || status === 'applying'}
                                style={{ background: '#10b981', borderColor: '#10b981' }}
                            >
                                {status === 'downloading' ? 'Stahování...' : status === 'applying' ? 'Instalace...' : 'Aktualizovat nyní'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
