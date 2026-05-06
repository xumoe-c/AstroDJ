export class AudioEngine {
    private ctx: AudioContext | null = null
    private buffer: AudioBuffer | null = null
    private source: AudioBufferSourceNode | null = null
    private startAt: number = 0
    private endCallback: (() => void) | null = null
    private playing = false
    
    // Performance optimization: cache for loaded audio
    private static audioCache = new Map<string, AudioBuffer>()
    private static readonly MAX_CACHE_SIZE = 10 // Limit cache to 10 audio files
    private currentUrl: string | null = null

    private getCtx(): AudioContext {
        if (!this.ctx) {
            this.ctx = new AudioContext()
        }
        return this.ctx
    }

    async load(url: string): Promise<void> {
        const ctx = this.getCtx()
        
        // Check cache first for performance
        if (AudioEngine.audioCache.has(url)) {
            this.buffer = AudioEngine.audioCache.get(url)!
            this.currentUrl = url
            return
        }
        
        // Load and decode audio
        const response = await fetch(url)
        const arrayBuffer = await response.arrayBuffer()
        this.buffer = await ctx.decodeAudioData(arrayBuffer)
        
        // Cache the decoded audio buffer
        this.cacheAudioBuffer(url, this.buffer)
        this.currentUrl = url
    }
    
    private cacheAudioBuffer(url: string, buffer: AudioBuffer): void {
        // Implement LRU cache: remove oldest entry if cache is full
        if (AudioEngine.audioCache.size >= AudioEngine.MAX_CACHE_SIZE) {
            const firstKey = AudioEngine.audioCache.keys().next().value
            if (firstKey) {
                AudioEngine.audioCache.delete(firstKey)
            }
        }
        
        AudioEngine.audioCache.set(url, buffer)
    }
    
    // Preload audio for faster playback
    static async preload(url: string): Promise<void> {
        if (AudioEngine.audioCache.has(url)) {
            return // Already cached
        }
        
        try {
            const ctx = new AudioContext()
            const response = await fetch(url)
            const arrayBuffer = await response.arrayBuffer()
            const buffer = await ctx.decodeAudioData(arrayBuffer)
            
            // Cache the preloaded buffer
            if (AudioEngine.audioCache.size >= AudioEngine.MAX_CACHE_SIZE) {
                const firstKey = AudioEngine.audioCache.keys().next().value
                if (firstKey) {
                    AudioEngine.audioCache.delete(firstKey)
                }
            }
            
            AudioEngine.audioCache.set(url, buffer)
        } catch (error) {
            console.error('Failed to preload audio:', error)
        }
    }
    
    // Clear cache to free memory
    static clearCache(): void {
        AudioEngine.audioCache.clear()
    }

    start(leadInMs: number = 1500, offsetMs: number = 0): void {
        if (!this.buffer) throw new Error('Audio not loaded')

        const ctx = this.getCtx()
        this.source = ctx.createBufferSource()
        this.source.buffer = this.buffer
        this.source.connect(ctx.destination)

        const leadInSec = leadInMs / 1000
        const offsetSec = offsetMs / 1000

        this.startAt = ctx.currentTime + leadInSec - offsetSec
        this.source.start(ctx.currentTime + leadInSec, offsetSec)
        this.playing = true

        this.source.onended = () => {
            this.playing = false
            this.endCallback?.()
        }
    }

    stop(): void {
        if (this.source) {
            try {
                this.source.stop()
            } catch {
                // already stopped
            }
            this.source = null
        }
        this.playing = false
    }

    get songTimeMs(): number {
        if (!this.ctx) return 0
        return (this.ctx.currentTime - this.startAt) * 1000
    }

    get duration(): number {
        return this.buffer ? this.buffer.duration * 1000 : 0
    }

    get isPlaying(): boolean {
        return this.playing
    }

    onEnded(cb: () => void): void {
        this.endCallback = cb
    }

    async resume(): Promise<void> {
        const ctx = this.getCtx()
        if (ctx.state === 'suspended') {
            await ctx.resume()
        }
    }
}
