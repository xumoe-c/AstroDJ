import type { Chart, Segment, ManiaSegment, TaikoSegment, OsuStandardSegment, ManiaNote, TaikoNote, OsuNote } from './types'
import { isManiaSegment, isTaikoSegment, isOsuStandardSegment } from './types'

/**
 * ChartConverter interface for transforming and manipulating hybrid rhythm game charts
 */
export interface ChartConverter {
    singleToHybrid(chart: Chart): Chart
    splitSegment(chart: Chart, segmentId: string, splitTimeMs: number): Chart
    mergeSegments(chart: Chart, segmentIds: string[]): Chart
    addSegment(chart: Chart, segment: Segment): Chart
}

/**
 * Implementation of ChartConverter with format conversion and segment manipulation utilities
 * 
 * **Validates: Requirements 10.1, 10.5, 10.9, 10.10**
 */
export class ChartConverterImpl implements ChartConverter {
    /**
     * Convert a single-mode chart to hybrid format with one segment
     * This is a no-op for charts that are already in hybrid format
     * @param chart - Chart to convert
     * @returns Chart in hybrid format (may be the same object if already hybrid)
     */
    singleToHybrid(chart: Chart): Chart {
        // Chart is already in hybrid format (all charts use the same structure)
        // This method exists for API completeness and future compatibility
        return chart
    }

    /**
     * Split a segment at the specified time into two segments
     * Notes are distributed based on their time values
     * @param chart - Chart containing the segment to split
     * @param segmentId - ID of the segment to split
     * @param splitTimeMs - Time in milliseconds where the split should occur
     * @returns New chart with the segment split into two
     * @throws Error if segment not found or splitTime is outside segment bounds
     */
    splitSegment(chart: Chart, segmentId: string, splitTimeMs: number): Chart {
        const segmentIndex = chart.segments.findIndex(s => s.id === segmentId)
        if (segmentIndex === -1) {
            throw new Error(`Segment with id "${segmentId}" not found`)
        }

        const segment = chart.segments[segmentIndex]
        
        // Validate split time is within segment bounds
        if (splitTimeMs <= segment.startMs || splitTimeMs >= segment.endMs) {
            throw new Error(`Split time ${splitTimeMs}ms must be between segment start (${segment.startMs}ms) and end (${segment.endMs}ms)`)
        }

        // Create two new segments
        const segment1 = this.createSegmentCopy(segment, segment.startMs, splitTimeMs, `${segmentId}-1`)
        const segment2 = this.createSegmentCopy(segment, splitTimeMs, segment.endMs, `${segmentId}-2`)

        // Distribute notes based on time
        const { notes1, notes2 } = this.splitNotes(segment, splitTimeMs)
        segment1.notes = notes1 as any
        segment2.notes = notes2 as any

        // Create new segments array with the split segments
        const newSegments = [
            ...chart.segments.slice(0, segmentIndex),
            segment1,
            segment2,
            ...chart.segments.slice(segmentIndex + 1)
        ]

        return {
            ...chart,
            segments: newSegments
        }
    }

    /**
     * Merge multiple adjacent segments into a single segment
     * Segments must be of the same mode and adjacent in time
     * @param chart - Chart containing the segments to merge
     * @param segmentIds - Array of segment IDs to merge (must be adjacent)
     * @returns New chart with segments merged
     * @throws Error if segments are not adjacent, not same mode, or not found
     */
    mergeSegments(chart: Chart, segmentIds: string[]): Chart {
        if (segmentIds.length < 2) {
            throw new Error('Must provide at least 2 segment IDs to merge')
        }

        // Find all segments
        const segments = segmentIds.map(id => {
            const seg = chart.segments.find(s => s.id === id)
            if (!seg) {
                throw new Error(`Segment with id "${id}" not found`)
            }
            return seg
        })

        // Sort segments by start time
        const sortedSegments = [...segments].sort((a, b) => a.startMs - b.startMs)

        // Validate all segments are the same mode
        const firstMode = sortedSegments[0].mode
        if (!sortedSegments.every(s => s.mode === firstMode)) {
            throw new Error('All segments must be the same mode to merge')
        }

        // Validate segments are adjacent (no gaps or overlaps)
        for (let i = 0; i < sortedSegments.length - 1; i++) {
            const current = sortedSegments[i]
            const next = sortedSegments[i + 1]
            if (current.endMs !== next.startMs) {
                throw new Error(`Segments "${current.id}" and "${next.id}" are not adjacent (gap or overlap detected)`)
            }
        }

        // Create merged segment
        const firstSegment = sortedSegments[0]
        const lastSegment = sortedSegments[sortedSegments.length - 1]
        const mergedId = segmentIds.join('-')

        const mergedSegment = this.createSegmentCopy(
            firstSegment,
            firstSegment.startMs,
            lastSegment.endMs,
            mergedId
        )

        // Combine all notes from all segments
        const allNotes = sortedSegments.flatMap(s => this.getSegmentNotes(s))
        mergedSegment.notes = allNotes as any

        // Create new segments array with merged segment
        const segmentIdsSet = new Set(segmentIds)
        const newSegments = chart.segments
            .filter(s => !segmentIdsSet.has(s.id))
            .concat(mergedSegment)
            .sort((a, b) => a.startMs - b.startMs)

        return {
            ...chart,
            segments: newSegments
        }
    }

