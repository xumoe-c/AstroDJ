/**
 * Example usage of the extended Chart interface with osuMetadata and timingPoints
 * This file demonstrates the new optional fields added in task 1.1
 */

import type { Chart, OsuMetadata, TimingPoint } from './types'

// Example 1: Chart without osu metadata (backward compatible)
const basicChart: Chart = {
  meta: {
    title: 'Basic Song',
    artist: 'Artist Name',
    audio: 'song.mp3',
    length: 180000
  },
  segments: []
}

// Example 2: Chart with osu metadata
const chartWithMetadata: Chart = {
  meta: {
    title: 'Imported Song',
    artist: 'Artist Name',
    audio: 'song.mp3',
    length: 180000
  },
  segments: [],
  osuMetadata: {
    creator: 'Mapper Name',
    version: 'Hard',
    source: 'Game OST',
    tags: ['electronic', 'rhythm', 'fast'],
    beatmapID: 123456,
    beatmapSetID: 789012,
    hpDrainRate: 5,
    approachRate: 9,
    sliderMultiplier: 1.4,
    sliderTickRate: 1
  }
}

// Example 3: Chart with timing points
const chartWithTiming: Chart = {
  meta: {
    title: 'Song with Timing',
    artist: 'Artist Name',
    audio: 'song.mp3',
    length: 180000
  },
  segments: [],
  timingPoints: [
    {
      time: 0,
      beatLength: 500, // 120 BPM
      meter: 4,
      sampleSet: 1,
      sampleIndex: 0,
      volume: 100,
      uninherited: true, // BPM change
      effects: 0
    },
    {
      time: 60000,
      beatLength: -100, // Inherited point (slider velocity)
      meter: 4,
      sampleSet: 1,
      sampleIndex: 0,
      volume: 80,
      uninherited: false,
      effects: 1 // Kiai time
    }
  ]
}

// Example 4: Full chart with both metadata and timing
const fullChart: Chart = {
  meta: {
    title: 'Complete Imported Chart',
    artist: 'Artist Name',
    audio: 'song.mp3',
    length: 180000
  },
  segments: [],
  osuMetadata: {
    creator: 'Expert Mapper',
    version: 'Insane',
    beatmapID: 999999
  },
  timingPoints: [
    {
      time: 0,
      beatLength: 500,
      meter: 4,
      sampleSet: 1,
      sampleIndex: 0,
      volume: 100,
      uninherited: true,
      effects: 0
    }
  ]
}

// Type checking examples
const metadata: OsuMetadata = {
  creator: 'Mapper',
  version: 'Normal'
  // All other fields are optional
}

const timingPoint: TimingPoint = {
  time: 1000,
  beatLength: 600,
  meter: 4,
  sampleSet: 1,
  sampleIndex: 0,
  volume: 100,
  uninherited: true,
  effects: 0
}

export { basicChart, chartWithMetadata, chartWithTiming, fullChart, metadata, timingPoint }
