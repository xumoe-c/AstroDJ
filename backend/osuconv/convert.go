// Package osuconv converts osu!mania 4K .osu files to AstroDJ chart.json format.
package osuconv

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
)

// Chart is the AstroDJ chart.json structure.
type Chart struct {
	Meta     Meta      `json:"meta"`
	Segments []Segment `json:"segments"`
}

type Meta struct {
	Title  string `json:"title"`
	Artist string `json:"artist"`
	Audio  string `json:"audio"`
	Length int    `json:"length"`
}

type Segment struct {
	ID        string      `json:"id"`
	StartMs   int         `json:"startMs"`
	EndMs     int         `json:"endMs"`
	Mode      string      `json:"mode"`
	JudgeRule string      `json:"judgeRule"`
	Config    ManiaConfig `json:"config"`
	Notes     []ManiaNote `json:"notes"`
}

type ManiaConfig struct {
	Keys        []string `json:"keys"`
	ScrollSpeed float64  `json:"scrollSpeed"`
}

type ManiaNote struct {
	Lane    int  `json:"lane"`
	Time    int  `json:"time"`
	EndTime *int `json:"endTime,omitempty"`
}

// Convert parses an osu!mania 4K .osu file and returns a Chart.
func Convert(osuText string) (*Chart, error) {
	scanner := bufio.NewScanner(strings.NewReader(osuText))

	var (
		section       string
		audioFilename string
		title         string
		artist        string
		od            float64
		cs            float64
		notes         []ManiaNote
	)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "//") {
			continue
		}

		if strings.HasPrefix(line, "[") {
			section = line
			continue
		}

		switch section {
		case "[General]":
			if k, v, ok := parseKV(line); ok && k == "AudioFilename" {
				audioFilename = v
			}
		case "[Metadata]":
			if k, v, ok := parseKV(line); ok {
				switch k {
				case "Title":
					title = v
				case "Artist":
					artist = v
				}
			}
		case "[Difficulty]":
			if k, v, ok := parseKV(line); ok {
				switch k {
				case "OverallDifficulty":
					od, _ = strconv.ParseFloat(v, 64)
				case "CircleSize":
					cs, _ = strconv.ParseFloat(v, 64)
				}
			}
		case "[HitObjects]":
			note, err := parseHitObject(line)
			if err == nil {
				notes = append(notes, note)
			}
		}
	}

	if int(cs) != 4 {
		return nil, fmt.Errorf("only 4K beatmaps supported (CircleSize=%v)", cs)
	}

	if len(notes) == 0 {
		return nil, errors.New("no hit objects found")
	}

	// Sort by time
	sort.Slice(notes, func(i, j int) bool {
		return notes[i].Time < notes[j].Time
	})

	// Determine length (last note end or time + 2000ms buffer)
	lastTime := notes[len(notes)-1].Time
	for _, n := range notes {
		if n.EndTime != nil && *n.EndTime > lastTime {
			lastTime = *n.EndTime
		}
	}
	length := lastTime + 2000

	// Determine judge rule from OD
	judgeRule := odToRule(od)

	chart := &Chart{
		Meta: Meta{
			Title:  title,
			Artist: artist,
			Audio:  audioFilename,
			Length: length,
		},
		Segments: []Segment{
			{
				ID:        "main",
				StartMs:   0,
				EndMs:     length,
				Mode:      "mania",
				JudgeRule: judgeRule,
				Config: ManiaConfig{
					Keys:        []string{"D", "F", "J", "K"},
					ScrollSpeed: 0.8,
				},
				Notes: notes,
			},
		},
	}

	return chart, nil
}

// ToJSON serializes a Chart to indented JSON.
func ToJSON(chart *Chart) ([]byte, error) {
	return json.MarshalIndent(chart, "", "  ")
}

func odToRule(od float64) string {
	switch {
	case od >= 8:
		return "mania-od8"
	case od >= 7:
		return "mania-od7"
	default:
		return "mania-od5"
	}
}

func parseKV(line string) (key, value string, ok bool) {
	idx := strings.Index(line, ":")
	if idx < 0 {
		return "", "", false
	}
	return strings.TrimSpace(line[:idx]), strings.TrimSpace(line[idx+1:]), true
}

func parseHitObject(line string) (ManiaNote, error) {
	parts := strings.Split(line, ",")
	if len(parts) < 4 {
		return ManiaNote{}, errors.New("too few fields")
	}

	x, err := strconv.Atoi(parts[0])
	if err != nil {
		return ManiaNote{}, err
	}

	time, err := strconv.Atoi(parts[2])
	if err != nil {
		return ManiaNote{}, err
	}

	typeVal, err := strconv.Atoi(parts[3])
	if err != nil {
		return ManiaNote{}, err
	}

	column := x * 4 / 512
	if column < 0 {
		column = 0
	}
	if column > 3 {
		column = 3
	}

	note := ManiaNote{
		Lane: column,
		Time: time,
	}

	// Long note: type & 128 != 0
	if typeVal&128 != 0 && len(parts) >= 6 {
		endParts := strings.Split(parts[5], ":")
		if len(endParts) > 0 {
			endTime, err := strconv.Atoi(endParts[0])
			if err == nil && endTime > time {
				note.EndTime = &endTime
			}
		}
	}

	return note, nil
}
