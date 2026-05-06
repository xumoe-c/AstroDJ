//go:build !js

// CLI tool to convert osu!mania 4K .osu files to AstroDJ chart.json.
//
// Usage:
//
//	go run ./cmd/convert -input beatmap.osu -output chart.json
package main

import (
	"flag"
	"fmt"
	"os"

	"rhythm/backend/osuconv"
)

func main() {
	input := flag.String("input", "", "Path to .osu file")
	output := flag.String("output", "chart.json", "Output chart.json path")
	flag.Parse()

	if *input == "" {
		fmt.Fprintln(os.Stderr, "Usage: convert -input <file.osu> [-output chart.json]")
		os.Exit(1)
	}

	data, err := os.ReadFile(*input)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading file: %v\n", err)
		os.Exit(1)
	}

	chart, err := osuconv.Convert(string(data))
	if err != nil {
		fmt.Fprintf(os.Stderr, "Conversion error: %v\n", err)
		os.Exit(1)
	}

	jsonData, err := osuconv.ToJSON(chart)
	if err != nil {
		fmt.Fprintf(os.Stderr, "JSON error: %v\n", err)
		os.Exit(1)
	}

	if err := os.WriteFile(*output, jsonData, 0644); err != nil {
		fmt.Fprintf(os.Stderr, "Write error: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Converted: %s → %s\n", *input, *output)
	fmt.Printf("  Title: %s - %s\n", chart.Meta.Artist, chart.Meta.Title)
	fmt.Printf("  Notes: %d\n", len(chart.Segments[0].Notes))
	fmt.Printf("  Length: %dms\n", chart.Meta.Length)
	fmt.Printf("  Rule: %s\n", chart.Segments[0].JudgeRule)
}
