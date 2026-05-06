import type { Chart, ManiaNote } from './types'

/**
 * Convert an osu!mania 4K .osu file text to AstroDJ Chart format (browser-side).
 * Only supports 4K (CircleSize=4).
 */
export function convertOsuToChart(osuText: string, audioFileName: string = 'audio.mp3'): Chart {
    let section = ''
    let title = ''
    let artist = ''
    let od = 7
    let cs = 4
    let audioFile = audioFileName
    const notes: ManiaNote[] = []

    for (const rawLine of osuText.split('\n')) {
        const line = rawLine.trim()
        if (!line || line.startsWith('//')) continue

        if (line.startsWith('[')) {
            section = line
            continue
        }

        switch (section) {
            case '[General]': {
                const [k, v] = splitKV(line)
                if (k === 'AudioFilename') audioFile = v
                break
            }
            case '[Metadata]': {
                const [k, v] = splitKV(line)
                if (k === 'Title') title = v
                if (k === 'Artist') artist = v
                break
            }
            case '[Difficulty]': {
                const [k, v] = splitKV(line)
                if (k === 'OverallDifficulty') od = parseFloat(v)
                if (k === 'CircleSize') cs = parseFloat(v)
                break
            }
            case '[HitObjects]': {
                const note = parseHitObject(line)
                if (note) notes.push(note)
                break
            }
        }
    }

    if (Math.round(cs) !== 4) {
        throw new Error(`Only 4K beatmaps supported (CircleSize=${cs})`)
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

    const judgeRule = od >= 8 ? 'mania-od8' : od >= 7 ? 'mania-od7' : 'mania-od5'

    return {
        meta: { title, artist, audio: audioFile, length },
        segments: [
            {
                id: 'main',
                startMs: 0,
                endMs: length,
                mode: 'mania',
                judgeRule,
                config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 0.8 },
                notes,
            },
        ],
    }
}

function splitKV(line: string): [string, string] {
    const idx = line.indexOf(':')
    if (idx < 0) return ['', '']
    return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()]
}

function parseHitObject(line: string): ManiaNote | null {
    const parts = line.split(',')
    if (parts.length < 4) return null

    const x = parseInt(parts[0])
    const time = parseInt(parts[2])
    const type = parseInt(parts[3])

    if (isNaN(x) || isNaN(time) || isNaN(type)) return null

    let lane = Math.floor((x * 4) / 512)
    if (lane < 0) lane = 0
    if (lane > 3) lane = 3

    const note: ManiaNote = { lane, time }

    // Long note
    if ((type & 128) !== 0 && parts.length >= 6) {
        const endParts = parts[5].split(':')
        const endTime = parseInt(endParts[0])
        if (!isNaN(endTime) && endTime > time) {
            note.endTime = endTime
        }
    }

    return note
}
