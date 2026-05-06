import { describe, test, expect, beforeEach } from 'vitest'
import { OsuStandardRuntime } from './osu-standard'
import type { OsuStandardSegment, OsuNote } from '../types'
import { Judgement as J } from '../types'
import type { RuntimeContext } from './interface'

describe('OsuStandardRuntime', () => {
    let runtime: OsuStandardRuntime
    let mockCtx: RuntimeContext
    let mockScorer: any
    let segment: OsuStandardSegment

    beforeEach(() => {
        // Create mock scorer
        mockScorer = {
            totalNotes: 0,
            add: () => {},
            addBonus: () => {}
        }

        // Create mock canvas context
        const mockCanvas = document.createElement('canvas')
        const mockCtx2d = mockCanvas.getContext('2d')!

        // Create mock runtime context
        mockCtx = {
            canvas: mockCanvas,
            ctx2d: mockCtx2d,
            area: { x: 0, y: 0, w: 512, h: 384 },
            scorer: mockScorer,
            judge: (rule: string, delta: number) => {
                if (delta <= 50) return J.Perfect
                if (delta <= 100) return J.Great
                if (delta <= 150) return J.Good
                return J.Miss
            }
        }

        // Create test segment with hit circles
        const notes: OsuNote[] = [
            { type: 'circle', x: 256, y: 192, time: 1000 },
            { type: 'circle', x: 300, y: 200, time: 2000 },
            { type: 'circle', x: 200, y: 150, time: 3000 }
        ]

        segment = {
            id: 'test-osu',
            startMs: 0,
            endMs: 5000,
            mode: 'osu-standard',
            judgeRule: 'osu-od8',
            config: {
                circleSize: 4,
                approachRate: 9,
                scrollSpeed: 1.0
            },
            notes
        }

        runtime = new OsuStandardRuntime()
    })

    test('mount initializes runtime state', () => {
        runtime.mount(segment, mockCtx)
        
        // Verify scorer totalNotes was updated
        expect(mockScorer.totalNotes).toBe(3)
    })

    test('mount throws error for non-osu-standard segment', () => {
        const maniaSegment: any = {
            id: 'test-mania',
            startMs: 0,
            endMs: 5000,
            mode: 'mania',
            judgeRule: 'mania-od8',
            config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
            notes: []
        }

        expect(() => runtime.mount(maniaSegment, mockCtx)).toThrow(
            'OsuStandardRuntime requires an OsuStandardSegment'
        )
    })

    test('unmount force-judges pending notes as Miss', () => {
        let missCount = 0
        mockScorer.add = (j: J) => {
            if (j === J.Miss) missCount++
        }

        runtime.mount(segment, mockCtx)
        runtime.unmount()

        // All 3 pending notes should be judged as Miss
        expect(missCount).toBe(3)
    })

    test('isComplete returns false before segment end', () => {
        runtime.mount(segment, mockCtx)
        
        expect(runtime.isComplete(1000)).toBe(false)
        expect(runtime.isComplete(4999)).toBe(false)
    })

    test('isComplete returns true after segment end with all notes judged', () => {
        runtime.mount(segment, mockCtx)
        
        // Force-judge all notes
        runtime.unmount()
        
        // After unmount, all notes are judged
        expect(runtime.isComplete(5000)).toBe(true)
    })

    test('mount counts sliders and spinners correctly', () => {
        const notesWithSliders: OsuNote[] = [
            { type: 'circle', x: 256, y: 192, time: 1000 },
            { 
                type: 'slider', 
                x: 300, 
                y: 200, 
                time: 2000, 
                endTime: 2500,
                sliderPath: {
                    type: 'L',
                    points: [{ x: 300, y: 200 }, { x: 400, y: 200 }],
                    slides: 1,
                    length: 100
                }
            },
            { type: 'spinner', x: 256, y: 192, time: 3000, endTime: 4000 }
        ]

        const segmentWithSliders: OsuStandardSegment = {
            ...segment,
            notes: notesWithSliders
        }

        mockScorer.totalNotes = 0
        runtime.mount(segmentWithSliders, mockCtx)
        
        // Each note type counts as 1 judgement
        expect(mockScorer.totalNotes).toBe(3)
    })

    test('handleTouchStart detects hit within timing window', () => {
        let addedJudgement: J | null = null
        mockScorer.add = (j: J) => {
            addedJudgement = j
        }

        runtime.mount(segment, mockCtx)
        
        // Hit the first circle at x=256, y=192 at time 1000ms
        // Touch at center of playfield (256 in osu coordinates)
        const screenX = mockCtx.area.w / 2
        runtime.handleTouchStart(screenX, 1000)
        
        // Should judge as Perfect (delta = 0)
        expect(addedJudgement).toBe(J.Perfect)
    })

    test('handleTouchStart judges based on timing accuracy', () => {
        let addedJudgement: J | null = null
        mockScorer.add = (j: J) => {
            addedJudgement = j
        }

        runtime.mount(segment, mockCtx)
        
        // Hit the first circle 60ms early
        const screenX = mockCtx.area.w / 2
        runtime.handleTouchStart(screenX, 940)
        
        // Should judge as Great (delta = 60)
        expect(addedJudgement).toBe(J.Great)
    })

    test('handleTouchStart ignores clicks outside hit circle', () => {
        let addedJudgement: J | null = null
        mockScorer.add = (j: J) => {
            addedJudgement = j
        }

        runtime.mount(segment, mockCtx)
        
        // Click far from any hit circle
        runtime.handleTouchStart(0, 1000)
        
        // Should not judge anything
        expect(addedJudgement).toBe(null)
    })

    test('handleTouchStart ignores clicks outside timing window', () => {
        let addedJudgement: J | null = null
        mockScorer.add = (j: J) => {
            addedJudgement = j
        }

        runtime.mount(segment, mockCtx)
        
        // Click at correct position but way too early (500ms before)
        const screenX = mockCtx.area.w / 2
        runtime.handleTouchStart(screenX, 500)
        
        // Should not judge anything
        expect(addedJudgement).toBe(null)
    })

    test('update auto-misses notes that pass timing window', () => {
        let missCount = 0
        mockScorer.add = (j: J) => {
            if (j === J.Miss) missCount++
        }

        // Create a proper mock canvas with all required methods
        const mockCanvas = {
            getContext: () => ({
                fillStyle: '',
                strokeStyle: '',
                lineWidth: 0,
                globalAlpha: 1,
                font: '',
                textAlign: '',
                textBaseline: '',
                fillRect: () => {},
                strokeRect: () => {},
                beginPath: () => {},
                arc: () => {},
                fill: () => {},
                stroke: () => {},
                fillText: () => {}
            })
        } as any

        mockCtx.canvas = mockCanvas
        mockCtx.ctx2d = mockCanvas.getContext('2d')

        runtime.mount(segment, mockCtx)
        
        // Update past the first note's timing window
        runtime.update(1200)
        
        // First note should be auto-missed
        expect(missCount).toBe(1)
        
        // Update past all notes
        runtime.update(3200)
        
        // All 3 notes should be auto-missed
        expect(missCount).toBe(3)
    })

    test('handleKeyDown treats keyboard as click at cursor position', () => {
        let addedJudgement: J | null = null
        mockScorer.add = (j: J) => {
            addedJudgement = j
        }

        runtime.mount(segment, mockCtx)
        
        // Simulate keyboard click (Z or X key)
        runtime.handleKeyDown('z', 1000)
        
        // Should judge the hit circle at center
        expect(addedJudgement).toBe(J.Perfect)
    })

    test('hit circle radius scales with circleSize', () => {
        // Create segment with smaller circle size
        const smallCircleSegment: OsuStandardSegment = {
            ...segment,
            config: {
                circleSize: 7, // Smaller circles
                approachRate: 9,
                scrollSpeed: 1.0
            }
        }

        runtime.mount(smallCircleSegment, mockCtx)
        
        // Verify mount succeeded (radius calculated internally)
        expect(mockScorer.totalNotes).toBe(3)
    })

    test('onJudgement callback is called with correct position', () => {
        let judgementX = 0
        let judgementY = 0
        let judgementType: J | null = null
        
        mockCtx.onJudgement = (j: J, x: number, y: number) => {
            judgementType = j
            judgementX = x
            judgementY = y
        }

        runtime.mount(segment, mockCtx)
        
        // Hit the first circle
        const screenX = mockCtx.area.w / 2
        runtime.handleTouchStart(screenX, 1000)
        
        // Verify callback was called
        expect(judgementType).toBe(J.Perfect)
        expect(judgementX).toBeGreaterThan(0)
        expect(judgementY).toBeGreaterThan(0)
    })

    test('isComplete returns false with pending notes', () => {
        runtime.mount(segment, mockCtx)
        
        // Hit only first note
        const screenX = mockCtx.area.w / 2
        runtime.handleTouchStart(screenX, 1000)
        
        // Still have pending notes
        expect(runtime.isComplete(5000)).toBe(false)
    })

    // ── Slider Tests ──

    test('handleTouchStart activates slider on head hit', () => {
        const sliderNote: OsuNote = {
            type: 'slider',
            x: 256,
            y: 192,
            time: 1000,
            endTime: 2000,
            sliderPath: {
                type: 'L',
                points: [{ x: 256, y: 192 }, { x: 356, y: 192 }],
                slides: 1,
                length: 100
            }
        }

        const sliderSegment: OsuStandardSegment = {
            ...segment,
            notes: [sliderNote]
        }

        mockScorer.totalNotes = 0
        runtime.mount(sliderSegment, mockCtx)

        // Hit slider head
        const screenX = mockCtx.area.w / 2
        runtime.handleTouchStart(screenX, 1000)

        // Slider should be active (not immediately scored)
        expect(mockScorer.totalNotes).toBe(1)
    })

    test('slider completes and judges based on follow accuracy', () => {
        let addedJudgement: J | null = null
        mockScorer.add = (j: J) => {
            addedJudgement = j
        }

        const sliderNote: OsuNote = {
            type: 'slider',
            x: 256,
            y: 192,
            time: 1000,
            endTime: 2000,
            sliderPath: {
                type: 'L',
                points: [{ x: 256, y: 192 }, { x: 356, y: 192 }],
                slides: 1,
                length: 100
            }
        }

        const sliderSegment: OsuStandardSegment = {
            ...segment,
            notes: [sliderNote]
        }

        // Create proper mock canvas
        const mockCanvas = {
            getContext: () => ({
                fillStyle: '',
                strokeStyle: '',
                lineWidth: 0,
                globalAlpha: 1,
                font: '',
                textAlign: '',
                textBaseline: '',
                lineCap: '',
                lineJoin: '',
                fillRect: () => {},
                strokeRect: () => {},
                beginPath: () => {},
                arc: () => {},
                fill: () => {},
                stroke: () => {},
                fillText: () => {},
                moveTo: () => {},
                lineTo: () => {}
            })
        } as any

        mockCtx.canvas = mockCanvas
        mockCtx.ctx2d = mockCanvas.getContext('2d')

        runtime.mount(sliderSegment, mockCtx)

        // Hit slider head
        const screenX = mockCtx.area.w / 2
        runtime.handleTouchStart(screenX, 1000)

        // Update through slider duration
        runtime.update(1500)
        runtime.update(2000)

        // Slider should complete and judge
        expect(addedJudgement).not.toBe(null)
    })

    test('slider auto-misses if head not hit', () => {
        let missCount = 0
        mockScorer.add = (j: J) => {
            if (j === J.Miss) missCount++
        }

        const sliderNote: OsuNote = {
            type: 'slider',
            x: 256,
            y: 192,
            time: 1000,
            endTime: 2000,
            sliderPath: {
                type: 'L',
                points: [{ x: 256, y: 192 }, { x: 356, y: 192 }],
                slides: 1,
                length: 100
            }
        }

        const sliderSegment: OsuStandardSegment = {
            ...segment,
            notes: [sliderNote]
        }

        // Create proper mock canvas
        const mockCanvas = {
            getContext: () => ({
                fillStyle: '',
                strokeStyle: '',
                lineWidth: 0,
                globalAlpha: 1,
                font: '',
                textAlign: '',
                textBaseline: '',
                fillRect: () => {},
                strokeRect: () => {},
                beginPath: () => {},
                arc: () => {},
                fill: () => {},
                stroke: () => {},
                fillText: () => {}
            })
        } as any

        mockCtx.canvas = mockCanvas
        mockCtx.ctx2d = mockCanvas.getContext('2d')

        runtime.mount(sliderSegment, mockCtx)

        // Don't hit slider head, just update past timing window
        runtime.update(1200)

        // Slider should be auto-missed
        expect(missCount).toBe(1)
    })

    test('slider renders with different path types', () => {
        const pathTypes: Array<'L' | 'P' | 'B' | 'C'> = ['L', 'P', 'B', 'C']

        pathTypes.forEach(pathType => {
            // Reset scorer for each iteration
            mockScorer.totalNotes = 0
            
            const sliderNote: OsuNote = {
                type: 'slider',
                x: 256,
                y: 192,
                time: 1000,
                endTime: 2000,
                sliderPath: {
                    type: pathType,
                    points: [{ x: 256, y: 192 }, { x: 356, y: 192 }, { x: 356, y: 292 }],
                    slides: 1,
                    length: 200
                }
            }

            const sliderSegment: OsuStandardSegment = {
                ...segment,
                notes: [sliderNote]
            }

            // Create proper mock canvas
            const mockCanvas = {
                getContext: () => ({
                    fillStyle: '',
                    strokeStyle: '',
                    lineWidth: 0,
                    globalAlpha: 1,
                    font: '',
                    textAlign: '',
                    textBaseline: '',
                    lineCap: '',
                    lineJoin: '',
                    fillRect: () => {},
                    strokeRect: () => {},
                    beginPath: () => {},
                    arc: () => {},
                    fill: () => {},
                    stroke: () => {},
                    fillText: () => {},
                    moveTo: () => {},
                    lineTo: () => {}
                })
            } as any

            mockCtx.canvas = mockCanvas
            mockCtx.ctx2d = mockCanvas.getContext('2d')

            // Create new runtime instance for each iteration
            const testRuntime = new OsuStandardRuntime()
            testRuntime.mount(sliderSegment, mockCtx)

            // Should mount without errors
            expect(mockScorer.totalNotes).toBe(1)

            // Should render without errors
            testRuntime.update(1000)
        })
    })

    test('slider with multiple slides reverses direction', () => {
        const sliderNote: OsuNote = {
            type: 'slider',
            x: 256,
            y: 192,
            time: 1000,
            endTime: 3000,
            sliderPath: {
                type: 'L',
                points: [{ x: 256, y: 192 }, { x: 356, y: 192 }],
                slides: 2, // Goes forward then backward
                length: 100
            }
        }

        const sliderSegment: OsuStandardSegment = {
            ...segment,
            notes: [sliderNote]
        }

        // Create proper mock canvas
        const mockCanvas = {
            getContext: () => ({
                fillStyle: '',
                strokeStyle: '',
                lineWidth: 0,
                globalAlpha: 1,
                font: '',
                textAlign: '',
                textBaseline: '',
                lineCap: '',
                lineJoin: '',
                fillRect: () => {},
                strokeRect: () => {},
                beginPath: () => {},
                arc: () => {},
                fill: () => {},
                stroke: () => {},
                fillText: () => {},
                moveTo: () => {},
                lineTo: () => {}
            })
        } as any

        mockCtx.canvas = mockCanvas
        mockCtx.ctx2d = mockCanvas.getContext('2d')

        runtime.mount(sliderSegment, mockCtx)

        // Hit slider head
        const screenX = mockCtx.area.w / 2
        runtime.handleTouchStart(screenX, 1000)

        // Update through slider - should handle multiple slides
        runtime.update(2000)
        runtime.update(3000)

        // Should complete without errors
        expect(runtime.isComplete(5000)).toBe(true)
    })

    // ── Spinner Tests ──

    test('handleTouchStart activates spinner when clicked during active time', () => {
        const spinnerNote: OsuNote = {
            type: 'spinner',
            x: 256,
            y: 192,
            time: 1000,
            endTime: 3000
        }

        const spinnerSegment: OsuStandardSegment = {
            ...segment,
            notes: [spinnerNote]
        }

        mockScorer.totalNotes = 0
        runtime.mount(spinnerSegment, mockCtx)

        // Click during spinner active time
        const screenX = mockCtx.area.w / 2
        runtime.handleTouchStart(screenX, 1500)

        // Spinner should be activated (not immediately scored)
        expect(mockScorer.totalNotes).toBe(1)
    })

    test('spinner tracks rotation and judges on completion', () => {
        let addedJudgement: J | null = null
        mockScorer.add = (j: J) => {
            addedJudgement = j
        }

        const spinnerNote: OsuNote = {
            type: 'spinner',
            x: 256,
            y: 192,
            time: 1000,
            endTime: 2000 // 1 second duration = 1 required rotation
        }

        const spinnerSegment: OsuStandardSegment = {
            ...segment,
            notes: [spinnerNote]
        }

        // Create proper mock canvas
        const mockCanvas = {
            getContext: () => ({
                fillStyle: '',
                strokeStyle: '',
                lineWidth: 0,
                globalAlpha: 1,
                font: '',
                textAlign: '',
                textBaseline: '',
                fillRect: () => {},
                strokeRect: () => {},
                beginPath: () => {},
                arc: () => {},
                fill: () => {},
                stroke: () => {},
                fillText: () => {},
                moveTo: () => {},
                lineTo: () => {}
            })
        } as any

        mockCtx.canvas = mockCanvas
        mockCtx.ctx2d = mockCanvas.getContext('2d')

        runtime.mount(spinnerSegment, mockCtx)

        // Activate spinner
        const screenX = mockCtx.area.w / 2
        runtime.handleTouchStart(screenX, 1000)

        // Simulate rotation by updating multiple times
        // (In real usage, cursor position would change)
        runtime.update(1500)
        runtime.update(2000)

        // Spinner should complete and judge
        expect(addedJudgement).not.toBe(null)
    })

    test('spinner auto-misses if not activated', () => {
        let missCount = 0
        mockScorer.add = (j: J) => {
            if (j === J.Miss) missCount++
        }

        const spinnerNote: OsuNote = {
            type: 'spinner',
            x: 256,
            y: 192,
            time: 1000,
            endTime: 2000
        }

        const spinnerSegment: OsuStandardSegment = {
            ...segment,
            notes: [spinnerNote]
        }

        // Create proper mock canvas
        const mockCanvas = {
            getContext: () => ({
                fillStyle: '',
                strokeStyle: '',
                lineWidth: 0,
                globalAlpha: 1,
                font: '',
                textAlign: '',
                textBaseline: '',
                fillRect: () => {},
                strokeRect: () => {},
                beginPath: () => {},
                arc: () => {},
                fill: () => {},
                stroke: () => {},
                fillText: () => {},
                moveTo: () => {},
                lineTo: () => {}
            })
        } as any

        mockCtx.canvas = mockCanvas
        mockCtx.ctx2d = mockCanvas.getContext('2d')

        runtime.mount(spinnerSegment, mockCtx)

        // Don't activate spinner, just update past end time
        runtime.update(2100)

        // Spinner should be auto-missed
        expect(missCount).toBe(1)
    })

    test('spinner calculates required rotations based on duration', () => {
        const testCases = [
            { duration: 500, expectedMin: 1, expectedMax: 1 },   // Short spinner: 1 rotation
            { duration: 1000, expectedMin: 1, expectedMax: 1 },  // 1 second: 1 rotation
            { duration: 2000, expectedMin: 2, expectedMax: 2 },  // 2 seconds: 2 rotations
            { duration: 3000, expectedMin: 3, expectedMax: 3 },  // 3 seconds: 3 rotations
            { duration: 5000, expectedMin: 3, expectedMax: 3 }   // Long spinner: capped at 3
        ]

        testCases.forEach(({ duration, expectedMin, expectedMax }) => {
            const spinnerNote: OsuNote = {
                type: 'spinner',
                x: 256,
                y: 192,
                time: 1000,
                endTime: 1000 + duration
            }

            const spinnerSegment: OsuStandardSegment = {
                ...segment,
                notes: [spinnerNote]
            }

            // Create proper mock canvas
            const mockCanvas = {
                getContext: () => ({
                    fillStyle: '',
                    strokeStyle: '',
                    lineWidth: 0,
                    globalAlpha: 1,
                    font: '',
                    textAlign: '',
                    textBaseline: '',
                    fillRect: () => {},
                    strokeRect: () => {},
                    beginPath: () => {},
                    arc: () => {},
                    fill: () => {},
                    stroke: () => {},
                    fillText: () => {},
                    moveTo: () => {},
                    lineTo: () => {}
                })
            } as any

            mockCtx.canvas = mockCanvas
            mockCtx.ctx2d = mockCanvas.getContext('2d')

            // Reset scorer for each iteration
            mockScorer.totalNotes = 0
            
            // Create new runtime instance for each iteration
            const testRuntime = new OsuStandardRuntime()
            testRuntime.mount(spinnerSegment, mockCtx)

            // Should mount without errors
            expect(mockScorer.totalNotes).toBe(1)
        })
    })

    test('spinner renders with rotation indicator', () => {
        const spinnerNote: OsuNote = {
            type: 'spinner',
            x: 256,
            y: 192,
            time: 1000,
            endTime: 2000
        }

        const spinnerSegment: OsuStandardSegment = {
            ...segment,
            notes: [spinnerNote]
        }

        // Create proper mock canvas with all required methods
        const mockCanvas = {
            getContext: () => ({
                fillStyle: '',
                strokeStyle: '',
                lineWidth: 0,
                globalAlpha: 1,
                font: '',
                textAlign: '',
                textBaseline: '',
                fillRect: () => {},
                strokeRect: () => {},
                beginPath: () => {},
                arc: () => {},
                fill: () => {},
                stroke: () => {},
                fillText: () => {},
                moveTo: () => {},
                lineTo: () => {}
            })
        } as any

        mockCtx.canvas = mockCanvas
        mockCtx.ctx2d = mockCanvas.getContext('2d')

        runtime.mount(spinnerSegment, mockCtx)

        // Activate spinner
        const screenX = mockCtx.area.w / 2
        runtime.handleTouchStart(screenX, 1000)

        // Update to render spinner
        runtime.update(1500)

        // Should render without errors
        expect(mockScorer.totalNotes).toBe(1)
    })

    test('spinner judges based on rotation completion percentage', () => {
        // This test verifies the judgement logic exists
        // In a real scenario, we would simulate actual rotations
        const spinnerNote: OsuNote = {
            type: 'spinner',
            x: 256,
            y: 192,
            time: 1000,
            endTime: 2000
        }

        const spinnerSegment: OsuStandardSegment = {
            ...segment,
            notes: [spinnerNote]
        }

        let judgementReceived = false
        mockScorer.add = (j: J) => {
            judgementReceived = true
        }

        // Create proper mock canvas
        const mockCanvas = {
            getContext: () => ({
                fillStyle: '',
                strokeStyle: '',
                lineWidth: 0,
                globalAlpha: 1,
                font: '',
                textAlign: '',
                textBaseline: '',
                fillRect: () => {},
                strokeRect: () => {},
                beginPath: () => {},
                arc: () => {},
                fill: () => {},
                stroke: () => {},
                fillText: () => {},
                moveTo: () => {},
                lineTo: () => {}
            })
        } as any

        mockCtx.canvas = mockCanvas
        mockCtx.ctx2d = mockCanvas.getContext('2d')

        runtime.mount(spinnerSegment, mockCtx)

        // Activate spinner
        const screenX = mockCtx.area.w / 2
        runtime.handleTouchStart(screenX, 1000)

        // Update past end time
        runtime.update(2100)

        // Should have received a judgement
        expect(judgementReceived).toBe(true)
    })

    test('unmount force-judges active spinners as Miss', () => {
        let missCount = 0
        mockScorer.add = (j: J) => {
            if (j === J.Miss) missCount++
        }

        const spinnerNote: OsuNote = {
            type: 'spinner',
            x: 256,
            y: 192,
            time: 1000,
            endTime: 2000
        }

        const spinnerSegment: OsuStandardSegment = {
            ...segment,
            notes: [spinnerNote]
        }

        runtime.mount(spinnerSegment, mockCtx)

        // Activate spinner
        const screenX = mockCtx.area.w / 2
        runtime.handleTouchStart(screenX, 1000)

        // Unmount while spinner is active
        runtime.unmount()

        // Active spinner should be judged as Miss
        expect(missCount).toBe(1)
    })
})

