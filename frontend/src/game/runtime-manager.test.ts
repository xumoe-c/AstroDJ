import { describe, test, expect, vi, beforeEach } from 'vitest'
import { RuntimeManagerImpl } from './runtime-manager'
import type { Chart, Segment, ManiaSegment, TaikoSegment, OsuStandardSegment } from './types'
import type { ISegmentRuntime, RuntimeContext } from './runtimes/interface'
import type { GlobalScorer } from './scorer'

// Mock segment runtime for testing
class MockRuntime implements ISegmentRuntime {
    public mountCalled = false
    public unmountCalled = false
    public updateCalled = false
    public mountedSegment: Segment | null = null

    mount(segment: Segment, ctx: RuntimeContext): void {
        this.mountCalled = true
        this.mountedSegment = segment
    }

    update(songMs: number): void {
        this.updateCalled = true
    }

    handleKeyDown(key: string, songMs: number): void {}
    handleKeyUp(key: string, songMs: number): void {}
    handleTouchStart(x: number, songMs: number): void {}
    handleTouchEnd(x: number, songMs: number): void {}

    unmount(): void {
        this.unmountCalled = true
    }

    isComplete(songMs: number): boolean {
        return false
    }
}

// Helper to create test chart
function createTestChart(): Chart {
    const segment1: ManiaSegment = {
        id: 'seg1',
        mode: 'mania',
        startMs: 0,
        endMs: 5000,
        judgeRule: 'mania-od7',
        config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
        notes: []
    }

    const segment2: ManiaSegment = {
        id: 'seg2',
        mode: 'mania',
        startMs: 5000,
        endMs: 10000,
        judgeRule: 'mania-od7',
        config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
        notes: []
    }

    return {
        meta: {
            title: 'Test Chart',
            artist: 'Test Artist',
            audio: 'test.mp3',
            length: 10000
        },
        segments: [segment1, segment2]
    }
}

// Helper to create mock context
function createMockContext(): RuntimeContext {
    const canvas = document.createElement('canvas')
    const ctx2d = canvas.getContext('2d')!

    return {
        canvas,
        ctx2d,
        area: { x: 0, y: 0, w: 800, h: 600 },
        scorer: {} as GlobalScorer,
        judge: vi.fn()
    }
}

