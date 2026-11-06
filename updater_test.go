package main

import (
	"testing"
)

func TestSemverComparison(t *testing.T) {
	tests := []struct {
		current  string
		latest   string
		expected bool
	}{
		{"v1.0.0", "v1.0.1", true},
		{"v1.0.0", "v1.1.0", true},
		{"v1.0.0", "v2.0.0", true},
		{"v1.0.1", "v1.0.1", false},
		{"v1.0.2", "v1.0.1", false},
		{"1.0.0", "1.0.1", true},
		{"v1.0.0", "v1.0.0-beta", false},
		{"v1.0.0", "v1.0.1-rc1", true},
	}

	for _, tt := range tests {
		got := isNewerVersion(tt.current, tt.latest)
		if got != tt.expected {
			t.Errorf("isNewerVersion(%q, %q) = %v; want %v", tt.current, tt.latest, got, tt.expected)
		}
	}
}

func TestAssetMatching(t *testing.T) {
	assets := []GitHubReleaseAsset{
		{Name: "lab411-vm-manager.exe", BrowserDownloadURL: "https://example.com/win.exe"},
		{Name: "lab411-vm-manager-linux", BrowserDownloadURL: "https://example.com/linux"},
	}

	asset := findCompatibleAsset(assets)
	if asset == nil {
		t.Fatalf("expected asset to be found")
	}
}
