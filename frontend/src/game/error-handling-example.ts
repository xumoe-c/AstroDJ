/**
 * Example usage of Result type and error interfaces
 * This file demonstrates how to use the error handling types defined in types.ts
 */

import type { Chart, ParseError, ValidationError, ChartError } from './types'
import { Result, Ok, Err } from './types'

// Example 1: Using Result with ParseError
function parseJSON(json: string): Result<any, ParseError> {
    try {
        const data = JSON.parse(json)
        return Ok(data)
    } catch (e) {
        return Err({
            type: 'syntax',
            message: e instanceof Error ? e.message : 'Unknown error',
            line: undefined,
            field: undefined
        })
    }
}

// Example 2: Using Result with ValidationError array
function validateChart(chart: Chart): Result<void, ValidationError[]> {
    const errors: ValidationError[] = []
    
    // Check for segment overlaps
    for (let i = 0; i < chart.segments.length - 1; i++) {
        const current = chart.segments[i]
        const next = chart.segments[i + 1]
        
        if (current.endMs > next.startMs) {
            errors.push({
                type: 'overlap',
                message: `Segment ${current.id} overlaps with ${next.id}`,
                segmentId: current.id
            })
        }
    }
    
    // Check for timing issues
    for (const segment of chart.segments) {
        if (segment.startMs < 0) {
            errors.push({
                type: 'timing',
                message: `Segment ${segment.id} has negative start time`,
                segmentId: segment.id
            })
        }
        
        if (segment.endMs <= segment.startMs) {
            errors.push({
                type: 'timing',
                message: `Segment ${segment.id} end time must be after start time`,
                segmentId: segment.id
            })
        }
    }
    
    if (errors.length > 0) {
        return Err(errors)
    }
    
    return Ok(undefined)
}

// Example 3: Using ChartError discriminated union
function loadChart(input: string): Result<Chart, ChartError> {
    // Try to parse
    const parseResult = parseJSON(input)
    if (!parseResult.ok) {
        return Err({
            type: 'parse',
            message: parseResult.error.message,
            line: parseResult.error.line,
            field: parseResult.error.field
        })
    }
    
    const chart = parseResult.value as Chart
    
    // Validate
    const validationResult = validateChart(chart)
    if (!validationResult.ok) {
        return Err({
            type: 'validation',
            errors: validationResult.error
        })
    }
    
    return Ok(chart)
}

// Example 4: Pattern matching on Result
function handleChartLoad(input: string): void {
    const result = loadChart(input)
    
    if (result.ok) {
        console.log('Chart loaded successfully:', result.value)
    } else {
        // Pattern match on error type
        switch (result.error.type) {
            case 'parse':
                console.error('Parse error:', result.error.message)
                if (result.error.line) {
                    console.error('  at line:', result.error.line)
                }
                break
                
            case 'validation':
                console.error('Validation errors:')
                for (const err of result.error.errors) {
                    console.error(`  - ${err.type}: ${err.message}`)
                }
                break
                
            case 'runtime':
                console.error('Runtime error:', result.error.message)
                if (result.error.segmentId) {
                    console.error('  in segment:', result.error.segmentId)
                }
                break
                
            case 'conversion':
                console.error('Conversion error:', result.error.message)
                console.error('  reason:', result.error.reason)
                break
        }
    }
}

// Example 5: Chaining Results
function processChart(input: string): Result<string, ChartError> {
    const loadResult = loadChart(input)
    if (!loadResult.ok) {
        return loadResult
    }
    
    const chart = loadResult.value
    
    // Do some processing...
    const processed = `Processed chart: ${chart.meta.title}`
    
    return Ok(processed)
}

// Example 6: Using ValidationError types
function createValidationError(
    type: ValidationError['type'],
    message: string,
    segmentId?: string,
    noteIndex?: number
): ValidationError {
    return {
        type,
        message,
        segmentId,
        noteIndex
    }
}

// Example usage
const overlapError = createValidationError('overlap', 'Segments overlap', 's1')
const gapError = createValidationError('gap', 'Gap too large', 's2')
const timingError = createValidationError('timing', 'Invalid timing', 's3')
const configError = createValidationError('config', 'Invalid config', 's4')
const noteError = createValidationError('note', 'Note out of bounds', 's5', 10)

export {
    parseJSON,
    validateChart,
    loadChart,
    handleChartLoad,
    processChart,
    createValidationError
}
