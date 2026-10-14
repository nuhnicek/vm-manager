import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { main } from '../../wailsjs/go/models';

interface NetworkMapProps {
    vms: main.VM[];
}

export function NetworkMap({ vms }: NetworkMapProps) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!ref.current) return;

        (mermaid.initialize as any)({ startOnLoad: false, theme: 'default', useMaxWidth: false });

        let graphDef = 'graph LR\n';
        const drawnLinks = new Set<string>();

        vms.forEach(vm => {
            const nodeId = `vm_${vm.id}`;
            graphDef += `  ${nodeId}["${vm.name} (ID: ${vm.id})"]\n`;

            (vm.connections || []).forEach(conn => {
                const targetNodeId = `vm_${conn.target_vm_id}`;
                const linkId1 = `${vm.id}-${conn.target_vm_id}`;
                const linkId2 = `${conn.target_vm_id}-${vm.id}`;

                if (!drawnLinks.has(linkId1) && !drawnLinks.has(linkId2)) {
                    graphDef += `  ${nodeId} -- "${conn.local_nic} &harr; ${conn.target_nic}" --- ${targetNodeId}\n`;
                    drawnLinks.add(linkId1);
                }
            });
        });

        if (vms.length === 0) {
            graphDef += `  empty["No Proxmox VMs found"]\n`;
        }

        try {
            mermaid.render('mermaid-graph-' + Date.now(), graphDef).then(result => {
                if (ref.current) {
                    ref.current.innerHTML = result.svg;
                }
            }).catch(err => console.error("Mermaid error:", err));
        } catch (err) {
            console.error("Mermaid render error:", err);
        }

    }, [vms]);

    return (
        <div className="mermaid-container">
            <div ref={ref}></div>
        </div>
    );
}
