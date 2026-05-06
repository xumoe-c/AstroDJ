import type { Segment, Judgement } from '../types'
import type { GlobalScorer } from '../scorer'

export interface RuntimeContext {
    canvas: HTMLCanvasElement
    ctx2d: CanvasRenderingContext2D
    area: { x: number; y: number; w: number; h: number }
    scorer: GlobalScorer
    judge: (rule: string, delta: number) => Judgement
    onJudgement?: (j: Judgement, x: number, y: number, offset?: number) => void
}

export interface ISegmentRuntime {
    mount(segment: Segment, ctx: RuntimeContext): void
    update(songMs: number): void
    handleKeyDown(key: string, songMs: number): void
    handleKeyUp(key: string, songMs: number): void
    handleTouchStart(x: number, songMs: number): void
    handleTouchEnd(x: number, songMs: number): void
    unmount(): void
    isComplete(songMs: number): boolean
}
