export namespace main {
	
	export class AuthResult {
	    token: string;
	    email: string;
	    role?: string;
	
	    static createFrom(source: any = {}) {
	        return new AuthResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.token = source["token"];
	        this.email = source["email"];
	        this.role = source["role"];
	    }
	}
	export class ProxmoxNode {
	    name: string;
	    host_uri: string;
	    status: string;
	    version?: string;
	    total_vms: number;
	    running_vms: number;
	    templates: number;
	
	    static createFrom(source: any = {}) {
	        return new ProxmoxNode(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.host_uri = source["host_uri"];
	        this.status = source["status"];
	        this.version = source["version"];
	        this.total_vms = source["total_vms"];
	        this.running_vms = source["running_vms"];
	        this.templates = source["templates"];
	    }
	}
	export class Template {
	    id: number;
	    uuid?: string;
	    name: string;
	    node?: string;
	
	    static createFrom(source: any = {}) {
	        return new Template(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.uuid = source["uuid"];
	        this.name = source["name"];
	        this.node = source["node"];
	    }
	}
	export class VMConnection {
	    target_vm_id: string;
	    local_nic: string;
	    target_nic: string;
	
	    static createFrom(source: any = {}) {
	        return new VMConnection(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.target_vm_id = source["target_vm_id"];
	        this.local_nic = source["local_nic"];
	        this.target_nic = source["target_nic"];
	    }
	}
	export class VM {
	    id: number;
	    uuid?: string;
	    name: string;
	    type?: string;
	    status?: string;
	    ram_mb?: number;
	    node?: string;
	    owner?: string;
	    ip_address?: string;
	    configured_ip?: string;
	    gateway?: string;
	    is_vulnerable?: boolean;
	    category?: string;
	    project_id?: string;
	    project_name?: string;
	    project_color?: string;
	    networks?: string[];
	    available_nics?: string[];
	    connections?: VMConnection[];
	
	    static createFrom(source: any = {}) {
	        return new VM(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.uuid = source["uuid"];
	        this.name = source["name"];
	        this.type = source["type"];
	        this.status = source["status"];
	        this.ram_mb = source["ram_mb"];
	        this.node = source["node"];
	        this.owner = source["owner"];
	        this.ip_address = source["ip_address"];
	        this.configured_ip = source["configured_ip"];
	        this.gateway = source["gateway"];
	        this.is_vulnerable = source["is_vulnerable"];
	        this.category = source["category"];
	        this.project_id = source["project_id"];
	        this.project_name = source["project_name"];
	        this.project_color = source["project_color"];
	        this.networks = source["networks"];
	        this.available_nics = source["available_nics"];
	        this.connections = this.convertValues(source["connections"], VMConnection);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

