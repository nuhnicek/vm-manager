package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// EnvironmentProfile defines a single environment target (e.g. lab, local, staging).
type EnvironmentProfile struct {
	Name        string            `json:"name"`
	BackendURL  string            `json:"backend_url"`
	Description string            `json:"description,omitempty"`
	Env         map[string]string `json:"env,omitempty"`
}

// AppConfig is the main configuration loaded from config.json.
type AppConfig struct {
	Environment     string                        `json:"environment"`
	BackendURL      string                        `json:"backend_url"`
	Environments    map[string]EnvironmentProfile `json:"environments"`
	Env             map[string]string             `json:"env"`
	AutoCheckUpdate bool                          `json:"auto_check_update"`
	GitHubRepo      string                        `json:"github_repo"`
	Theme           string                        `json:"theme,omitempty"`
	ConfigPath      string                        `json:"config_path,omitempty"`
}

var (
	configMu sync.RWMutex
)

// DefaultConfig returns the default configuration for the application.
func DefaultConfig() AppConfig {
	return AppConfig{
		Environment: "lab",
		BackendURL:  "http://10.0.10.30:8080",
		Environments: map[string]EnvironmentProfile{
			"lab": {
				Name:        "Lab 411 Cluster",
				BackendURL:  "http://10.0.10.30:8080",
				Description: "Školní laboratorní cluster SPŠE Ostrava",
				Env: map[string]string{
					"PROXMOX_REALM": "pve",
					"CLUSTER_NAME":  "lab411",
				},
			},
			"local": {
				Name:        "Lokální vývoj (Localhost)",
				BackendURL:  "http://127.0.0.1:8080",
				Description: "Lokální backend na vývojářském počítači",
				Env: map[string]string{
					"APP_ENV": "development",
				},
			},
			"staging": {
				Name:        "Testovací prostředí (Staging)",
				BackendURL:  "http://10.0.10.30:8081",
				Description: "Testovací uzel pro ověřování nových funkcí",
				Env: map[string]string{
					"APP_ENV": "staging",
				},
			},
		},
		Env: map[string]string{
			"BACKEND_URL": "http://10.0.10.30:8080",
			"LAB_CLUSTER": "lab411",
			"APP_ENV":     "lab",
		},
		AutoCheckUpdate: true,
		GitHubRepo:      "nuhnicek/vm-manager",
		Theme:           "dark",
	}
}

// findConfigFile locates an existing config.json file in standard search locations.
func findConfigFile(explicitPath string) (string, bool) {
	if explicitPath != "" {
		if _, err := os.Stat(explicitPath); err == nil {
			return explicitPath, true
		}
	}

	if envPath := os.Getenv("LAB411_CONFIG"); envPath != "" {
		if _, err := os.Stat(envPath); err == nil {
			return envPath, true
		}
	}

	if envPath := os.Getenv("CONFIG_PATH"); envPath != "" {
		if _, err := os.Stat(envPath); err == nil {
			return envPath, true
		}
	}

	// 1. Next to the running executable
	if execPath, err := os.Executable(); err == nil {
		if resolved, err := filepath.EvalSymlinks(execPath); err == nil {
			candidate := filepath.Join(filepath.Dir(resolved), "config.json")
			if _, err := os.Stat(candidate); err == nil {
				return candidate, true
			}
		}
	}

	// 2. Current working directory
	if cwd, err := os.Getwd(); err == nil {
		candidate := filepath.Join(cwd, "config.json")
		if _, err := os.Stat(candidate); err == nil {
			return candidate, true
		}
	}

	// 3. User configuration directory (%APPDATA%\Lab411\config.json or ~/.config/lab411/config.json)
	if userConfigDir, err := os.UserConfigDir(); err == nil {
		candidate := filepath.Join(userConfigDir, "Lab411", "config.json")
		if _, err := os.Stat(candidate); err == nil {
			return candidate, true
		}
	}

	return "", false
}

