import type { Segment, Chart, ManiaNote, TaikoNote } from '../../game/types'
import type { Result } from '../../game/types'
import { Ok, Err } from '../../game/types'
import type { ParsedBeatmap, SegmentConfig } from '../types'
import { convertOsuToChart } from '../../game/osu-convert'

export class SegmentBuilder {
  buildSegment(
    beatmap: ParsedBeatmap,
    config: SegmentConfig
  ): Result<Segment, string> {
    try {
      let chart: Chart

      // Convert based on mode
      if (beatmap.mode === 'mania') {
        chart = convertOsuToChart(beatmap.content, '')
      } else if (beatmap.mode === 'taiko') {
        chart = this.convertTaikoToChart(beatmap.content, '')
      } else {
        return Err(`Unsupported mode: ${beatmap.mode}`)
      }
      
      if (chart.segments.length === 0) {
        return Err('No segments found in beatmap')
      }

      const segment = chart.segments[0]

      // Filter notes based on time range
      const filteredNotes = this.filterNotes(segment, config.startMs, config.endMs)

      if (filteredNotes.length === 0) {
        return Err(`No notes found in time range ${config.startMs}-${config.endMs}ms`)
      }

      // Calculate actual end time based on the last note (notes are now in relative time)
      let maxRelativeTime = 0
      for (const note of filteredNotes) {
        const noteEndTime = 'endTime' in note && note.endTime !== undefined 
          ? note.endTime 
          : note.time
        maxRelativeTime = Math.max(maxRelativeTime, noteEndTime)
      }
      // Add a small buffer after the last note
      const actualEndMs = config.startMs + maxRelativeTime + 1000

      // Create new segment with filtered notes
      const newSegment: Segment = {
        ...segment,
        id: config.id,
        startMs: config.startMs,
        endMs: actualEndMs,
        notes: filteredNotes as any
      }

      return Ok(newSegment)
    } catch (error) {
      return Err(`Failed to build segment: ${error}`)
    }
  }

  private convertTaikoToChart(osuText: string, audioFileName: string): Chart {
    let section = ''
    let title = ''
    let artist = ''
    let od = 7
    let audioFile = audioFileName
    const notes: TaikoNote[] = []

    for (const rawLine of osuText.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('//')) continue

      if (line.startsWith('[')) {
        section = line
        continue
      }

      const [k, v] = this.splitKV(line)

      if (section === '[General]') {
        if (k === 'AudioFilename') audioFile = v
      } else if (section === '[Metadata]') {
        if (k === 'Title') title = v
        if (k === 'Artist') artist = v
      } else if (section === '[Difficulty]') {
        if (k === 'OverallDifficulty') od = parseFloat(v) || 7
      } else if (section === '[HitObjects]') {
        const note = this.parseTaikoHitObject(line)
        if (note) notes.push(note)
      }
    }

    if (notes.length === 0) {
      throw new Error('No hit objects found')
    }

    notes.sort((a, b) => a.time - b.time)

    let lastTime = notes[notes.length - 1].time
    for (const n of notes) {
      if (n.endTime && n.endTime > lastTime) lastTime = n.endTime
    }
    const length = lastTime + 2000

    const judgeRule = 'taiko-normal'

    return {
      meta: { title, artist, audio: audioFile, length },
      segments: [
        {
          id: 'main',
          startMs: 0,
          endMs: length,
          mode: 'taiko',
          judgeRule,
          config: { donKeys: ['F', 'J'], kaKeys: ['D', 'K'], scrollSpeed: 0.8 },
          notes,
        },
      ],
    }
  }

  private parseTaikoHitObject(line: string): TaikoNote | null {
    const parts = line.split(',')
    if (parts.length < 5) return null

    const time = parseInt(parts[2])
    const type = parseInt(parts[3])
    const hitsound = parseInt(parts[4])

    if (isNaN(time) || isNaN(type)) return null

    // Determine note type based on hitsound
    // Hitsound & 2 = whistle (ka/blue)
    // Hitsound & 8 = clap (ka/blue)
    // Otherwise = don (red)
    const isKa = (hitsound & 2) !== 0 || (hitsound & 8) !== 0
    const isBig = (hitsound & 4) !== 0

    // Check if it's a spinner (type & 8)
    if ((type & 8) !== 0) {
      // Spinner = roll
      const endTime = parts.length >= 6 ? parseInt(parts[5]) : time + 1000
      return {
        type: 'roll',
        time,
        endTime: isNaN(endTime) ? time + 1000 : endTime,
        big: isBig
      }
    }

    // Check if it's a slider (type & 2)
    if ((type & 2) !== 0) {
      // Slider = roll
      const endTime = parts.length >= 8 ? parseInt(parts[7]) : time + 500
      return {
        type: 'roll',
        time,
        endTime: isNaN(endTime) ? time + 500 : endTime,
        big: isBig
      }
    }

    // Regular hit
    return {
      type: isKa ? 'ka' : 'don',
      time,
      big: isBig
    }
  }

  private splitKV(line: string): [string, string] {
    const idx = line.indexOf(':')
    if (idx < 0) return ['', '']
    return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()]
  }

  private filterNotes(segment: Segment, startMs: number, endMs: number): (ManiaNote | TaikoNote)[] {
    // Filter notes that start within the time range
    const filtered = segment.notes.filter(note => 
      note.time >= startMs && note.time <= endMs
    )

    // Convert absolute time to relative time (relative to segment start)
    // This is required because the runtime expects note times to be relative to segment.startMs
    return filtered.map(note => {
      const relativeNote = { ...note }
      relativeNote.time = note.time - startMs
      
      // Also adjust endTime for long notes/rolls
      if ('endTime' in note && note.endTime !== undefined) {
        relativeNote.endTime = note.endTime - startMs
      }
      
      return relativeNote
    })
  }

  autoStitch(segments: Segment[]): Segment[] {
    if (segments.length === 0) return []

    // Sort by startMs
    const sorted = [...segments].sort((a, b) => a.startMs - b.startMs)

    // Adjust segments to be adjacent (no gaps or overlaps)
    const stitched: Segment[] = []
    let currentTime = 0

    for (let i = 0; i < sorted.length; i++) {
      const segment = sorted[i]
      const duration = segment.endMs - segment.startMs

      stitched.push({
        ...segment,
        startMs: currentTime,
        endMs: currentTime + duration
      })

      currentTime += duration
    }

    return stitched
  }
}
