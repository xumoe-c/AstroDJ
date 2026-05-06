import { describe, test, expect } from 'vitest'
import { ChartValidatorImpl } from './validator'
import type { Chart, ManiaSegment, TaikoSegment, OsuStandardSegment } from './types'

describe('ChartValidatorImpl', () => {
    const validator = new ChartValidatorImpl()

    describe('valid charts', () => {
        test('validates chart with single segment', () => {
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
                        startMs: 0,
                        endMs: 10000,
                        mode: 'mania',
                        judgeRule: 'mania-od7',
                        config: {
                            keys: ['D', 'F', 'J', 'K'],
                            scrollSpeed: 1.0
                        },
                        notes: [
                            { lane: 0, time: 1000 },
                            { lane: 1, time: 5000 }
                        ]
                    }
                ]
            }

            const errors = validator.validate(chart)
            expect(errors).toHaveLength(0)
        })

        test('validates chart with multiple non-overlapping segments', () => {
            const chart: Chart = {
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 20000
                },
                segments: [
                    {
                        id: 'seg1',
                        startMs: 0,
                        endMs: 8000,
                        mode: 'mania',
                        judgeRule: 'mania-od7',
                        config: {
                            keys: ['D', 'F', 'J', 'K'],
                            scrollSpeed: 1.0
                        },
                        notes: [{ lane: 0, time: 1000 }]
                    },
                    {
                        id: 'seg2',
                        startMs: 8000,
                        endMs: 16000,
                        mode: 'taiko',
                        judgeRule: 'taiko-od7',
                        config: {
                            donKeys: ['D', 'F'],
                            kaKeys: ['J', 'K'],
                            scrollSpeed: 1.0
                        },
                        notes: [{ type: 'don' as const, time: 10000 }]
                    }
                ]
            }

            const errors = validator.validate(chart)
            expect(errors).toHaveLength(0)
        })

        test('validates chart with small gap (< 500ms)', () => {
            const chart: Chart = {
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 20000
                },
                segments: [
                    {
                        id: 'seg1',
                        startMs: 0,
                        endMs: 8000,
                        mode: 'mania',
                        judgeRule: 'mania-od7',
                        config: {
                            keys: ['D'],
                            scrollSpeed: 1.0
                        },
                        notes: []
                    },
                    {
                        id: 'seg2',
                        startMs: 8400, // 400ms gap
                        endMs: 16000,
                        mode: 'taiko',
                        judgeRule: 'taiko-od7',
                        config: {
                            donKeys: ['D'],
                            kaKeys: ['K'],
                            scrollSpeed: 1.0
                        },
                        notes: []
                    }
                ]
            }

            const errors = validator.validate(chart)
            expect(errors).toHaveLength(0)
        })
    })

    describe('timing validation', () => {
        test('detects negative start time', () => {
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
                        startMs: -100,
                        endMs: 10000,
                        mode: 'mania',
                        judgeRule: 'mania-od7',
                        config: {
                            keys: ['D'],
                            scrollSpeed: 1.0
                        },
                        notes: []
                    }
                ]
            }

            const errors = validator.validate(chart)
            expect(errors).toHaveLength(1)
            expect(errors[0].type).toBe('timing')
            expect(errors[0].message).toContain('negative start time')
            expect(errors[0].segmentId).toBe('seg1')
        })

        test('detects end time before start time', () => {
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
                        startMs: 5000,
                        endMs: 3000,
                        mode: 'mania',
                        judgeRule: 'mania-od7',
                        config: {
                            keys: ['D'],
                            scrollSpeed: 1.0
                        },
                        notes: []
                    }
                ]
            }

            const errors = validator.validate(chart)
            expect(errors).toHaveLength(1)
            expect(errors[0].type).toBe('timing')
            expect(errors[0].message).toContain('must be after start time')
            expect(errors[0].segmentId).toBe('seg1')
        })

        test('detects end time equal to start time', () => {
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
                        startMs: 5000,
                        endMs: 5000,
                        mode: 'mania',
                        judgeRule: 'mania-od7',
                        config: {
                            keys: ['D'],
                            scrollSpeed: 1.0
                        },
                        notes: []
                    }
                ]
            }

            const errors = validator.validate(chart)
            expect(errors).toHaveLength(1)
            expect(errors[0].type).toBe('timing')
            expect(errors[0].message).toContain('must be after start time')
        })
    })

    describe('segment ordering validation', () => {
        test('detects unordered segments', () => {
            const chart: Chart = {
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 20000
                },
                segments: [
                    {
                        id: 'seg2',
                        startMs: 10000,
                        endMs: 20000,
                        mode: 'mania',
                        judgeRule: 'mania-od7',
                        config: {
                            keys: ['D'],
                            scrollSpeed: 1.0
                        },
                        notes: []
                    },
                    {
                        id: 'seg1',
                        startMs: 0,
                        endMs: 8000,
                        mode: 'taiko',
                        judgeRule: 'taiko-od7',
                        config: {
                            donKeys: ['D'],
                            kaKeys: ['K'],
                            scrollSpeed: 1.0
                        },
                        notes: []
                    }
                ]
            }

            const errors = validator.validate(chart)
            expect(errors.some(e => e.type === 'timing' && e.message.includes('not ordered'))).toBe(true)
        })
    })

    describe('overlap detection', () => {
        test('detects segment overlap', () => {
            const chart: Chart = {
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 20000
                },
                segments: [
                    {
                        id: 'seg1',
                        startMs: 0,
                        endMs: 10000,
                        mode: 'mania',
                        judgeRule: 'mania-od7',
                        config: {
                            keys: ['D'],
                            scrollSpeed: 1.0
                        },
                        notes: []
                    },
                    {
                        id: 'seg2',
                        startMs: 8000, // Overlaps with seg1
                        endMs: 16000,
                        mode: 'taiko',
                        judgeRule: 'taiko-od7',
                        config: {
                            donKeys: ['D'],
                            kaKeys: ['K'],
                            scrollSpeed: 1.0
                        },
                        notes: []
                    }
                ]
            }

            const errors = validator.validate(chart)
            expect(errors.some(e => e.type === 'overlap')).toBe(true)
            const overlapError = errors.find(e => e.type === 'overlap')
            expect(overlapError?.message).toContain('seg1')
            expect(overlapError?.message).toContain('seg2')
        })
    })

    describe('gap detection', () => {
        test('detects gap exceeding 500ms', () => {
            const chart: Chart = {
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 20000
                },
                segments: [
                    {
                        id: 'seg1',
                        startMs: 0,
                        endMs: 8000,
                        mode: 'mania',
                        judgeRule: 'mania-od7',
                        config: {
                            keys: ['D'],
                            scrollSpeed: 1.0
                        },
                        notes: []
                    },
                    {
                        id: 'seg2',
                        startMs: 9000, // 1000ms gap
                        endMs: 16000,
                        mode: 'taiko',
                        judgeRule: 'taiko-od7',
                        config: {
                            donKeys: ['D'],
                            kaKeys: ['K'],
                            scrollSpeed: 1.0
                        },
                        notes: []
                    }
                ]
            }

            const errors = validator.validate(chart)
            expect(errors.some(e => e.type === 'gap')).toBe(true)
            const gapError = errors.find(e => e.type === 'gap')
            expect(gapError?.message).toContain('1000ms')
            expect(gapError?.message).toContain('exceeds 500ms')
        })

        test('does not report gap at exactly 500ms', () => {
            const chart: Chart = {
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 20000
                },
                segments: [
                    {
                        id: 'seg1',
                        startMs: 0,
                        endMs: 8000,
                        mode: 'mania',
                        judgeRule: 'mania-od7',
                        config: {
                            keys: ['D'],
                            scrollSpeed: 1.0
                        },
                        notes: []
                    },
                    {
                        id: 'seg2',
                        startMs: 8500, // Exactly 500ms gap
                        endMs: 16000,
                        mode: 'taiko',
                        judgeRule: 'taiko-od7',
                        config: {
                            donKeys: ['D'],
                            kaKeys: ['K'],
                            scrollSpeed: 1.0
                        },
                        notes: []
                    }
                ]
            }

            const errors = validator.validate(chart)
            expect(errors.some(e => e.type === 'gap')).toBe(false)
        })
    })

    describe('note boundary validation', () => {
        test('detects note before segment start', () => {
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
                        startMs: 1000,
                        endMs: 10000,
                        mode: 'mania',
                        judgeRule: 'mania-od7',
                        config: {
                            keys: ['D'],
                            scrollSpeed: 1.0
                        },
                        notes: [
                            { lane: 0, time: 500 } // Before segment start
                        ]
                    }
                ]
            }

            const errors = validator.validate(chart)
            expect(errors.some(e => e.type === 'note')).toBe(true)
            const noteError = errors.find(e => e.type === 'note')
            expect(noteError?.message).toContain('outside segment bounds')
            expect(noteError?.noteIndex).toBe(0)
        })

        test('detects note after segment end', () => {
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
                        startMs: 0,
                        endMs: 8000,
                        mode: 'mania',
                        judgeRule: 'mania-od7',
                        config: {
                            keys: ['D'],
                            scrollSpeed: 1.0
                        },
                        notes: [
                            { lane: 0, time: 9000 } // After segment end
                        ]
                    }
                ]
            }

            const errors = validator.validate(chart)
            expect(errors.some(e => e.type === 'note')).toBe(true)
        })

        test('accepts notes at segment boundaries', () => {
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
                        startMs: 1000,
                        endMs: 8000,
                        mode: 'mania',
                        judgeRule: 'mania-od7',
                        config: {
                            keys: ['D'],
                            scrollSpeed: 1.0
                        },
                        notes: [
                            { lane: 0, time: 1000 }, // At start
                            { lane: 0, time: 8000 }  // At end
                        ]
                    }
                ]
            }

            const errors = validator.validate(chart)
            expect(errors.some(e => e.type === 'note')).toBe(false)
        })
    })

    describe('mode-specific config validation', () => {
        describe('mania', () => {
            test('detects too few keys (0)', () => {
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
                            startMs: 0,
                            endMs: 10000,
                            mode: 'mania',
                            judgeRule: 'mania-od7',
                            config: {
                                keys: [],
                                scrollSpeed: 1.0
                            },
                            notes: []
                        }
                    ]
                }

                const errors = validator.validate(chart)
                expect(errors.some(e => e.type === 'config' && e.message.includes('1-10'))).toBe(true)
            })

            test('detects too many keys (11)', () => {
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
                            startMs: 0,
                            endMs: 10000,
                            mode: 'mania',
                            judgeRule: 'mania-od7',
                            config: {
                                keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'A'],
                                scrollSpeed: 1.0
                            },
                            notes: []
                        }
                    ]
                }

                const errors = validator.validate(chart)
                expect(errors.some(e => e.type === 'config' && e.message.includes('1-10'))).toBe(true)
            })

            test('accepts valid key counts (1-10)', () => {
                for (let keyCount = 1; keyCount <= 10; keyCount++) {
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
                                startMs: 0,
                                endMs: 10000,
                                mode: 'mania',
                                judgeRule: 'mania-od7',
                                config: {
                                    keys: Array(keyCount).fill('K'),
                                    scrollSpeed: 1.0
                                },
                                notes: []
                            }
                        ]
                    }

                    const errors = validator.validate(chart)
                    expect(errors.some(e => e.type === 'config')).toBe(false)
                }
            })
        })

        describe('taiko', () => {
            test('detects missing don keys', () => {
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
                            startMs: 0,
                            endMs: 10000,
                            mode: 'taiko',
                            judgeRule: 'taiko-od7',
                            config: {
                                donKeys: [],
                                kaKeys: ['J', 'K'],
                                scrollSpeed: 1.0
                            },
                            notes: []
                        }
                    ]
                }

                const errors = validator.validate(chart)
                expect(errors.some(e => e.type === 'config' && e.message.includes('don key'))).toBe(true)
            })

            test('detects missing ka keys', () => {
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
                            startMs: 0,
                            endMs: 10000,
                            mode: 'taiko',
                            judgeRule: 'taiko-od7',
                            config: {
                                donKeys: ['D', 'F'],
                                kaKeys: [],
                                scrollSpeed: 1.0
                            },
                            notes: []
                        }
                    ]
                }

                const errors = validator.validate(chart)
                expect(errors.some(e => e.type === 'config' && e.message.includes('ka key'))).toBe(true)
            })

            test('accepts valid taiko config', () => {
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
                            startMs: 0,
                            endMs: 10000,
                            mode: 'taiko',
                            judgeRule: 'taiko-od7',
                            config: {
                                donKeys: ['D'],
                                kaKeys: ['K'],
                                scrollSpeed: 1.0
                            },
                            notes: []
                        }
                    ]
                }

                const errors = validator.validate(chart)
                expect(errors.some(e => e.type === 'config')).toBe(false)
            })
        })

        describe('osu-standard', () => {
            test('detects circleSize below 0', () => {
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
                            startMs: 0,
                            endMs: 10000,
                            mode: 'osu-standard',
                            judgeRule: 'osu-od8',
                            config: {
                                circleSize: -1,
                                approachRate: 9,
                                scrollSpeed: 1.0
                            },
                            notes: []
                        }
                    ]
                }

                const errors = validator.validate(chart)
                expect(errors.some(e => e.type === 'config' && e.message.includes('0-10'))).toBe(true)
            })

            test('detects circleSize above 10', () => {
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
                            startMs: 0,
                            endMs: 10000,
                            mode: 'osu-standard',
                            judgeRule: 'osu-od8',
                            config: {
                                circleSize: 11,
                                approachRate: 9,
                                scrollSpeed: 1.0
                            },
                            notes: []
                        }
                    ]
                }

                const errors = validator.validate(chart)
                expect(errors.some(e => e.type === 'config' && e.message.includes('0-10'))).toBe(true)
            })

            test('accepts valid circleSize (0-10)', () => {
                for (let cs = 0; cs <= 10; cs++) {
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
                                startMs: 0,
                                endMs: 10000,
                                mode: 'osu-standard',
                                judgeRule: 'osu-od8',
                                config: {
                                    circleSize: cs,
                                    approachRate: 9,
                                    scrollSpeed: 1.0
                                },
                                notes: []
                            }
                        ]
                    }

                    const errors = validator.validate(chart)
                    expect(errors.some(e => e.type === 'config')).toBe(false)
                }
            })
        })
    })

    describe('comprehensive error reporting', () => {
        test('returns all validation errors in single report', () => {
            const chart: Chart = {
                meta: {
                    title: 'Test',
                    artist: 'Test',
                    audio: 'test.mp3',
                    length: 20000
                },
                segments: [
                    {
                        id: 'seg1',
                        startMs: -100, // Error: negative start
                        endMs: 8000,
                        mode: 'mania',
                        judgeRule: 'mania-od7',
                        config: {
                            keys: [], // Error: no keys
                            scrollSpeed: 1.0
                        },
                        notes: [
                            { lane: 0, time: 9000 } // Error: note outside bounds
                        ]
                    },
                    {
                        id: 'seg2',
                        startMs: 7000, // Error: overlaps with seg1
                        endMs: 16000,
                        mode: 'taiko',
                        judgeRule: 'taiko-od7',
                        config: {
                            donKeys: [],  // Error: no don keys
                            kaKeys: ['K'],
                            scrollSpeed: 1.0
                        },
                        notes: []
                    }
                ]
            }

            const errors = validator.validate(chart)
            
            // Should have multiple errors
            expect(errors.length).toBeGreaterThan(1)
            
            // Check that different error types are present
            const errorTypes = new Set(errors.map(e => e.type))
            expect(errorTypes.size).toBeGreaterThan(1)
            
            // Verify specific errors
            expect(errors.some(e => e.type === 'timing' && e.message.includes('negative'))).toBe(true)
            expect(errors.some(e => e.type === 'config' && e.message.includes('keys'))).toBe(true)
            expect(errors.some(e => e.type === 'note')).toBe(true)
            expect(errors.some(e => e.type === 'overlap')).toBe(true)
        })
    })
})
