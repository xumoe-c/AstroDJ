import { describe, test, expect } from 'vitest'
import { ChartConverterImpl } from './converter'
import { ChartFormatterImpl } from './formatter'
import type { Chart, ManiaSegment } from './types'

/**
 * Integration tests for ChartConverter and ChartFormatter
 * Validates that converter operations produce charts that can be serialized correctly
 */
describe('ChartConverter + ChartFormatter Integration', () => {
    const converter = new ChartConverterImpl()
    const formatter = new ChartFormatterImpl()

    const createManiaSegment = (id: string, startMs: number, endMs: number, notes: any[] = []): ManiaSegment => ({
        id,
        startMs,
        endMs,
        mode: 'mania',
        judgeRule: 'mania-od7',
        config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
        notes
    })

    test('split chart can be serialized to JSON', () => {
        const chart: Chart = {
            meta: {
                title: 'Test Song',
                artist: 'Test Artist',
                audio: 'test.mp3',
                length: 60000
            },
            segments: [
                createManiaSegment('s1', 0, 60000, [
                    { lane: 0, time: 10000 },
                    { lane: 1, time: 20000 },
                    { lane: 2, time: 40000 },
                    { lane: 3, time: 50000 }
                ])
            ]
        }

        // Split the segment at 30000ms
        const splitChart = converter.splitSegment(chart, 's1', 30000)

        // Serialize to JSON
        const json = formatter.toJSON(splitChart)
        const parsed = JSON.parse(json)

        // Verify structure
        expect(parsed.segments).toHaveLength(2)
        expect(parsed.segments[0].id).toBe('s1-1')
        expect(parsed.segments[0].notes).toHaveLength(2) // notes at 10000 and 20000
        expect(parsed.segments[1].id).toBe('s1-2')
        expect(parsed.segments[1].notes).toHaveLength(2) // notes at 40000 and 50000
    })

    test('merged chart can be serialized to JSON', () => {
        const chart: Chart = {
            meta: {
                title: 'Test Song',
                artist: 'Test Artist',
                audio: 'test.mp3',
                length: 90000
            },
            segments: [
                createManiaSegment('s1', 0, 30000, [{ lane: 0, time: 10000 }]),
                createManiaSegment('s2', 30000, 60000, [{ lane: 1, time: 40000 }]),
                createManiaSegment('s3', 60000, 90000, [{ lane: 2, time: 70000 }])
            ]
        }

        // Merge segments
        const mergedChart = converter.mergeSegments(chart, ['s1', 's2', 's3'])

        // Serialize to JSON
        const json = formatter.toJSON(mergedChart)
        const parsed = JSON.parse(json)

        // Verify structure
        expect(parsed.segments).toHaveLength(1)
        expect(parsed.segments[0].id).toBe('s1-s2-s3')
        expect(parsed.segments[0].notes).toHaveLength(3)
        expect(parsed.segments[0].startMs).toBe(0)
        expect(parsed.segments[0].endMs).toBe(90000)
    })

    test('chart with added segment can be serialized to JSON', () => {
        const chart: Chart = {
            meta: {
                title: 'Test Song',
                artist: 'Test Artist',
                audio: 'test.mp3',
                length: 90000
            },
            segments: [
                createManiaSegment('s1', 0, 30000),
                createManiaSegment('s3', 60000, 90000)
            ]
        }

        // Add segment in the middle
        const newSegment = createManiaSegment('s2', 30000, 60000, [{ lane: 1, time: 45000 }])
        const extendedChart = converter.addSegment(chart, newSegment)

        // Serialize to JSON
        const json = formatter.toJSON(extendedChart)
        const parsed = JSON.parse(json)

        // Verify structure
        expect(parsed.segments).toHaveLength(3)
        expect(parsed.segments[0].id).toBe('s1')
        expect(parsed.segments[1].id).toBe('s2')
        expect(parsed.segments[2].id).toBe('s3')
    })

    test('split chart with single mode can be exported to .osu', () => {
        const chart: Chart = {
            meta: {
                title: 'Test Song',
                artist: 'Test Artist',
                audio: 'test.mp3',
                length: 60000
            },
            segments: [
                createManiaSegment('s1', 0, 60000, [
                    { lane: 0, time: 10000 },
                    { lane: 1, time: 30000 },
                    { lane: 2, time: 50000 }
                ])
            ],
            osuMetadata: {
                creator: 'Mapper',
                version: 'Hard'
            }
        }

        // Split the segment
        const splitChart = converter.splitSegment(chart, 's1', 30000)

        // Export to .osu (should work because all segments are mania)
        const result = formatter.toOsu(splitChart)

        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.value).toContain('osu file format v14')
            expect(result.value).toContain('Title:Test Song')
            expect(result.value).toContain('Creator:Mapper')
            expect(result.value).toContain('[HitObjects]')
            // Should contain all notes from both segments
            expect(result.value).toMatch(/10000/)
            expect(result.value).toMatch(/30000/)
            expect(result.value).toMatch(/50000/)
        }
    })

    test('merged chart can be exported to .osu', () => {
        const chart: Chart = {
            meta: {
                title: 'Test Song',
                artist: 'Test Artist',
                audio: 'test.mp3',
                length: 60000
            },
            segments: [
                createManiaSegment('s1', 0, 30000, [{ lane: 0, time: 10000 }]),
                createManiaSegment('s2', 30000, 60000, [{ lane: 1, time: 40000 }])
            ],
            osuMetadata: {
                creator: 'Mapper',
                version: 'Normal'
            }
        }

        // Merge segments
        const mergedChart = converter.mergeSegments(chart, ['s1', 's2'])

        // Export to .osu
        const result = formatter.toOsu(mergedChart)

        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.value).toContain('Title:Test Song')
            expect(result.value).toContain('Version:Normal')
            expect(result.value).toContain('[HitObjects]')
            // Should contain notes from both original segments
            expect(result.value).toMatch(/10000/)
            expect(result.value).toMatch(/40000/)
        }
    })

    test('round-trip: JSON -> split -> merge -> JSON preserves data', () => {
        const originalChart: Chart = {
            meta: {
                title: 'Round Trip Test',
                artist: 'Test Artist',
                audio: 'test.mp3',
                length: 90000
            },
            segments: [
                createManiaSegment('original', 0, 90000, [
                    { lane: 0, time: 10000 },
                    { lane: 1, time: 30000 },
                    { lane: 2, time: 50000 },
                    { lane: 3, time: 70000 }
                ])
            ]
        }

        // Serialize original
        const originalJson = formatter.toJSON(originalChart)

        // Split into three segments
        let chart = converter.splitSegment(originalChart, 'original', 30000)
        chart = converter.splitSegment(chart, 'original-2', 60000)

        // Merge back together
        chart = converter.mergeSegments(chart, ['original-1', 'original-2-1', 'original-2-2'])

        // Serialize result
        const resultJson = formatter.toJSON(chart)

        // Parse both
        const originalParsed = JSON.parse(originalJson)
        const resultParsed = JSON.parse(resultJson)

        // Verify metadata preserved
        expect(resultParsed.meta).toEqual(originalParsed.meta)

        // Verify notes preserved (order and content)
        expect(resultParsed.segments[0].notes).toEqual(originalParsed.segments[0].notes)

        // Verify time bounds preserved
        expect(resultParsed.segments[0].startMs).toBe(originalParsed.segments[0].startMs)
        expect(resultParsed.segments[0].endMs).toBe(originalParsed.segments[0].endMs)
    })

    test('complex workflow: add -> split -> merge -> export', () => {
        // Start with a simple chart
        let chart: Chart = {
            meta: {
                title: 'Complex Test',
                artist: 'Test Artist',
                audio: 'test.mp3',
                length: 120000
            },
            segments: [
                createManiaSegment('intro', 0, 30000, [{ lane: 0, time: 10000 }])
            ],
            osuMetadata: {
                creator: 'Mapper',
                version: 'Expert'
            }
        }

        // Add outro segment
        chart = converter.addSegment(chart, createManiaSegment('outro', 90000, 120000, [{ lane: 3, time: 100000 }]))

        // Add middle segment
        chart = converter.addSegment(chart, createManiaSegment('middle', 30000, 90000, [
            { lane: 1, time: 45000 },
            { lane: 2, time: 60000 },
            { lane: 1, time: 75000 }
        ]))

        // Split middle segment
        chart = converter.splitSegment(chart, 'middle', 60000)

        // Verify structure
        expect(chart.segments).toHaveLength(4)
        expect(chart.segments.map(s => s.id)).toEqual(['intro', 'middle-1', 'middle-2', 'outro'])

        // Serialize to JSON
        const json = formatter.toJSON(chart)
        const parsed = JSON.parse(json)
        expect(parsed.segments).toHaveLength(4)

        // Export to .osu (should work - all mania)
        const osuResult = formatter.toOsu(chart)
        expect(osuResult.ok).toBe(true)
        if (osuResult.ok) {
            expect(osuResult.value).toContain('Title:Complex Test')
            expect(osuResult.value).toContain('Version:Expert')
            // Should contain all notes
            expect(osuResult.value).toMatch(/10000/)
            expect(osuResult.value).toMatch(/45000/)
            expect(osuResult.value).toMatch(/60000/)
            expect(osuResult.value).toMatch(/75000/)
            expect(osuResult.value).toMatch(/100000/)
        }
    })
})
