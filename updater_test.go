package main

import (
	"context"
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

func TestLiveGitHubCheckForUpdate(t *testing.T) {
	app := &App{ctx: context.Background()}
	info, err := app.CheckForUpdate()
	if err != nil {
		t.Fatalf("CheckForUpdate error: %v", err)
	}
	if info == nil {
		t.Fatal("expected non-nil UpdateInfo")
	}

	t.Logf("Current Version: %s", info.CurrentVersion)
	t.Logf("Latest Version: %s", info.LatestVersion)
	t.Logf("HasUpdate: %v", info.HasUpdate)
	t.Logf("Download URL: %s", info.DownloadURL)
	t.Logf("Asset Name: %s", info.AssetName)
	t.Logf("Asset Size: %d", info.AssetSize)

	if info.LatestVersion == "" && !info.HasUpdate {
		t.Skip("skipping live test: unauthenticated GitHub API rate limit reached")
	}

	if info.LatestVersion != "v1.0.1" {
		t.Errorf("expected LatestVersion to be v1.0.1, got %s", info.LatestVersion)
	}
	if !info.HasUpdate {
		t.Errorf("expected HasUpdate to be true (v1.0.0 < v1.0.1)")
	}
	if info.DownloadURL == "" {
		t.Errorf("expected non-empty DownloadURL")
	}
}
