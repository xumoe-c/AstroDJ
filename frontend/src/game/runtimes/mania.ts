import type { Segment, ManiaSegment, ManiaNote, Judgement } from '../types'
import { Judgement as J, isManiaSegment } from '../types'
import type { ISegmentRuntime, RuntimeContext } from './interface'
import { skinManager } from '../skin-system'
import { HitEffectRenderer } from '../hit-effects'

type NoteState = 'pending' | 'hit' | 'missed' | 'holding' | 'tail-done' | 'tail-miss'

const NOTE_HEIGHT = 30 // Increased from 20 to 30
const VISIBLE_MS = 1500
const MISS_WINDOW = 200
const NOTE_LOCK_DURATION = 50
const MISSED_NOTE_DISPLAY_TIME = 500 // Time to show missed notes in gray

// 音符颜色 - 使用皮肤系统
const getLaneColors = () => {
    const skin = skinManager.getSkin()
    return [
        skin.colors.note,
        skin.colors.noteGlow,
        skin.colors.noteGlow,
        skin.colors.note
    ]
}

const getLaneColorsDim = () => {
    const skin = skinManager.getSkin()
    return [
        skin.colors.holdBody,
        skin.colors.holdBody,
        skin.colors.holdBody,
        skin.colors.holdBody
    ]
}

const LANE_COLORS = getLaneColors()
const LANE_COLORS_DIM = getLaneColorsDim()

// Judgement effect
const EFFECT_DURATION = 400
const JUDGE_LABELS: Record<number, string> = {
    [J.CriticalPerfect]: 'MAX', [J.Perfect]: '300', [J.Great]: '200',
    [J.Good]: '100', [J.Miss]: 'Miss',
}
const JUDGE_COLORS: Record<number, string> = {
    [J.CriticalPerfect]: '#00ffff', [J.Perfect]: '#ffdd00', [J.Great]: '#88ff44',
    [J.Good]: '#44ddff', [J.Miss]: '#ff4444',
}

interface Effect { lane: number; judgement: Judgement; startMs: number }

export class ManiaRuntime implements ISegmentRuntime {
    private segment!: ManiaSegment
    private ctx!: RuntimeContext
    private noteStates: NoteState[] = []
    private holdingNote: (number | null)[] = [null, null, null, null]
    private keyToLane = new Map<string, number>()
    private effects: Effect[] = []
    private laneWidth = 0
    private judgeLineY = 0
    private offsetX = 0
    private totalLaneWidth = 0 // Store total lane width for judge line
    private lockedNotes: Set<number> = new Set()
    private lockTimestamps: Map<number, number> = new Map()
    private hitEffects = new HitEffectRenderer()
    private keyPressStates: boolean[] = [false, false, false, false]
    private keyPressAnimations: number[] = [0, 0, 0, 0]
    private missedNoteTimestamps: Map<number, number> = new Map() // Track when notes were missed
    private scrollSpeedMultiplier = 1.0 // Custom scroll speed multiplier

    mount(segment: Segment, ctx: RuntimeContext): void {
        if (!isManiaSegment(segment)) {
            throw new Error('ManiaRuntime requires a ManiaSegment')
        }
        this.segment = segment
        this.ctx = ctx
        this.noteStates = new Array(this.segment.notes.length).fill('pending')
        this.holdingNote = [null, null, null, null]
        this.effects = []
        this.lockedNotes.clear()
        this.lockTimestamps.clear()
        this.keyPressStates = [false, false, false, false]
        this.keyPressAnimations = [0, 0, 0, 0]
        this.missedNoteTimestamps.clear()
        this.scrollSpeedMultiplier = 1.0

        // Build key→lane map
        this.keyToLane.clear()
        this.segment.config.keys.forEach((k, i) => {
            this.keyToLane.set(k.toLowerCase(), i)
        })

        // Layout - narrower lanes for better visibility
        const { area } = ctx
        const numLanes = this.segment.config.keys.length
        const totalLaneWidth = area.w * 0.6 // Use 60% of width instead of 100%
        this.totalLaneWidth = totalLaneWidth // Store for judge line rendering
        this.laneWidth = totalLaneWidth / numLanes
        this.judgeLineY = area.y + area.h - 80
        this.offsetX = area.x + (area.w - totalLaneWidth) / 2 // Center the lanes

        // Count notes for scorer (LN = 2 judgement points)
        let count = 0
        for (const n of this.segment.notes) {
            count += n.endTime ? 2 : 1
        }
        ctx.scorer.totalNotes += count
    }

    update(songMs: number): void {
        this.autoMiss(songMs)

        // 更新按键动画
        for (let i = 0; i < this.keyPressAnimations.length; i++) {
            if (this.keyPressAnimations[i] > 0) {
                this.keyPressAnimations[i] -= 16
            }
        }

        this.render(songMs)
    }

