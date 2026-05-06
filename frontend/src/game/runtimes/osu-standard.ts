import type { Segment, OsuStandardSegment, OsuNote, Judgement } from '../types'
import { Judgement as J, isOsuStandardSegment } from '../types'
import type { ISegmentRuntime, RuntimeContext } from './interface'

type NoteState = 'pending' | 'hit' | 'missed' | 'active' | 'done'

const MISS_WINDOW = 165 // Expanded from 150ms for more lenient judgment
const NOTE_LOCK_DURATION = 50 // ms to lock a note after judgment
const OSU_PLAYFIELD_WIDTH = 512
const OSU_PLAYFIELD_HEIGHT = 384
const SLIDER_FOLLOW_RADIUS = 2.4 // Multiplier for slider follow circle radius

export class OsuStandardRuntime implements ISegmentRuntime {
    private segment!: OsuStandardSegment
    private ctx!: RuntimeContext
    private notes: OsuNote[] = []
    private noteStates: NoteState[] = []
    private activeNotes: Set<number> = new Set()
    private cursorX = 0
    private cursorY = 0
    private hitCircleRadius = 0
    private playfieldOffsetX = 0
    private playfieldOffsetY = 0
    private playfieldScaleX = 1
    private playfieldScaleY = 1
    private sliderStartTimes: Map<number, number> = new Map() // Track when slider was started
    private sliderFollowPoints: Map<number, number> = new Map() // Track current position on slider (0-1)
    private spinnerRotations: Map<number, number> = new Map() // Track total rotations for each spinner
    private spinnerLastAngle: Map<number, number> = new Map() // Track last cursor angle for rotation calculation
    private spinnerStartTimes: Map<number, number> = new Map() // Track when spinner was started
    private lockedNotes: Set<number> = new Set()
    private lockTimestamps: Map<number, number> = new Map()

    mount(segment: Segment, ctx: RuntimeContext): void {
        if (!isOsuStandardSegment(segment)) {
            throw new Error('OsuStandardRuntime requires an OsuStandardSegment')
        }

        this.segment = segment
        this.ctx = ctx
        this.notes = [...segment.notes]
        this.noteStates = new Array(this.notes.length).fill('pending')
        this.activeNotes.clear()
        this.sliderStartTimes.clear()
        this.sliderFollowPoints.clear()
        this.spinnerRotations.clear()
        this.spinnerLastAngle.clear()
        this.spinnerStartTimes.clear()
        this.lockedNotes.clear()
        this.lockTimestamps.clear()
        this.cursorX = ctx.area.w / 2
        this.cursorY = ctx.area.h / 2

        // Calculate hit circle radius from circleSize (CS)
        // Formula: radius = 54.4 - 4.48 * CS (in osu!pixels)
        const cs = segment.config.circleSize
        const osuRadius = 54.4 - 4.48 * cs

        // Calculate playfield scaling to fit in area
        this.playfieldScaleX = ctx.area.w / OSU_PLAYFIELD_WIDTH
        this.playfieldScaleY = ctx.area.h / OSU_PLAYFIELD_HEIGHT
        const scale = Math.min(this.playfieldScaleX, this.playfieldScaleY)
        this.playfieldScaleX = scale
        this.playfieldScaleY = scale

        // Center playfield in area
        this.playfieldOffsetX = ctx.area.x + (ctx.area.w - OSU_PLAYFIELD_WIDTH * scale) / 2
        this.playfieldOffsetY = ctx.area.y + (ctx.area.h - OSU_PLAYFIELD_HEIGHT * scale) / 2

        // Scale hit circle radius
        this.hitCircleRadius = osuRadius * scale

        // Count notes for scorer
        // Circles = 1 judgement, sliders = 1 judgement, spinners = 1 judgement
        let count = 0
        for (const note of this.notes) {
            count += 1
        }
        ctx.scorer.totalNotes += count
    }

    update(songMs: number): void {
        this.autoMiss(songMs)
        this.updateSliders(songMs)
        this.updateSpinners(songMs)
        this.render(songMs)
    }

