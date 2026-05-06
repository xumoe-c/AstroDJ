import type { Chart, ParseError, Result, Segment, ManiaSegment, TaikoSegment, OsuStandardSegment } from './types'
import { Ok, Err } from './types'
import { convertOsu } from './wasm'

/**
 * ChartParser interface for parsing hybrid rhythm game charts
 */
export interface ChartParser {
    parseJSON(json: string): Result<Chart, ParseError>
    parseOsu(osuText: string): Result<Chart, ParseError>
}

/**
 * Implementation of ChartParser with JSON parsing and schema validation
 */
export class ChartParserImpl implements ChartParser {
    /**
     * Parse a JSON string into a Chart object
     * @param json - JSON string to parse
     * @returns Result containing Chart or ParseError
     */
    parseJSON(json: string): Result<Chart, ParseError> {
        try {
            // Parse JSON
            const data = JSON.parse(json)
            
            // Schema validation
            const schemaError = this.validateSchema(data)
            if (schemaError) {
                return Err(schemaError)
            }
            
            // Type coercion and defaults
            const chart = this.coerceTypes(data)
            
            return Ok(chart)
        } catch (e) {
            if (e instanceof SyntaxError) {
                return Err({
                    type: 'syntax',
                    message: `JSON syntax error: ${e.message}`
                })
            }
            return Err({
                type: 'syntax',
                message: `Failed to parse JSON: ${e instanceof Error ? e.message : String(e)}`
            })
        }
    }

    /**
     * Parse a .osu file text into a Chart object
     * @param osuText - .osu file content as string
     * @returns Result containing Chart or ParseError
     */
    parseOsu(osuText: string): Result<Chart, ParseError> {
        // Delegate to WASM converter
        const result = convertOsu(osuText)
        
        if (!result.ok || !result.json) {
            return Err({
                type: 'syntax',
                message: result.error || 'Failed to convert .osu file'
            })
        }
        
        // Parse the converted JSON using parseJSON method
        return this.parseJSON(result.json)
    }

    /**
     * Validate that the parsed data conforms to the Chart schema
     * @param data - Parsed JSON data
     * @returns ParseError if validation fails, null otherwise
     */
    private validateSchema(data: any): ParseError | null {
        // Check top-level structure
        if (typeof data !== 'object' || data === null) {
            return {
                type: 'schema',
                message: 'Chart must be an object',
                field: 'root'
            }
        }

        // Validate meta field
        if (!data.meta || typeof data.meta !== 'object') {
            return {
                type: 'schema',
                message: 'Chart must have a "meta" object',
                field: 'meta'
            }
        }

        // Validate required meta fields
        const requiredMetaFields = ['title', 'artist', 'audio', 'length']
        for (const field of requiredMetaFields) {
            if (!(field in data.meta)) {
                return {
                    type: 'schema',
                    message: `Chart meta must have "${field}" field`,
                    field: `meta.${field}`
                }
            }
        }

        // Validate meta field types (allow string numbers for numeric fields)
        if (typeof data.meta.title !== 'string') {
            return {
                type: 'schema',
                message: 'Chart meta.title must be a string',
                field: 'meta.title'
            }
        }
        if (typeof data.meta.artist !== 'string') {
            return {
                type: 'schema',
                message: 'Chart meta.artist must be a string',
                field: 'meta.artist'
            }
        }
        if (typeof data.meta.audio !== 'string') {
            return {
                type: 'schema',
                message: 'Chart meta.audio must be a string',
                field: 'meta.audio'
            }
        }
        if (typeof data.meta.length !== 'number' && typeof data.meta.length !== 'string') {
            return {
                type: 'schema',
                message: 'Chart meta.length must be a number',
                field: 'meta.length'
            }
        }
        if (typeof data.meta.length === 'string' && isNaN(Number(data.meta.length))) {
            return {
                type: 'schema',
                message: 'Chart meta.length must be a valid number',
                field: 'meta.length'
            }
        }

        // Validate segments field
        if (!Array.isArray(data.segments)) {
            return {
                type: 'schema',
                message: 'Chart must have a "segments" array',
                field: 'segments'
            }
        }

        if (data.segments.length === 0) {
            return {
                type: 'schema',
                message: 'Chart must have at least one segment',
                field: 'segments'
            }
        }

        // Validate each segment
        for (let i = 0; i < data.segments.length; i++) {
            const segment = data.segments[i]
            const segmentError = this.validateSegmentSchema(segment, i)
            if (segmentError) {
                return segmentError
            }
        }

        return null
    }

