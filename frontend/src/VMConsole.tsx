import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import RFB from '@novnc/novnc';
import { GetBackendURL } from '../wailsjs/go/main/App';
import '@xterm/xterm/css/xterm.css';

interface VMConsoleProps {
    vmId?: string | number;
    vmName: string;
    vmNode?: string;
    token?: string;
    onClose: () => void;
    onPopOut?: () => void;
}

async function resolveWebSocketUrl(vmId: string | number, tokenOverride: string | undefined, endpoint: 'vnc' | 'ws', vmNode?: string): Promise<string> {
    const token = tokenOverride || localStorage.getItem('vm_manager_token') || '';
    let backendUrl = 'http://10.0.10.52:8080';
    if (typeof window !== 'undefined' && (window as any).go?.main?.App?.GetBackendURL) {
        try {
            const configured = await GetBackendURL();
            if (configured) {
                backendUrl = configured;
            }
        } catch {}
    }

    const wsProto = backendUrl.startsWith('https') ? 'wss:' : 'ws:';
    const host = backendUrl.replace(/^https?:\/\//, '');
    let url = `${wsProto}//${host}/vms/console/${endpoint}?vmid=${encodeURIComponent(String(vmId))}&token=${encodeURIComponent(token)}`;
    if (vmNode) {
        url += `&node=${encodeURIComponent(vmNode)}`;
    }
    return url;
}

export function VMConsole({ vmId, vmName, vmNode, token, onClose, onPopOut }: VMConsoleProps) {
    const [consoleMode, setConsoleMode] = useState<'vnc' | 'serial'>('vnc');
    const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
    const [statusMessage, setStatusMessage] = useState<string>('Inicializace konzole...');
    const [connectAttempt, setConnectAttempt] = useState(0);
    const [performanceMode, setPerformanceMode] = useState<'low-latency' | 'balanced' | 'bandwidth'>('low-latency');
    const [scaleMode, setScaleMode] = useState<'fit' | '1:1'>('fit');
    const [showDotCursor, setShowDotCursor] = useState(true);

    const rfbRef = useRef<any>(null);
    const vncContainerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (consoleMode !== 'vnc' || !vncContainerRef.current) return;

        let rfb: any = null;
        let isDisposed = false;

        const connectVNC = async () => {
            if (!vmId) {
                setStatus('error');
                setStatusMessage('Chybí ID virtuálního stroje');
                return;
            }

            try {
                setStatus('connecting');
                setStatusMessage('Připojování k obrazovce VM (VNC)...');

                const vncUrl = await resolveWebSocketUrl(vmId, token, 'vnc', vmNode);
                if (isDisposed) return;

                if (!vncContainerRef.current) return;
                vncContainerRef.current.innerHTML = '';

                rfb = new RFB(vncContainerRef.current, vncUrl, {
                    wsProtocols: ['binary'],
                });
                rfbRef.current = rfb;

                rfb.scaleViewport = scaleMode === 'fit';
                rfb.resizeSession = false;
                rfb.clipViewport = false;
                rfb.showDotCursor = showDotCursor;

                if (performanceMode === 'low-latency') {
                    rfb.compressionLevel = 0;
                    rfb.qualityLevel = 8;
                } else if (performanceMode === 'balanced') {
                    rfb.compressionLevel = 2;
                    rfb.qualityLevel = 6;
                } else {
                    rfb.compressionLevel = 6;
                    rfb.qualityLevel = 4;
                }

                rfb.addEventListener('connect', () => {
                    if (isDisposed) return;
                    setStatus('connected');
                    setStatusMessage(`Připojeno k obrazovce ${vmName}`);
                    if (rfb.focus) rfb.focus();
                });

                rfb.addEventListener('disconnect', (e: any) => {
                    if (isDisposed) return;
                    setStatus('disconnected');
                    const reason = e?.detail?.clean ? '' : (e?.detail?.reason ? ` (${e.detail.reason})` : '');
                    setStatusMessage(`Obrazovka odpojena${reason}`);
                });

                rfb.addEventListener('securityfailure', (e: any) => {
                    if (isDisposed) return;
                    setStatus('error');
                    setStatusMessage(`Autentizace selhala: ${e?.detail?.reason || 'chyba ověření'}`);
                });

                rfb.addEventListener('credentialsrequired', () => {
                    if (rfb && rfb.sendCredentials) {
                        rfb.sendCredentials({ password: '' });
                    }
                });
            } catch (err: any) {
                if (isDisposed) return;
                setStatus('error');
                setStatusMessage(`Připojení selhalo: ${err?.message || err}`);
            }
        };

        connectVNC();

        return () => {
            isDisposed = true;
            if (rfbRef.current) {
                try {
                    rfbRef.current.disconnect();
                } catch {}
                rfbRef.current = null;
            }
            if (vncContainerRef.current) {
                vncContainerRef.current.innerHTML = '';
            }
        };
    }, [consoleMode, vmId, vmName, vmNode, token, connectAttempt]);

    const handlePerformanceModeChange = (mode: 'low-latency' | 'balanced' | 'bandwidth') => {
        setPerformanceMode(mode);
        if (rfbRef.current) {
            if (mode === 'low-latency') {
                rfbRef.current.compressionLevel = 0;
                rfbRef.current.qualityLevel = 8;
            } else if (mode === 'balanced') {
                rfbRef.current.compressionLevel = 2;
                rfbRef.current.qualityLevel = 6;
            } else {
                rfbRef.current.compressionLevel = 6;
                rfbRef.current.qualityLevel = 4;
            }
        }
    };

    const handleScaleModeChange = (mode: 'fit' | '1:1') => {
        setScaleMode(mode);
        if (rfbRef.current) {
            rfbRef.current.scaleViewport = mode === 'fit';
        }
    };

    const handleToggleDotCursor = () => {
        setShowDotCursor(prev => {
            const next = !prev;
            if (rfbRef.current) {
                rfbRef.current.showDotCursor = next;
            }
            return next;
        });
    };

    const sendCtrlAltDel = () => {
        if (rfbRef.current) {
            rfbRef.current.sendCtrlAltDel();
            rfbRef.current.focus?.();
        }
    };

    const sendKey = (keysym: number, code: string) => {
        if (rfbRef.current) {
            rfbRef.current.sendKey(keysym, code);
            rfbRef.current.focus?.();
        }
    };

    useEffect(() => {
        if (consoleMode !== 'serial' || !terminalRef.current) return;

        let ws: WebSocket | null = null;
        let isDisposed = false;

        const term = new Terminal({
            theme: {
                background: '#0a0f1d',
                foreground: '#f1f5f9',
                cursor: '#38bdf8',
                selectionBackground: '#334155',
            },
            cursorBlink: true,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            fontSize: 13,
            lineHeight: 1.25,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        term.open(terminalRef.current);
        fitAddon.fit();

        term.writeln(`\x1b[36mInicializace sériového terminálu pro ${vmName} (VMID: ${vmId})...\x1b[0m\r\n`);

        const connectSerial = async () => {
            if (!vmId) {
                term.writeln(`\x1b[31mChyba: Chybí ID virtuálního stroje\x1b[0m\r\n`);
                setStatus('error');
                setStatusMessage('Chybí ID virtuálního stroje');
                return;
            }

            try {
                setStatus('connecting');
                setStatusMessage('Připojování k sériové konzoli...');
                const wsUrl = await resolveWebSocketUrl(vmId, token, 'ws', vmNode);
                ws = new WebSocket(wsUrl);
                ws.binaryType = 'arraybuffer';

                ws.onopen = () => {
                    if (isDisposed) return;
                    setStatus('connected');
                    setStatusMessage('Připojeno k sériovému terminálu');
                    term.writeln(`\x1b[32mPřipojeno k sériovému terminálu pro ${vmName}\x1b[0m\r\n`);
                };

                ws.onmessage = (event) => {
                    if (isDisposed) return;
                    if (event.data instanceof ArrayBuffer) {
                        term.write(new Uint8Array(event.data));
                    } else if (typeof event.data === 'string') {
                        term.write(event.data);
                    }
                };

                ws.onerror = () => {
                    if (isDisposed) return;
                    setStatus('error');
                    setStatusMessage('Chyba sériového spojení');
                    term.writeln(`\r\n\x1b[31m[Chyba WebSocket spojení]\x1b[0m\r\n`);
                };

                ws.onclose = (event) => {
                    if (isDisposed) return;
                    setStatus('disconnected');
                    const reason = event.reason ? `: ${event.reason}` : '';
                    setStatusMessage(`Sériová linka odpojena${reason}`);
                    term.writeln(`\r\n\x1b[33m[Konzole odpojena${reason}]\x1b[0m\r\n`);
                };

                term.onData((data) => {
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(data);
                    }
                });
            } catch (err: any) {
                if (isDisposed) return;
                setStatus('error');
                setStatusMessage(`Chyba připojení: ${err?.message || err}`);
                term.writeln(`\r\n\x1b[31m[Chyba připojení: ${err}]\x1b[0m\r\n`);
            }
        };

        connectSerial();

        const handleResize = () => {
            try {
                fitAddon.fit();
            } catch {}
        };
        window.addEventListener('resize', handleResize);

        return () => {
            isDisposed = true;
            window.removeEventListener('resize', handleResize);
            if (ws) {
                try {
                    ws.close();
                } catch {}
            }
            term.dispose();
        };
    }, [consoleMode, vmId, vmName, vmNode, token, connectAttempt]);

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#0a0f1d',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column'
        }}>
            <div style={{
                backgroundColor: 'var(--card-bg)',
                color: 'var(--text-main)',
                padding: '8px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid var(--border-color)',
                userSelect: 'none'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', letterSpacing: '-0.01em' }}>
                        {vmName} <span className="mono-tag" style={{ marginLeft: '6px' }}>{vmId ? `VMID: ${vmId}` : 'Konzole'}</span>
                    </div>

                    <div style={{
                        display: 'flex',
                        backgroundColor: 'var(--card-bg-subtle)',
                        borderRadius: '6px',
                        padding: '2px',
                        border: '1px solid var(--border-color)'
                    }}>
                        <button
                            type="button"
                            onClick={() => setConsoleMode('vnc')}
                            className={`btn btn-sm ${consoleMode === 'vnc' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ border: 'none' }}
                            title="Grafická obrazovka (vhodné pro EVE-NG, Windows a další systémy)"
                        >
                            Obrazovka (VNC)
                        </button>
                        <button
                            type="button"
                            onClick={() => setConsoleMode('serial')}
                            className={`btn btn-sm ${consoleMode === 'serial' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ border: 'none' }}
                            title="Textový sériový terminál (pro Linux getty)"
                        >
                            Sériový terminál
                        </button>
                    </div>

                    <div className="status-badge" style={{
                        backgroundColor: 'var(--card-bg-subtle)',
                        border: '1px solid var(--border-color)'
                    }}>
                        <span className="status-badge-dot" style={{
                            backgroundColor:
                                status === 'connected' ? 'var(--success-text)' :
                                status === 'connecting' ? 'var(--warning-text)' :
                                'var(--danger-text)'
                        }} />
                        <span style={{ textTransform: 'capitalize' }}>
                            {status === 'connected' ? 'Připojeno' : status === 'connecting' ? 'Připojování...' : status === 'disconnected' ? 'Odpojeno' : 'Chyba'}
                        </span>
                    </div>

                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {statusMessage}
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        type="button"
                        onClick={() => setConnectAttempt(prev => prev + 1)}
                        className="btn btn-secondary btn-sm"
                        title="Znovu připojit ke konzoli"
                    >
                        Znovu připojit
                    </button>

                    {onPopOut && (
                        <button
                            type="button"
                            onClick={onPopOut}
                            className="btn btn-primary btn-sm"
                            title="Otevřít v samostatném okně"
                        >
                            Samostatné okno
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={onClose}
                        className="btn btn-danger btn-sm"
                        title="Zavřít konzoli"
                    >
                        Zavřít (&times;)
                    </button>
                </div>
            </div>

            {consoleMode === 'vnc' && (
                <div style={{
                    backgroundColor: 'var(--card-bg-subtle)',
                    borderBottom: '1px solid var(--border-color)',
                    padding: '5px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                    userSelect: 'none',
                    fontSize: '11px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>REŽIM VÝKONU:</span>
                        <div style={{
                            display: 'inline-flex',
                            backgroundColor: 'var(--card-bg)',
                            borderRadius: '5px',
                            border: '1px solid var(--border-color)',
                            padding: '2px',
                            gap: '2px'
                        }}>
                            <button
                                type="button"
                                onClick={() => handlePerformanceModeChange('low-latency')}
                                className={`btn btn-sm ${performanceMode === 'low-latency' ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ fontSize: '11px', padding: '2px 8px', border: 'none' }}
                                title="Nízká latence a minimální komprese pro plynulý obraz na rychlé síti"
                            >
                                Nízká latence
                            </button>
                            <button
                                type="button"
                                onClick={() => handlePerformanceModeChange('balanced')}
                                className={`btn btn-sm ${performanceMode === 'balanced' ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ fontSize: '11px', padding: '2px 8px', border: 'none' }}
                                title="Vyvážený poměr odezvy a spotřeby přenosu"
                            >
                                Vyvážený
                            </button>
                            <button
                                type="button"
                                onClick={() => handlePerformanceModeChange('bandwidth')}
                                className={`btn btn-sm ${performanceMode === 'bandwidth' ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ fontSize: '11px', padding: '2px 8px', border: 'none' }}
                                title="Vysoká komprese šetřící přenosová data"
                            >
                                Úsporný
                            </button>
                        </div>

                        <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-color)', margin: '0 4px' }} />

                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>MĚŘÍTKO:</span>
                        <div style={{
                            display: 'inline-flex',
                            backgroundColor: 'var(--card-bg)',
                            borderRadius: '5px',
                            border: '1px solid var(--border-color)',
                            padding: '2px',
                            gap: '2px'
                        }}>
                            <button
                                type="button"
                                onClick={() => handleScaleModeChange('fit')}
                                className={`btn btn-sm ${scaleMode === 'fit' ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ fontSize: '11px', padding: '2px 8px', border: 'none' }}
                                title="Přizpůsobit okno velikosti obrazovky"
                            >
                                Přizpůsobit
                            </button>
                            <button
                                type="button"
                                onClick={() => handleScaleModeChange('1:1')}
                                className={`btn btn-sm ${scaleMode === '1:1' ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ fontSize: '11px', padding: '2px 8px', border: 'none' }}
                                title="Původní 1:1 rozlišení bez softwarového škálování"
                            >
                                1:1
                            </button>
                        </div>

                        <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-color)', margin: '0 4px' }} />

                        <button
                            type="button"
                            onClick={handleToggleDotCursor}
                            className={`btn btn-sm ${showDotCursor ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ fontSize: '11px', padding: '2px 10px' }}
                            title="Zapnout nebo vypnout okamžitý lokální bod kurzoru myši"
                        >
                            {showDotCursor ? 'Lokální kurzor: Zapnuto' : 'Lokální kurzor: Vypnuto'}
                        </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>KLÁVESY:</span>
                        <button
                            type="button"
                            onClick={sendCtrlAltDel}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '11px', padding: '2px 8px' }}
                            title="Odeslat Ctrl+Alt+Del do virtuálního stroje"
                        >
                            Ctrl+Alt+Del
                        </button>
                        <button
                            type="button"
                            onClick={() => sendKey(0xFF1B, 'Escape')}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '11px', padding: '2px 8px' }}
                            title="Odeslat klávesu Escape"
                        >
                            Esc
                        </button>
                        <button
                            type="button"
                            onClick={() => sendKey(0xFF09, 'Tab')}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '11px', padding: '2px 8px' }}
                            title="Odeslat klávesu Tab"
                        >
                            Tab
                        </button>
                        <button
                            type="button"
                            onClick={() => sendKey(0xFFEB, 'MetaLeft')}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '11px', padding: '2px 8px' }}
                            title="Odeslat klávesu Windows / Super"
                        >
                            Win
                        </button>
                    </div>
                </div>
            )}

            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#000000' }}>
                <style>{`
                    .vnc-screen-viewport canvas {
                        image-rendering: -webkit-optimize-contrast;
                        image-rendering: crisp-edges;
                        transform: translateZ(0);
                        backface-visibility: hidden;
                        will-change: transform;
                    }
                `}</style>
                <div
                    ref={vncContainerRef}
                    className="vnc-screen-viewport"
                    tabIndex={0}
                    onClick={() => {
                        if (rfbRef.current && rfbRef.current.focus) {
                            rfbRef.current.focus();
                        }
                    }}
                    style={{
                        display: consoleMode === 'vnc' ? 'flex' : 'none',
                        width: '100%',
                        height: '100%',
                        alignItems: 'center',
                        justifyContent: 'center',
                        outline: 'none',
                        overflow: scaleMode === '1:1' ? 'auto' : 'hidden'
                    }}
                />

                <div
                    ref={terminalRef}
                    style={{
                        display: consoleMode === 'serial' ? 'block' : 'none',
                        width: '100%',
                        height: '100%',
                        padding: '8px',
                        boxSizing: 'border-box'
                    }}
                />
            </div>
        </div>
    );
}
