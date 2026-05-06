import type { Chart, Result, Segment, ManiaSegment, TaikoSegment, OsuStandardSegment, TimingPoint, ManiaNote, TaikoNote, OsuNote, ChartError } from './types'
import { Ok, Err, isManiaSegment, isTaikoSegment, isOsuStandardSegment } from './types'

/**
 * ChartFormatter interface for serializing hybrid rhythm game charts
 */
export interface ChartFormatter {
    toJSON(chart: Chart): string
    toOsu(chart: Chart): Result<string, ChartError>
}

/**
 * Implementation of ChartFormatter with JSON serialization and .osu export
 * 
 * **Validates: Requirements 6.1, 6.2, 6.5.5, 10.11, 10.12**
 */
export class ChartFormatterImpl implements ChartFormatter {
    /**
     * Serialize a Chart object to JSON format with proper indentation
     * @param chart - Chart object to serialize
     * @returns JSON string with 2-space indentation for readability
     */
    toJSON(chart: Chart): string {
        // Serialize with proper indentation (2 spaces)
        return JSON.stringify(chart, null, 2)
    }

    /**
     * Export a Chart to .osu format
     * Only charts with a single mode type can be exported
     * @param chart - Chart object to export
     * @returns Result with .osu file content or conversion error
     */
    toOsu(chart: Chart): Result<string, ChartError> {
        // Check if chart is compatible with .osu format
        if (!this.isOsuCompatible(chart)) {
            return Err({
                type: 'conversion',
                message: 'Chart contains multiple mode types, cannot export to single .osu file',
                reason: 'multi-mode'
            })
        }

        // Build .osu file sections
        const sections: string[] = []

        // Header
        sections.push('osu file format v14')
        sections.push('')

        // General section
        sections.push('[General]')
        sections.push(`AudioFilename: ${chart.meta.audio}`)
        sections.push('AudioLeadIn: 0')
        sections.push('PreviewTime: -1')
        sections.push('Countdown: 0')
        sections.push('SampleSet: Normal')
        sections.push('StackLeniency: 0.7')
        sections.push('Mode: 0')
        sections.push('LetterboxInBreaks: 0')
        sections.push('WidescreenStoryboard: 0')
        sections.push('')

        // Metadata section
        sections.push('[Metadata]')
        sections.push(`Title:${chart.meta.title}`)
        sections.push(`Artist:${chart.meta.artist}`)
        if (chart.osuMetadata) {
            if (chart.osuMetadata.creator) {
                sections.push(`Creator:${chart.osuMetadata.creator}`)
            }
            if (chart.osuMetadata.version) {
                sections.push(`Version:${chart.osuMetadata.version}`)
            }
            if (chart.osuMetadata.source) {
                sections.push(`Source:${chart.osuMetadata.source}`)
            }
            if (chart.osuMetadata.tags && chart.osuMetadata.tags.length > 0) {
                sections.push(`Tags:${chart.osuMetadata.tags.join(' ')}`)
            }
            if (chart.osuMetadata.beatmapID !== undefined) {
                sections.push(`BeatmapID:${chart.osuMetadata.beatmapID}`)
            }
            if (chart.osuMetadata.beatmapSetID !== undefined) {
                sections.push(`BeatmapSetID:${chart.osuMetadata.beatmapSetID}`)
            }
        }
        sections.push('')

        // Difficulty section
        sections.push('[Difficulty]')
        const segment = chart.segments[0]
        
        if (isManiaSegment(segment)) {
            sections.push(`HPDrainRate:${chart.osuMetadata?.hpDrainRate ?? 8}`)
            sections.push(`CircleSize:${segment.config.keys.length}`)
            sections.push(`OverallDifficulty:${this.judgeRuleToOD(segment.judgeRule)}`)
            sections.push(`ApproachRate:${chart.osuMetadata?.approachRate ?? 5}`)
            sections.push(`SliderMultiplier:${chart.osuMetadata?.sliderMultiplier ?? 1.4}`)
            sections.push(`SliderTickRate:${chart.osuMetadata?.sliderTickRate ?? 1}`)
        } else if (isTaikoSegment(segment)) {
            sections.push(`HPDrainRate:${chart.osuMetadata?.hpDrainRate ?? 8}`)
            sections.push(`CircleSize:5`)
            sections.push(`OverallDifficulty:${this.judgeRuleToOD(segment.judgeRule)}`)
            sections.push(`ApproachRate:${chart.osuMetadata?.approachRate ?? 5}`)
            sections.push(`SliderMultiplier:${chart.osuMetadata?.sliderMultiplier ?? 1.4}`)
            sections.push(`SliderTickRate:${chart.osuMetadata?.sliderTickRate ?? 1}`)
        } else if (isOsuStandardSegment(segment)) {
            sections.push(`HPDrainRate:${chart.osuMetadata?.hpDrainRate ?? 8}`)
            sections.push(`CircleSize:${segment.config.circleSize}`)
            sections.push(`OverallDifficulty:${this.judgeRuleToOD(segment.judgeRule)}`)
            sections.push(`ApproachRate:${segment.config.approachRate}`)
            sections.push(`SliderMultiplier:${chart.osuMetadata?.sliderMultiplier ?? 1.4}`)
            sections.push(`SliderTickRate:${chart.osuMetadata?.sliderTickRate ?? 1}`)
        }
        sections.push('')

        // TimingPoints section
        if (chart.timingPoints && chart.timingPoints.length > 0) {
            sections.push('[TimingPoints]')
            for (const tp of chart.timingPoints) {
                sections.push(this.formatTimingPoint(tp))
            }
            sections.push('')
        }

        // HitObjects section
        sections.push('[HitObjects]')
        // Export notes from all segments (they're all the same mode)
        for (const seg of chart.segments) {
            const notes = this.getSegmentNotes(seg)
            for (const note of notes) {
                sections.push(this.formatHitObject(note, seg))
            }
        }

        return Ok(sections.join('\n'))
    }

