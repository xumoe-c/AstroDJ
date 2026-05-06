/**
 * Chart metadata parsing utilities
 * Provides functions to extract and calculate metadata from chart data
 */

import type { Chart, Segment } from './types'

export type Rank = 'SS' | 'S' | 'A' | 'B' | 'C' | 'D'

export interface ModeDistribution {
  osu: number
  mania: number
  taiko: number
}

/**
 * Calculate song duration from chart segments
 * @param chart - Chart data
 * @returns Duration in seconds (rounded up)
 */
export function calculateDuration(chart: Chart): number {
  if (!chart.segments || chart.segments.length === 0) {
    return 0
  }
  const lastSegment = chart.segments[chart.segments.length - 1]
  return Math.ceil(lastSegment.endMs / 1000)
}

/**
 * Extract BPM from chart metadata
 * @param chart - Chart data
 * @returns BPM value or null if not available
 */
export function extractBPM(chart: Chart): number | null {
  return chart.osuMetadata?.bpm ?? null
}

/**
 * Calculate mode distribution percentages
 * @param chart - Chart data
 * @returns Mode distribution with percentages for each mode
 */
export function calculateModeDistribution(chart: Chart): ModeDistribution {
  if (!chart.segments || chart.segments.length === 0) {
    return { osu: 0, mania: 0, taiko: 0 }
  }

  const totalDuration = chart.segments[chart.segments.length - 1].endMs
  
  const modeDurations = {
    osu: 0,
    mania: 0,
    taiko: 0
  }
  
  for (const segment of chart.segments) {
    const duration = segment.endMs - segment.startMs
    if (segment.mode === 'osu-standard') {
      modeDurations.osu += duration
    } else if (segment.mode === 'mania') {
      modeDurations.mania += duration
    } else if (segment.mode === 'taiko') {
      modeDurations.taiko += duration
    }
  }
  
  return {
    osu: Math.round((modeDurations.osu / totalDuration) * 100),
    mania: Math.round((modeDurations.mania / totalDuration) * 100),
    taiko: Math.round((modeDurations.taiko / totalDuration) * 100)
  }
}

/**
 * Compare two ranks
 * @param a - First rank
 * @param b - Second rank
 * @returns Positive if a > b, negative if a < b, 0 if equal
 */
export function compareRanks(a: Rank, b: Rank): number {
  const order = ['D', 'C', 'B', 'A', 'S', 'SS']
  return order.indexOf(a) - order.indexOf(b)
}

/**
 * Load best rank from localStorage
 * @param chartName - Chart name
 * @returns Best rank or null if not found
 */
export function loadBestRank(chartName: string): Rank | null {
  try {
    const key = `best_rank_${chartName}`
    return localStorage.getItem(key) as Rank | null
  } catch (error) {
    console.warn('Failed to load best rank:', error)
    return null
  }
}

/**
 * Save best rank to localStorage
 * @param chartName - Chart name
 * @param rank - Achieved rank
 */
export function saveBestRank(chartName: string, rank: Rank): void {
  try {
    const key = `best_rank_${chartName}`
    const existing = localStorage.getItem(key) as Rank | null
    
    // Only update if new rank is better
    if (!existing || compareRanks(rank, existing) > 0) {
      localStorage.setItem(key, rank)
    }
  } catch (error) {
    console.warn('Failed to save best rank:', error)
    // Fail silently - not critical for gameplay
  }
}
