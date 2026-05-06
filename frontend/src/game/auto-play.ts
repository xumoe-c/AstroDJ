/**
 * Auto-play controller for automatic note hitting
 * Simulates perfect player input for all game modes
 */

import type { Chart, Segment, ManiaNote, TaikoNote, OsuNote } from './types'
import type { TimelineController } from './timeline'

export interface AutoPlayConfig {
    enabled: boolean
    perfectTiming: boolean // If true, always hit at exact time; if false, add slight randomness
    randomnessMs: number // Max random offset in ms (only used if perfectTiming is false)
}

export class AutoPlayController {
    private chart: Chart
    private timeline: TimelineController
    private config: AutoPlayConfig
    private scheduledActions: ScheduledAction[] = []
    private activeHolds: Map<string, HoldState> = new Map() // Track active holds by key

    constructor(chart: Chart, timeline: TimelineController, config: AutoPlayConfig) {
        this.chart = chart
        this.timeline = timeline
        this.config = config
    }

    /**
     * Update auto-play state and trigger actions
     */
    tick(songMs: number): void {
        if (!this.config.enabled) return

        // Execute scheduled actions that are due
        const actionsToExecute = this.scheduledActions.filter(a => songMs >= a.executeMs)
        
        for (const action of actionsToExecute) {
            this.executeAction(action, songMs)
        }

        // Remove executed actions
        this.scheduledActions = this.scheduledActions.filter(a => songMs < a.executeMs)

        // Schedule new actions for current segment
        this.scheduleActionsForCurrentSegment(songMs)
    }

    /**
     * Enable or disable auto-play
     */
    setEnabled(enabled: boolean): void {
        this.config.enabled = enabled
        
        if (!enabled) {
            // Release all active holds
            for (const [key, hold] of this.activeHolds.entries()) {
                this.timeline.handleKeyUp(key, hold.startMs + 1)
            }
            this.activeHolds.clear()
            this.scheduledActions = []
        }
    }

    /**
     * Check if auto-play is enabled
     */
    isEnabled(): boolean {
        return this.config.enabled
    }

    /**
     * Schedule actions for the current segment
     */
    private scheduleActionsForCurrentSegment(songMs: number): void {
        const segment = this.chart.segments.find(
            s => songMs >= s.startMs && songMs < s.endMs
        )

        if (!segment) return

        // Check if we already have actions scheduled for this segment
        const hasScheduled = this.scheduledActions.some(a => a.segmentId === segment.id)
        if (hasScheduled) return

        // Schedule actions based on segment mode
        switch (segment.mode) {
            case 'mania':
                this.scheduleManiaActions(segment as any, songMs)
                break
            case 'taiko':
                this.scheduleTaikoActions(segment as any, songMs)
                break
            case 'osu-standard':
                this.scheduleOsuActions(segment as any, songMs)
                break
        }
    }

    /**
     * Schedule actions for Mania segment
     */
    private scheduleManiaActions(segment: any, songMs: number): void {
        const notes = segment.notes as ManiaNote[]
        const keys = segment.config.keys as string[]

        for (const note of notes) {
            const noteAbsoluteMs = segment.startMs + note.time
            
            // Skip notes that are already past
            if (noteAbsoluteMs < songMs - 50) continue

            const key = keys[note.lane]
            if (!key) continue

            const offset = this.getTimingOffset()

            if (note.endTime) {
                // Long note - schedule press and release
                this.scheduledActions.push({
                    type: 'keydown',
                    key: key,
                    executeMs: noteAbsoluteMs + offset,
                    segmentId: segment.id,
                    noteTime: note.time
                })

                const releaseMs = segment.startMs + note.endTime
                this.scheduledActions.push({
                    type: 'keyup',
                    key: key,
                    executeMs: releaseMs + offset,
                    segmentId: segment.id,
                    noteTime: note.endTime
                })
            } else {
                // Normal note - schedule press and quick release
                this.scheduledActions.push({
                    type: 'keydown',
                    key: key,
                    executeMs: noteAbsoluteMs + offset,
                    segmentId: segment.id,
                    noteTime: note.time
                })

                this.scheduledActions.push({
                    type: 'keyup',
                    key: key,
                    executeMs: noteAbsoluteMs + offset + 50, // Release after 50ms
                    segmentId: segment.id,
                    noteTime: note.time
                })
            }
        }
    }

