import { describe, it, expect } from 'vitest'
import { GlobalScorer, calculateTotalNotes } from './scorer'
import { Judgement, type Chart, type ManiaSegment, type TaikoSegment } from './types'

describe('GlobalScorer', () => {
    describe('calculateTotalNotes', () => {
        it('should count notes in a single mania segment', () => {
            const chart: Chart = {
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 10000
                },
                segments: [
                    {
                        id: 'seg1',
                        mode: 'mania',
                        startMs: 0,
                        endMs: 5000,
                        judgeRule: 'od7',
                        config: { keys: ['d', 'f', 'j', 'k'], scrollSpeed: 1 },
                        notes: [
                            { lane: 0, time: 1000 },
                            { lane: 1, time: 2000 },
                            { lane: 2, time: 3000 }
                        ]
                    } as ManiaSegment
                ]
            }

            expect(calculateTotalNotes(chart)).toBe(3)
        })

        it('should count notes across multiple segments', () => {
            const chart: Chart = {
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 10000
                },
                segments: [
                    {
                        id: 'seg1',
                        mode: 'mania',
                        startMs: 0,
                        endMs: 5000,
                        judgeRule: 'od7',
                        config: { keys: ['d', 'f', 'j', 'k'], scrollSpeed: 1 },
                        notes: [
                            { lane: 0, time: 1000 },
                            { lane: 1, time: 2000 }
                        ]
                    } as ManiaSegment,
                    {
                        id: 'seg2',
                        mode: 'taiko',
                        startMs: 5000,
                        endMs: 10000,
                        judgeRule: 'od7',
                        config: { donKeys: ['d', 'f'], kaKeys: ['j', 'k'], scrollSpeed: 1 },
                        notes: [
                            { type: 'don', time: 6000 },
                            { type: 'ka', time: 7000 },
                            { type: 'don', time: 8000 }
                        ]
                    } as TaikoSegment
                ]
            }

            expect(calculateTotalNotes(chart)).toBe(5)
        })

        it('should return 0 for chart with no segments', () => {
            const chart: Chart = {
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 10000
                },
                segments: []
            }

            expect(calculateTotalNotes(chart)).toBe(0)
        })

        it('should count long notes as single notes', () => {
            const chart: Chart = {
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 10000
                },
                segments: [
                    {
                        id: 'seg1',
                        mode: 'mania',
                        startMs: 0,
                        endMs: 5000,
                        judgeRule: 'od7',
                        config: { keys: ['d', 'f', 'j', 'k'], scrollSpeed: 1 },
                        notes: [
                            { lane: 0, time: 1000 },
                            { lane: 1, time: 2000, endTime: 3000 }, // Long note
                            { lane: 2, time: 3000 }
                        ]
                    } as ManiaSegment
                ]
            }

            expect(calculateTotalNotes(chart)).toBe(3)
        })
    })

    describe('reset', () => {
        it('should set totalNotes field when reset is called', () => {
            const scorer = new GlobalScorer()
            scorer.reset(100)

            expect(scorer.totalNotes).toBe(100)
        })

        it('should reset all other fields when reset is called', () => {
            const scorer = new GlobalScorer()
            scorer.combo = 10
            scorer.maxCombo = 15
            scorer.score = 5000
            scorer.counts[Judgement.Perfect] = 5

            scorer.reset(50)

            expect(scorer.combo).toBe(0)
            expect(scorer.maxCombo).toBe(0)
            expect(scorer.score).toBe(0)
            expect(scorer.counts[Judgement.Perfect]).toBe(0)
            expect(scorer.totalNotes).toBe(50)
        })
    })

    describe('accuracy calculation', () => {
        it('should calculate accuracy using all judgements from all segments', () => {
            const scorer = new GlobalScorer()

            // Simulate judgements from segment 1
            scorer.add(Judgement.Perfect)
            scorer.add(Judgement.Perfect)
            scorer.add(Judgement.Great)

            // Simulate judgements from segment 2
            scorer.add(Judgement.Good)
            scorer.add(Judgement.Ok)
            scorer.add(Judgement.Bad)

            // Simulate judgements from segment 3
            scorer.add(Judgement.Miss)
            scorer.add(Judgement.Perfect)

            // Total judgements: 8
            // Weighted sum: 2*300 + 1*300 + 1*200 + 1*100 + 1*50 + 1*0 + 1*300 = 1550
            // Expected accuracy: 1550 / (8 * 300) = 1550 / 2400 = 0.6458333...
            const expectedAccuracy = 1550 / 2400

            expect(scorer.accuracy).toBeCloseTo(expectedAccuracy, 6)
        })

        it('should use correct weights for each judgement type', () => {
            const scorer = new GlobalScorer()

            // Add one of each judgement type
            scorer.add(Judgement.Perfect)  // 300
            scorer.add(Judgement.Great)    // 300
            scorer.add(Judgement.Good)     // 200
            scorer.add(Judgement.Ok)       // 100
            scorer.add(Judgement.Bad)      // 50
            scorer.add(Judgement.Miss)     // 0

            // Total: 6 judgements
            // Weighted sum: 300 + 300 + 200 + 100 + 50 + 0 = 950
            // Expected accuracy: 950 / (6 * 300) = 950 / 1800 = 0.527777...
            const expectedAccuracy = 950 / 1800

            expect(scorer.accuracy).toBeCloseTo(expectedAccuracy, 6)
        })

        it('should return 1.0 accuracy for all perfect judgements', () => {
            const scorer = new GlobalScorer()

            scorer.add(Judgement.Perfect)
            scorer.add(Judgement.Perfect)
            scorer.add(Judgement.Perfect)

            expect(scorer.accuracy).toBe(1.0)
        })

        it('should return 0.0 accuracy for all miss judgements', () => {
            const scorer = new GlobalScorer()

            scorer.add(Judgement.Miss)
            scorer.add(Judgement.Miss)
            scorer.add(Judgement.Miss)

            expect(scorer.accuracy).toBe(0.0)
        })

        it('should return 1.0 accuracy when no judgements have been made', () => {
            const scorer = new GlobalScorer()

            expect(scorer.accuracy).toBe(1.0)
        })

        it('should calculate accuracy correctly with mixed judgements across multiple segments', () => {
            const scorer = new GlobalScorer()

            // Segment 1: 5 perfect notes
            for (let i = 0; i < 5; i++) {
                scorer.add(Judgement.Perfect)
            }

            // Segment 2: 3 great, 2 good
            for (let i = 0; i < 3; i++) {
                scorer.add(Judgement.Great)
            }
            for (let i = 0; i < 2; i++) {
                scorer.add(Judgement.Good)
            }

            // Segment 3: 1 ok, 1 bad, 1 miss
            scorer.add(Judgement.Ok)
            scorer.add(Judgement.Bad)
            scorer.add(Judgement.Miss)

            // Total: 13 judgements
            // Weighted: 5*300 + 3*300 + 2*200 + 1*100 + 1*50 + 1*0 = 2950
            // Expected: 2950 / (13 * 300) = 2950 / 3900 = 0.756410...
            const expectedAccuracy = 2950 / 3900

            expect(scorer.accuracy).toBeCloseTo(expectedAccuracy, 6)
        })
    })
})