    handleKeyDown(key: string, songMs: number): void {
        const lowerKey = key.toLowerCase()

        // Handle scroll speed adjustment (F3/F4 keys)
        if (lowerKey === 'f3') {
            this.scrollSpeedMultiplier = Math.max(0.5, this.scrollSpeedMultiplier - 0.1)
            console.log(`Scroll speed: ${(this.scrollSpeedMultiplier * 100).toFixed(0)}%`)
            return
        }
        if (lowerKey === 'f4') {
            this.scrollSpeedMultiplier = Math.min(2.0, this.scrollSpeedMultiplier + 0.1)
            console.log(`Scroll speed: ${(this.scrollSpeedMultiplier * 100).toFixed(0)}%`)
            return
        }

        const lane = this.keyToLane.get(lowerKey)
        if (lane === undefined) return
        this.keyPressStates[lane] = true
        this.keyPressAnimations[lane] = 150
        this.pressLane(lane, songMs)
    }

    handleKeyUp(key: string, songMs: number): void {
        const lane = this.keyToLane.get(key.toLowerCase())
        if (lane === undefined) return
        this.keyPressStates[lane] = false
        this.releaseLane(lane, songMs)
    }

    handleTouchStart(x: number, songMs: number): void {
        const lane = Math.floor((x - this.offsetX) / this.laneWidth)
        if (lane < 0 || lane >= this.segment.config.keys.length) return
        this.pressLane(lane, songMs)
    }

    handleTouchEnd(x: number, songMs: number): void {
        const lane = Math.floor((x - this.offsetX) / this.laneWidth)
        if (lane < 0 || lane >= this.segment.config.keys.length) return
        this.releaseLane(lane, songMs)
    }

    unmount(): void {
        // Force-miss any remaining holding notes
        for (let lane = 0; lane < this.holdingNote.length; lane++) {
            const idx = this.holdingNote[lane]
            if (idx !== null && this.noteStates[idx] === 'holding') {
                this.noteStates[idx] = 'tail-miss'
                this.ctx.scorer.add(J.Miss, 1, this.segment!.mode)
            }
        }
        // Force-miss any remaining pending notes
        for (let i = 0; i < this.noteStates.length; i++) {
            if (this.noteStates[i] === 'pending') {
                this.noteStates[i] = 'missed'
                this.ctx.scorer.add(J.Miss, 1, this.segment!.mode)
                if (this.segment.notes[i].endTime) {
                    this.ctx.scorer.add(J.Miss, 1, this.segment!.mode) // tail too
                }
            }
        }

        // 清理特效
        this.hitEffects.clear()
    }

    isComplete(songMs: number): boolean {
        if (songMs < this.segment.endMs) return false
        return this.noteStates.every(
            (s) => s !== 'pending' && s !== 'holding',
        )
    }

    // ── Internal ──

    private isNoteLocked(idx: number, songMs: number): boolean {
        if (!this.lockedNotes.has(idx)) return false
        const lockTime = this.lockTimestamps.get(idx) || 0
        if (songMs - lockTime > NOTE_LOCK_DURATION) {
            // Lock expired, unlock
            this.lockedNotes.delete(idx)
            this.lockTimestamps.delete(idx)
            return false
        }
        return true
    }

    private lockNote(idx: number, songMs: number): void {
        this.lockedNotes.add(idx)
        this.lockTimestamps.set(idx, songMs)
    }

    private pressLane(lane: number, songMs: number): void {
        const { notes } = this.segment
        const relativeMs = songMs - this.segment.startMs
        let bestIdx = -1
        let bestDelta = Infinity

        for (let i = 0; i < notes.length; i++) {
            if (this.noteStates[i] !== 'pending') continue
            if (this.isNoteLocked(i, songMs)) continue
            if (notes[i].lane !== lane) continue
            const delta = Math.abs(notes[i].time - relativeMs)
            if (delta < bestDelta) {
                bestDelta = delta
                bestIdx = i
            }
        }

        if (bestIdx === -1 || bestDelta > MISS_WINDOW) return

        const j = this.ctx.judge(this.segment.judgeRule, bestDelta)
        this.ctx.scorer.add(j, 1, this.segment!.mode)

        const hitX = this.offsetX + lane * this.laneWidth + this.laneWidth / 2
        const hitY = this.judgeLineY

        this.ctx.onJudgement?.(j, hitX, hitY, relativeMs - this.segment.notes[bestIdx].time)
        this.effects.push({ lane, judgement: j, startMs: songMs })

        // 添加打击特效
        this.hitEffects.addHitEffect(hitX, hitY, j, lane)

        this.lockNote(bestIdx, songMs)

        if (this.segment.notes[bestIdx].endTime) {
            this.noteStates[bestIdx] = 'holding'
            this.holdingNote[lane] = bestIdx
        } else {
            this.noteStates[bestIdx] = 'hit'
        }
    }

