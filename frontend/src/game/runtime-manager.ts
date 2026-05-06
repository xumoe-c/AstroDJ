import type { Chart, Segment } from './types'
import type { ISegmentRuntime, RuntimeContext } from './runtimes/interface'

// Constants for preloading and transition warnings
export const PRELOAD_THRESHOLD_MS = 2000
export const TRANSITION_WARNING_MS = 3000

// Transition information for UI display
export interface TransitionInfo {
    nextMode: string
    nextSegmentId: string
    timeUntilTransition: number
    keyBindings: string[]
}

// Runtime Manager interface for segment lifecycle management
export interface RuntimeManager {
    tick(songMs: number): void
    mount(segment: Segment): void
    unmount(): void
    preloadNext(segment: Segment): void
    clearPreloaded(): void
    getActiveMode(): string | null
    getNextSegment(currentMs: number): Segment | null
    getTransitionInfo(currentMs: number): TransitionInfo | null
    handleKeyDown(key: string, songMs: number): void
    handleKeyUp(key: string, songMs: number): void
    handleTouchStart(x: number, songMs: number): void
    handleTouchEnd(x: number, songMs: number): void
}

// Runtime Manager implementation
export class RuntimeManagerImpl implements RuntimeManager {
    private currentRuntime: ISegmentRuntime | null = null
    private preloadedRuntime: ISegmentRuntime | null = null
    private preloadedSegment: Segment | null = null
    private currentSegment: Segment | null = null
    private chart: Chart
    private ctx: RuntimeContext
    private factories: Record<string, () => ISegmentRuntime>

    constructor(
        chart: Chart,
        ctx: RuntimeContext,
        factories: Record<string, () => ISegmentRuntime>,
    ) {
        this.chart = chart
        this.ctx = ctx
        this.factories = factories
    }

    tick(songMs: number): void {
        // Find active segment at current time
        const activeSegment = this.findActiveSegment(songMs)

        // Handle segment transition if segment changed
        if (activeSegment !== this.currentSegment) {
            this.transitionTo(activeSegment)
            // After transition, ensure the new runtime gets the current time immediately
            // This prevents timing drift at segment boundaries
            if (this.currentRuntime && activeSegment) {
                this.currentRuntime.update(songMs)
                return // Skip the second update below
            }
        }

        // Preload next segment if approaching
        const nextSegment = this.getNextSegment(songMs)
        if (nextSegment && this.shouldPreload(songMs, nextSegment)) {
            this.preloadNext(nextSegment)
        }

        // Update active runtime
        this.currentRuntime?.update(songMs)
    }

    mount(segment: Segment): void {
        try {
            // Create runtime from factory
            const factory = this.factories[segment.mode]
            if (!factory) {
                console.error(`[RuntimeManager] No runtime factory for mode: ${segment.mode}, skipping segment ${segment.id}`)
                return
            }

            const runtime = factory()
            runtime.mount(segment, this.ctx)

            this.currentRuntime = runtime
            this.currentSegment = segment
        } catch (error) {
            console.error(`[RuntimeManager] Failed to mount segment ${segment.id}:`, error)
            // Skip this segment and continue
            this.currentRuntime = null
            this.currentSegment = null
        }
    }

    unmount(): void {
        // Unmount current runtime if exists (force-judges pending notes as Miss)
        if (this.currentRuntime) {
            this.currentRuntime.unmount()
            this.currentRuntime = null
        }
        this.currentSegment = null
    }

    preloadNext(segment: Segment): void {
        // Don't preload if already preloaded for this segment
        if (this.preloadedSegment === segment) {
            return
        }

        // Clear any existing preloaded runtime
        this.clearPreloaded()

        try {
            // Create runtime from factory
            const factory = this.factories[segment.mode]
            if (!factory) {
                console.error(`[RuntimeManager] No runtime factory for mode: ${segment.mode}, cannot preload segment ${segment.id}`)
                return
            }

            // Create and store preloaded runtime
            this.preloadedRuntime = factory()
            this.preloadedSegment = segment
        } catch (error) {
            console.error(`[RuntimeManager] Failed to preload segment ${segment.id}:`, error)
            // Clear failed preload
            this.preloadedRuntime = null
            this.preloadedSegment = null
        }
    }