    /**
     * Schedule actions for Taiko segment
     */
    private scheduleTaikoActions(segment: any, songMs: number): void {
        const notes = segment.notes as TaikoNote[]
        const donKeys = segment.config.donKeys as string[]
        const kaKeys = segment.config.kaKeys as string[]

        for (const note of notes) {
            const noteAbsoluteMs = segment.startMs + note.time
            
            // Skip notes that are already past
            if (noteAbsoluteMs < songMs - 50) continue

            const offset = this.getTimingOffset()

            // Choose appropriate key based on note type
            const keys = note.type === 'don' ? donKeys : kaKeys
            const key = keys[0] // Use first key for simplicity

            if (!key) continue

            if (note.type === 'roll' || note.type === 'balloon') {
                // Roll/balloon - hold for duration
                this.scheduledActions.push({
                    type: 'keydown',
                    key: key,
                    executeMs: noteAbsoluteMs + offset,
                    segmentId: segment.id,
                    noteTime: note.time
                })

                if (note.endTime) {
                    const releaseMs = segment.startMs + note.endTime
                    this.scheduledActions.push({
                        type: 'keyup',
                        key: key,
                        executeMs: releaseMs + offset,
                        segmentId: segment.id,
                        noteTime: note.endTime
                    })
                }
            } else {
                // Normal don/ka - quick tap
                this.scheduledActions.push({
                    type: 'keydown',
                    key: key,
                    executeMs: noteAbsoluteMs + offset,
                    segmentId: segment.id,
                    noteTime: note.time
                })

                this.scheduledActions.push({
                    type: 'keyup',
                    key: key,
                    executeMs: noteAbsoluteMs + offset + 50,
                    segmentId: segment.id,
                    noteTime: note.time
                })
            }
        }
    }

    /**
     * Schedule actions for Osu Standard segment
     */
    private scheduleOsuActions(segment: any, songMs: number): void {
        const notes = segment.notes as OsuNote[]
        const key = 'z' // Use Z key for auto-play

        for (const note of notes) {
            const noteAbsoluteMs = segment.startMs + note.time
            
            // Skip notes that are already past
            if (noteAbsoluteMs < songMs - 50) continue

            const offset = this.getTimingOffset()

            if (note.type === 'slider' || note.type === 'spinner') {
                // Slider/spinner - hold for duration
                this.scheduledActions.push({
                    type: 'keydown',
                    key: key,
                    executeMs: noteAbsoluteMs + offset,
                    segmentId: segment.id,
                    noteTime: note.time
                })

                if (note.endTime) {
                    const releaseMs = segment.startMs + note.endTime
                    this.scheduledActions.push({
                        type: 'keyup',
                        key: key,
                        executeMs: releaseMs + offset,
                        segmentId: segment.id,
                        noteTime: note.endTime
                    })
                }
            } else {
                // Circle - quick tap
                this.scheduledActions.push({
                    type: 'keydown',
                    key: key,
                    executeMs: noteAbsoluteMs + offset,
                    segmentId: segment.id,
                    noteTime: note.time
                })

                this.scheduledActions.push({
                    type: 'keyup',
                    key: key,
                    executeMs: noteAbsoluteMs + offset + 50,
                    segmentId: segment.id,
                    noteTime: note.time
                })
            }
        }
    }

    /**
     * Execute a scheduled action
     */
    private executeAction(action: ScheduledAction, songMs: number): void {
        switch (action.type) {
            case 'keydown':
                this.timeline.handleKeyDown(action.key, songMs)
                this.activeHolds.set(action.key, {
                    startMs: songMs,
                    segmentId: action.segmentId
                })
                break
            case 'keyup':
                this.timeline.handleKeyUp(action.key, songMs)
                this.activeHolds.delete(action.key)
                break
        }
    }

    /**
     * Get timing offset based on config
     */
    private getTimingOffset(): number {
        if (this.config.perfectTiming) {
            return 0
        }

        // Add slight randomness for more natural feel
        return (Math.random() - 0.5) * this.config.randomnessMs
    }

    /**
     * Clean up
     */
    destroy(): void {
        this.config.enabled = false
        this.scheduledActions = []
        this.activeHolds.clear()
    }
}

interface ScheduledAction {
    type: 'keydown' | 'keyup'
    key: string
    executeMs: number
    segmentId: string
    noteTime: number
}

interface HoldState {
    startMs: number
    segmentId: string
}
