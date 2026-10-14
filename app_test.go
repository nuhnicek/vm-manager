package main

import (
	"net/http"
	"strings"
	"testing"
	"time"
)

func isBackendAvailable(url string) bool {
	client := &http.Client{Timeout: 500 * time.Millisecond}
	resp, err := client.Get(url + "/ping")
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return true
}

func TestAppLoginAndVerify(t *testing.T) {
	app := NewApp()

	if !isBackendAvailable(app.backendURL) {
		t.Skip("skipping live integration test: backend server is offline")
	}

	_, err := app.Login("invalid@example.com", "wrong")
	if err == nil {
		t.Fatal("expected error for invalid credentials, got nil")
	}

	authRes, err := app.Login("p.beunier.st@spseiostrava.cz", "123")
	if err != nil {
		if strings.Contains(err.Error(), "connection refused") {
			t.Skip("skipping live test: backend connection refused")
		}
		t.Fatalf("login failed: %v", err)
	}
	if authRes.Token == "" {
		t.Fatal("expected non-empty token")
	}
	if authRes.Email != "p.beunier.st@spseiostrava.cz" {
		t.Fatalf("expected email p.beunier.st@spseiostrava.cz, got %s", authRes.Email)
	}

	valid, err := app.VerifySession(authRes.Token)
	if err != nil {
		t.Fatalf("VerifySession error: %v", err)
	}
	if !valid {
		t.Fatal("expected session to be valid")
	}

	invalidValid, err := app.VerifySession("fake-token-12345")
	if err != nil {
		t.Fatalf("VerifySession error: %v", err)
	}
	if invalidValid {
		t.Fatal("expected fake token to be invalid")
	}

	app.Logout()
	if app.authToken != "" || app.userEmail != "" {
		t.Fatal("expected cleared session after logout")
	}
}

func TestAppGetVMsAndTemplatesLive(t *testing.T) {
	app := NewApp()

	_, err := app.GetVMs("")
	if err == nil {
		t.Fatal("expected error when fetching VMs without auth, got nil")
	}

	_, err = app.GetTemplates("")
	if err == nil {
		t.Fatal("expected error when fetching templates without auth, got nil")
	}

	if !isBackendAvailable(app.backendURL) {
		t.Skip("skipping live integration test: backend server is offline")
	}

	authRes, err := app.Login("p.beunier.st@spseiostrava.cz", "123")
	if err != nil {
		if strings.Contains(err.Error(), "connection refused") {
			t.Skip("skipping live test: backend connection refused")
		}
		t.Fatalf("login failed: %v", err)
	}

	vms, err := app.GetVMs(authRes.Token)
	if err != nil {
		t.Fatalf("failed to fetch live VMs: %v", err)
	}
	t.Logf("Fetched %d live VMs from Proxmox", len(vms))
	for _, vm := range vms {
		t.Logf("VM: ID=%d, Name=%s, UUID=%s", vm.ID, vm.Name, vm.UUID)
		if vm.Name == "ubuntu-server-prod" || vm.Name == "windows-dev-box" {
			t.Fatalf("found mock VM %s in live results", vm.Name)
		}
	}

	templates, err := app.GetTemplates(authRes.Token)
	if err != nil {
		t.Fatalf("failed to fetch live templates: %v", err)
	}
	t.Logf("Fetched %d live templates from Proxmox", len(templates))
	for _, tpl := range templates {
		t.Logf("Template: ID=%d, Name=%s, UUID=%s", tpl.ID, tpl.Name, tpl.UUID)
		if tpl.Name == "tpl-ubuntu" || tpl.Name == "tpl-debian" {
			t.Fatalf("found mock template %s in live results", tpl.Name)
		}
	}

	_, err = app.CreateVMFromTemplate("", "9000")
	if err == nil {
		t.Fatal("expected error for empty VM name, got nil")
	}

	_, err = app.CreateVMFromTemplate("test-vm", "non-existent-template")
	if err == nil {
		t.Fatal("expected error for non-existent template ID, got nil")
	}
}
