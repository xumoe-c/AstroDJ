import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AutoPlayController } from './auto-play'
import type { Chart, ManiaSegment, TaikoSegment, OsuStandardSegment } from './types'
import type { TimelineController } from './timeline'

describe('AutoPlayController', () => {
    let mockChart: Chart
    let mockTimeline: TimelineController
    let autoPlay: AutoPlayController

    beforeEach(() => {
        // Create mock chart with mania segment
        mockChart = {
            meta: {
                title: 'Test Song',
                artist: 'Test Artist',
                audio: 'test.mp3',
                length: 60000
            },
            segments: [
                {
                    id: 'seg1',
                    mode: 'mania',
                    startMs: 1000,
                    endMs: 5000,
                    judgeRule: 'mania-default',
                    config: {
                        keys: ['d', 'f', 'j', 'k'],
                        scrollSpeed: 0.4
                    },
                    notes: [
                        { lane: 0, time: 1000 },
                        { lane: 1, time: 1500 },
                        { lane: 2, time: 2000, endTime: 3000 }, // Long note
                        { lane: 3, time: 2500 }
                    ]
                } as ManiaSegment
            ]
        }

        // Create mock timeline
        mockTimeline = {
            handleKeyDown: vi.fn(),
            handleKeyUp: vi.fn(),
            handleTouchStart: vi.fn(),
            handleTouchEnd: vi.fn()
        } as any

        autoPlay = new AutoPlayController(mockChart, mockTimeline, {
            enabled: true,
            perfectTiming: true,
            randomnessMs: 0
        })
    })

    it('should initialize with disabled state', () => {
        const controller = new AutoPlayController(mockChart, mockTimeline, {
            enabled: false,
            perfectTiming: true,
            randomnessMs: 0
        })

        expect(controller.isEnabled()).toBe(false)
    })

    it('should enable and disable auto-play', () => {
        autoPlay.setEnabled(false)
        expect(autoPlay.isEnabled()).toBe(false)

        autoPlay.setEnabled(true)
        expect(autoPlay.isEnabled()).toBe(true)
    })

    it('should schedule actions for mania notes', () => {
        // Tick at segment start to schedule actions
        autoPlay.tick(1000)

        // Tick at first note time
        autoPlay.tick(2000)

        // Should have called handleKeyDown for the first note
        expect(mockTimeline.handleKeyDown).toHaveBeenCalled()
    })

    it('should handle long notes correctly', () => {
        // Tick through the long note
        autoPlay.tick(1000) // Schedule
        autoPlay.tick(3000) // Press
        autoPlay.tick(4000) // Release

        // Should have called both keydown and keyup
        expect(mockTimeline.handleKeyDown).toHaveBeenCalled()
        expect(mockTimeline.handleKeyUp).toHaveBeenCalled()
    })

    it('should not trigger actions when disabled', () => {
        autoPlay.setEnabled(false)

        autoPlay.tick(1000)
        autoPlay.tick(2000)

        expect(mockTimeline.handleKeyDown).not.toHaveBeenCalled()
    })

    it('should handle taiko segments', () => {
        const taikoChart: Chart = {
            meta: mockChart.meta,
            segments: [
                {
                    id: 'taiko1',
                    mode: 'taiko',
                    startMs: 1000,
                    endMs: 5000,
                    judgeRule: 'taiko-default',
                    config: {
                        donKeys: ['d', 'f'],
                        kaKeys: ['j', 'k'],
                        scrollSpeed: 0.4
                    },
                    notes: [
                        { type: 'don', time: 1000 },
                        { type: 'ka', time: 1500 },
                        { type: 'roll', time: 2000, endTime: 3000 }
                    ]
                } as TaikoSegment
            ]
        }

        const taikoAutoPlay = new AutoPlayController(taikoChart, mockTimeline, {
            enabled: true,
            perfectTiming: true,
            randomnessMs: 0
        })

        taikoAutoPlay.tick(1000)
        taikoAutoPlay.tick(2000)

        expect(mockTimeline.handleKeyDown).toHaveBeenCalled()
    })

    it('should handle osu-standard segments', () => {
        const osuChart: Chart = {
            meta: mockChart.meta,
            segments: [
                {
                    id: 'osu1',
                    mode: 'osu-standard',
                    startMs: 1000,
                    endMs: 5000,
                    judgeRule: 'osu-default',
                    config: {
                        circleSize: 4,
                        approachRate: 9,
                        scrollSpeed: 0.4
                    },
                    notes: [
                        { type: 'circle', x: 256, y: 192, time: 1000 },
                        { type: 'slider', x: 300, y: 200, time: 1500, endTime: 2000 },
                        { type: 'spinner', x: 256, y: 192, time: 2500, endTime: 3500 }
                    ]
                } as OsuStandardSegment
            ]
        }

        const osuAutoPlay = new AutoPlayController(osuChart, mockTimeline, {
            enabled: true,
            perfectTiming: true,
            randomnessMs: 0
        })

        osuAutoPlay.tick(1000)
        osuAutoPlay.tick(2000)

        expect(mockTimeline.handleKeyDown).toHaveBeenCalled()
    })

    it('should apply timing randomness when configured', () => {
        const randomAutoPlay = new AutoPlayController(mockChart, mockTimeline, {
            enabled: true,
            perfectTiming: false,
            randomnessMs: 10
        })

        // This test just ensures randomness doesn't break functionality
        // Need to tick at segment start to schedule actions
        randomAutoPlay.tick(1000)
        // Then tick at note time (with some buffer for randomness)
        randomAutoPlay.tick(2010)

        expect(mockTimeline.handleKeyDown).toHaveBeenCalled()
    })

    it('should clean up on destroy', () => {
        // Don't enable initially to avoid scheduling
        const testAutoPlay = new AutoPlayController(mockChart, mockTimeline, {
            enabled: false,
            perfectTiming: true,
            randomnessMs: 0
        })
        
        // Enable and schedule actions
        testAutoPlay.setEnabled(true)
        testAutoPlay.tick(1000)
        testAutoPlay.tick(2000) // This should trigger some actions
        
        // Get call count after some actions
        const callCountBeforeDestroy = (mockTimeline.handleKeyDown as any).mock.calls.length
        expect(callCountBeforeDestroy).toBeGreaterThan(0)
        
        // Destroy the controller
        testAutoPlay.destroy()

        // After destroy, tick should not trigger any new actions
        testAutoPlay.tick(2500)
        testAutoPlay.tick(3000)
        
        // Call count should remain the same as before destroy
        expect((mockTimeline.handleKeyDown as any).mock.calls.length).toBe(callCountBeforeDestroy)
    })

    it('should skip notes that are already past', () => {
        // Start at a time after some notes
        autoPlay.tick(3000)

        // Should not schedule actions for notes at 1000ms and 1500ms
        // Only notes at or after current time should be scheduled
        expect(mockTimeline.handleKeyDown).not.toHaveBeenCalled()
    })

    it('should handle segment transitions', () => {
        const multiSegmentChart: Chart = {
            meta: mockChart.meta,
            segments: [
                {
                    id: 'seg1',
                    mode: 'mania',
                    startMs: 1000,
                    endMs: 3000,
                    judgeRule: 'mania-default',
                    config: { keys: ['d', 'f', 'j', 'k'], scrollSpeed: 0.4 },
                    notes: [{ lane: 0, time: 1000 }]
                } as ManiaSegment,
                {
                    id: 'seg2',
                    mode: 'mania',
                    startMs: 3000,
                    endMs: 5000,
                    judgeRule: 'mania-default',
                    config: { keys: ['d', 'f', 'j', 'k'], scrollSpeed: 0.4 },
                    notes: [{ lane: 1, time: 3500 }]
                } as ManiaSegment
            ]
        }

        const multiAutoPlay = new AutoPlayController(multiSegmentChart, mockTimeline, {
            enabled: true,
            perfectTiming: true,
            randomnessMs: 0
        })

        // Tick through both segments
        multiAutoPlay.tick(1000)
        multiAutoPlay.tick(2000)
        multiAutoPlay.tick(3000)
        multiAutoPlay.tick(4000)

        // Should have scheduled actions for both segments
        expect(mockTimeline.handleKeyDown).toHaveBeenCalled()
    })
})
