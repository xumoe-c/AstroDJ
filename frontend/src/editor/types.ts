// Editor-specific types

export interface ParsedOsz {
  beatmaps: ParsedBeatmap[]
  audioFile: File | null
  audioFileName: string
  backgroundImage?: string | null
  coverArt?: string | null
}

export interface ParsedBeatmap {
  id: string
  fileName: string
  content: string
  metadata: BeatmapMetadata
  mode: 'mania' | 'taiko'
  difficulty: string
}

export interface BeatmapMetadata {
  title: string
  artist: string
  version: string
  creator: string
  circleSize: number
  overallDifficulty: number
  source?: string
  tags?: string[]
  previewTime?: number
  backgroundFile?: string
}

export interface SegmentConfig {
  id: string
  beatmapId: string
  startMs: number
  endMs: number
  order: number
}

export interface ExportOptions {
  title: string
  artist: string
  audioFileName: string
}

export interface EditorState {
  oszFile: File | null
  parsedOsz: ParsedOsz | null
  segmentConfigs: Map<string, SegmentConfig>
  segments: any[] // Will use Segment from game/types
  exportOptions: ExportOptions
  currentStep: 'import' | 'edit' | 'export'
  errors: string[]
}

export type EditorError =
  | { type: 'osz-parse'; message: string; fileName: string }
  | { type: 'beatmap-parse'; message: string; beatmapId: string }
  | { type: 'segment-build'; message: string; beatmapId: string }
  | { type: 'validation'; errors: any[] }
  | { type: 'export'; message: string }
  | { type: 'zip-package'; message: string }
