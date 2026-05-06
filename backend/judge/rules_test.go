package judge

import "testing"

func TestManiaOD8(t *testing.T) {
	tests := []struct {
		delta    float64
		expected int
	}{
		{0, 0},    // Perfect
		{16, 0},   // Perfect boundary
		{16.1, 1}, // Great
		{40, 1},   // Great boundary
		{40.1, 2}, // Good
		{73, 2},   // Good boundary
		{103, 3},  // Ok boundary
		{127, 4},  // Bad boundary
		{188, 5},  // Miss boundary
		{200, 5},  // Miss
	}

	for _, tt := range tests {
		got := Judge("mania-od8", tt.delta)
		if got != tt.expected {
			t.Errorf("Judge(mania-od8, %v) = %d, want %d", tt.delta, got, tt.expected)
		}
	}
}

func TestTaikoNormal(t *testing.T) {
	tests := []struct {
		delta    float64
		expected int
	}{
		{0, 0},    // Perfect/GREAT
		{25, 0},   // GREAT boundary
		{25.1, 2}, // Good/OK
		{75, 2},   // OK boundary
		{75.1, 5}, // Miss
		{200, 5},  // Miss
	}

	for _, tt := range tests {
		got := Judge("taiko-normal", tt.delta)
		if got != tt.expected {
			t.Errorf("Judge(taiko-normal, %v) = %d, want %d", tt.delta, got, tt.expected)
		}
	}
}

func TestNegativeDelta(t *testing.T) {
	got := Judge("mania-od8", -10)
	if got != 0 {
		t.Errorf("Judge(mania-od8, -10) = %d, want 0 (Perfect)", got)
	}
}

func TestUnknownRule(t *testing.T) {
	got := Judge("unknown", 10)
	if got != 5 {
		t.Errorf("Judge(unknown, 10) = %d, want 5 (Miss)", got)
	}
}
