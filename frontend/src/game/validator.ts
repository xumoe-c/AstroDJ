import type { Chart, ValidationError, Segment, ManiaSegment, TaikoSegment, OsuStandardSegment } from './types'
import { isManiaSegment, isTaikoSegment, isOsuStandardSegment } from './types'

/**
 * ChartValidator interface for validating hybrid rhythm game charts
 */
export interface ChartValidator {
    validate(chart: Chart): ValidationError[]
}

/**
 * Implementation of ChartValidator with comprehensive validation checks
 */
export class ChartValidatorImpl implements ChartValidator {
    /**
     * Validate a chart and return all validation errors
     * @param chart - Chart to validate
     * @returns Array of validation errors (empty if valid)
     */
    validate(chart: Chart): ValidationError[] {
        const errors: ValidationError[] = []
        
        // Sort segments by start time for validation
        const sorted = [...chart.segments].sort((a, b) => a.startMs - b.startMs)
        
        // Validate each segment
        for (let i = 0; i < sorted.length; i++) {
            const seg = sorted[i]
            
            // Timing validation
            errors.push(...this.validateTiming(seg))
            
            // Check overlap with next segment
            if (i < sorted.length - 1) {
                const next = sorted[i + 1]
                errors.push(...this.validateOverlap(seg, next))
                errors.push(...this.validateGap(seg, next))
            }
            
            // Validate notes are within segment bounds
            errors.push(...this.validateNotes(seg))
            
            // Validate mode-specific config
            errors.push(...this.validateConfig(seg))
        }
        
        // Validate segment ordering
        errors.push(...this.validateOrdering(chart.segments))
        
        return errors
    }

    /**
     * Validate segment timing (non-negative start, end > start)
     * @param segment - Segment to validate
     * @returns Array of timing validation errors
     */
    private validateTiming(segment: Segment): ValidationError[] {
        const errors: ValidationError[] = []
        
        // Check for negative start time
        if (segment.startMs < 0) {
            errors.push({
                type: 'timing',
                message: `Segment ${segment.id} has negative start time: ${segment.startMs}ms`,
                segmentId: segment.id
            })
        }
        
        // Check that end time is after start time
        if (segment.endMs <= segment.startMs) {
            errors.push({
                type: 'timing',
                message: `Segment ${segment.id} end time (${segment.endMs}ms) must be after start time (${segment.startMs}ms)`,
                segmentId: segment.id
            })
        }
        
        return errors
    }

    /**
     * Validate that segments are ordered by start time
     * @param segments - Segments to validate
     * @returns Array of ordering validation errors
     */
    private validateOrdering(segments: Segment[]): ValidationError[] {
        const errors: ValidationError[] = []
        
        for (let i = 1; i < segments.length; i++) {
            if (segments[i].startMs < segments[i - 1].startMs) {
                errors.push({
                    type: 'timing',
                    message: `Segments are not ordered by start time: ${segments[i - 1].id} (${segments[i - 1].startMs}ms) comes before ${segments[i].id} (${segments[i].startMs}ms)`,
                    segmentId: segments[i].id
                })
            }
        }
        
        return errors
    }

    /**
     * Validate that two adjacent segments do not overlap
     * @param seg1 - First segment
     * @param seg2 - Second segment
     * @returns Array of overlap validation errors
     */
    private validateOverlap(seg1: Segment, seg2: Segment): ValidationError[] {
        const errors: ValidationError[] = []
        
        if (seg1.endMs > seg2.startMs) {
            errors.push({
                type: 'overlap',
                message: `Segment ${seg1.id} (ends at ${seg1.endMs}ms) overlaps with ${seg2.id} (starts at ${seg2.startMs}ms)`,
                segmentId: seg1.id
            })
        }
        
        return errors
    }

    /**
     * Validate gap between adjacent segments (warn if > 500ms)
     * @param seg1 - First segment
     * @param seg2 - Second segment
     * @returns Array of gap validation errors
     */
    private validateGap(seg1: Segment, seg2: Segment): ValidationError[] {
        const errors: ValidationError[] = []
        
        const gap = seg2.startMs - seg1.endMs
        if (gap > 500) {
            errors.push({
                type: 'gap',
                message: `Gap of ${gap}ms between ${seg1.id} (ends at ${seg1.endMs}ms) and ${seg2.id} (starts at ${seg2.startMs}ms) exceeds 500ms`,
                segmentId: seg1.id
            })
        }
        
        return errors
    }

