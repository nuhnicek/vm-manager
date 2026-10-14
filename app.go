package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"time"

	"github.com/creack/pty"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type AuthResult struct {
	Token string `json:"token"`
	Email string `json:"email"`
}

type VMConnection struct {
	TargetVMID string `json:"target_vm_id"`
	LocalNIC   string `json:"local_nic"`
	TargetNIC  string `json:"target_nic"`
}

type VM struct {
	ID            uint64         `json:"id"`
	UUID          string         `json:"uuid,omitempty"`
	Name          string         `json:"name"`
	Status        string         `json:"status,omitempty"`
	RAM           int            `json:"ram_mb,omitempty"`
	Networks      []string       `json:"networks,omitempty"`
	AvailableNICs []string       `json:"available_nics,omitempty"`
	Connections   []VMConnection `json:"connections,omitempty"`
}

type Template struct {
	ID   uint64 `json:"id"`
	UUID string `json:"uuid,omitempty"`
	Name string `json:"name"`
}

func vmMatches(vm VM, id string) bool {
	return fmt.Sprintf("%d", vm.ID) == id || vm.UUID == id || vm.Name == id
}

func (a *App) getNumericVMID(id string) (int, string, error) {
	for _, vm := range a.vms {
		if vmMatches(vm, id) {
			return int(vm.ID), vm.Name, nil
		}
	}
	if num, err := strconv.Atoi(id); err == nil {
		return num, id, nil
	}
	return 0, "", fmt.Errorf("VM %s not found", id)
}

type App struct {
	ctx              context.Context
	vms              []VM
	templates        []Template
	consoleModeID    string
	consoleModeVM    string
	consoleModeToken string
	ptyFile          *os.File
	backendURL       string
	authToken        string
	userEmail        string
}

func NewApp() *App {
	consoleID := ""
	consoleVM := ""
	consoleToken := ""
	args := os.Args
	for i, arg := range args {
		if arg == "--console" && i+1 < len(args) {
			consoleID = args[i+1]
		}
		if arg == "--name" && i+1 < len(args) {
			consoleVM = args[i+1]
		}
		if arg == "--token" && i+1 < len(args) {
			consoleToken = args[i+1]
		}
	}
	if consoleVM == "" {
		consoleVM = consoleID
	}

	backendURL := os.Getenv("BACKEND_URL")
	if backendURL == "" {
		backendURL = "http://localhost:8080"
	}

	return &App{
		consoleModeID:    consoleID,
		consoleModeVM:    consoleVM,
		consoleModeToken: consoleToken,
		backendURL:       backendURL,
		vms:              []VM{},
		templates:        []Template{},
	}
}

func (a *App) GetLaunchedConsoleVM() string {
	return a.consoleModeVM
}

func (a *App) GetConsoleParams() map[string]string {
	return map[string]string{
		"id":    a.consoleModeID,
		"name":  a.consoleModeVM,
		"token": a.consoleModeToken,
	}
}

func (a *App) GetBackendURL() string {
	return a.backendURL
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) GetVMs(token string) ([]VM, error) {
	if token == "" {
		token = a.authToken
	}
	if token == "" {
		return []VM{}, fmt.Errorf("unauthorized: missing token")
	}

	req, err := http.NewRequest("GET", a.backendURL+"/vms", nil)
	if err != nil {
		return []VM{}, err
	}
	req.Header.Set("Authorization", token)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return []VM{}, fmt.Errorf("failed to reach backend at %s: %v", a.backendURL, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return []VM{}, fmt.Errorf("session expired or unauthorized")
	}
	if resp.StatusCode != http.StatusOK {
		return []VM{}, fmt.Errorf("failed to fetch VMs: status %d", resp.StatusCode)
	}

	var fetchedVMs []VM
	if err := json.NewDecoder(resp.Body).Decode(&fetchedVMs); err != nil {
		return []VM{}, fmt.Errorf("failed to parse VMs: %w", err)
	}
	if fetchedVMs == nil {
		fetchedVMs = []VM{}
	}

	a.vms = fetchedVMs
	return fetchedVMs, nil
}

