// Package validator validates chart.json structure.
package validator

import (
	"encoding/json"
	"fmt"

	"rhythm/backend/judge"
)

type chartMeta struct {
	Title  string `json:"title"`
	Artist string `json:"artist"`
	Audio  string `json:"audio"`
	Length int    `json:"length"`
}

type segment struct {
	ID        string          `json:"id"`
	StartMs   int             `json:"startMs"`
	EndMs     int             `json:"endMs"`
	Mode      string          `json:"mode"`
	JudgeRule string          `json:"judgeRule"`
	Notes     json.RawMessage `json:"notes"`
	Config    json.RawMessage `json:"config"`
}

type chart struct {
	Meta     chartMeta `json:"meta"`
	Segments []segment `json:"segments"`
}

type maniaNote struct {
	Lane    int  `json:"lane"`
	Time    int  `json:"time"`
	EndTime *int `json:"endTime,omitempty"`
}

type taikoNote struct {
	Type    string `json:"type"`
	Time    int    `json:"time"`
	EndTime *int   `json:"endTime,omitempty"`
	Big     *bool  `json:"big,omitempty"`
	Hits    *int   `json:"hits,omitempty"`
}

// Validate checks a chart JSON string for structural correctness.
func Validate(jsonStr string) (bool, string) {
	var c chart
	if err := json.Unmarshal([]byte(jsonStr), &c); err != nil {
		return false, fmt.Sprintf("JSON parse error: %v", err)
	}

	if c.Meta.Title == "" {
		return false, "meta.title is required"
	}
	if c.Meta.Audio == "" {
		return false, "meta.audio is required"
	}
	if len(c.Segments) == 0 {
		return false, "at least one segment is required"
	}

	for i, seg := range c.Segments {
		if seg.ID == "" {
			return false, fmt.Sprintf("segment[%d]: id is required", i)
		}
		if seg.EndMs <= seg.StartMs {
			return false, fmt.Sprintf("segment[%d] (%s): endMs must be > startMs", i, seg.ID)
		}
		if seg.Mode != "mania" && seg.Mode != "taiko" {
			return false, fmt.Sprintf("segment[%d] (%s): mode must be 'mania' or 'taiko'", i, seg.ID)
		}
		if !judge.HasRule(seg.JudgeRule) {
			return false, fmt.Sprintf("segment[%d] (%s): unknown judgeRule '%s'", i, seg.ID, seg.JudgeRule)
		}

		// Check no overlap with next segment
		if i+1 < len(c.Segments) {
			next := c.Segments[i+1]
			if seg.EndMs > next.StartMs {
				return false, fmt.Sprintf("segment[%d] (%s) overlaps with segment[%d] (%s)", i, seg.ID, i+1, next.ID)
			}
		}

		// Validate notes per mode
		switch seg.Mode {
		case "mania":
			if err := validateManiaNotes(seg.Notes, seg.ID); err != "" {
				return false, err
			}
		case "taiko":
			if err := validateTaikoNotes(seg.Notes, seg.ID); err != "" {
				return false, err
			}
		}
	}

	return true, ""
}

func validateManiaNotes(raw json.RawMessage, segID string) string {
	var notes []maniaNote
	if err := json.Unmarshal(raw, &notes); err != nil {
		return fmt.Sprintf("segment %s: invalid mania notes: %v", segID, err)
	}
	for j, n := range notes {
		if n.Lane < 0 || n.Lane > 3 {
			return fmt.Sprintf("segment %s note[%d]: lane must be 0-3, got %d", segID, j, n.Lane)
		}
		if n.EndTime != nil && *n.EndTime <= n.Time {
			return fmt.Sprintf("segment %s note[%d]: endTime must be > time", segID, j)
		}
	}
	return ""
}

func validateTaikoNotes(raw json.RawMessage, segID string) string {
	var notes []taikoNote
	if err := json.Unmarshal(raw, &notes); err != nil {
		return fmt.Sprintf("segment %s: invalid taiko notes: %v", segID, err)
	}
	validTypes := map[string]bool{"don": true, "ka": true, "roll": true, "balloon": true}
	for j, n := range notes {
		if !validTypes[n.Type] {
			return fmt.Sprintf("segment %s note[%d]: invalid type '%s'", segID, j, n.Type)
		}
		if n.Type == "balloon" && n.Hits == nil {
			return fmt.Sprintf("segment %s note[%d]: balloon must have 'hits' field", segID, j)
		}
		if (n.Type == "roll" || n.Type == "balloon") && n.EndTime == nil {
			return fmt.Sprintf("segment %s note[%d]: %s must have 'endTime'", segID, j, n.Type)
		}
		if n.Big != nil && *n.Big && n.Type != "don" && n.Type != "ka" {
			return fmt.Sprintf("segment %s note[%d]: 'big' only valid for don/ka", segID, j)
		}
	}
	return ""
}
