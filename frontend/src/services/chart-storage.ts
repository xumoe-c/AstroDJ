/**
 * IndexedDB Storage Service for AstroDJ Charts
 * 
 * Provides local storage for user-uploaded charts using IndexedDB.
 * Charts are stored as ZIP blobs with metadata for quick listing.
 */

import type { Chart } from '../game/types'
import JSZip from 'jszip'

export interface StoredChart {
  id: string
  name: string
  blob: Blob
  metadata: {
    title: string
    artist: string
    creator?: string
    version?: string
    duration: number
    bpm?: number
    coverArt?: string
    uploadedAt: number
  }
}

export class ChartStorage {
  private db: IDBDatabase | null = null
  private readonly DB_NAME = 'AstroDJ'
  private readonly DB_VERSION = 1
  private readonly STORE_NAME = 'charts'

  /**
   * Initialize the IndexedDB database
   */
  async init(): Promise<void> {
    if (this.db) return

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION)

      request.onerror = () => reject(new Error('Failed to open IndexedDB'))

      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' })
          store.createIndex('uploadedAt', 'metadata.uploadedAt', { unique: false })
          store.createIndex('name', 'name', { unique: false })
        }
      }
    })
  }

  /**
   * Save a chart ZIP file to IndexedDB
   */
  async saveChart(name: string, zipBlob: Blob): Promise<string> {
    await this.init()

    // Extract metadata from ZIP
    const metadata = await this.extractMetadata(zipBlob)

    // Generate unique ID
    const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const storedChart: StoredChart = {
      id,
      name,
      blob: zipBlob,
      metadata: {
        ...metadata,
        uploadedAt: Date.now()
      }
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite')
      const store = transaction.objectStore(this.STORE_NAME)
      const request = store.put(storedChart)

      request.onsuccess = () => resolve(id)
      request.onerror = () => reject(new Error('Failed to save chart'))
    })
  }

  /**
   * Get a chart by ID
   */
  async getChart(id: string): Promise<StoredChart | null> {
    await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly')
      const store = transaction.objectStore(this.STORE_NAME)
      const request = store.get(id)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(new Error('Failed to get chart'))
    })
  }

  /**
   * List all stored charts
   */
  async listCharts(): Promise<StoredChart[]> {
    await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly')
      const store = transaction.objectStore(this.STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(new Error('Failed to list charts'))
    })
  }

  /**
   * Delete a chart by ID
   */
  async deleteChart(id: string): Promise<void> {
    await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite')
      const store = transaction.objectStore(this.STORE_NAME)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error('Failed to delete chart'))
    })
  }

  /**
   * Extract chart.json from ZIP and parse metadata
   */
  private async extractMetadata(zipBlob: Blob): Promise<{
    title: string
    artist: string
    creator?: string
    version?: string
    duration: number
    bpm?: number
    coverArt?: string
  }> {
    try {
      const zip = await JSZip.loadAsync(zipBlob)
      const chartFile = zip.file('chart.json')

      if (!chartFile) {
        throw new Error('chart.json not found in ZIP')
      }

      const chartText = await chartFile.async('text')
      const chart: Chart = JSON.parse(chartText)

      return {
        title: chart.meta.title,
        artist: chart.meta.artist,
        creator: chart.meta.creator,
        version: chart.meta.version,
        duration: chart.meta.length,
        bpm: chart.meta.bpm,
        coverArt: chart.meta.coverArt
      }
    } catch (error) {
      console.error('Failed to extract metadata:', error)
      return {
        title: 'Unknown',
        artist: 'Unknown',
        duration: 0
      }
    }
  }

  /**
   * Load chart data from stored ZIP
   */
  async loadChartData(id: string): Promise<{
    chart: Chart
    audioUrl: string
    coverUrl?: string
  } | null> {
    const stored = await this.getChart(id)
    if (!stored) return null

    try {
      const zip = await JSZip.loadAsync(stored.blob)

      // Load chart.json
      const chartFile = zip.file('chart.json')
      if (!chartFile) throw new Error('chart.json not found')

      const chartText = await chartFile.async('text')
      const chart: Chart = JSON.parse(chartText)

      // Load audio file
      const audioFileName = chart.meta.audio
      const audioFile = zip.file(audioFileName)
      if (!audioFile) throw new Error(`Audio file ${audioFileName} not found`)

      const audioBlob = await audioFile.async('blob')
      const audioUrl = URL.createObjectURL(audioBlob)

      // Load cover if exists
      let coverUrl: string | undefined
      const coverFile = zip.file(/^cover\.(jpg|jpeg|png)$/i)[0]
      if (coverFile) {
        const coverBlob = await coverFile.async('blob')
        coverUrl = URL.createObjectURL(coverBlob)
      }

      return { chart, audioUrl, coverUrl }
    } catch (error) {
      console.error('Failed to load chart data:', error)
      return null
    }
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats(): Promise<{
    chartCount: number
    totalSize: number
  }> {
    const charts = await this.listCharts()
    const totalSize = charts.reduce((sum, chart) => sum + chart.blob.size, 0)

    return {
      chartCount: charts.length,
      totalSize
    }
  }
}

// Singleton instance
export const chartStorage = new ChartStorage()
