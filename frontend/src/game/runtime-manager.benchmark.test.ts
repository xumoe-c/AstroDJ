import { describe, test, expect, beforeEach, vi } from 'vitest'
import { RuntimeManagerImpl } from './runtime-manager'
import { ChartParserImpl } from './parser'
import { ChartValidatorImpl } from './validator'
import { ChartFormatterImpl } from './formatter'
import type { Chart, Segment, ManiaSegment } from './types'
import type { ISegmentRuntime, RuntimeContext } from './runtimes/interface'

// Mock runtime for testing
class MockRuntime implements ISegmentRuntime {
    mountCalled = false
    unmountCalled = false
    updateCallCount = 0

    mount(segment: Segment, ctx: RuntimeContext): void {
        this.mountCalled = true
    }

    unmount(): void {
        this.unmountCalled = true
    }

    update(songMs: number): void {
        this.updateCallCount++
    }

    handleKeyDown(key: string, songMs: number): void {}
    handleKeyUp(key: string, songMs: number): void {}
    handleTouchStart(x: number, songMs: number): void {}
    handleTouchEnd(x: number, songMs: number): void {}
    isComplete(songMs: number): boolean {
        return false
    }
}

function createLargeChart(segmentCount: number, notesPerSegment: number): Chart {
    const segments: ManiaSegment[] = []
    const segmentDuration = 5000
    
    for (let i = 0; i < segmentCount; i++) {
        const notes = []
        for (let j = 0; j < notesPerSegment; j++) {
            notes.push({
                time: i * segmentDuration + (j * segmentDuration / notesPerSegment),
                lane: j % 4,
                endTime: undefined
            })
        }
        
        segments.push({
            id: `seg${i + 1}`,
            mode: 'mania',
            startMs: i * segmentDuration,
            endMs: (i + 1) * segmentDuration,
            judgeRule: 'mania-od8',
            config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
            notes
        } as ManiaSegment)
    }
    
    return {
        meta: {
            title: 'Large Test Chart',
            artist: 'Test Artist',
            audio: 'test.mp3',
            length: segmentCount * segmentDuration
        },
        segments
    }
}

function createMockContext(): RuntimeContext {
    const canvas = document.createElement('canvas')
    const ctx2d = canvas.getContext('2d')!
    
    return {
        canvas,
        ctx2d,
        area: { x: 0, y: 0, w: 800, h: 600 },
        scorer: {
            addJudgement: vi.fn(),
            getScore: vi.fn(() => 0),
            getCombo: vi.fn(() => 0),
            getAccuracy: vi.fn(() => 100),
            reset: vi.fn()
        } as any,
        judge: vi.fn(() => 0)
    }
}