// determineDefaultConfigPath determines where a newly generated config.json should be saved.
func determineDefaultConfigPath() string {
	// First preference: beside executable if writable
	if execPath, err := os.Executable(); err == nil {
		if resolved, err := filepath.EvalSymlinks(execPath); err == nil {
			execDir := filepath.Dir(resolved)
			testPath := filepath.Join(execDir, ".writable_test")
			if err := os.WriteFile(testPath, []byte(""), 0644); err == nil {
				_ = os.Remove(testPath)
				return filepath.Join(execDir, "config.json")
			}
		}
	}

	// Second preference: user config directory
	if userConfigDir, err := os.UserConfigDir(); err == nil {
		appConfigDir := filepath.Join(userConfigDir, "Lab411")
		_ = os.MkdirAll(appConfigDir, 0755)
		return filepath.Join(appConfigDir, "config.json")
	}

	// Fallback: current working directory
	return "config.json"
}

// LoadConfig loads the configuration from disk, creating a default config.json if not found,
// and applies all configured environment variables.
func LoadConfig(explicitPath string) (AppConfig, error) {
	configMu.Lock()
	defer configMu.Unlock()

	var targetPath string
	var exists bool

	if explicitPath != "" {
		targetPath = explicitPath
		if _, err := os.Stat(explicitPath); err == nil {
			exists = true
		}
	} else {
		targetPath, exists = findConfigFile("")
		if !exists {
			targetPath = determineDefaultConfigPath()
		}
	}

	var cfg AppConfig

	if !exists {
		cfg = DefaultConfig()
		cfg.ConfigPath = targetPath
		// Save the default template to disk
		if err := saveConfigUnlocked(cfg); err != nil {
			log.Printf("[Config] Notice: unable to write default config to %s: %v", cfg.ConfigPath, err)
		} else {
			log.Printf("[Config] Created default configuration at: %s", cfg.ConfigPath)
		}
	} else {
		data, err := os.ReadFile(targetPath)
		if err != nil {
			return DefaultConfig(), fmt.Errorf("failed to read config file %s: %w", targetPath, err)
		}

		cfg = DefaultConfig() // Start with defaults to fill missing fields
		if err := json.Unmarshal(data, &cfg); err != nil {
			return DefaultConfig(), fmt.Errorf("failed to parse config JSON in %s: %w", targetPath, err)
		}
		cfg.ConfigPath = targetPath
		log.Printf("[Config] Loaded configuration from: %s", targetPath)
	}

	// Resolve active environment profile
	applyConfigEnvironment(&cfg)

	return cfg, nil
}

// applyConfigEnvironment resolves environment profile and exports environment variables to os.Environ.
func applyConfigEnvironment(cfg *AppConfig) {
	// Check if environment profile exists
	if profile, ok := cfg.Environments[cfg.Environment]; ok {
		if cfg.BackendURL == "" && profile.BackendURL != "" {
			cfg.BackendURL = profile.BackendURL
		}
		// Apply profile-specific env variables
		for k, v := range profile.Env {
			os.Setenv(k, v)
		}
	}

	// Fallback backend URL
	if cfg.BackendURL == "" {
		if envVal := os.Getenv("BACKEND_URL"); envVal != "" {
			cfg.BackendURL = envVal
		} else {
			cfg.BackendURL = "http://10.0.10.30:8080"
		}
	}
	cfg.BackendURL = strings.TrimRight(cfg.BackendURL, "/")

	// Apply global env variables from config
	if cfg.Env == nil {
		cfg.Env = make(map[string]string)
	}
	for k, v := range cfg.Env {
		os.Setenv(k, v)
	}

	// Always sync core environments
	os.Setenv("BACKEND_URL", cfg.BackendURL)
	os.Setenv("APP_ENV", cfg.Environment)
	if cfg.GitHubRepo != "" {
		os.Setenv("GITHUB_REPO", cfg.GitHubRepo)
	}
}

// SaveConfig saves the configuration back to disk.
func SaveConfig(cfg AppConfig) error {
	configMu.Lock()
	defer configMu.Unlock()
	return saveConfigUnlocked(cfg)
}

func saveConfigUnlocked(cfg AppConfig) error {
	targetPath := cfg.ConfigPath
	if targetPath == "" {
		targetPath = determineDefaultConfigPath()
		cfg.ConfigPath = targetPath
	}

	dir := filepath.Dir(targetPath)
	if dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("failed to create config directory %s: %w", dir, err)
		}
	}

	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to encode config to JSON: %w", err)
	}

	if err := os.WriteFile(targetPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write config to %s: %w", targetPath, err)
	}

	return nil
}
