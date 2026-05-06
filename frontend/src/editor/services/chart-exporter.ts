import type { Chart, Segment, ValidationError } from '../../game/types'
import type { Result } from '../../game/types'
import { Ok, Err } from '../../game/types'
import type { ExportOptions, ParsedOsz } from '../types'
import { ChartValidatorImpl } from '../../game/validator'

export class ChartExporter {
  private validator = new ChartValidatorImpl()

  export(
    segments: Segment[],
    options: ExportOptions,
    oszData?: ParsedOsz
  ): Result<Chart, ValidationError[]> {
    if (segments.length === 0) {
      return Err([{
        type: 'validation',
        message: 'No segments to export'
      }])
    }

    // Sort segments by startMs
    const sortedSegments = [...segments].sort((a, b) => a.startMs - b.startMs)

    // Calculate total length
    const lastSegment = sortedSegments[sortedSegments.length - 1]
    const length = lastSegment.endMs

    // Get metadata from first beatmap if available
    const firstBeatmap = oszData?.beatmaps[0]

    // Create chart with extended metadata
    const chart: Chart = {
      meta: {
        title: options.title || firstBeatmap?.metadata.title || 'Untitled',
        artist: options.artist || firstBeatmap?.metadata.artist || 'Unknown',
        audio: options.audioFileName,
        length,
        creator: firstBeatmap?.metadata.creator,
        version: firstBeatmap?.metadata.version,
        source: firstBeatmap?.metadata.source,
        tags: firstBeatmap?.metadata.tags,
        previewTime: firstBeatmap?.metadata.previewTime,
        background: oszData?.backgroundImage || undefined,
        coverArt: oszData?.coverArt || undefined
      },
      segments: sortedSegments
    }

    // Validate chart
    const errors = this.validator.validate(chart)
    if (errors.length > 0) {
      return Err(errors)
    }

    return Ok(chart)
  }

  toJSON(chart: Chart): string {
    return JSON.stringify(chart, null, 2)
  }
}
