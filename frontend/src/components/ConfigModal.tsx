import { useState, useEffect } from 'react';
import { GetAppConfig, SaveAppConfig, SwitchEnvironment, GetConfigPath } from '../../wailsjs/go/main/App';
import { main } from '../../wailsjs/go/models';
import { invalidateCachedBackendUrl } from '../api';

interface ConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfigUpdated?: (newConfig: main.AppConfig) => void;
}

export function ConfigModal({ isOpen, onClose, onConfigUpdated }: ConfigModalProps) {
    const [config, setConfig] = useState<main.AppConfig | null>(null);
    const [configPath, setConfigPath] = useState<string>('');
    const [selectedEnv, setSelectedEnv] = useState<string>('lab');
    const [backendUrl, setBackendUrl] = useState<string>('');
    const [githubRepo, setGithubRepo] = useState<string>('nuhnicek/vm-manager');
    const [autoCheckUpdate, setAutoCheckUpdate] = useState<boolean>(true);
    const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([]);
    const [newEnvKey, setNewEnvKey] = useState<string>('');
    const [newEnvValue, setNewEnvValue] = useState<string>('');

    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (!isOpen) return;

        const load = async () => {
            try {
                setErrorMsg('');
                setSaveSuccess(false);
                if (typeof window !== 'undefined' && (window as any).go?.main?.App?.GetAppConfig) {
                    const cfg = await GetAppConfig();
                    const path = await GetConfigPath();
                    setConfig(cfg);
                    setConfigPath(path || cfg.config_path || '');
                    setSelectedEnv(cfg.environment || 'lab');
                    setBackendUrl(cfg.backend_url || '');
                    setGithubRepo(cfg.github_repo || 'nuhnicek/vm-manager');
                    setAutoCheckUpdate(cfg.auto_check_update !== false);

                    const pairs = Object.entries(cfg.env || {}).map(([key, value]) => ({ key, value: String(value) }));
                    setEnvVars(pairs);
                }
            } catch (err: any) {
                setErrorMsg('Chyba při načítání konfigurace: ' + (err?.message || err));
            }
        };

        load();
    }, [isOpen]);

    if (!isOpen) return null;

    const handleEnvChange = (envKey: string) => {
        setSelectedEnv(envKey);
        if (config && config.environments && config.environments[envKey]) {
            const profile = config.environments[envKey];
            if (profile.backend_url) {
                setBackendUrl(profile.backend_url);
            }
        }
    };

    const handleAddEnvVar = () => {
        if (!newEnvKey.trim()) return;
        setEnvVars(prev => [...prev.filter(item => item.key !== newEnvKey.trim()), { key: newEnvKey.trim(), value: newEnvValue.trim() }]);
        setNewEnvKey('');
        setNewEnvValue('');
    };

    const handleRemoveEnvVar = (key: string) => {
        setEnvVars(prev => prev.filter(item => item.key !== key));
    };

    const handleSave = async () => {
        setIsSaving(true);
        setErrorMsg('');
        try {
            const envMap: Record<string, string> = {};
            for (const item of envVars) {
                if (item.key.trim()) {
                    envMap[item.key.trim()] = item.value;
                }
            }
            // Ensure BACKEND_URL is synchronized
            envMap['BACKEND_URL'] = backendUrl.trim();
            envMap['APP_ENV'] = selectedEnv;

            const updatedCfg = new main.AppConfig({
                environment: selectedEnv,
                backend_url: backendUrl.trim(),
                environments: config?.environments || {},
                env: envMap,
                auto_check_update: autoCheckUpdate,
                github_repo: githubRepo.trim(),
                theme: config?.theme || 'dark',
                config_path: configPath
            });

            await SaveAppConfig(updatedCfg);
            invalidateCachedBackendUrl();

            setSaveSuccess(true);
            setConfig(updatedCfg);
            if (onConfigUpdated) {
                onConfigUpdated(updatedCfg);
            }

            setTimeout(() => {
                setSaveSuccess(false);
                onClose();
            }, 1200);
        } catch (err: any) {
            setErrorMsg('Uložení selhalo: ' + (err?.message || err));
        } finally {
            setIsSaving(false);
        }
    };

    const environmentsList = config?.environments ? Object.entries(config.environments) : [];

    return (
        <div className="modal-overlay" style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
        }}>
            <div className="modal-content" style={{
                background: 'var(--card-bg, #1e293b)',
                border: '1px solid var(--border-color, #334155)',
                borderRadius: '12px',
                width: '100%',
                maxWidth: '620px',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: '24px',
                color: 'var(--text-color, #f8fafc)',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid var(--border-color, #334155)', paddingBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '24px' }}>⚙️</span>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Konfigurace aplikace (config.json)</h3>
                            <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '2px' }}>
                                Správa prostředí a parametrů připojení
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'inherit',
                            fontSize: '20px',
                            cursor: 'pointer',
                            opacity: 0.7
                        }}
                    >
                        ✕
                    </button>
                </div>

                {errorMsg && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid #ef4444',
                        color: '#fca5a5',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        marginBottom: '16px'
                    }}>
                        {errorMsg}
                    </div>
                )}

                {saveSuccess && (
                    <div style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid #10b981',
                        color: '#6ee7b7',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        ✓ Konfigurace byla úspěšně uložena do config.json!
                    </div>
                )}

                {configPath && (
                    <div style={{
                        background: 'rgba(0, 0, 0, 0.25)',
                        border: '1px solid var(--border-color, #334155)',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        fontSize: '12px',
                        marginBottom: '18px',
                        fontFamily: 'monospace',
                        wordBreak: 'break-all'
                    }}>
                        <span style={{ opacity: 0.6, display: 'block', fontSize: '11px', marginBottom: '2px', fontFamily: 'sans-serif' }}>
                            Aktivní soubor:
                        </span>
                        {configPath}
                    </div>
                )}

                {/* Environment selection */}
                <div style={{ marginBottom: '18px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                        Cílové prostředí (Environment)
                    </label>
                    <select
                        value={selectedEnv}
                        onChange={(e) => handleEnvChange(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: '6px',
                            background: 'var(--input-bg, #0f172a)',
                            border: '1px solid var(--border-color, #334155)',
                            color: 'inherit',
                            fontSize: '14px'
                        }}
                    >
                        {environmentsList.map(([key, env]) => (
                            <option key={key} value={key}>
                                {env.name || key} ({env.backend_url})
                            </option>
                        ))}
                    </select>
                    {config?.environments && config.environments[selectedEnv]?.description && (
                        <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>
                            {config.environments[selectedEnv].description}
                        </div>
                    )}
                </div>

                {/* Backend URL */}
                <div style={{ marginBottom: '18px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                        Adresa backendového serveru (Backend URL)
                    </label>
                    <input
                        type="text"
                        value={backendUrl}
                        onChange={(e) => setBackendUrl(e.target.value)}
                        placeholder="http://10.0.10.30:8080"
                        style={{
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: '6px',
                            background: 'var(--input-bg, #0f172a)',
                            border: '1px solid var(--border-color, #334155)',
                            color: 'inherit',
                            fontSize: '14px',
                            boxSizing: 'border-box'
                        }}
                    />
                </div>

                {/* GitHub repository */}
                <div style={{ marginBottom: '18px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                        GitHub repozitář pro aktualizace (github_repo)
                    </label>
                    <input
                        type="text"
                        value={githubRepo}
                        onChange={(e) => setGithubRepo(e.target.value)}
                        placeholder="nuhnicek/vm-manager"
                        style={{
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: '6px',
                            background: 'var(--input-bg, #0f172a)',
                            border: '1px solid var(--border-color, #334155)',
                            color: 'inherit',
                            fontSize: '14px',
                            boxSizing: 'border-box'
                        }}
                    />
                </div>

                {/* Auto check updates checkbox */}
                <div style={{ marginBottom: '18px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={autoCheckUpdate}
                            onChange={(e) => setAutoCheckUpdate(e.target.checked)}
                            style={{ width: '16px', height: '16px' }}
                        />
                        Automaticky kontrolovat aktualizace při startu aplikace
                    </label>
                </div>

                {/* Environment variables dictionary */}
                <div style={{ marginBottom: '22px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                        Proměnné prostředí procesu (env)
                    </label>
                    <div style={{
                        background: 'rgba(0, 0, 0, 0.2)',
                        border: '1px solid var(--border-color, #334155)',
                        borderRadius: '6px',
                        padding: '10px'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                            {envVars.map((item) => (
                                <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                                    <span style={{ fontFamily: 'monospace', fontWeight: 600, minWidth: '130px', color: '#38bdf8' }}>{item.key}:</span>
                                    <span style={{ fontFamily: 'monospace', flex: 1, opacity: 0.9, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.value}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveEnvVar(item.key)}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: '#ef4444',
                                            cursor: 'pointer',
                                            padding: '2px 6px',
                                            fontSize: '14px'
                                        }}
                                        title="Odstranit"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Add new env variable */}
                        <div style={{ display: 'flex', gap: '8px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                            <input
                                type="text"
                                placeholder="KLÍČ (např. CLUSTER_ID)"
                                value={newEnvKey}
                                onChange={(e) => setNewEnvKey(e.target.value)}
                                style={{
                                    flex: 1,
                                    padding: '6px 10px',
                                    borderRadius: '4px',
                                    background: 'var(--input-bg, #0f172a)',
                                    border: '1px solid var(--border-color, #334155)',
                                    color: 'inherit',
                                    fontSize: '12px'
                                }}
                            />
                            <input
                                type="text"
                                placeholder="Hodnota"
                                value={newEnvValue}
                                onChange={(e) => setNewEnvValue(e.target.value)}
                                style={{
                                    flex: 1,
                                    padding: '6px 10px',
                                    borderRadius: '4px',
                                    background: 'var(--input-bg, #0f172a)',
                                    border: '1px solid var(--border-color, #334155)',
                                    color: 'inherit',
                                    fontSize: '12px'
                                }}
                            />
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={handleAddEnvVar}
                                style={{ padding: '6px 12px', fontSize: '12px' }}
                            >
                                + Přidat
                            </button>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={onClose}
                        disabled={isSaving}
                    >
                        Zavřít
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleSave}
                        disabled={isSaving}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        {isSaving ? 'Ukládám...' : 'Uložit do config.json'}
                    </button>
                </div>
            </div>
        </div>
    );
}
