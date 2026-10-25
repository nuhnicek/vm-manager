import { GetBackendURL } from '../wailsjs/go/main/App';

let cachedBackendUrl: string = '';

export async function getBackendBaseUrl(): Promise<string> {
    if (cachedBackendUrl) {
        return cachedBackendUrl;
    }
    if (typeof window !== 'undefined' && (window as any).go?.main?.App?.GetBackendURL) {
        try {
            const configured = await GetBackendURL();
            if (configured) {
                cachedBackendUrl = configured.replace(/\/+$/, '');
                return cachedBackendUrl;
            }
        } catch {}
    }
    if (typeof window !== 'undefined' && window.location) {
        const isWails = window.location.origin.includes('wails.localhost') || window.location.protocol === 'wails:';
        if (isWails) {
            cachedBackendUrl = 'http://10.0.10.52:8080';
            return cachedBackendUrl;
        }
    }
    const envBackend = (import.meta as any).env?.VITE_BACKEND_URL;
    if (typeof envBackend === 'string' && envBackend) {
        cachedBackendUrl = envBackend.replace(/\/+$/, '');
        return cachedBackendUrl;
    }
    cachedBackendUrl = 'http://10.0.10.52:8080';
    return cachedBackendUrl;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const baseUrl = await getBackendBaseUrl();
    const token = localStorage.getItem('vm_manager_token') || '';

    const headers = new Headers(init?.headers || {});
    if (token && !headers.has('Authorization')) {
        headers.set('Authorization', token);
    }

    const fullUrl = `${baseUrl}${cleanPath}`;
    try {
        const resp = await fetch(fullUrl, {
            ...init,
            headers
        });
        if (resp.status !== 404) {
            return resp;
        }
        return await fetch(cleanPath, {
            ...init,
            headers
        });
    } catch {
        return await fetch(cleanPath, {
            ...init,
            headers
        });
    }
}