    private releaseLane(lane: number, songMs: number): void {
        const idx = this.holdingNote[lane]
        if (idx === null) return

        const note = this.segment.notes[idx]
        const relativeMs = songMs - this.segment.startMs
        this.holdingNote[lane] = null

        if (this.noteStates[idx] !== 'holding') return

        const delta = Math.abs(relativeMs - (note.endTime ?? note.time))
        if (relativeMs < (note.endTime ?? note.time) - MISS_WINDOW) {
            // Released way too early
            this.noteStates[idx] = 'tail-miss'
            this.ctx.scorer.add(J.Miss, 1, this.segment!.mode)
            this.effects.push({ lane, judgement: J.Miss, startMs: songMs })
        } else {
            const j = this.ctx.judge(this.segment.judgeRule, delta)
            this.noteStates[idx] = 'tail-done'
            this.ctx.scorer.add(j, 1, this.segment!.mode)
            this.effects.push({ lane, judgement: j, startMs: songMs })
        }
        this.ctx.onJudgement?.(this.effects[this.effects.length - 1].judgement, this.offsetX + lane * this.laneWidth + this.laneWidth / 2, this.judgeLineY, relativeMs - (note.endTime ?? note.time))
    }

    private autoMiss(songMs: number): void {
        const { notes } = this.segment
        const relativeMs = songMs - this.segment.startMs

        for (let i = 0; i < notes.length; i++) {
            if (this.noteStates[i] === 'pending' && relativeMs - notes[i].time > MISS_WINDOW) {
                this.noteStates[i] = 'missed'
                this.missedNoteTimestamps.set(i, songMs) // Record when note was missed
                this.ctx.scorer.add(J.Miss, 1, this.segment!.mode)
                this.ctx.onJudgement?.(J.Miss, this.offsetX + notes[i].lane * this.laneWidth + this.laneWidth / 2, this.judgeLineY, relativeMs - notes[i].time)
                this.effects.push({ lane: notes[i].lane, judgement: J.Miss, startMs: songMs })
                // If LN, also miss the tail
                if (notes[i].endTime) {
                    this.ctx.scorer.add(J.Miss, 1, this.segment!.mode)
                }
            }
            if (this.noteStates[i] === 'holding' && notes[i].endTime && relativeMs - notes[i].endTime! > MISS_WINDOW) {
                this.noteStates[i] = 'tail-miss'
                this.missedNoteTimestamps.set(i, songMs) // Record when tail was missed
                const lane = notes[i].lane
                if (this.holdingNote[lane] === i) this.holdingNote[lane] = null
                this.ctx.scorer.add(J.Miss, 1, this.segment!.mode)
                this.effects.push({ lane, judgement: J.Miss, startMs: songMs })
            }
        }
    }

