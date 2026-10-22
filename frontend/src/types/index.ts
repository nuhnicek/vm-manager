export interface ProxmoxNode {
    name: string;
    host_uri: string;
    status: string;
    version?: string;
    total_vms?: number;
    running_vms?: number;
    templates?: number;
}

export interface LabVMTemplate {
    name: string;
    template_id: number;
    node?: string;
    description: string;
    ram_mb?: number;
    default_user?: string;
    default_password?: string;
}

export interface LabNetworkLink {
    from_vm: string;
    from_nic?: string;
    to_vm: string;
    to_nic?: string;
    label?: string;
}

export interface LabTemplate {
    id: string;
    name: string;
    category: string;
    difficulty: string;
    description: string;
    objectives: string[];
    vms: LabVMTemplate[];
    networks: LabNetworkLink[];
    created_by?: string;
    created_at?: string;
    updated_at?: string;
}

export interface LabInstanceVM {
    template_vm_name: string;
    vmid: number;
    name: string;
    default_user?: string;
    default_password?: string;
}

export interface LabInstance {
    id: string;
    template_id: string;
    lab_name: string;
    owner_uuid: string;
    owner_email?: string;
    status: string;
    vms: LabInstanceVM[];
    created_at: string;
}

export interface TeacherStudentInfo {
    uuid: string;
    email: string;
    role: string;
    vm_count: number;
    running_vms: number;
    lab_count: number;
}

export interface FleetVM {
    id: number;
    uuid?: string;
    name: string;
    status: string;
    ram_mb?: number;
    node?: string;
    owner?: string;
    owner_uuid?: string;
    owner_email?: string;
    lab_id?: string;
    lab_name?: string;
    networks?: string[];
    available_nics?: string[];
}
