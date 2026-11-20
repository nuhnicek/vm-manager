package main

import (
	"context"
	"runtime"
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
		{Name: "lab411-vm-manager-amd64-installer.exe", BrowserDownloadURL: "https://example.com/installer.exe"},
		{Name: "lab411-vm-manager-windows-amd64.zip", BrowserDownloadURL: "https://example.com/win.zip"},
		{Name: "lab411-vm-manager-linux-amd64.tar.gz", BrowserDownloadURL: "https://example.com/linux.tar.gz"},
		{Name: "config.json", BrowserDownloadURL: "https://example.com/config.json"},
	}

	binAsset, instAsset := findAssets(assets)
	if binAsset == nil {
		t.Fatalf("expected binary asset to be found")
	}
	if instAsset == nil {
		t.Fatalf("expected installer asset to be found")
	}
	if instAsset.Name != "lab411-vm-manager-amd64-installer.exe" {
		t.Errorf("expected installer name lab411-vm-manager-amd64-installer.exe, got %s", instAsset.Name)
	}
	if runtime.GOOS == "linux" && binAsset.Name != "lab411-vm-manager-linux-amd64.tar.gz" {
		t.Errorf("expected linux asset name lab411-vm-manager-linux-amd64.tar.gz, got %s", binAsset.Name)
	}
	if runtime.GOOS == "windows" && binAsset.Name != "lab411-vm-manager-windows-amd64.zip" {
		t.Errorf("expected windows asset name lab411-vm-manager-windows-amd64.zip, got %s", binAsset.Name)
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
	t.Logf("Installer URL: %s", info.InstallerURL)

	if info.LatestVersion == "" && !info.HasUpdate {
		t.Skip("skipping live test: unauthenticated GitHub API rate limit reached")
	}
}
