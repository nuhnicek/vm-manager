package main

import (
	"context"
	"fmt"
	"math/rand"
	"os"
	"os/exec"
	"time"

	"github.com/creack/pty"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// VMConnection represents a point-to-point link between two VMs
type VMConnection struct {
	TargetVMID string `json:"target_vm_id"`
	LocalNIC   string `json:"local_nic"`
	TargetNIC  string `json:"target_nic"`
}

// VM represents a virtual machine's current state
type VM struct {
	ID            string         `json:"id"`
	Name          string         `json:"name"`
	Status        string         `json:"status"` // "Running", "Stopped"
	RAM           int            `json:"ram_mb"`
	AvailableNICs []string       `json:"available_nics"`
	Connections   []VMConnection `json:"connections"`
}

// Template represents a VM template
type Template struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	RAM  int    `json:"ram_mb"`
}

// App application struct
type App struct {
	ctx           context.Context
	vms           []VM
	templates     []Template
	consoleModeVM string
	ptyFile       *os.File
}

// NewApp creates a new App application struct
func NewApp() *App {
	rand.Seed(time.Now().UnixNano())
	
	// Check if we are running in console mode
	consoleVM := ""
	args := os.Args
	for i, arg := range args {
		if arg == "--console" && i+1 < len(args) {
			consoleVM = args[i+1]
			break
		}
	}

	return &App{
		consoleModeVM: consoleVM,
		// Mock database of VMs
		vms: []VM{
			{ID: "vm-101", Name: "ubuntu-server-prod", Status: "Running", RAM: 4096, AvailableNICs: []string{"net0", "net1"}, Connections: []VMConnection{}},
			{ID: "vm-102", Name: "windows-dev-box", Status: "Stopped", RAM: 8192, AvailableNICs: []string{"net0"}, Connections: []VMConnection{}},
			{ID: "vm-103", Name: "k3s-control-plane", Status: "Running", RAM: 2048, AvailableNICs: []string{"net0"}, Connections: []VMConnection{}},
		},
		templates: []Template{
			{ID: "tpl-ubuntu", Name: "Ubuntu 22.04 LTS", RAM: 2048},
			{ID: "tpl-windows", Name: "Windows 11 Pro", RAM: 8192},
			{ID: "tpl-alpine", Name: "Alpine Linux", RAM: 512},
			{ID: "tpl-debian", Name: "Debian 12", RAM: 1024},
		},
	}
}

// GetLaunchedConsoleVM returns the VM name if the app was launched in console mode
func (a *App) GetLaunchedConsoleVM() string {
	return a.consoleModeVM
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// GetVMs returns the list of all VMs to the frontend
func (a *App) GetVMs() []VM {
	return a.vms
}

// GetTemplates returns the list of all templates to the frontend
func (a *App) GetTemplates() []Template {
	return a.templates
}

// StartVM simulates starting a VM
func (a *App) StartVM(id string) (string, error) {
	for i, vm := range a.vms {
		if vm.ID == id {
			if vm.Status == "Running" {
				return "", fmt.Errorf("VM %s is already running", vm.Name)
			}
			a.vms[i].Status = "Running"
			return fmt.Sprintf("Successfully started %s", vm.Name), nil
		}
	}
	return "", fmt.Errorf("VM %s not found", id)
}

// StopVM simulates stopping a VM
func (a *App) StopVM(id string) (string, error) {
	for i, vm := range a.vms {
		if vm.ID == id {
			if vm.Status == "Stopped" {
				return "", fmt.Errorf("VM %s is already stopped", vm.Name)
			}
			a.vms[i].Status = "Stopped"
			return fmt.Sprintf("Successfully stopped %s", vm.Name), nil
		}
	}
	return "", fmt.Errorf("VM %s not found", id)
}

// DeleteVM simulates deleting a VM
func (a *App) DeleteVM(id string) (string, error) {
	for i, vm := range a.vms {
		if vm.ID == id {
			a.vms = append(a.vms[:i], a.vms[i+1:]...)
			return fmt.Sprintf("Successfully deleted %s", vm.Name), nil
		}
	}
	return "", fmt.Errorf("VM %s not found", id)
}

// OpenConsole Window spawns a new instance of the application in console mode
func (a *App) OpenConsole(id string) (string, error) {
	var vmName string
	for _, vm := range a.vms {
		if vm.ID == id {
			if vm.Status != "Running" {
				return "", fmt.Errorf("cannot open console for stopped VM %s", vm.Name)
			}
			vmName = vm.Name
			break
		}
	}
	
	if vmName == "" {
		return "", fmt.Errorf("VM %s not found", id)
	}

	executable, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("failed to get executable path: %v", err)
	}

	cmd := exec.Command(executable, "--console", vmName)
	err = cmd.Start()
	if err != nil {
		return "", fmt.Errorf("failed to open console window: %v", err)
	}

	return fmt.Sprintf("Console opened for %s", vmName), nil
}

