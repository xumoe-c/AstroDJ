// ── Result type for error handling ──

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

export function Ok<T>(value: T): Result<T, never> {
    return { ok: true, value }
}

export function Err<E>(error: E): Result<never, E> {
    return { ok: false, error }
}

// ── Error interfaces ──

export interface ParseError {
    type: 'syntax' | 'schema' | 'validation'
    message: string
    line?: number
    field?: string
}

export interface ValidationError {
    type: 'overlap' | 'gap' | 'timing' | 'config' | 'note'
    message: string
    segmentId?: string
    noteIndex?: number
}

export type ChartError = 
    | { type: 'parse'; message: string; line?: number; field?: string }
    | { type: 'validation'; errors: ValidationError[] }
    | { type: 'runtime'; message: string; segmentId?: string }
    | { type: 'conversion'; message: string; reason: string }

// ── Judgement (unified enum, both modes map into this) ──

export const Judgement = {
    CriticalPerfect: 0, // mania 300g / taiko GREAT (highest accuracy)
    Perfect: 1, // mania 300 / taiko GREAT
    Great: 2, // mania 200 / taiko OK
    Good: 3, // mania 100 / taiko OK
    Miss: 4,
} as const

export type Judgement = typeof Judgement[keyof typeof Judgement]

// ── Chart top-level ──

export interface Chart {
    meta: ChartMeta
    segments: Segment[]
    osuMetadata?: OsuMetadata
    timingPoints?: TimingPoint[]
}

export interface ChartMeta {
    title: string
    artist: string
    audio: string
    length: number
    // 扩展元信息
    creator?: string
    version?: string
    source?: string
    tags?: string[]
    bpm?: number
    previewTime?: number
    background?: string  // 背景图片 URL 或 data URL
    coverArt?: string    // 封面图片 URL 或 data URL
}

// ── Osu-specific metadata preservation ──

export interface OsuMetadata {
    creator?: string
    version?: string
    source?: string
    tags?: string[]
    beatmapID?: number
    beatmapSetID?: number
    hpDrainRate?: number
    approachRate?: number
    sliderMultiplier?: number
    sliderTickRate?: number
    storyboardFile?: string
    skinPreference?: string
}

// ── Timing point data for .osu format preservation ──

export interface TimingPoint {
    time: number
    beatLength: number
    meter: number
    sampleSet: number
    sampleIndex: number
    volume: number
    uninherited: boolean
    effects: number
}

// ── Segment (discriminated union on mode) ──

export type Segment = ManiaSegment | TaikoSegment | OsuStandardSegment

export interface SegmentBase {
    id: string
    startMs: number
    endMs: number
    mode: string
    judgeRule: string
    timingContext?: number
}

export interface ManiaSegment extends SegmentBase {
    mode: 'mania'
    config: { keys: string[]; scrollSpeed: number }
    notes: ManiaNote[]
}

export interface ManiaNote {
    lane: number
    time: number
    endTime?: number
}

export interface TaikoSegment extends SegmentBase {
    mode: 'taiko'
    config: { donKeys: string[]; kaKeys: string[]; scrollSpeed: number }
    notes: TaikoNote[]
}

export interface TaikoNote {
    type: 'don' | 'ka' | 'roll' | 'balloon'
    time: number
    endTime?: number
    big?: boolean
    hits?: number // for balloon
}

// ── Osu Standard Segment ──

export interface OsuStandardSegment extends SegmentBase {
    mode: 'osu-standard'
    config: { circleSize: number; approachRate: number; scrollSpeed: number }
    notes: OsuNote[]
}

export interface OsuNote {
    type: 'circle' | 'slider' | 'spinner'
    x: number  // 0-512 coordinate space
    y: number  // 0-384 coordinate space
    time: number
    endTime?: number  // For sliders and spinners
    sliderPath?: SliderPath  // For sliders
    hitsound?: HitsoundData
}

export interface SliderPath {
    type: 'L' | 'P' | 'B' | 'C'  // Linear, Perfect circle, Bezier, Catmull
    points: { x: number; y: number }[]
    slides: number  // Number of repeats
    length: number  // Pixel length
}

export interface HitsoundData {
    sampleSet: number
    additionSet: number
    customIndex: number
    volume: number
    filename?: string
}

// ── Type Guards ──

export function isManiaSegment(segment: Segment): segment is ManiaSegment {
    return segment.mode === 'mania'
}

export function isTaikoSegment(segment: Segment): segment is TaikoSegment {
    return segment.mode === 'taiko'
}

export function isOsuStandardSegment(segment: Segment): segment is OsuStandardSegment {
    return segment.mode === 'osu-standard'
}
