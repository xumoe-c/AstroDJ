import type { Segment, TaikoSegment, TaikoNote, Judgement } from '../types'
import { Judgement as J, isTaikoSegment } from '../types'
import type { ISegmentRuntime, RuntimeContext } from './interface'
import { skinManager } from '../skin-system'
import { HitEffectRenderer } from '../hit-effects'

type NoteState = 'pending' | 'hit' | 'missed' | 'rolling' | 'done'

const MISS_WINDOW = 120 // Expanded from 108ms for more lenient judgment
const BIG_PAIR_WINDOW = 50 // ms to wait for second key on big notes
const NOTE_LOCK_DURATION = 50 // ms to lock a note after judgment
const VISIBLE_MS = 2000
const JUDGE_CIRCLE_X_OFFSET = 100
const NOTE_RADIUS = 25
const BIG_RADIUS = 40

const EFFECT_DURATION = 350
const JUDGE_LABELS: Record<number, string> = {
    [J.CriticalPerfect]: 'GREAT', [J.Perfect]: 'GREAT', [J.Great]: 'OK', [J.Good]: 'OK', [J.Miss]: 'MISS',
}
const JUDGE_COLORS: Record<number, string> = {
    [J.CriticalPerfect]: '#00ffff', [J.Perfect]: '#ffdd00', [J.Great]: '#88ff44', [J.Good]: '#44ddff', [J.Miss]: '#ff4444',
}

interface Effect { judgement: Judgement; startMs: number; big: boolean }
interface PendingBig { index: number; time: number; firstType: 'don' | 'ka'; judgement: Judgement }

export class TaikoRuntime implements ISegmentRuntime {
    private segment!: TaikoSegment
    private ctx!: RuntimeContext
    private noteStates: NoteState[] = []
    private donKeys = new Set<string>()
    private kaKeys = new Set<string>()
    private activeRoll: number | null = null
    private activeBalloon: number | null = null
    private balloonRemaining = 0
    private pendingBig: PendingBig | null = null
    private effects: Effect[] = []
    private judgeCircleX = 0
    private judgeCircleY = 0
    private lockedNotes: Set<number> = new Set()
    private lockTimestamps: Map<number, number> = new Map()
    private hitEffects = new HitEffectRenderer()
    private drumHitAnimation = 0

    mount(segment: Segment, ctx: RuntimeContext): void {
        if (!isTaikoSegment(segment)) {
            throw new Error('TaikoRuntime requires a TaikoSegment')
        }
        this.segment = segment
        this.ctx = ctx
        this.noteStates = new Array(this.segment.notes.length).fill('pending')
        this.effects = []
        this.activeRoll = null
        this.activeBalloon = null
        this.balloonRemaining = 0
        this.pendingBig = null
        this.lockedNotes.clear()
        this.lockTimestamps.clear()
        this.drumHitAnimation = 0

        this.donKeys.clear()
        this.kaKeys.clear()
        for (const k of this.segment.config.donKeys) this.donKeys.add(k.toLowerCase())
        for (const k of this.segment.config.kaKeys) this.kaKeys.add(k.toLowerCase())

        // Layout - move track up for better visibility
        const { area } = ctx
        this.judgeCircleX = area.x + JUDGE_CIRCLE_X_OFFSET
        this.judgeCircleY = area.y + area.h * 0.4 // Moved up from 0.5 to 0.4

        // Count notes for scorer (only don/ka count, not roll/balloon)
        let count = 0
        for (const n of this.segment.notes) {
            if (n.type === 'don' || n.type === 'ka') count++
        }
        ctx.scorer.totalNotes += count
    }

    update(songMs: number): void {
        this.checkPendingBig(songMs)
        this.autoMiss(songMs)
        this.updateSpecials(songMs)

        // Update drum hit animation
        if (this.drumHitAnimation > 0) {
            this.drumHitAnimation -= 16
        }

        this.render(songMs)
    }

