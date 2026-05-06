//go:build js && wasm

// Package main is the WASM entry point exposing validateChart, judge, and convertOsu to JavaScript.
package main

import (
	"math"
	"syscall/js"

	"rhythm/backend/judge"
	"rhythm/backend/osuconv"
	"rhythm/backend/validator"
)

func main() {
	js.Global().Set("validateChart", js.FuncOf(validateChartJS))
	js.Global().Set("judge", js.FuncOf(judgeJS))
	js.Global().Set("convertOsu", js.FuncOf(convertOsuJS))

	// Block forever so callbacks remain alive
	select {}
}

func validateChartJS(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return map[string]any{"ok": false, "error": "validateChart requires 1 argument (json string)"}
	}

	jsonStr := args[0].String()
	ok, errMsg := validator.Validate(jsonStr)
	if !ok {
		return map[string]any{"ok": false, "error": errMsg}
	}
	return map[string]any{"ok": true}
}

func judgeJS(this js.Value, args []js.Value) any {
	if len(args) < 2 {
		return 5 // Miss
	}

	rule := args[0].String()
	delta := math.Abs(args[1].Float())

	return judge.Judge(rule, delta)
}

func convertOsuJS(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return map[string]any{"ok": false, "error": "convertOsu requires 1 argument (osu text string)"}
	}

	osuText := args[0].String()
	chart, err := osuconv.Convert(osuText)
	if err != nil {
		return map[string]any{"ok": false, "error": err.Error()}
	}

	jsonData, err := osuconv.ToJSON(chart)
	if err != nil {
		return map[string]any{"ok": false, "error": "Failed to serialize chart: " + err.Error()}
	}

	return map[string]any{"ok": true, "json": string(jsonData)}
}
