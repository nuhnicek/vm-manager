import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import RFB from '@novnc/novnc';
import { GetBackendURL } from '../wailsjs/go/main/App';
import { ClipboardSetText, ClipboardGetText } from '../wailsjs/runtime/runtime';
import { apiFetch } from './api';
import { ExternalVNCModal } from './components/ExternalVNCModal';
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

    const [clipboardModalOpen, setClipboardModalOpen] = useState(false);
    const [pasteText, setPasteText] = useState('');
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [vmClipboard, setVmClipboard] = useState<string>('');

    const [externalVNCModalOpen, setExternalVNCModalOpen] = useState(false);

    const rfbRef = useRef<any>(null);
    const serialWSRef = useRef<WebSocket | null>(null);
    const vncContainerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<Terminal | null>(null);
    const [isFetchingClipboard, setIsFetchingClipboard] = useState(false);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => {
            setToastMessage(prev => prev === msg ? null : prev);
        }, 2800);
    };

    const copyToHostClipboard = async (text: string): Promise<boolean> => {
        if (!text) return false;
        try {
            if (typeof window !== 'undefined' && (window as any).runtime?.ClipboardSetText) {
                const ok = await (window as any).runtime.ClipboardSetText(text);
                if (ok) return true;
            }
            const ok = await ClipboardSetText(text);
            if (ok) return true;
        } catch {}

        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch {}

        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            return true;
        } catch {}

        return false;
    };

    const readFromHostClipboard = async (): Promise<string> => {
        try {
            if (typeof window !== 'undefined' && (window as any).runtime?.ClipboardGetText) {
                const txt = await (window as any).runtime.ClipboardGetText();
                if (txt) return txt;
            }
            const txt = await ClipboardGetText();
            if (txt) return txt;
        } catch {}

        try {
            if (navigator?.clipboard?.readText) {
                const txt = await navigator.clipboard.readText();
                if (txt) return txt;
            }
        } catch {}

        return '';
    };

    const sendStringToVNC = (rfb: any, text: string) => {
        if (!rfb) return;
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            let keysym: number;
            let code = 'Key' + char.toUpperCase();
            if (char === '\n' || char === '\r') {
                keysym = 0xFF0D;
                code = 'Enter';
            } else if (char === '\t') {
                keysym = 0xFF09;
                code = 'Tab';
            } else if (char === ' ') {
                keysym = 0x20;
                code = 'Space';
            } else if (char === '\b') {
                keysym = 0xFF08;
                code = 'Backspace';
            } else {
                const codePoint = char.charCodeAt(0);
                if (codePoint < 256) {
                    keysym = codePoint;
                } else {
                    keysym = 0x01000000 | codePoint;
                }
            }
            rfb.sendKey(keysym, code);
        }
    };

    const handleFetchGuestClipboard = async () => {
        if (!vmId) return;
        setIsFetchingClipboard(true);
        try {
            let url = `/vms/console/clipboard?vmid=${encodeURIComponent(String(vmId))}`;
            if (vmNode) {
                url += `&node=${encodeURIComponent(vmNode)}`;
            }
            const resp = await apiFetch(url);
            if (resp && resp.ok) {
                const data = await resp.json();
                if (data && typeof data.text === 'string' && data.text.length > 0) {
                    setVmClipboard(data.text);
                    await copyToHostClipboard(data.text);
                    showToast(`Schránka načtena ze stroje (${data.text.length} znaků)`);
                    return;
                }
            }
            showToast('Ve schránce virtuálního stroje není žádný text');
        } catch {
            showToast('Nepodařilo se načíst schránku ze stroje');
        } finally {
            setIsFetchingClipboard(false);
        }
    };

    const handleDirectPaste = async () => {
        try {
            const text = await readFromHostClipboard();
            if (!text) {
                setClipboardModalOpen(true);
                return;
            }
            if (consoleMode === 'vnc' && rfbRef.current) {
                rfbRef.current.clipboardPasteFrom(text);
                sendStringToVNC(rfbRef.current, text);
                showToast(`Vloženo ${text.length} znaků do konzole`);
            } else if (consoleMode === 'serial' && serialWSRef.current) {
                if (serialWSRef.current.readyState === WebSocket.OPEN) {
                    serialWSRef.current.send(text);
                    showToast(`Vloženo ${text.length} znaků do terminálu`);
                }
            }
        } catch {
            setClipboardModalOpen(true);
        }
    };

    const handleSendCustomText = async (text: string, asKeystrokes: boolean) => {
        if (!text) return;
        if (consoleMode === 'vnc' && rfbRef.current) {
            if (asKeystrokes) {
                sendStringToVNC(rfbRef.current, text);
                showToast(`Napsáno ${text.length} znaků do VM`);
            } else {
                rfbRef.current.clipboardPasteFrom(text);
                if (vmId) {
                    try {
                        let url = `/vms/console/clipboard`;
                        await apiFetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ vmid: Number(vmId), text, node: vmNode })
                        });
                    } catch {}
                }
                showToast('Uloženo do schránky VM');
            }
        } else if (consoleMode === 'serial' && serialWSRef.current) {
            if (serialWSRef.current.readyState === WebSocket.OPEN) {
                serialWSRef.current.send(text);
                showToast(`Odesláno ${text.length} znaků do terminálu`);
            }
        }
        setClipboardModalOpen(false);
        setPasteText('');
    };

    const handleOpenClipboardModal = () => {
        setClipboardModalOpen(true);
        if (vmId) {
            handleFetchGuestClipboard();
        }
    };

    const handleCopyVMClipboard = async () => {
        let textToCopy = '';

        if (consoleMode === 'serial' && termRef.current?.hasSelection()) {
            textToCopy = termRef.current.getSelection();
        }

        if (!textToCopy && vmId) {
            try {
                let url = `/vms/console/clipboard?vmid=${encodeURIComponent(String(vmId))}`;
                if (vmNode) {
                    url += `&node=${encodeURIComponent(vmNode)}`;
                }
                const resp = await apiFetch(url);
                if (resp && resp.ok) {
                    const data = await resp.json();
                    if (data && typeof data.text === 'string' && data.text.length > 0) {
                        textToCopy = data.text;
                    }
                }
            } catch {}
        }

        if (!textToCopy && vmClipboard) {
            textToCopy = vmClipboard;
        }

        if (!textToCopy && consoleMode === 'serial' && termRef.current) {
            const sel = termRef.current.getSelection();
            if (sel) {
                textToCopy = sel;
            }
        }

        if (textToCopy) {
            setVmClipboard(textToCopy);
            await copyToHostClipboard(textToCopy);
            const snippet = textToCopy.length > 30 ? textToCopy.slice(0, 30) + '...' : textToCopy;
            showToast(`Zkopírováno ze schránky VM (${textToCopy.length} znaků): "${snippet}"`);
        } else {
            setClipboardModalOpen(true);
            showToast('Schránka VM je zatím prázdná');
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
                if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                    return;
                }
                e.preventDefault();
                handleDirectPaste();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [consoleMode]);

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
                rfb.focusOnClick = true;

                if (performanceMode === 'low-latency') {
                    rfb.compressionLevel = 1;
                    rfb.qualityLevel = 6;
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

                rfb.addEventListener('clipboard', async (e: any) => {
                    if (isDisposed) return;
                    if (e?.detail?.text) {
                        setVmClipboard(e.detail.text);
                        await copyToHostClipboard(e.detail.text);
                        const snippet = e.detail.text.length > 30 ? e.detail.text.slice(0, 30) + '...' : e.detail.text;
                        showToast(`Schránka z VM zkopírována do počítače: "${snippet}"`);
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
                rfbRef.current.compressionLevel = 1;
                rfbRef.current.qualityLevel = 6;
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
                serialWSRef.current = ws;

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

                termRef.current = term;

                term.attachCustomKeyEventHandler((e) => {
                    if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V') && e.type === 'keydown') {
                        handleDirectPaste();
                        return false;
                    }
                    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C') && e.type === 'keydown') {
                        if (term.hasSelection()) {
                            const sel = term.getSelection();
                            setVmClipboard(sel);
                            copyToHostClipboard(sel);
                            showToast(`Zkopírováno ${sel.length} znaků z terminálu`);
                            return false;
                        }
                    }
                    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'c' || e.key === 'C') && e.type === 'keydown') {
                        const sel = term.getSelection();
                        if (sel) {
                            setVmClipboard(sel);
                            copyToHostClipboard(sel);
                            showToast(`Zkopírováno ${sel.length} znaků z terminálu`);
                            return false;
                        }
                    }
                    return true;
                });

                term.onSelectionChange(() => {
                    const sel = term.getSelection();
                    if (sel) {
                        setVmClipboard(sel);
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
            serialWSRef.current = null;
            termRef.current = null;
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
                        onClick={handleCopyVMClipboard}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        title="Zkopírovat schránku z virtuálního stroje do vašeho počítače"
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <span>Kopírovat z VM</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleDirectPaste}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        title="Vložit text ze schránky vašeho počítače do konzole (Ctrl+V)"
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                        </svg>
                        <span>Vložit</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleOpenClipboardModal}
                        className="btn btn-secondary btn-sm"
                        title="Otevřít textové pole pro vložení / psaní delšího textu či hesel"
                    >
                        Schránka & Psaní
                    </button>

                    <button
                        type="button"
                        onClick={() => setExternalVNCModalOpen(true)}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', borderColor: 'rgba(56, 189, 248, 0.4)' }}
                        title="Získat port a konfigurační soubor pro nativní VNC klienty (TigerVNC, RealVNC, Remmina)"
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                            <line x1="8" y1="21" x2="16" y2="21"></line>
                            <line x1="12" y1="17" x2="12" y2="21"></line>
                        </svg>
                        <span>VNC Klient</span>
                    </button>

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
                                title="Nízká latence pro plynulý obraz s hardwarovým blittingem"
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
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>SCHRÁNKA:</span>
                        <button
                            type="button"
                            onClick={handleCopyVMClipboard}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '11px', padding: '2px 8px' }}
                            title="Zkopírovat schránku z VM do vašeho počítače"
                        >
                            Kopírovat z VM
                        </button>
                        <button
                            type="button"
                            onClick={handleDirectPaste}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '11px', padding: '2px 8px' }}
                            title="Vložit schránku do VM jako stisky kláves"
                        >
                            Vložit (Ctrl+V)
                        </button>
                        <button
                            type="button"
                            onClick={handleOpenClipboardModal}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '11px', padding: '2px 8px' }}
                            title="Otevřít správce schránky a textů"
                        >
                            Správce schránky
                        </button>

                        <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-color)', margin: '0 4px' }} />

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
                        image-rendering: pixelated;
                        image-rendering: -moz-crisp-edges;
                        image-rendering: crisp-edges;
                        transform: translate3d(0, 0, 0);
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
                    onMouseUp={() => {
                        if (termRef.current?.hasSelection()) {
                            const sel = termRef.current.getSelection();
                            if (sel) {
                                setVmClipboard(sel);
                                copyToHostClipboard(sel);
                                showToast(`Zkopírováno ${sel.length} znaků z terminálu`);
                            }
                        }
                    }}
                    style={{
                        display: consoleMode === 'serial' ? 'block' : 'none',
                        width: '100%',
                        height: '100%',
                        padding: '8px',
                        boxSizing: 'border-box'
                    }}
                />
            </div>

            {clipboardModalOpen && (
                <div className="modal-backdrop" style={{ zIndex: 100000 }}>
                    <div className="modal-content" style={{ maxWidth: '560px', width: '92%' }}>
                        <div className="modal-header">
                            <div>
                                <h3 className="modal-title">Správce schránky & Psaní</h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                                    Obousměrná schránka mezi vaším počítačem a virtuálním strojem
                                </p>
                            </div>
                            <button
                                type="button"
                                className="close-button"
                                onClick={() => {
                                    setClipboardModalOpen(false);
                                    setPasteText('');
                                }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>

                        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{
                                backgroundColor: 'var(--card-bg-subtle)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                padding: '14px 16px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Schránka z virtuálního stroje
                                    </span>
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={handleFetchGuestClipboard}
                                        disabled={isFetchingClipboard}
                                        style={{ fontSize: '11px', padding: '2px 8px' }}
                                        title="Znovu přečíst aktuální obsah schránky z virtuálního stroje"
                                    >
                                        {isFetchingClipboard ? 'Načítání...' : 'Obnovit ze stroje'}
                                    </button>
                                </div>

                                {vmClipboard ? (
                                    <>
                                        <div style={{
                                            maxHeight: '110px',
                                            overflowY: 'auto',
                                            padding: '8px 10px',
                                            backgroundColor: 'var(--bg-secondary)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '6px',
                                            fontSize: '12px',
                                            fontFamily: 'monospace',
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-all',
                                            color: 'var(--text-main)',
                                            marginBottom: '10px'
                                        }}>
                                            {vmClipboard}
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                type="button"
                                                className="btn btn-primary btn-sm"
                                                onClick={async () => {
                                                    await copyToHostClipboard(vmClipboard);
                                                    showToast(`Zkopírováno ${vmClipboard.length} znaků do vašeho počítače`);
                                                }}
                                                style={{ fontSize: '12px' }}
                                                title="Zkopírovat tento text do systémové schránky vašeho počítače"
                                            >
                                                Zkopírovat do počítače
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
                                        Ve schránce virtuálního stroje zatím není žádný text (nebo ještě nebyl vybrán text v grafickém rozhraní či terminálu).
                                    </div>
                                )}
                            </div>

                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Vložit text do virtuálního stroje
                                    </span>
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={async () => {
                                            const txt = await readFromHostClipboard();
                                            if (txt) {
                                                setPasteText(txt);
                                                showToast(`Načteno ${txt.length} znaků ze schránky počítače`);
                                            } else {
                                                showToast('Schránka počítače je prázdná');
                                            }
                                        }}
                                        style={{ fontSize: '11px', padding: '2px 8px' }}
                                        title="Přečíst text ze systémové schránky počítače a vložit do pole"
                                    >
                                        Vložit ze schránky počítače
                                    </button>
                                </div>

                                <textarea
                                    value={pasteText}
                                    onChange={e => setPasteText(e.target.value)}
                                    placeholder="Vložte sem text, příkaz nebo heslo k odeslání do stroje..."
                                    rows={5}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        fontFamily: 'monospace',
                                        fontSize: '13px',
                                        backgroundColor: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '6px',
                                        color: 'var(--text-main)',
                                        resize: 'vertical',
                                        marginBottom: '10px',
                                        boxSizing: 'border-box'
                                    }}
                                    autoFocus
                                />

                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={() => handleSendCustomText(pasteText, true)}
                                        disabled={!pasteText.trim()}
                                        style={{ fontSize: '12px', flex: 1, minWidth: '160px' }}
                                        title="Vepíše text jako virtuální stisky kláves (funguje v každém Linux shellu i konzoli)"
                                    >
                                        Napsat do konzole (klávesnice)
                                    </button>
                                    {consoleMode === 'vnc' && (
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={() => handleSendCustomText(pasteText, false)}
                                            disabled={!pasteText.trim()}
                                            style={{ fontSize: '12px', flex: 1, minWidth: '160px' }}
                                            title="Nastaví text do schránky grafického systému VM (pro Ctrl+V v GUI)"
                                        >
                                            Uložit do schránky VM
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="modal-actions" style={{ marginTop: '0', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        setClipboardModalOpen(false);
                                        setPasteText('');
                                    }}
                                >
                                    Zavřít
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ExternalVNCModal
                isOpen={externalVNCModalOpen}
                vmId={vmId!}
                vmName={vmName}
                vmNode={vmNode}
                onClose={() => setExternalVNCModalOpen(false)}
            />

            {toastMessage && (
                <div style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: '24px',
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    color: '#f8fafc',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    fontSize: '13px',
                    fontWeight: 500,
                    zIndex: 100001,
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#38bdf8' }} />
                    <span>{toastMessage}</span>
                </div>
            )}
        </div>
    );
}