describe('RuntimeManagerImpl - Task 4.2', () => {
    let chart: Chart
    let ctx: RuntimeContext
    let mockRuntime: MockRuntime
    let factories: Record<string, () => ISegmentRuntime>

    beforeEach(() => {
        chart = createTestChart()
        ctx = createMockContext()
        mockRuntime = new MockRuntime()
        factories = {
            mania: () => mockRuntime
        }
    })

    describe('findActiveSegment', () => {
        test('finds segment at start time', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            // Tick at start of first segment
            manager.tick(0)
            
            expect(mockRuntime.mountCalled).toBe(true)
            expect(mockRuntime.mountedSegment?.id).toBe('seg1')
        })

        test('finds segment in middle of time range', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            // Tick in middle of first segment
            manager.tick(2500)
            
            expect(mockRuntime.mountCalled).toBe(true)
            expect(mockRuntime.mountedSegment?.id).toBe('seg1')
        })

        test('finds second segment', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            // Start in first segment
            manager.tick(2500)
            mockRuntime.mountCalled = false
            mockRuntime.unmountCalled = false
            
            // Create new mock for second segment
            const mockRuntime2 = new MockRuntime()
            factories.mania = () => mockRuntime2
            
            // Transition to second segment
            manager.tick(5000)
            
            expect(mockRuntime.unmountCalled).toBe(true)
            expect(mockRuntime2.mountCalled).toBe(true)
            expect(mockRuntime2.mountedSegment?.id).toBe('seg2')
        })

        test('returns null when no segment active', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            // Tick before first segment
            manager.tick(-100)
            
            expect(mockRuntime.mountCalled).toBe(false)
        })

        test('returns null after last segment', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            // Tick after last segment
            manager.tick(15000)
            
            expect(mockRuntime.mountCalled).toBe(false)
        })
    })

    describe('transitionTo', () => {
        test('unmounts current runtime before mounting new one', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            // Start in first segment
            manager.tick(2500)
            expect(mockRuntime.mountCalled).toBe(true)
            
            // Reset flags
            mockRuntime.mountCalled = false
            mockRuntime.unmountCalled = false
            
            // Create new mock for transition
            const mockRuntime2 = new MockRuntime()
            factories.mania = () => mockRuntime2
            
            // Transition to second segment
            manager.tick(5000)
            
            expect(mockRuntime.unmountCalled).toBe(true)
            expect(mockRuntime2.mountCalled).toBe(true)
        })

        test('uses preloaded runtime if available (task 4.4)', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            const preloadedRuntime = new MockRuntime()
            
            // Preload second segment
            factories.mania = () => preloadedRuntime
            manager.preloadNext(chart.segments[1])
            
            // Reset factory to return different runtime
            const unexpectedRuntime = new MockRuntime()
            factories.mania = () => unexpectedRuntime
            
            // Transition to second segment
            manager.tick(5000)
            
            // Should use preloaded runtime, not create new one
            expect(preloadedRuntime.mountCalled).toBe(true)
            expect(unexpectedRuntime.mountCalled).toBe(false)
        })

        test('creates new runtime from factory if no preloaded runtime', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            // Transition to first segment without preloading
            manager.tick(0)
            
            expect(mockRuntime.mountCalled).toBe(true)
        })

        test('updates currentSegment tracking', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            // Start in first segment
            manager.tick(0)
            expect(manager.getActiveMode()).toBe('mania')
            
            // Transition to second segment
            const mockRuntime2 = new MockRuntime()
            factories.mania = () => mockRuntime2
            manager.tick(5000)
            
            expect(manager.getActiveMode()).toBe('mania')
        })

        test('handles transition to null segment', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            // Start in first segment
            manager.tick(0)
            expect(mockRuntime.mountCalled).toBe(true)
            
            // Transition to no segment
            manager.tick(15000)
            
            expect(mockRuntime.unmountCalled).toBe(true)
            expect(manager.getActiveMode()).toBe(null)
        })

        test('throws error if factory not found', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, {})
            
            // Try to transition to segment with no factory
            expect(() => manager.tick(0)).toThrow('No runtime factory for mode: mania')
        })
    })

    describe('mount', () => {
        test('creates runtime from factory and mounts segment', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            manager.mount(chart.segments[0])
            
            expect(mockRuntime.mountCalled).toBe(true)
            expect(mockRuntime.mountedSegment?.id).toBe('seg1')
        })

        test('updates currentSegment', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            manager.mount(chart.segments[0])
            
            expect(manager.getActiveMode()).toBe('mania')
        })

        test('throws error if factory not found', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, {})
            
            expect(() => manager.mount(chart.segments[0])).toThrow('No runtime factory for mode: mania')
        })
    })

    describe('unmount - Task 4.3', () => {
        test('calls unmount on current runtime', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            // Mount a segment first
            manager.mount(chart.segments[0])
            expect(mockRuntime.mountCalled).toBe(true)
            
            // Unmount
            manager.unmount()
            
            expect(mockRuntime.unmountCalled).toBe(true)
        })

        test('clears current runtime after unmount', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            // Mount a segment first
            manager.mount(chart.segments[0])
            expect(manager.getActiveMode()).toBe('mania')
            
            // Unmount
            manager.unmount()
            
            expect(manager.getActiveMode()).toBe(null)
        })

        test('does not throw when unmounting with no active runtime', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            // Unmount without mounting first
            expect(() => manager.unmount()).not.toThrow()
        })

        test('force-judges pending notes as Miss (via runtime.unmount)', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            // Mount a segment
            manager.mount(chart.segments[0])
            
            // Unmount - this should call runtime.unmount() which force-judges pending notes
            manager.unmount()
            
            // Verify unmount was called (the runtime's unmount handles force-judging)
            expect(mockRuntime.unmountCalled).toBe(true)
        })
    })

    describe('tick', () => {
        test('calls update on active runtime', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            manager.tick(2500)
            expect(mockRuntime.updateCalled).toBe(true)
        })

        test('does not call update when no segment active', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            manager.tick(-100)
            expect(mockRuntime.updateCalled).toBe(false)
        })

        test('handles segment transition during tick', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            // Start in first segment
            manager.tick(0)
            const firstRuntime = mockRuntime
            
            // Create new mock for second segment
            const secondRuntime = new MockRuntime()
            factories.mania = () => secondRuntime
            
            // Transition to second segment
            manager.tick(5000)
            
            expect(firstRuntime.unmountCalled).toBe(true)
            expect(secondRuntime.mountCalled).toBe(true)
            expect(secondRuntime.updateCalled).toBe(true)
        })
    })
})

