import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ManiaRuntime } from './runtimes/mania'
import { TaikoRuntime } from './runtimes/taiko'
import { OsuStandardRuntime } from './runtimes/osu-standard'
import type { ManiaSegment, TaikoSegment, OsuStandardSegment, RuntimeContext } from './types'
import { Judgement as J } from './types'

describe('Judgment Optimization Tests', () => {
    describe('Expanded Timing Windows', () => {
        it('should accept hits within expanded mania window (200ms)', () => {
            const segment: ManiaSegment = {
                mode: 'mania',
                startMs: 0,
                endMs: 5000,
                judgeRule: 'mania-od8',
                config: { keys: ['d', 'f', 'j', 'k'], scrollSpeed: 0.5 },
                notes: [{ time: 1000, lane: 0 }],
            }

            const canvas = document.createElement('canvas')
            const ctx2d = canvas.getContext('2d')!
            const scorer = { totalNotes: 0, add: vi.fn(), addBonus: vi.fn() }
            const judge = vi.fn().mockReturnValue(J.Good)

            const runtimeCtx: RuntimeContext = {
                area: { x: 0, y: 0, w: 400, h: 600 },
                ctx2d,
                scorer,
                judge,
            }

            const runtime = new ManiaRuntime()
            runtime.mount(segment, runtimeCtx)

            // Hit at 195ms late (within 200ms window, outside old 188ms window)
            runtime.handleKeyDown('d', 1195)

            expect(judge).toHaveBeenCalledWith('mania-od8', 195)
            expect(scorer.add).toHaveBeenCalledWith(J.Good)
        })

        it('should accept hits within expanded taiko window (120ms)', () => {
            const segment: TaikoSegment = {
                mode: 'taiko',
                startMs: 0,
                endMs: 5000,
                judgeRule: 'taiko-normal',
                config: { donKeys: ['d', 'f'], kaKeys: ['j', 'k'], scrollSpeed: 0.3 },
                notes: [{ time: 1000, type: 'don', big: false }],
            }

            const canvas = document.createElement('canvas')
            const ctx2d = canvas.getContext('2d')!
            const scorer = { totalNotes: 0, add: vi.fn(), addBonus: vi.fn() }
            const judge = vi.fn().mockReturnValue(J.Good)

            const runtimeCtx: RuntimeContext = {
                area: { x: 0, y: 0, w: 800, h: 200 },
                ctx2d,
                scorer,
                judge,
            }

            const runtime = new TaikoRuntime()
            runtime.mount(segment, runtimeCtx)

            // Hit at 115ms late (within 120ms window, outside old 108ms window)
            runtime.handleKeyDown('d', 1115)

            expect(judge).toHaveBeenCalledWith('taiko-normal', 115)
            expect(scorer.add).toHaveBeenCalledWith(J.Good)
        })

        it('should accept hits within expanded osu-standard window (165ms)', () => {
            const segment: OsuStandardSegment = {
                mode: 'osu-standard',
                startMs: 0,
                endMs: 5000,
                judgeRule: 'mania-od8',
                config: { circleSize: 4, approachRate: 9 },
                notes: [{ time: 1000, type: 'circle', x: 256, y: 192 }],
            }

            const canvas = document.createElement('canvas')
            const ctx2d = canvas.getContext('2d')!
            const scorer = { totalNotes: 0, add: vi.fn(), addBonus: vi.fn() }
            const judge = vi.fn().mockReturnValue(J.Good)

            const runtimeCtx: RuntimeContext = {
                area: { x: 0, y: 0, w: 800, h: 600 },
                ctx2d,
                scorer,
                judge,
            }

            const runtime = new OsuStandardRuntime()
            runtime.mount(segment, runtimeCtx)

            // Hit at 160ms late (within 165ms window, outside old 150ms window)
            runtime.handleTouchStart(400, 1160)

            expect(judge).toHaveBeenCalledWith('mania-od8', 160)
            expect(scorer.add).toHaveBeenCalledWith(J.Good)
        })
    })

    describe('Note Locking Mechanism', () => {
        it('should prevent double-judgment on same mania note', () => {
            const segment: ManiaSegment = {
                mode: 'mania',
                startMs: 0,
                endMs: 5000,
                judgeRule: 'mania-od8',
                config: { keys: ['d', 'f', 'j', 'k'], scrollSpeed: 0.5 },
                notes: [{ time: 1000, lane: 0 }],
            }

            const canvas = document.createElement('canvas')
            const ctx2d = canvas.getContext('2d')!
            const scorer = { totalNotes: 0, add: vi.fn(), addBonus: vi.fn() }
            const judge = vi.fn().mockReturnValue(J.Great)

            const runtimeCtx: RuntimeContext = {
                area: { x: 0, y: 0, w: 400, h: 600 },
                ctx2d,
                scorer,
                judge,
            }

            const runtime = new ManiaRuntime()
            runtime.mount(segment, runtimeCtx)

            // First hit
            runtime.handleKeyDown('d', 1000)
            expect(scorer.add).toHaveBeenCalledTimes(1)

            // Second hit within lock duration (50ms) - should be ignored
            runtime.handleKeyDown('d', 1010)
            expect(scorer.add).toHaveBeenCalledTimes(1) // Still only 1 call

            // Third hit after lock expires (>50ms) - should still be ignored (note already hit)
            runtime.handleKeyDown('d', 1060)
            expect(scorer.add).toHaveBeenCalledTimes(1) // Still only 1 call
        })

        it('should prevent double-judgment on same taiko note', () => {
            const segment: TaikoSegment = {
                mode: 'taiko',
                startMs: 0,
                endMs: 5000,
                judgeRule: 'taiko-normal',
                config: { donKeys: ['d', 'f'], kaKeys: ['j', 'k'], scrollSpeed: 0.3 },
                notes: [{ time: 1000, type: 'don', big: false }],
            }

            const canvas = document.createElement('canvas')
            const ctx2d = canvas.getContext('2d')!
            const scorer = { totalNotes: 0, add: vi.fn(), addBonus: vi.fn() }
            const judge = vi.fn().mockReturnValue(J.Perfect)

            const runtimeCtx: RuntimeContext = {
                area: { x: 0, y: 0, w: 800, h: 200 },
                ctx2d,
                scorer,
                judge,
            }

            const runtime = new TaikoRuntime()
            runtime.mount(segment, runtimeCtx)

            // First hit
            runtime.handleKeyDown('d', 1000)
            expect(scorer.add).toHaveBeenCalledTimes(1)

            // Second hit within lock duration - should be ignored
            runtime.handleKeyDown('d', 1020)
            expect(scorer.add).toHaveBeenCalledTimes(1)
        })

        it('should handle closely-spaced notes correctly with locking', () => {
            const segment: ManiaSegment = {
                mode: 'mania',
                startMs: 0,
                endMs: 5000,
                judgeRule: 'mania-od8',
                config: { keys: ['d', 'f', 'j', 'k'], scrollSpeed: 0.5 },
                notes: [
                    { time: 1000, lane: 0 },
                    { time: 1030, lane: 0 }, // 30ms apart - dense pattern
                ],
            }

            const canvas = document.createElement('canvas')
            const ctx2d = canvas.getContext('2d')!
            const scorer = { totalNotes: 0, add: vi.fn(), addBonus: vi.fn() }
            const judge = vi.fn().mockReturnValue(J.Great)

            const runtimeCtx: RuntimeContext = {
                area: { x: 0, y: 0, w: 400, h: 600 },
                ctx2d,
                scorer,
                judge,
            }

            const runtime = new ManiaRuntime()
            runtime.mount(segment, runtimeCtx)

            // Hit first note
            runtime.handleKeyDown('d', 1000)
            expect(scorer.add).toHaveBeenCalledTimes(1)

            // Hit second note (first note is locked, so this should hit the second note)
            runtime.handleKeyDown('d', 1030)
            expect(scorer.add).toHaveBeenCalledTimes(2)
        })
    })

    describe('Priority Judgment System', () => {
        it('should prioritize closest note by timing in mania', () => {
            const segment: ManiaSegment = {
                mode: 'mania',
                startMs: 0,
                endMs: 5000,
                judgeRule: 'mania-od8',
                config: { keys: ['d', 'f', 'j', 'k'], scrollSpeed: 0.5 },
                notes: [
                    { time: 1000, lane: 0 },
                    { time: 1100, lane: 0 },
                ],
            }

            const canvas = document.createElement('canvas')
            const ctx2d = canvas.getContext('2d')!
            const scorer = { totalNotes: 0, add: vi.fn(), addBonus: vi.fn() }
            const judge = vi.fn().mockReturnValue(J.Great)

            const runtimeCtx: RuntimeContext = {
                area: { x: 0, y: 0, w: 400, h: 600 },
                ctx2d,
                scorer,
                judge,
            }

            const runtime = new ManiaRuntime()
            runtime.mount(segment, runtimeCtx)

            // Hit at 1050ms - closer to first note (50ms) than second (50ms)
            // Should hit the first note
            runtime.handleKeyDown('d', 1050)

            expect(judge).toHaveBeenCalledWith('mania-od8', 50)
            expect(scorer.add).toHaveBeenCalledTimes(1)
        })

        it('should prioritize closest note by timing and distance in osu-standard', () => {
            const segment: OsuStandardSegment = {
                mode: 'osu-standard',
                startMs: 0,
                endMs: 5000,
                judgeRule: 'mania-od8',
                config: { circleSize: 4, approachRate: 9 },
                notes: [
                    { time: 1000, type: 'circle', x: 100, y: 192 },
                    { time: 1000, type: 'circle', x: 400, y: 192 }, // Same time, different position
                ],
            }

            const canvas = document.createElement('canvas')
            canvas.width = 800
            canvas.height = 600
            const ctx2d = canvas.getContext('2d')!
            const scorer = { totalNotes: 0, add: vi.fn(), addBonus: vi.fn() }
            const judge = vi.fn().mockReturnValue(J.Great)

            const runtimeCtx: RuntimeContext = {
                area: { x: 0, y: 0, w: 800, h: 600 },
                ctx2d,
                scorer,
                judge,
            }

            const runtime = new OsuStandardRuntime()
            runtime.mount(segment, runtimeCtx)

            // Click at screen position that maps to first circle
            // With scaling, osu x=100 maps to screen x ≈ 156
            const screenX = 156
            runtime.handleTouchStart(screenX, 1000)

            // Should hit one of the circles (spatial priority)
            expect(scorer.add).toHaveBeenCalledTimes(1)
        })
    })

    describe('Backward Compatibility', () => {
        it('should still miss notes outside timing window', () => {
            const segment: ManiaSegment = {
                mode: 'mania',
                startMs: 0,
                endMs: 5000,
                judgeRule: 'mania-od8',
                config: { keys: ['d', 'f', 'j', 'k'], scrollSpeed: 0.5 },
                notes: [{ time: 1000, lane: 0 }],
            }

            const canvas = document.createElement('canvas')
            const ctx2d = canvas.getContext('2d')!
            const scorer = { totalNotes: 0, add: vi.fn(), addBonus: vi.fn() }
            const judge = vi.fn()

            const runtimeCtx: RuntimeContext = {
                area: { x: 0, y: 0, w: 400, h: 600 },
                ctx2d,
                scorer,
                judge,
            }

            const runtime = new ManiaRuntime()
            runtime.mount(segment, runtimeCtx)

            // Hit way too late (250ms > 200ms window)
            runtime.handleKeyDown('d', 1250)

            // Should not judge the note
            expect(judge).not.toHaveBeenCalled()
            expect(scorer.add).not.toHaveBeenCalled()
        })

        it('should auto-miss notes that pass without being hit', () => {
            const segment: ManiaSegment = {
                mode: 'mania',
                startMs: 0,
                endMs: 5000,
                judgeRule: 'mania-od8',
                config: { keys: ['d', 'f', 'j', 'k'], scrollSpeed: 0.5 },
                notes: [{ time: 1000, lane: 0 }],
            }

            // Mock canvas context
            const ctx2d = {
                fillStyle: '',
                strokeStyle: '',
                lineWidth: 0,
                globalAlpha: 1,
                shadowColor: '',
                shadowBlur: 0,
                font: '',
                textAlign: 'left' as CanvasTextAlign,
                textBaseline: 'alphabetic' as CanvasTextBaseline,
                fillRect: vi.fn(),
                strokeRect: vi.fn(),
                beginPath: vi.fn(),
                moveTo: vi.fn(),
                lineTo: vi.fn(),
                arc: vi.fn(),
                stroke: vi.fn(),
                fill: vi.fn(),
                fillText: vi.fn(),
            } as unknown as CanvasRenderingContext2D

            const scorer = { totalNotes: 0, add: vi.fn(), addBonus: vi.fn() }
            const judge = vi.fn()

            const runtimeCtx: RuntimeContext = {
                area: { x: 0, y: 0, w: 400, h: 600 },
                ctx2d,
                scorer,
                judge,
            }

            const runtime = new ManiaRuntime()
            runtime.mount(segment, runtimeCtx)

            // Update past the miss window
            runtime.update(1250)

            // Should auto-miss
            expect(scorer.add).toHaveBeenCalledWith(J.Miss)
        })
    })
})