    handleKeyDown(key: string, songMs: number): void {
        const lk = key.toLowerCase()
        const hitType: 'don' | 'ka' | null =
            this.donKeys.has(lk) ? 'don' : this.kaKeys.has(lk) ? 'ka' : null
        if (!hitType) return

        // Priority 1: active balloon (any don hit counts)
        if (this.activeBalloon !== null && hitType === 'don') {
            this.balloonRemaining--
            this.ctx.scorer.addBonus(100)
            if (this.balloonRemaining <= 0) {
                this.noteStates[this.activeBalloon] = 'done'
                this.ctx.scorer.addBonus(1000) // completion bonus
                this.activeBalloon = null
            }
            return
        }

        // Priority 2: active roll (any hit counts)
        if (this.activeRoll !== null) {
            const rollNote = this.segment.notes[this.activeRoll]
            if (songMs < (rollNote.endTime ?? rollNote.time)) {
                this.ctx.scorer.addBonus(100)
                return
            }
        }

        // Priority 3: check pending big note pairing
        if (this.pendingBig) {
            const elapsed = songMs - this.pendingBig.time
            if (elapsed <= BIG_PAIR_WINDOW) {
                const note = this.segment.notes[this.pendingBig.index]
                // Second key must be same type (don+don or ka+ka)
                if (hitType === this.pendingBig.firstType) {
                    // Big hit success! Double score
                    const bonusScore =
                        this.pendingBig.judgement === J.CriticalPerfect ? 320 :
                            this.pendingBig.judgement === J.Perfect ? 300 : 100
                    this.ctx.scorer.addBonus(bonusScore)
                    this.effects.push({ judgement: this.pendingBig.judgement, startMs: songMs, big: true })
                    this.ctx.onJudgement?.(this.pendingBig.judgement, this.judgeCircleX, this.judgeCircleY, relativeMs - this.segment.notes[this.activeRoll || 0].time)
                }
                this.pendingBig = null
                return
            }
            // Expired, already handled in checkPendingBig
        }

        // Priority 4: normal note judgement
        const { notes } = this.segment
        const relativeMs = songMs - this.segment.startMs
        let bestIdx = -1
        let bestDelta = Infinity

        for (let i = 0; i < notes.length; i++) {
            if (this.noteStates[i] !== 'pending') continue
            if (this.isNoteLocked(i, songMs)) continue // Skip locked notes
            const n = notes[i]
            // For don/ka, match type. For roll/balloon, match don type
            if (n.type === 'don' || n.type === 'ka') {
                if (n.type !== hitType) continue
            } else if (n.type === 'roll' || n.type === 'balloon') {
                // Roll/balloon activated by any hit
            } else {
                continue
            }
            const delta = Math.abs(n.time - relativeMs)
            if (delta < bestDelta) {
                bestDelta = delta
                bestIdx = i
            }
        }

        if (bestIdx === -1 || bestDelta > MISS_WINDOW) return

        const note = notes[bestIdx]

        // Activate roll
        if (note.type === 'roll') {
            this.activeRoll = bestIdx
            this.noteStates[bestIdx] = 'rolling'
            this.ctx.scorer.addBonus(100) // first hit
            this.lockNote(bestIdx, songMs)
            return
        }

        // Activate balloon
        if (note.type === 'balloon') {
            this.activeBalloon = bestIdx
            this.balloonRemaining = (note.hits ?? 10) - 1
            this.noteStates[bestIdx] = 'rolling'
            this.ctx.scorer.addBonus(100) // first hit
            this.lockNote(bestIdx, songMs)
            return
        }

        // Normal don/ka judgement
        const j = this.ctx.judge(this.segment.judgeRule, bestDelta)
        this.noteStates[bestIdx] = 'hit'
        this.ctx.scorer.add(j, 1, this.segment!.mode)
        this.ctx.onJudgement?.(j, this.judgeCircleX, this.judgeCircleY, relativeMs - this.segment.notes[bestIdx].time)
        this.lockNote(bestIdx, songMs) // Lock the note

        // Add hit effects
        this.hitEffects.addHitEffect(this.judgeCircleX, this.judgeCircleY, j)

        // Drum hit animation
        this.drumHitAnimation = 150

        if (note.big) {
            // Start big note pairing window
            this.pendingBig = { index: bestIdx, time: songMs, firstType: hitType, judgement: j }
        } else {
            this.effects.push({ judgement: j, startMs: songMs, big: false })
        }
    }

