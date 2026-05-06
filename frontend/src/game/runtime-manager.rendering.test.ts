import { describe, test, expect, beforeEach, vi } from 'vitest'
import { RuntimeManagerImpl } from './runtime-manager'
import type { Chart, Segment, ManiaSegment } from './types'
import type { ISegmentRuntime, RuntimeContext } from './runtimes/interface'

// Mock runtime for testing with update tracking
class MockRuntime implements ISegmentRuntime {
    mountCalled = false
    unmountCalled = false
    updateCallCount = 0
    lastUpdateTime = 0

    mount(segment: Segment, ctx: RuntimeContext): void {
        this.mountCalled = true
    }

    unmount(): void {
        this.unmountCalled = true
    }

    update(songMs: number): void {
        this.updateCallCount++
        this.lastUpdateTime = songMs
    }

    handleKeyDown(key: string, songMs: number): void {}
    handleKeyUp(key: string, songMs: number): void {}
    handleTouchStart(x: number, songMs: number): void {}
    handleTouchEnd(x: number, songMs: number): void {}
    isComplete(songMs: number): boolean {
        return false
    }
}

function createTestChart(): Chart {
    return {
        meta: {
            title: 'Test Chart',
            artist: 'Test Artist',
            audio: 'test.mp3',
            length: 15000
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
            } as ManiaSegment,
            {
                id: 'seg2',
                mode: 'mania',
                startMs: 5000,
                endMs: 10000,
                judgeRule: 'mania-od8',
                config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
                notes: []
            } as ManiaSegment,
            {
                id: 'seg3',
                mode: 'mania',
                startMs: 10000,
                endMs: 15000,
                judgeRule: 'mania-od8',
                config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
                notes: []
            } as ManiaSegment
        ]
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

describe('RuntimeManagerImpl - Task 11.3 Rendering Optimization', () => {
    let chart: Chart
    let ctx: RuntimeContext
    let factories: Record<string, () => ISegmentRuntime>

    beforeEach(() => {
        chart = createTestChart()
        ctx = createMockContext()
    })

    test('only active runtime update method is called', () => {
        const runtime1 = new MockRuntime()
        const runtime2 = new MockRuntime()
        let callCount = 0
        
        factories = {
            mania: () => {
                callCount++
                return callCount === 1 ? runtime1 : runtime2
            }
        }

        const manager = new RuntimeManagerImpl(chart, ctx, factories)
        
        // Start in first segment
        manager.tick(0)
        expect(runtime1.updateCallCount).toBe(1)
        
        // Continue in first segment
        manager.tick(1000)
        manager.tick(2000)
        manager.tick(3000)
        expect(runtime1.updateCallCount).toBe(4)
        expect(runtime2.updateCallCount).toBe(0)
        
        // Transition to second segment
        manager.tick(5000)
        expect(runtime2.updateCallCount).toBe(1)
        
        // Continue in second segment
        manager.tick(6000)
        manager.tick(7000)
        expect(runtime2.updateCallCount).toBe(3)
        
        // Verify first runtime is no longer updated
        expect(runtime1.updateCallCount).toBe(4) // Still 4, not incremented
    })

    test('inactive segments are not rendered', () => {
        const runtime1 = new MockRuntime()
        const runtime2 = new MockRuntime()
        const runtime3 = new MockRuntime()
        let callCount = 0
        
        factories = {
            mania: () => {
                callCount++
                if (callCount === 1) return runtime1
                if (callCount === 2) return runtime2
                return runtime3
            }
        }

        const manager = new RuntimeManagerImpl(chart, ctx, factories)
        
        // Play through all segments
        manager.tick(0)
        manager.tick(1000)
        manager.tick(2000)
        
        manager.tick(5000)
        manager.tick(6000)
        manager.tick(7000)
        
        manager.tick(10000)
        manager.tick(11000)
        manager.tick(12000)
        
        // Verify only active runtime was updated at each time
        expect(runtime1.updateCallCount).toBe(3) // 0, 1000, 2000
        expect(runtime2.updateCallCount).toBe(3) // 5000, 6000, 7000
        expect(runtime3.updateCallCount).toBe(3) // 10000, 11000, 12000
    })

    test('no update calls when no segment is active', () => {
        const runtime1 = new MockRuntime()
        
        factories = {
            mania: () => runtime1
        }

        const manager = new RuntimeManagerImpl(chart, ctx, factories)
        
        // Tick before first segment
        manager.tick(-1000)
        manager.tick(-500)
        expect(runtime1.updateCallCount).toBe(0)
        
        // Tick after last segment
        manager.tick(16000)
        manager.tick(17000)
        expect(runtime1.updateCallCount).toBe(0)
    })

    test('preloaded runtime is not updated until mounted', () => {
        const runtime1 = new MockRuntime()
        const preloadedRuntime = new MockRuntime()
        let callCount = 0
        
        factories = {
            mania: () => {
                callCount++
                return callCount === 1 ? runtime1 : preloadedRuntime
            }
        }

        const manager = new RuntimeManagerImpl(chart, ctx, factories)
        
        // Start in first segment
        manager.tick(0)
        expect(runtime1.updateCallCount).toBe(1)
        
        // Continue in first segment (before preload)
        manager.tick(4000)
        expect(runtime1.updateCallCount).toBe(2)
        
        // Preload second segment
        manager.tick(4500)
        expect(runtime1.updateCallCount).toBe(3) // First runtime still updated
        expect(preloadedRuntime.updateCallCount).toBe(0) // Not updated yet
        
        // Continue in first segment
        manager.tick(4600)
        manager.tick(4700)
        expect(runtime1.updateCallCount).toBe(5)
        expect(preloadedRuntime.updateCallCount).toBe(0) // Still not updated
        
        // Transition to second segment
        manager.tick(5000)
        expect(preloadedRuntime.updateCallCount).toBe(1) // Now updated
    })

    test('rendering performance: only one update per tick', () => {
        const runtimes: MockRuntime[] = []
        
        factories = {
            mania: () => {
                const runtime = new MockRuntime()
                runtimes.push(runtime)
                return runtime
            }
        }

        const manager = new RuntimeManagerImpl(chart, ctx, factories)
        
        // Simulate 60 FPS gameplay (16.67ms per frame)
        const frameTimes = []
        for (let i = 0; i < 300; i++) { // 5 seconds at 60 FPS
            frameTimes.push(i * 16.67)
        }
        
        for (const time of frameTimes) {
            manager.tick(time)
        }
        
        // Verify only one runtime was updated per tick
        // At any given time, only the active runtime should have been updated
        const totalUpdates = runtimes.reduce((sum, r) => sum + r.updateCallCount, 0)
        expect(totalUpdates).toBe(frameTimes.length)
    })

    test('update is called with correct song time', () => {
        const runtime1 = new MockRuntime()
        
        factories = {
            mania: () => runtime1
        }

        const manager = new RuntimeManagerImpl(chart, ctx, factories)
        
        // Test various times
        const testTimes = [0, 500, 1000, 2500, 4000]
        
        for (const time of testTimes) {
            manager.tick(time)
        }
        
        // Verify last update time matches last tick
        expect(runtime1.lastUpdateTime).toBe(4000)
        expect(runtime1.updateCallCount).toBe(testTimes.length)
    })

    test('rendering optimization maintains 60 FPS target', () => {
        const runtime1 = new MockRuntime()
        const runtime2 = new MockRuntime()
        let callCount = 0
        
        factories = {
            mania: () => {
                callCount++
                return callCount === 1 ? runtime1 : runtime2
            }
        }

        const manager = new RuntimeManagerImpl(chart, ctx, factories)
        
        // Measure update performance
        const iterations = 1000
        const startTime = performance.now()
        
        for (let i = 0; i < iterations; i++) {
            manager.tick(i * 16.67)
        }
        
        const endTime = performance.now()
        const totalTime = endTime - startTime
        const avgTimePerUpdate = totalTime / iterations
        
        // Each update should take less than 16.67ms (60 FPS)
        // In practice, it should be much faster (< 1ms)
        expect(avgTimePerUpdate).toBeLessThan(16.67)
        
        // Verify updates were called (accounting for segment transitions)
        // At 16.67ms per frame, 1000 iterations = 16670ms
        // Segment 1: 0-5000ms = ~300 frames
        // Segment 2: 5000-10000ms = ~300 frames
        // Segment 3: 10000-15000ms = ~300 frames
        // After 15000ms: no active segment = ~100 frames with no updates
        const totalUpdates = runtime1.updateCallCount + runtime2.updateCallCount
        expect(totalUpdates).toBeGreaterThan(800) // Most frames should have updates
        expect(totalUpdates).toBeLessThanOrEqual(iterations)
    })
})
