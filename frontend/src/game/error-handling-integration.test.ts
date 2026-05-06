/**
 * Integration tests for error handling
 * Requirement 12.5: Add error handling and user feedback
 */

import { describe, test, expect } from 'vitest'
import { ChartParserImpl } from './parser'
import { ChartValidatorImpl } from './validator'
import { formatParseError, formatValidationReport, hasCriticalErrors } from './error-handler'

describe('Error Handling Integration', () => {
  const parser = new ChartParserImpl()
  const validator = new ChartValidatorImpl()
  
  describe('Parse error handling', () => {
    test('handles invalid JSON with descriptive error', () => {
      const invalidJson = '{ invalid json }'
      
      const result = parser.parseJSON(invalidJson)
      
      expect(result.ok).toBe(false)
      if (!result.ok) {
        // Parser returns ParseError directly, not ChartError
        const errorMsg = formatParseError(result.error)
        expect(errorMsg).toContain('语法错误')
        expect(errorMsg.length).toBeGreaterThan(0)
      }
    })
    
    test('handles missing required fields with descriptive error', () => {
      const invalidChart = JSON.stringify({
        meta: {
          title: 'Test'
          // Missing artist, audio, length
        },
        segments: []
      })
      
      const result = parser.parseJSON(invalidChart)
      
      expect(result.ok).toBe(false)
      if (!result.ok) {
        // Parser returns ParseError directly, not ChartError
        const errorMsg = formatParseError(result.error)
        expect(errorMsg.length).toBeGreaterThan(0)
      }
    })
  })
  
  describe('Validation error handling', () => {
    test('handles segment overlap with descriptive error', () => {
      const chart = {
        meta: {
          title: 'Test',
          artist: 'Test',
          audio: 'test.mp3',
          length: 10000
        },
        segments: [
          {
            id: 's1',
            startMs: 0,
            endMs: 5000,
            mode: 'mania' as const,
            judgeRule: 'mania-od8' as const,
            config: { keys: ['d', 'f', 'j', 'k'], scrollSpeed: 1.0 },
            notes: []
          },
          {
            id: 's2',
            startMs: 4000, // Overlaps with s1
            endMs: 8000,
            mode: 'taiko' as const,
            judgeRule: 'taiko-od8' as const,
            config: { donKeys: ['d', 'f'], kaKeys: ['j', 'k'], scrollSpeed: 1.0 },
            notes: []
          }
        ]
      }
      
      const errors = validator.validate(chart)
      
      expect(errors.length).toBeGreaterThan(0)
      expect(errors.some(e => e.type === 'overlap')).toBe(true)
      
      const report = formatValidationReport(errors)
      expect(report).toContain('片段重叠')
      expect(report).toContain('s1')
      expect(report).toContain('s2')
    })
    
    test('handles segment gap with warning', () => {
      const chart = {
        meta: {
          title: 'Test',
          artist: 'Test',
          audio: 'test.mp3',
          length: 10000
        },
        segments: [
          {
            id: 's1',
            startMs: 0,
            endMs: 3000,
            mode: 'mania' as const,
            judgeRule: 'mania-od8' as const,
            config: { keys: ['d', 'f', 'j', 'k'], scrollSpeed: 1.0 },
            notes: []
          },
          {
            id: 's2',
            startMs: 4000, // 1000ms gap
            endMs: 8000,
            mode: 'taiko' as const,
            judgeRule: 'taiko-od8' as const,
            config: { donKeys: ['d', 'f'], kaKeys: ['j', 'k'], scrollSpeed: 1.0 },
            notes: []
          }
        ]
      }
      
      const errors = validator.validate(chart)
      
      expect(errors.length).toBeGreaterThan(0)
      expect(errors.some(e => e.type === 'gap')).toBe(true)
      expect(hasCriticalErrors(errors)).toBe(false) // Gaps are warnings, not critical
      
      const report = formatValidationReport(errors)
      expect(report).toContain('片段间隙')
      expect(report).toContain('1000ms')
    })
    
    test('handles timing errors with descriptive error', () => {
      const chart = {
        meta: {
          title: 'Test',
          artist: 'Test',
          audio: 'test.mp3',
          length: 10000
        },
        segments: [
          {
            id: 's1',
            startMs: -100, // Negative start time
            endMs: 5000,
            mode: 'mania' as const,
            judgeRule: 'mania-od8' as const,
            config: { keys: ['d', 'f', 'j', 'k'], scrollSpeed: 1.0 },
            notes: []
          }
        ]
      }
      
      const errors = validator.validate(chart)
      
      expect(errors.length).toBeGreaterThan(0)
      expect(errors.some(e => e.type === 'timing')).toBe(true)
      expect(hasCriticalErrors(errors)).toBe(true) // Timing errors are critical
      
      const report = formatValidationReport(errors)
      expect(report).toContain('时间错误')
      expect(report).toContain('s1')
    })
    
    test('handles config errors with descriptive error', () => {
      const chart = {
        meta: {
          title: 'Test',
          artist: 'Test',
          audio: 'test.mp3',
          length: 10000
        },
        segments: [
          {
            id: 's1',
            startMs: 0,
            endMs: 5000,
            mode: 'mania' as const,
            judgeRule: 'mania-od8' as const,
            config: { keys: [], scrollSpeed: 1.0 }, // Empty keys array
            notes: []
          }
        ]
      }
      
      const errors = validator.validate(chart)
      
      expect(errors.length).toBeGreaterThan(0)
      expect(errors.some(e => e.type === 'config')).toBe(true)
      expect(hasCriticalErrors(errors)).toBe(true) // Config errors are critical
      
      const report = formatValidationReport(errors)
      expect(report).toContain('配置错误')
      expect(report).toContain('s1')
    })
  })
  
  describe('Multiple error handling', () => {
    test('handles multiple errors with grouped report', () => {
      const chart = {
        meta: {
          title: 'Test',
          artist: 'Test',
          audio: 'test.mp3',
          length: 10000
        },
        segments: [
          {
            id: 's1',
            startMs: -100, // Timing error
            endMs: 5000,
            mode: 'mania' as const,
            judgeRule: 'mania-od8' as const,
            config: { keys: [], scrollSpeed: 1.0 }, // Config error
            notes: []
          },
          {
            id: 's2',
            startMs: 4000, // Overlap with s1
            endMs: 8000,
            mode: 'taiko' as const,
            judgeRule: 'taiko-od8' as const,
            config: { donKeys: ['d', 'f'], kaKeys: ['j', 'k'], scrollSpeed: 1.0 },
            notes: []
          }
        ]
      }
      
      const errors = validator.validate(chart)
      
      expect(errors.length).toBeGreaterThan(2)
      expect(hasCriticalErrors(errors)).toBe(true)
      
      const report = formatValidationReport(errors)
      expect(report).toContain('发现')
      expect(report).toContain('个验证错误')
      
      // Should contain all error types
      expect(report).toContain('时间错误')
      expect(report).toContain('配置错误')
      expect(report).toContain('片段重叠')
    })
  })
  
  describe('Valid chart handling', () => {
    test('passes validation for valid chart', () => {
      const chart = {
        meta: {
          title: 'Test',
          artist: 'Test',
          audio: 'test.mp3',
          length: 10000
        },
        segments: [
          {
            id: 's1',
            startMs: 0,
            endMs: 5000,
            mode: 'mania' as const,
            judgeRule: 'mania-od8' as const,
            config: { keys: ['d', 'f', 'j', 'k'], scrollSpeed: 1.0 },
            notes: []
          },
          {
            id: 's2',
            startMs: 5000,
            endMs: 10000,
            mode: 'taiko' as const,
            judgeRule: 'taiko-od8' as const,
            config: { donKeys: ['d', 'f'], kaKeys: ['j', 'k'], scrollSpeed: 1.0 },
            notes: []
          }
        ]
      }
      
      const errors = validator.validate(chart)
      
      expect(errors.length).toBe(0)
      expect(hasCriticalErrors(errors)).toBe(false)
      
      const report = formatValidationReport(errors)
      expect(report).toBe('谱面验证通过')
    })
  })
})
