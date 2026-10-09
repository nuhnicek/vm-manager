import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { StartPTY, WritePTY, ResizePTY } from '../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime';
import '@xterm/xterm/css/xterm.css';

interface VMConsoleProps {
    vmName: string;
    onClose: () => void;
}

export function VMConsole({ vmName, onClose }: VMConsoleProps) {
    const terminalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!terminalRef.current) return;

        const term = new Terminal({
            theme: {
                background: '#000000',
                foreground: '#ffffff',
            },
            cursorBlink: true,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        term.open(terminalRef.current);
        fitAddon.fit();

        term.writeln(`\x1b[32mConnecting to real console for ${vmName}...\x1b[0m`);

        // Handle incoming data from PTY
        EventsOn("pty-data", (data: string) => {
            term.write(data);
        });

        // Send user input to PTY
        term.onData((data) => {
            WritePTY(data);
        });

        // Start the PTY backend
        StartPTY().then(() => {
            // After starting, send initial resize
            ResizePTY(term.rows, term.cols);
        }).catch(err => {
            term.writeln(`\r\n\x1b[31mFailed to start PTY: ${err}\x1b[0m`);
        });

        // Handle terminal resize
        term.onResize((size) => {
            ResizePTY(size.rows, size.cols);
        });

        const handleResize = () => {
            fitAddon.fit();
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            EventsOff("pty-data");
            term.dispose();
        };
    }, [vmName]);

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
            <div style={{ backgroundColor: '#1f2937', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: 'white', fontSize: '16px', fontWeight: 'normal' }}>Console - {vmName}</h3>
                <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: '4px 12px' }}>Close Console</button>
            </div>
            <div 
                ref={terminalRef} 
                style={{ flex: 1, overflow: 'hidden', padding: '8px' }} 
            />
        </div>
    );
}