    clearPreloaded(): void {
        // Clean up unused preloaded runtime
        if (this.preloadedRuntime) {
            this.preloadedRuntime = null
            this.preloadedSegment = null
        }
    }

    getActiveMode(): string | null {
        return this.currentSegment?.mode ?? null
    }

    getNextSegment(currentMs: number): Segment | null {
        // Find the next segment after current time
        for (const segment of this.chart.segments) {
            if (segment.startMs > currentMs) {
                return segment
            }
        }
        return null
    }

    getTransitionInfo(currentMs: number): TransitionInfo | null {
        const nextSegment = this.getNextSegment(currentMs)
        if (!nextSegment) {
            return null
        }

        const timeUntilTransition = nextSegment.startMs - currentMs

        // Extract key bindings from segment config
        const keyBindings = this.extractKeyBindings(nextSegment)

        return {
            nextMode: nextSegment.mode,
            nextSegmentId: nextSegment.id,
            timeUntilTransition,
            keyBindings
        }
    }

    private findActiveSegment(songMs: number): Segment | null {
        // Find segment that contains the current time
        // Use a small lookahead (50ms) to ensure smooth transitions
        const lookahead = 50
        for (const segment of this.chart.segments) {
            if (songMs >= segment.startMs - lookahead && songMs < segment.endMs) {
                return segment
            }
        }
        return null
    }

    private transitionTo(segment: Segment | null): void {
        // Unmount current runtime if exists
        if (this.currentRuntime) {
            try {
                this.currentRuntime.unmount()
            } catch (error) {
                console.error(`[RuntimeManager] Error during unmount:`, error)
            }
            this.currentRuntime = null
        }

        // Mount new segment if provided
        if (segment) {
            try {
                // Use preloaded runtime if available for this segment
                if (this.preloadedSegment === segment && this.preloadedRuntime) {
                    this.currentRuntime = this.preloadedRuntime
                    this.currentRuntime.mount(segment, this.ctx)
                    this.preloadedRuntime = null
                    this.preloadedSegment = null
                } else {
                    // Clear unused preloaded runtime if it wasn't for this segment
                    this.clearPreloaded()

                    // Create new runtime from factory
                    const factory = this.factories[segment.mode]
                    if (!factory) {
                        console.error(`[RuntimeManager] No runtime factory for mode: ${segment.mode}, skipping segment ${segment.id}`)
                        this.currentSegment = null
                        return
                    }

                    this.currentRuntime = factory()
                    this.currentRuntime.mount(segment, this.ctx)
                }
            } catch (error) {
                console.error(`[RuntimeManager] Failed to transition to segment ${segment.id}:`, error)
                // Skip this segment
                this.currentRuntime = null
                this.currentSegment = null
                return
            }
        }

        // Update current segment tracking
        this.currentSegment = segment
    }

    private shouldPreload(songMs: number, nextSegment: Segment): boolean {
        const timeUntil = nextSegment.startMs - songMs
        return (
            timeUntil <= PRELOAD_THRESHOLD_MS &&
            timeUntil > 0 &&
            this.preloadedSegment !== nextSegment
        )
    }

    private extractKeyBindings(segment: Segment): string[] {
        switch (segment.mode) {
            case 'mania': {
                const maniaSegment = segment as any
                return maniaSegment.config.keys || []
            }
            case 'taiko': {
                const taikoSegment = segment as any
                return [
                    ...(taikoSegment.config.donKeys || []),
                    ...(taikoSegment.config.kaKeys || [])
                ]
            }
            case 'osu-standard': {
                return ['Mouse', 'Z', 'X'] // Default osu! bindings
            }
            default:
                return []
        }
    }

    handleKeyDown(key: string, songMs: number): void {
        this.currentRuntime?.handleKeyDown(key, songMs)
    }

    handleKeyUp(key: string, songMs: number): void {
        this.currentRuntime?.handleKeyUp(key, songMs)
    }

    handleTouchStart(x: number, songMs: number): void {
        this.currentRuntime?.handleTouchStart(x, songMs)
    }

    handleTouchEnd(x: number, songMs: number): void {
        this.currentRuntime?.handleTouchEnd(x, songMs)
    }
}
