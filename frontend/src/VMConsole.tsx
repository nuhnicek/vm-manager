import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import RFB from '@novnc/novnc';
import { GetBackendURL } from '../wailsjs/go/main/App';
import '@xterm/xterm/css/xterm.css';

interface VMConsoleProps {
    vmId?: string | number;
    vmName: string;
    token?: string;
    onClose: () => void;
    onPopOut?: () => void;
}

async function resolveWebSocketUrl(vmId: string | number, tokenOverride: string | undefined, endpoint: 'vnc' | 'ws'): Promise<string> {
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
    return `${wsProto}//${host}/vms/console/${endpoint}?vmid=${encodeURIComponent(String(vmId))}&token=${encodeURIComponent(token)}`;
}

export function VMConsole({ vmId, vmName, token, onClose, onPopOut }: VMConsoleProps) {
    const [consoleMode, setConsoleMode] = useState<'vnc' | 'serial'>('vnc');
    const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
    const [statusMessage, setStatusMessage] = useState<string>('Inicializace konzole...');
    const [connectAttempt, setConnectAttempt] = useState(0);

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

                const vncUrl = await resolveWebSocketUrl(vmId, token, 'vnc');
                if (isDisposed) return;

                if (!vncContainerRef.current) return;
                vncContainerRef.current.innerHTML = '';

                rfb = new RFB(vncContainerRef.current, vncUrl, {
                    wsProtocols: ['binary'],
                });

                rfb.scaleViewport = true;
                rfb.resizeSession = false;
                rfb.clipViewport = true;

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
            if (rfb) {
                try {
                    rfb.disconnect();
                } catch {}
            }
            if (vncContainerRef.current) {
                vncContainerRef.current.innerHTML = '';
            }
        };
    }, [consoleMode, vmId, vmName, token, connectAttempt]);

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
                const wsUrl = await resolveWebSocketUrl(vmId, token, 'ws');
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
    }, [consoleMode, vmId, vmName, token, connectAttempt]);

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
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                padding: '8px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #334155',
                userSelect: 'none'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', letterSpacing: '0.02em' }}>
                        {vmName} <span style={{ opacity: 0.6, fontSize: '12px' }}>({vmId ? `VMID: ${vmId}` : 'Konzole'})</span>
                    </div>

                    <div style={{
                        display: 'flex',
                        backgroundColor: '#0f172a',
                        borderRadius: '6px',
                        padding: '2px',
                        border: '1px solid #334155'
                    }}>
                        <button
                            type="button"
                            onClick={() => setConsoleMode('vnc')}
                            style={{
                                padding: '4px 10px',
                                fontSize: '12px',
                                fontWeight: 600,
                                borderRadius: '4px',
                                border: 'none',
                                cursor: 'pointer',
                                backgroundColor: consoleMode === 'vnc' ? '#2563eb' : 'transparent',
                                color: consoleMode === 'vnc' ? '#ffffff' : '#94a3b8',
                                transition: 'all 0.15s ease'
                            }}
                            title="Grafická obrazovka (vhodné pro EVE-NG, Windows a další systémy)"
                        >
                            Obrazovka (VNC)
                        </button>
                        <button
                            type="button"
                            onClick={() => setConsoleMode('serial')}
                            style={{
                                padding: '4px 10px',
                                fontSize: '12px',
                                fontWeight: 600,
                                borderRadius: '4px',
                                border: 'none',
                                cursor: 'pointer',
                                backgroundColor: consoleMode === 'serial' ? '#2563eb' : 'transparent',
                                color: consoleMode === 'serial' ? '#ffffff' : '#94a3b8',
                                transition: 'all 0.15s ease'
                            }}
                            title="Textový sériový terminál (pro Linux getty)"
                        >
                            Sériový terminál
                        </button>
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11px',
                        backgroundColor: '#0f172a',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        border: '1px solid #334155'
                    }}>
                        <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor:
                                status === 'connected' ? '#22c55e' :
                                status === 'connecting' ? '#eab308' :
                                '#ef4444'
                        }} />
                        <span style={{ textTransform: 'capitalize' }}>
                            {status === 'connected' ? 'Připojeno' : status === 'connecting' ? 'Připojování...' : status === 'disconnected' ? 'Odpojeno' : 'Chyba'}
                        </span>
                    </div>

                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                        {statusMessage}
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        type="button"
                        onClick={() => setConnectAttempt(prev => prev + 1)}
                        style={{
                            padding: '4px 10px',
                            fontSize: '12px',
                            backgroundColor: '#334155',
                            color: '#f8fafc',
                            border: '1px solid #475569',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                        title="Znovu připojit ke konzoli"
                    >
                        Znovu připojit
                    </button>

                    {onPopOut && (
                        <button
                            type="button"
                            onClick={onPopOut}
                            style={{
                                padding: '4px 10px',
                                fontSize: '12px',
                                backgroundColor: '#0284c7',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 500
                            }}
                            title="Otevřít v samostatném okně"
                        >
                            Samostatné okno
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            padding: '4px 12px',
                            fontSize: '14px',
                            backgroundColor: '#ef4444',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                        title="Zavřít konzoli"
                    >
                        X
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#000000' }}>
                <div
                    ref={vncContainerRef}
                    tabIndex={0}
                    style={{
                        display: consoleMode === 'vnc' ? 'flex' : 'none',
                        width: '100%',
                        height: '100%',
                        alignItems: 'center',
                        justifyContent: 'center',
                        outline: 'none',
                        overflow: 'hidden'
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
