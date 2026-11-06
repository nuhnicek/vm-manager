package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	AppVersion      = "v1.0.0"
	GitHubRepoOwner = "nuhnicek"
	GitHubRepoName  = "vm-manager"
)

type GitHubReleaseAsset struct {
	Name               string `json:"name"`
	Size               int64  `json:"size"`
	BrowserDownloadURL string `json:"browser_download_url"`
	ContentType        string `json:"content_type"`
}

type GitHubRelease struct {
	TagName     string               `json:"tag_name"`
	Name        string               `json:"name"`
	Body        string               `json:"body"`
	Draft       bool                 `json:"draft"`
	Prerelease  bool                 `json:"prerelease"`
	PublishedAt string               `json:"published_at"`
	Assets      []GitHubReleaseAsset `json:"assets"`
}

type UpdateInfo struct {
	CurrentVersion string `json:"current_version"`
	LatestVersion  string `json:"latest_version"`
	ReleaseName    string `json:"release_name"`
	ReleaseNotes   string `json:"release_notes"`
	PublishedAt    string `json:"published_at"`
	DownloadURL    string `json:"download_url"`
	AssetSize      int64  `json:"asset_size"`
	AssetName      string `json:"asset_name"`
	HasUpdate      bool   `json:"has_update"`
}

type UpdateProgress struct {
	DownloadedBytes int64   `json:"downloaded_bytes"`
	TotalBytes      int64   `json:"total_bytes"`
	Percentage      float64 `json:"percentage"`
	Status          string  `json:"status"` // "downloading", "applying", "ready_to_restart", "error"
	Error           string  `json:"error,omitempty"`
}

func (a *App) GetAppVersion() string {
	return AppVersion
}

func parseSemver(v string) []int {
	v = strings.TrimPrefix(strings.TrimSpace(v), "v")
	if idx := strings.IndexAny(v, "-+"); idx != -1 {
		v = v[:idx]
	}
	parts := strings.Split(v, ".")
	nums := make([]int, len(parts))
	for i, p := range parts {
		num, _ := strconv.Atoi(p)
		nums[i] = num
	}
	return nums
}

func isNewerVersion(current, latest string) bool {
	cParts := parseSemver(current)
	lParts := parseSemver(latest)
	maxLen := len(cParts)
	if len(lParts) > maxLen {
		maxLen = len(lParts)
	}
	for i := 0; i < maxLen; i++ {
		cVal := 0
		if i < len(cParts) {
			cVal = cParts[i]
		}
		lVal := 0
		if i < len(lParts) {
			lVal = lParts[i]
		}
		if lVal > cVal {
			return true
		}
		if lVal < cVal {
			return false
		}
	}
	return false
}

func findCompatibleAsset(assets []GitHubReleaseAsset) *GitHubReleaseAsset {
	goos := runtime.GOOS // "windows", "linux", "darwin"
	for _, asset := range assets {
		lower := strings.ToLower(asset.Name)
		if goos == "windows" {
			if strings.HasSuffix(lower, ".exe") {
				return &asset
			}
		} else if goos == "linux" {
			if !strings.HasSuffix(lower, ".exe") && !strings.HasSuffix(lower, ".zip") && !strings.HasSuffix(lower, ".tar.gz") {
				return &asset
			}
		}
	}
	// Fallback: if only .exe is available or general asset
	for _, asset := range assets {
		lower := strings.ToLower(asset.Name)
		if strings.HasSuffix(lower, ".exe") {
			return &asset
		}
	}
	if len(assets) > 0 {
		return &assets[0]
	}
	return nil
}

func (a *App) CheckForUpdate() (*UpdateInfo, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	apiURL := fmt.Sprintf("https://api.github.com/repos/%s/%s/releases/latest", GitHubRepoOwner, GitHubRepoName)
	req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", "Lab411-VM-Manager")

	if token := os.Getenv("GITHUB_TOKEN"); token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return &UpdateInfo{
			CurrentVersion: AppVersion,
			HasUpdate:      false,
		}, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusTooManyRequests {
		// No release yet published or rate limited
		return &UpdateInfo{
			CurrentVersion: AppVersion,
			HasUpdate:      false,
		}, nil
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("github api returned status %d", resp.StatusCode)
	}

	var rel GitHubRelease
	if err := json.NewDecoder(resp.Body).Decode(&rel); err != nil {
		return nil, fmt.Errorf("failed to parse release metadata: %w", err)
	}

	hasUpdate := isNewerVersion(AppVersion, rel.TagName)
	var downloadURL, assetName string
	var assetSize int64

	asset := findCompatibleAsset(rel.Assets)
	if asset != nil {
		downloadURL = asset.BrowserDownloadURL
		assetName = asset.Name
		assetSize = asset.Size
	}

	return &UpdateInfo{
		CurrentVersion: AppVersion,
		LatestVersion:  rel.TagName,
		ReleaseName:    rel.Name,
		ReleaseNotes:   rel.Body,
		PublishedAt:    rel.PublishedAt,
		DownloadURL:    downloadURL,
		AssetSize:      assetSize,
		AssetName:      assetName,
		HasUpdate:      hasUpdate,
	}, nil
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0755)
	if err != nil {
		return err
	}
	defer out.Close()

	if _, err := io.Copy(out, in); err != nil {
		return err
	}
	return out.Sync()
}

