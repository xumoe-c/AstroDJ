import { describe, test, expect } from 'vitest'
import { ChartFormatterImpl } from './formatter'
import { ChartParserImpl } from './parser'
import type { Chart, ManiaSegment, TaikoSegment } from './types'

describe('ChartFormatter - Integration Tests', () => {
    const formatter = new ChartFormatterImpl()
    const parser = new ChartParserImpl()

    test('round-trip: parse → format → parse produces equivalent chart', () => {
        const originalChart: Chart = {
            meta: {
                title: 'Round Trip Test',
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
                    config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.5 },
                    notes: [
                        { lane: 0, time: 1000 },
                        { lane: 1, time: 2000, endTime: 3000 },
                        { lane: 2, time: 4000 }
                    ]
                } as ManiaSegment,
                {
                    id: 'seg2',
                    mode: 'taiko',
                    startMs: 60000,
                    endMs: 120000,
                    judgeRule: 'taiko-default',
                    config: { donKeys: ['D', 'F'], kaKeys: ['J', 'K'], scrollSpeed: 1.0 },
                    notes: [
                        { type: 'don', time: 61000 },
                        { type: 'ka', time: 62000, big: true }
                    ]
                } as TaikoSegment
            ]
        }

        // Format to JSON
        const json = formatter.toJSON(originalChart)

        // Parse back
        const parseResult = parser.parseJSON(json)

        // Verify parse succeeded
        expect(parseResult.ok).toBe(true)
        if (!parseResult.ok) return

        const parsedChart = parseResult.value

        // Verify equivalence
        expect(parsedChart.meta).toEqual(originalChart.meta)
        expect(parsedChart.segments).toHaveLength(originalChart.segments.length)
        
        // Verify first segment
        expect(parsedChart.segments[0].id).toBe('seg1')
        expect(parsedChart.segments[0].mode).toBe('mania')
        expect((parsedChart.segments[0] as ManiaSegment).notes).toHaveLength(3)
        
        // Verify second segment
        expect(parsedChart.segments[1].id).toBe('seg2')
        expect(parsedChart.segments[1].mode).toBe('taiko')
        expect((parsedChart.segments[1] as TaikoSegment).notes).toHaveLength(2)
    })

    test('round-trip preserves osu metadata', () => {
        const originalChart: Chart = {
            meta: {
                title: 'Osu Test',
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
                creator: 'Mapper',
                version: 'Hard',
                source: 'Game',
                tags: ['tag1', 'tag2'],
                beatmapID: 12345,
                beatmapSetID: 67890,
                hpDrainRate: 5,
                approachRate: 9,
                sliderMultiplier: 1.4,
                sliderTickRate: 1
            }
        }

        const json = formatter.toJSON(originalChart)
        const parseResult = parser.parseJSON(json)

        expect(parseResult.ok).toBe(true)
        if (!parseResult.ok) return

        const parsedChart = parseResult.value

        expect(parsedChart.osuMetadata).toBeDefined()
        expect(parsedChart.osuMetadata?.creator).toBe('Mapper')
        expect(parsedChart.osuMetadata?.version).toBe('Hard')
        expect(parsedChart.osuMetadata?.tags).toEqual(['tag1', 'tag2'])
        expect(parsedChart.osuMetadata?.beatmapID).toBe(12345)
    })

    test('round-trip preserves timing points', () => {
        const originalChart: Chart = {
            meta: {
                title: 'Timing Test',
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
                },
                {
                    time: 60000,
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

        const json = formatter.toJSON(originalChart)
        const parseResult = parser.parseJSON(json)

        expect(parseResult.ok).toBe(true)
        if (!parseResult.ok) return

        const parsedChart = parseResult.value

        expect(parsedChart.timingPoints).toBeDefined()
        expect(parsedChart.timingPoints).toHaveLength(2)
        expect(parsedChart.timingPoints?.[0].beatLength).toBe(500)
        expect(parsedChart.timingPoints?.[1].beatLength).toBe(-100)
        expect(parsedChart.segments[0].timingContext).toBe(0)
    })

    test('formatted JSON has proper indentation', () => {
        const chart: Chart = {
            meta: {
                title: 'Indentation Test',
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
                    config: { keys: ['D', 'F'], scrollSpeed: 1.0 },
                    notes: []
                } as ManiaSegment
            ]
        }

        const json = formatter.toJSON(chart)

        // Verify 2-space indentation
        const lines = json.split('\n')
        
        // Check that nested objects have proper indentation
        expect(lines.some(line => line.startsWith('  "meta"'))).toBe(true)
        expect(lines.some(line => line.startsWith('    "title"'))).toBe(true)
        expect(lines.some(line => line.startsWith('  "segments"'))).toBe(true)
    })

    test('multiple round-trips produce stable output', () => {
        const originalChart: Chart = {
            meta: {
                title: 'Stability Test',
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
                    config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
                    notes: [{ lane: 0, time: 1000 }]
                } as ManiaSegment
            ]
        }

        // First round-trip
        const json1 = formatter.toJSON(originalChart)
        const parsed1 = parser.parseJSON(json1)
        expect(parsed1.ok).toBe(true)
        if (!parsed1.ok) return

        // Second round-trip
        const json2 = formatter.toJSON(parsed1.value)
        const parsed2 = parser.parseJSON(json2)
        expect(parsed2.ok).toBe(true)
        if (!parsed2.ok) return

        // Third round-trip
        const json3 = formatter.toJSON(parsed2.value)
        const parsed3 = parser.parseJSON(json3)
        expect(parsed3.ok).toBe(true)
        if (!parsed3.ok) return

        // All parsed charts should be semantically equivalent
        expect(parsed2.value).toEqual(parsed1.value)
        expect(parsed3.value).toEqual(parsed1.value)
    })
})
