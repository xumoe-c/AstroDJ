import { describe, test, expect } from 'vitest'
import { ChartFormatterImpl } from './formatter'
import type { Chart, ManiaSegment, TaikoSegment, OsuStandardSegment } from './types'

describe('ChartFormatterImpl', () => {
    const formatter = new ChartFormatterImpl()

    describe('toJSON', () => {
        test('serializes simple chart with proper indentation', () => {
            const chart: Chart = {
                meta: {
                    title: 'Test Song',
                    artist: 'Test Artist',
                    audio: 'test.mp3',
                    length: 120000
                },
                segments: [
                    {
                        id: 'seg1',
                        mode: 'mania',
                        startMs: 0,
                        endMs: 60000,
                        judgeRule: 'mania-od8',
                        config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
                        notes: [
                            { lane: 0, time: 1000 },
                            { lane: 1, time: 2000 }
                        ]
                    } as ManiaSegment
                ]
            }

            const json = formatter.toJSON(chart)

            // Verify it's valid JSON
            expect(() => JSON.parse(json)).not.toThrow()

            // Verify indentation (should have 2-space indentation)
            expect(json).toContain('  "meta"')
            expect(json).toContain('    "title"')

            // Verify content is preserved
            const parsed = JSON.parse(json)
            expect(parsed.meta.title).toBe('Test Song')
            expect(parsed.segments).toHaveLength(1)
            expect(parsed.segments[0].notes).toHaveLength(2)
        })

        test('serializes chart with multiple segments', () => {
            const chart: Chart = {
                meta: {
                    title: 'Hybrid Song',
                    artist: 'Hybrid Artist',
                    audio: 'hybrid.mp3',
                    length: 180000
                },
                segments: [
                    {
                        id: 'seg1',
                        mode: 'mania',
                        startMs: 0,
                        endMs: 60000,
                        judgeRule: 'mania-od8',
                        config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
                        notes: [{ lane: 0, time: 1000 }]
                    } as ManiaSegment,
                    {
                        id: 'seg2',
                        mode: 'taiko',
                        startMs: 60000,
                        endMs: 120000,
                        judgeRule: 'taiko-default',
                        config: { donKeys: ['D', 'F'], kaKeys: ['J', 'K'], scrollSpeed: 1.0 },
                        notes: [{ type: 'don', time: 61000 }]
                    } as TaikoSegment
                ]
            }

            const json = formatter.toJSON(chart)
            const parsed = JSON.parse(json)

            expect(parsed.segments).toHaveLength(2)
            expect(parsed.segments[0].mode).toBe('mania')
            expect(parsed.segments[1].mode).toBe('taiko')
        })

        test('serializes chart with osu metadata', () => {
            const chart: Chart = {
                meta: {
                    title: 'Osu Song',
                    artist: 'Osu Artist',
                    audio: 'osu.mp3',
                    length: 120000
                },
                segments: [
                    {
                        id: 'seg1',
                        mode: 'mania',
                        startMs: 0,
                        endMs: 120000,
                        judgeRule: 'mania-od8',
                        config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
                        notes: []
                    } as ManiaSegment
                ],
                osuMetadata: {
                    creator: 'Mapper Name',
                    version: 'Hard',
                    source: 'Game',
                    tags: ['tag1', 'tag2'],
                    beatmapID: 12345,
                    beatmapSetID: 67890
                }
            }

            const json = formatter.toJSON(chart)
            const parsed = JSON.parse(json)

            expect(parsed.osuMetadata).toBeDefined()
            expect(parsed.osuMetadata.creator).toBe('Mapper Name')
            expect(parsed.osuMetadata.version).toBe('Hard')
            expect(parsed.osuMetadata.tags).toEqual(['tag1', 'tag2'])
        })

        test('serializes chart with timing points', () => {
            const chart: Chart = {
                meta: {
                    title: 'Timing Song',
                    artist: 'Timing Artist',
                    audio: 'timing.mp3',
                    length: 120000
                },
                segments: [
                    {
                        id: 'seg1',
                        mode: 'mania',
                        startMs: 0,
                        endMs: 120000,
                        judgeRule: 'mania-od8',
                        config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
                        notes: [],
                        timingContext: 0
                    } as ManiaSegment
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
            }

            const json = formatter.toJSON(chart)
            const parsed = JSON.parse(json)

            expect(parsed.timingPoints).toBeDefined()
            expect(parsed.timingPoints).toHaveLength(1)
            expect(parsed.timingPoints[0].beatLength).toBe(500)
            expect(parsed.segments[0].timingContext).toBe(0)
        })

        test('serializes osu-standard segment', () => {
            const chart: Chart = {
                meta: {
                    title: 'Osu Standard Song',
                    artist: 'Osu Artist',
                    audio: 'osu.mp3',
                    length: 120000
                },
                segments: [
                    {
                        id: 'seg1',
                        mode: 'osu-standard',
                        startMs: 0,
                        endMs: 120000,
                        judgeRule: 'osu-od8',
                        config: { circleSize: 4, approachRate: 9, scrollSpeed: 1.0 },
                        notes: [
                            {
                                type: 'circle',
                                x: 256,
                                y: 192,
                                time: 1000
                            },
                            {
                                type: 'slider',
                                x: 100,
                                y: 100,
                                time: 2000,
                                endTime: 3000,
                                sliderPath: {
                                    type: 'L',
                                    points: [{ x: 100, y: 100 }, { x: 200, y: 200 }],
                                    slides: 1,
                                    length: 100
                                }
                            }
                        ]
                    } as OsuStandardSegment
                ]
            }

            const json = formatter.toJSON(chart)
            const parsed = JSON.parse(json)

            expect(parsed.segments[0].mode).toBe('osu-standard')
            expect(parsed.segments[0].notes).toHaveLength(2)
            expect(parsed.segments[0].notes[0].type).toBe('circle')
            expect(parsed.segments[0].notes[1].type).toBe('slider')
            expect(parsed.segments[0].notes[1].sliderPath).toBeDefined()
        })

        test('produces valid JSON that can be parsed back', () => {
            const chart: Chart = {
                meta: {
                    title: 'Round Trip Test',
                    artist: 'Test Artist',
                    audio: 'test.mp3',
                    length: 60000
                },
                segments: [
                    {
                        id: 'seg1',
                        mode: 'mania',
                        startMs: 0,
                        endMs: 60000,
                        judgeRule: 'mania-od8',
                        config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.5 },
                        notes: [
                            { lane: 0, time: 1000 },
                            { lane: 1, time: 2000, endTime: 3000 }
                        ]
                    } as ManiaSegment
                ]
            }

            const json = formatter.toJSON(chart)
            const parsed = JSON.parse(json) as Chart

            // Verify all fields are preserved
            expect(parsed.meta.title).toBe(chart.meta.title)
            expect(parsed.meta.artist).toBe(chart.meta.artist)
            expect(parsed.meta.audio).toBe(chart.meta.audio)
            expect(parsed.meta.length).toBe(chart.meta.length)
            expect(parsed.segments).toHaveLength(1)
            expect(parsed.segments[0].id).toBe('seg1')
            expect(parsed.segments[0].mode).toBe('mania')
            expect((parsed.segments[0] as ManiaSegment).notes).toHaveLength(2)
        })

        test('handles empty segments array', () => {
            const chart: Chart = {
                meta: {
                    title: 'Empty Chart',
                    artist: 'Empty Artist',
                    audio: 'empty.mp3',
                    length: 0
                },
                segments: []
            }

            const json = formatter.toJSON(chart)
            const parsed = JSON.parse(json)

            expect(parsed.segments).toEqual([])
        })

        test('handles chart with no notes', () => {
            const chart: Chart = {
                meta: {
                    title: 'No Notes',
                    artist: 'Silent Artist',
                    audio: 'silent.mp3',
                    length: 60000
                },
                segments: [
                    {
                        id: 'seg1',
                        mode: 'mania',
                        startMs: 0,
                        endMs: 60000,
                        judgeRule: 'mania-od8',
                        config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
                        notes: []
                    } as ManiaSegment
                ]
            }

            const json = formatter.toJSON(chart)
            const parsed = JSON.parse(json)

            expect(parsed.segments[0].notes).toEqual([])
        })
    })

    describe('toOsu', () => {
        test('exports single mania segment to .osu format', () => {
            const chart: Chart = {
                meta: {
                    title: 'Test Song',
                    artist: 'Test Artist',
                    audio: 'test.mp3',
                    length: 120000
                },
                segments: [
                    {
                        id: 'seg1',
                        mode: 'mania',
                        startMs: 0,
                        endMs: 60000,
                        judgeRule: 'mania-od8',
                        config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
                        notes: [
                            { lane: 0, time: 1000 },
                            { lane: 1, time: 2000, endTime: 3000 }
                        ]
                    } as ManiaSegment
                ],
                osuMetadata: {
                    creator: 'Mapper',
                    version: 'Hard'
                }
            }

            const result = formatter.toOsu(chart)

            expect(result.ok).toBe(true)
            if (result.ok) {
                const osuContent = result.value
                expect(osuContent).toContain('osu file format v14')
                expect(osuContent).toContain('[General]')
                expect(osuContent).toContain('AudioFilename: test.mp3')
                expect(osuContent).toContain('[Metadata]')
                expect(osuContent).toContain('Title:Test Song')
                expect(osuContent).toContain('Artist:Test Artist')
                expect(osuContent).toContain('Creator:Mapper')
                expect(osuContent).toContain('Version:Hard')
                expect(osuContent).toContain('[Difficulty]')
                expect(osuContent).toContain('CircleSize:4')
                expect(osuContent).toContain('OverallDifficulty:8')
                expect(osuContent).toContain('[HitObjects]')
            }
        })

        test('exports mania long notes correctly', () => {
            const chart: Chart = {
                meta: {
                    title: 'LN Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 60000
                },
                segments: [
                    {
                        id: 'seg1',
                        mode: 'mania',
                        startMs: 0,
                        endMs: 60000,
                        judgeRule: 'mania-od7',
                        config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
                        notes: [
                            { lane: 0, time: 1000, endTime: 2000 }
                        ]
                    } as ManiaSegment
                ]
            }

            const result = formatter.toOsu(chart)

            expect(result.ok).toBe(true)
            if (result.ok) {
                const osuContent = result.value
                // Long note should have type 128 and endTime
                expect(osuContent).toMatch(/\d+,192,1000,128,0,2000:0:0:0:0:/)
            }
        })

        test('exports taiko segment to .osu format', () => {
            const chart: Chart = {
                meta: {
                    title: 'Taiko Song',
                    artist: 'Taiko Artist',
                    audio: 'taiko.mp3',
                    length: 120000
                },
                segments: [
                    {
                        id: 'seg1',
                        mode: 'taiko',
                        startMs: 0,
                        endMs: 60000,
                        judgeRule: 'taiko-default',
                        config: { donKeys: ['D', 'F'], kaKeys: ['J', 'K'], scrollSpeed: 1.0 },
                        notes: [
                            { type: 'don', time: 1000 },
                            { type: 'ka', time: 2000 },
                            { type: 'don', time: 3000, big: true }
                        ]
                    } as TaikoSegment
                ]
            }

            const result = formatter.toOsu(chart)

            expect(result.ok).toBe(true)
            if (result.ok) {
                const osuContent = result.value
                expect(osuContent).toContain('[HitObjects]')
                // Don note (hitsound 0)
                expect(osuContent).toContain('256,192,1000,1,0,0:0:0:0:')
                // Ka note (hitsound 8)
                expect(osuContent).toContain('256,192,2000,1,8,0:0:0:0:')
                // Big don note (type 5)
                expect(osuContent).toContain('256,192,3000,5,0,0:0:0:0:')
            }
        })

        test('exports osu-standard segment to .osu format', () => {
            const chart: Chart = {
                meta: {
                    title: 'Osu Song',
                    artist: 'Osu Artist',
                    audio: 'osu.mp3',
                    length: 120000
                },
                segments: [
                    {
                        id: 'seg1',
                        mode: 'osu-standard',
                        startMs: 0,
                        endMs: 60000,
                        judgeRule: 'osu-od8',
                        config: { circleSize: 4, approachRate: 9, scrollSpeed: 1.0 },
                        notes: [
                            { type: 'circle', x: 256, y: 192, time: 1000 },
                            { type: 'spinner', x: 256, y: 192, time: 2000, endTime: 3000 }
                        ]
                    } as OsuStandardSegment
                ]
            }

            const result = formatter.toOsu(chart)

            expect(result.ok).toBe(true)
            if (result.ok) {
                const osuContent = result.value
                expect(osuContent).toContain('CircleSize:4')
                expect(osuContent).toContain('ApproachRate:9')
                expect(osuContent).toContain('[HitObjects]')
                // Circle
                expect(osuContent).toContain('256,192,1000,1,0,0:0:0:0:')
                // Spinner
                expect(osuContent).toContain('256,192,2000,8,0,3000')
            }
        })

        test('exports slider with path correctly', () => {
            const chart: Chart = {
                meta: {
                    title: 'Slider Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 60000
                },
                segments: [
                    {
                        id: 'seg1',
                        mode: 'osu-standard',
                        startMs: 0,
                        endMs: 60000,
                        judgeRule: 'osu-od8',
                        config: { circleSize: 4, approachRate: 9, scrollSpeed: 1.0 },
                        notes: [
                            {
                                type: 'slider',
                                x: 100,
                                y: 100,
                                time: 1000,
                                sliderPath: {
                                    type: 'L',
                                    points: [{ x: 100, y: 100 }, { x: 200, y: 200 }],
                                    slides: 1,
                                    length: 141
                                }
                            }
                        ]
                    } as OsuStandardSegment
                ]
            }

            const result = formatter.toOsu(chart)

            expect(result.ok).toBe(true)
            if (result.ok) {
                const osuContent = result.value
                // Slider format: x,y,time,type,hitsound,pathType|points,slides,length
                expect(osuContent).toMatch(/100,100,1000,2,0,L\|100:100\|200:200,1,141/)
            }
        })

        test('includes timing points when present', () => {
            const chart: Chart = {
                meta: {
                    title: 'Timing Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 60000
                },
                segments: [
                    {
                        id: 'seg1',
                        mode: 'mania',
                        startMs: 0,
                        endMs: 60000,
                        judgeRule: 'mania-od8',
                        config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
                        notes: []
                    } as ManiaSegment
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
                    },
                    {
                        time: 10000,
                        beatLength: -100,
                        meter: 4,
                        sampleSet: 1,
                        sampleIndex: 0,
                        volume: 80,
                        uninherited: false,
                        effects: 1
                    }
                ]
            }

            const result = formatter.toOsu(chart)

            expect(result.ok).toBe(true)
            if (result.ok) {
                const osuContent = result.value
                expect(osuContent).toContain('[TimingPoints]')
                expect(osuContent).toContain('0,500,4,1,0,100,1,0')
                expect(osuContent).toContain('10000,-100,4,1,0,80,0,1')
            }
        })

        test('returns error for multi-mode chart', () => {
            const chart: Chart = {
                meta: {
                    title: 'Hybrid Song',
                    artist: 'Hybrid Artist',
                    audio: 'hybrid.mp3',
                    length: 180000
                },
                segments: [
                    {
                        id: 'seg1',
                        mode: 'mania',
                        startMs: 0,
                        endMs: 60000,
                        judgeRule: 'mania-od8',
                        config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
                        notes: []
                    } as ManiaSegment,
                    {
                        id: 'seg2',
                        mode: 'taiko',
                        startMs: 60000,
                        endMs: 120000,
                        judgeRule: 'taiko-default',
                        config: { donKeys: ['D', 'F'], kaKeys: ['J', 'K'], scrollSpeed: 1.0 },
                        notes: []
                    } as TaikoSegment
                ]
            }

            const result = formatter.toOsu(chart)

            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error.type).toBe('conversion')
                expect(result.error.message).toContain('multiple mode types')
            }
        })

        test('returns error for empty chart', () => {
            const chart: Chart = {
                meta: {
                    title: 'Empty',
                    artist: 'Empty',
                    audio: 'empty.mp3',
                    length: 0
                },
                segments: []
            }

            const result = formatter.toOsu(chart)

            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error.type).toBe('conversion')
            }
        })

        test('allows multiple segments of same mode', () => {
            const chart: Chart = {
                meta: {
                    title: 'Multi Mania',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 120000
                },
                segments: [
                    {
                        id: 'seg1',
                        mode: 'mania',
                        startMs: 0,
                        endMs: 60000,
                        judgeRule: 'mania-od8',
                        config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
                        notes: [{ lane: 0, time: 1000 }]
                    } as ManiaSegment,
                    {
                        id: 'seg2',
                        mode: 'mania',
                        startMs: 60000,
                        endMs: 120000,
                        judgeRule: 'mania-od8',
                        config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
                        notes: [{ lane: 1, time: 61000 }]
                    } as ManiaSegment
                ]
            }

            const result = formatter.toOsu(chart)

            expect(result.ok).toBe(true)
            if (result.ok) {
                const osuContent = result.value
                expect(osuContent).toContain('[HitObjects]')
                // Should contain notes from both segments
                expect(osuContent).toMatch(/1000,1,0/)
                expect(osuContent).toMatch(/61000,1,0/)
            }
        })

        test('converts judge rules to OD correctly', () => {
            const testCases = [
                { judgeRule: 'mania-od8', expectedOD: 8 },
                { judgeRule: 'mania-od7', expectedOD: 7 },
                { judgeRule: 'mania-od5', expectedOD: 5 },
                { judgeRule: 'custom-rule', expectedOD: 7 } // default
            ]

            for (const { judgeRule, expectedOD } of testCases) {
                const chart: Chart = {
                    meta: {
                        title: 'OD Test',
                        artist: 'Test',
                        audio: 'test.mp3',
                        length: 60000
                    },
                    segments: [
                        {
                            id: 'seg1',
                            mode: 'mania',
                            startMs: 0,
                            endMs: 60000,
                            judgeRule,
                            config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
                            notes: []
                        } as ManiaSegment
                    ]
                }

                const result = formatter.toOsu(chart)

                expect(result.ok).toBe(true)
                if (result.ok) {
                    expect(result.value).toContain(`OverallDifficulty:${expectedOD}`)
                }
            }
        })

        test('includes all osu metadata fields when present', () => {
            const chart: Chart = {
                meta: {
                    title: 'Full Metadata',
                    artist: 'Artist',
                    audio: 'test.mp3',
                    length: 60000
                },
                segments: [
                    {
                        id: 'seg1',
                        mode: 'mania',
                        startMs: 0,
                        endMs: 60000,
                        judgeRule: 'mania-od8',
                        config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
                        notes: []
                    } as ManiaSegment
                ],
                osuMetadata: {
                    creator: 'Mapper',
                    version: 'Insane',
                    source: 'Game Title',
                    tags: ['tag1', 'tag2', 'tag3'],
                    beatmapID: 12345,
                    beatmapSetID: 67890,
                    hpDrainRate: 7,
                    approachRate: 9,
                    sliderMultiplier: 1.8,
                    sliderTickRate: 2
                }
            }

            const result = formatter.toOsu(chart)

            expect(result.ok).toBe(true)
            if (result.ok) {
                const osuContent = result.value
                expect(osuContent).toContain('Creator:Mapper')
                expect(osuContent).toContain('Version:Insane')
                expect(osuContent).toContain('Source:Game Title')
                expect(osuContent).toContain('Tags:tag1 tag2 tag3')
                expect(osuContent).toContain('BeatmapID:12345')
                expect(osuContent).toContain('BeatmapSetID:67890')
                expect(osuContent).toContain('HPDrainRate:7')
                expect(osuContent).toContain('ApproachRate:9')
                expect(osuContent).toContain('SliderMultiplier:1.8')
                expect(osuContent).toContain('SliderTickRate:2')
            }
        })
    })
})
