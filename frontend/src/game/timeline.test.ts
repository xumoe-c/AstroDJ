import { describe, test, expect, beforeEach } from 'vitest'
import { TimelineController } from './timeline'
import type { Chart, Segment, ManiaSegment, TaikoSegment } from './types'
import type { RuntimeContext, ISegmentRuntime } from './runtimes/interface'
import { GlobalScorer } from './scorer'
import { Judgement } from './types'

// Mock runtime for testing
class MockRuntime implements ISegmentRuntime {
    mounted = false
    unmounted = false

    mount(_segment: Segment, _ctx: RuntimeContext): void {
        this.mounted = true
    }

    update(_songMs: number): void {}

    handleKeyDown(_key: string, _songMs: number): void {}

    handleKeyUp(_key: string, _songMs: number): void {}

    handleTouchStart(_x: number, _songMs: number): void {}

    handleTouchEnd(_x: number, _songMs: number): void {}

    unmount(): void {
        this.unmounted = true
    }

    isComplete(_songMs: number): boolean {
        return false
    }
}

describe('TimelineController', () => {
    let canvas: HTMLCanvasElement
    let ctx: RuntimeContext
    let scorer: GlobalScorer

    beforeEach(() => {
        canvas = document.createElement('canvas')
        canvas.width = 800
        canvas.height = 600
        const ctx2d = canvas.getContext('2d')!

        scorer = new GlobalScorer()
        scorer.reset(10)

        ctx = {
            canvas,
            ctx2d,
            area: { x: 0, y: 0, w: 800, h: 600 },
            scorer,
            judge: (_rule: string, _delta: number) => Judgement.Perfect,
        }
    })

    describe('getTransitionInfo', () => {
        test('returns null when no next segment exists', () => {
            const chart: Chart = {
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 10000
                },
                segments: [
                    {
                        id: 'seg1',
                        mode: 'mania',
                        startMs: 0,
                        endMs: 5000,
                        judgeRule: 'mania-od8',
                        config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
                        notes: []
                    } as ManiaSegment
                ]
            }

            const timeline = new TimelineController(chart, ctx, {
                mania: () => new MockRuntime()
            })

            // After the last segment
            const info = timeline.getTransitionInfo(6000)
            expect(info).toBeNull()
        })

        test('returns null when next segment is beyond 3000ms', () => {
            const chart: Chart = {
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 10000
                },
                segments: [
                    {
                        id: 'seg1',
                        mode: 'mania',
                        startMs: 0,
                        endMs: 3000,
                        judgeRule: 'mania-od8',
                        config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
                        notes: []
                    } as ManiaSegment,
                    {
                        id: 'seg2',
                        mode: 'taiko',
                        startMs: 7000,
                        endMs: 10000,
                        judgeRule: 'taiko-od8',
                        config: { donKeys: ['D', 'F'], kaKeys: ['J', 'K'], scrollSpeed: 1.0 },
                        notes: []
                    } as TaikoSegment
                ]
            }

            const timeline = new TimelineController(chart, ctx, {
                mania: () => new MockRuntime(),
                taiko: () => new MockRuntime()
            })

            // 3500ms before next segment (7000 - 3500 = 3500ms away)
            const info = timeline.getTransitionInfo(3500)
            expect(info).toBeNull()
        })

        test('returns transition info when next segment is within 3000ms', () => {
            const chart: Chart = {
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 10000
                },
                segments: [
                    {
                        id: 'seg1',
                        mode: 'mania',
                        startMs: 0,
                        endMs: 3000,
                        judgeRule: 'mania-od8',
                        config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
                        notes: []
                    } as ManiaSegment,
                    {
                        id: 'seg2',
                        mode: 'taiko',
                        startMs: 5000,
                        endMs: 10000,
                        judgeRule: 'taiko-od8',
                        config: { donKeys: ['D', 'F'], kaKeys: ['J', 'K'], scrollSpeed: 1.0 },
                        notes: []
                    } as TaikoSegment
                ]
            }

            const timeline = new TimelineController(chart, ctx, {
                mania: () => new MockRuntime(),
                taiko: () => new MockRuntime()
            })

            // 2000ms before next segment
            const info = timeline.getTransitionInfo(3000)
            
            expect(info).not.toBeNull()
            expect(info?.nextMode).toBe('taiko')
            expect(info?.nextSegmentId).toBe('seg2')
            expect(info?.timeUntilTransition).toBe(2000)
            expect(info?.keyBindings).toEqual(['D', 'F', 'J', 'K'])
        })

        test('extracts mania key bindings correctly', () => {
            const chart: Chart = {
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 10000
                },
                segments: [
                    {
                        id: 'seg1',
                        mode: 'taiko',
                        startMs: 0,
                        endMs: 2000,
                        judgeRule: 'taiko-od8',
                        config: { donKeys: ['D', 'F'], kaKeys: ['J', 'K'], scrollSpeed: 1.0 },
                        notes: []
                    } as TaikoSegment,
                    {
                        id: 'seg2',
                        mode: 'mania',
                        startMs: 3000,
                        endMs: 6000,
                        judgeRule: 'mania-od8',
                        config: { keys: ['A', 'S', 'D', 'F'], scrollSpeed: 1.0 },
                        notes: []
                    } as ManiaSegment
                ]
            }

            const timeline = new TimelineController(chart, ctx, {
                mania: () => new MockRuntime(),
                taiko: () => new MockRuntime()
            })

            const info = timeline.getTransitionInfo(1000)
            
            expect(info?.keyBindings).toEqual(['A', 'S', 'D', 'F'])
        })

        test('extracts taiko key bindings correctly', () => {
            const chart: Chart = {
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 10000
                },
                segments: [
                    {
                        id: 'seg1',
                        mode: 'mania',
                        startMs: 0,
                        endMs: 2000,
                        judgeRule: 'mania-od8',
                        config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
                        notes: []
                    } as ManiaSegment,
                    {
                        id: 'seg2',
                        mode: 'taiko',
                        startMs: 3000,
                        endMs: 6000,
                        judgeRule: 'taiko-od8',
                        config: { donKeys: ['Z', 'X'], kaKeys: ['C', 'V'], scrollSpeed: 1.0 },
                        notes: []
                    } as TaikoSegment
                ]
            }

            const timeline = new TimelineController(chart, ctx, {
                mania: () => new MockRuntime(),
                taiko: () => new MockRuntime()
            })

            const info = timeline.getTransitionInfo(1000)
            
            expect(info?.keyBindings).toEqual(['Z', 'X', 'C', 'V'])
        })

        test('returns osu-standard default bindings', () => {
            const chart: Chart = {
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 10000
                },
                segments: [
                    {
                        id: 'seg1',
                        mode: 'mania',
                        startMs: 0,
                        endMs: 2000,
                        judgeRule: 'mania-od8',
                        config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
                        notes: []
                    } as ManiaSegment,
                    {
                        id: 'seg2',
                        mode: 'osu-standard',
                        startMs: 3000,
                        endMs: 6000,
                        judgeRule: 'osu-od8',
                        config: { circleSize: 4, approachRate: 9, scrollSpeed: 1.0 },
                        notes: []
                    } as any
                ]
            }

            const timeline = new TimelineController(chart, ctx, {
                mania: () => new MockRuntime(),
                'osu-standard': () => new MockRuntime()
            })

            const info = timeline.getTransitionInfo(1000)
            
            expect(info?.keyBindings).toEqual(['Mouse', 'Z', 'X'])
        })

        test('calculates timeUntilTransition correctly', () => {
            const chart: Chart = {
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 10000
                },
                segments: [
                    {
                        id: 'seg1',
                        mode: 'mania',
                        startMs: 0,
                        endMs: 3000,
                        judgeRule: 'mania-od8',
                        config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
                        notes: []
                    } as ManiaSegment,
                    {
                        id: 'seg2',
                        mode: 'taiko',
                        startMs: 5000,
                        endMs: 10000,
                        judgeRule: 'taiko-od8',
                        config: { donKeys: ['D', 'F'], kaKeys: ['J', 'K'], scrollSpeed: 1.0 },
                        notes: []
                    } as TaikoSegment
                ]
            }

            const timeline = new TimelineController(chart, ctx, {
                mania: () => new MockRuntime(),
                taiko: () => new MockRuntime()
            })

            // Test at different time points
            // At 2000ms, next segment is at 5000ms (3000ms away) - should be null (>= 3000ms)
            const info1 = timeline.getTransitionInfo(2000)
            expect(info1).toBeNull()

            // At 2500ms, next segment is at 5000ms (2500ms away) - should show info
            const info2 = timeline.getTransitionInfo(2500)
            expect(info2?.timeUntilTransition).toBe(2500)

            // At 3500ms, next segment is at 5000ms (1500ms away) - should show info
            const info3 = timeline.getTransitionInfo(3500)
            expect(info3?.timeUntilTransition).toBe(1500)

            // At 4500ms, next segment is at 5000ms (500ms away) - should show info
            const info4 = timeline.getTransitionInfo(4500)
            expect(info4?.timeUntilTransition).toBe(500)
        })
    })
})
