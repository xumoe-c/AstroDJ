import { describe, test, expect } from 'vitest'
import { ChartConverterImpl } from './converter'
import type { Chart, ManiaSegment, TaikoSegment, OsuStandardSegment } from './types'

describe('ChartConverterImpl', () => {
    const converter = new ChartConverterImpl()

    // Helper to create a basic chart
    const createChart = (segments: any[]): Chart => ({
        meta: {
            title: 'Test Chart',
            artist: 'Test Artist',
            audio: 'test.mp3',
            length: 10000
        },
        segments
    })

    // Helper to create a mania segment
    const createManiaSegment = (id: string, startMs: number, endMs: number, notes: any[] = []): ManiaSegment => ({
        id,
        startMs,
        endMs,
        mode: 'mania',
        judgeRule: 'mania-od7',
        config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
        notes
    })

    // Helper to create a taiko segment
    const createTaikoSegment = (id: string, startMs: number, endMs: number, notes: any[] = []): TaikoSegment => ({
        id,
        startMs,
        endMs,
        mode: 'taiko',
        judgeRule: 'taiko-od7',
        config: { donKeys: ['D', 'F'], kaKeys: ['J', 'K'], scrollSpeed: 1.0 },
        notes
    })

    describe('singleToHybrid', () => {
        test('returns chart unchanged (already in hybrid format)', () => {
            const chart = createChart([
                createManiaSegment('s1', 0, 5000)
            ])

            const result = converter.singleToHybrid(chart)

            expect(result).toBe(chart)
        })

        test('works with multi-segment charts', () => {
            const chart = createChart([
                createManiaSegment('s1', 0, 5000),
                createTaikoSegment('s2', 5000, 10000)
            ])

            const result = converter.singleToHybrid(chart)

            expect(result).toBe(chart)
        })
    })

    describe('splitSegment', () => {
        test('splits segment at specified time', () => {
            const chart = createChart([
                createManiaSegment('s1', 0, 5000, [
                    { lane: 0, time: 1000 },
                    { lane: 1, time: 2000 },
                    { lane: 2, time: 3000 },
                    { lane: 3, time: 4000 }
                ])
            ])

            const result = converter.splitSegment(chart, 's1', 2500)

            expect(result.segments).toHaveLength(2)
            expect(result.segments[0].id).toBe('s1-1')
            expect(result.segments[0].startMs).toBe(0)
            expect(result.segments[0].endMs).toBe(2500)
            expect(result.segments[0].notes).toHaveLength(2)
            
            expect(result.segments[1].id).toBe('s1-2')
            expect(result.segments[1].startMs).toBe(2500)
            expect(result.segments[1].endMs).toBe(5000)
            expect(result.segments[1].notes).toHaveLength(2)
        })

        test('distributes notes correctly based on time', () => {
            const chart = createChart([
                createManiaSegment('s1', 0, 5000, [
                    { lane: 0, time: 1000 },
                    { lane: 1, time: 2000 },
                    { lane: 2, time: 3000 }
                ])
            ])

            const result = converter.splitSegment(chart, 's1', 2500)

            expect(result.segments[0].notes).toEqual([
                { lane: 0, time: 1000 },
                { lane: 1, time: 2000 }
            ])
            expect(result.segments[1].notes).toEqual([
                { lane: 2, time: 3000 }
            ])
        })

        test('preserves segment config and judge rule', () => {
            const chart = createChart([
                createManiaSegment('s1', 0, 5000)
            ])

            const result = converter.splitSegment(chart, 's1', 2500)

            expect(result.segments[0].mode).toBe('mania')
            expect(result.segments[0].judgeRule).toBe('mania-od7')
            expect(result.segments[0].config).toEqual({ keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 })
            
            expect(result.segments[1].mode).toBe('mania')
            expect(result.segments[1].judgeRule).toBe('mania-od7')
            expect(result.segments[1].config).toEqual({ keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 })
        })

        test('throws error if segment not found', () => {
            const chart = createChart([
                createManiaSegment('s1', 0, 5000)
            ])

            expect(() => {
                converter.splitSegment(chart, 'nonexistent', 2500)
            }).toThrow('Segment with id "nonexistent" not found')
        })

        test('throws error if split time is at segment start', () => {
            const chart = createChart([
                createManiaSegment('s1', 0, 5000)
            ])

            expect(() => {
                converter.splitSegment(chart, 's1', 0)
            }).toThrow('Split time 0ms must be between segment start')
        })

        test('throws error if split time is at segment end', () => {
            const chart = createChart([
                createManiaSegment('s1', 0, 5000)
            ])

            expect(() => {
                converter.splitSegment(chart, 's1', 5000)
            }).toThrow('Split time 5000ms must be between segment start')
        })

        test('throws error if split time is outside segment bounds', () => {
            const chart = createChart([
                createManiaSegment('s1', 0, 5000)
            ])

            expect(() => {
                converter.splitSegment(chart, 's1', 6000)
            }).toThrow('Split time 6000ms must be between segment start')
        })

        test('works with taiko segments', () => {
            const chart = createChart([
                createTaikoSegment('s1', 0, 5000, [
                    { type: 'don', time: 1000 },
                    { type: 'ka', time: 3000 }
                ])
            ])

            const result = converter.splitSegment(chart, 's1', 2000)

            expect(result.segments).toHaveLength(2)
            expect(result.segments[0].notes).toHaveLength(1)
            expect(result.segments[1].notes).toHaveLength(1)
        })

        test('maintains segment order in multi-segment chart', () => {
            const chart = createChart([
                createManiaSegment('s1', 0, 3000),
                createManiaSegment('s2', 3000, 6000),
                createManiaSegment('s3', 6000, 9000)
            ])

            const result = converter.splitSegment(chart, 's2', 4500)

            expect(result.segments).toHaveLength(4)
            expect(result.segments[0].id).toBe('s1')
            expect(result.segments[1].id).toBe('s2-1')
            expect(result.segments[2].id).toBe('s2-2')
            expect(result.segments[3].id).toBe('s3')
        })
    })

    describe('mergeSegments', () => {
        test('merges two adjacent segments', () => {
            const chart = createChart([
                createManiaSegment('s1', 0, 3000, [{ lane: 0, time: 1000 }]),
                createManiaSegment('s2', 3000, 6000, [{ lane: 1, time: 4000 }])
            ])

            const result = converter.mergeSegments(chart, ['s1', 's2'])

            expect(result.segments).toHaveLength(1)
            expect(result.segments[0].id).toBe('s1-s2')
            expect(result.segments[0].startMs).toBe(0)
            expect(result.segments[0].endMs).toBe(6000)
            expect(result.segments[0].notes).toHaveLength(2)
        })

        test('combines notes from all merged segments', () => {
            const chart = createChart([
                createManiaSegment('s1', 0, 2000, [{ lane: 0, time: 500 }]),
                createManiaSegment('s2', 2000, 4000, [{ lane: 1, time: 2500 }]),
                createManiaSegment('s3', 4000, 6000, [{ lane: 2, time: 5000 }])
            ])

            const result = converter.mergeSegments(chart, ['s1', 's2', 's3'])

            expect(result.segments[0].notes).toHaveLength(3)
            expect(result.segments[0].notes).toEqual([
                { lane: 0, time: 500 },
                { lane: 1, time: 2500 },
                { lane: 2, time: 5000 }
            ])
        })

        test('preserves mode and config from first segment', () => {
            const chart = createChart([
                createManiaSegment('s1', 0, 3000),
                createManiaSegment('s2', 3000, 6000)
            ])

            const result = converter.mergeSegments(chart, ['s1', 's2'])

            expect(result.segments[0].mode).toBe('mania')
            expect(result.segments[0].judgeRule).toBe('mania-od7')
            expect(result.segments[0].config).toEqual({ keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 })
        })

        test('handles segments provided in wrong order', () => {
            const chart = createChart([
                createManiaSegment('s1', 0, 3000),
                createManiaSegment('s2', 3000, 6000),
                createManiaSegment('s3', 6000, 9000)
            ])

            const result = converter.mergeSegments(chart, ['s3', 's1', 's2'])

            expect(result.segments[0].startMs).toBe(0)
            expect(result.segments[0].endMs).toBe(9000)
        })

        test('throws error if less than 2 segments provided', () => {
            const chart = createChart([
                createManiaSegment('s1', 0, 3000)
            ])

            expect(() => {
                converter.mergeSegments(chart, ['s1'])
            }).toThrow('Must provide at least 2 segment IDs to merge')
        })

        test('throws error if segment not found', () => {
            const chart = createChart([
                createManiaSegment('s1', 0, 3000)
            ])

            expect(() => {
                converter.mergeSegments(chart, ['s1', 'nonexistent'])
            }).toThrow('Segment with id "nonexistent" not found')
        })

        test('throws error if segments are different modes', () => {
            const chart = createChart([
                createManiaSegment('s1', 0, 3000),
                createTaikoSegment('s2', 3000, 6000)
            ])

            expect(() => {
                converter.mergeSegments(chart, ['s1', 's2'])
            }).toThrow('All segments must be the same mode to merge')
        })

        test('throws error if segments have gap', () => {
            const chart = createChart([
                createManiaSegment('s1', 0, 3000),
                createManiaSegment('s2', 4000, 7000)
            ])

            expect(() => {
                converter.mergeSegments(chart, ['s1', 's2'])
            }).toThrow('are not adjacent (gap or overlap detected)')
        })

        test('throws error if segments overlap', () => {
            const chart = createChart([
                createManiaSegment('s1', 0, 4000),
                createManiaSegment('s2', 3000, 7000)
            ])

            expect(() => {
                converter.mergeSegments(chart, ['s1', 's2'])
            }).toThrow('are not adjacent (gap or overlap detected)')
        })

        test('preserves other segments in chart', () => {
            const chart = createChart([
                createManiaSegment('s1', 0, 2000),
                createManiaSegment('s2', 2000, 4000),
                createTaikoSegment('s3', 4000, 6000)
            ])

            const result = converter.mergeSegments(chart, ['s1', 's2'])

            expect(result.segments).toHaveLength(2)
            expect(result.segments.find(s => s.id === 's3')).toBeDefined()
        })
    })

    describe('addSegment', () => {
        test('adds segment to empty chart', () => {
            const chart = createChart([])
            const newSegment = createManiaSegment('s1', 0, 3000)

            const result = converter.addSegment(chart, newSegment)

            expect(result.segments).toHaveLength(1)
            expect(result.segments[0]).toBe(newSegment)
        })

        test('adds segment and maintains sort order', () => {
            const chart = createChart([
                createManiaSegment('s1', 0, 3000),
                createManiaSegment('s3', 6000, 9000)
            ])
            const newSegment = createManiaSegment('s2', 3000, 6000)

            const result = converter.addSegment(chart, newSegment)

            expect(result.segments).toHaveLength(3)
            expect(result.segments[0].id).toBe('s1')
            expect(result.segments[1].id).toBe('s2')
            expect(result.segments[2].id).toBe('s3')
        })

        test('adds segment at beginning', () => {
            const chart = createChart([
                createManiaSegment('s2', 3000, 6000)
            ])
            const newSegment = createManiaSegment('s1', 0, 3000)

            const result = converter.addSegment(chart, newSegment)

            expect(result.segments[0].id).toBe('s1')
            expect(result.segments[1].id).toBe('s2')
        })

        test('adds segment at end', () => {
            const chart = createChart([
                createManiaSegment('s1', 0, 3000)
            ])
            const newSegment = createManiaSegment('s2', 3000, 6000)

            const result = converter.addSegment(chart, newSegment)

            expect(result.segments[0].id).toBe('s1')
            expect(result.segments[1].id).toBe('s2')
        })

        test('allows different mode segments', () => {
            const chart = createChart([
                createManiaSegment('s1', 0, 3000)
            ])
            const newSegment = createTaikoSegment('s2', 3000, 6000)

            const result = converter.addSegment(chart, newSegment)

            expect(result.segments).toHaveLength(2)
            expect(result.segments[0].mode).toBe('mania')
            expect(result.segments[1].mode).toBe('taiko')
        })

        test('throws error if segment overlaps with existing segment', () => {
            const chart = createChart([
                createManiaSegment('s1', 0, 5000)
            ])
            const newSegment = createManiaSegment('s2', 3000, 7000)

            expect(() => {
                converter.addSegment(chart, newSegment)
            }).toThrow('New segment overlaps with existing segment "s1"')
        })

        test('throws error if segment is completely inside existing segment', () => {
            const chart = createChart([
                createManiaSegment('s1', 0, 10000)
            ])
            const newSegment = createManiaSegment('s2', 3000, 7000)

            expect(() => {
                converter.addSegment(chart, newSegment)
            }).toThrow('New segment overlaps with existing segment "s1"')
        })

        test('throws error if segment completely contains existing segment', () => {
            const chart = createChart([
                createManiaSegment('s1', 3000, 7000)
            ])
            const newSegment = createManiaSegment('s2', 0, 10000)

            expect(() => {
                converter.addSegment(chart, newSegment)
            }).toThrow('New segment overlaps with existing segment "s1"')
        })

        test('allows adjacent segments (no gap)', () => {
            const chart = createChart([
                createManiaSegment('s1', 0, 3000)
            ])
            const newSegment = createManiaSegment('s2', 3000, 6000)

            const result = converter.addSegment(chart, newSegment)

            expect(result.segments).toHaveLength(2)
        })

        test('allows segments with gap', () => {
            const chart = createChart([
                createManiaSegment('s1', 0, 3000)
            ])
            const newSegment = createManiaSegment('s2', 5000, 8000)

            const result = converter.addSegment(chart, newSegment)

            expect(result.segments).toHaveLength(2)
        })

        test('preserves original chart segments', () => {
            const chart = createChart([
                createManiaSegment('s1', 0, 3000),
                createManiaSegment('s2', 3000, 6000)
            ])
            const newSegment = createManiaSegment('s3', 6000, 9000)

            const result = converter.addSegment(chart, newSegment)

            expect(result.segments).toHaveLength(3)
            expect(chart.segments).toHaveLength(2) // Original unchanged
        })
    })

    describe('integration tests', () => {
        test('split then merge returns equivalent segment', () => {
            const chart = createChart([
                createManiaSegment('s1', 0, 6000, [
                    { lane: 0, time: 1000 },
                    { lane: 1, time: 2000 },
                    { lane: 2, time: 4000 },
                    { lane: 3, time: 5000 }
                ])
            ])

            const split = converter.splitSegment(chart, 's1', 3000)
            const merged = converter.mergeSegments(split, ['s1-1', 's1-2'])

            expect(merged.segments).toHaveLength(1)
            expect(merged.segments[0].startMs).toBe(0)
            expect(merged.segments[0].endMs).toBe(6000)
            expect(merged.segments[0].notes).toHaveLength(4)
        })

        test('add then split creates three segments', () => {
            const chart = createChart([
                createManiaSegment('s1', 0, 3000)
            ])

            const added = converter.addSegment(chart, createManiaSegment('s2', 3000, 9000))
            const split = converter.splitSegment(added, 's2', 6000)

            expect(split.segments).toHaveLength(3)
            expect(split.segments[0].id).toBe('s1')
            expect(split.segments[1].id).toBe('s2-1')
            expect(split.segments[2].id).toBe('s2-2')
        })
    })
})
