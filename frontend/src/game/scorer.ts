import { Judgement, type Chart, type Segment } from './types'

const JUDGEMENT_SCORES: Record<Judgement, number> = {
    [Judgement.CriticalPerfect]: 320,
    [Judgement.Perfect]: 300,
    [Judgement.Great]: 200,
    [Judgement.Good]: 100,
    [Judgement.Miss]: 0,
}

/**
 * Calculate total number of judgeable notes across all segments in a chart
 */
export function calculateTotalNotes(chart: Chart): number {
    let total = 0
    for (const segment of chart.segments) {
        total += countSegmentNotes(segment)
    }
    return total
}

/**
 * Count judgeable notes in a single segment
 */
function countSegmentNotes(segment: Segment): number {
    switch (segment.mode) {
        case 'mania':
            return segment.notes.length
        case 'taiko':
            // Count only judgeable notes (don, ka, roll end, balloon)
            // Drumroll ticks and balloon hits are bonus, not judgeable
            return segment.notes.length
        case 'osu-standard':
            return segment.notes.length
        default:
            return 0
    }
}

export class GlobalScorer {
    combo = 0
    maxCombo = 0
    counts: Record<number, number> = {
        [Judgement.CriticalPerfect]: 0,
        [Judgement.Perfect]: 0,
        [Judgement.Great]: 0,
        [Judgement.Good]: 0,
        [Judgement.Miss]: 0,
    }
    score = 0
    totalNotes = 0

    // Per-mode stats tracking
    modeStats: Record<string, { judgements: Record<number, number>, count: number, score: number }> = {
        'osu-standard': { judgements: { [Judgement.CriticalPerfect]: 0, [Judgement.Perfect]: 0, [Judgement.Great]: 0, [Judgement.Good]: 0, [Judgement.Miss]: 0 }, count: 0, score: 0 },
        'mania': { judgements: { [Judgement.CriticalPerfect]: 0, [Judgement.Perfect]: 0, [Judgement.Great]: 0, [Judgement.Good]: 0, [Judgement.Miss]: 0 }, count: 0, score: 0 },
        'taiko': { judgements: { [Judgement.CriticalPerfect]: 0, [Judgement.Perfect]: 0, [Judgement.Great]: 0, [Judgement.Good]: 0, [Judgement.Miss]: 0 }, count: 0, score: 0 }
    }

    add(j: Judgement, weight: number = 1, mode?: string): void {
        if (j > Judgement.Miss) { j = Judgement.Miss; }
        if (this.counts[j] === undefined) { this.counts[j] = 0; }
        this.counts[j]++
        const scoreToAdd = (JUDGEMENT_SCORES[j] || 0) * weight
        this.score += scoreToAdd

        if (mode && this.modeStats[mode]) {
            if (this.modeStats[mode].judgements[j] === undefined) this.modeStats[mode].judgements[j] = 0;
            this.modeStats[mode].judgements[j]++
            this.modeStats[mode].count++
            this.modeStats[mode].score += scoreToAdd
        }

        if (j === Judgement.Miss) {
            this.combo = 0
        } else {
            this.combo++
            if (this.combo > this.maxCombo) {
                this.maxCombo = this.combo
            }
        }
    }

    /** Add score without affecting combo or judgement counts (drumroll, balloon) */
    addBonus(points: number): void {
        this.score += points
    }

    get judgedCount(): number {
        let total = 0
        for (const k in this.counts) total += this.counts[k]
        return total
    }

    /**
     * Calculate accuracy percentage based on all judgements across all segments.
     * 
     * Formula: (sum of weighted judgements) / (total judgements * 320)
     * Weights: CriticalPerfect=320, Perfect=300, Great=200, Good=100, Miss=0
     * 
     * This calculation uses all judgements accumulated in this scorer instance,
     * which includes judgements from all segments in a hybrid chart.
     * 
     * @returns Accuracy as a decimal between 0.0 and 1.0 (e.g., 0.95 = 95%)
     */
    get accuracy(): number {
        const total = this.judgedCount
        if (total === 0) return 1.0

        const weighted =
            this.counts[Judgement.CriticalPerfect] * 320 +
            this.counts[Judgement.Perfect] * 300 +
            this.counts[Judgement.Great] * 200 +
            this.counts[Judgement.Good] * 100

        return weighted / (total * 320)
    }

    getModeAccuracy(mode: string): number {
        if (!this.modeStats[mode]) return 1.0
        const stats = this.modeStats[mode]
        const total = stats.count
        if (total === 0) return 1.0

        const weighted =
            stats.judgements[Judgement.CriticalPerfect] * 320 +
            stats.judgements[Judgement.Perfect] * 300 +
            stats.judgements[Judgement.Great] * 200 +
            stats.judgements[Judgement.Good] * 100

        return weighted / (total * 320)
    }

    reset(totalNotes: number): void {
        this.combo = 0
        this.maxCombo = 0
        this.score = 0
        this.totalNotes = totalNotes
        for (const k in this.counts) this.counts[k] = 0

        for (const mode in this.modeStats) {
            this.modeStats[mode].count = 0
            this.modeStats[mode].score = 0
            for (const k in this.modeStats[mode].judgements) {
                this.modeStats[mode].judgements[k] = 0
            }
        }
    }
}