describe('RuntimeManagerImpl - Task 4.4 Preloading', () => {
    let chart: Chart
    let ctx: RuntimeContext
    let mockRuntime: MockRuntime
    let factories: Record<string, () => ISegmentRuntime>

    beforeEach(() => {
        chart = createTestChart()
        ctx = createMockContext()
        mockRuntime = new MockRuntime()
        factories = {
            mania: () => mockRuntime
        }
    })

    describe('preloadNext', () => {
        test('creates runtime from factory and stores in preloadedRuntime', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            const preloadedRuntime = new MockRuntime()
            
            factories.mania = () => preloadedRuntime
            manager.preloadNext(chart.segments[1])
            
            // Preloaded runtime should not be mounted yet
            expect(preloadedRuntime.mountCalled).toBe(false)
            
            // But should be used when transitioning to that segment
            manager.tick(5000)
            expect(preloadedRuntime.mountCalled).toBe(true)
        })

        test('does not preload if already preloaded for same segment', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            let createCount = 0
            
            factories.mania = () => {
                createCount++
                return new MockRuntime()
            }
            
            // Preload twice for same segment
            manager.preloadNext(chart.segments[1])
            manager.preloadNext(chart.segments[1])
            
            // Should only create runtime once
            expect(createCount).toBe(1)
        })

        test('clears existing preloaded runtime before preloading new one', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            const firstPreload = new MockRuntime()
            const secondPreload = new MockRuntime()
            
            // Preload first segment
            factories.mania = () => firstPreload
            manager.preloadNext(chart.segments[0])
            
            // Preload second segment (should clear first)
            factories.mania = () => secondPreload
            manager.preloadNext(chart.segments[1])
            
            // Transition to second segment should use second preload
            manager.tick(5000)
            expect(secondPreload.mountCalled).toBe(true)
            expect(firstPreload.mountCalled).toBe(false)
        })

        test('throws error if factory not found', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, {})
            
            expect(() => manager.preloadNext(chart.segments[0])).toThrow('No runtime factory for mode: mania')
        })
    })

    describe('clearPreloaded', () => {
        test('clears preloaded runtime and segment', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            const preloadedRuntime = new MockRuntime()
            
            // Preload a segment
            factories.mania = () => preloadedRuntime
            manager.preloadNext(chart.segments[1])
            
            // Clear preloaded
            manager.clearPreloaded()
            
            // Create new runtime for transition
            const newRuntime = new MockRuntime()
            factories.mania = () => newRuntime
            
            // Transition should create new runtime, not use cleared preload
            manager.tick(5000)
            expect(newRuntime.mountCalled).toBe(true)
            expect(preloadedRuntime.mountCalled).toBe(false)
        })

        test('does not throw when no preloaded runtime exists', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            expect(() => manager.clearPreloaded()).not.toThrow()
        })
    })

    describe('shouldPreload', () => {
        test('preloads when within PRELOAD_THRESHOLD_MS', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            const preloadedRuntime = new MockRuntime()
            
            // Start in first segment
            manager.tick(0)
            
            // Set up preload tracking
            let preloadCalled = false
            factories.mania = () => {
                preloadCalled = true
                return preloadedRuntime
            }
            
            // Tick at 4500ms (500ms before second segment at 5000ms)
            // This is within PRELOAD_THRESHOLD_MS (1000ms)
            manager.tick(4500)
            
            expect(preloadCalled).toBe(true)
        })

        test('does not preload when beyond PRELOAD_THRESHOLD_MS', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            // Start in first segment
            manager.tick(0)
            
            // Set up preload tracking
            let preloadCalled = false
            factories.mania = () => {
                preloadCalled = true
                return new MockRuntime()
            }
            
            // Tick at 3000ms (2000ms before second segment at 5000ms)
            // This is beyond PRELOAD_THRESHOLD_MS (1000ms)
            manager.tick(3000)
            
            expect(preloadCalled).toBe(false)
        })

        test('does not preload when already preloaded for same segment', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            // Start in first segment
            manager.tick(0)
            
            // Set up preload tracking
            let preloadCount = 0
            factories.mania = () => {
                preloadCount++
                return new MockRuntime()
            }
            
            // Tick multiple times within preload threshold
            manager.tick(4500)
            manager.tick(4600)
            manager.tick(4700)
            
            // Should only preload once
            expect(preloadCount).toBe(1)
        })

        test('does not preload when time is negative (already passed)', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            // Start after second segment
            manager.tick(6000)
            
            // Set up preload tracking
            let preloadCalled = false
            factories.mania = () => {
                preloadCalled = true
                return new MockRuntime()
            }
            
            // Tick again (no future segments)
            manager.tick(6100)
            
            expect(preloadCalled).toBe(false)
        })
    })

    describe('tick with preloading', () => {
        test('calls preloadNext when approaching next segment', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            const preloadedRuntime = new MockRuntime()
            
            // Start in first segment
            manager.tick(0)
            
            // Set up preload
            factories.mania = () => preloadedRuntime
            
            // Tick within preload threshold
            manager.tick(4500)
            
            // Transition to second segment should use preloaded runtime
            manager.tick(5000)
            expect(preloadedRuntime.mountCalled).toBe(true)
        })

        test('clears unused preloaded runtime on transition to different segment', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            const preloadedRuntime = new MockRuntime()
            const actualRuntime = new MockRuntime()
            
            // Preload second segment manually
            factories.mania = () => preloadedRuntime
            manager.preloadNext(chart.segments[1])
            
            // But transition to first segment instead
            factories.mania = () => actualRuntime
            manager.tick(0)
            
            // Should use actual runtime, not preloaded
            expect(actualRuntime.mountCalled).toBe(true)
            expect(preloadedRuntime.mountCalled).toBe(false)
        })
    })

    describe('getNextSegment', () => {
        test('returns next segment after current time', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            const next = manager.getNextSegment(2500)
            
            expect(next).not.toBeNull()
            expect(next?.id).toBe('seg2')
        })

        test('returns null when no next segment', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            const next = manager.getNextSegment(15000)
            
            expect(next).toBeNull()
        })

        test('returns first segment when before all segments', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            const next = manager.getNextSegment(-100)
            
            expect(next).not.toBeNull()
            expect(next?.id).toBe('seg1')
        })
    })

    describe('getTransitionInfo', () => {
        test('returns transition info for next segment', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            const info = manager.getTransitionInfo(2500)
            
            expect(info).not.toBeNull()
            expect(info?.nextMode).toBe('mania')
            expect(info?.nextSegmentId).toBe('seg2')
            expect(info?.timeUntilTransition).toBe(2500) // 5000 - 2500
            expect(info?.keyBindings).toEqual(['D', 'F', 'J', 'K'])
        })

        test('returns null when no next segment', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            const info = manager.getTransitionInfo(15000)
            
            expect(info).toBeNull()
        })

        test('extracts key bindings for mania mode', () => {
            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            const info = manager.getTransitionInfo(0)
            
            expect(info?.keyBindings).toEqual(['D', 'F', 'J', 'K'])
        })
    })
})