describe('RuntimeManagerImpl - Task 11.4 Performance Benchmarks', () => {
    let ctx: RuntimeContext
    let factories: Record<string, () => ISegmentRuntime>

    beforeEach(() => {
        ctx = createMockContext()
        factories = {
            mania: () => new MockRuntime()
        }
    })

    test('parsing performance: < 50ms for charts with 1000+ notes', () => {
        const chart = createLargeChart(10, 100) // 10 segments, 100 notes each = 1000 notes
        const parser = new ChartParserImpl()
        const formatter = new ChartFormatterImpl()
        
        const json = formatter.toJSON(chart)
        
        const startTime = performance.now()
        const result = parser.parseJSON(json)
        const endTime = performance.now()
        
        const parseTime = endTime - startTime
        
        expect(result.ok).toBe(true)
        expect(parseTime).toBeLessThan(50)
        
        console.log(`Parsing 1000 notes took ${parseTime.toFixed(2)}ms`)
    })

    test('validation performance: < 10ms for charts with 10 segments', () => {
        const chart = createLargeChart(10, 50) // 10 segments, 50 notes each
        const validator = new ChartValidatorImpl()
        
        const startTime = performance.now()
        const errors = validator.validate(chart)
        const endTime = performance.now()
        
        const validateTime = endTime - startTime
        
        expect(errors.length).toBe(0)
        expect(validateTime).toBeLessThan(10)
        
        console.log(`Validating 10 segments took ${validateTime.toFixed(2)}ms`)
    })

    test('serialization performance: < 30ms for charts with 1000+ notes', () => {
        const chart = createLargeChart(10, 100) // 1000 notes
        const formatter = new ChartFormatterImpl()
        
        const startTime = performance.now()
        const json = formatter.toJSON(chart)
        const endTime = performance.now()
        
        const serializeTime = endTime - startTime
        
        expect(json.length).toBeGreaterThan(0)
        expect(serializeTime).toBeLessThan(30)
        
        console.log(`Serializing 1000 notes took ${serializeTime.toFixed(2)}ms`)
    })

    test('segment transition latency: < 100ms', () => {
        const chart = createLargeChart(2, 50)
        const manager = new RuntimeManagerImpl(chart, ctx, factories)
        
        // Start in first segment
        manager.tick(0)
        
        // Measure transition time
        const transitionStart = performance.now()
        manager.tick(5000) // Transition to second segment
        const transitionEnd = performance.now()
        
        const transitionLatency = transitionEnd - transitionStart
        
        expect(transitionLatency).toBeLessThan(100)
        
        console.log(`Transition latency: ${transitionLatency.toFixed(2)}ms`)
    })

    test('FPS performance: maintain 60 FPS during gameplay with 10 segments', () => {
        const chart = createLargeChart(10, 100)
        const manager = new RuntimeManagerImpl(chart, ctx, factories)
        
        // Simulate 60 FPS gameplay for 5 seconds
        const targetFPS = 60
        const frameDuration = 1000 / targetFPS // 16.67ms
        const duration = 5000 // 5 seconds
        const frameCount = Math.floor(duration / frameDuration)
        
        const frameTimes: number[] = []
        
        for (let i = 0; i < frameCount; i++) {
            const frameStart = performance.now()
            manager.tick(i * frameDuration)
            const frameEnd = performance.now()
            
            frameTimes.push(frameEnd - frameStart)
        }
        
        // Calculate average frame time
        const avgFrameTime = frameTimes.reduce((sum, t) => sum + t, 0) / frameTimes.length
        
        // Calculate how many frames exceeded 16.67ms (dropped frames)
        const droppedFrames = frameTimes.filter(t => t > frameDuration).length
        const droppedFramePercentage = (droppedFrames / frameCount) * 100
        
        // Verify performance
        expect(avgFrameTime).toBeLessThan(frameDuration)
        expect(droppedFramePercentage).toBeLessThan(5) // Less than 5% dropped frames
        
        console.log(`Average frame time: ${avgFrameTime.toFixed(2)}ms`)
        console.log(`Dropped frames: ${droppedFrames}/${frameCount} (${droppedFramePercentage.toFixed(2)}%)`)
    })

    test('transition latency with preloading: < 100ms', () => {
        const chart = createLargeChart(3, 100)
        const manager = new RuntimeManagerImpl(chart, ctx, factories)
        
        // Start in first segment
        manager.tick(0)
        
        // Trigger preload
        manager.tick(4500)
        
        // Measure transition time with preload
        const transitionStart = performance.now()
        manager.tick(5000)
        const transitionEnd = performance.now()
        
        const transitionLatency = transitionEnd - transitionStart
        
        expect(transitionLatency).toBeLessThan(100)
        
        console.log(`Transition latency with preload: ${transitionLatency.toFixed(2)}ms`)
    })

    test('memory efficiency: bounded memory usage during extended play', () => {
        const chart = createLargeChart(10, 100)
        const runtimes: MockRuntime[] = []
        
        const trackingFactories = {
            mania: () => {
                const runtime = new MockRuntime()
                runtimes.push(runtime)
                return runtime
            }
        }
        
        const manager = new RuntimeManagerImpl(chart, ctx, trackingFactories)
        
        // Simulate extended play session (10 seconds at 60 FPS)
        const frameDuration = 1000 / 60
        const duration = 10000
        const frameCount = Math.floor(duration / frameDuration)
        
        for (let i = 0; i < frameCount; i++) {
            manager.tick(i * frameDuration)
        }
        
        // Verify memory efficiency
        // Should have created at most: 10 segments + preloads = ~15 runtimes
        expect(runtimes.length).toBeLessThanOrEqual(15)
        
        // Most runtimes should be unmounted (garbage collected)
        const unmountedCount = runtimes.filter(r => r.unmountCalled).length
        expect(unmountedCount).toBeGreaterThan(runtimes.length - 3)
        
        console.log(`Total runtimes created: ${runtimes.length}`)
        console.log(`Unmounted runtimes: ${unmountedCount}`)
    })

    test('update performance: < 16ms per frame with 100+ visible notes', () => {
        const chart = createLargeChart(1, 100) // Single segment with 100 notes
        const manager = new RuntimeManagerImpl(chart, ctx, factories)
        
        // Measure update performance
        const iterations = 100
        const frameTimes: number[] = []
        
        for (let i = 0; i < iterations; i++) {
            const frameStart = performance.now()
            manager.tick(i * 16.67)
            const frameEnd = performance.now()
            
            frameTimes.push(frameEnd - frameStart)
        }
        
        const avgFrameTime = frameTimes.reduce((sum, t) => sum + t, 0) / frameTimes.length
        const maxFrameTime = Math.max(...frameTimes)
        
        expect(avgFrameTime).toBeLessThan(16)
        expect(maxFrameTime).toBeLessThan(20) // Allow some variance
        
        console.log(`Average update time: ${avgFrameTime.toFixed(2)}ms`)
        console.log(`Max update time: ${maxFrameTime.toFixed(2)}ms`)
    })

    test('overall performance: complete playthrough of 10-segment chart', () => {
        const chart = createLargeChart(10, 100)
        const manager = new RuntimeManagerImpl(chart, ctx, factories)
        
        // Simulate complete playthrough at 60 FPS
        const frameDuration = 1000 / 60
        const chartDuration = chart.meta.length
        const frameCount = Math.floor(chartDuration / frameDuration)
        
        const startTime = performance.now()
        
        for (let i = 0; i < frameCount; i++) {
            manager.tick(i * frameDuration)
        }
        
        const endTime = performance.now()
        const totalTime = endTime - startTime
        const avgFrameTime = totalTime / frameCount
        
        // Verify overall performance
        expect(avgFrameTime).toBeLessThan(16.67)
        
        console.log(`Complete playthrough: ${frameCount} frames in ${totalTime.toFixed(2)}ms`)
        console.log(`Average frame time: ${avgFrameTime.toFixed(2)}ms`)
    })
})
