import { describe, test, expect } from 'vitest'
import {
  formatParseError,
  formatValidationError,
  formatChartError,
  formatValidationReport,
  getErrorSeverity,
  hasCriticalErrors
} from './error-handler'
import type { ParseError, ValidationError, ChartError } from './types'

describe('Error Handler', () => {
  describe('formatParseError', () => {
    test('formats syntax error with line number', () => {
      const error: ParseError = {
        type: 'syntax',
        message: 'Unexpected token',
        line: 42
      }
      
      const formatted = formatParseError(error)
      expect(formatted).toContain('语法错误')
      expect(formatted).toContain('line 42')
      expect(formatted).toContain('Unexpected token')
    })
    
    test('formats schema error with field', () => {
      const error: ParseError = {
        type: 'schema',
        message: 'Missing required field',
        field: 'segments'
      }
      
      const formatted = formatParseError(error)
      expect(formatted).toContain('格式错误')
      expect(formatted).toContain('segments')
      expect(formatted).toContain('Missing required field')
    })
    
    test('formats validation error', () => {
      const error: ParseError = {
        type: 'validation',
        message: 'Invalid segment'
      }
      
      const formatted = formatParseError(error)
      expect(formatted).toContain('验证错误')
      expect(formatted).toContain('Invalid segment')
    })
  })
  
  describe('formatValidationError', () => {
    test('formats overlap error with segment ID', () => {
      const error: ValidationError = {
        type: 'overlap',
        message: 'Segment s1 overlaps with s2',
        segmentId: 's1'
      }
      
      const formatted = formatValidationError(error)
      expect(formatted).toContain('片段重叠')
      expect(formatted).toContain('s1')
      expect(formatted).toContain('Segment s1 overlaps with s2')
    })
    
    test('formats gap error', () => {
      const error: ValidationError = {
        type: 'gap',
        message: 'Gap of 1000ms between segments',
        segmentId: 's1'
      }
      
      const formatted = formatValidationError(error)
      expect(formatted).toContain('片段间隙')
      expect(formatted).toContain('Gap of 1000ms')
    })
    
    test('formats timing error', () => {
      const error: ValidationError = {
        type: 'timing',
        message: 'Negative start time',
        segmentId: 's1'
      }
      
      const formatted = formatValidationError(error)
      expect(formatted).toContain('时间错误')
      expect(formatted).toContain('Negative start time')
    })
    
    test('formats config error', () => {
      const error: ValidationError = {
        type: 'config',
        message: 'Invalid key count',
        segmentId: 's1'
      }
      
      const formatted = formatValidationError(error)
      expect(formatted).toContain('配置错误')
      expect(formatted).toContain('Invalid key count')
    })
    
    test('formats note error with note index', () => {
      const error: ValidationError = {
        type: 'note',
        message: 'Note outside bounds',
        segmentId: 's1',
        noteIndex: 5
      }
      
      const formatted = formatValidationError(error)
      expect(formatted).toContain('音符错误')
      expect(formatted).toContain('s1')
      expect(formatted).toContain('音符 5')
      expect(formatted).toContain('Note outside bounds')
    })
  })
  
  describe('formatChartError', () => {
    test('formats parse error', () => {
      const error: ChartError = {
        type: 'parse',
        message: 'Invalid JSON syntax',
        line: 10
      }
      
      const formatted = formatChartError(error)
      expect(formatted).toContain('语法错误')
      expect(formatted).toContain('line 10')
    })
    
    test('formats validation error with single error', () => {
      const error: ChartError = {
        type: 'validation',
        errors: [{
          type: 'overlap',
          message: 'Segments overlap',
          segmentId: 's1'
        }]
      }
      
      const formatted = formatChartError(error)
      expect(formatted).toContain('片段重叠')
      expect(formatted).toContain('Segments overlap')
    })
    
    test('formats validation error with multiple errors', () => {
      const error: ChartError = {
        type: 'validation',
        errors: [
          { type: 'overlap', message: 'Overlap 1', segmentId: 's1' },
          { type: 'gap', message: 'Gap 1', segmentId: 's2' }
        ]
      }
      
      const formatted = formatChartError(error)
      expect(formatted).toContain('发现 2 个验证错误')
      expect(formatted).toContain('Overlap 1')
      expect(formatted).toContain('Gap 1')
    })
    
    test('formats runtime error', () => {
      const error: ChartError = {
        type: 'runtime',
        message: 'Failed to mount segment',
        segmentId: 's1'
      }
      
      const formatted = formatChartError(error)
      expect(formatted).toContain('运行时错误')
      expect(formatted).toContain('s1')
      expect(formatted).toContain('Failed to mount segment')
    })
    
    test('formats conversion error', () => {
      const error: ChartError = {
        type: 'conversion',
        message: 'Cannot export multi-mode chart',
        reason: 'Multiple modes not supported'
      }
      
      const formatted = formatChartError(error)
      expect(formatted).toContain('转换错误')
      expect(formatted).toContain('Cannot export multi-mode chart')
      expect(formatted).toContain('Multiple modes not supported')
    })
  })
  
  describe('formatValidationReport', () => {
    test('returns success message for empty errors', () => {
      const report = formatValidationReport([])
      expect(report).toBe('谱面验证通过')
    })
    
    test('groups errors by type', () => {
      const errors: ValidationError[] = [
        { type: 'overlap', message: 'Overlap 1', segmentId: 's1' },
        { type: 'overlap', message: 'Overlap 2', segmentId: 's2' },
        { type: 'gap', message: 'Gap 1', segmentId: 's3' },
        { type: 'timing', message: 'Timing 1', segmentId: 's4' }
      ]
      
      const report = formatValidationReport(errors)
      expect(report).toContain('发现 4 个验证错误')
      expect(report).toContain('片段重叠 (2)')
      expect(report).toContain('片段间隙 (1)')
      expect(report).toContain('时间错误 (1)')
      expect(report).toContain('Overlap 1')
      expect(report).toContain('Overlap 2')
      expect(report).toContain('Gap 1')
      expect(report).toContain('Timing 1')
    })
  })
  
  describe('getErrorSeverity', () => {
    test('returns warning for gap errors', () => {
      const error: ValidationError = {
        type: 'gap',
        message: 'Gap detected'
      }
      
      expect(getErrorSeverity(error)).toBe('warning')
    })
    
    test('returns error for non-gap errors', () => {
      const errors: ValidationError[] = [
        { type: 'overlap', message: 'Overlap' },
        { type: 'timing', message: 'Timing' },
        { type: 'config', message: 'Config' },
        { type: 'note', message: 'Note' }
      ]
      
      for (const error of errors) {
        expect(getErrorSeverity(error)).toBe('error')
      }
    })
  })
  
  describe('hasCriticalErrors', () => {
    test('returns false for empty errors', () => {
      expect(hasCriticalErrors([])).toBe(false)
    })
    
    test('returns false for only gap errors', () => {
      const errors: ValidationError[] = [
        { type: 'gap', message: 'Gap 1' },
        { type: 'gap', message: 'Gap 2' }
      ]
      
      expect(hasCriticalErrors(errors)).toBe(false)
    })
    
    test('returns true for critical errors', () => {
      const errors: ValidationError[] = [
        { type: 'gap', message: 'Gap 1' },
        { type: 'overlap', message: 'Overlap 1' }
      ]
      
      expect(hasCriticalErrors(errors)).toBe(true)
    })
  })
})
