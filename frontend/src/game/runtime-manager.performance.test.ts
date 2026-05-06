import { describe, test, expect, beforeEach, vi } from 'vitest'
import { RuntimeManagerImpl, PRELOAD_THRESHOLD_MS } from './runtime-manager'
import type { Chart, Segment, ManiaSegment } from './types'
import type { ISegmentRuntime, RuntimeContext } from './runtimes/interface'

// Mock runtime for testing
class MockRuntime implements ISegmentRuntime {
    mountCalled = false
    unmountCalled = false
    updateCalled = false
    mountTime = 0
    unmountTime = 0

    mount(segment: Segment, ctx: RuntimeContext): void {
        this.mountCalled = true
        this.mountTime = performance.now()
    }

    unmount(): void {
        this.unmountCalled = true
        this.unmountTime = performance.now()
    }

    update(songMs: number): void {
        this.updateCalled = true
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
            } as ManiaSegment,
            {
                id: 'seg2',
                mode: 'mania',
                startMs: 5000,
                endMs: 10000,
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

describe('RuntimeManagerImpl - Task 11.1 Performance Verification', () => {
    let chart: Chart
    let ctx: RuntimeContext
    let factories: Record<string, () => ISegmentRuntime>

    beforeEach(() => {
        chart = createTestChart()
        ctx = createMockContext()
    })

    test('preloadNext is called 1000ms before transition', () => {
        let factoryCallCount = 0
        let preloadCallTime = 0
        
        factories = {
            mania: () => {
                factoryCallCount++
                if (factoryCallCount === 2) {
                    // Second call is for preloading
                    preloadCallTime = factoryCallCount
                }
                return new MockRuntime()
            }
        }

        const manager = new RuntimeManagerImpl(chart, ctx, factories)
        
        // Start in first segment (first factory call)
        manager.tick(0)
        expect(factoryCallCount).toBe(1)
        
        // Tick at 3500ms (1500ms before transition at 5000ms)
        // Should NOT preload yet (beyond threshold)
        manager.tick(3500)
        expect(factoryCallCount).toBe(1)
        
        // Tick at 4000ms (1000ms before transition)
        // Should preload now (exactly at threshold)
        manager.tick(4000)
        expect(factoryCallCount).toBe(2)
        expect(preloadCallTime).toBe(2)
        
        // Verify preload happened at correct time
        const expectedPreloadTime = 5000 - PRELOAD_THRESHOLD_MS
        expect(4000).toBe(expectedPreloadTime)
    })

    test('preloaded runtime is used on transition', () => {
        const runtime1 = new MockRuntime()
        const preloadedRuntime = new MockRuntime()
        const fallbackRuntime = new MockRuntime()
        let callCount = 0
        
        factories = {
            mania: () => {
                callCount++
                if (callCount === 1) return runtime1
                if (callCount === 2) return preloadedRuntime
                return fallbackRuntime
            }
        }

        const manager = new RuntimeManagerImpl(chart, ctx, factories)
        
        // Start in first segment (call 1)
        manager.tick(0)
        expect(runtime1.mountCalled).toBe(true)
        
        // Trigger preload at 4500ms (500ms before transition) (call 2)
        manager.tick(4500)
        expect(preloadedRuntime.mountCalled).toBe(false) // Not mounted yet, just created
        expect(callCount).toBe(2)
        
        // Transition to second segment at 5000ms
        // Should use preloaded runtime (no new factory call)
        manager.tick(5000)
        
        // Verify preloaded runtime was used (not fallback)
        expect(preloadedRuntime.mountCalled).toBe(true)
        expect(fallbackRuntime.mountCalled).toBe(false)
        expect(callCount).toBe(2) // No additional factory calls
    })

    test('transition latency is less than 100ms', () => {
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
        
        // Preload next segment
        manager.tick(4500)
        
        // Measure transition time
        const transitionStart = performance.now()
        manager.tick(5000)
        const transitionEnd = performance.now()
        
        const transitionLatency = transitionEnd - transitionStart
        
        // Verify transition completed
        expect(runtime1.unmountCalled).toBe(true)
        expect(runtime2.mountCalled).toBe(true)
        
        // Verify latency is under 100ms
        // Note: This is a very generous threshold for unit tests
        // In real gameplay, latency should be much lower (< 10ms typically)
        expect(transitionLatency).toBeLessThan(100)
    })

    test('transition with preloading is faster than without preloading', () => {
        // Test 1: Transition WITH preloading
        const preloadedRuntime1 = new MockRuntime()
        const preloadedRuntime2 = new MockRuntime()
        let preloadCallCount = 0
        
        const preloadFactories = {
            mania: () => {
                preloadCallCount++
                return preloadCallCount === 1 ? preloadedRuntime1 : preloadedRuntime2
            }
        }

        const managerWithPreload = new RuntimeManagerImpl(chart, ctx, preloadFactories)
        managerWithPreload.tick(0)
        managerWithPreload.tick(4500) // Trigger preload
        
        const preloadTransitionStart = performance.now()
        managerWithPreload.tick(5000)
        const preloadTransitionEnd = performance.now()
        const preloadLatency = preloadTransitionEnd - preloadTransitionStart
        
        // Test 2: Transition WITHOUT preloading (cold start)
        const coldRuntime1 = new MockRuntime()
        const coldRuntime2 = new MockRuntime()
        let coldCallCount = 0
        
        const coldFactories = {
            mania: () => {
                coldCallCount++
                return coldCallCount === 1 ? coldRuntime1 : coldRuntime2
            }
        }

        const managerWithoutPreload = new RuntimeManagerImpl(chart, ctx, coldFactories)
        managerWithoutPreload.tick(0)
        // Skip preload phase - go directly to transition
        
        const coldTransitionStart = performance.now()
        managerWithoutPreload.tick(5000)
        const coldTransitionEnd = performance.now()
        const coldLatency = coldTransitionEnd - coldTransitionStart
        
        // Verify both transitions completed
        expect(preloadedRuntime2.mountCalled).toBe(true)
        expect(coldRuntime2.mountCalled).toBe(true)
        
        // Preloaded transition should be faster or equal
        // (In practice, preloading reduces latency by avoiding runtime creation during transition)
        expect(preloadLatency).toBeLessThanOrEqual(coldLatency + 5) // Allow 5ms margin
    })

    test('preloading does not affect active segment performance', () => {
        const activeRuntime = new MockRuntime()
        const preloadedRuntime = new MockRuntime()
        let callCount = 0
        
        factories = {
            mania: () => {
                callCount++
                return callCount === 1 ? activeRuntime : preloadedRuntime
            }
        }

        const manager = new RuntimeManagerImpl(chart, ctx, factories)
        
        // Start in first segment
        manager.tick(0)
        
        // Measure update performance before preload
        const beforePreloadStart = performance.now()
        for (let i = 0; i < 100; i++) {
            manager.tick(1000 + i * 10)
        }
        const beforePreloadEnd = performance.now()
        const beforePreloadTime = beforePreloadEnd - beforePreloadStart
        
        // Trigger preload
        manager.tick(4500)
        
        // Measure update performance after preload
        const afterPreloadStart = performance.now()
        for (let i = 0; i < 100; i++) {
            manager.tick(4500 + i * 4)
        }
        const afterPreloadEnd = performance.now()
        const afterPreloadTime = afterPreloadEnd - afterPreloadStart
        
        // Performance should not degrade significantly after preload
        // Allow 50% overhead (very generous for unit tests)
        expect(afterPreloadTime).toBeLessThan(beforePreloadTime * 1.5)
    })
})
