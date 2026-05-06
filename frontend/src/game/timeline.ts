import type { Chart, Segment } from './types'
import type { ISegmentRuntime, RuntimeContext } from './runtimes/interface'
import type { TransitionInfo } from './runtime-manager'

export class TimelineController {
    private currentSeg: Segment | null = null
    private currentRuntime: ISegmentRuntime | null = null
    private factories: Record<string, () => ISegmentRuntime>
    private chart: Chart
    private ctx: RuntimeContext

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
        const seg = this.chart.segments.find(
            (s) => songMs >= s.startMs && songMs < s.endMs,
        ) ?? null

        if (seg !== this.currentSeg) {
            // Unmount previous runtime
            if (this.currentRuntime) {
                this.currentRuntime.unmount()
                this.currentRuntime = null
            }

            // Mount new runtime
            if (seg && this.factories[seg.mode]) {
                this.currentRuntime = this.factories[seg.mode]()
                this.currentRuntime.mount(seg, this.ctx)
            }

            this.currentSeg = seg
        }

        this.currentRuntime?.update(songMs)
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

    get activeMode(): string | null {
        return this.currentSeg?.mode ?? null
    }

    get activeSegmentId(): string | null {
        return this.currentSeg?.id ?? null
    }

    get activeRuntime(): ISegmentRuntime | null {
        return this.currentRuntime
    }

    isAllComplete(songMs: number): boolean {
        const lastSeg = this.chart.segments[this.chart.segments.length - 1]
        return lastSeg ? songMs > lastSeg.endMs : true
    }

    getTransitionInfo(songMs: number): TransitionInfo | null {
        // Find the next segment after current time
        const nextSegment = this.chart.segments.find(s => s.startMs > songMs)
        
        if (!nextSegment) {
            return null
        }

        const timeUntilTransition = nextSegment.startMs - songMs

        // Only show transition info if within 3000ms
        if (timeUntilTransition >= 3000) {
            return null
        }

        // Extract key bindings from segment config
        const keyBindings = this.extractKeyBindings(nextSegment)

        return {
            nextMode: nextSegment.mode,
            nextSegmentId: nextSegment.id,
            timeUntilTransition,
            keyBindings
        }
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

    destroy(): void {
        this.currentRuntime?.unmount()
        this.currentRuntime = null
        this.currentSeg = null
    }
}