func (a *App) DownloadAndApplyUpdate(downloadURL string) error {
	if downloadURL == "" {
		return fmt.Errorf("žádná adresa pro stažení aktualizace nebyla poskytnuta")
	}

	req, err := http.NewRequestWithContext(context.Background(), "GET", downloadURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "Lab411-VM-Manager")

	client := &http.Client{
		Timeout: 10 * time.Minute,
	}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("stahování selhalo: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("server vrátil chybový kód %d při stahování", resp.StatusCode)
	}

	totalBytes := resp.ContentLength
	tempFile, err := os.CreateTemp("", "lab411-update-*.tmp")
	if err != nil {
		return fmt.Errorf("nepodařilo se vytvořit dočasný soubor: %w", err)
	}
	tempPath := tempFile.Name()
	defer func() {
		tempFile.Close()
		if _, err := os.Stat(tempPath); err == nil {
			_ = os.Remove(tempPath)
		}
	}()

	buffer := make([]byte, 64*1024)
	var downloadedBytes int64
	lastEmit := time.Now()

	wruntime.EventsEmit(a.ctx, "update-progress", UpdateProgress{
		DownloadedBytes: 0,
		TotalBytes:      totalBytes,
		Percentage:      0,
		Status:          "downloading",
	})

	for {
		n, readErr := resp.Body.Read(buffer)
		if n > 0 {
			if _, writeErr := tempFile.Write(buffer[:n]); writeErr != nil {
				return fmt.Errorf("chyba zápisu stažených dat: %w", writeErr)
			}
			downloadedBytes += int64(n)

			if time.Since(lastEmit) > 100*time.Millisecond || downloadedBytes == totalBytes {
				lastEmit = time.Now()
				var pct float64
				if totalBytes > 0 {
					pct = float64(downloadedBytes) / float64(totalBytes) * 100
				}
				wruntime.EventsEmit(a.ctx, "update-progress", UpdateProgress{
					DownloadedBytes: downloadedBytes,
					TotalBytes:      totalBytes,
					Percentage:      pct,
					Status:          "downloading",
				})
			}
		}
		if readErr != nil {
			if readErr == io.EOF {
				break
			}
			return fmt.Errorf("chyba streamu při stahování: %w", readErr)
		}
	}
	_ = tempFile.Close()

	wruntime.EventsEmit(a.ctx, "update-progress", UpdateProgress{
		DownloadedBytes: downloadedBytes,
		TotalBytes:      totalBytes,
		Percentage:      100,
		Status:          "applying",
	})

	execPath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("nelze určit cestu ke spuštěné aplikaci: %w", err)
	}
	execPath, err = filepath.EvalSymlinks(execPath)
	if err != nil {
		return fmt.Errorf("nelze vyhodnotit cestu aplikace: %w", err)
	}

	if runtime.GOOS == "windows" {
		oldPath := execPath + ".old"
		_ = os.Remove(oldPath)
		if err := os.Rename(execPath, oldPath); err != nil {
			return fmt.Errorf("nelze přejmenovat běžící binárku: %w", err)
		}
		if err := copyFile(tempPath, execPath); err != nil {
			_ = os.Rename(oldPath, execPath)
			return fmt.Errorf("nelze zapsat novou binárku do %s: %w", execPath, err)
		}
	} else {
		if err := os.Chmod(tempPath, 0755); err != nil {
			return fmt.Errorf("nelze nastavit práva spustitelnosti: %w", err)
		}
		if err := os.Rename(tempPath, execPath); err != nil {
			if err := copyFile(tempPath, execPath); err != nil {
				return fmt.Errorf("nelze nahradit binárku: %w", err)
			}
			_ = os.Chmod(execPath, 0755)
		}
	}

	wruntime.EventsEmit(a.ctx, "update-progress", UpdateProgress{
		DownloadedBytes: downloadedBytes,
		TotalBytes:      totalBytes,
		Percentage:      100,
		Status:          "ready_to_restart",
	})

	return nil
}

func (a *App) RestartApp() error {
	execPath, err := os.Executable()
	if err != nil {
		return err
	}
	execPath, err = filepath.EvalSymlinks(execPath)
	if err != nil {
		return err
	}

	cmd := exec.Command(execPath)
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("nelze spustit aktualizovanou aplikaci: %w", err)
	}

	go func() {
		time.Sleep(300 * time.Millisecond)
		os.Exit(0)
	}()

	return nil
}
