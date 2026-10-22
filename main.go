package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := NewApp()

	title := "lab411-vm-manager"
	width := 1024
	height := 768

	if app.consoleModeVM != "" {
		title = "Console - " + app.consoleModeVM
		width = 800
		height = 600
	}

	err := wails.Run(&options.App{
		Title:  title,
		Width:  width,
		Height: height,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 11, G: 15, B: 25, A: 1},
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