func (a *App) GetTemplates(token string) ([]Template, error) {
	if token == "" {
		token = a.authToken
	}
	if token == "" {
		return []Template{}, fmt.Errorf("unauthorized: missing token")
	}

	req, err := http.NewRequest("GET", a.backendURL+"/vms/templates", nil)
	if err != nil {
		return []Template{}, err
	}
	req.Header.Set("Authorization", token)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return []Template{}, fmt.Errorf("failed to reach backend at %s: %v", a.backendURL, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return []Template{}, fmt.Errorf("session expired or unauthorized")
	}
	if resp.StatusCode != http.StatusOK {
		return []Template{}, fmt.Errorf("failed to fetch templates: status %d", resp.StatusCode)
	}

	var fetchedTemplates []Template
	if err := json.NewDecoder(resp.Body).Decode(&fetchedTemplates); err != nil {
		return []Template{}, fmt.Errorf("failed to parse templates: %w", err)
	}
	if fetchedTemplates == nil {
		fetchedTemplates = []Template{}
	}
	a.templates = fetchedTemplates
	return fetchedTemplates, nil
}

func (a *App) StartVM(id string) (string, error) {
	vmid, vmName, err := a.getNumericVMID(id)
	if err != nil {
		return "", err
	}
	if a.authToken == "" {
		return "", fmt.Errorf("unauthorized: missing token")
	}

	payload := map[string]int{"id": vmid}
	bodyBytes, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", a.backendURL+"/vms/start", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", a.authToken)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to reach backend at %s: %v", a.backendURL, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errData struct {
			Error string `json:"error"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&errData)
		if errData.Error != "" {
			return "", fmt.Errorf("start failed: %s", errData.Error)
		}
		return "", fmt.Errorf("failed to start VM (status %d)", resp.StatusCode)
	}

	return fmt.Sprintf("Successfully started %s", vmName), nil
}

func (a *App) StopVM(id string) (string, error) {
	vmid, vmName, err := a.getNumericVMID(id)
	if err != nil {
		return "", err
	}
	if a.authToken == "" {
		return "", fmt.Errorf("unauthorized: missing token")
	}

	payload := map[string]int{"id": vmid}
	bodyBytes, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", a.backendURL+"/vms/stop", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", a.authToken)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to reach backend at %s: %v", a.backendURL, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errData struct {
			Error string `json:"error"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&errData)
		if errData.Error != "" {
			return "", fmt.Errorf("stop failed: %s", errData.Error)
		}
		return "", fmt.Errorf("failed to stop VM (status %d)", resp.StatusCode)
	}

	return fmt.Sprintf("Successfully stopped %s", vmName), nil
}

