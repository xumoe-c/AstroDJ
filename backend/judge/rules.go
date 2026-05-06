// Package judge implements judgement rules for mania and taiko modes.
package judge

// Rule defines judgement windows for a specific rule set.
type Rule struct {
	Name    string
	Windows []float64 // ascending ms thresholds per judgement level
	// mania: [16, 40, 73, 103, 127, 188] → Perfect/Great/Good/Ok/Bad/Miss
	// taiko: [25, 75, 108] → Perfect/Good/Miss
}

var rules = map[string]Rule{
	"mania-od8":    {Name: "mania-od8", Windows: []float64{16, 40, 73, 103, 127, 188}},
	"mania-od7":    {Name: "mania-od7", Windows: []float64{16, 43, 76, 106, 130, 188}},
	"mania-od5":    {Name: "mania-od5", Windows: []float64{16, 49, 82, 112, 136, 188}},
	"taiko-normal": {Name: "taiko-normal", Windows: []float64{25, 75, 108}},
	"taiko-hard":   {Name: "taiko-hard", Windows: []float64{20, 60, 100}},
}

// Judge returns the judgement level (0-based) for a given rule and absolute delta in ms.
// For mania: 0=Perfect(300g), 1=Great(300), 2=Good(200), 3=Ok(100), 4=Bad(50), 5=Miss
// For taiko: 0=Perfect(GREAT), 1=(unused), 2=Good(OK), 3-4=(unused), 5=Miss
// The mapping is done by the caller; this function returns the raw window index.
func Judge(ruleName string, delta float64) int {
	if delta < 0 {
		delta = -delta
	}

	r, ok := rules[ruleName]
	if !ok {
		return 5 // Miss for unknown rule
	}

	for i, w := range r.Windows {
		if delta <= w {
			return mapIndex(ruleName, i)
		}
	}

	return 5 // Miss
}

// HasRule checks if a rule name is registered.
func HasRule(name string) bool {
	_, ok := rules[name]
	return ok
}

func mapIndex(ruleName string, windowIdx int) int {
	// Taiko has 3 windows mapping to: Perfect(0), Good(2), Miss(5)
	if len(ruleName) >= 5 && ruleName[:5] == "taiko" {
		switch windowIdx {
		case 0:
			return 0 // Perfect / GREAT
		case 1:
			return 2 // Good / OK
		default:
			return 5 // Miss
		}
	}
	// Mania: direct 1:1 mapping (0-5)
	if windowIdx > 5 {
		return 5
	}
	return windowIdx
}