    /**
     * Add a new segment to the chart
     * The segment is inserted in the correct position based on start time
     * @param chart - Chart to add segment to
     * @param segment - Segment to add
     * @returns New chart with segment added
     * @throws Error if segment overlaps with existing segments
     */
    addSegment(chart: Chart, segment: Segment): Chart {
        // Check for overlaps with existing segments
        for (const existing of chart.segments) {
            if (this.segmentsOverlap(segment, existing)) {
                throw new Error(`New segment overlaps with existing segment "${existing.id}"`)
            }
        }

        // Insert segment in correct position (sorted by start time)
        const newSegments = [...chart.segments, segment].sort((a, b) => a.startMs - b.startMs)

        return {
            ...chart,
            segments: newSegments
        }
    }

    // ── Helper Methods ──

    /**
     * Create a copy of a segment with new time bounds and ID
     */
    private createSegmentCopy(segment: Segment, startMs: number, endMs: number, newId: string): Segment {
        const base = {
            id: newId,
            startMs,
            endMs,
            judgeRule: segment.judgeRule,
            timingContext: segment.timingContext
        }

        if (isManiaSegment(segment)) {
            return {
                ...base,
                mode: 'mania',
                config: { ...segment.config },
                notes: []
            } as ManiaSegment
        } else if (isTaikoSegment(segment)) {
            return {
                ...base,
                mode: 'taiko',
                config: { ...segment.config },
                notes: []
            } as TaikoSegment
        } else if (isOsuStandardSegment(segment)) {
            return {
                ...base,
                mode: 'osu-standard',
                config: { ...segment.config },
                notes: []
            } as OsuStandardSegment
        }

        throw new Error(`Unknown segment mode: ${segment.mode}`)
    }

    /**
     * Split notes from a segment based on split time
     */
    private splitNotes(segment: Segment, splitTimeMs: number): {
        notes1: (ManiaNote | TaikoNote | OsuNote)[]
        notes2: (ManiaNote | TaikoNote | OsuNote)[]
    } {
        const notes = this.getSegmentNotes(segment)
        const notes1: (ManiaNote | TaikoNote | OsuNote)[] = []
        const notes2: (ManiaNote | TaikoNote | OsuNote)[] = []

        for (const note of notes) {
            const noteTime = this.getNoteTime(note)
            if (noteTime < splitTimeMs) {
                notes1.push(note)
            } else {
                notes2.push(note)
            }
        }

        return { notes1, notes2 }
    }

    /**
     * Get notes from a segment (mode-agnostic)
     */
    private getSegmentNotes(segment: Segment): (ManiaNote | TaikoNote | OsuNote)[] {
        if (isManiaSegment(segment)) {
            return segment.notes
        } else if (isTaikoSegment(segment)) {
            return segment.notes
        } else if (isOsuStandardSegment(segment)) {
            return segment.notes
        }
        return []
    }

    /**
     * Get the time of a note (mode-agnostic)
     */
    private getNoteTime(note: ManiaNote | TaikoNote | OsuNote): number {
        return note.time
    }

    /**
     * Check if two segments overlap in time
     */
    private segmentsOverlap(seg1: Segment, seg2: Segment): boolean {
        return !(seg1.endMs <= seg2.startMs || seg2.endMs <= seg1.startMs)
    }
}