    /**
     * Check if chart can be exported to .osu format
     * Must have exactly one segment or all segments of the same mode
     */
    private isOsuCompatible(chart: Chart): boolean {
        if (chart.segments.length === 0) return false
        if (chart.segments.length === 1) return true

        const firstMode = chart.segments[0].mode
        return chart.segments.every(s => s.mode === firstMode)
    }

    /**
     * Convert judge rule to OverallDifficulty value
     */
    private judgeRuleToOD(rule: string): number {
        if (rule.includes('od8')) return 8
        if (rule.includes('od7')) return 7
        if (rule.includes('od5')) return 5
        return 7 // default
    }

    /**
     * Format a timing point for .osu file
     */
    private formatTimingPoint(tp: TimingPoint): string {
        return `${tp.time},${tp.beatLength},${tp.meter},${tp.sampleSet},${tp.sampleIndex},${tp.volume},${tp.uninherited ? 1 : 0},${tp.effects}`
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
     * Format a hit object for .osu file (mode-specific)
     */
    private formatHitObject(note: ManiaNote | TaikoNote | OsuNote, segment: Segment): string {
        if (isManiaSegment(segment)) {
            return this.formatManiaHitObject(note as ManiaNote, segment)
        } else if (isTaikoSegment(segment)) {
            return this.formatTaikoHitObject(note as TaikoNote, segment)
        } else if (isOsuStandardSegment(segment)) {
            return this.formatOsuStandardHitObject(note as OsuNote, segment)
        }
        return ''
    }

    /**
     * Format a mania note as .osu hit object
     */
    private formatManiaHitObject(note: ManiaNote, segment: ManiaSegment): string {
        const keyCount = segment.config.keys.length
        const x = Math.floor((512 * note.lane) / keyCount + 256 / keyCount)
        const y = 192
        const time = Math.round(note.time)
        
        if (note.endTime !== undefined) {
            // Long note (hold note)
            const type = 128
            const endTime = Math.round(note.endTime)
            return `${x},${y},${time},${type},0,${endTime}:0:0:0:0:`
        } else {
            // Normal note
            const type = 1
            return `${x},${y},${time},${type},0,0:0:0:0:`
        }
    }

    /**
     * Format a taiko note as .osu hit object
     */
    private formatTaikoHitObject(note: TaikoNote, segment: TaikoSegment): string {
        const x = 256
        const y = 192
        const time = Math.round(note.time)
        
        if (note.type === 'roll' || note.type === 'balloon') {
            // Spinner (used for rolls and balloons in taiko)
            const type = 12
            const endTime = note.endTime ? Math.round(note.endTime) : time + 1000
            return `${x},${y},${time},${type},0,${endTime}`
        } else {
            // Circle (don or ka)
            const type = note.big ? 5 : 1
            const hitsound = note.type === 'ka' ? 8 : 0 // Clap for ka, normal for don
            return `${x},${y},${time},${type},${hitsound},0:0:0:0:`
        }
    }

    /**
     * Format an osu-standard note as .osu hit object
     */
    private formatOsuStandardHitObject(note: OsuNote, segment: OsuStandardSegment): string {
        const x = Math.round(note.x)
        const y = Math.round(note.y)
        const time = Math.round(note.time)
        
        if (note.type === 'circle') {
            const type = 1
            const hitsound = note.hitsound?.sampleSet ?? 0
            return `${x},${y},${time},${type},${hitsound},0:0:0:0:`
        } else if (note.type === 'slider' && note.sliderPath) {
            const type = 2
            const hitsound = note.hitsound?.sampleSet ?? 0
            
            // Format slider path
            const pathType = note.sliderPath.type
            const pathPoints = note.sliderPath.points
                .map(p => `${Math.round(p.x)}:${Math.round(p.y)}`)
                .join('|')
            const slides = note.sliderPath.slides
            const length = Math.round(note.sliderPath.length)
            
            return `${x},${y},${time},${type},${hitsound},${pathType}|${pathPoints},${slides},${length}`
        } else if (note.type === 'spinner') {
            const type = 8
            const endTime = note.endTime ? Math.round(note.endTime) : time + 1000
            const hitsound = note.hitsound?.sampleSet ?? 0
            return `${x},${y},${time},${type},${hitsound},${endTime}`
        }
        
        return ''
    }
}