describe('RuntimeManagerImpl - Task 8.5 Osu-Standard Integration', () => {
    let ctx: RuntimeContext
    let mockManiaRuntime: MockRuntime
    let mockTaikoRuntime: MockRuntime
    let mockOsuRuntime: MockRuntime
    let factories: Record<string, () => ISegmentRuntime>

    beforeEach(() => {
        ctx = createMockContext()
        mockManiaRuntime = new MockRuntime()
        mockTaikoRuntime = new MockRuntime()
        mockOsuRuntime = new MockRuntime()
        factories = {
            mania: () => mockManiaRuntime,
            taiko: () => mockTaikoRuntime,
            'osu-standard': () => mockOsuRuntime
        }
    })

    describe('osu-standard runtime factory', () => {
        test('creates osu-standard runtime from factory', () => {
            const osuSegment: OsuStandardSegment = {
                id: 'osu1',
                mode: 'osu-standard',
                startMs: 0,
                endMs: 5000,
                judgeRule: 'osu-od8',
                config: { circleSize: 4, approachRate: 9, scrollSpeed: 1.0 },
                notes: []
            }

            const chart: Chart = {
                meta: {
                    title: 'Test Chart',
                    artist: 'Test Artist',
                    audio: 'test.mp3',
                    length: 5000
                },
                segments: [osuSegment]
            }

            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            // Tick to activate osu-standard segment
            manager.tick(2500)
            
            expect(mockOsuRuntime.mountCalled).toBe(true)
            expect(mockOsuRuntime.mountedSegment?.id).toBe('osu1')
            expect(mockOsuRuntime.updateCalled).toBe(true)
        })

        test('throws error if osu-standard factory not registered', () => {
            const osuSegment: OsuStandardSegment = {
                id: 'osu1',
                mode: 'osu-standard',
                startMs: 0,
                endMs: 5000,
                judgeRule: 'osu-od8',
                config: { circleSize: 4, approachRate: 9, scrollSpeed: 1.0 },
                notes: []
            }

            const chart: Chart = {
                meta: {
                    title: 'Test Chart',
                    artist: 'Test Artist',
                    audio: 'test.mp3',
                    length: 5000
                },
                segments: [osuSegment]
            }

            // Create manager without osu-standard factory
            const manager = new RuntimeManagerImpl(chart, ctx, {
                mania: () => mockManiaRuntime,
                taiko: () => mockTaikoRuntime
            })
            
            // Should throw when trying to mount osu-standard segment
            expect(() => manager.tick(2500)).toThrow('No runtime factory for mode: osu-standard')
        })
    })

    describe('osu-standard segment mounting and unmounting', () => {
        test('mounts osu-standard segment correctly', () => {
            const osuSegment: OsuStandardSegment = {
                id: 'osu1',
                mode: 'osu-standard',
                startMs: 0,
                endMs: 5000,
                judgeRule: 'osu-od8',
                config: { circleSize: 4, approachRate: 9, scrollSpeed: 1.0 },
                notes: [
                    { type: 'circle', x: 256, y: 192, time: 1000 },
                    { type: 'circle', x: 300, y: 200, time: 2000 }
                ]
            }

            const chart: Chart = {
                meta: {
                    title: 'Test Chart',
                    artist: 'Test Artist',
                    audio: 'test.mp3',
                    length: 5000
                },
                segments: [osuSegment]
            }

            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            // Mount osu-standard segment
            manager.mount(osuSegment)
            
            expect(mockOsuRuntime.mountCalled).toBe(true)
            expect(mockOsuRuntime.mountedSegment?.mode).toBe('osu-standard')
            expect(manager.getActiveMode()).toBe('osu-standard')
        })

        test('unmounts osu-standard segment correctly', () => {
            const osuSegment: OsuStandardSegment = {
                id: 'osu1',
                mode: 'osu-standard',
                startMs: 0,
                endMs: 5000,
                judgeRule: 'osu-od8',
                config: { circleSize: 4, approachRate: 9, scrollSpeed: 1.0 },
                notes: []
            }

            const chart: Chart = {
                meta: {
                    title: 'Test Chart',
                    artist: 'Test Artist',
                    audio: 'test.mp3',
                    length: 5000
                },
                segments: [osuSegment]
            }

            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            // Mount then unmount
            manager.mount(osuSegment)
            expect(mockOsuRuntime.mountCalled).toBe(true)
            
            manager.unmount()
            expect(mockOsuRuntime.unmountCalled).toBe(true)
            expect(manager.getActiveMode()).toBe(null)
        })

        test('transitions from mania to osu-standard', () => {
            const maniaSegment: ManiaSegment = {
                id: 'mania1',
                mode: 'mania',
                startMs: 0,
                endMs: 5000,
                judgeRule: 'mania-od7',
                config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
                notes: []
            }

            const osuSegment: OsuStandardSegment = {
                id: 'osu1',
                mode: 'osu-standard',
                startMs: 5000,
                endMs: 10000,
                judgeRule: 'osu-od8',
                config: { circleSize: 4, approachRate: 9, scrollSpeed: 1.0 },
                notes: []
            }

            const chart: Chart = {
                meta: {
                    title: 'Test Chart',
                    artist: 'Test Artist',
                    audio: 'test.mp3',
                    length: 10000
                },
                segments: [maniaSegment, osuSegment]
            }

            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            // Start in mania segment
            manager.tick(2500)
            expect(mockManiaRuntime.mountCalled).toBe(true)
            expect(manager.getActiveMode()).toBe('mania')
            
            // Transition to osu-standard segment
            manager.tick(7500)
            expect(mockManiaRuntime.unmountCalled).toBe(true)
            expect(mockOsuRuntime.mountCalled).toBe(true)
            expect(manager.getActiveMode()).toBe('osu-standard')
        })

        test('transitions from osu-standard to taiko', () => {
            const osuSegment: OsuStandardSegment = {
                id: 'osu1',
                mode: 'osu-standard',
                startMs: 0,
                endMs: 5000,
                judgeRule: 'osu-od8',
                config: { circleSize: 4, approachRate: 9, scrollSpeed: 1.0 },
                notes: []
            }

            const taikoSegment: TaikoSegment = {
                id: 'taiko1',
                mode: 'taiko',
                startMs: 5000,
                endMs: 10000,
                judgeRule: 'taiko-od7',
                config: { donKeys: ['D', 'F'], kaKeys: ['J', 'K'], scrollSpeed: 1.0 },
                notes: []
            }

            const chart: Chart = {
                meta: {
                    title: 'Test Chart',
                    artist: 'Test Artist',
                    audio: 'test.mp3',
                    length: 10000
                },
                segments: [osuSegment, taikoSegment]
            }

            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            // Start in osu-standard segment
            manager.tick(2500)
            expect(mockOsuRuntime.mountCalled).toBe(true)
            expect(manager.getActiveMode()).toBe('osu-standard')
            
            // Transition to taiko segment
            manager.tick(7500)
            expect(mockOsuRuntime.unmountCalled).toBe(true)
            expect(mockTaikoRuntime.mountCalled).toBe(true)
            expect(manager.getActiveMode()).toBe('taiko')
        })

        test('handles three-mode transition: mania -> osu-standard -> taiko', () => {
            const maniaSegment: ManiaSegment = {
                id: 'mania1',
                mode: 'mania',
                startMs: 0,
                endMs: 3000,
                judgeRule: 'mania-od7',
                config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
                notes: []
            }

            const osuSegment: OsuStandardSegment = {
                id: 'osu1',
                mode: 'osu-standard',
                startMs: 3000,
                endMs: 6000,
                judgeRule: 'osu-od8',
                config: { circleSize: 4, approachRate: 9, scrollSpeed: 1.0 },
                notes: []
            }

            const taikoSegment: TaikoSegment = {
                id: 'taiko1',
                mode: 'taiko',
                startMs: 6000,
                endMs: 9000,
                judgeRule: 'taiko-od7',
                config: { donKeys: ['D', 'F'], kaKeys: ['J', 'K'], scrollSpeed: 1.0 },
                notes: []
            }

            const chart: Chart = {
                meta: {
                    title: 'Test Chart',
                    artist: 'Test Artist',
                    audio: 'test.mp3',
                    length: 9000
                },
                segments: [maniaSegment, osuSegment, taikoSegment]
            }

            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            // Start in mania
            manager.tick(1500)
            expect(mockManiaRuntime.mountCalled).toBe(true)
            expect(manager.getActiveMode()).toBe('mania')
            
            // Transition to osu-standard
            manager.tick(4500)
            expect(mockManiaRuntime.unmountCalled).toBe(true)
            expect(mockOsuRuntime.mountCalled).toBe(true)
            expect(manager.getActiveMode()).toBe('osu-standard')
            
            // Transition to taiko
            manager.tick(7500)
            expect(mockOsuRuntime.unmountCalled).toBe(true)
            expect(mockTaikoRuntime.mountCalled).toBe(true)
            expect(manager.getActiveMode()).toBe('taiko')
        })
    })

    describe('input routing to osu-standard runtime', () => {
        test('routes keyboard input to osu-standard runtime', () => {
            const osuSegment: OsuStandardSegment = {
                id: 'osu1',
                mode: 'osu-standard',
                startMs: 0,
                endMs: 5000,
                judgeRule: 'osu-od8',
                config: { circleSize: 4, approachRate: 9, scrollSpeed: 1.0 },
                notes: [
                    { type: 'circle', x: 256, y: 192, time: 1000 }
                ]
            }

            const chart: Chart = {
                meta: {
                    title: 'Test Chart',
                    artist: 'Test Artist',
                    audio: 'test.mp3',
                    length: 5000
                },
                segments: [osuSegment]
            }

            // Create a mock runtime that tracks input calls
            let keyDownCalled = false
            let keyUpCalled = false
            const inputTrackingRuntime: ISegmentRuntime = {
                mount: vi.fn(),
                update: vi.fn(),
                handleKeyDown: (key: string, songMs: number) => {
                    keyDownCalled = true
                },
                handleKeyUp: (key: string, songMs: number) => {
                    keyUpCalled = true
                },
                handleTouchStart: vi.fn(),
                handleTouchEnd: vi.fn(),
                unmount: vi.fn(),
                isComplete: () => false
            }

            const manager = new RuntimeManagerImpl(chart, ctx, {
                'osu-standard': () => inputTrackingRuntime
            })
            
            // Mount osu-standard segment
            manager.tick(2500)
            
            // Simulate keyboard input (Z key for osu!)
            manager.handleKeyDown('z', 2500)
            expect(keyDownCalled).toBe(true)
            
            manager.handleKeyUp('z', 2600)
            expect(keyUpCalled).toBe(true)
        })

        test('routes touch input to osu-standard runtime', () => {
            const osuSegment: OsuStandardSegment = {
                id: 'osu1',
                mode: 'osu-standard',
                startMs: 0,
                endMs: 5000,
                judgeRule: 'osu-od8',
                config: { circleSize: 4, approachRate: 9, scrollSpeed: 1.0 },
                notes: [
                    { type: 'circle', x: 256, y: 192, time: 1000 }
                ]
            }

            const chart: Chart = {
                meta: {
                    title: 'Test Chart',
                    artist: 'Test Artist',
                    audio: 'test.mp3',
                    length: 5000
                },
                segments: [osuSegment]
            }

            // Create a mock runtime that tracks touch input
            let touchStartCalled = false
            let touchEndCalled = false
            let touchX = 0
            const inputTrackingRuntime: ISegmentRuntime = {
                mount: vi.fn(),
                update: vi.fn(),
                handleKeyDown: vi.fn(),
                handleKeyUp: vi.fn(),
                handleTouchStart: (x: number, songMs: number) => {
                    touchStartCalled = true
                    touchX = x
                },
                handleTouchEnd: (x: number, songMs: number) => {
                    touchEndCalled = true
                },
                unmount: vi.fn(),
                isComplete: () => false
            }

            const manager = new RuntimeManagerImpl(chart, ctx, {
                'osu-standard': () => inputTrackingRuntime
            })
            
            // Mount osu-standard segment
            manager.tick(2500)
            
            // Simulate touch input at x=256 (center of playfield)
            manager.handleTouchStart(256, 2500)
            expect(touchStartCalled).toBe(true)
            expect(touchX).toBe(256)
            
            manager.handleTouchEnd(256, 2600)
            expect(touchEndCalled).toBe(true)
        })

        test('does not route input when no segment is active', () => {
            const osuSegment: OsuStandardSegment = {
                id: 'osu1',
                mode: 'osu-standard',
                startMs: 5000,
                endMs: 10000,
                judgeRule: 'osu-od8',
                config: { circleSize: 4, approachRate: 9, scrollSpeed: 1.0 },
                notes: []
            }

            const chart: Chart = {
                meta: {
                    title: 'Test Chart',
                    artist: 'Test Artist',
                    audio: 'test.mp3',
                    length: 10000
                },
                segments: [osuSegment]
            }

            let inputReceived = false
            const inputTrackingRuntime: ISegmentRuntime = {
                mount: vi.fn(),
                update: vi.fn(),
                handleKeyDown: () => { inputReceived = true },
                handleKeyUp: vi.fn(),
                handleTouchStart: () => { inputReceived = true },
                handleTouchEnd: vi.fn(),
                unmount: vi.fn(),
                isComplete: () => false
            }

            const manager = new RuntimeManagerImpl(chart, ctx, {
                'osu-standard': () => inputTrackingRuntime
            })
            
            // Tick before segment starts (no active segment)
            manager.tick(2500)
            
            // Try to send input - should not reach runtime
            manager.handleKeyDown('z', 2500)
            manager.handleTouchStart(256, 2500)
            
            expect(inputReceived).toBe(false)
        })

        test('routes input only to active runtime during transitions', () => {
            const maniaSegment: ManiaSegment = {
                id: 'mania1',
                mode: 'mania',
                startMs: 0,
                endMs: 5000,
                judgeRule: 'mania-od7',
                config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
                notes: []
            }

            const osuSegment: OsuStandardSegment = {
                id: 'osu1',
                mode: 'osu-standard',
                startMs: 5000,
                endMs: 10000,
                judgeRule: 'osu-od8',
                config: { circleSize: 4, approachRate: 9, scrollSpeed: 1.0 },
                notes: []
            }

            const chart: Chart = {
                meta: {
                    title: 'Test Chart',
                    artist: 'Test Artist',
                    audio: 'test.mp3',
                    length: 10000
                },
                segments: [maniaSegment, osuSegment]
            }

            let maniaInputReceived = false
            let osuInputReceived = false

            const maniaRuntime: ISegmentRuntime = {
                mount: vi.fn(),
                update: vi.fn(),
                handleKeyDown: () => { maniaInputReceived = true },
                handleKeyUp: vi.fn(),
                handleTouchStart: vi.fn(),
                handleTouchEnd: vi.fn(),
                unmount: vi.fn(),
                isComplete: () => false
            }

            const osuRuntime: ISegmentRuntime = {
                mount: vi.fn(),
                update: vi.fn(),
                handleKeyDown: () => { osuInputReceived = true },
                handleKeyUp: vi.fn(),
                handleTouchStart: vi.fn(),
                handleTouchEnd: vi.fn(),
                unmount: vi.fn(),
                isComplete: () => false
            }

            const manager = new RuntimeManagerImpl(chart, ctx, {
                mania: () => maniaRuntime,
                'osu-standard': () => osuRuntime
            })
            
            // Start in mania segment
            manager.tick(2500)
            manager.handleKeyDown('d', 2500)
            expect(maniaInputReceived).toBe(true)
            expect(osuInputReceived).toBe(false)
            
            // Reset flags
            maniaInputReceived = false
            osuInputReceived = false
            
            // Transition to osu-standard segment
            manager.tick(7500)
            manager.handleKeyDown('z', 7500)
            expect(maniaInputReceived).toBe(false)
            expect(osuInputReceived).toBe(true)
        })
    })

    describe('getTransitionInfo for osu-standard', () => {
        test('returns correct key bindings for osu-standard mode', () => {
            const maniaSegment: ManiaSegment = {
                id: 'mania1',
                mode: 'mania',
                startMs: 0,
                endMs: 5000,
                judgeRule: 'mania-od7',
                config: { keys: ['D', 'F', 'J', 'K'], scrollSpeed: 1.0 },
                notes: []
            }

            const osuSegment: OsuStandardSegment = {
                id: 'osu1',
                mode: 'osu-standard',
                startMs: 5000,
                endMs: 10000,
                judgeRule: 'osu-od8',
                config: { circleSize: 4, approachRate: 9, scrollSpeed: 1.0 },
                notes: []
            }

            const chart: Chart = {
                meta: {
                    title: 'Test Chart',
                    artist: 'Test Artist',
                    audio: 'test.mp3',
                    length: 10000
                },
                segments: [maniaSegment, osuSegment]
            }

            const manager = new RuntimeManagerImpl(chart, ctx, factories)
            
            // Get transition info while in mania segment
            const info = manager.getTransitionInfo(2500)
            
            expect(info).not.toBeNull()
            expect(info?.nextMode).toBe('osu-standard')
            expect(info?.nextSegmentId).toBe('osu1')
            expect(info?.keyBindings).toEqual(['Mouse', 'Z', 'X'])
        })
    })
})
