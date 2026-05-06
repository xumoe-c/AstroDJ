import { describe, test, expect } from 'vitest'
import { Result, Ok, Err, ParseError, ValidationError, ChartError } from './types'

describe('Result type', () => {
    test('Ok creates successful result', () => {
        const result: Result<number, string> = Ok(42)
        
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.value).toBe(42)
        }
    })
    
    test('Err creates error result', () => {
        const result: Result<number, string> = Err('error message')
        
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.error).toBe('error message')
        }
    })
    
    test('Result type is discriminated union', () => {
        const success: Result<string, Error> = Ok('success')
        const failure: Result<string, Error> = Err(new Error('failure'))
        
        if (success.ok) {
            expect(success.value).toBe('success')
        } else {
            throw new Error('Should be ok')
        }
        
        if (!failure.ok) {
            expect(failure.error.message).toBe('failure')
        } else {
            throw new Error('Should be error')
        }
    })
})

describe('ParseError interface', () => {
    test('ParseError has required fields', () => {
        const error: ParseError = {
            type: 'syntax',
            message: 'Invalid JSON'
        }
        
        expect(error.type).toBe('syntax')
        expect(error.message).toBe('Invalid JSON')
    })
    
    test('ParseError has optional fields', () => {
        const error: ParseError = {
            type: 'schema',
            message: 'Missing field',
            line: 10,
            field: 'segments'
        }
        
        expect(error.line).toBe(10)
        expect(error.field).toBe('segments')
    })
    
    test('ParseError type is discriminated', () => {
        const syntaxError: ParseError = { type: 'syntax', message: 'Syntax error' }
        const schemaError: ParseError = { type: 'schema', message: 'Schema error' }
        const validationError: ParseError = { type: 'validation', message: 'Validation error' }
        
        expect(syntaxError.type).toBe('syntax')
        expect(schemaError.type).toBe('schema')
        expect(validationError.type).toBe('validation')
    })
})

describe('ValidationError interface', () => {
    test('ValidationError has required fields', () => {
        const error: ValidationError = {
            type: 'overlap',
            message: 'Segments overlap'
        }
        
        expect(error.type).toBe('overlap')
        expect(error.message).toBe('Segments overlap')
    })
    
    test('ValidationError has optional fields', () => {
        const error: ValidationError = {
            type: 'note',
            message: 'Note outside bounds',
            segmentId: 'seg1',
            noteIndex: 5
        }
        
        expect(error.segmentId).toBe('seg1')
        expect(error.noteIndex).toBe(5)
    })
    
    test('ValidationError type is discriminated', () => {
        const overlapError: ValidationError = { type: 'overlap', message: 'Overlap' }
        const gapError: ValidationError = { type: 'gap', message: 'Gap' }
        const timingError: ValidationError = { type: 'timing', message: 'Timing' }
        const configError: ValidationError = { type: 'config', message: 'Config' }
        const noteError: ValidationError = { type: 'note', message: 'Note' }
        
        expect(overlapError.type).toBe('overlap')
        expect(gapError.type).toBe('gap')
        expect(timingError.type).toBe('timing')
        expect(configError.type).toBe('config')
        expect(noteError.type).toBe('note')
    })
})

describe('ChartError discriminated union', () => {
    test('ChartError can be parse error', () => {
        const error: ChartError = {
            type: 'parse',
            message: 'Parse failed',
            line: 5,
            field: 'meta'
        }
        
        expect(error.type).toBe('parse')
        expect(error.message).toBe('Parse failed')
        if (error.type === 'parse') {
            expect(error.line).toBe(5)
            expect(error.field).toBe('meta')
        }
    })
    
    test('ChartError can be validation error', () => {
        const validationErrors: ValidationError[] = [
            { type: 'overlap', message: 'Overlap detected', segmentId: 's1' }
        ]
        const error: ChartError = {
            type: 'validation',
            errors: validationErrors
        }
        
        expect(error.type).toBe('validation')
        if (error.type === 'validation') {
            expect(error.errors).toHaveLength(1)
            expect(error.errors[0].type).toBe('overlap')
        }
    })
    
    test('ChartError can be runtime error', () => {
        const error: ChartError = {
            type: 'runtime',
            message: 'Runtime failed',
            segmentId: 'seg1'
        }
        
        expect(error.type).toBe('runtime')
        if (error.type === 'runtime') {
            expect(error.message).toBe('Runtime failed')
            expect(error.segmentId).toBe('seg1')
        }
    })
    
    test('ChartError can be conversion error', () => {
        const error: ChartError = {
            type: 'conversion',
            message: 'Conversion failed',
            reason: 'Unsupported format'
        }
        
        expect(error.type).toBe('conversion')
        if (error.type === 'conversion') {
            expect(error.message).toBe('Conversion failed')
            expect(error.reason).toBe('Unsupported format')
        }
    })
})

describe('Result with error types', () => {
    test('Result can use ParseError', () => {
        const success: Result<string, ParseError> = Ok('parsed')
        const failure: Result<string, ParseError> = Err({
            type: 'syntax',
            message: 'Invalid syntax'
        })
        
        expect(success.ok).toBe(true)
        expect(failure.ok).toBe(false)
    })
    
    test('Result can use ChartError', () => {
        const success: Result<any, ChartError> = Ok({ data: 'chart' })
        const failure: Result<any, ChartError> = Err({
            type: 'parse',
            message: 'Parse failed'
        })
        
        expect(success.ok).toBe(true)
        expect(failure.ok).toBe(false)
    })
})
