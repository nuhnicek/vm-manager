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

export interface Project {
    id: string;
    name: string;
    description?: string;
    color?: string;
    owner_uuid: string;
    owner_email?: string;
    vm_ids: number[];
    created_at?: string;
    updated_at?: string;
}

export interface FleetVM {
    id: number;
    uuid?: string;
    type?: string;
    name: string;
    status: string;
    ram_mb?: number;
    ip_address?: string;
    configured_ip?: string;
    gateway?: string;
    is_vulnerable?: boolean;
    category?: string;
    node?: string;
    owner?: string;
    owner_uuid?: string;
    owner_email?: string;
    lab_id?: string;
    lab_name?: string;
    project_id?: string;
    project_name?: string;
    project_color?: string;
    networks?: string[];
    available_nics?: string[];
}

export interface CatalogItem {
    id: string;
    name: string;
    type: 'lxc' | 'qemu';
    category: string;
    description: string;
    template_id?: number;
    ostemplate?: string;
    default_ram: number;
    default_disk_gb: number;
    default_cpus: number;
    is_vulnerable: boolean;
    ready: boolean;
}

export interface DeployCatalogRequest {
    catalog_id: string;
    name: string;
    ram?: number;
    cores?: number;
    disk?: number;
    project_id?: string;
    ip?: string;
    gateway?: string;
    is_dhcp?: boolean;
    node?: string;
    password?: string;
}

export interface SetIPRequest {
    vmid: number;
    ip: string;
    gateway?: string;
    is_dhcp: boolean;
    node?: string;
}

