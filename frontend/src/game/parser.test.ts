import { describe, test, expect, beforeAll, vi } from 'vitest'
import { ChartParserImpl } from './parser'
import type { Chart, ManiaSegment, TaikoSegment, OsuStandardSegment } from './types'
import * as wasmModule from './wasm'

describe('ChartParserImpl', () => {
    const parser = new ChartParserImpl()

    // Mock WASM convertOsu function for testing
    beforeAll(() => {
        vi.spyOn(wasmModule, 'convertOsu').mockImplementation((osuText: string) => {
            // Simple mock implementation for testing
            if (osuText.includes('CircleSize:7')) {
                return { ok: false, error: 'Only 4K beatmaps supported (CircleSize=7)' }
            }
            if (!osuText.includes('[HitObjects]') || osuText.split('[HitObjects]')[1].trim() === '') {
                return { ok: false, error: 'No hit objects found' }
            }
            if (osuText === 'not a valid osu file') {
                return { ok: false, error: 'Invalid osu file format' }
            }
            
            // Extract metadata
            const titleMatch = osuText.match(/Title:(.+)/)
            const artistMatch = osuText.match(/Artist:(.+)/)
            const audioMatch = osuText.match(/AudioFilename:\s*(.+)/)
            const odMatch = osuText.match(/OverallDifficulty:(\d+)/)
            
            const title = titleMatch ? titleMatch[1].trim() : 'Unknown'
            const artist = artistMatch ? artistMatch[1].trim() : 'Unknown'
            const audio = audioMatch ? audioMatch[1].trim() : 'audio.mp3'
            const od = odMatch ? parseInt(odMatch[1]) : 7
            
            const judgeRule = od >= 8 ? 'mania-od8' : od >= 7 ? 'mania-od7' : 'mania-od5'
            
            // Parse hit objects
            const hitObjectsSection = osuText.split('[HitObjects]')[1]
            const lines = hitObjectsSection.split('\n').filter(l => l.trim() && !l.startsWith('//'))
            const notes = lines.map(line => {
                const parts = line.split(',')
                const x = parseInt(parts[0])
                const time = parseInt(parts[2])
                const type = parseInt(parts[3])
                const lane = Math.floor((x * 4) / 512)
                
                const note: any = { lane, time }
                
                // Long note
                if ((type & 128) !== 0 && parts.length >= 6) {
                    const endTime = parseInt(parts[5].split(':')[0])
                    if (endTime > time) {
                        note.endTime = endTime
                    }
                }
                
                return note
            })
            
            const chart = {
                meta: {
                    title,
                    artist,
                    audio,
                    length: Math.max(...notes.map(n => n.endTime || n.time)) + 2000
                },
                segments: [
                    {
                        id: 'main',
                        startMs: 0,
                        endMs: Math.max(...notes.map(n => n.endTime || n.time)) + 2000,
                        mode: 'mania',
                        judgeRule,
                        config: {
                            keys: ['D', 'F', 'J', 'K'],
                            scrollSpeed: 0.8
                        },
                        notes
                    }
                ]
            }
            
            return { ok: true, json: JSON.stringify(chart) }
        })
    })

    describe('parseJSON - valid charts', () => {
        test('parses valid mania chart', () => {
            const json = JSON.stringify({
                meta: {
                    title: 'Test Song',
                    artist: 'Test Artist',
                    audio: 'test.mp3',
                    length: 120000
                },
                segments: [
                    {
                        id: 'seg1',
                        startMs: 0,
                        endMs: 120000,
                        mode: 'mania',
                        judgeRule: 'mania-od8',
                        config: {
                            keys: ['D', 'F', 'J', 'K'],
                            scrollSpeed: 1.5
                        },
                        notes: [
                            { lane: 0, time: 1000 },
                            { lane: 1, time: 2000, endTime: 3000 }
                        ]
                    }
                ]
            })

            const result = parser.parseJSON(json)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.meta.title).toBe('Test Song')
                expect(result.value.segments).toHaveLength(1)
                const segment = result.value.segments[0] as ManiaSegment
                expect(segment.mode).toBe('mania')
                expect(segment.config.keys).toEqual(['D', 'F', 'J', 'K'])
                expect(segment.notes).toHaveLength(2)
            }
        })

        test('parses valid taiko chart', () => {
            const json = JSON.stringify({
                meta: {
                    title: 'Taiko Song',
                    artist: 'Taiko Artist',
                    audio: 'taiko.mp3',
                    length: 90000
                },
                segments: [
                    {
                        id: 'seg1',
                        startMs: 0,
                        endMs: 90000,
                        mode: 'taiko',
                        judgeRule: 'taiko-od7',
                        config: {
                            donKeys: ['D', 'F'],
                            kaKeys: ['J', 'K'],
                            scrollSpeed: 1.0
                        },
                        notes: [
                            { type: 'don', time: 1000 },
                            { type: 'ka', time: 2000, big: true }
                        ]
                    }
                ]
            })

            const result = parser.parseJSON(json)

            expect(result.ok).toBe(true)
            if (result.ok) {
                const segment = result.value.segments[0] as TaikoSegment
                expect(segment.mode).toBe('taiko')
                expect(segment.config.donKeys).toEqual(['D', 'F'])
                expect(segment.notes[1].big).toBe(true)
            }
        })

        test('parses valid osu-standard chart', () => {
            const json = JSON.stringify({
                meta: {
                    title: 'Osu Song',
                    artist: 'Osu Artist',
                    audio: 'osu.mp3',
                    length: 100000
                },
                segments: [
                    {
                        id: 'seg1',
                        startMs: 0,
                        endMs: 100000,
                        mode: 'osu-standard',
                        judgeRule: 'osu-od8',
                        config: {
                            circleSize: 4,
                            approachRate: 9,
                            scrollSpeed: 1.0
                        },
                        notes: [
                            { type: 'circle', x: 256, y: 192, time: 1000 },
                            { type: 'spinner', x: 256, y: 192, time: 2000, endTime: 3000 }
                        ]
                    }
                ]
            })

            const result = parser.parseJSON(json)

            expect(result.ok).toBe(true)
            if (result.ok) {
                const segment = result.value.segments[0] as OsuStandardSegment
                expect(segment.mode).toBe('osu-standard')
                expect(segment.config.circleSize).toBe(4)
                expect(segment.notes[0].type).toBe('circle')
            }
        })

        test('parses chart with optional osuMetadata', () => {
            const json = JSON.stringify({
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 10000
                },
                segments: [
                    {
                        id: 'seg1',
                        startMs: 0,
                        endMs: 10000,
                        mode: 'mania',
                        judgeRule: 'mania-od7',
                        config: { keys: ['D', 'F'], scrollSpeed: 1.0 },
                        notes: []
                    }
                ],
                osuMetadata: {
                    creator: 'Mapper',
                    version: 'Hard',
                    source: 'Game',
                    tags: ['tag1', 'tag2'],
                    beatmapID: 12345
                }
            })

            const result = parser.parseJSON(json)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.osuMetadata).toBeDefined()
                expect(result.value.osuMetadata?.creator).toBe('Mapper')
                expect(result.value.osuMetadata?.tags).toEqual(['tag1', 'tag2'])
            }
        })

        test('parses chart with timingPoints', () => {
            const json = JSON.stringify({
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 10000
                },
                segments: [
                    {
                        id: 'seg1',
                        startMs: 0,
                        endMs: 10000,
                        mode: 'mania',
                        judgeRule: 'mania-od7',
                        config: { keys: ['D'], scrollSpeed: 1.0 },
                        notes: [],
                        timingContext: 0
                    }
                ],
                timingPoints: [
                    {
                        time: 0,
                        beatLength: 500,
                        meter: 4,
                        sampleSet: 1,
                        sampleIndex: 0,
                        volume: 100,
                        uninherited: true,
                        effects: 0
                    }
                ]
            })

            const result = parser.parseJSON(json)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.timingPoints).toBeDefined()
                expect(result.value.timingPoints).toHaveLength(1)
                expect(result.value.timingPoints![0].beatLength).toBe(500)
                expect(result.value.segments[0].timingContext).toBe(0)
            }
        })
    })

    describe('parseJSON - syntax errors', () => {
        test('returns syntax error for invalid JSON', () => {
            const result = parser.parseJSON('{ invalid json }')

            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error.type).toBe('syntax')
                expect(result.error.message).toContain('JSON syntax error')
            }
        })

        test('returns syntax error for empty string', () => {
            const result = parser.parseJSON('')

            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error.type).toBe('syntax')
            }
        })
    })

    describe('parseJSON - schema errors', () => {
        test('returns schema error for non-object root', () => {
            const result = parser.parseJSON('[]')

            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error.type).toBe('schema')
                // Arrays are objects in JavaScript, so this will fail on missing meta
                expect(result.error.message).toContain('meta')
            }
        })

        test('returns schema error for missing meta', () => {
            const json = JSON.stringify({
                segments: []
            })

            const result = parser.parseJSON(json)

            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error.type).toBe('schema')
                expect(result.error.message).toContain('meta')
                expect(result.error.field).toBe('meta')
            }
        })

        test('returns schema error for missing meta.title', () => {
            const json = JSON.stringify({
                meta: {
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 10000
                },
                segments: []
            })

            const result = parser.parseJSON(json)

            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error.type).toBe('schema')
                expect(result.error.message).toContain('title')
            }
        })

        test('returns schema error for missing segments', () => {
            const json = JSON.stringify({
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 10000
                }
            })

            const result = parser.parseJSON(json)

            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error.type).toBe('schema')
                expect(result.error.message).toContain('segments')
            }
        })

        test('returns schema error for empty segments array', () => {
            const json = JSON.stringify({
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 10000
                },
                segments: []
            })

            const result = parser.parseJSON(json)

            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error.type).toBe('schema')
                expect(result.error.message).toContain('at least one segment')
            }
        })

        test('returns schema error for segment missing required fields', () => {
            const json = JSON.stringify({
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 10000
                },
                segments: [
                    {
                        id: 'seg1',
                        startMs: 0
                        // missing endMs, mode, judgeRule, config, notes
                    }
                ]
            })

            const result = parser.parseJSON(json)

            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error.type).toBe('schema')
                expect(result.error.field).toContain('segments[0]')
            }
        })

        test('returns schema error for invalid mode', () => {
            const json = JSON.stringify({
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 10000
                },
                segments: [
                    {
                        id: 'seg1',
                        startMs: 0,
                        endMs: 10000,
                        mode: 'invalid-mode',
                        judgeRule: 'test',
                        config: {},
                        notes: []
                    }
                ]
            })

            const result = parser.parseJSON(json)

            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error.type).toBe('schema')
                expect(result.error.message).toContain('Unknown mode')
            }
        })

        test('returns schema error for mania missing keys', () => {
            const json = JSON.stringify({
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 10000
                },
                segments: [
                    {
                        id: 'seg1',
                        startMs: 0,
                        endMs: 10000,
                        mode: 'mania',
                        judgeRule: 'mania-od7',
                        config: {
                            scrollSpeed: 1.0
                        },
                        notes: []
                    }
                ]
            })

            const result = parser.parseJSON(json)

            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error.type).toBe('schema')
                expect(result.error.message).toContain('keys')
            }
        })

        test('returns schema error for taiko missing donKeys', () => {
            const json = JSON.stringify({
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 10000
                },
                segments: [
                    {
                        id: 'seg1',
                        startMs: 0,
                        endMs: 10000,
                        mode: 'taiko',
                        judgeRule: 'taiko-od7',
                        config: {
                            kaKeys: ['J', 'K'],
                            scrollSpeed: 1.0
                        },
                        notes: []
                    }
                ]
            })

            const result = parser.parseJSON(json)

            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error.type).toBe('schema')
                expect(result.error.message).toContain('donKeys')
            }
        })

        test('returns schema error for osu-standard missing circleSize', () => {
            const json = JSON.stringify({
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 10000
                },
                segments: [
                    {
                        id: 'seg1',
                        startMs: 0,
                        endMs: 10000,
                        mode: 'osu-standard',
                        judgeRule: 'osu-od8',
                        config: {
                            approachRate: 9,
                            scrollSpeed: 1.0
                        },
                        notes: []
                    }
                ]
            })

            const result = parser.parseJSON(json)

            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error.type).toBe('schema')
                expect(result.error.message).toContain('circleSize')
            }
        })
    })

    describe('parseJSON - type coercion', () => {
        test('coerces string numbers to numbers', () => {
            const json = JSON.stringify({
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: '10000' // string instead of number
                },
                segments: [
                    {
                        id: 'seg1',
                        startMs: '0',
                        endMs: '10000',
                        mode: 'mania',
                        judgeRule: 'mania-od7',
                        config: {
                            keys: ['D'],
                            scrollSpeed: '1.5'
                        },
                        notes: []
                    }
                ]
            })

            const result = parser.parseJSON(json)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(typeof result.value.meta.length).toBe('number')
                expect(result.value.meta.length).toBe(10000)
                expect(typeof result.value.segments[0].startMs).toBe('number')
            }
        })
    })

    describe('parseOsu', () => {
        test('parses valid 4K osu!mania beatmap', () => {
            const osuText = `osu file format v14

[General]
AudioFilename: audio.mp3

[Metadata]
Title:Test Song
Artist:Test Artist

[Difficulty]
CircleSize:4
OverallDifficulty:8

[HitObjects]
64,192,1000,1,0,0:0:0:0:
192,192,2000,128,0,3000:0:0:0:0:
320,192,4000,1,0,0:0:0:0:
448,192,5000,1,0,0:0:0:0:
`

            const result = parser.parseOsu(osuText)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.meta.title).toBe('Test Song')
                expect(result.value.meta.artist).toBe('Test Artist')
                expect(result.value.meta.audio).toBe('audio.mp3')
                expect(result.value.segments).toHaveLength(1)
                
                const segment = result.value.segments[0] as ManiaSegment
                expect(segment.mode).toBe('mania')
                expect(segment.judgeRule).toBe('mania-od8')
                expect(segment.config.keys).toEqual(['D', 'F', 'J', 'K'])
                expect(segment.notes).toHaveLength(4)
                
                // Check first note (normal note)
                expect(segment.notes[0].lane).toBe(0)
                expect(segment.notes[0].time).toBe(1000)
                expect(segment.notes[0].endTime).toBeUndefined()
                
                // Check second note (long note)
                expect(segment.notes[1].lane).toBe(1)
                expect(segment.notes[1].time).toBe(2000)
                expect(segment.notes[1].endTime).toBe(3000)
            }
        })

        test('returns error for non-4K beatmap', () => {
            const osuText = `osu file format v14

[General]
AudioFilename: audio.mp3

[Metadata]
Title:Test Song
Artist:Test Artist

[Difficulty]
CircleSize:7
OverallDifficulty:8

[HitObjects]
64,192,1000,1,0,0:0:0:0:
`

            const result = parser.parseOsu(osuText)

            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error.type).toBe('syntax')
                expect(result.error.message).toContain('4K')
            }
        })

        test('returns error for beatmap with no hit objects', () => {
            const osuText = `osu file format v14

[General]
AudioFilename: audio.mp3

[Metadata]
Title:Test Song
Artist:Test Artist

[Difficulty]
CircleSize:4
OverallDifficulty:8

[HitObjects]
`

            const result = parser.parseOsu(osuText)

            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error.type).toBe('syntax')
                expect(result.error.message).toContain('No hit objects')
            }
        })

        test('handles different OD values correctly', () => {
            const osuText = `osu file format v14

[General]
AudioFilename: audio.mp3

[Metadata]
Title:Test Song
Artist:Test Artist

[Difficulty]
CircleSize:4
OverallDifficulty:5

[HitObjects]
64,192,1000,1,0,0:0:0:0:
`

            const result = parser.parseOsu(osuText)

            expect(result.ok).toBe(true)
            if (result.ok) {
                const segment = result.value.segments[0] as ManiaSegment
                expect(segment.judgeRule).toBe('mania-od5')
            }
        })

        test('returns error for malformed osu file', () => {
            const osuText = 'not a valid osu file'

            const result = parser.parseOsu(osuText)

            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error.type).toBe('syntax')
            }
        })

        test('converts and validates through parseJSON', () => {
            const osuText = `osu file format v14

[General]
AudioFilename: audio.mp3

[Metadata]
Title:Test Song
Artist:Test Artist

[Difficulty]
CircleSize:4
OverallDifficulty:7

[HitObjects]
64,192,1000,1,0,0:0:0:0:
192,192,2000,1,0,0:0:0:0:
`

            const result = parser.parseOsu(osuText)

            expect(result.ok).toBe(true)
            if (result.ok) {
                // Verify the chart passes through parseJSON validation
                const jsonResult = parser.parseJSON(JSON.stringify(result.value))
                expect(jsonResult.ok).toBe(true)
            }
        })
    })
})