    handleKeyDown(key: string, songMs: number): void {
        // osu-standard primarily uses mouse/touch, but keyboard can be used for clicks
        // Treat keyboard as a click at current cursor position
        this.handleTouchStart(this.cursorX, songMs)
    }

    handleKeyUp(key: string, songMs: number): void {
        // No-op for hit circles
    }

    handleTouchStart(x: number, songMs: number): void {
        // Update cursor position (for now, assume y is at vertical center)
        // In a real implementation, this would come from mouse/touch events
        this.cursorX = x
        this.cursorY = this.ctx.area.h / 2

        // Convert screen coordinates to osu playfield coordinates
        const osuX = (x - this.playfieldOffsetX) / this.playfieldScaleX
        const osuY = (this.cursorY - this.playfieldOffsetY) / this.playfieldScaleY

        // Check if we're clicking on an active spinner
        for (let i = 0; i < this.notes.length; i++) {
            const note = this.notes[i]
            if (note.type === 'spinner' && this.noteStates[i] === 'pending' && note.endTime) {
                // Check if spinner is active (within its time range)
                if (songMs >= note.time && songMs <= note.endTime) {
                    // Activate spinner
                    this.noteStates[i] = 'active'
                    this.spinnerStartTimes.set(i, songMs)
                    this.spinnerRotations.set(i, 0)
                    this.activeNotes.add(i)

                    // Initialize angle tracking
                    const centerX = 256 // Osu playfield center
                    const centerY = 192
                    const angle = Math.atan2(osuY - centerY, osuX - centerX)
                    this.spinnerLastAngle.set(i, angle)
                    return
                }
            }
        }

        // Find the closest pending hit circle or slider head within timing window
        let bestIdx = -1
        let bestDelta = Infinity
        let bestDistance = Infinity

        for (let i = 0; i < this.notes.length; i++) {
            if (this.noteStates[i] !== 'pending') continue
            if (this.isNoteLocked(i, songMs)) continue // Skip locked notes

            const note = this.notes[i]
            if (note.type !== 'circle' && note.type !== 'slider') continue

            // Check timing window
            const timeDelta = Math.abs(note.time - songMs)
            if (timeDelta > MISS_WINDOW) continue

            // Check spatial distance
            const dx = note.x - osuX
            const dy = note.y - osuY
            const distance = Math.sqrt(dx * dx + dy * dy)

            // Hit circle radius in osu coordinates
            const osuRadius = 54.4 - 4.48 * this.segment.config.circleSize

            if (distance <= osuRadius) {
                // Prioritize by timing accuracy, then by distance
                if (timeDelta < bestDelta || (timeDelta === bestDelta && distance < bestDistance)) {
                    bestDelta = timeDelta
                    bestDistance = distance
                    bestIdx = i
                }
            }
        }

        if (bestIdx === -1) return

        const note = this.notes[bestIdx]

        // Handle hit circle
        if (note.type === 'circle') {
            const j = this.ctx.judge(this.segment.judgeRule, bestDelta)
            this.noteStates[bestIdx] = 'hit'
            this.ctx.scorer.add(j, 1, this.segment!.mode)
            this.lockNote(bestIdx, songMs) // Lock the note

            // Convert note position to screen coordinates for effect
            const screenX = this.playfieldOffsetX + note.x * this.playfieldScaleX
            const screenY = this.playfieldOffsetY + note.y * this.playfieldScaleY
            this.ctx.onJudgement?.(j, screenX, screenY)
        }
        // Handle slider head
        else if (note.type === 'slider') {
            const j = this.ctx.judge(this.segment.judgeRule, bestDelta)
            this.noteStates[bestIdx] = 'active'
            this.sliderStartTimes.set(bestIdx, songMs)
            this.sliderFollowPoints.set(bestIdx, 0)
            this.activeNotes.add(bestIdx)
            this.lockNote(bestIdx, songMs) // Lock the note

            // Don't add score yet - wait for slider completion
        }
    }

