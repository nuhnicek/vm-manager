package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig()
	if cfg.Environment != "lab" {
		t.Fatalf("expected environment 'lab', got '%s'", cfg.Environment)
	}
	if cfg.BackendURL != "http://10.0.10.30:8080" {
		t.Fatalf("expected backend URL 'http://10.0.10.30:8080', got '%s'", cfg.BackendURL)
	}
	if len(cfg.Environments) == 0 {
		t.Fatal("expected at least one environment profile")
	}
	if cfg.Env["BACKEND_URL"] != "http://10.0.10.30:8080" {
		t.Fatalf("expected BACKEND_URL env var, got '%s'", cfg.Env["BACKEND_URL"])
	}
}

func TestLoadAndSaveConfig(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "config.json")

	// 1. Loading non-existent path creates default at that path
	cfg, err := LoadConfig(configPath)
	if err != nil {
		t.Fatalf("LoadConfig failed: %v", err)
	}

	if cfg.ConfigPath != configPath {
		t.Fatalf("expected ConfigPath '%s', got '%s'", configPath, cfg.ConfigPath)
	}

	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		t.Fatal("expected config.json to be created on disk")
	}

	// Verify environment variables were applied
	if os.Getenv("BACKEND_URL") != cfg.BackendURL {
		t.Fatalf("expected os.Getenv(BACKEND_URL) to be '%s', got '%s'", cfg.BackendURL, os.Getenv("BACKEND_URL"))
	}
	if os.Getenv("APP_ENV") != "lab" {
		t.Fatalf("expected os.Getenv(APP_ENV) to be 'lab', got '%s'", os.Getenv("APP_ENV"))
	}

	// 2. Modify and Save
	cfg.Environment = "local"
	cfg.BackendURL = "http://127.0.0.1:9090"
	cfg.Env["CUSTOM_TEST_VAR"] = "hello_world"

	err = SaveConfig(cfg)
	if err != nil {
		t.Fatalf("SaveConfig failed: %v", err)
	}

	// 3. Reload and verify
	reloaded, err := LoadConfig(configPath)
	if err != nil {
		t.Fatalf("Reloading config failed: %v", err)
	}

	if reloaded.Environment != "local" {
		t.Fatalf("expected reloaded environment 'local', got '%s'", reloaded.Environment)
	}
	if reloaded.BackendURL != "http://127.0.0.1:9090" {
		t.Fatalf("expected reloaded backend URL 'http://127.0.0.1:9090', got '%s'", reloaded.BackendURL)
	}
	if os.Getenv("CUSTOM_TEST_VAR") != "hello_world" {
		t.Fatalf("expected os.Getenv(CUSTOM_TEST_VAR) to be 'hello_world', got '%s'", os.Getenv("CUSTOM_TEST_VAR"))
	}
}

func TestEnvironmentProfileFallback(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "custom_env.json")

	rawJSON := `{
		"environment": "staging",
		"backend_url": "",
		"environments": {
			"staging": {
				"name": "Staging Server",
				"backend_url": "http://10.0.10.99:8080",
				"env": {
					"TEST_STAGING_KEY": "staging_ok"
				}
			}
		}
	}`

	if err := os.WriteFile(configPath, []byte(rawJSON), 0644); err != nil {
		t.Fatalf("failed to write test json: %v", err)
	}

	cfg, err := LoadConfig(configPath)
	if err != nil {
		t.Fatalf("LoadConfig failed: %v", err)
	}

	if cfg.BackendURL != "http://10.0.10.99:8080" {
		t.Fatalf("expected backend URL from profile 'http://10.0.10.99:8080', got '%s'", cfg.BackendURL)
	}
	if os.Getenv("TEST_STAGING_KEY") != "staging_ok" {
		t.Fatalf("expected profile env TEST_STAGING_KEY to be 'staging_ok', got '%s'", os.Getenv("TEST_STAGING_KEY"))
	}
}