    /**
     * Validate that all notes fall within segment boundaries
     * @param segment - Segment to validate
     * @returns Array of note validation errors
     */
    private validateNotes(segment: Segment): ValidationError[] {
        const errors: ValidationError[] = []
        
        const notes = this.getSegmentNotes(segment)
        const segmentDuration = segment.endMs - segment.startMs
        
        notes.forEach((note, idx) => {
            const time = this.getNoteTime(note)
            // Note times should be relative to segment start (0 to duration)
            if (time < 0 || time > segmentDuration) {
                errors.push({
                    type: 'note',
                    message: `Note at ${time}ms in segment ${segment.id} is outside segment duration [0ms, ${segmentDuration}ms]`,
                    segmentId: segment.id,
                    noteIndex: idx
                })
            }
        })
        
        return errors
    }

    /**
     * Validate mode-specific configuration
     * @param segment - Segment to validate
     * @returns Array of config validation errors
     */
    private validateConfig(segment: Segment): ValidationError[] {
        const errors: ValidationError[] = []
        
        // Check if config exists
        if (!segment.config) {
            errors.push({
                type: 'config',
                message: `Segment ${segment.id} is missing config object`,
                segmentId: segment.id
            })
            return errors
        }
        
        if (isManiaSegment(segment)) {
            // Mania: keys must be 1-10
            if (!segment.config.keys || !Array.isArray(segment.config.keys)) {
                errors.push({
                    type: 'config',
                    message: `Mania segment ${segment.id} is missing keys array in config`,
                    segmentId: segment.id
                })
            } else if (segment.config.keys.length < 1 || segment.config.keys.length > 10) {
                errors.push({
                    type: 'config',
                    message: `Mania segment ${segment.id} has ${segment.config.keys.length} keys, must be 1-10`,
                    segmentId: segment.id
                })
            }
        } else if (isTaikoSegment(segment)) {
            // Taiko: must have at least one don and ka key
            if (!segment.config.donKeys || !Array.isArray(segment.config.donKeys)) {
                errors.push({
                    type: 'config',
                    message: `Taiko segment ${segment.id} is missing donKeys array in config`,
                    segmentId: segment.id
                })
            } else if (segment.config.donKeys.length === 0) {
                errors.push({
                    type: 'config',
                    message: `Taiko segment ${segment.id} must have at least one don key`,
                    segmentId: segment.id
                })
            }
            
            if (!segment.config.kaKeys || !Array.isArray(segment.config.kaKeys)) {
                errors.push({
                    type: 'config',
                    message: `Taiko segment ${segment.id} is missing kaKeys array in config`,
                    segmentId: segment.id
                })
            } else if (segment.config.kaKeys.length === 0) {
                errors.push({
                    type: 'config',
                    message: `Taiko segment ${segment.id} must have at least one ka key`,
                    segmentId: segment.id
                })
            }
        } else if (isOsuStandardSegment(segment)) {
            // Osu-standard: circleSize must be 0-10
            if (segment.config.circleSize === undefined || segment.config.circleSize === null) {
                errors.push({
                    type: 'config',
                    message: `Osu-standard segment ${segment.id} is missing circleSize in config`,
                    segmentId: segment.id
                })
            } else if (segment.config.circleSize < 0 || segment.config.circleSize > 10) {
                errors.push({
                    type: 'config',
                    message: `Osu-standard segment ${segment.id} has circleSize ${segment.config.circleSize}, must be 0-10`,
                    segmentId: segment.id
                })
            }
        }
        
        return errors
    }

    /**
     * Get all notes from a segment (mode-agnostic)
     * @param segment - Segment to extract notes from
     * @returns Array of notes
     */
    private getSegmentNotes(segment: Segment): any[] {
        return segment.notes || []
    }

    /**
     * Get the time of a note (mode-agnostic)
     * @param note - Note to extract time from
     * @returns Note time in milliseconds
     */
    private getNoteTime(note: any): number {
        return note.time
    }
}
