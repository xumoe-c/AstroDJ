import { describe, test, expect } from 'vitest'
import { ChartParserImpl } from './parser'
import { ChartValidatorImpl } from './validator'

describe('ChartParserImpl - Integration Tests', () => {
    const parser = new ChartParserImpl()
    const validator = new ChartValidatorImpl()

    test('parses complete hybrid chart with multiple segments', () => {
        const hybridChart = {
            meta: {
                title: 'Hybrid Test Song',
                artist: 'Test Artist',
                audio: 'hybrid.mp3',
                length: 180000
            },
            segments: [
                {
                    id: 'mania-intro',
                    startMs: 0,
                    endMs: 60000,
                    mode: 'mania',
                    judgeRule: 'mania-od8',
                    config: {
                        keys: ['D', 'F', 'J', 'K'],
                        scrollSpeed: 1.5
                    },
                    notes: [
                        { lane: 0, time: 1000 },
                        { lane: 1, time: 2000 },
                        { lane: 2, time: 3000, endTime: 4000 }
                    ]
                },
                {
                    id: 'taiko-middle',
                    startMs: 60000,
                    endMs: 120000,
                    mode: 'taiko',
                    judgeRule: 'taiko-od7',
                    config: {
                        donKeys: ['D', 'F'],
                        kaKeys: ['J', 'K'],
                        scrollSpeed: 1.2
                    },
                    notes: [
                        { type: 'don', time: 61000 },
                        { type: 'ka', time: 62000, big: true },
                        { type: 'roll', time: 63000, endTime: 65000 }
                    ]
                },
                {
                    id: 'osu-outro',
                    startMs: 120000,
                    endMs: 180000,
                    mode: 'osu-standard',
                    judgeRule: 'osu-od8',
                    config: {
                        circleSize: 4,
                        approachRate: 9,
                        scrollSpeed: 1.0
                    },
                    notes: [
                        { type: 'circle', x: 256, y: 192, time: 121000 },
                        { type: 'spinner', x: 256, y: 192, time: 122000, endTime: 125000 },
                        {
                            type: 'slider',
                            x: 100,
                            y: 100,
                            time: 126000,
                            endTime: 128000,
                            sliderPath: {
                                type: 'L',
                                points: [
                                    { x: 100, y: 100 },
                                    { x: 200, y: 200 }
                                ],
                                slides: 1,
                                length: 141.42
                            }
                        }
                    ]
                }
            ],
            osuMetadata: {
                creator: 'Test Mapper',
                version: 'Hybrid Insane',
                source: 'Test Game',
                tags: ['hybrid', 'test', 'multi-mode'],
                beatmapID: 123456,
                beatmapSetID: 78910
            },
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

        const json = JSON.stringify(hybridChart)
        const result = parser.parseJSON(json)

        expect(result.ok).toBe(true)
        if (result.ok) {
            const chart = result.value

            // Verify meta
            expect(chart.meta.title).toBe('Hybrid Test Song')
            expect(chart.meta.artist).toBe('Test Artist')
            expect(chart.meta.audio).toBe('hybrid.mp3')
            expect(chart.meta.length).toBe(180000)

            // Verify segments
            expect(chart.segments).toHaveLength(3)

            // Verify mania segment
            expect(chart.segments[0].mode).toBe('mania')
            expect(chart.segments[0].id).toBe('mania-intro')
            expect(chart.segments[0].startMs).toBe(0)
            expect(chart.segments[0].endMs).toBe(60000)

            // Verify taiko segment
            expect(chart.segments[1].mode).toBe('taiko')
            expect(chart.segments[1].id).toBe('taiko-middle')

            // Verify osu-standard segment
            expect(chart.segments[2].mode).toBe('osu-standard')
            expect(chart.segments[2].id).toBe('osu-outro')

            // Verify osuMetadata
            expect(chart.osuMetadata).toBeDefined()
            expect(chart.osuMetadata?.creator).toBe('Test Mapper')
            expect(chart.osuMetadata?.version).toBe('Hybrid Insane')
            expect(chart.osuMetadata?.tags).toEqual(['hybrid', 'test', 'multi-mode'])

            // Verify timingPoints
            expect(chart.timingPoints).toBeDefined()
            expect(chart.timingPoints).toHaveLength(2)
            expect(chart.timingPoints![0].uninherited).toBe(true)
            expect(chart.timingPoints![1].uninherited).toBe(false)
        }
    })

    test('handles descriptive errors for complex validation failures', () => {
        const invalidChart = {
            meta: {
                title: 'Invalid Chart',
                artist: 'Test',
                audio: 'test.mp3',
                length: 10000
            },
            segments: [
                {
                    id: 'bad-segment',
                    startMs: 0,
                    endMs: 10000,
                    mode: 'unknown-mode', // Invalid mode
                    judgeRule: 'test',
                    config: {},
                    notes: []
                }
            ]
        }

        const json = JSON.stringify(invalidChart)
        const result = parser.parseJSON(json)

        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.error.type).toBe('schema')
            expect(result.error.message).toContain('Unknown mode')
            expect(result.error.message).toContain('mania, taiko, osu-standard')
            expect(result.error.field).toContain('segments[0].mode')
        }
    })

    test('validates all required segment fields', () => {
        const incompleteSegment = {
            meta: {
                title: 'Test',
                artist: 'Test',
                audio: 'test.mp3',
                length: 10000
            },
            segments: [
                {
                    id: 'incomplete',
                    startMs: 0
                    // Missing: endMs, mode, judgeRule, config, notes
                }
            ]
        }

        const json = JSON.stringify(incompleteSegment)
        const result = parser.parseJSON(json)

        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.error.type).toBe('schema')
            expect(result.error.field).toContain('segments[0]')
            // Should mention one of the missing required fields
            expect(
                result.error.message.includes('endMs') ||
                result.error.message.includes('mode') ||
                result.error.message.includes('judgeRule') ||
                result.error.message.includes('config') ||
                result.error.message.includes('notes')
            ).toBe(true)
        }
    })

    test('parser and validator work together - valid chart', () => {
        const validChart = {
            meta: {
                title: 'Valid Chart',
                artist: 'Test Artist',
                audio: 'test.mp3',
                length: 20000
            },
            segments: [
                {
                    id: 'seg1',
                    startMs: 0,
                    endMs: 10000,
                    mode: 'mania',
                    judgeRule: 'mania-od7',
                    config: {
                        keys: ['D', 'F', 'J', 'K'],
                        scrollSpeed: 1.0
                    },
                    notes: [
                        { lane: 0, time: 1000 },
                        { lane: 1, time: 5000 }
                    ]
                },
                {
                    id: 'seg2',
                    startMs: 10000,
                    endMs: 20000,
                    mode: 'taiko',
                    judgeRule: 'taiko-od7',
                    config: {
                        donKeys: ['D', 'F'],
                        kaKeys: ['J', 'K'],
                        scrollSpeed: 1.0
                    },
                    notes: [
                        { type: 'don', time: 12000 }
                    ]
                }
            ]
        }

        const json = JSON.stringify(validChart)
        const parseResult = parser.parseJSON(json)

        expect(parseResult.ok).toBe(true)
        if (parseResult.ok) {
            const validationErrors = validator.validate(parseResult.value)
            expect(validationErrors).toHaveLength(0)
        }
    })

    test('parser and validator work together - invalid chart with overlaps', () => {
        const invalidChart = {
            meta: {
                title: 'Invalid Chart',
                artist: 'Test Artist',
                audio: 'test.mp3',
                length: 20000
            },
            segments: [
                {
                    id: 'seg1',
                    startMs: 0,
                    endMs: 10000,
                    mode: 'mania',
                    judgeRule: 'mania-od7',
                    config: {
                        keys: ['D', 'F', 'J', 'K'],
                        scrollSpeed: 1.0
                    },
                    notes: []
                },
                {
                    id: 'seg2',
                    startMs: 8000, // Overlaps with seg1
                    endMs: 16000,
                    mode: 'taiko',
                    judgeRule: 'taiko-od7',
                    config: {
                        donKeys: ['D'],
                        kaKeys: ['K'],
                        scrollSpeed: 1.0
                    },
                    notes: []
                }
            ]
        }

        const json = JSON.stringify(invalidChart)
        const parseResult = parser.parseJSON(json)

        expect(parseResult.ok).toBe(true)
        if (parseResult.ok) {
            const validationErrors = validator.validate(parseResult.value)
            expect(validationErrors.length).toBeGreaterThan(0)
            expect(validationErrors.some(e => e.type === 'overlap')).toBe(true)
        }
    })

    test('parser and validator work together - chart with multiple validation errors', () => {
        const problematicChart = {
            meta: {
                title: 'Problematic Chart',
                artist: 'Test Artist',
                audio: 'test.mp3',
                length: 20000
            },
            segments: [
                {
                    id: 'seg1',
                    startMs: -100, // Negative start time
                    endMs: 10000,
                    mode: 'mania',
                    judgeRule: 'mania-od7',
                    config: {
                        keys: [], // No keys
                        scrollSpeed: 1.0
                    },
                    notes: [
                        { lane: 0, time: 15000 } // Note outside segment bounds
                    ]
                },
                {
                    id: 'seg2',
                    startMs: 12000, // Large gap (2000ms)
                    endMs: 20000,
                    mode: 'osu-standard',
                    judgeRule: 'osu-od8',
                    config: {
                        circleSize: 15, // Invalid circle size
                        approachRate: 9,
                        scrollSpeed: 1.0
                    },
                    notes: []
                }
            ]
        }

        const json = JSON.stringify(problematicChart)
        const parseResult = parser.parseJSON(json)

        expect(parseResult.ok).toBe(true)
        if (parseResult.ok) {
            const validationErrors = validator.validate(parseResult.value)
            
            // Should have multiple errors
            expect(validationErrors.length).toBeGreaterThan(3)
            
            // Check for specific error types
            expect(validationErrors.some(e => e.type === 'timing' && e.message.includes('negative'))).toBe(true)
            expect(validationErrors.some(e => e.type === 'config' && e.message.includes('keys'))).toBe(true)
            expect(validationErrors.some(e => e.type === 'note')).toBe(true)
            expect(validationErrors.some(e => e.type === 'gap')).toBe(true)
            expect(validationErrors.some(e => e.type === 'config' && e.message.includes('circleSize'))).toBe(true)
        }
    })
})