func (a *App) DeleteVM(id string) (string, error) {
	vmid, vmName, err := a.getNumericVMID(id)
	if err != nil {
		return "", err
	}
	if a.authToken == "" {
		return "", fmt.Errorf("unauthorized: missing token")
	}

	payload := map[string]int{"id": vmid}
	bodyBytes, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", a.backendURL+"/vms/delete", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", a.authToken)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to reach backend at %s: %v", a.backendURL, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errData struct {
			Error string `json:"error"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&errData)
		if errData.Error != "" {
			return "", fmt.Errorf("delete failed: %s", errData.Error)
		}
		return "", fmt.Errorf("failed to delete VM (status %d)", resp.StatusCode)
	}

	return fmt.Sprintf("Successfully deleted %s", vmName), nil
}

func (a *App) OpenConsole(id string) (string, error) {
	vmid, vmName, err := a.getNumericVMID(id)
	if err != nil {
		return "", err
	}

	executable, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("failed to get executable path: %v", err)
	}

	cmd := exec.Command(executable,
		"--console", fmt.Sprintf("%d", vmid),
		"--name", vmName,
		"--token", a.authToken,
	)
	cmd.Env = append(os.Environ(),
		"BACKEND_URL="+a.backendURL,
	)
	err = cmd.Start()
	if err != nil {
		return "", fmt.Errorf("failed to open console window: %v", err)
	}

	return fmt.Sprintf("Console opened for %s", vmName), nil
}

func (a *App) CreateVMFromTemplate(name string, templateID string) (*VM, error) {
	if name == "" {
		return nil, fmt.Errorf("VM name cannot be empty")
	}
	if a.authToken == "" {
		return nil, fmt.Errorf("unauthorized: missing token")
	}

	var selectedTplID int
	if id, err := strconv.Atoi(templateID); err == nil {
		selectedTplID = id
	} else {
		for _, tpl := range a.templates {
			if fmt.Sprintf("%d", tpl.ID) == templateID || tpl.Name == templateID || tpl.UUID == templateID {
				selectedTplID = int(tpl.ID)
				break
			}
		}
	}

	if selectedTplID == 0 {
		return nil, fmt.Errorf("invalid template ID: %s", templateID)
	}

	payload := map[string]interface{}{
		"name":        name,
		"template_id": selectedTplID,
	}
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to encode create VM request: %w", err)
	}

	req, err := http.NewRequest("POST", a.backendURL+"/vms/create", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", a.authToken)

	client := &http.Client{Timeout: 3 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to reach backend at %s: %v", a.backendURL, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return nil, fmt.Errorf("session expired or unauthorized")
	}
	if resp.StatusCode == http.StatusBadRequest {
		return nil, fmt.Errorf("invalid VM creation request")
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to create VM: status %d", resp.StatusCode)
	}

	var vmUUID string
	_ = json.NewDecoder(resp.Body).Decode(&vmUUID)

	newVM := &VM{
		Name: name,
		UUID: vmUUID,
	}
	return newVM, nil
}

func (a *App) StartPTY() error {
	if a.consoleModeVM == "" {
		return fmt.Errorf("not in console mode")
	}

	shell := os.Getenv("SHELL")
	if shell == "" {
		shell = "sh"
	}
	c := exec.Command(shell)

	ptmx, err := pty.Start(c)
	if err != nil {
		return fmt.Errorf("failed to start pty: %v", err)
	}
	a.ptyFile = ptmx

	go func() {
		buf := make([]byte, 1024)
		for {
			n, err := ptmx.Read(buf)
			if err != nil {
				break
			}
			runtime.EventsEmit(a.ctx, "pty-data", string(buf[:n]))
		}
	}()
	return nil
}

func (a *App) WritePTY(data string) {
	if a.ptyFile != nil {
		a.ptyFile.Write([]byte(data))
	}
}

func (a *App) ResizePTY(rows, cols uint16) {
	if a.ptyFile != nil {
		pty.Setsize(a.ptyFile, &pty.Winsize{
			Rows: rows,
			Cols: cols,
		})
	}
}

func (a *App) AddNIC(id string) (string, error) {
	vmid, vmName, err := a.getNumericVMID(id)
	if err != nil {
		return "", err
	}
	if a.authToken == "" {
		return "", fmt.Errorf("unauthorized: missing token")
	}

	payload := map[string]int{"vmid": vmid}
	bodyBytes, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", a.backendURL+"/vms/network/add-nic", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", a.authToken)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to add NIC: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errData struct {
			Error string `json:"error"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&errData)
		if errData.Error != "" {
			return "", fmt.Errorf("add NIC failed: %s", errData.Error)
		}
		return "", fmt.Errorf("failed to add NIC (status %d)", resp.StatusCode)
	}

	var res struct {
		Nic string `json:"nic"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&res)

	return fmt.Sprintf("Added %s to %s", res.Nic, vmName), nil
}

func (a *App) RemoveNIC(id string, nic string) (string, error) {
	vmid, vmName, err := a.getNumericVMID(id)
	if err != nil {
		return "", err
	}
	if a.authToken == "" {
		return "", fmt.Errorf("unauthorized: missing token")
	}

	payload := map[string]interface{}{"vmid": vmid, "nic": nic}
	bodyBytes, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", a.backendURL+"/vms/network/remove", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", a.authToken)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to remove NIC: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errData struct {
			Error string `json:"error"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&errData)
		if errData.Error != "" {
			return "", fmt.Errorf("remove NIC failed: %s", errData.Error)
		}
		return "", fmt.Errorf("failed to remove NIC (status %d)", resp.StatusCode)
	}

	return fmt.Sprintf("Removed %s from %s", nic, vmName), nil
}