    /**
     * Validate a single segment's schema
     * @param segment - Segment data to validate
     * @param index - Index of segment in array (for error messages)
     * @returns ParseError if validation fails, null otherwise
     */
    private validateSegmentSchema(segment: any, index: number): ParseError | null {
        const prefix = `segments[${index}]`

        if (typeof segment !== 'object' || segment === null) {
            return {
                type: 'schema',
                message: `Segment at index ${index} must be an object`,
                field: prefix
            }
        }

        // Validate required segment fields
        const requiredFields = ['id', 'startMs', 'endMs', 'mode', 'judgeRule', 'config', 'notes']
        for (const field of requiredFields) {
            if (!(field in segment)) {
                return {
                    type: 'schema',
                    message: `Segment must have "${field}" field`,
                    field: `${prefix}.${field}`
                }
            }
        }

        // Validate field types (allow string numbers for numeric fields)
        if (typeof segment.id !== 'string') {
            return {
                type: 'schema',
                message: 'Segment id must be a string',
                field: `${prefix}.id`
            }
        }
        if (typeof segment.startMs !== 'number' && typeof segment.startMs !== 'string') {
            return {
                type: 'schema',
                message: 'Segment startMs must be a number',
                field: `${prefix}.startMs`
            }
        }
        if (typeof segment.endMs !== 'number' && typeof segment.endMs !== 'string') {
            return {
                type: 'schema',
                message: 'Segment endMs must be a number',
                field: `${prefix}.endMs`
            }
        }
        if (typeof segment.mode !== 'string') {
            return {
                type: 'schema',
                message: 'Segment mode must be a string',
                field: `${prefix}.mode`
            }
        }
        if (typeof segment.judgeRule !== 'string') {
            return {
                type: 'schema',
                message: 'Segment judgeRule must be a string',
                field: `${prefix}.judgeRule`
            }
        }
        if (typeof segment.config !== 'object' || segment.config === null) {
            return {
                type: 'schema',
                message: 'Segment config must be an object',
                field: `${prefix}.config`
            }
        }
        if (!Array.isArray(segment.notes)) {
            return {
                type: 'schema',
                message: 'Segment notes must be an array',
                field: `${prefix}.notes`
            }
        }

        // Validate mode-specific config
        const configError = this.validateModeConfig(segment.mode, segment.config, `${prefix}.config`)
        if (configError) {
            return configError
        }

        return null
    }

    /**
     * Validate mode-specific configuration
     * @param mode - Segment mode
     * @param config - Configuration object
     * @param fieldPath - Field path for error messages
     * @returns ParseError if validation fails, null otherwise
     */
    private validateModeConfig(mode: string, config: any, fieldPath: string): ParseError | null {
        switch (mode) {
            case 'mania':
                if (!Array.isArray(config.keys)) {
                    return {
                        type: 'schema',
                        message: 'Mania config must have "keys" array',
                        field: `${fieldPath}.keys`
                    }
                }
                if (typeof config.scrollSpeed !== 'number' && typeof config.scrollSpeed !== 'string') {
                    return {
                        type: 'schema',
                        message: 'Mania config must have "scrollSpeed" number',
                        field: `${fieldPath}.scrollSpeed`
                    }
                }
                break

            case 'taiko':
                if (!Array.isArray(config.donKeys)) {
                    return {
                        type: 'schema',
                        message: 'Taiko config must have "donKeys" array',
                        field: `${fieldPath}.donKeys`
                    }
                }
                if (!Array.isArray(config.kaKeys)) {
                    return {
                        type: 'schema',
                        message: 'Taiko config must have "kaKeys" array',
                        field: `${fieldPath}.kaKeys`
                    }
                }
                if (typeof config.scrollSpeed !== 'number' && typeof config.scrollSpeed !== 'string') {
                    return {
                        type: 'schema',
                        message: 'Taiko config must have "scrollSpeed" number',
                        field: `${fieldPath}.scrollSpeed`
                    }
                }
                break

            case 'osu-standard':
                if (typeof config.circleSize !== 'number' && typeof config.circleSize !== 'string') {
                    return {
                        type: 'schema',
                        message: 'Osu-standard config must have "circleSize" number',
                        field: `${fieldPath}.circleSize`
                    }
                }
                if (typeof config.approachRate !== 'number' && typeof config.approachRate !== 'string') {
                    return {
                        type: 'schema',
                        message: 'Osu-standard config must have "approachRate" number',
                        field: `${fieldPath}.approachRate`
                    }
                }
                if (typeof config.scrollSpeed !== 'number' && typeof config.scrollSpeed !== 'string') {
                    return {
                        type: 'schema',
                        message: 'Osu-standard config must have "scrollSpeed" number',
                        field: `${fieldPath}.scrollSpeed`
                    }
                }
                break

            default:
                return {
                    type: 'schema',
                    message: `Unknown mode: ${mode}. Supported modes: mania, taiko, osu-standard`,
                    field: fieldPath.replace('.config', '.mode')
                }
        }

        return null
    }