    handleKeyUp(_key: string, _songMs: number): void {
        // Taiko doesn't use key release
    }

    handleTouchStart(x: number, songMs: number): void {
        // Left half = don, right half = ka
        const midX = this.ctx.area.x + this.ctx.area.w / 2
        const hitType = x < midX ? 'don' : 'ka'
        const fakeKey = hitType === 'don'
            ? this.segment.config.donKeys[0]
            : this.segment.config.kaKeys[0]
        this.handleKeyDown(fakeKey, songMs)
    }

    handleTouchEnd(_x: number, _songMs: number): void {
        // No-op for taiko
    }

    unmount(): void {
        // Force-miss remaining pending notes
        for (let i = 0; i < this.noteStates.length; i++) {
            const n = this.segment.notes[i]
            if (this.noteStates[i] === 'pending' && (n.type === 'don' || n.type === 'ka')) {
                this.noteStates[i] = 'missed'
                this.ctx.scorer.add(J.Miss, 1, this.segment!.mode)
            }
        }

        // Clear effects
        this.hitEffects.clear()
    }

    isComplete(songMs: number): boolean {
        if (songMs < this.segment.endMs) return false
        return this.noteStates.every((s) => s !== 'pending' && s !== 'rolling')
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

    private checkPendingBig(songMs: number): void {
        if (!this.pendingBig) return
        if (songMs - this.pendingBig.time > BIG_PAIR_WINDOW) {
            // Expired without pair — already scored as small hit, just add effect
            this.effects.push({ judgement: this.pendingBig.judgement, startMs: this.pendingBig.time, big: false })
            this.pendingBig = null
        }
    }

    private autoMiss(songMs: number): void {
        const { notes } = this.segment
        const relativeMs = songMs - this.segment.startMs

        for (let i = 0; i < notes.length; i++) {
            if (this.noteStates[i] !== 'pending') continue
            const n = notes[i]
            if (n.type !== 'don' && n.type !== 'ka') continue
            if (relativeMs - n.time > MISS_WINDOW) {
                this.noteStates[i] = 'missed'
                this.ctx.scorer.add(J.Miss, 1, this.segment!.mode)
                this.ctx.onJudgement?.(J.Miss, this.judgeCircleX, this.judgeCircleY, relativeMs - n.time)
                this.effects.push({ judgement: J.Miss, startMs: songMs, big: false })
            }
        }
    }

    private updateSpecials(songMs: number): void {
        const relativeMs = songMs - this.segment.startMs

        // Auto-complete roll
        if (this.activeRoll !== null) {
            const n = this.segment.notes[this.activeRoll]
            if (relativeMs > (n.endTime ?? n.time)) {
                this.noteStates[this.activeRoll] = 'done'
                this.activeRoll = null
            }
        }
        // Auto-complete/timeout balloon
        if (this.activeBalloon !== null) {
            const n = this.segment.notes[this.activeBalloon]
            if (relativeMs > (n.endTime ?? n.time) || this.balloonRemaining <= 0) {
                this.noteStates[this.activeBalloon] = 'done'
                this.activeBalloon = null
            }
        }
        // Auto-activate pending rolls/balloons that reach judge circle
        const { notes } = this.segment
        for (let i = 0; i < notes.length; i++) {
            if (this.noteStates[i] !== 'pending') continue
            const n = notes[i]
            if (n.type === 'roll' && relativeMs >= n.time) {
                this.activeRoll = i
                this.noteStates[i] = 'rolling'
            }
            if (n.type === 'balloon' && relativeMs >= n.time) {
                this.activeBalloon = i
                this.balloonRemaining = n.hits ?? 10
                this.noteStates[i] = 'rolling'
            }
        }
    }

    private render(songMs: number): void {
        const { ctx2d: c, area } = this.ctx
        const { notes, config } = this.segment
        const scrollSpeed = config.scrollSpeed
        const relativeMs = songMs - this.segment.startMs
        const skin = skinManager.getSkin()

        // Clear canvas completely to prevent ghosting
        c.clearRect(area.x, area.y, area.w, area.h)

        // Reset all canvas states
        c.globalAlpha = 1.0
        c.shadowBlur = 0
        c.shadowColor = 'transparent'

        // Background - single fillRect
        c.fillStyle = skin.colors.background
        c.fillRect(area.x, area.y, area.w, area.h)

        // Conveyor belt
        c.fillStyle = skin.colors.lane
        c.fillRect(area.x, this.judgeCircleY - 50, area.w, 100)

        // Drum hit animation - scale effect
        const drumScale = this.drumHitAnimation > 0 ? 1 + (this.drumHitAnimation / 150) * 0.1 : 1

        c.save()
        c.translate(this.judgeCircleX, this.judgeCircleY)
        c.scale(drumScale, drumScale)
        c.translate(-this.judgeCircleX, -this.judgeCircleY)

        // Judge circle - batch drawing
        c.strokeStyle = skin.colors.judgeCircle
        c.lineWidth = 4
        c.beginPath()
        c.arc(this.judgeCircleX, this.judgeCircleY, 45, 0, Math.PI * 2)
        c.stroke()

        // Inner circle
        c.strokeStyle = skin.colors.laneDivider
        c.lineWidth = 2
        c.beginPath()
        c.arc(this.judgeCircleX, this.judgeCircleY, 30, 0, Math.PI * 2)
        c.stroke()

        // Drum hit glow
        if (this.drumHitAnimation > 0) {
            const alpha = this.drumHitAnimation / 150
            c.globalAlpha = alpha * 0.5
            c.fillStyle = skin.colors.hitBurst
            c.shadowColor = skin.colors.hitBurst
            c.shadowBlur = 30
            c.beginPath()
            c.arc(this.judgeCircleX, this.judgeCircleY, 40, 0, Math.PI * 2)
            c.fill()
            c.globalAlpha = 1.0
            c.shadowBlur = 0
        }

        c.restore()

        // Notes (draw from right to left so closer notes are on top)
        for (let i = notes.length - 1; i >= 0; i--) {
            const note = notes[i]
            const state = this.noteStates[i]

            if (state === 'hit' || state === 'missed' || state === 'done') continue

            const deltaMs = note.time - relativeMs
            const noteX = this.judgeCircleX + deltaMs * scrollSpeed

            if (noteX > area.x + area.w + 100) continue
            if (noteX < area.x - 100 && state !== 'rolling') continue

            switch (note.type) {
                case 'don':
                case 'ka':
                    this.renderDonKa(c, note, noteX, state)
                    break
                case 'roll':
                    this.renderRoll(c, note, noteX, relativeMs, scrollSpeed)
                    break
                case 'balloon':
                    this.renderBalloon(c, note, noteX, relativeMs, scrollSpeed)
                    break
            }
        }

        // Render hit effects
        this.hitEffects.render(c, performance.now())

        // Effects
        this.renderEffects(c, songMs)

        // Mode label
        c.fillStyle = skin.colors.laneDivider
        c.font = '14px "Segoe UI", sans-serif'
        c.textAlign = 'left'
        c.fillText('TAIKO', area.x + 10, area.y + 20)
    }

    private renderDonKa(c: CanvasRenderingContext2D, note: TaikoNote, x: number, state: NoteState): void {
        if (state !== 'pending') return
        const r = note.big ? BIG_RADIUS : NOTE_RADIUS
        const y = this.judgeCircleY

        if (note.type === 'don') {
            // Red filled circle
            c.fillStyle = '#ee4444'
            c.beginPath()
            c.arc(x, y, r, 0, Math.PI * 2)
            c.fill()
            // White inner highlight
            c.fillStyle = 'rgba(255,255,255,0.3)'
            c.beginPath()
            c.arc(x, y, r * 0.5, 0, Math.PI * 2)
            c.fill()
        } else {
            // Blue ring
            c.strokeStyle = '#4488ff'
            c.lineWidth = note.big ? 8 : 5
            c.beginPath()
            c.arc(x, y, r, 0, Math.PI * 2)
            c.stroke()
            // Inner fill
            c.fillStyle = 'rgba(68,136,255,0.2)'
            c.beginPath()
            c.arc(x, y, r, 0, Math.PI * 2)
            c.fill()
        }

        // Big note indicator
        if (note.big) {
            c.strokeStyle = '#fff'
            c.lineWidth = 2
            c.beginPath()
            c.arc(x, y, r + 3, 0, Math.PI * 2)
            c.stroke()
        }
    }

    private renderRoll(c: CanvasRenderingContext2D, note: TaikoNote, headX: number, relativeMs: number, scrollSpeed: number): void {
        const endX = this.judgeCircleX + ((note.endTime ?? note.time) - relativeMs) * scrollSpeed
        const y = this.judgeCircleY
        const r = 20

        // Capsule body
        c.fillStyle = '#ffaa00'
        c.globalAlpha = 0.6
        c.beginPath()
        c.moveTo(headX, y - r)
        c.lineTo(endX, y - r)
        c.arc(endX, y, r, -Math.PI / 2, Math.PI / 2)
        c.lineTo(headX, y + r)
        c.arc(headX, y, r, Math.PI / 2, -Math.PI / 2)
        c.fill()
        c.globalAlpha = 1.0

        // Border
        c.strokeStyle = '#ffcc44'
        c.lineWidth = 2
        c.beginPath()
        c.moveTo(headX, y - r)
        c.lineTo(endX, y - r)
        c.arc(endX, y, r, -Math.PI / 2, Math.PI / 2)
        c.lineTo(headX, y + r)
        c.arc(headX, y, r, Math.PI / 2, -Math.PI / 2)
        c.stroke()

        // Label
        c.fillStyle = '#fff'
        c.font = 'bold 14px "Segoe UI", sans-serif'
        c.textAlign = 'center'
        c.fillText('ROLL', (headX + endX) / 2, y + 5)
    }

    private renderBalloon(c: CanvasRenderingContext2D, note: TaikoNote, headX: number, relativeMs: number, scrollSpeed: number): void {
        const y = this.judgeCircleY
        const r = 35

        // Orange circle
        c.fillStyle = '#ff6600'
        c.beginPath()
        c.arc(headX, y, r, 0, Math.PI * 2)
        c.fill()

        c.strokeStyle = '#ffaa44'
        c.lineWidth = 3
        c.beginPath()
        c.arc(headX, y, r, 0, Math.PI * 2)
        c.stroke()

        // Remaining hits
        const remaining = this.activeBalloon !== null && this.segment.notes[this.activeBalloon] === note
            ? this.balloonRemaining
            : note.hits ?? 0
        c.fillStyle = '#fff'
        c.font = 'bold 20px "Segoe UI", sans-serif'
        c.textAlign = 'center'
        c.fillText(String(remaining), headX, y + 7)
    }

    private renderEffects(c: CanvasRenderingContext2D, songMs: number): void {
        this.effects = this.effects.filter((e) => songMs - e.startMs < EFFECT_DURATION)

        for (const e of this.effects) {
            const progress = (songMs - e.startMs) / EFFECT_DURATION
            const alpha = 1 - progress
            const color = JUDGE_COLORS[e.judgement] ?? '#fff'
            const cx = this.judgeCircleX
            const cy = this.judgeCircleY

            // Save canvas state before applying effects
            c.save()

            // Expanding ring
            const ringR = (e.big ? 50 : 35) + progress * 30
            c.strokeStyle = color
            c.lineWidth = (e.big ? 4 : 2) * alpha
            c.globalAlpha = alpha * 0.8
            c.beginPath()
            c.arc(cx, cy, ringR, 0, Math.PI * 2)
            c.stroke()

            // Text
            c.fillStyle = color
            c.globalAlpha = alpha
            c.font = `bold ${e.big ? 22 : 16}px 'Segoe UI', sans-serif`
            c.textAlign = 'center'
            c.fillText(JUDGE_LABELS[e.judgement] ?? '', cx, cy - 55 - progress * 15)

            // Restore canvas state
            c.restore()
        }
    }
}
