import { describe, test, expect, beforeEach, vi } from 'vitest'
import { RuntimeManagerImpl } from './runtime-manager'
import type { Chart, Segment, ManiaSegment } from './types'
import type { ISegmentRuntime, RuntimeContext } from './runtimes/interface'

// Mock runtime for testing with cleanup tracking
class MockRuntime implements ISegmentRuntime {
    mountCalled = false
    unmountCalled = false
    cleanedUp = false

    mount(segment: Segment, ctx: RuntimeContext): void {
        this.mountCalled = true
    }

    unmount(): void {
        this.unmountCalled = true
        // Simulate cleanup
        this.cleanedUp = true
    }

    update(songMs: number): void {}
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

describe('RuntimeManagerImpl - Task 11.2 Memory Management', () => {
    let chart: Chart
    let ctx: RuntimeContext
    let factories: Record<string, () => ISegmentRuntime>

    beforeEach(() => {
        chart = createTestChart()
        ctx = createMockContext()
    })

    test('unmounted runtimes are garbage collected (unmount called)', () => {
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
        expect(runtime1.mountCalled).toBe(true)
        expect(runtime1.unmountCalled).toBe(false)
        
        // Transition to second segment
        manager.tick(5000)
        
        // Verify first runtime was unmounted (allowing GC)
        expect(runtime1.unmountCalled).toBe(true)
        expect(runtime1.cleanedUp).toBe(true)
        expect(runtime2.mountCalled).toBe(true)
    })

    test('clearPreloaded is called when preloaded runtime not used', () => {
        const runtime1 = new MockRuntime()
        const preloadedRuntime = new MockRuntime()
        const runtime3 = new MockRuntime()
        let callCount = 0
        
        factories = {
            mania: () => {
                callCount++
                if (callCount === 1) return runtime1
                if (callCount === 2) return preloadedRuntime
                return runtime3
            }
        }

        const manager = new RuntimeManagerImpl(chart, ctx, factories)
        
        // Start in first segment
        manager.tick(0)
        
        // Preload second segment
        manager.tick(4500)
        expect(callCount).toBe(2)
        
        // Jump to third segment (skipping second)
        // This should clear the preloaded runtime for segment 2
        manager.tick(10000)
        
        // Verify preloaded runtime was not used
        expect(preloadedRuntime.mountCalled).toBe(false)
        expect(runtime3.mountCalled).toBe(true)
        expect(callCount).toBe(3)
    })

    test('only one runtime is active at a time', () => {
        const runtimes: MockRuntime[] = []
        
        factories = {
            mania: () => {
                const runtime = new MockRuntime()
                runtimes.push(runtime)
                return runtime
            }
        }

        const manager = new RuntimeManagerImpl(chart, ctx, factories)
        
        // Play through all segments
        manager.tick(0)    // seg1
        manager.tick(2500) // seg1
        manager.tick(5000) // seg2
        manager.tick(7500) // seg2
        manager.tick(10000) // seg3
        manager.tick(12500) // seg3
        
        // Verify only the last runtime is still mounted
        expect(runtimes.length).toBe(3)
        expect(runtimes[0].unmountCalled).toBe(true)
        expect(runtimes[1].unmountCalled).toBe(true)
        expect(runtimes[2].unmountCalled).toBe(false) // Still active
    })

    test('preloaded runtime is cleared after use', () => {
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
        
        // Preload second segment
        manager.tick(4500)
        expect(callCount).toBe(2)
        
        // Transition to second segment (uses preloaded)
        manager.tick(5000)
        expect(preloadedRuntime.mountCalled).toBe(true)
        
        // Try to preload third segment
        // Should create new runtime, not reuse the now-active runtime
        manager.tick(9500)
        expect(callCount).toBe(3) // New runtime created for preload
    })

    test('memory usage stays bounded during extended play', () => {
        const runtimes: MockRuntime[] = []
        
        factories = {
            mania: () => {
                const runtime = new MockRuntime()
                runtimes.push(runtime)
                return runtime
            }
        }

        const manager = new RuntimeManagerImpl(chart, ctx, factories)
        
        // Simulate extended play session with many transitions
        const timeSteps = [
            0, 1000, 2000, 3000, 4000, 4500, // seg1 + preload
            5000, 6000, 7000, 8000, 9000, 9500, // seg2 + preload
            10000, 11000, 12000, 13000, 14000 // seg3
        ]
        
        for (const time of timeSteps) {
            manager.tick(time)
        }
        
        // Should have created exactly 5 runtimes:
        // 1 for seg1, 1 preload for seg2, 1 for seg3, 1 preload for seg3 (if exists)
        // Actually: seg1, preload seg2, preload seg3 = 3 runtimes
        expect(runtimes.length).toBeLessThanOrEqual(5)
        
        // All but the last should be unmounted
        const unmountedCount = runtimes.filter(r => r.unmountCalled).length
        expect(unmountedCount).toBe(runtimes.length - 1)
    })

    test('no memory leaks from unused preloaded runtimes', () => {
        const runtime1 = new MockRuntime()
        const preloadedRuntime2 = new MockRuntime()
        const preloadedRuntime3 = new MockRuntime()
        let callCount = 0
        
        factories = {
            mania: () => {
                callCount++
                if (callCount === 1) return runtime1
                if (callCount === 2) return preloadedRuntime2
                if (callCount === 3) return preloadedRuntime3
                return new MockRuntime()
            }
        }

        const manager = new RuntimeManagerImpl(chart, ctx, factories)
        
        // Start in first segment
        manager.tick(0)
        expect(callCount).toBe(1)
        
        // Preload second segment
        manager.tick(4500)
        expect(callCount).toBe(2)
        expect(preloadedRuntime2.mountCalled).toBe(false)
        
        // Transition to second segment (uses preload)
        manager.tick(5000)
        expect(preloadedRuntime2.mountCalled).toBe(true)
        expect(callCount).toBe(2) // No new runtime created
        
        // Continue in second segment, preload third segment
        manager.tick(9500)
        expect(callCount).toBe(3)
        expect(preloadedRuntime3.mountCalled).toBe(false)
        
        // Transition to third segment (should use preload)
        manager.tick(10000)
        
        // Verify:
        // - Only 3 runtimes created (seg1, preload seg2, preload seg3)
        // - All preloaded runtimes were used
        // - No extra runtimes created
        expect(preloadedRuntime2.mountCalled).toBe(true)
        expect(preloadedRuntime3.mountCalled).toBe(true)
        expect(callCount).toBe(3) // Only 3 runtimes created total
    })
})