    /**
     * Coerce types and apply defaults to parsed data
     * @param data - Validated data object
     * @returns Chart object with proper types
     */
    private coerceTypes(data: any): Chart {
        const chart: Chart = {
            meta: {
                title: String(data.meta.title),
                artist: String(data.meta.artist),
                audio: String(data.meta.audio),
                length: Number(data.meta.length)
            },
            segments: data.segments.map((seg: any) => this.coerceSegment(seg))
        }

        // Optional fields
        if (data.osuMetadata) {
            chart.osuMetadata = {
                creator: data.osuMetadata.creator ? String(data.osuMetadata.creator) : undefined,
                version: data.osuMetadata.version ? String(data.osuMetadata.version) : undefined,
                source: data.osuMetadata.source ? String(data.osuMetadata.source) : undefined,
                tags: Array.isArray(data.osuMetadata.tags) ? data.osuMetadata.tags.map(String) : undefined,
                beatmapID: data.osuMetadata.beatmapID ? Number(data.osuMetadata.beatmapID) : undefined,
                beatmapSetID: data.osuMetadata.beatmapSetID ? Number(data.osuMetadata.beatmapSetID) : undefined,
                hpDrainRate: data.osuMetadata.hpDrainRate ? Number(data.osuMetadata.hpDrainRate) : undefined,
                approachRate: data.osuMetadata.approachRate ? Number(data.osuMetadata.approachRate) : undefined,
                sliderMultiplier: data.osuMetadata.sliderMultiplier ? Number(data.osuMetadata.sliderMultiplier) : undefined,
                sliderTickRate: data.osuMetadata.sliderTickRate ? Number(data.osuMetadata.sliderTickRate) : undefined,
                storyboardFile: data.osuMetadata.storyboardFile ? String(data.osuMetadata.storyboardFile) : undefined,
                skinPreference: data.osuMetadata.skinPreference ? String(data.osuMetadata.skinPreference) : undefined
            }
        }

        if (Array.isArray(data.timingPoints)) {
            chart.timingPoints = data.timingPoints.map((tp: any) => ({
                time: Number(tp.time),
                beatLength: Number(tp.beatLength),
                meter: Number(tp.meter),
                sampleSet: Number(tp.sampleSet),
                sampleIndex: Number(tp.sampleIndex),
                volume: Number(tp.volume),
                uninherited: Boolean(tp.uninherited),
                effects: Number(tp.effects)
            }))
        }

        return chart
    }

    /**
     * Coerce a segment to proper types
     * @param seg - Segment data
     * @returns Typed Segment
     */
    private coerceSegment(seg: any): Segment {
        const base = {
            id: String(seg.id),
            startMs: Number(seg.startMs),
            endMs: Number(seg.endMs),
            mode: seg.mode,
            judgeRule: String(seg.judgeRule),
            timingContext: seg.timingContext !== undefined ? Number(seg.timingContext) : undefined
        }

        switch (seg.mode) {
            case 'mania':
                return {
                    ...base,
                    mode: 'mania',
                    config: {
                        keys: seg.config.keys.map(String),
                        scrollSpeed: Number(seg.config.scrollSpeed)
                    },
                    notes: seg.notes.map((note: any) => ({
                        lane: Number(note.lane),
                        time: Number(note.time),
                        endTime: note.endTime !== undefined ? Number(note.endTime) : undefined
                    }))
                } as ManiaSegment

            case 'taiko':
                return {
                    ...base,
                    mode: 'taiko',
                    config: {
                        donKeys: seg.config.donKeys.map(String),
                        kaKeys: seg.config.kaKeys.map(String),
                        scrollSpeed: Number(seg.config.scrollSpeed)
                    },
                    notes: seg.notes.map((note: any) => ({
                        type: note.type,
                        time: Number(note.time),
                        endTime: note.endTime !== undefined ? Number(note.endTime) : undefined,
                        big: note.big !== undefined ? Boolean(note.big) : undefined,
                        hits: note.hits !== undefined ? Number(note.hits) : undefined
                    }))
                } as TaikoSegment

            case 'osu-standard':
                return {
                    ...base,
                    mode: 'osu-standard',
                    config: {
                        circleSize: Number(seg.config.circleSize),
                        approachRate: Number(seg.config.approachRate),
                        scrollSpeed: Number(seg.config.scrollSpeed)
                    },
                    notes: seg.notes.map((note: any) => ({
                        type: note.type,
                        x: Number(note.x),
                        y: Number(note.y),
                        time: Number(note.time),
                        endTime: note.endTime !== undefined ? Number(note.endTime) : undefined,
                        sliderPath: note.sliderPath ? {
                            type: note.sliderPath.type,
                            points: note.sliderPath.points.map((p: any) => ({
                                x: Number(p.x),
                                y: Number(p.y)
                            })),
                            slides: Number(note.sliderPath.slides),
                            length: Number(note.sliderPath.length)
                        } : undefined,
                        hitsound: note.hitsound ? {
                            sampleSet: Number(note.hitsound.sampleSet),
                            additionSet: Number(note.hitsound.additionSet),
                            customIndex: Number(note.hitsound.customIndex),
                            volume: Number(note.hitsound.volume),
                            filename: note.hitsound.filename ? String(note.hitsound.filename) : undefined
                        } : undefined
                    }))
                } as OsuStandardSegment

            default:
                // This should never happen due to schema validation
                throw new Error(`Unknown mode: ${seg.mode}`)
        }
    }
}
