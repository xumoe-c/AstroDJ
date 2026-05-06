/**
 * Error Handler Utility
 * 
 * Provides centralized error handling for chart parsing, validation, and runtime errors.
 * Requirement 5.3: Display parse errors with descriptive messages
 * Requirement 7.6: Display validation errors
 */

import type { ChartError, ValidationError, ParseError } from './types'

/**
 * Format a parse error into a user-friendly message
 */
export function formatParseError(error: ParseError): string {
    const location = error.line ? ` (line ${error.line})` : ''
    const field = error.field ? ` in field "${error.field}"` : ''
    
    switch (error.type) {
        case 'syntax':
            return `语法错误${location}: ${error.message}`
        case 'schema':
            return `格式错误${field}: ${error.message}`
        case 'validation':
            return `验证错误: ${error.message}`
        default:
            return `解析错误: ${error.message}`
    }
}

/**
 * Format a validation error into a user-friendly message
 */
export function formatValidationError(error: ValidationError): string {
    const segment = error.segmentId ? ` (片段 ${error.segmentId})` : ''
    const note = error.noteIndex !== undefined ? ` (音符 ${error.noteIndex})` : ''
    
    switch (error.type) {
        case 'overlap':
            return `片段重叠${segment}: ${error.message}`
        case 'gap':
            return `片段间隙${segment}: ${error.message}`
        case 'timing':
            return `时间错误${segment}: ${error.message}`
        case 'config':
            return `配置错误${segment}: ${error.message}`
        case 'note':
            return `音符错误${segment}${note}: ${error.message}`
        default:
            return `验证错误${segment}: ${error.message}`
    }
}

/**
 * Format a chart error into a user-friendly message
 */
export function formatChartError(error: ChartError): string {
    switch (error.type) {
        case 'parse':
            // Determine parse error type from message content
            const parseErrorType = error.message.includes('JSON') || error.message.includes('syntax') 
                ? 'syntax' 
                : 'schema'
            return formatParseError({
                type: parseErrorType,
                message: error.message,
                line: error.line,
                field: error.field
            })
        case 'validation':
            if (error.errors.length === 1) {
                return formatValidationError(error.errors[0])
            }
            return `发现 ${error.errors.length} 个验证错误:\n${error.errors.map(e => '• ' + formatValidationError(e)).join('\n')}`
        case 'runtime':
            const segment = error.segmentId ? ` (片段 ${error.segmentId})` : ''
            return `运行时错误${segment}: ${error.message}`
        case 'conversion':
            return `转换错误: ${error.message} (${error.reason})`
        default:
            return `未知错误: ${JSON.stringify(error)}`
    }
}

/**
 * Format multiple validation errors into a detailed report
 */
export function formatValidationReport(errors: ValidationError[]): string {
    if (errors.length === 0) {
        return '谱面验证通过'
    }
    
    // Group errors by type
    const grouped: Record<string, ValidationError[]> = {}
    for (const error of errors) {
        if (!grouped[error.type]) {
            grouped[error.type] = []
        }
        grouped[error.type].push(error)
    }
    
    const sections: string[] = []
    
    // Format each group
    if (grouped.overlap) {
        sections.push(`片段重叠 (${grouped.overlap.length}):\n${grouped.overlap.map(e => '  • ' + e.message).join('\n')}`)
    }
    if (grouped.gap) {
        sections.push(`片段间隙 (${grouped.gap.length}):\n${grouped.gap.map(e => '  • ' + e.message).join('\n')}`)
    }
    if (grouped.timing) {
        sections.push(`时间错误 (${grouped.timing.length}):\n${grouped.timing.map(e => '  • ' + e.message).join('\n')}`)
    }
    if (grouped.config) {
        sections.push(`配置错误 (${grouped.config.length}):\n${grouped.config.map(e => '  • ' + e.message).join('\n')}`)
    }
    if (grouped.note) {
        sections.push(`音符错误 (${grouped.note.length}):\n${grouped.note.map(e => '  • ' + e.message).join('\n')}`)
    }
    
    return `发现 ${errors.length} 个验证错误:\n\n${sections.join('\n\n')}`
}

/**
 * Get error severity level
 */
export function getErrorSeverity(error: ValidationError): 'error' | 'warning' {
    // Gaps are warnings, everything else is an error
    return error.type === 'gap' ? 'warning' : 'error'
}

/**
 * Check if validation errors contain any critical errors (non-warnings)
 */
export function hasCriticalErrors(errors: ValidationError[]): boolean {
    return errors.some(e => getErrorSeverity(e) === 'error')
}
