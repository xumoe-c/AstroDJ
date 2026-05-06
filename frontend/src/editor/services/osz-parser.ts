import JSZip from 'jszip'
import type { ParsedOsz, ParsedBeatmap, BeatmapMetadata } from '../types'
import type { Result } from '../../game/types'
import { Ok, Err } from '../../game/types'

export class OszParser {
  async parse(file: File): Promise<Result<ParsedOsz, string>> {
    try {
      const zip = await JSZip.loadAsync(file)
      const beatmaps: ParsedBeatmap[] = []
      let audioFile: File | null = null
      let audioFileName = ''
      let backgroundImage: string | null = null
      let coverArt: string | null = null

      // Extract .osu files
      for (const [fileName, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue

        // Parse .osu files
        if (fileName.endsWith('.osu')) {
          const content = await zipEntry.async('text')
          const beatmap = this.parseBeatmap(fileName, content)
          if (beatmap) {
            beatmaps.push(beatmap)
          }
        }

        // Extract audio files
        if (fileName.match(/\.(mp3|ogg|wav)$/i)) {
          const blob = await zipEntry.async('blob')
          audioFile = new File([blob], fileName)
          audioFileName = fileName
        }

        // Extract background/cover images
        if (fileName.match(/\.(jpg|jpeg|png|gif)$/i)) {
          const blob = await zipEntry.async('blob')
          const dataUrl = await this.blobToDataUrl(blob)
          
          // 优先使用包含 "bg" 或 "background" 的图片作为背景
          if (fileName.toLowerCase().includes('bg') || fileName.toLowerCase().includes('background')) {
            backgroundImage = dataUrl
          }
          // 如果没有背景图，使用第一张图片
          if (!backgroundImage && !coverArt) {
            backgroundImage = dataUrl
            coverArt = dataUrl
          }
        }
      }

      if (beatmaps.length === 0) {
        return Err('No valid beatmaps found in .osz file')
      }

      return Ok({ 
        beatmaps, 
        audioFile, 
        audioFileName,
        backgroundImage,
        coverArt: coverArt || backgroundImage
      })
    } catch (error) {
      return Err(`Failed to parse .osz file: ${error}`)
    }
  }

  private async blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  private parseBeatmap(fileName: string, content: string): ParsedBeatmap | null {
    try {
      const metadata = this.parseMetadata(content)
      const mode = this.parseMode(content)

      console.log(`Parsing ${fileName}: mode=${mode}, circleSize=${metadata.circleSize}`)

      // Only support mania and taiko
      if (mode !== 'mania' && mode !== 'taiko') {
        console.log(`Skipping ${fileName}: unsupported mode ${mode}`)
        return null
      }

      // For mania, only support 4K
      if (mode === 'mania' && Math.round(metadata.circleSize) !== 4) {
        console.log(`Skipping ${fileName}: mania but not 4K (circleSize=${metadata.circleSize})`)
        return null
      }

      console.log(`✓ Added ${fileName}: ${mode} - ${metadata.version}`)

      return {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        fileName,
        content,
        metadata,
        mode,
        difficulty: metadata.version
      }
    } catch (error) {
      console.error(`Failed to parse beatmap ${fileName}:`, error)
      return null
    }
  }

  private parseMetadata(content: string): BeatmapMetadata {
    const metadata: Partial<BeatmapMetadata> = {
      title: '',
      artist: '',
      version: '',
      creator: '',
      circleSize: 4,
      overallDifficulty: 7,
      source: '',
      tags: [],
      previewTime: 0,
      backgroundFile: ''
    }

    let section = ''
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('//')) continue

      if (line.startsWith('[')) {
        section = line
        continue
      }

      const [key, value] = this.splitKV(line)

      if (section === '[Metadata]') {
        if (key === 'Title') metadata.title = value
        if (key === 'Artist') metadata.artist = value
        if (key === 'Version') metadata.version = value
        if (key === 'Creator') metadata.creator = value
        if (key === 'Source') metadata.source = value
        if (key === 'Tags') metadata.tags = value.split(' ').filter(t => t.length > 0)
      }

      if (section === '[Difficulty]') {
        if (key === 'CircleSize') metadata.circleSize = parseFloat(value) || 4
        if (key === 'OverallDifficulty') metadata.overallDifficulty = parseFloat(value) || 7
      }

      if (section === '[General]') {
        if (key === 'PreviewTime') metadata.previewTime = parseInt(value) || 0
      }

      if (section === '[Events]') {
        // Parse background image: 0,0,"filename.jpg",0,0
        if (line.startsWith('0,0,')) {
          const match = line.match(/0,0,"([^"]+)"/)
          if (match) {
            metadata.backgroundFile = match[1]
          }
        }
      }
    }

    return metadata as BeatmapMetadata
  }

  private parseMode(content: string): 'mania' | 'taiko' | 'osu-standard' | null {
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim()
      if (line.startsWith('Mode:')) {
        const mode = parseInt(line.split(':')[1].trim())
        if (mode === 0) return 'osu-standard'
        if (mode === 1) return 'taiko'
        if (mode === 3) return 'mania'
        return null
      }
    }
    // If no Mode field found, default to osu-standard (mode 0)
    return 'osu-standard'
  }

  private splitKV(line: string): [string, string] {
    const idx = line.indexOf(':')
    if (idx < 0) return ['', '']
    return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()]
  }
}
