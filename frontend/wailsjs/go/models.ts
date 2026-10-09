export namespace main {
	
	export class Template {
	    id: string;
	    name: string;
	    ram_mb: number;
	
	    static createFrom(source: any = {}) {
	        return new Template(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.ram_mb = source["ram_mb"];
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
	    id: string;
	    name: string;
	    status: string;
	    ram_mb: number;
	    available_nics: string[];
	    connections: VMConnection[];
	
	    static createFrom(source: any = {}) {
	        return new VM(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.status = source["status"];
	        this.ram_mb = source["ram_mb"];
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