    private render(songMs: number): void {
        const { ctx2d: c, area } = this.ctx
        const { notes, config } = this.segment
        const scrollSpeed = config.scrollSpeed * this.scrollSpeedMultiplier // Apply custom multiplier
        const numLanes = config.keys.length
        const skin = skinManager.getSkin()

        // Calculate relative time within segment
        const relativeMs = songMs - this.segment.startMs

        // Clear canvas completely to prevent ghosting
        c.clearRect(area.x, area.y, area.w, area.h)

        // Reset all canvas states
        c.globalAlpha = 1.0
        c.shadowBlur = 0
        c.shadowColor = 'transparent'

        // Background - use single fillRect for better performance
        c.fillStyle = skin.colors.background
        c.fillRect(area.x, area.y, area.w, area.h)

        // Lane backgrounds with key press animation
        const laneColors = getLaneColors()
        for (let i = 0; i < numLanes; i++) {
            if (this.keyPressAnimations[i] > 0) {
                const alpha = this.keyPressAnimations[i] / 150
                c.fillStyle = laneColors[i % laneColors.length]
                c.globalAlpha = alpha * 0.3
                c.fillRect(
                    this.offsetX + i * this.laneWidth,
                    area.y,
                    this.laneWidth,
                    area.h
                )
                c.globalAlpha = 1.0
            }
        }

        // Lane dividers - batch drawing
        c.strokeStyle = skin.colors.laneDivider
        c.lineWidth = 1
        c.beginPath()
        for (let i = 0; i <= numLanes; i++) {
            const x = this.offsetX + i * this.laneWidth
            c.moveTo(x, area.y)
            c.lineTo(x, area.y + area.h)
        }
        c.stroke()

        // Judge line - draw across all lanes
        c.strokeStyle = skin.colors.judgeLine
        c.lineWidth = 3
        c.beginPath()
        c.moveTo(this.offsetX, this.judgeLineY)
        c.lineTo(this.offsetX + this.totalLaneWidth, this.judgeLineY) // Use this.totalLaneWidth
        c.stroke()

        // Notes
        const laneColorsDim = getLaneColorsDim()

        for (let i = 0; i < notes.length; i++) {
            const note = notes[i]
            const state = this.noteStates[i]

            // Check if missed note should still be displayed
            const missedTimestamp = this.missedNoteTimestamps.get(i)
            const showMissed = missedTimestamp && (songMs - missedTimestamp < MISSED_NOTE_DISPLAY_TIME)

            if (state === 'hit' || state === 'tail-done') {
                continue
            }

            // Skip missed notes after display time
            if ((state === 'missed' || state === 'tail-miss') && !showMissed) {
                continue
            }

            const headDelta = note.time - relativeMs
            if (headDelta > VISIBLE_MS && state === 'pending') continue

            const x = this.offsetX + note.lane * this.laneWidth + 2
            const w = this.laneWidth - 4

            // Determine if note should be grayed out (missed)
            const isMissed = (state === 'missed' || state === 'tail-miss') && showMissed

            if (note.endTime) {
                // Long note
                const tailDelta = note.endTime - relativeMs
                if (tailDelta < -200 && !isMissed) continue

                const headY = state === 'holding'
                    ? this.judgeLineY
                    : this.judgeLineY - headDelta * scrollSpeed
                const tailY = this.judgeLineY - tailDelta * scrollSpeed

                const isHeld = state === 'holding'

                // Save canvas state before applying effects
                c.save()

                // Body - gray if missed
                if (isMissed) {
                    c.fillStyle = '#555555'
                    c.globalAlpha = 0.5
                } else {
                    c.fillStyle = laneColorsDim[note.lane % laneColorsDim.length]
                    c.globalAlpha = isHeld ? 0.7 : 0.4
                }
                const top = Math.min(tailY, headY)
                c.fillRect(x + 10, top, w - 20, Math.abs(headY - tailY))

                // Restore alpha for head/tail
                c.globalAlpha = 1.0

                if (isHeld && !isMissed) {
                    c.shadowColor = laneColors[note.lane % laneColors.length]
                    c.shadowBlur = 15
                }

                // Tail - gray if missed
                c.fillStyle = isMissed ? '#666666' : skin.colors.holdTail
                c.fillRect(x, tailY - NOTE_HEIGHT / 2, w, NOTE_HEIGHT)

                // Head (only if not yet judged or if missed and still showing)
                if (state === 'pending' || isMissed) {
                    c.fillStyle = isMissed ? '#666666' : skin.colors.holdHead
                    c.fillRect(x, headY - NOTE_HEIGHT / 2, w, NOTE_HEIGHT)
                }

                // Restore canvas state to clear shadow effects
                c.restore()
            } else {
                // Normal note
                if (state !== 'pending' && !isMissed) continue
                if (headDelta < -200 && !isMissed) continue

                const y = this.judgeLineY - headDelta * scrollSpeed

                // Gray color for missed notes
                c.fillStyle = isMissed ? '#666666' : laneColors[note.lane % laneColors.length]
                if (isMissed) {
                    c.globalAlpha = 0.6
                }
                c.fillRect(x, y - NOTE_HEIGHT / 2, w, NOTE_HEIGHT)
                if (isMissed) {
                    c.globalAlpha = 1.0
                }
            }
        }

        // Render hit effects
        this.hitEffects.render(c, performance.now())

        // Effects
        this.renderEffects(c, songMs)
    }

    private renderEffects(c: CanvasRenderingContext2D, songMs: number): void {
        this.effects = this.effects.filter((e) => songMs - e.startMs < EFFECT_DURATION)

        for (const e of this.effects) {
            const progress = (songMs - e.startMs) / EFFECT_DURATION
            const alpha = 1 - progress
            const cx = this.offsetX + e.lane * this.laneWidth + this.laneWidth / 2
            const cy = this.judgeLineY
            const color = JUDGE_COLORS[e.judgement] ?? '#fff'

            // Save canvas state before applying effects
            c.save()

            // Ring
            c.strokeStyle = color
            c.lineWidth = 3 * alpha
            c.globalAlpha = alpha * 0.8
            c.beginPath()
            c.arc(cx, cy, 20 + progress * 30, 0, Math.PI * 2)
            c.stroke()

            // Text
            c.fillStyle = color
            c.globalAlpha = alpha
            c.font = `bold ${16 + (1 - progress) * 4}px 'Segoe UI', sans-serif`
            c.textAlign = 'center'
            c.fillText(JUDGE_LABELS[e.judgement] ?? '', cx, cy - 30 - progress * 20)

            // Restore canvas state
            c.restore()
        }
    }
}
