import { useMemo } from 'react';
import { main } from '../../wailsjs/go/models';

interface NetworkMapProps {
    vms: main.VM[];
}

interface MapNode {
    id: string;
    name: string;
    running: boolean;
    internet: boolean;
    external: boolean; // referenced by a link but not in the VM list
    x: number;
    y: number;
}

interface MapEdge {
    a: string;
    b: string;
    label: string;
}

const NODE_W = 170;
const NODE_H = 48;
const COL_GAP = 90;   // horizontal gap between BFS layers
const ROW_GAP = 28;   // vertical gap between nodes in a layer
const GROUP_GAP = 48; // vertical gap between connected components
const PAD = 24;

function truncate(s: string, n: number) {
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

/**
 * Lightweight topology renderer (replaces Mermaid, which added several MB to the bundle).
 * Layout: each connected component is laid out left→right by BFS depth;
 * components stack vertically, isolated VMs go in a grid at the bottom.
 */
function layout(vms: main.VM[]) {
    const nodes = new Map<string, MapNode>();
    const adj = new Map<string, Set<string>>();
    const edges: MapEdge[] = [];
    const seen = new Set<string>();

    const ensure = (id: string, vm?: main.VM) => {
        if (!nodes.has(id)) {
            nodes.set(id, {
                id,
                name: vm?.name || `VM ${id}`,
                running: vm ? /run/i.test(vm.status || '') : false,
                internet: !!vm?.has_internet,
                external: !vm,
                x: 0,
                y: 0,
            });
            adj.set(id, new Set());
        }
    };

    vms.forEach(vm => ensure(String(vm.id), vm));
    vms.forEach(vm => {
        const a = String(vm.id);
        (vm.connections || []).forEach(c => {
            const b = String(c.target_vm_id);
            ensure(b);
            const key = a < b ? `${a}|${b}|${c.local_nic}|${c.target_nic}` : `${b}|${a}|${c.target_nic}|${c.local_nic}`;
            if (seen.has(key)) return;
            seen.add(key);
            adj.get(a)!.add(b);
            adj.get(b)!.add(a);
            edges.push({ a, b, label: `${c.local_nic} ↔ ${c.target_nic}` });
        });
    });

    const visited = new Set<string>();
    const isolated: MapNode[] = [];
    let y = PAD;
    let maxX = 0;

    for (const id of nodes.keys()) {
        if (visited.has(id)) continue;
        if (adj.get(id)!.size === 0) {
            visited.add(id);
            isolated.push(nodes.get(id)!);
            continue;
        }
        // BFS to assign layers
        const layers: string[][] = [];
        const queue: [string, number][] = [[id, 0]];
        visited.add(id);
        while (queue.length) {
            const [cur, d] = queue.shift()!;
            (layers[d] ||= []).push(cur);
            adj.get(cur)!.forEach(n => {
                if (!visited.has(n)) {
                    visited.add(n);
                    queue.push([n, d + 1]);
                }
            });
        }
        const tallest = Math.max(...layers.map(l => l.length));
        const groupH = tallest * NODE_H + (tallest - 1) * ROW_GAP;
        layers.forEach((layer, d) => {
            const layerH = layer.length * NODE_H + (layer.length - 1) * ROW_GAP;
            const offset = (groupH - layerH) / 2;
            layer.forEach((nid, i) => {
                const n = nodes.get(nid)!;
                n.x = PAD + d * (NODE_W + COL_GAP);
                n.y = y + offset + i * (NODE_H + ROW_GAP);
                maxX = Math.max(maxX, n.x + NODE_W);
            });
        });
        y += groupH + GROUP_GAP;
    }

    if (isolated.length) {
        const cols = Math.max(1, Math.min(isolated.length, Math.floor((Math.max(maxX, 4 * (NODE_W + 24)) - PAD) / (NODE_W + 24)) || 1));
        isolated.forEach((n, i) => {
            n.x = PAD + (i % cols) * (NODE_W + 24);
            n.y = y + Math.floor(i / cols) * (NODE_H + 20);
            maxX = Math.max(maxX, n.x + NODE_W);
        });
        y += Math.ceil(isolated.length / cols) * (NODE_H + 20) - 20 + GROUP_GAP;
    }

    return {
        nodes: [...nodes.values()],
        edges,
        width: maxX + PAD,
        height: y - GROUP_GAP + PAD,
        isolatedCount: isolated.length,
    };
}

export function NetworkMap({ vms }: NetworkMapProps) {
    const g = useMemo(() => layout(vms), [vms]);
    const byId = useMemo(() => new Map(g.nodes.map(n => [n.id, n])), [g]);

    if (vms.length === 0) {
        return <div className="text-muted text-center" style={{ padding: 40 }}>Žádné virtuální stroje nebyly nalezeny</div>;
    }

    return (
        <div className="netmap">
            <svg width={g.width} height={g.height} viewBox={`0 0 ${g.width} ${g.height}`} role="img" aria-label="Topologie sítě">
                {g.edges.map((e, i) => {
                    const a = byId.get(e.a)!;
                    const b = byId.get(e.b)!;
                    const x1 = a.x + NODE_W / 2, y1 = a.y + NODE_H / 2;
                    const x2 = b.x + NODE_W / 2, y2 = b.y + NODE_H / 2;
                    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
                    const lw = e.label.length * 6.4 + 12;
                    return (
                        <g key={i}>
                            <line x1={x1} y1={y1} x2={x2} y2={y2} className="netmap-edge" />
                            <rect x={mx - lw / 2} y={my - 10} width={lw} height={20} rx={4} className="netmap-edge-label-bg" />
                            <text x={mx} y={my + 4} textAnchor="middle" className="netmap-edge-label">{e.label}</text>
                        </g>
                    );
                })}
                {g.nodes.map(n => (
                    <g key={n.id} transform={`translate(${n.x},${n.y})`}>
                        <title>{`${n.name} (ID: ${n.id})${n.external ? ' – mimo váš seznam' : ''}`}</title>
                        <rect width={NODE_W} height={NODE_H} rx={7} className={`netmap-node${n.external ? ' external' : ''}`} />
                        <circle cx={14} cy={NODE_H / 2} r={4} className={n.running ? 'netmap-dot-on' : 'netmap-dot-off'} />
                        <text x={26} y={20} className="netmap-name">{truncate(n.name, 20)}</text>
                        <text x={26} y={36} className="netmap-sub">ID {n.id}{n.internet ? ' · Internet' : ''}</text>
                    </g>
                ))}
            </svg>
        </div>
    );
}