// CreateVMFromTemplate creates a new VM based on a template
func (a *App) CreateVMFromTemplate(name string, templateID string) (*VM, error) {
	if name == "" {
		return nil, fmt.Errorf("VM name cannot be empty")
	}

	var selectedTpl *Template
	for _, tpl := range a.templates {
		if tpl.ID == templateID {
			selectedTpl = &tpl
			break
		}
	}

	if selectedTpl == nil {
		return nil, fmt.Errorf("template %s not found", templateID)
	}

	newVM := VM{
		ID:            fmt.Sprintf("vm-%d", rand.Intn(10000)+200),
		Name:          name,
		Status:        "Stopped",
		RAM:           selectedTpl.RAM,
		AvailableNICs: []string{"net0"},
		Connections:   []VMConnection{},
	}

	a.vms = append(a.vms, newVM)
	return &newVM, nil
}

// StartPTY starts a real shell session and pipes its output to wails events
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

	// Read from pty and emit
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

// WritePTY writes data to the active PTY
func (a *App) WritePTY(data string) {
	if a.ptyFile != nil {
		a.ptyFile.Write([]byte(data))
	}
}

// ResizePTY resizes the active PTY
func (a *App) ResizePTY(rows, cols uint16) {
	if a.ptyFile != nil {
		pty.Setsize(a.ptyFile, &pty.Winsize{
			Rows: rows,
			Cols: cols,
		})
	}
}

// AddNIC adds a new NIC to a VM
func (a *App) AddNIC(id string) (string, error) {
	for i, vm := range a.vms {
		if vm.ID == id {
			newNIC := fmt.Sprintf("net%d", len(vm.AvailableNICs))
			a.vms[i].AvailableNICs = append(a.vms[i].AvailableNICs, newNIC)
			return fmt.Sprintf("Added %s to %s", newNIC, vm.Name), nil
		}
	}
	return "", fmt.Errorf("VM %s not found", id)
}

// ConnectVMs links two VMs together using specific NICs
func (a *App) ConnectVMs(id1, nic1, id2, nic2 string) (string, error) {
	if id1 == id2 {
		return "", fmt.Errorf("cannot connect a VM to itself")
	}
	
	var vm1Idx, vm2Idx = -1, -1
	for i, vm := range a.vms {
		if vm.ID == id1 {
			vm1Idx = i
		} else if vm.ID == id2 {
			vm2Idx = i
		}
	}

	if vm1Idx == -1 || vm2Idx == -1 {
		return "", fmt.Errorf("one or both VMs not found")
	}

	// Connect 1 -> 2
	a.vms[vm1Idx].Connections = append(a.vms[vm1Idx].Connections, VMConnection{
		TargetVMID: id2,
		LocalNIC:   nic1,
		TargetNIC:  nic2,
	})

	// Connect 2 -> 1
	a.vms[vm2Idx].Connections = append(a.vms[vm2Idx].Connections, VMConnection{
		TargetVMID: id1,
		LocalNIC:   nic2,
		TargetNIC:  nic1,
	})

	return fmt.Sprintf("Connected: %s (%s) <--> %s (%s)", a.vms[vm1Idx].Name, nic1, a.vms[vm2Idx].Name, nic2), nil
}

// DisconnectVMs unlinks two VMs
func (a *App) DisconnectVMs(id1, id2 string) (string, error) {
	for i, vm := range a.vms {
		if vm.ID == id1 {
			var newConns []VMConnection
			for _, conn := range vm.Connections {
				if conn.TargetVMID != id2 {
					newConns = append(newConns, conn)
				}
			}
			a.vms[i].Connections = newConns
		} else if vm.ID == id2 {
			var newConns []VMConnection
			for _, conn := range vm.Connections {
				if conn.TargetVMID != id1 {
					newConns = append(newConns, conn)
				}
			}
			a.vms[i].Connections = newConns
		}
	}
	return "Successfully disconnected VMs", nil
}


