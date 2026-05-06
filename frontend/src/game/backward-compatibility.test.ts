/**
 * Backward Compatibility Tests for Hybrid Chart System
 * 
 * Task 12.4: Test backward compatibility with existing charts
 * Requirements: 1.6
 * 
 * These tests verify that existing single-mode charts (mania and taiko)
 * continue to work without modification after implementing the hybrid chart system.
 */

import { describe, test, expect } from 'vitest'
import { ChartParserImpl } from './parser'
import { ChartValidatorImpl } from './validator'
import { GlobalScorer, calculateTotalNotes } from './scorer'
import { TimelineController } from './timeline'
import { ManiaRuntime } from './runtimes/mania'
import { TaikoRuntime } from './runtimes/taiko'
import type { Chart, ManiaSegment, TaikoSegment, Judgement } from './types'
import type { RuntimeContext } from './runtimes/interface'

describe('Backward Compatibility', () => {
    const parser = new ChartParserImpl()
    const validator = new ChartValidatorImpl()

    describe('Single-mode mania charts', () => {
        test('loads and validates single-segment mania chart', () => {
            const chartJson = JSON.stringify({
                meta: {
                    title: 'Legacy Mania Chart',
                    artist: 'Test Artist',
                    audio: 'test.mp3',
                    length: 60000
                },
                segments: [
                    {
                        id: 'main',
                        startMs: 0,
                        endMs: 60000,
                        mode: 'mania',
                        judgeRule: 'mania-od7',
                        config: {
                            keys: ['D', 'F', 'J', 'K'],
                            scrollSpeed: 0.8
                        },
                        notes: [
                            { lane: 0, time: 1000 },
                            { lane: 1, time: 2000 },
                            { lane: 2, time: 3000 },
                            { lane: 3, time: 4000 }
                        ]
                    }
                ]
            })

            const parseResult = parser.parseJSON(chartJson)
            expect(parseResult.ok).toBe(true)
            
            if (parseResult.ok) {
                const chart = parseResult.value
                expect(chart.segments).toHaveLength(1)
                expect(chart.segments[0].mode).toBe('mania')
                
                const errors = validator.validate(chart)
                expect(errors).toHaveLength(0)
            }
        })

        test('calculates total notes correctly for single-segment mania chart', () => {
            const chart: Chart = {
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 10000
                },
                segments: [
                    {
                        id: 's1',
                        startMs: 0,
                        endMs: 10000,
                        mode: 'mania',
                        judgeRule: 'mania-od7',
                        config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
                        notes: [
                            { lane: 0, time: 1000 },
                            { lane: 1, time: 2000 },
                            { lane: 2, time: 3000, endTime: 4000 }, // Long note
                            { lane: 3, time: 5000 }
                        ]
                    } as ManiaSegment
                ]
            }

            const totalNotes = calculateTotalNotes(chart)
            // 4 notes total (long notes count as 1 note in the notes array)
            expect(totalNotes).toBe(4)
        })

        test('runtime manager handles single-segment mania chart', () => {
            const chart: Chart = {
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 5000
                },
                segments: [
                    {
                        id: 's1',
                        startMs: 0,
                        endMs: 5000,
                        mode: 'mania',
                        judgeRule: 'mania-od7',
                        config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
                        notes: [
                            { lane: 0, time: 1000 },
                            { lane: 1, time: 2000 }
                        ]
                    } as ManiaSegment
                ]
            }

            const scorer = new GlobalScorer()
            scorer.reset(calculateTotalNotes(chart))

            // Create a mock canvas context that doesn't throw errors
            const mockCtx = {
                fillStyle: '',
                strokeStyle: '',
                lineWidth: 0,
                globalAlpha: 1,
                font: '',
                textAlign: 'left',
                textBaseline: 'alphabetic',
                fillRect: () => {},
                strokeRect: () => {},
                clearRect: () => {},
                fillText: () => {},
                strokeText: () => {},
                beginPath: () => {},
                moveTo: () => {},
                lineTo: () => {},
                arc: () => {},
                stroke: () => {},
                fill: () => {},
                save: () => {},
                restore: () => {},
                translate: () => {},
                rotate: () => {},
                scale: () => {},
                setTransform: () => {},
                resetTransform: () => {},
                measureText: () => ({ width: 0 })
            } as any

            const mockCanvas = {
                width: 800,
                height: 600,
                getContext: () => mockCtx
            } as any

            const runtimeCtx: RuntimeContext = {
                canvas: mockCanvas,
                ctx2d: mockCtx,
                area: { x: 0, y: 0, w: 800, h: 600 },
                scorer,
                judge: () => 0 as Judgement,
                onJudgement: () => {}
            }

            const timeline = new TimelineController(chart, runtimeCtx, {
                mania: () => new ManiaRuntime(),
                taiko: () => new TaikoRuntime()
            })

            // Tick at start - should activate the single segment
            timeline.tick(100)
            expect(timeline.activeMode).toBe('mania')
            expect(timeline.activeSegmentId).toBe('s1')

            // Tick in middle - should still be active
            timeline.tick(2500)
            expect(timeline.activeMode).toBe('mania')

            // Tick at end - should complete
            timeline.tick(5100)
            expect(timeline.isAllComplete(5100)).toBe(true)

            timeline.destroy()
        })
    })

    describe('Single-mode taiko charts', () => {
        test('loads and validates single-segment taiko chart', () => {
            const chartJson = JSON.stringify({
                meta: {
                    title: 'Legacy Taiko Chart',
                    artist: 'Test Artist',
                    audio: 'test.mp3',
                    length: 60000
                },
                segments: [
                    {
                        id: 'main',
                        startMs: 0,
                        endMs: 60000,
                        mode: 'taiko',
                        judgeRule: 'taiko-normal',
                        config: {
                            donKeys: ['F', 'J'],
                            kaKeys: ['D', 'K'],
                            scrollSpeed: 0.5
                        },
                        notes: [
                            { type: 'don', time: 1000 },
                            { type: 'ka', time: 2000 },
                            { type: 'don', time: 3000, big: true },
                            { type: 'roll', time: 4000, endTime: 5000 }
                        ]
                    }
                ]
            })

            const parseResult = parser.parseJSON(chartJson)
            expect(parseResult.ok).toBe(true)
            
            if (parseResult.ok) {
                const chart = parseResult.value
                expect(chart.segments).toHaveLength(1)
                expect(chart.segments[0].mode).toBe('taiko')
                
                const errors = validator.validate(chart)
                expect(errors).toHaveLength(0)
            }
        })

        test('calculates total notes correctly for single-segment taiko chart', () => {
            const chart: Chart = {
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 10000
                },
                segments: [
                    {
                        id: 's1',
                        startMs: 0,
                        endMs: 10000,
                        mode: 'taiko',
                        judgeRule: 'taiko-normal',
                        config: {
                            donKeys: ['F', 'J'],
                            kaKeys: ['D', 'K'],
                            scrollSpeed: 0.5
                        },
                        notes: [
                            { type: 'don', time: 1000 },
                            { type: 'ka', time: 2000 },
                            { type: 'don', time: 3000, big: true },
                            { type: 'roll', time: 4000, endTime: 5000 },
                            { type: 'balloon', time: 6000, endTime: 7000, hits: 10 }
                        ]
                    } as TaikoSegment
                ]
            }

            const totalNotes = calculateTotalNotes(chart)
            // 3 regular notes + 1 roll + 1 balloon = 5 judgeable notes
            expect(totalNotes).toBe(5)
        })

        test('runtime manager handles single-segment taiko chart', () => {
            const chart: Chart = {
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 5000
                },
                segments: [
                    {
                        id: 's1',
                        startMs: 0,
                        endMs: 5000,
                        mode: 'taiko',
                        judgeRule: 'taiko-normal',
                        config: {
                            donKeys: ['F', 'J'],
                            kaKeys: ['D', 'K'],
                            scrollSpeed: 0.5
                        },
                        notes: [
                            { type: 'don', time: 1000 },
                            { type: 'ka', time: 2000 }
                        ]
                    } as TaikoSegment
                ]
            }

            const scorer = new GlobalScorer()
            scorer.reset(calculateTotalNotes(chart))

            // Create a mock canvas context that doesn't throw errors
            const mockCtx = {
                fillStyle: '',
                strokeStyle: '',
                lineWidth: 0,
                globalAlpha: 1,
                font: '',
                textAlign: 'left',
                textBaseline: 'alphabetic',
                fillRect: () => {},
                strokeRect: () => {},
                clearRect: () => {},
                fillText: () => {},
                strokeText: () => {},
                beginPath: () => {},
                moveTo: () => {},
                lineTo: () => {},
                arc: () => {},
                stroke: () => {},
                fill: () => {},
                save: () => {},
                restore: () => {},
                translate: () => {},
                rotate: () => {},
                scale: () => {},
                setTransform: () => {},
                resetTransform: () => {},
                measureText: () => ({ width: 0 })
            } as any

            const mockCanvas = {
                width: 800,
                height: 600,
                getContext: () => mockCtx
            } as any

            const runtimeCtx: RuntimeContext = {
                canvas: mockCanvas,
                ctx2d: mockCtx,
                area: { x: 0, y: 0, w: 800, h: 600 },
                scorer,
                judge: () => 0 as Judgement,
                onJudgement: () => {}
            }

            const timeline = new TimelineController(chart, runtimeCtx, {
                mania: () => new ManiaRuntime(),
                taiko: () => new TaikoRuntime()
            })

            // Tick at start - should activate the single segment
            timeline.tick(100)
            expect(timeline.activeMode).toBe('taiko')
            expect(timeline.activeSegmentId).toBe('s1')

            // Tick in middle - should still be active
            timeline.tick(2500)
            expect(timeline.activeMode).toBe('taiko')

            // Tick at end - should complete
            timeline.tick(5100)
            expect(timeline.isAllComplete(5100)).toBe(true)

            timeline.destroy()
        })
    })

    describe('Gameplay behavior unchanged', () => {
        test('single-segment chart produces same scoring behavior', () => {
            const chart: Chart = {
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 5000
                },
                segments: [
                    {
                        id: 's1',
                        startMs: 0,
                        endMs: 5000,
                        mode: 'mania',
                        judgeRule: 'mania-od7',
                        config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
                        notes: [
                            { lane: 0, time: 1000 },
                            { lane: 1, time: 2000 },
                            { lane: 2, time: 3000 }
                        ]
                    } as ManiaSegment
                ]
            }

            const scorer = new GlobalScorer()
            const totalNotes = calculateTotalNotes(chart)
            scorer.reset(totalNotes)

            // Verify initial state
            expect(scorer.score).toBe(0)
            expect(scorer.combo).toBe(0)
            expect(scorer.accuracy).toBe(1.0)
            expect(scorer.totalNotes).toBe(3)

            // Simulate perfect hits using the correct API
            scorer.add(0) // Perfect (Judgement.Perfect = 0)
            expect(scorer.combo).toBe(1)
            expect(scorer.score).toBeGreaterThan(0)

            scorer.add(0) // Perfect
            expect(scorer.combo).toBe(2)

            scorer.add(0) // Perfect
            expect(scorer.combo).toBe(3)
            expect(scorer.maxCombo).toBe(3)
            expect(scorer.accuracy).toBe(1.0) // 100% accuracy
        })

        test('single-segment chart handles misses correctly', () => {
            const chart: Chart = {
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 5000
                },
                segments: [
                    {
                        id: 's1',
                        startMs: 0,
                        endMs: 5000,
                        mode: 'mania',
                        judgeRule: 'mania-od7',
                        config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
                        notes: [
                            { lane: 0, time: 1000 },
                            { lane: 1, time: 2000 },
                            { lane: 2, time: 3000 }
                        ]
                    } as ManiaSegment
                ]
            }

            const scorer = new GlobalScorer()
            scorer.reset(calculateTotalNotes(chart))

            // Perfect, Miss, Perfect using the correct API
            scorer.add(0) // Perfect (Judgement.Perfect = 0)
            expect(scorer.combo).toBe(1)

            scorer.add(5) // Miss (Judgement.Miss = 5)
            expect(scorer.combo).toBe(0) // Combo broken

            scorer.add(0) // Perfect
            expect(scorer.combo).toBe(1) // Combo restarted
            expect(scorer.maxCombo).toBe(1) // Max combo is 1, not 2

            // Accuracy should be less than 100%
            expect(scorer.accuracy).toBeLessThan(1.0)
        })
    })

    describe('Format compatibility', () => {
        test('parses chart without optional osuMetadata field', () => {
            const chartJson = JSON.stringify({
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 5000
                },
                segments: [
                    {
                        id: 's1',
                        startMs: 0,
                        endMs: 5000,
                        mode: 'mania',
                        judgeRule: 'mania-od7',
                        config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
                        notes: []
                    }
                ]
            })

            const parseResult = parser.parseJSON(chartJson)
            expect(parseResult.ok).toBe(true)
            
            if (parseResult.ok) {
                const chart = parseResult.value
                expect(chart.osuMetadata).toBeUndefined()
                expect(chart.timingPoints).toBeUndefined()
            }
        })

        test('parses chart without optional timingPoints field', () => {
            const chartJson = JSON.stringify({
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 5000
                },
                segments: [
                    {
                        id: 's1',
                        startMs: 0,
                        endMs: 5000,
                        mode: 'taiko',
                        judgeRule: 'taiko-normal',
                        config: {
                            donKeys: ['F', 'J'],
                            kaKeys: ['D', 'K'],
                            scrollSpeed: 0.5
                        },
                        notes: []
                    }
                ]
            })

            const parseResult = parser.parseJSON(chartJson)
            expect(parseResult.ok).toBe(true)
            
            if (parseResult.ok) {
                const chart = parseResult.value
                expect(chart.timingPoints).toBeUndefined()
            }
        })

        test('parses segment without optional timingContext field', () => {
            const chartJson = JSON.stringify({
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 5000
                },
                segments: [
                    {
                        id: 's1',
                        startMs: 0,
                        endMs: 5000,
                        mode: 'mania',
                        judgeRule: 'mania-od7',
                        config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
                        notes: []
                    }
                ]
            })

            const parseResult = parser.parseJSON(chartJson)
            expect(parseResult.ok).toBe(true)
            
            if (parseResult.ok) {
                const chart = parseResult.value
                const segment = chart.segments[0]
                expect(segment.timingContext).toBeUndefined()
            }
        })
    })
})