    handleTouchEnd(x: number, songMs: number): void {
        // No-op for hit circles
    }

    unmount(): void {
        // Force-judge all remaining pending notes as Miss
        for (let i = 0; i < this.noteStates.length; i++) {
            const state = this.noteStates[i]
            if (state === 'pending' || state === 'active') {
                this.noteStates[i] = 'missed'
                this.ctx.scorer.add(J.Miss, 1, this.segment!.mode)
            }
        }

        // Clear active notes
        this.activeNotes.clear()
    }

    isComplete(songMs: number): boolean {
        if (songMs < this.segment.endMs) return false

        // Check if all notes are judged
        return this.noteStates.every(
            (state) => state === 'hit' || state === 'missed' || state === 'done'
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

    private autoMiss(songMs: number): void {
        for (let i = 0; i < this.notes.length; i++) {
            if (this.noteStates[i] !== 'pending') continue

            const note = this.notes[i]
            if (note.type !== 'circle') continue

            // Auto-miss if note passed timing window
            if (songMs - note.time > MISS_WINDOW) {
                this.noteStates[i] = 'missed'
                this.ctx.scorer.add(J.Miss, 1, this.segment!.mode)

                const screenX = this.playfieldOffsetX + note.x * this.playfieldScaleX
                const screenY = this.playfieldOffsetY + note.y * this.playfieldScaleY
                this.ctx.onJudgement?.(J.Miss, screenX, screenY, relativeMs - note.time)
            }
        }

        // Auto-miss sliders that were never started
        for (let i = 0; i < this.notes.length; i++) {
            if (this.noteStates[i] !== 'pending') continue

            const note = this.notes[i]
            if (note.type !== 'slider') continue

            // Auto-miss if slider head passed timing window
            if (songMs - note.time > MISS_WINDOW) {
                this.noteStates[i] = 'missed'
                this.ctx.scorer.add(J.Miss, 1, this.segment!.mode)

                const screenX = this.playfieldOffsetX + note.x * this.playfieldScaleX
                const screenY = this.playfieldOffsetY + note.y * this.playfieldScaleY
                this.ctx.onJudgement?.(J.Miss, screenX, screenY, relativeMs - note.time)
            }
        }
    }

    private updateSliders(songMs: number): void {
        // Convert screen cursor to osu coordinates
        const osuX = (this.cursorX - this.playfieldOffsetX) / this.playfieldScaleX
        const osuY = (this.cursorY - this.playfieldOffsetY) / this.playfieldScaleY

        for (let i = 0; i < this.notes.length; i++) {
            if (this.noteStates[i] !== 'active') continue

            const note = this.notes[i]
            if (note.type !== 'slider' || !note.sliderPath || !note.endTime) continue

            const duration = note.endTime - note.time
            const elapsed = songMs - note.time
            const progress = Math.max(0, Math.min(1, elapsed / duration))

            // Get current position on slider path
            const sliderPos = this.getSliderPosition(note, progress)

            // Check if cursor is following the slider
            const dx = sliderPos.x - osuX
            const dy = sliderPos.y - osuY
            const distance = Math.sqrt(dx * dx + dy * dy)

            const osuRadius = 54.4 - 4.48 * this.segment.config.circleSize
            const followRadius = osuRadius * SLIDER_FOLLOW_RADIUS

            const isFollowing = distance <= followRadius

            // Update follow point
            if (isFollowing) {
                this.sliderFollowPoints.set(i, progress)
            }

            // Check if slider is complete
            if (songMs >= note.endTime) {
                const followPoint = this.sliderFollowPoints.get(i) || 0

                // Judge based on how well the player followed
                // If they followed to at least 80% of the slider, it's a hit
                let judgement: J
                if (followPoint >= 0.8) {
                    judgement = J.Great
                } else if (followPoint >= 0.5) {
                    judgement = J.Good
                } else {
                    judgement = J.Miss
                }

                this.noteStates[i] = 'done'
                this.activeNotes.delete(i)
                this.sliderStartTimes.delete(i)
                this.sliderFollowPoints.delete(i)
                this.ctx.scorer.add(judgement)

                const screenX = this.playfieldOffsetX + note.x * this.playfieldScaleX
                const screenY = this.playfieldOffsetY + note.y * this.playfieldScaleY
                this.ctx.onJudgement?.(judgement, screenX, screenY, relativeMs - note.time)
            }
        }
    }

    private updateSpinners(songMs: number): void {
        // Convert screen cursor to osu coordinates
        const osuX = (this.cursorX - this.playfieldOffsetX) / this.playfieldScaleX
        const osuY = (this.cursorY - this.playfieldOffsetY) / this.playfieldScaleY

        const centerX = 256 // Osu playfield center
        const centerY = 192

        for (let i = 0; i < this.notes.length; i++) {
            if (this.noteStates[i] !== 'active') continue

            const note = this.notes[i]
            if (note.type !== 'spinner' || !note.endTime) continue

            // Calculate current angle from center
            const currentAngle = Math.atan2(osuY - centerY, osuX - centerX)
            const lastAngle = this.spinnerLastAngle.get(i)

            if (lastAngle !== undefined) {
                // Calculate angle delta (handling wrap-around)
                let angleDelta = currentAngle - lastAngle

                // Normalize angle delta to [-PI, PI]
                while (angleDelta > Math.PI) angleDelta -= 2 * Math.PI
                while (angleDelta < -Math.PI) angleDelta += 2 * Math.PI

                // Accumulate rotation (in radians)
                const currentRotation = this.spinnerRotations.get(i) || 0
                this.spinnerRotations.set(i, currentRotation + Math.abs(angleDelta))
            }

            // Update last angle
            this.spinnerLastAngle.set(i, currentAngle)

            // Check if spinner is complete
            if (songMs >= note.endTime) {
                const totalRotations = (this.spinnerRotations.get(i) || 0) / (2 * Math.PI)
                const duration = note.endTime - note.time

                // Calculate required rotations based on duration
                // Typically 1-3 rotations depending on duration
                // Formula: 1 rotation per 1000ms, minimum 1, maximum 3
                const requiredRotations = Math.max(1, Math.min(3, duration / 1000))

                // Judge based on completion percentage
                let judgement: J
                if (totalRotations >= requiredRotations) {
                    judgement = J.Great
                } else if (totalRotations >= requiredRotations * 0.75) {
                    judgement = J.Good
                } else {
                    judgement = J.Miss
                }

                this.noteStates[i] = 'done'
                this.activeNotes.delete(i)
                this.spinnerStartTimes.delete(i)
                this.spinnerRotations.delete(i)
                this.spinnerLastAngle.delete(i)
                this.ctx.scorer.add(judgement)

                const screenX = this.playfieldOffsetX + centerX * this.playfieldScaleX
                const screenY = this.playfieldOffsetY + centerY * this.playfieldScaleY
                this.ctx.onJudgement?.(judgement, screenX, screenY, relativeMs - note.time)
            }
        }

        // Auto-miss spinners that were never started
        for (let i = 0; i < this.notes.length; i++) {
            if (this.noteStates[i] !== 'pending') continue

            const note = this.notes[i]
            if (note.type !== 'spinner' || !note.endTime) continue

            // Auto-miss if spinner ended without being activated
            if (songMs > note.endTime) {
                this.noteStates[i] = 'missed'
                this.ctx.scorer.add(J.Miss, 1, this.segment!.mode)

                const centerX = 256
                const centerY = 192
                const screenX = this.playfieldOffsetX + centerX * this.playfieldScaleX
                const screenY = this.playfieldOffsetY + centerY * this.playfieldScaleY
                this.ctx.onJudgement?.(J.Miss, screenX, screenY, relativeMs - note.time)
            }
        }
    }

    private getSliderPosition(note: OsuNote, progress: number): { x: number; y: number } {
        if (!note.sliderPath) {
            return { x: note.x, y: note.y }
        }

        const path = note.sliderPath
        const totalSlides = path.slides

        // Calculate which slide we're on and position within that slide
        const slideProgress = progress * totalSlides
        const slideIndex = Math.floor(slideProgress)
        const slideT = slideProgress - slideIndex

        // Reverse direction on odd slides
        const t = (slideIndex % 2 === 0) ? slideT : (1 - slideT)

        // Get position based on path type
        switch (path.type) {
            case 'L': // Linear
                return this.getLinearPosition(path.points, t)
            case 'P': // Perfect circle
                return this.getPerfectCirclePosition(path.points, t)
            case 'B': // Bezier
                return this.getBezierPosition(path.points, t)
            case 'C': // Catmull
                return this.getCatmullPosition(path.points, t)
            default:
                return { x: note.x, y: note.y }
        }
    }

    private getLinearPosition(points: { x: number; y: number }[], t: number): { x: number; y: number } {
        if (points.length < 2) return points[0] || { x: 0, y: 0 }

        // Calculate total length
        let totalLength = 0
        const lengths: number[] = []
        for (let i = 0; i < points.length - 1; i++) {
            const dx = points[i + 1].x - points[i].x
            const dy = points[i + 1].y - points[i].y
            const len = Math.sqrt(dx * dx + dy * dy)
            lengths.push(len)
            totalLength += len
        }

        // Find segment at position t
        const targetLength = t * totalLength
        let accumulatedLength = 0

        for (let i = 0; i < lengths.length; i++) {
            if (accumulatedLength + lengths[i] >= targetLength) {
                const segmentT = (targetLength - accumulatedLength) / lengths[i]
                const p1 = points[i]
                const p2 = points[i + 1]
                return {
                    x: p1.x + (p2.x - p1.x) * segmentT,
                    y: p1.y + (p2.y - p1.y) * segmentT
                }
            }
            accumulatedLength += lengths[i]
        }

        return points[points.length - 1]
    }

    private getPerfectCirclePosition(points: { x: number; y: number }[], t: number): { x: number; y: number } {
        if (points.length < 3) return this.getLinearPosition(points, t)

        // For simplicity, use linear interpolation for now
        // A proper implementation would calculate the circle center and radius
        return this.getLinearPosition(points, t)
    }

    private getBezierPosition(points: { x: number; y: number }[], t: number): { x: number; y: number } {
        if (points.length < 2) return points[0] || { x: 0, y: 0 }

        // Simple quadratic Bezier for 3 points, linear for 2 points
        if (points.length === 2) {
            return this.getLinearPosition(points, t)
        } else if (points.length === 3) {
            const p0 = points[0]
            const p1 = points[1]
            const p2 = points[2]
            const mt = 1 - t
            return {
                x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
                y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y
            }
        } else {
            // For more points, use recursive De Casteljau's algorithm
            const newPoints: { x: number; y: number }[] = []
            for (let i = 0; i < points.length - 1; i++) {
                newPoints.push({
                    x: points[i].x + (points[i + 1].x - points[i].x) * t,
                    y: points[i].y + (points[i + 1].y - points[i].y) * t
                })
            }
            return this.getBezierPosition(newPoints, t)
        }
    }

    private getCatmullPosition(points: { x: number; y: number }[], t: number): { x: number; y: number } {
        if (points.length < 2) return points[0] || { x: 0, y: 0 }

        // For simplicity, use linear interpolation for now
        // A proper implementation would use Catmull-Rom spline
        return this.getLinearPosition(points, t)
    }

    private render(songMs: number): void {
        const { ctx2d: c, area } = this.ctx

        // Background
        c.fillStyle = '#1a1a2e'
        c.fillRect(area.x, area.y, area.w, area.h)

        // Playfield border
        c.strokeStyle = '#444'
        c.lineWidth = 2
        c.strokeRect(
            this.playfieldOffsetX,
            this.playfieldOffsetY,
            OSU_PLAYFIELD_WIDTH * this.playfieldScaleX,
            OSU_PLAYFIELD_HEIGHT * this.playfieldScaleY
        )

        // Render notes
        for (let i = 0; i < this.notes.length; i++) {
            const note = this.notes[i]
            const state = this.noteStates[i]

            if (state === 'hit' || state === 'missed' || state === 'done') continue

            if (note.type === 'circle') {
                this.renderHitCircle(c, note, songMs)
            } else if (note.type === 'slider') {
                this.renderSlider(c, note, songMs, state === 'active')
            } else if (note.type === 'spinner') {
                this.renderSpinner(c, note, songMs, state === 'active', i)
            }
        }

        // Mode label
        c.fillStyle = '#666'
        c.font = '14px "Segoe UI", sans-serif'
        c.textAlign = 'left'
        c.fillText('OSU!STANDARD', area.x + 10, area.y + 20)
    }

    private renderHitCircle(c: CanvasRenderingContext2D, note: OsuNote, songMs: number): void {
        // Convert osu coordinates to screen coordinates
        const x = this.playfieldOffsetX + note.x * this.playfieldScaleX
        const y = this.playfieldOffsetY + note.y * this.playfieldScaleY

        // Calculate approach circle progress based on approachRate
        // AR defines how long before the note time the approach circle appears
        // AR 5 = 1200ms, AR 9 = 450ms (simplified formula)
        const ar = this.segment.config.approachRate
        const approachTime = ar < 5
            ? 1800 - ar * 120  // AR 0-5: 1800ms to 1200ms
            : 1200 - (ar - 5) * 150  // AR 5-10: 1200ms to 450ms

        const timeUntilHit = note.time - songMs

        // Don't render if too far in the future
        if (timeUntilHit > approachTime) return

        // Don't render if already passed
        if (timeUntilHit < -MISS_WINDOW) return

        // Approach circle scale (starts at 3x, shrinks to 1x)
        const approachProgress = 1 - (timeUntilHit / approachTime)
        const approachScale = 3 - 2 * Math.max(0, Math.min(1, approachProgress))

        // Hit circle
        c.fillStyle = '#ffffff'
        c.beginPath()
        c.arc(x, y, this.hitCircleRadius, 0, Math.PI * 2)
        c.fill()

        // Hit circle border
        c.strokeStyle = '#ff6666'
        c.lineWidth = 3
        c.beginPath()
        c.arc(x, y, this.hitCircleRadius, 0, Math.PI * 2)
        c.stroke()

        // Approach circle (only if note hasn't been hit yet)
        if (timeUntilHit > 0) {
            c.strokeStyle = '#ffffff'
            c.lineWidth = 2
            c.globalAlpha = Math.max(0.3, 1 - approachProgress)
            c.beginPath()
            c.arc(x, y, this.hitCircleRadius * approachScale, 0, Math.PI * 2)
            c.stroke()
            c.globalAlpha = 1.0
        }

        // Hit circle number (optional, for visual clarity)
        c.fillStyle = '#000000'
        c.font = `bold ${this.hitCircleRadius * 0.8}px "Segoe UI", sans-serif`
        c.textAlign = 'center'
        c.textBaseline = 'middle'
        const noteIndex = this.notes.indexOf(note) + 1
        c.fillText(String(noteIndex), x, y)
    }

    private renderSlider(c: CanvasRenderingContext2D, note: OsuNote, songMs: number, isActive: boolean): void {
        if (!note.sliderPath || !note.endTime) return

        // Calculate approach circle progress
        const ar = this.segment.config.approachRate
        const approachTime = ar < 5
            ? 1800 - ar * 120
            : 1200 - (ar - 5) * 150

        const timeUntilHit = note.time - songMs

        // Don't render if too far in the future
        if (timeUntilHit > approachTime) return

        // Render slider path
        this.renderSliderPath(c, note)

        // Render slider head (start circle)
        const headX = this.playfieldOffsetX + note.x * this.playfieldScaleX
        const headY = this.playfieldOffsetY + note.y * this.playfieldScaleY

        if (!isActive) {
            // Render approach circle for slider head
            if (timeUntilHit > 0) {
                const approachProgress = 1 - (timeUntilHit / approachTime)
                const approachScale = 3 - 2 * Math.max(0, Math.min(1, approachProgress))

                c.strokeStyle = '#ffffff'
                c.lineWidth = 2
                c.globalAlpha = Math.max(0.3, 1 - approachProgress)
                c.beginPath()
                c.arc(headX, headY, this.hitCircleRadius * approachScale, 0, Math.PI * 2)
                c.stroke()
                c.globalAlpha = 1.0
            }

            // Slider head circle
            c.fillStyle = '#ffffff'
            c.beginPath()
            c.arc(headX, headY, this.hitCircleRadius, 0, Math.PI * 2)
            c.fill()

            c.strokeStyle = '#ff6666'
            c.lineWidth = 3
            c.beginPath()
            c.arc(headX, headY, this.hitCircleRadius, 0, Math.PI * 2)
            c.stroke()
        }

        // Render follow point if slider is active
        if (isActive) {
            const duration = note.endTime - note.time
            const elapsed = songMs - note.time
            const progress = Math.max(0, Math.min(1, elapsed / duration))

            const followPos = this.getSliderPosition(note, progress)
            const followX = this.playfieldOffsetX + followPos.x * this.playfieldScaleX
            const followY = this.playfieldOffsetY + followPos.y * this.playfieldScaleY

            // Follow circle
            c.fillStyle = '#ffffff'
            c.globalAlpha = 0.5
            c.beginPath()
            c.arc(followX, followY, this.hitCircleRadius, 0, Math.PI * 2)
            c.fill()
            c.globalAlpha = 1.0

            c.strokeStyle = '#66ff66'
            c.lineWidth = 3
            c.beginPath()
            c.arc(followX, followY, this.hitCircleRadius, 0, Math.PI * 2)
            c.stroke()
        }
    }

    private renderSliderPath(c: CanvasRenderingContext2D, note: OsuNote): void {
        if (!note.sliderPath) return

        const path = note.sliderPath
        const points = path.points

        if (points.length < 2) return

        // Draw slider body
        c.strokeStyle = '#ffffff'
        c.lineWidth = this.hitCircleRadius * 2
        c.lineCap = 'round'
        c.lineJoin = 'round'
        c.globalAlpha = 0.6

        c.beginPath()

        // Sample the path at multiple points for smooth rendering
        const samples = 50
        for (let i = 0; i <= samples; i++) {
            const t = i / samples
            const pos = this.getSliderPathPosition(note, t)
            const screenX = this.playfieldOffsetX + pos.x * this.playfieldScaleX
            const screenY = this.playfieldOffsetY + pos.y * this.playfieldScaleY

            if (i === 0) {
                c.moveTo(screenX, screenY)
            } else {
                c.lineTo(screenX, screenY)
            }
        }

        c.stroke()
        c.globalAlpha = 1.0

        // Draw slider end point
        const endPos = this.getSliderPathPosition(note, 1)
        const endX = this.playfieldOffsetX + endPos.x * this.playfieldScaleX
        const endY = this.playfieldOffsetY + endPos.y * this.playfieldScaleY

        c.fillStyle = '#ffffff'
        c.beginPath()
        c.arc(endX, endY, this.hitCircleRadius * 0.5, 0, Math.PI * 2)
        c.fill()
    }

    private getSliderPathPosition(note: OsuNote, t: number): { x: number; y: number } {
        if (!note.sliderPath) {
            return { x: note.x, y: note.y }
        }

        const path = note.sliderPath

        // Get position based on path type (without slide repeats)
        switch (path.type) {
            case 'L': // Linear
                return this.getLinearPosition(path.points, t)
            case 'P': // Perfect circle
                return this.getPerfectCirclePosition(path.points, t)
            case 'B': // Bezier
                return this.getBezierPosition(path.points, t)
            case 'C': // Catmull
                return this.getCatmullPosition(path.points, t)
            default:
                return { x: note.x, y: note.y }
        }
    }

    private renderSpinner(c: CanvasRenderingContext2D, note: OsuNote, songMs: number, isActive: boolean, noteIndex: number): void {
        if (!note.endTime) return

        const centerX = 256 // Osu playfield center
        const centerY = 192
        const screenX = this.playfieldOffsetX + centerX * this.playfieldScaleX
        const screenY = this.playfieldOffsetY + centerY * this.playfieldScaleY

        // Calculate spinner progress
        const duration = note.endTime - note.time
        const elapsed = Math.max(0, songMs - note.time)
        const progress = Math.min(1, elapsed / duration)

        // Calculate required rotations
        const requiredRotations = Math.max(1, Math.min(3, duration / 1000))
        const currentRotations = (this.spinnerRotations.get(noteIndex) || 0) / (2 * Math.PI)
        const rotationProgress = Math.min(1, currentRotations / requiredRotations)

        // Spinner circle radius
        const spinnerRadius = 100 * Math.min(this.playfieldScaleX, this.playfieldScaleY)

        // Background circle
        c.fillStyle = isActive ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)'
        c.beginPath()
        c.arc(screenX, screenY, spinnerRadius, 0, Math.PI * 2)
        c.fill()

        // Spinner border
        c.strokeStyle = isActive ? '#ffffff' : '#888888'
        c.lineWidth = 3
        c.beginPath()
        c.arc(screenX, screenY, spinnerRadius, 0, Math.PI * 2)
        c.stroke()

        // Progress indicator (arc showing completion)
        if (isActive) {
            c.strokeStyle = rotationProgress >= 1 ? '#66ff66' : '#ffaa00'
            c.lineWidth = 8
            c.beginPath()
            c.arc(screenX, screenY, spinnerRadius - 10, -Math.PI / 2, -Math.PI / 2 + rotationProgress * 2 * Math.PI)
            c.stroke()
        }

        // Rotation indicator (spinning line)
        const rotationAngle = (this.spinnerRotations.get(noteIndex) || 0)
        const indicatorLength = spinnerRadius * 0.7
        const indicatorX = screenX + Math.cos(rotationAngle) * indicatorLength
        const indicatorY = screenY + Math.sin(rotationAngle) * indicatorLength

        c.strokeStyle = isActive ? '#ffffff' : '#666666'
        c.lineWidth = 4
        c.beginPath()
        c.moveTo(screenX, screenY)
        c.lineTo(indicatorX, indicatorY)
        c.stroke()

        // Center dot
        c.fillStyle = isActive ? '#ffffff' : '#888888'
        c.beginPath()
        c.arc(screenX, screenY, 5, 0, Math.PI * 2)
        c.fill()

        // Display rotation count
        if (isActive) {
            c.fillStyle = '#ffffff'
            c.font = 'bold 24px "Segoe UI", sans-serif'
            c.textAlign = 'center'
            c.textBaseline = 'middle'
            c.fillText(`${currentRotations.toFixed(1)} / ${requiredRotations.toFixed(0)}`, screenX, screenY + spinnerRadius + 30)

            // Display "SPIN!" text
            c.font = 'bold 32px "Segoe UI", sans-serif'
            c.fillText('SPIN!', screenX, screenY)
        } else {
            // Display time until spinner starts
            const timeUntil = note.time - songMs
            if (timeUntil > 0 && timeUntil < 2000) {
                c.fillStyle = '#ffffff'
                c.font = 'bold 20px "Segoe UI", sans-serif'
                c.textAlign = 'center'
                c.textBaseline = 'middle'
                c.fillText('SPINNER', screenX, screenY)
            }
        }

        // Time remaining indicator
        if (isActive) {
            const timeRemaining = note.endTime - songMs
            const timeRemainingSeconds = Math.max(0, timeRemaining / 1000)

            c.fillStyle = timeRemaining < 1000 ? '#ff6666' : '#ffffff'
            c.font = '16px "Segoe UI", sans-serif'
            c.textAlign = 'center'
            c.textBaseline = 'middle'
            c.fillText(`${timeRemainingSeconds.toFixed(1)}s`, screenX, screenY - spinnerRadius - 20)
        }
    }
}