func (a *App) ConnectVMs(id1, nic1, id2, nic2 string) (string, error) {
	vmid1, vmName1, err := a.getNumericVMID(id1)
	if err != nil {
		return "", err
	}
	vmid2, vmName2, err := a.getNumericVMID(id2)
	if err != nil {
		return "", err
	}
	if vmid1 == vmid2 {
		return "", fmt.Errorf("cannot connect a VM to itself")
	}
	if a.authToken == "" {
		return "", fmt.Errorf("unauthorized: missing token")
	}

	payload := map[string]interface{}{
		"vmid1": vmid1,
		"vmid2": vmid2,
		"nic1":  nic1,
		"nic2":  nic2,
	}
	bodyBytes, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", a.backendURL+"/vms/network/create", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", a.authToken)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to connect VMs: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errData struct {
			Error string `json:"error"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&errData)
		if errData.Error != "" {
			return "", fmt.Errorf("connection failed: %s", errData.Error)
		}
		return "", fmt.Errorf("failed to connect VMs (status %d)", resp.StatusCode)
	}

	return fmt.Sprintf("Connected %s (%s) <--> %s (%s)", vmName1, nic1, vmName2, nic2), nil
}

func (a *App) DisconnectVMs(id1, id2 string) (string, error) {
	vmid1, vmName1, err := a.getNumericVMID(id1)
	if err != nil {
		return "", err
	}
	vmid2, vmName2, err := a.getNumericVMID(id2)
	if err != nil {
		return "", err
	}
	if a.authToken == "" {
		return "", fmt.Errorf("unauthorized: missing token")
	}

	payload := map[string]int{
		"vmid1": vmid1,
		"vmid2": vmid2,
	}
	bodyBytes, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", a.backendURL+"/vms/network/disconnect", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", a.authToken)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to disconnect VMs: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errData struct {
			Error string `json:"error"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&errData)
		if errData.Error != "" {
			return "", fmt.Errorf("disconnect failed: %s", errData.Error)
		}
		return "", fmt.Errorf("failed to disconnect VMs (status %d)", resp.StatusCode)
	}

	return fmt.Sprintf("Disconnected %s and %s", vmName1, vmName2), nil
}

func (a *App) Login(email, password string) (*AuthResult, error) {
	if email == "" || password == "" {
		return nil, fmt.Errorf("email and password cannot be empty")
	}

	payload := map[string]string{
		"email":    email,
		"password": password,
	}
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to encode login request: %w", err)
	}

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Post(a.backendURL+"/auth/login", "application/json", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to reach backend at %s: %v", a.backendURL, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		var respData struct {
			Token string `json:"token"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&respData); err != nil {
			return nil, fmt.Errorf("failed to parse login response: %w", err)
		}
		if respData.Token == "" {
			return nil, fmt.Errorf("backend returned empty token")
		}

		a.authToken = respData.Token
		a.userEmail = email
		return &AuthResult{
			Token: respData.Token,
			Email: email,
		}, nil
	}

	if resp.StatusCode == http.StatusBadRequest {
		return nil, fmt.Errorf("invalid login request format")
	}

	if resp.StatusCode == http.StatusInternalServerError {
		return nil, fmt.Errorf("invalid email or password")
	}

	return nil, fmt.Errorf("login failed with status %d", resp.StatusCode)
}

func (a *App) VerifySession(token string) (bool, error) {
	if token == "" {
		return false, nil
	}

	req, err := http.NewRequest("GET", a.backendURL+"/ping", nil)
	if err != nil {
		return false, err
	}
	req.Header.Set("Authorization", token)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return false, fmt.Errorf("failed to reach backend at %s: %v", a.backendURL, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		a.authToken = token
		return true, nil
	}
	return false, nil
}

func (a *App) Logout() {
	a.authToken = ""
	a.userEmail = ""
}
